// MEDIRUN Glow — prototype shell. Simulates a run along route.json and feeds the shared engine
// (engine/glow-engine.js) exactly the way the app's map WebView does: setTrail / setRunner / setActivity.
// The screen chrome mirrors mobile/src/components/run/PulseActive.tsx; the only new element is the lit pill.
import { createGlow, glowStyle } from './engine/glow-engine.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

const ROUTE = await fetch('route.json').then((r) => r.json());
const TOKEN = (await fetch('https://medicard.ge/api/app/status?version=1.0.0.17.34').then((r) => r.json())).mapboxToken;
mapboxgl.accessToken = TOKEN;

// The route in metres (equirectangular is plenty for a 2 km demo), resampled every 2 m.
const [lng0, lat0] = ROUTE.coords[0], KX = 111320 * Math.cos((lat0 * Math.PI) / 180), KY = 110540;
const toXY = ([lng, lat]) => [(lng - lng0) * KX, (lat - lat0) * KY];
const toLL = (x, y) => [lng0 + x / KX, lat0 + y / KY];
const PATH = [];
{
  const raw = ROUTE.coords.map(toXY);
  let acc = 0;
  PATH.push({ x: raw[0][0], y: raw[0][1], s: 0 });
  for (let i = 1; i < raw.length; i++) {
    const [ax, ay] = raw[i - 1], [bx, by] = raw[i], len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len / 2));
    for (let k = 1; k <= steps; k++) { acc += len / steps; PATH.push({ x: ax + ((bx - ax) * k) / steps, y: ay + ((by - ay) * k) / steps, s: acc }); }
  }
  // A person cuts corners: round the routing service's crosswalk jogs (prototype only — the app draws real GPS).
  for (let pass = 0; pass < 4; pass++) {
    const src = PATH.map((p) => [p.x, p.y]);
    for (let i = 3; i < PATH.length - 3; i++) { let sx = 0, sy = 0; for (let k = -3; k <= 3; k++) { sx += src[i + k][0]; sy += src[i + k][1]; } PATH[i].x = sx / 7; PATH[i].y = sy / 7; }
  }
  for (let i = 1; i < PATH.length; i++) PATH[i].s = PATH[i - 1].s + Math.hypot(PATH[i].x - PATH[i - 1].x, PATH[i].y - PATH[i - 1].y);
}
const L = PATH[PATH.length - 1].s;
function sample(s) {
  s = clamp(s, 0, L);
  let lo = 0, hi = PATH.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PATH[m].s <= s) lo = m; else hi = m; }
  const a = PATH[lo], b = PATH[hi], t = (s - a.s) / Math.max(1e-6, b.s - a.s);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, i: lo };
}
const bounds = ROUTE.coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(ROUTE.coords[0], ROUTE.coords[0]));

