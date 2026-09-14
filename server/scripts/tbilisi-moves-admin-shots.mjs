/**
 * Admin visual capture for თბილისი მოძრაობს Phase 6.
 * Requires the isolated pilot API already listening (default :4011).
 * Does not print passwords. Synthetic visual-qa env is labeled in the UI.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.TBILISI_MOVES_SHOTS_DIR
  || path.resolve(__dirname, '../../qa/tbilisi-moves-phase6');
const BASE = process.env.TBILISI_MOVES_PILOT_ADMIN_URL || 'http://127.0.0.1:4011/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';

mkdirSync(OUT, { recursive: true });

const tabs = [
  ['overview', '#/tbilisi-moves?tab=overview'],
  ['districts', '#/tbilisi-moves?tab=districts'],
  ['rules', '#/tbilisi-moves?tab=rules'],
  ['rounds', '#/tbilisi-moves?tab=rounds'],
  ['review', '#/tbilisi-moves?tab=review'],
  ['rewards', '#/tbilisi-moves?tab=rewards'],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

async function login(theme) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((next) => localStorage.setItem('medicard.admin.theme', next), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#login-form').isVisible().catch(() => false)) {
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASS);
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('.v3-sidebar, .sidebar', { timeout: 20000 });
  }
}

try {
  for (const theme of ['light', 'dark']) {
    await login(theme);
    for (const [name, hash] of tabs) {
      await page.evaluate((h) => {
        location.hash = h;
      }, hash);
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(OUT, `admin-${theme}-${name}.png`),
        fullPage: true,
      });
    }
  }
  console.log(JSON.stringify({ ok: true, out: OUT, tabs: tabs.map(([name]) => name), themes: ['light', 'dark'] }));
} catch (error) {
  console.error('[tbilisi-moves-admin-shots]', error.message);
  process.exit(1);
} finally {
  await browser.close();
}
