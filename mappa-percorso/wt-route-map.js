/*
 * <wt-route-map> · Mappa 3D animata del percorso Wild Table
 * Barca: Porto di Marina di Camerota, Cala Fortuna, Cala Monte di Luna, Pozzallo,
 * Baia degli Infreschi, ritorno a Pozzallo. A piedi: Pozzallo, Monte di Luna.
 *
 * Uso:
 *   <script type="module" src="/mappa-percorso/wt-route-map.js"></script>
 *   <wt-route-map></wt-route-map>
 *
 * Tutti i dati sono in ./data (vedi tools/README.md per come rigenerarli).
 * Nessun servizio esterno a runtime: Three.js e i dati sono serviti dal sito.
 */
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { Line2 } from './vendor/Line2.js';
import { LineGeometry } from './vendor/LineGeometry.js';
import { LineMaterial } from './vendor/LineMaterial.js';

const BASE = new URL('./data/', import.meta.url);

/* ---------- Impostazioni facili da modificare ---------- */
const CONFIG = {
  exaggeration: 1.5,          // esagerazione verticale del rilievo
  baseDepth: -150,            // spessore del "plastico" (m, sotto il livello del mare)
  boatColor: '#fbf6ea',       // avorio
  trekColor: '#c4532c',       // terracotta
  boatSeconds: 24,            // durata della navigazione
  trekSeconds: 13,            // durata del trekking
  dwell: 0.9,                 // sosta a ogni tappa (s)
  sun: [-5200, 4600, 1800],   // luce calda da ovest, pomeriggio
};

const STOP_INFO = {
  porto: { role: 'Partenza in barca', side: 'n', narrowSide: 'se', short: 'Marina di Camerota' },
  fortuna: { role: 'Prima cala', side: 's' },
  montedi: { role: 'Cala', side: 's' },
  pozzallo: { role: 'Sbarco e inizio del sentiero', side: 'n' },
  infreschi: { role: 'Baia, sosta', side: 's', narrowSide: 'sw', short: 'Infreschi' },
  montediluna: { role: 'Arrivo a piedi', side: 'n' },
};

const MODES = { tutto: 'Itinerario', barca: 'Barca', trek: 'Trekking' };

