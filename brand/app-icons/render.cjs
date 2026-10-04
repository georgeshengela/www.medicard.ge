// Renders the numbered board and a 1024 px PNG of every drawn icon: node brand/app-icons/render.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../server/node_modules/playwright'));
const file = 'file:///' + path.resolve(__dirname, 'index.html').split(path.sep).join('/');
const out = path.join(__dirname, 'out');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(file); await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, 'board.png'), fullPage: true });
  const ids = await page.evaluate(() => ICONS.map(i => i.id));
  const solo = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const id of ids) {
    await solo.goto(file + '?icon=' + id); await solo.waitForTimeout(150);
    await solo.locator('#solo').screenshot({ path: path.join(out, id + '.png') });
  }
  await browser.close();
})();
