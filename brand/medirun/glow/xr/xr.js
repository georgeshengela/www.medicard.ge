// MEDIRUN XR — the Glow city on a Meta Quest (prototype, not part of the app).
// The shared engine (../engine/glow-engine.js) normally lives inside Mapbox GL as a custom layer. Here it runs
// without Mapbox: small stand-ins give it a centre and Mercator math, its own scene is rendered by a WebXR
// renderer, and the ground (streets, water, parks) is built from the same tiles (ground.js).
// The person sees the city as a model around their feet (VR) or on a table in their room (MR) and steers
// the runner with the left stick; the city follows the runner, every street it passes lights up.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { createGlow } from '/engine/glow-engine.js';
import { createGround } from './ground.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ?emulate=1 — Meta's Immersive Web Emulation Runtime: a virtual Quest 3 in a desktop browser (tests only)
if (params.has('emulate')) {
  const { XRDevice, metaQuest3 } = await import('https://esm.sh/iwer@2');
  const device = new XRDevice(metaQuest3);
  device.installRuntime({ forceInstall: true });
  window.xrDevice = device;
}

// ---------- one frame clock for the engine ----------
// The engine schedules its tick with window.requestAnimationFrame, which an immersive session may never fire.
// Only that tick is caught (it is the first callback createGlow registers): it runs from the window in 2D and
// from the XR frame while presenting. Every other requestAnimationFrame (three.js, the emulator) stays native.
const nativeRAF = window.requestAnimationFrame.bind(window), nativeCancel = window.cancelAnimationFrame.bind(window);
let engineTick = null, capturing = false, tickPending = false, pumpScheduled = false, presenting = false;
function pumpTick(t) { if (!tickPending) return; tickPending = false; engineTick(t); }
function kick() {
  if (pumpScheduled || presenting || !tickPending) return;
  pumpScheduled = true;
  nativeRAF((t) => { pumpScheduled = false; if (!presenting) pumpTick(t); });
}
window.requestAnimationFrame = (cb) => {
  if (capturing && !engineTick) engineTick = cb;
  if (cb !== engineTick) return nativeRAF(cb);
  tickPending = true; kick(); return -1;
};
window.cancelAnimationFrame = (id) => { if (id === -1) tickPending = false; else nativeCancel(id); };

// ---------- the engine's street tiles are kept for the ground ----------
const nativeFetch = window.fetch.bind(window);
const tileBuffers = new Map();
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const m = /mapbox-streets-v8\/16\/(\d+)\/(\d+)\.vector\.pbf/.exec(url);
  const p = nativeFetch(input, init);
  if (!m) return p;
  return p.then((res) => { if (res.ok) res.clone().arrayBuffer().then((b) => tileBuffers.set(m[1] + '/' + m[2], b)).catch(() => {}); return res; });
};

