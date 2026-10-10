// Screenshots of the concept board phones: node brand/welcome-v2/shots.cjs [outDir]
// Each phone in light, then dark (toggle tapped), then dark + English.
const { chromium } = require('../../server/node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const out = process.argv[2] || path.join(__dirname, 'shots');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1100 }, deviceScaleFactor: 2, colorScheme: 'light' });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
  await p.goto('file://' + path.join(__dirname, 'board.html').replace(/\\/g, '/'));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(out, 'board.png') });
  for (const id of ['pa', 'pb', 'pc']) {
    const dev = p.locator(`#${id}`).locator('xpath=..');
    await dev.screenshot({ path: path.join(out, `${id}-day.png`) });
    await p.click(`#${id} .tt`);
    await p.waitForTimeout(2600);
    await dev.screenshot({ path: path.join(out, `${id}-night.png`) });
    await p.click(`#${id} .seg button[data-lang="en"]`);
    await p.waitForTimeout(900);
    await dev.screenshot({ path: path.join(out, `${id}-night-en.png`) });
  }
  await b.close();
})();