const css = `
:host { display:block; position:relative; font-family: var(--f-testo, Figtree, system-ui, sans-serif); color: var(--terra, #1d211b);
  --wt-sabbia: var(--sabbia, #f4efe6); --wt-mare: var(--mare, #1e2d4a); --wt-salvia: var(--salvia, #4a5c3a); --wt-terra: var(--terra, #1d211b); }
.wrap { position:relative; }
.frame { position:relative; width:100%; aspect-ratio: 16 / 9; max-height: 82vh; min-height: 420px; overflow:hidden; border-radius: 2px;
  background: radial-gradient(120% 90% at 50% 40%, #fbf8f2 0%, var(--wt-sabbia) 60%, #ebe4d6 100%); }
@media (max-width: 720px) { .frame { aspect-ratio: 1 / 1.08; min-height: 0; max-height: 80vh; } }
canvas { position:absolute; inset:0; width:100%; height:100%; display:block; opacity:0; transition: opacity 1.2s ease; touch-action: pan-y; outline:none; }
canvas.ready { opacity:1; }
.poster { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition: opacity 1.2s ease; }
.poster.hide { opacity:0; pointer-events:none; }
.status { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:0.85rem; color:#555; letter-spacing:0.01em;
  background: rgba(244,239,230,0.85); padding: 8px 14px; border-radius: 2px; transition: opacity .6s; }
.status.hide { opacity:0; pointer-events:none; }
.labels { position:absolute; inset:0; pointer-events:none; }
.stop { position:absolute; left:0; top:0; will-change: transform; }
.dot { position:absolute; width:9px; height:9px; margin:-4.5px 0 0 -4.5px; border-radius:50%; background:#fbf6ea; border:1.5px solid var(--wt-mare);
  box-shadow: 0 0 0 3px rgba(251,246,234,0.35); opacity:0; transform: scale(.4); transition: opacity .6s, transform .6s; }
.stop.trek .dot { border-color: ${CONFIG.trekColor}; }
.stop.on .dot { opacity:1; transform: scale(1); }
.tag { position:absolute; white-space:nowrap; opacity:0; transform: translateY(4px); transition: opacity .7s ease, transform .7s ease; }
.tag b { display:block; font-family: var(--f-titoli, Newsreader, Georgia, serif); font-weight:400; font-size: 1.02rem; line-height:1.15; color: var(--wt-terra);
  text-shadow: 0 0 6px rgba(251,248,240,.95), 0 0 2px rgba(251,248,240,.95); }
.tag span { display:block; font-size: 0.72rem; color:#3c3c3c; margin-top:1px; text-shadow: 0 0 5px rgba(251,248,240,.95); }
.stop.named .tag { opacity:1; transform:none; }
.stop[data-side="s"] .tag { left:-40px; top:12px; }
.stop[data-side="n"] .tag { left:10px; bottom:10px; }
.stop[data-side="se"] .tag { left:-4px; top:12px; }
.stop[data-side="sw"] .tag { right:-6px; top:12px; text-align:right; }
.stop[data-side="w"] .tag { right:12px; top:-8px; text-align:right; }
.stop[data-side="e"] .tag { left:12px; top:-8px; }
.bar { position:absolute; left:16px; bottom:16px; right:16px; display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; pointer-events:none; }
.bar > * { pointer-events:auto; }
.ctl { display:flex; align-items:center; gap:2px; background: rgba(251,248,242,0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border:1px solid rgba(29,33,27,0.12); border-radius:2px; padding:3px; }
button { font: inherit; font-size: 0.86rem; font-weight:500; color: var(--wt-terra); background: transparent; border:0; border-radius:2px;
  min-height: 38px; padding: 0 12px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
button:hover { background: rgba(74,92,58,0.08); }
button:focus-visible { outline: 2px solid var(--wt-salvia); outline-offset: 1px; }
button[aria-pressed="true"] { background: var(--wt-salvia); color:#fff; }
button.icon { width:38px; padding:0; justify-content:center; }
svg { width:18px; height:18px; fill:none; stroke: currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; }
.legend { margin-left:auto; display:flex; gap:16px; font-size:0.78rem; color:#2a2a2a; background: rgba(251,248,242,0.92); border:1px solid rgba(29,33,27,0.12);
  border-radius:2px; padding: 8px 12px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.legend i { display:inline-block; width:22px; height:3px; border-radius:2px; vertical-align:middle; margin-right:7px; }
.legend .b i { background:${CONFIG.boatColor}; box-shadow: 0 0 0 1px rgba(30,45,74,.55); }
.legend .t i { background:${CONFIG.trekColor}; }
.credit { font-size:0.7rem; color:#666; margin-top:8px; line-height:1.5; }
.credit a { color:inherit; }
.hint { position:absolute; right:16px; top:14px; font-size:0.74rem; color:#555; background: rgba(251,248,242,0.85); padding:5px 9px; border-radius:2px;
  opacity:0; transition: opacity .6s; pointer-events:none; }
.hint.on { opacity:1; }
@media (max-width: 720px) {
  .bar { position:static; padding: 10px 0 0; }
  .ctl { flex: 1 1 auto; justify-content:space-between; }
  .modes { width:100%; }
  .modes button { flex:1; justify-content:center; padding:0 6px; }
  .legend { margin-left:0; width:100%; justify-content:center; }
  .hint { left:12px; right:auto; top:10px; }
  .tag b { font-size: 0.9rem; }
  .tag span { display:none; }
}
@media (prefers-reduced-motion: reduce) { canvas, .poster, .tag, .dot { transition:none; } }
`;

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
};

/* ---------- Utilità ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const easeIO = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
const lerp = (a, b, t) => a + (b - a) * t;

class Polyline {
  constructor(pts) { // pts: array di THREE.Vector3
    this.p = pts; this.c = [0];
    for (let i = 1; i < pts.length; i++) this.c.push(this.c[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.length = this.c[this.c.length - 1];
  }
  index(f) { // indice del segmento e frazione locale
    const d = clamp(f, 0, 1) * this.length; let lo = 0, hi = this.c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.c[m] <= d) lo = m; else hi = m; }
    const seg = this.c[hi] - this.c[lo] || 1;
    return [lo, (d - this.c[lo]) / seg];
  }
  at(f, out = new THREE.Vector3()) { const [i, u] = this.index(f); return out.lerpVectors(this.p[i], this.p[Math.min(i + 1, this.p.length - 1)], u); }
}

/* Posa di camera: bersaglio, distanza, azimut (0 = da sud), inclinazione sull'orizzonte */
const pose = (x, y, z, dist, az, pitch) => ({ x, y, z, dist, az, pitch });
function lerpPoseInto(cur, to, k) { for (const key of ['x', 'y', 'z', 'dist', 'az', 'pitch']) cur[key] += (to[key] - cur[key]) * k; }