// ---------- Mapbox stand-ins: Mercator math and a "map" that only knows its centre ----------
const CIRC = 2 * Math.PI * 6371008.8, NT = 2 ** 16;
class MercatorCoordinate {
  constructor(x, y, z = 0) { this.x = x; this.y = y; this.z = z; }
  static fromLngLat(ll, alt = 0) {
    const lng = Array.isArray(ll) ? ll[0] : ll.lng, lat = Array.isArray(ll) ? ll[1] : ll.lat;
    return new MercatorCoordinate((180 + lng) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360, alt);
  }
  toLngLat() { const y2 = 180 - this.y * 360; return { lng: this.x * 360 - 180, lat: (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90 }; }
  meterInMercatorCoordinateUnits() { return 1 / CIRC / Math.cos((this.toLngLat().lat * Math.PI) / 180); }
}
// Freedom Square, Tbilisi (the Glow prototype's route starts here); ?at=lng,lat moves the start
const START = (params.get('at') || '44.801768,41.693334').split(',').map(Number);
const ORIGIN = MercatorCoordinate.fromLngLat(START), S = ORIGIN.meterInMercatorCoordinateUnits();
const toLocal = (lng, lat) => { const m = MercatorCoordinate.fromLngLat([lng, lat]); return [(m.x - ORIGIN.x) / S, -(m.y - ORIGIN.y) / S]; };
const toLngLat = (x, y) => new MercatorCoordinate(ORIGIN.x + x * S, ORIGIN.y - y * S).toLngLat();
const tileToLocal = (fx, fy) => [(fx / NT - ORIGIN.x) / S, -(fy / NT - ORIGIN.y) / S];

const view = { center: { lng: START[0], lat: START[1] }, pxPerM: 2, far: 800 };
const map = {
  getCenter: () => ({ lng: view.center.lng, lat: view.center.lat }),
  getCanvas: () => ({ clientWidth: 1000, clientHeight: 1000 }),
  addLayer() {}, removeLayer() {}, triggerRepaint() {},
  project(ll) { const [x, y] = toLocal(ll.lng, ll.lat); return { x: x * view.pxPerM, y: -y * view.pxPerM }; },
  // the engine streams tiles out to the point it gets back here
  unproject() { const c = toLocal(view.center.lng, view.center.lat); return toLngLat(c[0], c[1] + view.far); },
};

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(Number(params.get('fb')) || 1);
renderer.xr.setFoveation(1);
document.body.prepend(renderer.domElement);

const status = (text) => { $('status').textContent = text; };
status('Mapbox-ის გასაღები…');
const TOKEN = (await nativeFetch('https://medicard.ge/api/app/status?version=1.0.0.17.34').then((r) => r.json())).mapboxToken;

const st = {
  mode: 'desk', s: 1 / 30, h: 0, yaw: 0, ax: 0, ay: 0,
  x: 0, y: 0, dirX: 0, dirY: 1, speed: 0, dist: 0, lit: 0, hero: params.get('hero') === 'f' ? 'f' : 'm', dancing: false,
  trail: [], trailSent: 0, trailAt: 0, last: null,
};
const MODES = {
  desk: { s: 1 / 30, h: 0, fog: 320 },
  vr: { s: 1 / 30, h: 0, fog: 280 },
  ar: { s: 1 / 450, h: 0.75, fog: 260 },
};
const FOCUS = new THREE.Vector3(0, 0, -0.8);   // where the runner is kept, in the person's space (metres)
const DEAD = 0.35;                              // how far the runner may roam from it before the city follows

capturing = true;
const glow = createGlow({
  mapboxgl: { MercatorCoordinate }, map, token: TOKEN, assetBase: '/assets/', detailBase: '/detail/', hero: st.hero,
  bloom: false, adaptive: false,
  onLit: (n) => { if (n > st.lit) buzz(0.25, 25); st.lit = n; panelDirty = true; },
});
capturing = false;
const { scene, camera: engineCamera, U, runner: R, tiles, insideBuilding } = glow.debug;
window.xr = { st, glow, renderer, tileBuffers };   // debug handle
U.uPR.value = 1;
const ground = createGround({ U, scene, tileToLocal });

// ---------- the person's space → city metres ----------
// rig.matrix maps the XR space (Y up, metres, floor at 0) onto the city (Z up, metres): anchor + yaw + scale.
const rig = new THREE.Group(); rig.matrixAutoUpdate = false; scene.add(rig);
const rigInv = new THREE.Matrix4();
const RX = new THREE.Matrix4().makeRotationX(Math.PI / 2), TMP = new THREE.Matrix4(), V = new THREE.Vector3();
function rotationPart() { return new THREE.Matrix4().makeRotationZ(st.yaw).multiply(RX).multiply(TMP.makeScale(1 / st.s, 1 / st.s, 1 / st.s)); }
function updateRig() {
  rig.matrix.makeTranslation(st.ax, st.ay, -st.h / st.s).multiply(rotationPart());
  rig.matrixWorldNeedsUpdate = true;
  rigInv.copy(rig.matrix).invert();
  placeSky();
}
const toCity = (v) => v.clone().applyMatrix4(rig.matrix);
const toRoom = (v) => v.clone().applyMatrix4(rigInv);
/** Change scale / yaw / height while the runner stays where the person sees it. */
function reframe(change) {
  const p = toRoom(V.set(st.x, st.y, 0));
  change();
  p.y = st.h;
  const q = p.applyMatrix4(rotationPart());
  st.ax = st.x - q.x; st.ay = st.y - q.y;
  updateRig();
}
function recentre() {
  reframe(() => {});
  const q = FOCUS.clone().setY(st.h).applyMatrix4(rotationPart());
  st.ax = st.x - q.x; st.ay = st.y - q.y;
  updateRig();
}
function applyMode(mode) {
  st.mode = mode;
  const m = MODES[mode];
  st.s = Number(params.get('scale')) ? 1 / Number(params.get('scale')) : m.s;
  st.h = m.h;
  view.fog = Number(params.get('fog')) || m.fog;
  view.far = view.fog * 2.6;
  sky.visible = mode !== 'ar';
  renderer.setClearColor(mode === 'ar' ? 0x000000 : fogOut, mode === 'ar' ? 0 : 1);
  recentre();
}

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.02, 400);
rig.add(camera);

