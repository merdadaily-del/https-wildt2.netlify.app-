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
- Sequenza: panoramica, porto, navigazione con tappe, arrivo a Pozzallo, sentiero fino a Monte di Luna, vista d'insieme.
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
| Spiagge, roccia, sentieri | OpenStreetMap | I sentieri della zona sono disegnati tenui sulla texture |
| Tappe | OpenStreetMap: `natural=bay` per Cala Fortuna, Cala Monte di Luna e Baia degli Infreschi; `natural=beach` per la Spiaggia Pozzallo; il porto da Overture Places | Coordinate in `data/route.json` |
| Sentiero a piedi | Rete pedonale OpenStreetMap, cammino minimo | Vedi sotto |
| Rotta della barca | Calcolata sull'acqua | Vedi sotto |

**Sentiero.** Il link Google indicato parte da Cala Bianca, non da Pozzallo. La Spiaggia del Pozzallo
è circa 500 m più a ovest, sullo stesso tracciato. Lo script ricalcola sulla rete OSM sia il
collegamento del link (Cala Bianca, Monte di Luna: 3,7 km) sia quello da Pozzallo: da Pozzallo
un sentierino di 134 m sale e si innesta sul Sentiero degli Infreschi, e da lì in poi il tracciato
coincide punto per punto con quello del link fino a Monte di Luna. Totale 2,9 km, circa 180 m di
salita. Il tracciato segue soprattutto il "sentiero Degli Infreschi" di OSM, poi carrarecce e un
tratto di strada di quartiere a Monte di Luna. Le quote vengono dal DEM.

**Barca.** Non esiste una "traccia ufficiale" per una gita in barca: la rotta è calcolata come cammino
più breve sull'acqua che resta ad almeno 28 m dalla costa (preferendo circa 130 m), entra nelle cale
delle tappe e al ritorno dagli Infreschi passa un po' più al largo. Lunghezza circa 9 km. In mappa
c'è una nota che la dichiara indicativa.

## Rigenerare i dati

Servono Python 3 e `pip install numpy pillow scipy shapely pyarrow rasterio networkx`.

```sh
mkdir lavoro && cd lavoro
python3 ../mappa-percorso/tools/fetch_data.py     # scarica DEM, WorldCover, OSM (Overture)
python3 ../mappa-percorso/tools/trek_route.py     # ricostruisce il sentiero
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
