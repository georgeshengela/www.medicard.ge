// Full-length shots of each phone on lab-visual-board.html → brand/medilab/shots/*.png
//   node brand/medilab/shot-board.cjs
const path = require('node:path');
const { chromium } = require('../../mobile/node_modules/playwright');
(async () => {
  const out = path.join(__dirname, 'shots');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2300, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto(require('node:url').pathToFileURL(path.join(__dirname, 'lab-visual-board.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'board.png'), fullPage: true });
  // unroll the scrolling phones so every section shows
  await page.addStyleTag({ content: '.screen:not(#C){height:auto!important}.scroll{height:auto!important;overflow:visible!important}.phone{height:auto!important}.pulse{animation:none!important;opacity:0}' });
  for (const id of ['A', 'B', 'D', 'E']) {
    await page.locator(`#${id}`).locator('xpath=ancestor::div[contains(@class,"phone")]').screenshot({ path: path.join(out, `${id}.png`) });
  }
  for (const g of ['heart']) {
    await page.locator(`#B .chip[data-g="${g}"]`).click();
    await page.locator('#B').locator('xpath=ancestor::div[contains(@class,"phone")]').screenshot({ path: path.join(out, `B-${g}.png`) });
  }
  await page.evaluate('cur = 0; renderC()');
  for (let i = 0; i < 6; i++) {
    const phone = page.locator('#C').locator('xpath=ancestor::div[contains(@class,"phone")]');
    await phone.screenshot({ path: path.join(out, `C${i}.png`) });
    await page.locator('#C .story').click({ position: { x: 300, y: 400 } });
  }
  await browser.close();
})();