// ---------- night sky: stars and a moon in the person's space (far away, they never move with the city) ----------
// The engine's shaders write raw colours, so the clear colour is the fog's raw value too (the haze meets the sky).
const fogOut = new THREE.Color().setRGB(U.uFog.value.r, U.uFog.value.g, U.uFog.value.b, THREE.SRGBColorSpace);
const sky = new THREE.Group(); rig.add(sky);
{
  const n = 1400, pos = new Float32Array(n * 3), rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 * Math.PI, y = 0.04 + rnd() * 0.96, r = Math.sqrt(1 - y * y) * 180;
    pos.set([Math.cos(u) * r, y * 180, Math.sin(u) * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sky.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb2d6, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false, fog: false })));
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 6, 64, 64, 64);
  gr.addColorStop(0, 'rgba(236,242,255,1)'); gr.addColorStop(0.18, 'rgba(220,230,255,0.95)'); gr.addColorStop(0.22, 'rgba(170,190,240,0.25)'); gr.addColorStop(1, 'rgba(120,140,200,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
  moon.scale.setScalar(26); moon.name = 'moon'; sky.add(moon);
}
const MOON_DIR = new THREE.Vector3(-0.45, 0.55, 0.72).normalize();   // the engine's moon, in city axes
function placeSky() {
  // the moon sits where the engine's moonlight comes from: city direction → room direction (yaw only)
  const d = MOON_DIR.clone().applyMatrix4(new THREE.Matrix4().makeRotationZ(-st.yaw)).applyMatrix4(TMP.makeRotationX(-Math.PI / 2));
  const moon = sky.getObjectByName('moon');
  if (moon) moon.position.copy(d.multiplyScalar(170));
  sky.position.set(0, 0, 0);
}

// ---------- wrist panels (controllers) and the 2D HUD ----------
let panelDirty = true;
function makePanel(w, h) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.15, (0.15 * h) / w), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = 30;
  return { canvas, ctx: canvas.getContext('2d'), tex, mesh };
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function wordmark(ctx, x, y, size) {
  ctx.font = `800 ${size}px "Exo 2", sans-serif`; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF'; ctx.fillText('MEDI', x, y);
  const w = ctx.measureText('MEDI').width;
  ctx.save(); ctx.translate(x + w + size * 0.04, y); ctx.transform(1, 0, -Math.tan((16 * Math.PI) / 180), 1, 0, 0);
  ctx.fillStyle = '#14B8A6'; ctx.fillText('RUN', 0, 0); ctx.restore();
}
const stats = makePanel(512, 256), legend = makePanel(512, 300);
function drawPanels() {
  panelDirty = false;
  { const { ctx, canvas, tex } = stats;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(17,24,39,0.92)'; roundRect(ctx, 0, 0, 512, 256, 40);
    wordmark(ctx, 34, 76, 54);
    ctx.font = '700 64px "Noto Sans Georgian", sans-serif'; ctx.fillStyle = '#FCD34D'; ctx.fillText(String(st.lit), 34, 168);
    const w = ctx.measureText(String(st.lit)).width;
    ctx.font = '400 34px "Noto Sans Georgian", sans-serif'; ctx.fillStyle = '#D1D5DB'; ctx.fillText('ანთია', 34 + w + 16, 166);
    ctx.font = '700 40px "Noto Sans Georgian", sans-serif'; ctx.fillStyle = '#99F6E4'; ctx.fillText(`${(st.dist / 1000).toFixed(2)} კმ`, 34, 226);
    tex.needsUpdate = true; }
  { const { ctx, canvas, tex } = legend;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(17,24,39,0.92)'; roundRect(ctx, 0, 0, 512, 300, 40);
    ctx.font = '400 28px "Noto Sans Georgian", sans-serif'; ctx.fillStyle = '#D1D5DB';
    const rows = [['მარცხ. სტიკი', 'სირბილი'], ['ჩახმახი', 'აჩქარება'], ['მარჯვ. ← →', 'მობრუნება'], ['მარჯვ. ↑ ↓', 'ზუმი'], ['A · B', 'ცეკვა · გმირი'], ['X · Y', 'თავიდან · ცენტრი']];
    rows.forEach(([k, v], i) => { ctx.fillStyle = '#99F6E4'; ctx.fillText(k, 30, 58 + i * 42); ctx.fillStyle = '#FFFFFF'; ctx.fillText(v, 270, 58 + i * 42); });
    tex.needsUpdate = true; }
  $('lit').textContent = st.lit;
  $('km').textContent = (st.dist / 1000).toFixed(2);
}

