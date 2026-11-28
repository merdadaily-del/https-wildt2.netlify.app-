# Mappa 3D del percorso · Wild Table Cilento

Componente autonomo che mostra in 3D la costa tra Marina di Camerota e la Baia degli Infreschi,
con l'andata in barca e il ritorno a piedi animati. Anteprima: `/mappa-percorso/`.

## Come inserirlo in una pagina

```html
<script type="module" src="/mappa-percorso/wt-route-map.js"></script>
<wt-route-map></wt-route-map>
```

Il componente prende colori e caratteri dalle variabili del sito (`--salvia`, `--sabbia`, `--mare`,
`--terra`, `--f-titoli`, `--f-testo`). Non tocca il resto della pagina: stili e struttura sono
chiusi nel suo shadow DOM. Si carica solo quando arriva vicino allo schermo e parte da solo quando
è visibile per un terzo.

## Cosa fa

- Plastico 3D del territorio (rilievo esagerato 1,5 volte), con fianchi in sezione.
- Sequenza: panoramica, porto, navigazione con tappe fino agli Infreschi, sbarco a Pozzallo, a piedi fino a Cala Bianca (sosta) e poi a Monte di Luna, vista d'insieme.
- Comandi: Play/Pausa, Riavvia, Vista d'insieme, scelta Itinerario / Barca / Trekking.
- Etichette discrete che compaiono al passaggio, e al passaggio del mouse o al tocco sui punti.
- In pausa o a fine animazione si può ruotare (trascinando; su telefono con due dita). La rotella ingrandisce solo dopo un clic sulla mappa, così non blocca lo scorrimento della pagina.
- Caricamento progressivo: immagine di anteprima, poi terreno con texture leggera (25 KB), poi texture dettagliata (2K su telefono, 4K su desktop).
- Con "riduci movimento" attivo nel sistema, mostra subito l'itinerario completo senza animazione.

## Dati e precisione

| Elemento | Fonte | Note |
|---|---|---|
| Rilievo | AWS Terrain Tiles (terrarium, zoom 13, circa 15 m per pixel; dati SRTM e altri DEM pubblici) | Qualche pixel anomalo viene corretto con un filtro mediano |
| Linea di costa | OpenStreetMap, poligoni `land` via Overture Maps (release 2026-11-18) | Nitida a livello di singola caletta |
| Boschi, macchia, prati, abitato | ESA WorldCover 2021, 10 m | Colori smorzati, trama puntinata solo nel bosco |
| Spiagge, roccia, sentieri | OpenStreetMap | Solo i sentieri, appena accennati; nessuna strada |
| Tappe | OpenStreetMap: `natural=bay` per Cala Fortuna, Cala Monte di Luna e Baia degli Infreschi; `natural=beach` per la Spiaggia Pozzallo e Cala Bianca; il porto da Overture Places | Coordinate in `data/route.json` |
| Sentiero a piedi | Rete pedonale OpenStreetMap, cammino minimo | Vedi sotto |
| Rotta della barca | Calcolata sull'acqua | Vedi sotto |

**Itinerario.** In barca: porto, Cala Fortuna, Cala Monte di Luna, si passa davanti a Pozzallo senza
fermarsi, giro alla Baia degli Infreschi, sbarco a Pozzallo. A piedi: Pozzallo, Cala Bianca (sosta per
il bagno), Monte di Luna.

**Tratti a piedi.** Ricostruiti sulla rete pedonale OpenStreetMap a partire dai due link Google indicati
da Wild (Spiaggia Pozzallo → Cala Bianca, Cala Bianca → Monte di Luna). Ogni punto è agganciato al
sentiero OSM più vicino (Pozzallo a 61 m, Cala Bianca a 6 m, Monte di Luna a 55 m: la spiaggia e la
località non sono sulla rete) e il tracciato è il cammino minimo sui sentieri.
Pozzallo → Cala Bianca 1,0 km sul "sentiero Degli Infreschi"; Cala Bianca → Monte di Luna 3,7 km.
Per circa 900 m il ritorno ripercorre in senso inverso lo stesso sentiero dell'andata a Cala Bianca:
sulla mappa le due linee si sovrappongono. Totale 4,7 km, circa 270 m di salita (quote dal DEM).

**Barca.** Non esiste una "traccia ufficiale" per una gita in barca: la rotta è calcolata come cammino
più breve sull'acqua che resta ad almeno 28 m dalla costa (preferendo circa 130 m), entra nelle cale
delle tappe e al ritorno dagli Infreschi passa un po' più al largo. Lunghezza circa 9 km. In mappa
c'è una nota che la dichiara indicativa.

## Rigenerare i dati

Servono Python 3 e `pip install numpy pillow scipy shapely pyarrow rasterio networkx`.

```sh
mkdir lavoro && cd lavoro
python3 ../mappa-percorso/tools/fetch_data.py     # scarica DEM, WorldCover, OSM (Overture)
python3 ../mappa-percorso/tools/trek_route.py     # ricostruisce i due tratti a piedi
python3 ../mappa-percorso/tools/build_data.py     # scrive ../mappa-percorso/data/
```

Per spostare il riquadro, cambiare le tappe o i colori della texture: `build_data.py` (in alto).
Per tempi, colori delle linee, luce ed esagerazione del rilievo: `CONFIG` in cima a `wt-route-map.js`.

## File

- `wt-route-map.js` · il componente (Three.js, nessuna dipendenza esterna a runtime)
- `vendor/` · Three.js r170 (licenza MIT), OrbitControls e linee spesse dagli esempi ufficiali
- `data/` · altimetria (`terrain-height.png`, quota = (R·256 + G)/10 − 100 m), texture, `route.json`, anteprima
- `tools/` · script per rigenerare i dati

Attribuzioni richieste (già mostrate sotto la mappa): © OpenStreetMap contributors (ODbL),
ESA WorldCover 2021 (CC BY 4.0), AWS Terrain Tiles.
