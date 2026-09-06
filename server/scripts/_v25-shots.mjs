import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('server/scripts/_v25-shots');
const BASE = 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';
const SIZES = [
  { name: '1366', w: 1366, h: 768 },
  { name: '1440', w: 1440, h: 900 },
  { name: '1920', w: 1920, h: 1080 },
];

fs.mkdirSync(ROOT, { recursive: true });

async function waitQuiet(page, ms = 800) {
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  const file = path.join(ROOT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('shot', name);
}

async function login(page) {
  await page.goto(`${BASE}?v=ops13`, { waitUntil: 'domcontentloaded' });
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
  await waitQuiet(page, 1200);
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

for (const size of SIZES) {
  await page.setViewportSize({ width: size.w, height: size.h });
  for (const [name, hash] of routes) {
    await go(page, hash);
    if (name === 'push') {
      const compose = page.locator('[data-push-tab="compose"]');
      if (await compose.count()) {
        await compose.click();
        await waitQuiet(page, 400);
      }
    }
    await shot(page, `${size.name}-${name}`);
  }

  await go(page, '#/users');
  const userRow = page.locator('#users-tbody tr').first();
  if (await userRow.count()) {
    await userRow.click();
    await waitQuiet(page, 1400);
    await shot(page, `${size.name}-user-page`);
    const tabs = ['activity', 'product', 'notifications', 'devices', 'audit'];
    for (const tab of tabs) {
      const btn = page.locator(`[data-user-tab="${tab}"]`);
      if (await btn.count()) {
        await btn.click();
        await waitQuiet(page, 500);
        await shot(page, `${size.name}-user-${tab}`);
      }
    }
  }

  await go(page, '#/push');
  const brainTab = page.locator('[data-push-tab="brain"]');
  if (await brainTab.count()) {
    await brainTab.click();
    await waitQuiet(page, 1600);
    await shot(page, `${size.name}-brain`);
    const dec = page.locator('#dec-body tr[data-id]').first();
    if (await dec.count()) {
      await dec.click();
      await waitQuiet(page, 900);
      await shot(page, `${size.name}-decision`);
      await page.keyboard.press('Escape');
      await waitQuiet(page, 300);
    }
  }
}

const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const loginPage = await loginCtx.newPage();
await loginPage.goto(`${BASE}?v=ops12`, { waitUntil: 'domcontentloaded' });
await loginPage.waitForSelector('#login-form', { timeout: 10000 });
await loginPage.screenshot({ path: path.join(ROOT, '1440-login.png'), fullPage: true });
console.log('shot 1440-login');
await loginCtx.close();

await browser.close();
console.log('done', ROOT);