// ---------- controllers ----------
const factory = new XRControllerModelFactory();
const grips = [0, 1].map((i) => {
  const grip = renderer.xr.getControllerGrip(i);
  grip.add(factory.createControllerModel(grip));
  rig.add(grip);
  grip.addEventListener('connected', (e) => {
    grip.userData.hand = e.data.handedness;
    const panel = e.data.handedness === 'left' ? stats.mesh : legend.mesh;
    panel.position.set(0, 0.075, 0.03); panel.rotation.set(-0.7, 0, 0);
    grip.add(panel);
  });
  return grip;
});
let hapticAt = 0;
function buzz(intensity, ms) {
  const session = renderer.xr.getSession();
  if (!session || performance.now() - hapticAt < 90) return;
  hapticAt = performance.now();
  for (const src of session.inputSources) if (src.handedness === 'right') src.gamepad?.hapticActuators?.[0]?.pulse?.(intensity, ms);
}

// ---------- input: Quest controllers or the keyboard ----------
const keys = new Set();
const input = { mx: 0, my: 0, boost: false, turn: 0, zoom: 0 };
const prevButtons = new Map();
const pressed = (id, now) => { const was = prevButtons.get(id); prevButtons.set(id, now); return now && !was; };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyF') toggleDance();
  if (e.code === 'KeyH') switchHero();
  if (e.code === 'KeyR') restart();
  if (e.code === 'KeyT') toggleHeight();
  if (e.code === 'KeyC') recentre();
  if (e.code === 'KeyQ') reframe(() => { st.yaw += Math.PI / 6; });
  if (e.code === 'KeyE') reframe(() => { st.yaw -= Math.PI / 6; });
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
  reframe(() => { st.yaw -= dx * 0.006; });
  desk.pitch = clamp(desk.pitch + dy * 0.004, 0.25, 1.35);
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; });
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(-e.deltaY * 0.0015); }, { passive: false });

function zoomBy(k) { reframe(() => { st.s = clamp(st.s * Math.exp(k), 1 / 1500, 1 / 4); }); }
function toggleDance() { st.dancing = !st.dancing; glow.setActivity(st.dancing ? 'dance' : 'auto'); }
function switchHero() { st.hero = st.hero === 'm' ? 'f' : 'm'; glow.setHero(st.hero); }
function toggleHeight() { reframe(() => { st.h = st.h > 0.1 ? 0 : 0.75; }); }
function restart() { st.trail = []; st.trailSent = 0; st.dist = 0; st.last = null; glow.setTrail([]); panelDirty = true; }

function readInput() {
  input.mx = 0; input.my = 0; input.boost = false; input.turn = 0; input.zoom = 0;
  const session = renderer.xr.getSession();
  if (session) {
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0] || 0, gp.axes[1] || 0];
      const b = (i) => Boolean(gp.buttons[i]?.pressed), h = src.handedness;
      if (gp.buttons[0]?.value > 0.5) input.boost = true;
      if (h === 'left') {
        input.mx = ax[0]; input.my = -ax[1];
        if (pressed('lx', b(4))) restart();
        if (pressed('ly', b(5))) recentre();
      } else if (h === 'right') {
        if (pressed('rturn+', ax[0] > 0.7)) input.turn = -1;
        if (pressed('rturn-', ax[0] < -0.7)) input.turn = 1;
        if (Math.abs(ax[1]) > 0.2) input.zoom = -ax[1];
        if (pressed('ra', b(4))) toggleDance();
        if (pressed('rb', b(5))) switchHero();
        if (pressed('rstick', b(3))) toggleHeight();
      }
    }
  } else {
    input.mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    input.my = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    input.boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (keys.has('Equal') || keys.has('NumpadAdd')) input.zoom = 1;
    if (keys.has('Minus') || keys.has('NumpadSubtract')) input.zoom = -1;
  }
}

