/**
 * Admin V3 full redesign — smoke + screenshot matrix.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd().endsWith('server') ? '../qa/admin-v3-full-redesign' : 'qa/admin-v3-full-redesign');
const BASE = process.env.ADMIN_URL || 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';

const ROUTES = [
  ['overview', '#/overview', 'overview'],
  ['users', '#/users', 'users'],
  ['medi', '#/ai', 'medi'],
  ['health', '#/health', 'health'],
  ['push', '#/push?tab=brain', 'push'],
  ['orders', '#/orders', 'orders'],
  ['packages', '#/packages', 'packages'],
  ['sms', '#/sms', 'sms'],
  ['pharmacy', '#/pharmacy', 'pharmacy'],
  ['rewards', '#/rewards?tab=overview', 'rewards'],
  ['quality', '#/quality', 'quality'],
  ['audit', '#/audit', 'audit'],
  ['settings', '#/settings', 'settings'],
];

fs.mkdirSync(ROOT, { recursive: true });
for (const [, , folder] of ROUTES) fs.mkdirSync(path.join(ROOT, folder), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'global'), { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  shots: [],
  measures: {},
  functional: {},
  pageErrors: [],
  consoleLogs: [],
  networkFails: [],
};

async function login(page, theme = 'light') {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('medicard.admin.theme', t), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#login-form').isVisible().catch(() => false)) {
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASS);
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('.v3-sidebar, .sidebar', { timeout: 25000 });
  }
}

async function shot(page, folder, name, full = false) {
  const dest = path.join(ROOT, folder, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: full });
  report.shots.push(`${folder}/${name}`);
}

async function gotoHash(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(1100);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => report.pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') report.consoleLogs.push(m.text()); });

try {
  await login(page, 'light');
  await shot(page, 'global', 'login-after-auth-light');

  // Help footer
  const helpBtn = page.locator('#admin-help-global, [data-v3-help="global.howAdminWorks"]').first();
  if (await helpBtn.count()) {
    await helpBtn.click();
    await page.waitForTimeout(300);
    await shot(page, 'global', 'help-how-admin-works');
    await page.keyboard.press('Escape');
  }

  for (const [key, hash, folder] of ROUTES) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHash(page, hash);
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => ({
      hash: location.hash,
      help: document.querySelectorAll('[data-v3-help]').length,
      v3Module: !!document.querySelector('.v3-module, .v3-workspace-wide, .v3-cc, .v3-users, .v3-user-page'),
      pageMax: getComputedStyle(document.documentElement).getPropertyValue('--v3-page-max').trim(),
      overflowX: document.body.scrollWidth > window.innerWidth + 6,
      textLen: (document.querySelector('.workspace')?.innerText || '').length,
    }));
    report.measures[`${key}-1440`] = info;
    report.functional[key] = info.textLen > 40 ? 'WORKING' : 'PARTIAL';
    await shot(page, folder, '1440-light');

    await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await shot(page, folder, '1440-dark');
    await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoHash(page, hash);
    await page.waitForTimeout(600);
    report.measures[`${key}-1920`] = await page.evaluate(() => ({
      panelW: document.querySelector('.workspace > .panel, .v3-cc, .v3-module')?.getBoundingClientRect().width,
      vw: innerWidth,
    }));
    await shot(page, folder, '1920-light');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    report.measures[`${key}-1280`] = await page.evaluate(() => ({
      overflowX: document.body.scrollWidth > window.innerWidth + 6,
    }));
    await shot(page, folder, '1280-light');
  }

  // Complex extras
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'dark'));
  for (const [key, hash, folder] of [['push', '#/push?tab=brain', 'push'], ['rewards', '#/rewards?tab=campaigns', 'rewards'], ['settings', '#/settings', 'settings'], ['quality', '#/quality', 'quality']]) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoHash(page, hash);
    await page.waitForTimeout(800);
    await shot(page, folder, '1920-dark');
  }
  await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));

  // Functional checks
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await gotoHash(page, '#/push?tab=compose');
  await page.waitForTimeout(600);
  report.functional.pushTabUrl = await page.evaluate(() => location.hash.includes('tab=compose'));
  await gotoHash(page, '#/rewards?tab=codes');
  await page.waitForTimeout(700);
  report.functional.rewardsTabUrl = await page.evaluate(() => location.hash.includes('tab=codes'));
  await gotoHash(page, '#/settings');
  await page.waitForTimeout(700);
  report.functional.settingsSticky = await page.locator('#v3-sticky-actions, .v3-sticky-actions').count();
  await gotoHash(page, '#/rewards?tab=campaigns&edit=new');
  await page.waitForTimeout(900);
  report.functional.campaignFullPage = await page.locator('#rw-campaign-form, .v3-form-rail, #edit-campaign-form').count();

  // 2560 width sample
  await page.setViewportSize({ width: 2560, height: 1440 });
  await gotoHash(page, '#/users');
  await page.waitForTimeout(700);
  report.measures.users2560 = await page.evaluate(() => ({
    pageMax: getComputedStyle(document.documentElement).getPropertyValue('--v3-page-max').trim(),
    tableW: document.querySelector('.v3-table')?.getBoundingClientRect().width,
  }));
  await shot(page, 'users', '2560-light');
} catch (err) {
  report.fatal = String(err?.stack || err);
} finally {
  fs.writeFileSync(path.join(ROOT, 'live-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify({
  out: ROOT,
  shots: report.shots.length,
  fatal: report.fatal || null,
  functional: report.functional,
  pageErrors: report.pageErrors.slice(0, 10),
  consoleLogs: report.consoleLogs.slice(0, 10),
}, null, 2));
