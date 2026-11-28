"""1/3 · Scarica i dati grezzi nella cartella corrente (nessuna chiave, nessun servizio a pagamento).

- DEM: AWS Terrain Tiles (formato terrarium, zoom 13, circa 15 m per pixel)
- Copertura del suolo: ESA WorldCover 2021, 10 m (file COG, letto solo nella finestra utile)
- OpenStreetMap via Overture Maps (release fissata qui sotto): costa e terra, acque e cale, sentieri e strade

Requisiti: pip install numpy pillow pyarrow shapely rasterio
"""
import math, os, pickle, urllib.request
import numpy as np
import pyarrow.dataset as ds, pyarrow.fs as pafs, pyarrow.compute as pc
import shapely.wkb as wkb
from shapely.geometry import box

OVERTURE = 'overturemaps-us-west-2/release/2026-11-18.0'
W, E, S, N = 15.355, 15.440, 39.982, 40.026      # finestra un po' piu ampia della mappa

# DEM
Z = 13
def tile(lon, lat):
    n = 2 ** Z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
x0, y0 = tile(W, N); x1, y1 = tile(E, S)
os.makedirs('dem', exist_ok=True)
for x in range(int(x0), int(x1) + 1):
    for y in range(int(y0), int(y1) + 1):
        p = f'dem/{Z}_{x}_{y}.png'
        if not os.path.exists(p):
            urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png', p)

# ESA WorldCover
import rasterio
from rasterio.windows import from_bounds
src = rasterio.open('/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N39E015_Map.tif')
np.save('wc.npy', src.read(1, window=from_bounds(W, S, E, N, src.transform)))

# OpenStreetMap (Overture Maps)
fs = pafs.S3FileSystem(anonymous=True, region='us-west-2')
X0, X1, Y0, Y1 = 15.30, 15.48, 39.95, 40.06
def overlap(a0, a1, b0, b1):
    return (pc.field('bbox', 'xmin') < a1) & (pc.field('bbox', 'xmax') > a0) & (pc.field('bbox', 'ymin') < b1) & (pc.field('bbox', 'ymax') > b0)
B = box(15.355, 39.980, 15.445, 40.030)
base = {}
for typ in ('land', 'water'):
    d = ds.dataset(f'{OVERTURE}/theme=base/type={typ}/', filesystem=fs, format='parquet')
    rows = []
    for r in d.to_table(filter=overlap(15.355, 15.445, 39.980, 40.030), columns=['names', 'class', 'subtype', 'geometry', 'bbox']).to_pylist():
        g = wkb.loads(r['geometry']).intersection(B)
        if not g.is_empty:
            rows.append(dict(cls=r['class'], sub=r['subtype'], name=(r['names'] or {}).get('primary'), geom=g, bb=r['bbox']))
    base[typ] = rows
pickle.dump(base, open('base2.pkl', 'wb'))
d = ds.dataset(f'{OVERTURE}/theme=transportation/type=segment/', filesystem=fs, format='parquet')
f = (pc.field('bbox', 'xmin') > X0) & (pc.field('bbox', 'xmax') < X1) & (pc.field('bbox', 'ymin') > Y0) & (pc.field('bbox', 'ymax') < Y1)
pickle.dump(d.to_table(filter=f, columns=['id', 'names', 'class', 'subtype', 'geometry']).to_pylist(), open('segment.pkl', 'wb'))
print('dati scaricati')
