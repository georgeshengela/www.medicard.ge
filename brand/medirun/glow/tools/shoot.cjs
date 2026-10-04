// Headless frames of the MEDIRUN Glow prototype (swiftshader WebGL). Usage:
//   node shoot.cjs <baseUrl> <outPrefix> [headMetres] [cam] [hero] [dpr]
// Drives the sim directly: jumps the run head to <headMetres>, lets the lighting wave play, screenshots.
const path = require('path');
const { chromium } = require(path.join('C:/Users/User/Desktop/www.medicard/server/node_modules/playwright'));
const [,, base = 'http://localhost:4460/', prefix = 'shot', headArg = '600', cam = 'close', hero = 'm', dprArg = '2'] = process.argv;
const out = path.join(__dirname, 'shots');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-web-security'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(dprArg), isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { const t = m.text(); if (/error|warn|fail/i.test(t)) console.log('[console]', t.slice(0, 300)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  const url = base + (base.includes('?') ? '&' : '?') + `nosim&cam=${cam}&hero=${hero}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.glow && window.glow.engine, null, { timeout: 90000 });
  // let the first tiles arrive
  await page.waitForTimeout(6000);
  const head = Number(headArg);
  // walk the route quickly: feed trail + runner in steps so the engine lights buildings along the way
  await page.evaluate(async (head) => {
    const g = window.glow, eng = g.engine;
    const ROUTE = await fetch('/route.json').then((r) => r.json());
    const [lng0, lat0] = ROUTE.coords[0], KX = 111320 * Math.cos((lat0 * Math.PI) / 180), KY = 110540;
    const toXY = ([lng, lat]) => [(lng - lng0) * KX, (lat - lat0) * KY];
    const toLL = (x, y) => [lng0 + x / KX, lat0 + y / KY];
    const raw = ROUTE.coords.map(toXY), pts = [];
    let acc = 0; pts.push({ x: raw[0][0], y: raw[0][1], s: 0 });
    for (let i = 1; i < raw.length; i++) { const [ax, ay] = raw[i - 1], [bx, by] = raw[i], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 2)); for (let k = 1; k <= n; k++) { acc += len / n; pts.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, s: acc }); } }
    const upto = pts.filter((p) => p.s <= head);
    const coords = upto.filter((_, i) => i % 3 === 0).map((p) => toLL(p.x, p.y));
    const last = upto[upto.length - 1], prev = upto[Math.max(0, upto.length - 3)];
    const heading = (Math.atan2(last.x - prev.x, last.y - prev.y) * 180) / Math.PI;
    const ll = toLL(last.x, last.y);
    coords.push(ll);
    g.state.head = head; g.state.running = true; g.state.pace = 1.4;
    eng.setRunner(ll[0], ll[1], heading, 1.4);
    eng.setTrail(coords);
    eng.setActivity('walk');
    window.__ll = ll; window.__heading = heading;
  }, head);
  // frames: the engine advances uTime by <= 0.1 s per frame, so wait for the wave to settle
  await page.waitForTimeout(12000);
  await page.evaluate((cam) => { const g = window.glow; g.state.manual = false; if (cam === 'closeup') { g.state.closeUp = true; g.engine.setHeroView(true); } }, cam);
  await page.waitForTimeout(4000);
  const fps = await page.evaluate(() => document.getElementById('fps') && document.getElementById('fps').textContent);
  const lit = await page.evaluate(() => window.glow.engine.litCount());
  console.log('fps', fps, 'lit', lit);
  await page.screenshot({ path: path.join(out, `${prefix}.png`) });
  console.log('saved', path.join(out, `${prefix}.png`));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