// ---------- the runner: stick → city metres, never through a wall ----------
const blocked = (x, y) => Boolean(insideBuilding(x, y));
function freeSpot(x, y) {
  for (let r = 2; r <= 60; r += 2) for (let a = 0; a < 16; a++) {
    const px = x + Math.cos((a / 16) * Math.PI * 2) * r, py = y + Math.sin((a / 16) * Math.PI * 2) * r;
    if (!blocked(px, py)) return [px, py];
  }
  return [x, y];
}
let checkAt = 0;
function moveRunner(dt, nowMs) {
  // camera-relative: forward is where the person looks, flattened onto the ground
  const f = camera.getWorldDirection(new THREE.Vector3());
  let fx = f.x, fy = f.y, fl = Math.hypot(fx, fy);
  if (fl < 0.15) { fx = -Math.sin(st.yaw); fy = Math.cos(st.yaw); fl = 1; }
  fx /= fl; fy /= fl;
  let mx = input.mx, my = input.my;
  const mag = clamp(Math.hypot(mx, my), 0, 1);
  let want = 0;
  if (mag > 0.15) {
    const dx = fy * mx + fx * my, dy = -fx * mx + fy * my, dl = Math.hypot(dx, dy) || 1;
    st.dirX = dx / dl; st.dirY = dy / dl;
    want = (mag < 0.6 ? 1.6 + (mag - 0.15) * 4 : 3.4 + (mag - 0.6) * 7) * (input.boost ? 2.4 : 1);
    if (st.dancing) toggleDance();
  }
  st.speed += (want - st.speed) * Math.min(1, dt * 6);
  if (st.speed < 0.05) st.speed = 0;
  const step = st.speed * dt;
  if (step > 0) {
    let nx = st.x + st.dirX * step, ny = st.y + st.dirY * step;
    const ahead = (x, y) => blocked(x, y) || blocked(x + st.dirX * 0.8, y + st.dirY * 0.8);
    if (ahead(nx, ny)) {
      if (!ahead(nx, st.y)) ny = st.y; else if (!ahead(st.x, ny)) nx = st.x; else { nx = st.x; ny = st.y; st.speed *= 0.5; }
    }
    st.dist += Math.hypot(nx - st.x, ny - st.y);
    st.x = nx; st.y = ny;
  }
  // a building that loaded under the runner: step out onto the street
  if (nowMs - checkAt > 400) { checkAt = nowMs; if (blocked(st.x, st.y)) [st.x, st.y] = freeSpot(st.x, st.y); }

  // feed the engine's runner directly (it would otherwise glide between GPS fixes)
  const t = performance.now() / 1000, heading = Math.atan2(st.dirX, -st.dirY);
  R.raw = [st.x, st.y]; R.target = [st.x, st.y]; R.from = [st.x, st.y];
  if (R.pos) { R.pos[0] = st.x; R.pos[1] = st.y; } else R.pos = [st.x, st.y];
  R.t0 = t; R.dur = 0.25; R.lastFix = t; R.speedIn = st.speed; R.heading = heading; R.moveHeading = heading;
  view.center = toLngLat(st.x, st.y);

  // the trail: a point every 2 m, handed to the engine a few times a second
  if (!st.last || Math.hypot(st.x - st.last[0], st.y - st.last[1]) > 2) {
    st.last = [st.x, st.y];
    const ll = toLngLat(st.x, st.y); st.trail.push([ll.lng, ll.lat]);
  }
  if (st.trail.length !== st.trailSent && nowMs - st.trailAt > 200) { st.trailAt = nowMs; st.trailSent = st.trail.length; glow.setTrail(st.trail.slice()); panelDirty = true; }
}