class WTRouteMap extends HTMLElement {
  connectedCallback() {
    if (this._init) return; this._init = true;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${css}</style>
      <div class="wrap">
      <div class="frame" part="frame">
        <img class="poster" alt="" src="${new URL('poster.webp', BASE)}" onerror="this.remove()">
        <canvas role="img" aria-label="Mappa tridimensionale della costa tra Marina di Camerota e la Baia degli Infreschi, con la rotta in barca e il sentiero da Pozzallo a Monte di Luna" tabindex="-1"></canvas>
        <div class="labels" aria-hidden="true"></div>
        <div class="status" role="status">Carico il territorio…</div>
        <div class="hint">${matchMedia('(pointer: coarse)').matches ? 'Usa due dita per ruotare e ingrandire' : 'Trascina per ruotare'}</div>
      </div>
        <div class="bar">
          <div class="ctl">
            <button class="icon" data-act="play" aria-label="Pausa">${ICON.pause}</button>
            <button class="icon" data-act="restart" aria-label="Riavvia l'animazione">${ICON.restart}</button>
            <button data-act="full" aria-label="Mostra l'intero itinerario">${ICON.full}<span>Vista d'insieme</span></button>
          </div>
          <div class="ctl modes" role="group" aria-label="Scegli il percorso">
            ${Object.entries(MODES).map(([k, v]) => `<button data-mode="${k}" aria-pressed="${k === 'tutto'}">${v}</button>`).join('')}
          </div>
          <div class="legend"><span class="b"><i></i>Barca <span class="km-b"></span></span><span class="t"><i></i>A piedi <span class="km-t"></span></span></div>
        </div>
      </div>
      <div class="credit">Dati: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>,
        ESA WorldCover 2021 (CC BY 4.0), AWS Terrain Tiles. La rotta della barca è indicativa: segue la costa a distanza di sicurezza.</div>`;
    this.$ = (s) => root.querySelector(s);
    this.canvas = this.$('canvas');
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        this.visible = e.isIntersecting;
        if (e.isIntersecting && !this._loading) { this._loading = true; this.load(); }
        if (e.isIntersecting && e.intersectionRatio > 0.35 && this.ready && !this._started) this.autostart();
        if (this.visible) this.kick();
      }
    }, { rootMargin: '300px 0px', threshold: [0, 0.35, 0.6] });
    io.observe(this);
    this._io = io;
  }

  disconnectedCallback() { this._io?.disconnect(); this._ro?.disconnect(); cancelAnimationFrame(this._raf); this.renderer?.dispose(); }

  /* ---------- Caricamento progressivo ---------- */
  async load() {
    try {
      const [route, heightImg, lowTex] = await Promise.all([
        fetch(new URL('route.json', BASE)).then((r) => r.json()),
        fetch(new URL('terrain-height.png', BASE)).then((r) => r.blob()).then((b) => createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })),
        new THREE.TextureLoader().loadAsync(new URL('terrain-color-low.jpg', BASE).href),
      ]);
      this.route = route;
      this.decodeHeights(heightImg);
      this.setupScene(lowTex);
      this.ready = true;
      this.$('.status').classList.add('hide');
      this.canvas.classList.add('ready');
      setTimeout(() => this.$('.poster')?.classList.add('hide'), 300);
      if (this.visible) this.autostart();
      // dettaglio ad alta risoluzione in un secondo momento
      const big = !matchMedia('(max-width: 720px)').matches && this.renderer.capabilities.maxTextureSize >= 4096;
      new THREE.TextureLoader().loadAsync(new URL(big ? 'terrain-color-4k.jpg' : 'terrain-color.jpg', BASE).href).then((hi) => {
        this.prepTexture(hi); const old = this.terrain.material.map;
        this.terrain.material.map = hi; this.terrain.material.needsUpdate = true; old.dispose(); this.kick();
      });
    } catch (err) {
      console.error('[wt-route-map]', err);
      this.$('.status').textContent = 'La mappa 3D non è disponibile su questo dispositivo.';
    }
  }

  decodeHeights(bmp) {
    const [gw, gh] = this.route.meta.grid;
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, gw, gh).data; const H = new Float32Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) H[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
    this.H = H; this.gw = gw; this.gh = gh;
    this.wm = this.route.meta.width_m; this.hm = this.route.meta.height_m;
  }

  /* quota (m, già esagerata, mare = 0) in coordinate locali x est, y nord */
  heightAt(x, y) {
    const { gw, gh, wm, hm, H } = this;
    const c = clamp((x + wm / 2) / wm * gw - 0.5, 0, gw - 1.001), r = clamp((hm / 2 - y) / hm * gh - 0.5, 0, gh - 1.001);
    const c0 = c | 0, r0 = r | 0, fc = c - c0, fr = r - r0;
    const h = lerp(lerp(H[r0 * gw + c0], H[r0 * gw + c0 + 1], fc), lerp(H[(r0 + 1) * gw + c0], H[(r0 + 1) * gw + c0 + 1], fc), fr);
    return Math.max(h, 0) * CONFIG.exaggeration;
  }

  prepTexture(t) {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  }

  setupScene(tex) {
    const mobile = matchMedia('(max-width: 720px)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;
    this.prepTexture(tex);

    const scene = new THREE.Scene(); this.scene = scene;
    const camera = new THREE.PerspectiveCamera(30, 1, 20, 60000); this.camera = camera;

    // luci: cielo morbido + sole caldo radente
    scene.add(new THREE.HemisphereLight('#fffaf0', '#c9bda2', 1.55));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.1);
    sun.position.set(...CONFIG.sun); sun.castShadow = true;
    const sc = sun.shadow.camera; const half = Math.max(this.wm, this.hm) * 0.62;
    Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, near: 100, far: 20000 });
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 6; sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    this.buildTerrain(tex);
    this.buildRoutes();
    this.buildLabels();

    // controlli per esplorare (attivi in pausa o a fine animazione)
    const controls = new OrbitControls(camera, this.canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.5;
    controls.minDistance = 700; controls.maxDistance = 14000;
    controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.2;
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.enableZoom = false; // la rotella attiva lo zoom solo dopo un clic sulla mappa
    this.canvas.style.touchAction = 'pan-y';
    controls.addEventListener('start', () => { this.userCam = true; if (this.playing) this.setPlaying(false); this.$('.hint').classList.remove('on'); });
    controls.addEventListener('change', () => this.kick());
    this.canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
    this.canvas.addEventListener('pointerleave', () => { controls.enableZoom = false; });
    this.controls = controls;

    // interfaccia
    this.$('[data-act="play"]').onclick = () => { if (!this.playing && this.T >= this.timeline.total) this.restart(); else this.setPlaying(!this.playing); };
    this.$('[data-act="restart"]').onclick = () => this.restart();
    this.$('[data-act="full"]').onclick = () => this.showAll();
    this.shadowRoot.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode)));
    this.$('.km-b').textContent = `· circa ${(this.route.boat.length_m / 1000).toFixed(0)} km`;
    this.$('.km-t').textContent = `· ${(this.route.trek.length_m / 1000).toFixed(1).replace('.', ',')} km, +${Math.round(this.route.trek.climb_m / 10) * 10} m`;
    this.canvas.addEventListener('pointermove', (e) => this.onHover(e));
    this.canvas.addEventListener('pointerleave', () => { this.hover = null; this.kick(); });
    this.canvas.addEventListener('click', (e) => this.onHover(e, true));

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this.$('.frame'));
    this.resize();

    this.mode = 'tutto'; this.timeline = this.buildTimeline('tutto'); this.T = 0; this.playing = false;
    this.cam = { ...this.timeline.poseAt(0) };
    this.clock = new THREE.Clock();
    if (this.reduced) { this.T = this.timeline.total; this.cam = { ...this.timeline.poseAt(this.T) }; }
    this.applyState(true);
    this.loop();
  }

  buildTerrain(tex) {
    const { gw, gh, wm, hm } = this; const ex = CONFIG.exaggeration;
    const sx = wm * (gw - 1) / gw, sy = hm * (gh - 1) / gh;
    const geo = new THREE.PlaneGeometry(sx, sy, gw - 1, gh - 1); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
      const i = r * gw + c; pos.setY(i, Math.max(this.H[i], 0) * ex);
      uv.setXY(i, (c + 0.5) / gw, 1 - (r + 0.5) / gh);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    const terrain = new THREE.Mesh(geo, mat); terrain.castShadow = terrain.receiveShadow = true;
    this.scene.add(terrain); this.terrain = terrain;

    // fianchi del plastico: terra in sezione e acqua in sezione
    const B = CONFIG.baseDepth; const verts = [], cols = [], idx = [];
    const earthTop = new THREE.Color('#a8977a'), earthBot = new THREE.Color('#7d6e57'), seaTop = new THREE.Color('#4f8ea3'), seaBot = new THREE.Color('#23506d');
    const edge = (list) => {
      const start = verts.length / 3;
      list.forEach(([x, z, h]) => {
        const land = h > 0.4; verts.push(x, Math.max(h, 0) * ex, z, x, B, z);
        const t = land ? earthTop : seaTop, b = land ? earthBot : seaBot; cols.push(t.r, t.g, t.b, b.r, b.g, b.b);
      });
      for (let k = 0; k < list.length - 1; k++) { const a = start + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    };
    const P = (r, c) => [-sx / 2 + c * sx / (gw - 1), -sy / 2 + r * sy / (gh - 1), this.H[r * gw + c]];
    const south = [], north = [], west = [], east = [];
    for (let c = 0; c < gw; c++) { south.push(P(gh - 1, c)); north.unshift(P(0, c)); }
    for (let r = 0; r < gh; r++) { west.push(P(r, 0)); east.unshift(P(r, gw - 1)); }
    [south, east, north, west].forEach(edge);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); sg.setIndex(idx); sg.computeVertexNormals();
    const skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    this.scene.add(skirt);

    // ombra morbida sotto il modello
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64); grd.addColorStop(0, 'rgba(40,36,28,0.32)'); grd.addColorStop(1, 'rgba(40,36,28,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(sx * 1.5, sy * 1.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(500, B - 2, 400); this.scene.add(sh);
  }

  buildRoutes() {
    const lift = 9;
    const V = (x, y, h) => new THREE.Vector3(x, h, -y);
    const boatPts = this.route.boat.points.map(([x, y]) => V(x, y, 6));
    const trekPts = this.route.trek.points.map(([x, y]) => V(x, y, this.heightAt(x, y) + lift));
    this.boatPath = new Polyline(boatPts); this.trekPath = new Polyline(trekPts);

    const mkLine = (pts, color, width, opacity = 1, order = 2) => {
      const g = new LineGeometry(); g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
      const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, worldUnits: false, depthTest: true, depthWrite: false });
      const l = new Line2(g, m); l.computeLineDistances(); l.renderOrder = order; l.frustumCulled = false; this.scene.add(l);
      l.userData.n = pts.length - 1; return l;
    };
    this.boatHalo = mkLine(boatPts, '#1e2d4a', 6, 0.2, 2);
    this.boatLine = mkLine(boatPts, CONFIG.boatColor, 2.4, 1, 3);
    this.trekHalo = mkLine(trekPts, '#fbf6ea', 6.5, 0.55, 2);
    this.trekLine = mkLine(trekPts, CONFIG.trekColor, 3, 1, 3);
    this.lines = [this.boatHalo, this.boatLine, this.trekHalo, this.trekLine];

    // piccola imbarcazione: scafo affusolato e tuga, nessuna icona da navigatore
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.17); s.lineTo(0.18, -0.17); s.quadraticCurveTo(0.42, -0.14, 0.55, 0); s.quadraticCurveTo(0.42, 0.14, 0.18, 0.17); s.lineTo(-0.5, 0.17); s.lineTo(-0.5, -0.17);
    const hull = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    hull.rotateX(-Math.PI / 2);
    const boat = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#fdfbf6', roughness: 0.6 });
    const hm = new THREE.Mesh(hull, white); hm.castShadow = true; boat.add(hm);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.2), new THREE.MeshStandardMaterial({ color: '#d9d2c2', roughness: 0.7 }));
    cab.position.set(-0.08, 0.19, 0); boat.add(cab);
    this.scene.add(boat); this.boat = boat;

    // indicatore del trekking: punto terracotta con alone che pulsa
    const walker = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: CONFIG.trekColor, roughness: 0.5 }));
    const ring = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 14), new THREE.MeshBasicMaterial({ color: '#fbf6ea', side: THREE.BackSide }));
    const halo = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.8, 40), new THREE.MeshBasicMaterial({ color: CONFIG.trekColor, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; dot.castShadow = true;
    walker.add(ring, dot, halo); walker.userData.halo = halo; ring.renderOrder = 3; dot.renderOrder = 4;
    this.scene.add(walker); this.walker = walker;
  }

  buildLabels() {
    const wrap = this.$('.labels');
    this.stops = this.route.stops.map((s) => {
      const info = STOP_INFO[s.id] || { role: '', side: 's' };
      const el = document.createElement('div'); el.className = 'stop' + (s.id === 'montediluna' ? ' trek' : ''); el.dataset.side = info.side;
      el.innerHTML = `<div class="dot"></div><div class="tag"><b>${s.name}</b><span>${info.role}</span></div>`;
      el.title = s.name;
      wrap.appendChild(el);
      const [x, y] = s.xy; const h = this.heightAt(x, y);
      return { ...s, el, info, pos: new THREE.Vector3(x, h + 12, -y), sx: -1e4, sy: -1e4 };
    });
    // la tappa Pozzallo coincide con l'inizio del sentiero: uso il punto della linea
    const pz = this.stops.find((s) => s.id === 'pozzallo'); if (pz) pz.pos.copy(this.trekPath.p[0]);
    const md = this.stops.find((s) => s.id === 'montediluna'); if (md) md.pos.copy(this.trekPath.p[this.trekPath.p.length - 1]);
  }

  /* ---------- Sequenza: posa di camera e avanzamento in funzione del tempo ---------- */
  buildTimeline(mode) {
    const marks = this.route.boat.marks; const B = this.boatPath, Tk = this.trekPath;
    const aspect = this.aspect || 16 / 9; const narrow = aspect < 1;
    const fit = (pts, pitch, pad = 1.18) => { // posa che inquadra un insieme di punti
      const box = new THREE.Box3().setFromPoints(pts); const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
      const vf = THREE.MathUtils.degToRad(this.camera.fov); const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
      const dist = Math.max((sz.x * pad) / 2 / Math.tan(hf / 2), (sz.z * pad * Math.sin(pitch) + 300) / 2 / Math.tan(vf / 2));
      return pose(c.x, 40, c.z + 120, dist, 0, pitch);
    };
    const stopPos = (id) => this.stops.find((s) => s.id === id).pos;
    const all = [...B.p, ...Tk.p];
    const overview = fit(all, 0.95, narrow ? 1.05 : 1.3);
    const establishing = { ...overview, dist: overview.dist * 1.25, az: -0.32, pitch: 0.72 };
    const followDist = narrow ? 2600 : 2100;
    const port = stopPos('porto');
    const portPose = pose(port.x + (narrow ? 250 : 600), 20, port.z + 150, followDist * 1.1, -0.18, 0.86);

    // avanzamento della barca con soste: tratte con ease in/out
    const legs = []; const totalLen = B.length; let tt = 0;
    const speed = totalLen / CONFIG.boatSeconds;
    for (let i = 0; i < marks.length - 1; i++) {
      const dur = ((marks[i + 1].t - marks[i].t) * totalLen) / speed;
      legs.push({ a: marks[i].t, b: marks[i + 1].t, t0: tt, t1: tt + dur, stop: marks[i + 1].stop }); tt += dur + (i < marks.length - 2 ? CONFIG.dwell : 0);
    }
    const boatDur = tt;
    const boatAt = (t) => {
      if (t <= 0) return 0;
      for (const L of legs) { if (t < L.t0) return L.a; if (t <= L.t1) return lerp(L.a, L.b, easeIO((t - L.t0) / (L.t1 - L.t0))); }
      return 1;
    };
    const trekAt = (t) => clamp(t / CONFIG.trekSeconds, 0, 1) < 1 ? smooth(clamp(t / CONFIG.trekSeconds, 0, 1)) * 0.15 + clamp(t / CONFIG.trekSeconds, 0, 1) * 0.85 : 1;

    const pz = stopPos('pozzallo');
    const pozzPose = pose(pz.x - 150, 60, pz.z - 300, followDist * 0.9, 0.42, 0.9);
    const finalAll = fit(all, narrow ? 1.12 : 1.0, narrow ? 1.12 : 1.28);
    if (narrow) finalAll.z = (finalAll.z + 0) / 2;
    const finalBoat = fit(B.p, 0.98, narrow ? 1.05 : 1.25);
    const finalTrek = { ...fit(Tk.p, 1.0, 1.6), az: 0.2 };
    const tmp = new THREE.Vector3(), ahead = new THREE.Vector3();
    const trekCenter = new THREE.Box3().setFromPoints(Tk.p).getCenter(new THREE.Vector3());
    const followBoat = (f, az) => { B.at(f, tmp); B.at(Math.min(1, f + 0.035), ahead); tmp.lerp(ahead, 0.5); return pose(tmp.x, 0, tmp.z + 60, followDist, az, 0.84); };
    const followTrek = (f) => { Tk.at(f, tmp); Tk.at(Math.min(1, f + 0.08), ahead); tmp.lerp(ahead, 0.5); tmp.lerp(trekCenter, 0.55); return pose(tmp.x, tmp.y * 0.5, tmp.z + 120, followDist * (narrow ? 1.25 : 1.5), lerp(0.42, 0.18, f), 0.95); };

    // fasi
    const ph = [];
    let t = 0; const add = (name, dur, fn) => { ph.push({ name, t0: t, t1: t + dur, fn }); t += dur; };
    if (mode === 'tutto' || mode === 'barca') {
      add('intro', mode === 'tutto' ? 3.2 : 1.6, (u) => ({ cam: lerpPose(establishing, overview, smooth(u)), boat: 0, trek: mode === 'tutto' ? null : null, show: [] }));
      add('porto', 2.4, (u) => ({ cam: portPose, boat: 0, show: u > 0.3 ? ['porto'] : [] }));
      add('barca', boatDur, (u, lt) => { const f = boatAt(lt); return { cam: followBoat(f, lerp(-0.18, 0.12, f)), boat: f, reached: legs.filter((L) => lt >= L.t1).map((L) => ({ id: L.stop, at: L.t1 })) }; });
    }
    if (mode === 'tutto') {
      add('pozzallo', 2.6, () => ({ cam: pozzPose, boat: 1, trek: 0, show: ['pozzallo'] }));
    }
    if (mode === 'trek') {
      add('intro', 2.2, (u) => ({ cam: lerpPose(overview, pozzPose, smooth(u)), boat: null, trek: 0, show: u > 0.5 ? ['pozzallo'] : [] }));
    }
    if (mode === 'tutto' || mode === 'trek') {
      add('trek', CONFIG.trekSeconds, (u) => { const f = trekAt(u * CONFIG.trekSeconds); return { cam: followTrek(f), boat: mode === 'tutto' ? 1 : null, trek: f, show: f > 0.97 ? ['montediluna'] : [] }; });
    }
    const fin = mode === 'tutto' ? finalAll : mode === 'barca' ? finalBoat : finalTrek;
    add('fine', 3.8, () => ({ cam: fin, boat: mode === 'trek' ? null : 1, trek: mode === 'barca' ? null : 1, final: true }));
    const total = t;

    const at = (T) => {
      T = clamp(T, 0, total);
      const p = ph.find((x) => T < x.t1) || ph[ph.length - 1];
      const lt = T - p.t0; const st = p.fn(clamp(lt / (p.t1 - p.t0), 0, 1), lt);
      st.phase = p.name; st.T = T;
      if (p.name === 'barca' && st.reached) st.recent = st.reached.filter((r) => lt - r.at < 3.4).map((r) => r.id);
      if (p.name === 'barca' && st.reached) st.dots = st.reached.map((r) => r.id).concat('porto');
      return st;
    };
    return { total, at, poseAt: (T) => at(T).cam, final: fin, mode, phases: ph };
  }

  /* ---------- Stato e interazione ---------- */
  setPlaying(on) {
    this.playing = on;
    const b = this.$('[data-act="play"]'); b.innerHTML = on ? ICON.pause : ICON.play; b.setAttribute('aria-label', on ? 'Pausa' : 'Riproduci');
    this.$('.hint').classList.toggle('on', !on && !this.hintShown && (this.hintShown = true));
    if (!on) setTimeout(() => this.$('.hint').classList.remove('on'), 3200);
    if (on) this.releaseCam();
    this.kick();
  }
  /* salta a un istante della sequenza (utile per anteprime e test) */
  seek(T, mode) {
    if (mode && mode !== this.mode) this.setMode(mode);
    this.T = clamp(T, 0, this.timeline.total); this.releaseCam(); this.setPlaying(false); this.applyState(true); this.renderer.render(this.scene, this.camera);
  }
  /* dopo un'esplorazione libera, riparte dalla vista attuale senza scatti */
  releaseCam() {
    if (!this.userCam) return; this.userCam = false;
    const t = this.controls.target, off = this.camera.position.clone().sub(t); const d = off.length();
    Object.assign(this.cam, { x: t.x, y: t.y, z: t.z, dist: d, az: Math.atan2(off.x, off.z), pitch: Math.asin(clamp(off.y / d, -1, 1)) });
  }
  autostart() { this._started = true; if (this.reduced) return; this.setPlaying(true); }
  restart() { this.T = 0; this.releaseCam(); this.setPlaying(true); }
  setMode(m) {
    this.mode = m; this.timeline = this.buildTimeline(m);
    this.shadowRoot.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    this.T = 0; this.releaseCam(); this.setPlaying(!this.reduced);
    if (this.reduced) { this.T = this.timeline.total; }
  }
  showAll() {
    this.mode = 'tutto'; this.timeline = this.buildTimeline('tutto');
    this.shadowRoot.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === 'tutto')));
    this.T = this.timeline.total; this.releaseCam(); this.setPlaying(false);
  }
  onHover(e, tap) {
    const r = this.canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = tap ? 34 : 24;
    for (const s of this.stops) { const d = Math.hypot(s.sx - x, s.sy - y); if (d < bd && s.el.classList.contains('on')) { bd = d; best = s.id; } }
    if (best !== this.hover) { this.hover = best; this.kick(); }
  }

  resize() {
    const f = this.$('.frame'); const w = f.clientWidth, h = f.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const prev = this.aspect; this.aspect = w / h; this.W = w; this.Hh = h;
    for (const l of this.lines) l.material.resolution.set(w, h);
    const narrow = w < 560;
    for (const s of this.stops || []) {
      s.el.dataset.side = (narrow && s.info.narrowSide) || s.info.side;
      s.el.querySelector('b').textContent = (narrow && s.info.short) || s.name;
    }
    if (this.timeline && prev && Math.abs(prev - this.aspect) > 0.05) this.timeline = this.buildTimeline(this.mode);
    this.kick();
  }

  kick() { this._dirty = 2; }

  applyState(snap) {
    const st = this.timeline.at(this.T); this.state = st;
    // linee: disegno progressivo
    const draw = (line, path, f) => {
      line.visible = f != null && f > 0; if (!line.visible) return;
      const [i, u] = path.index(f); line.geometry.instanceCount = f >= 1 ? line.userData.n : Math.max(1, i + (u > 0.5 ? 1 : 0));
    };
    draw(this.boatLine, this.boatPath, st.boat); draw(this.boatHalo, this.boatPath, st.boat);
    draw(this.trekLine, this.trekPath, st.trek); draw(this.trekHalo, this.trekPath, st.trek);
    // barca
    this.boat.visible = st.boat != null && (st.phase !== 'fine' || this.mode === 'barca') && st.phase !== 'trek' ;
    if (this.boat.visible) {
      const f = st.boat; const p = this.boatPath.at(f), q = this.boatPath.at(Math.min(1, f + 0.002)), q0 = this.boatPath.at(Math.max(0, f - 0.002));
      this.boat.position.copy(p).setY(2 + Math.sin(performance.now() / 600) * 0.6);
      const dx = q.x - q0.x, dz = q.z - q0.z; if (dx || dz) this.boat.rotation.y = Math.atan2(-dz, dx);
    }
    // camminatore
    this.walker.visible = st.trek != null && st.trek > 0 && st.trek < 1 || (st.phase === 'pozzallo');
    if (this.walker.visible) this.walker.position.copy(this.trekPath.at(st.trek || 0));
    // camera
    if (!this.userCam) {
      const target = st.cam;
      if (snap) Object.assign(this.cam, target);
      else lerpPoseInto(this.cam, target, this._k || 0.05);
      const c = this.cam; const cp = Math.cos(c.pitch);
      this.camera.position.set(c.x + c.dist * Math.sin(c.az) * cp, c.y + c.dist * Math.sin(c.pitch), c.z + c.dist * Math.cos(c.az) * cp);
      this.controls.target.set(c.x, c.y, c.z); this.camera.lookAt(this.controls.target);
    }
    // dimensione costante a schermo per barca e indicatore
    const dB = this.camera.position.distanceTo(this.boat.position), dW = this.camera.position.distanceTo(this.walker.position);
    const k = 1 / (this.Hh || 600) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * 2;
    this.boat.scale.setScalar(clamp(dB * k * 26, 40, 260));
    const ws = clamp(dW * k * 5, 6, 60); this.walker.scale.setScalar(ws);
    const pulse = (performance.now() / 1400) % 1; const h = this.walker.userData.halo; h.scale.setScalar(1 + pulse * 1.6); h.material.opacity = 0.55 * (1 - pulse);
    this.updateLabels(st);
  }

  updateLabels(st) {
    const narrow = (this.W || 800) < 560; const v = new THREE.Vector3();
    const visibleIds = new Set(), named = new Set();
    const boatOn = st.boat != null, trekOn = st.trek != null;
    if (st.final) {
      if (boatOn) ['porto', 'fortuna', 'montedi', 'pozzallo', 'infreschi'].forEach((i) => visibleIds.add(i));
      if (trekOn) ['pozzallo', 'montediluna'].forEach((i) => visibleIds.add(i));
      const nm = narrow ? ['porto', 'pozzallo', 'infreschi', 'montediluna'] : [...visibleIds];
      nm.filter((i) => visibleIds.has(i)).forEach((i) => named.add(i));
      if (!boatOn) named.add('pozzallo');
    } else {
      (st.show || []).forEach((i) => { visibleIds.add(i); named.add(i); });
      (st.dots || []).forEach((i) => visibleIds.add(i));
      (st.recent || []).forEach((i) => named.add(i));
      if (st.phase === 'trek' || st.phase === 'pozzallo') { if (this.mode === 'tutto') ['porto', 'fortuna', 'montedi', 'infreschi'].forEach((i) => visibleIds.add(i)); visibleIds.add('pozzallo'); named.add(st.trek < 0.25 ? 'pozzallo' : ''); }
    }
    if (this.hover) { visibleIds.add(this.hover); named.add(this.hover); }
    for (const s of this.stops) {
      v.copy(s.pos).project(this.camera);
      s.sx = (v.x * 0.5 + 0.5) * this.W; s.sy = (-v.y * 0.5 + 0.5) * this.Hh;
      const behind = v.z > 1;
      s.el.style.transform = `translate(${s.sx.toFixed(1)}px, ${s.sy.toFixed(1)}px)`;
      s.el.classList.toggle('on', visibleIds.has(s.id) && !behind);
      s.el.classList.toggle('named', named.has(s.id) && !behind);
    }
  }

  loop() {
    this._raf = requestAnimationFrame(() => this.loop());
    if (!this.visible) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.playing) {
      this.T += dt;
      if (this.T >= this.timeline.total) { this.T = this.timeline.total; this.setPlaying(false); }
    }
    this._k = 1 - Math.exp(-dt / 0.9);
    const settling = !this.userCam && this.state && camDelta(this.cam, this.state.cam) > 0.5;
    const animating = this.playing || settling || this.walker.visible || this.boat.visible && this.playing;
    if (this.userCam) this.controls.update();
    if (!animating && !this._dirty) return;
    if (this._dirty) this._dirty--;
    this.applyState(false);
    this.renderer.render(this.scene, this.camera);
  }
}

function lerpPose(a, b, t) { const o = {}; for (const k of ['x', 'y', 'z', 'dist', 'az', 'pitch']) o[k] = lerp(a[k], b[k], t); return o; }
function camDelta(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(a.dist - b.dist) + 300 * (Math.abs(a.az - b.az) + Math.abs(a.pitch - b.pitch)); }

if (!customElements.get('wt-route-map')) customElements.define('wt-route-map', WTRouteMap);
export { WTRouteMap };
