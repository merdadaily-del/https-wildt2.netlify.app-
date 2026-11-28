"""2/3 · Ricostruisce i due tratti a piedi sulla rete pedonale OpenStreetMap.

Riferimenti indicati da Wild (link Google, modalita a piedi):
  1. Spiaggia Pozzallo (39.9968841, 15.4075809) -> Cala Bianca Spiaggia (39.9972419, 15.4134263)
  2. Cala Bianca Spiaggia -> Monte di Luna (40.0055885, 15.386675)
Ogni punto viene agganciato al nodo piu vicino della rete OSM e il tracciato e il cammino minimo
sui sentieri. Uscita: walks.json con {"walk1": [[lon, lat], ...], "walk2": [...]}.
"""
import json, math, pickle
from collections import Counter
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
def near(lat, lon, label):
    n = min(nodes, key=lambda n: dist(n, (lon, lat)))
    print(f'{label}: agganciato alla rete a {dist(n, (lon, lat)):.0f} m dal punto Google')
    return n
POZZALLO = near(39.9968841, 15.4075809, 'Spiaggia Pozzallo')
CALA_BIANCA = near(39.9972419, 15.4134263, 'Cala Bianca')
MONTE_DI_LUNA = near(40.0055885, 15.386675, 'Monte di Luna')
L = lambda p: sum(dist(a, b) for a, b in zip(p, p[1:]))
out = {}
for key, a, b in (('walk1', POZZALLO, CALA_BIANCA), ('walk2', CALA_BIANCA, MONTE_DI_LUNA)):
    p = nx.shortest_path(G, a, b, weight='weight')
    c = Counter()
    for u, v in zip(p, p[1:]):
        c[(G[u][v]['cls'], G[u][v]['name'])] += dist(u, v)
    print(f'{key}: {L(p):.0f} m', [(k, round(v)) for k, v in c.most_common()])
    out[key] = p
json.dump(out, open('walks.json', 'w'))
