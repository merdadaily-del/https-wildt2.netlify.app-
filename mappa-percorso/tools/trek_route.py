"""2/3 · Ricostruisce il sentiero a piedi sulla rete pedonale OpenStreetMap.

Il link Google indicato va da "Cala Bianca Spiaggia" (39.99724, 15.41343) a "Monte di Luna"
(40.0055885, 15.386675). Qui si calcola lo stesso collegamento sulla rete OSM e lo si fa partire
dalla Spiaggia del Pozzallo, che sta sullo stesso tracciato circa 500 m a ovest di Cala Bianca.
Uscita: trek.json (lista di [lon, lat]).
"""
import json, math, pickle
import networkx as nx
import shapely.wkb as wkb

segs = pickle.load(open('segment.pkl', 'rb'))
def dist(a, b):
    return math.hypot((a[0] - b[0]) * math.cos(math.radians(40)) * 111320, (a[1] - b[1]) * 110540)
G = nx.Graph()
for r in segs:
    if r['class'] in ('motorway', 'trunk'):
        continue
    cs = [tuple(round(v, 7) for v in c) for c in wkb.loads(r['geometry']).coords]
    for a, b in zip(cs, cs[1:]):
        G.add_edge(a, b, weight=dist(a, b), cls=r['class'], name=(r['names'] or {}).get('primary'))
nodes = list(G.nodes)
near = lambda lat, lon: min(nodes, key=lambda n: dist(n, (lon, lat)))
CALA_BIANCA = near(39.9972419, 15.4134263)    # partenza del link Google
MONTE_DI_LUNA = near(40.0055885, 15.386675)   # arrivo del link Google
POZZALLO = near(39.99713, 15.40762)           # OSM natural=beach "Spiaggia Pozzallo"

ref = nx.shortest_path(G, CALA_BIANCA, MONTE_DI_LUNA, weight='weight')
trek = nx.shortest_path(G, POZZALLO, MONTE_DI_LUNA, weight='weight')
L = lambda p: sum(dist(a, b) for a, b in zip(p, p[1:]))
join = next(i for i, n in enumerate(trek) if n in set(ref))
print(f'Cala Bianca -> Monte di Luna: {L(ref):.0f} m')
print(f'Pozzallo -> Monte di Luna: {L(trek):.0f} m; si innesta sul tracciato di riferimento dopo {L(trek[:join + 1]):.0f} m')
print('Coincide con il tracciato di riferimento da li in poi:', trek[join:] == ref[ref.index(trek[join]):])
json.dump(trek, open('trek.json', 'w'))