// ---------- the city follows the runner (only past the dead zone, gently) ----------
function follow(dt) {
  const f = toCity(FOCUS.clone().setY(st.h));
  const dx = st.x - f.x, dy = st.y - f.y, d = Math.hypot(dx, dy) * st.s;
  if (d > DEAD) { const k = (1 - DEAD / d) * Math.min(1, dt * 4); st.ax += dx * k; st.ay += dy * k; updateRig(); }
}

// ---------- desktop camera (no headset) ----------
const desk = { pitch: 0.75, dist: 1.35 };
const LOOK = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
function placeDeskCamera() {
  const target = FOCUS.clone().setY(st.h);
  const eye = new THREE.Vector3(0, st.h + Math.sin(desk.pitch) * desk.dist, target.z + Math.cos(desk.pitch) * desk.dist);
  camera.position.copy(eye);
  camera.quaternion.setFromRotationMatrix(LOOK.lookAt(eye, target, UP));
  camera.updateMatrixWorld(true);
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---------- sessions ----------
renderer.xr.addEventListener('sessionstart', () => { presenting = true; document.body.classList.add('in-xr'); });
renderer.xr.addEventListener('sessionend', () => { presenting = false; document.body.classList.remove('in-xr'); applyMode('desk'); kick(); });
async function enter(mode) {
  try {
    const session = await navigator.xr.requestSession(mode === 'ar' ? 'immersive-ar' : 'immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    applyMode(mode);
    await renderer.xr.setSession(session);
  } catch (err) { status(`XR ვერ ჩაირთო: ${err.message || err}`); }
}
$('enterVr').addEventListener('click', () => enter('vr'));
$('enterAr').addEventListener('click', () => enter('ar'));
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { $('enterVr').disabled = !ok; }).catch(() => {});
  navigator.xr.isSessionSupported('immersive-ar').then((ok) => { $('enterAr').disabled = !ok; }).catch(() => {});
}
if (!window.isSecureContext) status('XR-ს HTTPS სჭირდება — Quest-ზე გახსენი https:// მისამართი');

// ---------- frame ----------
applyMode('desk');
Promise.all([document.fonts.load('800 54px "Exo 2"', 'MEDIRUN'), document.fonts.load('700 40px "Noto Sans Georgian"', 'ანთია კმ')])
  .catch(() => {}).then(() => { panelDirty = true; });
let lastMs = performance.now(), syncAt = 0, statusAt = 0, ready = false;
renderer.setAnimationLoop((time) => {
  if (presenting) pumpTick(time);                       // the engine's own tick (streaming, lights, animation)
  const dt = Math.min(0.1, Math.max(0, (time - lastMs) / 1000)); lastMs = time;
  readInput();
  if (input.turn) reframe(() => { st.yaw += (input.turn * Math.PI) / 6; });
  if (input.zoom) zoomBy(input.zoom * dt * 1.4);
  moveRunner(dt, time);
  follow(dt);
  if (!presenting) placeDeskCamera();

  // engine uniforms that Mapbox used to drive: fog reference depth and pixels per metre
  U.uRefW.value = (view.fog * st.s) / 1.7;
  let focal;
  const xrCam = presenting ? renderer.xr.getCamera() : null;
  if (xrCam && xrCam.cameras.length) { const c0 = xrCam.cameras[0]; focal = c0.projectionMatrix.elements[5] * (c0.viewport.w || 1800) / 2; }
  else focal = (renderer.domElement.height / 2) / Math.tan(((camera.fov / 2) * Math.PI) / 180);
  view.pxPerM = (focal * st.s) / U.uRefW.value;
  // no see-through cut (its shader math assumes the Mapbox camera); a readable hero at every scale
  engineCamera.position.set(st.x, st.y, 5000);
  U.uCut.value = 0;
  const heroScale = clamp(0.035 / (1.75 * st.s), 1.5, 8);
  R.scale = heroScale; R.root.scale.setScalar(heroScale);

  if (time - syncAt > 300) { syncAt = time; ground.sync(tiles, tileBuffers); }
  if (!ready && ground.count() >= 4) { ready = true; document.body.classList.add('ready'); status(''); }
  if (!ready && time - statusAt > 500) { statusAt = time; status(`ქალაქი იტვირთება… ${ground.count()}`); }
  if (panelDirty) drawPanels();
  renderer.render(scene, camera);
});
