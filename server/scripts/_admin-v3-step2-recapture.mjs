import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.resolve('../qa/admin-v3-step2');
const BASE = process.env.ADMIN_URL || 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
await page.reload({ waitUntil: 'domcontentloaded' });
if (await page.locator('#login-form').isVisible().catch(() => false)) {
  await page.screenshot({ path: path.join(OUT, 'login-light.png') });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASS);
  await page.click('#login-form button[type="submit"]');
  await page.waitForSelector('.v3-sidebar', { timeout: 20000 });
}

const shells = [
  ['overview', '#/overview'],
  ['users', '#/users'],
  ['push', '#/push'],
  ['rewards', '#/rewards'],
  ['quality', '#/quality'],
];
for (const [name, hash] of shells) {
  await page.evaluate((next) => { location.hash = next; }, hash);
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT, `1440-light-${name}.png`) });
}

await page.keyboard.press('Control+K');
await page.waitForTimeout(400);
const paletteText = await page.locator('#ops-palette').innerText().catch(() => '');
await page.screenshot({ path: path.join(OUT, '1440-palette.png') });
await page.keyboard.press('Escape');

await page.evaluate(() => { location.hash = '#/rewards'; });
await page.waitForTimeout(1600);
const campTab = page.locator('[data-rewards-sub="campaigns"]');
if (await campTab.count()) {
  await campTab.click();
  await page.waitForTimeout(900);
}
const create = page.locator('#rw-campaign-create, #rw-campaign-create-empty').first();
let campaignOpen = false;
if (await create.count()) {
  await create.click();
  await page.waitForTimeout(800);
  campaignOpen = (await page.locator('#drawer:not(.hidden)').count()) > 0;
  await page.screenshot({ path: path.join(OUT, '1440-campaign-modal.png') });
  await page.keyboard.press('Escape');
}

await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
await page.evaluate(() => { location.hash = '#/overview'; });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, '1440-dark-overview.png') });

const extra = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p2 = await extra.newPage();
await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
await p2.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
await p2.reload({ waitUntil: 'domcontentloaded' });
if (await p2.locator('#login-form').isVisible().catch(() => false)) {
  await p2.fill('#login-email', EMAIL);
  await p2.fill('#login-password', PASS);
  await p2.click('#login-form button[type="submit"]');
  await p2.waitForSelector('.v3-sidebar', { timeout: 20000 });
}
for (const [name, hash] of shells) {
  await p2.evaluate((next) => { location.hash = next; }, hash);
  await p2.waitForTimeout(2800);
  await p2.screenshot({ path: path.join(OUT, `1280-light-${name}.png`) });
}
await extra.close();

console.log(JSON.stringify({
  errors,
  paletteHasRewards: /ჯილდოები|Rewards/i.test(paletteText),
  paletteGroups: ['Overview', 'People', 'Engagement', 'Commerce', 'Health', 'Operations', 'Production']
    .filter((g) => paletteText.includes(g)),
  campaignOpen,
}, null, 2));
await browser.close();
