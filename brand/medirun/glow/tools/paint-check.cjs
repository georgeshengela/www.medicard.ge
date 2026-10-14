// Regression check for MedirunGlow.setPaint: the lit history fed progressively (one GPS fix at a time, as the app does)
// must light exactly what one call with the final lines lights, and a call must stay cheap as the history grows.
//   node brand/medirun/glow/tools/paint-check.cjs [d3d11|swiftshader]
// Loads the BUILT engine (server/public/medirun/glow/engine.js, run build.mjs first) the way the app's WebView does, over a
// local static server on the repo root; tiles come from Mapbox with the token from medicard.ge/api/app/status.
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../../../..');
// Playwright lives in the main checkout's server/node_modules (a worktree has none) — same as shoot.cjs.
const PW = [path.join(ROOT, 'server/node_modules/playwright'), 'C:/Users/User/Desktop/www.medicard/server/node_modules/playwright'].find((p) => fs.existsSync(p));
const { chromium } = require(PW);
const GL = process.argv[2] || 'd3d11', PORT = 4477;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.css': 'text/css' };
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
<style>html,body,#map{margin:0;height:100%;background:#030712}</style></head><body><div id="map"></div><script>
(async () => {
  const q = new URLSearchParams(location.search);
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/server/public/medirun/glow/engine.js?t=' + Date.now(); s.onload = res; s.onerror = () => rej(new Error('engine load failed')); document.head.appendChild(s); });
  const G = window.MedirunGlow;
  const TOKEN = (await fetch('https://medicard.ge/api/app/status?version=1.0.0.25.3').then((r) => r.json())).mapboxToken;
  if (!TOKEN) throw new Error('no mapbox token');
  mapboxgl.accessToken = TOKEN;
  const map = new mapboxgl.Map({ container: 'map', style: G.glowStyle(), center: JSON.parse(q.get('center')), zoom: 16.5, pitch: 58, bearing: -30, projection: 'mercator', antialias: true, maxPitch: 75, fadeDuration: 0 });
  await new Promise((r) => map.once('load', r));
  const engine = G.createGlow({ mapboxgl, map, token: TOKEN, assetBase: '/server/public/medirun/glow/', hero: 'm' });
  const gl = (() => { try { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl2'; } catch (e) { return 'none'; } })();
  window.T = { map, engine, ready: true, gl };
})().catch((e) => { window.T = { error: String((e && e.stack) || e) }; });
</script></body></html>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/paint-test.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end(b);
  });
});

// The paint, shaped like the app's: 3 earlier walks, ~275 two-point coverage lines, the current walk growing 4 points per fix.
// The current walk sits before the coverage lines (as `[...trail, ...coverage]` does) and appears at its second point.
const LOOP = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/medirun/glow/decor/rustaveli-loop.json'), 'utf8')).coords;
const hist = [LOOP.slice(0, 400), LOOP.slice(400, 800), LOOP.slice(800, 1100)];
const cov = []; for (let i = 0; i + 2 < 1100; i += 4) cov.push([LOOP[i], LOOP[i + 2]]);
const cur = LOOP.slice(1100);
const linesAt = (n) => (n <= 1 ? [...hist, ...cov] : [...hist, cur.slice(0, n), ...cov]);
const STEPS = []; for (let n = 2; n < cur.length; n += 4) STEPS.push(n); STEPS.push(cur.length);
const CENTER = LOOP[1300];
const sortedIds = (stats) => stats.lit.map((l) => l[0]).sort();
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/paint-test.html?center=${encodeURIComponent(JSON.stringify(CENTER))}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.T && (window.T.ready || window.T.error), null, { timeout: 120000 });
  const err = await page.evaluate(() => window.T.error);
  if (err) throw new Error(err);
  let last = -1, stable = 0; const t0 = Date.now();    // wait until the tile set is stable (3 polls, 6 s)
  while (Date.now() - t0 < 90000) {
    await page.waitForTimeout(2000);
    const n = await page.evaluate(() => window.T.engine.litStats().records);
    if (n === last && n > 0) { if (++stable >= 3) break; } else { stable = 0; last = n; }
  }
  return { page, ctx, records: last };
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const args = GL === 'swiftshader'
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
    : ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'];
  const browser = await chromium.launch({ headless: true, args });
  // A: one call with the final lines — what a fresh map shows
  const A = await openPage(browser);
  const a = await A.page.evaluate((lines) => { const t0 = performance.now(); window.T.engine.setPaint(lines); return { ms: performance.now() - t0, stats: window.T.engine.litStats(), gl: window.T.gl }; }, linesAt(cur.length));
  await A.ctx.close();
  // B: the same history, one fix at a time; then an unchanged resend, a dropped line and a moved end point (reset paths)
  const B = await openPage(browser);
  const b = await B.page.evaluate(({ hist, cov, cur, STEPS }) => {
    const linesAt = (n) => (n <= 1 ? [...hist, ...cov] : [...hist, cur.slice(0, n), ...cov]);
    const eng = window.T.engine, times = [];
    for (const n of STEPS) { const L = linesAt(n); const t0 = performance.now(); eng.setPaint(L); times.push(performance.now() - t0); }
    const t1 = performance.now(); eng.setPaint(linesAt(cur.length)); const repeat = performance.now() - t1;
    const after = eng.litStats();
    const t2 = performance.now(); eng.setPaint([...hist.slice(1), cur, ...cov]); const dropped = { ms: performance.now() - t2, stats: eng.litStats() };
    const L = [...hist.slice(1), cur, ...cov]; L[5] = [L[5][0], [L[5][1][0] + 0.0005, L[5][1][1]]];
    const t3 = performance.now(); eng.setPaint(L); const moved = { ms: performance.now() - t3, stats: eng.litStats() };
    return { times, repeat, after, dropped, moved };
  }, { hist, cov, cur, STEPS });
  await B.ctx.close();
  const t = b.times;
  console.log(`engine on ${a.gl}; records one-shot/progressive ${A.records}/${B.records}`);
  console.log(`one shot: ${a.ms.toFixed(1)} ms → lit ${a.stats.lit.length}, walked points ${a.stats.paintPts}`);
  console.log(`progressive ${t.length} calls: first ${t[0].toFixed(1)} ms (the history), then 25% ${q(t.slice(1), 0.25).toFixed(2)}, median ${q(t.slice(1), 0.5).toFixed(2)}, 75% ${q(t.slice(1), 0.75).toFixed(2)}, last ${t[t.length - 1].toFixed(2)} ms; unchanged resend ${b.repeat.toFixed(2)} ms`);
  console.log(`progressive → lit ${b.after.lit.length}, walked points ${b.after.paintPts}; dropped line → re-walk ${b.dropped.ms.toFixed(1)} ms, lit ${b.dropped.stats.lit.length}; moved end point → re-walk ${b.moved.ms.toFixed(1)} ms, lit ${b.moved.stats.lit.length}`);
  const idsA = sortedIds(a.stats), idsB = sortedIds(b.after);
  const flat = q(t.slice(1), 0.75) < Math.max(2, t[0] / 10);
  const ok = A.records === B.records && same(idsA, idsB) && b.after.paintPts === a.stats.paintPts && flat && b.dropped.stats.lit.length >= b.after.lit.length;
  console.log(ok ? 'PAINT OK — identical lighting, flat per-call cost' : `PAINT CHECK FAILED — same tiles ${A.records === B.records}, same lit set ${same(idsA, idsB)}, same walked points ${b.after.paintPts === a.stats.paintPts}, flat ${flat}`);
  await browser.close(); server.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); server.close(); process.exit(2); });
