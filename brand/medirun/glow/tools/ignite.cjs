// The ignition moment as a frame sequence: the runner stands at <head> m in a DARK city (tiles loaded, no trail),
// then the whole trail up to <head> appears at once and every building along it lights in the wave — flash,
// window flicker climbing from the street, lamps warming up, motes. One frame every <every> ms of real time.
//   node ignite.cjs <baseUrl> <outPrefix> [head=600] [frames=30] [everyMs=900]
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join('C:/Users/User/Desktop/www.medicard/server/node_modules/playwright'));
const [,, base = 'http://localhost:4460/?noadapt', prefix = 'ignite', headArg = '600', framesArg = '30', everyArg = '900'] = process.argv;
const out = path.join(__dirname, 'shots', prefix);
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'nosim&cam=close&hero=m', { waitUntil: 'load' });
  await page.waitForFunction(() => window.glow && window.glow.engine, null, { timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    const ROUTE = await fetch('/route.json').then((r) => r.json());
    const [lng0, lat0] = ROUTE.coords[0], KX = 111320 * Math.cos((lat0 * Math.PI) / 180), KY = 110540;
    const raw = ROUTE.coords.map(([lng, lat]) => [(lng - lng0) * KX, (lat - lat0) * KY]), pts = [];
    let acc = 0; pts.push({ x: raw[0][0], y: raw[0][1], s: 0 });
    for (let i = 1; i < raw.length; i++) { const [ax, ay] = raw[i - 1], [bx, by] = raw[i], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 2)); for (let k = 1; k <= n; k++) { acc += len / n; pts.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, s: acc }); } }
    const toLL = (x, y) => [lng0 + x / KX, lat0 + y / KY];
    const at = (head) => { const upto = pts.filter((p) => p.s <= head), last = upto[upto.length - 1], prev = upto[Math.max(0, upto.length - 3)]; return { upto, ll: toLL(last.x, last.y), heading: (Math.atan2(last.x - prev.x, last.y - prev.y) * 180) / Math.PI }; };
    // stand in the dark: the runner is placed, the camera follows, tiles load — no trail yet
    window.__stand = (head) => { const g = window.glow, a = at(head); g.state.head = head; g.state.running = false; g.state.manual = false; g.engine.setRunner(a.ll[0], a.ll[1], a.heading, 0); g.engine.setActivity('idle'); };
    // the whole trail appears: everything along it ignites
    window.__ignite = (head) => { const g = window.glow, a = at(head); const coords = a.upto.filter((_, i) => i % 3 === 0).map((p) => toLL(p.x, p.y)); coords.push(a.ll); g.state.running = true; g.state.pace = 1.4; g.engine.setRunner(a.ll[0], a.ll[1], a.heading, 1.4); g.engine.setTrail(coords); g.engine.setActivity('walk'); };
  });
  const head = Number(headArg), frames = Number(framesArg), every = Number(everyArg);
  await page.evaluate((h) => window.__stand(h), head);
  await page.waitForTimeout(16000);
  await page.screenshot({ path: path.join(out, 'f00.png'), clip: { x: 0, y: 150, width: 390, height: 520 } });
  await page.evaluate((h) => window.__ignite(h), head);
  for (let i = 1; i < frames; i++) {
    await page.waitForTimeout(every);
    await page.screenshot({ path: path.join(out, `f${String(i).padStart(2, '0')}.png`), clip: { x: 0, y: 150, width: 390, height: 520 } });
  }
  console.log('frames in', out);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