const narrow = innerWidth < 700;
const CAMS = { close: { zoom: narrow ? 18.3 : 17.9, pitch: 60, skew: -22 }, far: { zoom: narrow ? 17.1 : 16.9, pitch: 55, skew: -30 } };
const map = new mapboxgl.Map({
  container: 'map', style: glowStyle(), center: ROUTE.coords[0], zoom: narrow ? 17 : 16.5, pitch: 58, bearing: -30,
  projection: 'mercator', antialias: true, maxPitch: 75, fadeDuration: 0,
});
await new Promise((r) => map.once('load', r));
map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ROUTE.coords } } });
map.addLayer({ id: 'route-ahead', type: 'line', source: 'route', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#5EEAD4', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.5, 18, 4], 'line-opacity': 0.35, 'line-dasharray': [1, 2.4] } });

const state = {
  head: 0, running: false, finished: false, mul: Number(params.get('speed')) || 8, cam: params.get('cam') || 'close',
  manual: false, hero: params.get('hero') === 'f' ? 'f' : 'm', lit: 0,
};
const glow = createGlow({
  mapboxgl, map, token: TOKEN, assetBase: 'assets/', hero: state.hero,
  onLit: (n) => { state.lit = n; $('lit').textContent = n; $('litPill').classList.remove('pop'); void $('litPill').offsetWidth; $('litPill').classList.add('pop'); },
});
window.glow = { state, map, L, engine: glow };   // debug handle for previews
$('loading').classList.add('done');

// ---------- chrome ----------
const REAL_PACE = 3.0;
const ICON = {
  play: '<svg class="i" viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  pause: '<svg class="i" viewBox="0 0 24 24"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>',
  again: '<svg class="i" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
};
const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} მ` : `${(m / 1000).toFixed(1)} კმ`);
const fmtClock = (sec) => { const t = Math.max(0, Math.floor(sec)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0'); };
const fmtPace = (secPerKm) => `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}`;
function syncChrome() {
  const active = state.head > 0 && !state.finished;
  $('play').className = 'action' + (state.running ? ' secondary' : '');
  $('play').innerHTML = state.running ? ICON.pause + '<span>პაუზა</span>'
    : state.finished ? ICON.again + '<span>ხელახლა გავიაროთ</span>'
    : state.head > 0 ? ICON.play + '<span>გავაგრძელოთ გზა</span>' : ICON.play + '<span>დავიწყოთ აღმოჩენა</span>';
  $('flag').hidden = !active;
  $('status').textContent = state.running ? 'შენი გზა ფერადდება' : state.finished ? 'შენი ქალაქი ანთია' : state.head > 0 ? 'პაუზა · შენი გზა შენახულია' : 'დღეს სად მიგიყვანს გზა?';
  $('dot').className = 'dot' + (state.running ? ' on' : state.head > 0 && !state.finished ? ' paused' : '');
  $('locate').classList.toggle('active', !state.manual);
  document.querySelectorAll('#segSpeed button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === state.mul));
  document.querySelectorAll('#segCam button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.cam));
  document.querySelectorAll('#segTilt button').forEach((b) => b.classList.toggle('on', (b.dataset.v === 'off') === document.body.classList.contains('flat')));
  document.querySelectorAll('#segHero button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.hero));
  glow.setActivity(state.finished ? 'dance' : state.running ? 'auto' : 'idle');
}
function openSheet(id) { $('sheetBack').classList.add('open'); $(id).classList.add('open'); }
function closeSheets() { $('sheetBack').classList.remove('open'); document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('open')); }
function restart() { state.head = 0; state.finished = false; state.running = true; state.manual = false; if (state.cam === 'orbit') state.cam = 'close'; glow.setTrail([]); syncChrome(); }
$('play').onclick = () => {
  if (state.finished) { restart(); return; }
  state.running = !state.running;
  if (state.running) { state.manual = false; if (state.cam === 'orbit') state.cam = 'close'; }
  syncChrome();
};
$('flag').onclick = () => {
  state.running = false; syncChrome();
  $('finishStats').innerHTML = [['მანძილი', fmtDist(state.head), 24], ['დრო', fmtClock(state.head / REAL_PACE), 18], ['ტემპი', fmtPace(1000 / REAL_PACE), 18]]
    .map(([l, v, s], i) => `<div style="flex:1;text-align:${['left', 'center', 'right'][i]}"><div class="lbl">${l}</div><div style="font-weight:700;font-size:${s}px;font-variant-numeric:tabular-nums">${v}</div></div>`).join('');
  openSheet('finish');
};
$('finishSave').onclick = () => { closeSheets(); state.finished = true; state.running = false; state.cam = 'orbit'; state.manual = false; syncChrome(); };
$('menuBtn').onclick = () => { syncChrome(); openSheet('menu'); };
$('sheetBack').onclick = closeSheets;
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheets));
$('locate').onclick = () => { state.manual = false; if (state.cam === 'orbit' && !state.finished) state.cam = 'close'; syncChrome(); };
$('restart').onclick = () => { closeSheets(); restart(); };
document.querySelectorAll('#segSpeed button').forEach((b) => (b.onclick = () => { state.mul = Number(b.dataset.v); syncChrome(); }));
document.querySelectorAll('#segCam button').forEach((b) => (b.onclick = () => { state.cam = b.dataset.v; state.manual = false; syncChrome(); }));
document.querySelectorAll('#segTilt button').forEach((b) => (b.onclick = () => { document.body.classList.toggle('flat', b.dataset.v === 'off'); syncChrome(); }));
document.querySelectorAll('#segHero button').forEach((b) => (b.onclick = () => { state.hero = b.dataset.v; glow.setHero(state.hero); syncChrome(); }));
['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'].forEach((ev) => map.on(ev, (e) => { if (e.originalEvent) { state.manual = true; syncChrome(); } }));

let overviewZoom = 15.5;
{ const cam = map.cameraForBounds(bounds, { padding: narrow ? 30 : 90, pitch: 55 }); if (cam && cam.zoom) overviewZoom = cam.zoom + (narrow ? 0.45 : 0); }
function framePadding() {
  const top = document.querySelector('.top').getBoundingClientRect().bottom + 8, dock = $('dock').getBoundingClientRect().top;
  $('side').style.bottom = innerHeight - dock + 12 + 'px';
  const free = Math.max(80, dock - top);
  return { top: top + free * 0.22, bottom: innerHeight - dock + 10, left: 0, right: 0 };
}

// ---------- the simulated run: a GPS-like fix twice a second ----------
let last = performance.now(), frames = 0, fpsAt = last, fixAt = 0;
function emit(nowMs) {
  const at = sample(state.head), ahead = sample(state.head + 4);
  const heading = (Math.atan2(ahead.x - at.x, ahead.y - at.y) * 180) / Math.PI;
  const [lng, lat] = toLL(at.x, at.y);
  // like the app: every GPS fix moves the runner and extends the trail to that same point
  if (nowMs - fixAt < 400 && fixAt) return;
  fixAt = nowMs;
  glow.setRunner(lng, lat, heading);
  if (state.head > 0) {
    const coords = [];
    for (let i = 0; i <= at.i; i += 3) coords.push(toLL(PATH[i].x, PATH[i].y));
    coords.push([lng, lat]);
    glow.setTrail(coords);
  }
}
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.running) {
    state.head = Math.min(L, state.head + REAL_PACE * state.mul * dt);
    if (state.head >= L) { state.running = false; state.finished = true; state.cam = 'orbit'; state.manual = false; syncChrome(); }
  }
  emit(now);

  const r = glow.runner();
  if (!state.manual && r) {
    let goal, zoom, pitch, bearing;
    if (state.cam !== 'orbit') {
      const cam = CAMS[state.cam] || CAMS.close;
      goal = [r.lng, r.lat]; zoom = cam.zoom; pitch = cam.pitch; bearing = (r.heading ?? map.getBearing()) + cam.skew;
    } else {
      const c = bounds.getCenter();
      goal = [c.lng, c.lat]; zoom = overviewZoom; pitch = 55; bearing = map.getBearing() + dt * 4;
    }
    const k = 1 - Math.exp(-dt * 2.4), kb = 1 - Math.exp(-dt * 1.3), cur = map.getCenter();
    map.jumpTo({
      center: [cur.lng + (goal[0] - cur.lng) * k, cur.lat + (goal[1] - cur.lat) * k],
      zoom: map.getZoom() + (zoom - map.getZoom()) * k,
      pitch: map.getPitch() + (pitch - map.getPitch()) * k,
      bearing: lerpAngle(map.getBearing(), bearing, state.cam !== 'orbit' ? kb : 1),
      padding: framePadding(),
    });
  }

  $('dist').textContent = fmtDist(state.head);
  $('time').textContent = fmtClock(state.head / REAL_PACE);
  $('pace').textContent = state.head > 0 ? fmtPace(1000 / REAL_PACE) : '–';
  $('goalBar').style.width = (100 * state.head) / L + '%';
  $('goalLeft').textContent = L - state.head > 1 ? 'დარჩა ' + fmtDist(L - state.head) : 'მიზანი შესრულდა ✓';
  frames++;
  if (now - fpsAt > 1000) { $('fps').textContent = Math.round((frames * 1000) / (now - fpsAt)) + ' fps'; frames = 0; fpsAt = now; }
  requestAnimationFrame(tick);
}
syncChrome();
requestAnimationFrame(tick);
if (params.has('auto')) $('play').click();
