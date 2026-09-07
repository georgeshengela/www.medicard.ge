import { chromium } from 'playwright';
import path from 'node:path';

const OUT = path.resolve('../qa/admin-v3-step2');
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('http://localhost:4000/admin', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
await page.reload({ waitUntil: 'domcontentloaded' });
if (await page.locator('#login-form').isVisible()) {
  await page.fill('#login-email', 'admin@medicard.ge');
  await page.fill('#login-password', 'MedicardAdmin1!');
  await page.click('#login-form button[type="submit"]');
  await page.waitForSelector('.v3-sidebar');
}
await page.waitForSelector('#ops-kpis', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '1440-light-overview.png') });
await page.evaluate(() => {
  if (typeof renderCommandPalette === 'function') renderCommandPalette();
});
await page.waitForTimeout(400);
const text = await page.locator('#ops-palette').innerText();
await page.screenshot({ path: path.join(OUT, '1440-palette.png') });
console.log(JSON.stringify({
  hasRewards: text.includes('ჯილდოები'),
  hasOverview: text.includes('Overview'),
  hasCommerce: text.includes('Commerce'),
  snippet: text.slice(0, 280),
}));
await browser.close();
