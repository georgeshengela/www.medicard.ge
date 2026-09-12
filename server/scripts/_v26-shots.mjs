import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('server/scripts/_v26-shots');
const BASE = 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';
const THEME = process.env.SHOT_THEME || 'light';
const PREFIX = THEME === 'dark' ? 'dark-' : '';

fs.mkdirSync(ROOT, { recursive: true });

async function waitQuiet(page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  const file = path.join(ROOT, `${PREFIX}${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('shot', `${PREFIX}${name}`);
}

async function login(page) {
  await page.goto(`${BASE}?v=v26`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((theme) => localStorage.setItem('medicard.admin.theme', theme), THEME);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#login-form').isVisible().catch(() => false)) {
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASS);
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('#app-view', { timeout: 15000 });
  }
  await page.waitForSelector('.sidebar', { timeout: 15000 });
}

async function go(page, hash) {
  await page.evaluate((next) => { location.hash = next; }, hash);
  await waitQuiet(page, 2800);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await login(page);

const routes = [
  ['overview', '#/overview'],
  ['users', '#/users'],
  ['health', '#/health'],
  ['ai', '#/ai'],
  ['quality', '#/quality'],
  ['audit', '#/audit'],
  ['push', '#/push'],
  ['orders', '#/orders'],
  ['packages', '#/packages'],
  ['sms', '#/sms'],
  ['pharmacy', '#/pharmacy'],
  ['settings', '#/settings'],
  ['missing', '#/does-not-exist'],
];

for (const [name, hash] of routes) {
  await go(page, hash);
  if (name === 'push') {
    const compose = page.locator('[data-push-tab="compose"]');
    if (await compose.count()) {
      await compose.click();
      await waitQuiet(page, 400);
    }
  }
  await shot(page, name);
}

await go(page, '#/users');
const userRow = page.locator('#users-tbody tr').first();
if (await userRow.count()) {
  await userRow.click();
  await waitQuiet(page, 3500);
  await shot(page, 'user-page');
}

await go(page, '#/push');
const brainTab = page.locator('[data-push-tab="brain"]');
if (await brainTab.count()) {
  await brainTab.click();
  await waitQuiet(page, 1600);
  await shot(page, 'brain');
}

// login screen
const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const loginPage = await loginCtx.newPage();
await loginPage.goto(`${BASE}?v=v26L`, { waitUntil: 'domcontentloaded' });
await loginPage.evaluate((theme) => localStorage.setItem('medicard.admin.theme', theme), THEME);
await loginPage.reload({ waitUntil: 'domcontentloaded' });
await loginPage.waitForSelector('#login-form', { timeout: 10000 });
await loginPage.screenshot({ path: path.join(ROOT, `${PREFIX}login.png`), fullPage: true });
console.log('shot', `${PREFIX}login`);
await loginCtx.close();

await browser.close();
console.log('done', ROOT);
