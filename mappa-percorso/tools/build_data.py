"""3/3 · Elabora i dati e scrive i file serviti dal componente in ../data (o nella cartella indicata)."""
import math, glob, json, os, pickle, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import shapely.wkb as wkb
from shapely.geometry import LineString

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
W, E, S, N = 15.360, 15.438, 39.984, 40.024
LAT0 = (S + N) / 2
MX = 111320 * math.cos(math.radians(LAT0))  # m per grado lon
MY = 110540
WM, HM = (E - W) * MX, (N - S) * MY            # metri
GW, GH = 640, int(round(640 * HM / WM))        # griglia altimetrica
TW = 4096; TH = int(round(TW * HM / WM))       # texture

def ll2m(lon, lat):  # metri locali, origine al centro, y verso nord
    return ((lon - (W + E) / 2) * MX, (lat - (S + N) / 2) * MY)

# ---------- DEM (AWS Terrain Tiles, terrarium, z14) ----------
Z = 13
def tilexy(lon, lat):
    n = 2 ** Z
    return ((lon + 180) / 360 * n, (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * n)
tiles = {}
for p in glob.glob('dem/13_*.png'):
    _, x, y = p[:-4].split('/')[-1].split('_'); tiles[(int(x), int(y))] = p
xs = sorted({k[0] for k in tiles}); ys = sorted({k[1] for k in tiles})
mos = np.zeros((len(ys) * 256, len(xs) * 256), np.float32)
for (x, y), p in tiles.items():
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    mos[(y - ys[0]) * 256:(y - ys[0] + 1) * 256, (x - xs[0]) * 256:(x - xs[0] + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

_med = ndimage.median_filter(mos, 5)
_bad = np.abs(mos - _med) > 40
print('DEM: pixel anomali corretti', int(_bad.sum()))
mos[_bad] = _med[_bad]
mos = ndimage.gaussian_filter(mos, 0.8)  # attenua le righe di cucitura del DEM

def sample_dem(lon, lat):
    tx, ty = tilexy(lon, lat)
    px = (tx - xs[0]) * 256 - 0.5; py = (ty - ys[0]) * 256 - 0.5
    return ndimage.map_coordinates(mos, [np.atleast_1d(py), np.atleast_1d(px)], order=3, mode='nearest')

def grid(w, h):
    lon = W + (np.arange(w) + 0.5) / w * (E - W)
    lat = N - (np.arange(h) + 0.5) / h * (N - S)
    return np.meshgrid(lon, lat)

# ---------- Vettori OSM (via Overture Maps) ----------
base = pickle.load(open('base2.pkl', 'rb'))
def polys(rows, classes):
    out = []
    for r in rows:
        if r['cls'] in classes:
            g = r['geom']
            out += [g] if g.geom_type == 'Polygon' else [q for q in getattr(g, 'geoms', []) if q.geom_type == 'Polygon']
    return out
def lines(rows, classes):
    out = []
    for r in rows:
        if r['cls'] in classes:
            g = r['geom']
            if g.geom_type == 'LineString': out.append(g)
            elif g.geom_type == 'MultiLineString': out += list(g.geoms)
            elif g.geom_type == 'Polygon': out.append(g.exterior)
    return out

def to_px(lon, lat, w, h):
    return ((lon - W) / (E - W) * w, (N - lat) / (N - S) * h)

def raster(polylist, w, h, ss=1):
    im = Image.new('L', (w * ss, h * ss), 0); d = ImageDraw.Draw(im)
    for p in polylist:
        d.polygon([to_px(x, y, w * ss, h * ss) for x, y in p.exterior.coords], fill=255)
        for hole in p.interiors:
            d.polygon([to_px(x, y, w * ss, h * ss) for x, y in hole.coords], fill=0)
    if ss > 1: im = im.resize((w, h), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255

land_polys = polys(base['land'], {'land', 'islet'})

# ---------- Altimetria su griglia ----------
glon, glat = grid(GW, GH)
H = sample_dem(glon.ravel(), glat.ravel()).reshape(GH, GW)
landg = raster(land_polys, GW, GH, ss=4)
# sopra il mare: quota 0 netta lungo la costa OSM; terra almeno 0.5 m
H = np.where(landg > 0.5, np.maximum(H, 0.5), np.minimum(H, -1.0))
H = np.where(landg > 0.5, H, np.maximum(H, -60))  # fondale compresso (solo per profondita visiva)
enc = np.clip(np.round((H + 100) * 10), 0, 65535).astype(np.uint32)
rgb = np.stack([(enc >> 8) & 255, enc & 255, np.zeros_like(enc)], -1).astype(np.uint8)
Image.fromarray(rgb, 'RGB').save(f'{OUT}/terrain-height.png', optimize=True)
print('grid', GW, GH, 'H range', H.min(), H.max())

# ---------- Texture cartografica ----------
tlon, tlat = grid(TW, TH)
Ht = sample_dem(tlon.ravel(), tlat.ravel()).reshape(TH, TW)
landt = raster(land_polys, TW, TH, ss=2)
Ht = np.where(landt > 0.5, np.maximum(Ht, 0.3), 0)
# ESA WorldCover 2021 (10 m)
wc = np.load('wc.npy')  # finestra 15.355..15.440, 39.982..40.026
WC_W, WC_E, WC_S, WC_N = 15.355, 15.440, 39.982, 40.026
r = ((WC_N - tlat) / (WC_N - WC_S) * wc.shape[0]).astype(int).clip(0, wc.shape[0] - 1)
c = ((tlon - WC_W) / (WC_E - WC_W) * wc.shape[1]).astype(int).clip(0, wc.shape[1] - 1)
lc = wc[r, c]
pal = {  # toni smorzati, presi dal paesaggio
    10: (104, 118, 82),    # bosco (lecci, pini)
    20: (134, 138, 101),  # macchia mediterranea
    30: (170, 164, 125),  # prateria
    40: (184, 172, 134),  # coltivi / uliveti
    50: (196, 186, 168),  # abitato
    60: (205, 192, 165),  # roccia nuda
    80: (150, 150, 120),  # (acqua in WC: sulla terra la tratto come macchia)
    90: (150, 150, 120), 95: (150, 150, 120), 100: (170, 164, 125),
}
col = np.zeros((TH, TW, 3), np.float32) + np.array(pal[20], np.float32)
for k, v in pal.items(): col[lc == k] = v
col = ndimage.gaussian_filter(col, sigma=(5.0, 5.0, 0))  # bordi morbidi tra classi
# spiagge e roccia OSM
beach = raster(polys(base['land'], {'beach', 'shingle'}), TW, TH, ss=2)
rock = raster(polys(base['land'], {'bare_rock'}), TW, TH, ss=2)
col = col * (1 - beach[..., None]) + np.array((226, 212, 182)) * beach[..., None]
col = col * (1 - 0.6 * rock[..., None]) + np.array((206, 196, 176)) * 0.6 * rock[..., None]
# trama del bosco: puntinatura minimale
rng = np.random.default_rng(7)
forest = ndimage.gaussian_filter((lc == 10).astype(np.float32), 2.4)
dots = (rng.random((TH, TW)) < 0.035).astype(np.float32)
dots = ndimage.gaussian_filter(dots, 1.3) * 7.0
col *= (1 - 0.16 * np.clip(dots, 0, 1) * forest)[..., None]
# ombreggiatura morbida (luce da nord-ovest) + occlusione
px = WM / TW
gy, gx = np.gradient(ndimage.gaussian_filter(Ht, 5.0) * 1.5, px)
az, alt = math.radians(315), math.radians(42)
slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
hs = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
hs = np.clip(hs, 0, 1)
hs_n = hs / max(np.sin(alt), 1e-3)
ao = np.clip(1 - (ndimage.gaussian_filter(Ht, 36) - Ht) / 60, 0.75, 1.05)
shade = (0.55 + 0.45 * hs_n) * ao
col_land = np.clip(col * shade[..., None], 0, 255)
# mare: sfumatura per distanza dalla costa
dist = ndimage.distance_transform_edt(landt < 0.5) * px
t1 = np.clip(dist / 60, 0, 1); t2 = np.clip((dist - 60) / 600, 0, 1); t3 = np.clip((dist - 600) / 1800, 0, 1)
shallow = np.array((132, 190, 186)); mid = np.array((70, 140, 160)); deep = np.array((38, 86, 118)); abyss = np.array((30, 66, 98))
sea = shallow * (1 - t1[..., None]) + mid * t1[..., None]
sea = sea * (1 - t2[..., None]) + deep * t2[..., None]
sea = sea * (1 - t3[..., None]) + abyss * t3[..., None]
# leggera variazione sul fondale vicino alla costa (scogli)
sea *= (1 - 0.05 * (1 - t2[..., None]) * ndimage.gaussian_filter(rng.random((TH, TW)), 4)[..., None] * 4)
foam = np.exp(-((dist - 2.5) / 2.2) ** 2) * (landt < 0.5)
sea = sea * (1 - 0.55 * foam[..., None]) + np.array((236, 232, 220)) * 0.55 * foam[..., None]
img = col_land * landt[..., None] + sea * (1 - landt[..., None])
# rete dei sentieri OSM (tenue) e strade principali appena accennate
segs = pickle.load(open('segment.pkl', 'rb'))
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
ov = Image.new('RGBA', (TW, TH), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
for rr in segs:
    g = wkb.loads(rr['geometry'])
    pts = [to_px(x, y, TW, TH) for x, y in g.coords]
    if rr['class'] in ('path', 'footway', 'steps', 'track', 'bridleway'):
        d.line(pts, fill=(246, 240, 224, 95), width=2)
    elif rr['class'] in ('secondary', 'tertiary', 'primary'):
        d.line(pts, fill=(234, 226, 210, 120), width=3)
im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
im.save(f'{OUT}/terrain-color-4k.jpg', quality=80, optimize=True, progressive=True)
im.resize((2048, int(2048 * TH / TW)), Image.LANCZOS).save(f'{OUT}/terrain-color.jpg', quality=85, optimize=True, progressive=True)
im.resize((512, int(512 * TH / TW)), Image.LANCZOS).save(f'{OUT}/terrain-color-low.jpg', quality=80)
print('texture', TW, TH)

# ---------- Rotta in barca: cammino minimo sull'acqua, lontano dalla costa ----------
CW = 1024; CH = int(round(CW * HM / WM)); cpx = WM / CW
landc = raster(land_polys, CW, CH, ss=2) > 0.5
dsea = ndimage.distance_transform_edt(~landc) * cpx
def sea_cost(min_d, pref):
    cost = 1 + 6 * np.clip((pref - dsea) / pref, 0, 1) ** 2  # preferisce ~pref m dalla costa
    cost[dsea < min_d] = np.inf
    return cost
cost = sea_cost(28, 150)
def m2c(x, y): return (int((x + WM / 2) / cpx), int((HM / 2 - y) / cpx))
def c2m(i, j): return ((i + .5) * cpx - WM / 2, HM / 2 - (j + .5) * cpx)
def snap_water(lon, lat, min_d):
    x, y = ll2m(lon, lat); i, j = m2c(x, y)
    jj, ii = np.nonzero(dsea >= min_d)
    k = np.argmin((ii - i) ** 2 + (jj - j) ** 2); return ii[k], jj[k]
def astar(a, b):
    import heapq
    h = lambda p: math.hypot(p[0] - b[0], p[1] - b[1])
    openq = [(h(a), 0, a)]; came = {a: None}; g = {a: 0}
    nb = [(1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)]
    while openq:
        _, gc, p = heapq.heappop(openq)
        if p == b: break
        if gc > g[p]: continue
        for dx, dy, s in nb:
            q = (p[0] + dx, p[1] + dy)
            if not (0 <= q[0] < CW and 0 <= q[1] < CH): continue
            cc = cost[q[1], q[0]]
            if not np.isfinite(cc): continue
            ng = gc + s * cc
            if ng < g.get(q, 1e18): g[q] = ng; came[q] = p; heapq.heappush(openq, (ng + h(q), ng, q))
    path = [b]
    while came[path[-1]] is not None: path.append(came[path[-1]])
    return path[::-1]
def chaikin(pts, n=4):
    for _ in range(n):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        out.append(pts[-1]); pts = out
    return pts
def simplify(pts, tol):
    return list(LineString(pts).simplify(tol).coords)

# coordinate OSM delle tappe (natural=bay, natural=beach) e del porto
STOPS = [
    dict(id='porto', name='Porto di Marina di Camerota', lon=15.37491, lat=40.00031, src='Overture places: Porto Turistico di Marina di Camerota', d=22),
    dict(id='fortuna', name='Cala Fortuna', lon=15.390104, lat=39.9965138, src='OSM natural=bay', d=45),
    dict(id='montedi', name='Cala Monte di Luna', lon=15.3966415, lat=39.9959694, src='OSM natural=bay', d=45),
    dict(id='pozzallo', name='Pozzallo', lon=15.40762, lat=39.99713, src='OSM natural=beach "Spiaggia Pozzallo"', d=45),
    dict(id='infreschi', name='Baia degli Infreschi', lon=15.4270203, lat=39.9989183, src='OSM natural=bay', d=45),
]
anchors = [snap_water(s['lon'], s['lat'], s['d']) for s in STOPS]
seq = [0, 1, 2, 3, 4, 3]
boat = []
stop_idx = []
for a, b in zip(seq, seq[1:]):
    # verso e dal porto: nel bacino serve passare piu vicini alle banchine
    cost = sea_cost(14 if 0 in (a, b) else 28, 60 if 0 in (a, b) else 130)
    cost[dsea < 14] = np.inf
    if a == 4 and b == 3:  # ritorno: un po' piu al largo per non ricalcare l'andata
        cost = sea_cost(40, 260)
    p = simplify([c2m(*q) for q in astar(anchors[a], anchors[b])], 6)
    if not boat: stop_idx.append(0)
    boat += p if not boat else p[1:]
    stop_idx.append(len(boat) - 1)
boat_s = chaikin(boat, 4)
# indici delle tappe sulla linea levigata: punto piu vicino all'ancoraggio
def cum(pts):
    a = np.array(pts); return np.concatenate([[0], np.cumsum(np.hypot(*np.diff(a, axis=0).T))])
cb = cum(boat_s)
craw = cum(boat)
marks = [dict(stop=STOPS[k]['id'], t=round(float(craw[i] / craw[-1]), 4)) for k, i in zip(seq, stop_idx)]
print('boat length m', cb[-1])

# ---------- Trekking: sentiero OSM (Sentiero degli Infreschi) ----------
trek_ll = json.load(open('trek.json'))
trek_m = [ll2m(lon, lat) for lon, lat in trek_ll]
# infittisce per seguire il rilievo
dense = []
for a, b in zip(trek_m, trek_m[1:]):
    n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 4))
    for k in range(n): dense.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
dense.append(trek_m[-1])
dense = chaikin(simplify(dense, 1.2), 2)
lon = np.array([p[0] / MX + (W + E) / 2 for p in dense]); lat = np.array([p[1] / MY + (S + N) / 2 for p in dense])
z = sample_dem(lon, lat)
z = np.maximum(ndimage.gaussian_filter1d(z, 2), 1)
ct = cum(dense)
print('trek length m', ct[-1], 'z', z.min(), z.max(), 'up', np.sum(np.clip(np.diff(z), 0, None)))

def rnd(v, k=1): return round(float(v), k)
data = dict(
    meta=dict(
        bbox=[W, S, E, N], width_m=rnd(WM), height_m=rnd(HM), grid=[GW, GH],
        height_encoding='quota_m = (R*256 + G) / 10 - 100',
        sources=['Altimetria: AWS Terrain Tiles (Mapzen/Tilezen, SRTM e altri DEM pubblici)',
                 'Costa, sentieri, spiagge, cale: OpenStreetMap contributors (ODbL), via Overture Maps 2026-11-18',
                 'Copertura del suolo: ESA WorldCover 2021 10 m (CC BY 4.0)'],
    ),
    boat=dict(points=[[rnd(x), rnd(y)] for x, y in boat_s], length_m=rnd(cb[-1], 0), marks=marks),
    trek=dict(points=[[rnd(x), rnd(y), rnd(zz)] for (x, y), zz in zip(dense, z)], length_m=rnd(ct[-1], 0),
              climb_m=rnd(np.sum(np.clip(np.diff(z), 0, None)), 0), max_m=rnd(z.max(), 0),
              source='OpenStreetMap: sentiero dalla Spiaggia del Pozzallo al Sentiero degli Infreschi, poi verso la localita Monte di Luna'),
    stops=[dict(id=s['id'], name=s['name'], lon=s['lon'], lat=s['lat'], xy=[rnd(v) for v in ll2m(s['lon'], s['lat'])], source=s['src']) for s in STOPS]
          + [dict(id='montediluna', name='Monte di Luna', lon=15.386675, lat=40.0055885,
                  xy=[rnd(v) for v in ll2m(15.386675, 40.0055885)], source='Destinazione del link Google indicato')],
)
json.dump(data, open(f'{OUT}/route.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('ok')
