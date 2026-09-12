/**
 * Focused recapture after visual fixes — waits for content, rebuilds contact sheets.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd().endsWith('server') ? '../qa/admin-v3-final-unification' : 'qa/admin-v3-final-unification');
const OUT = path.join(ROOT, 'screenshots');
const BASE = process.env.ADMIN_URL || 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'pass2'), { recursive: true });

const ROUTES = [
  ['login', null],
  ['overview', '#/overview'],
  ['users', '#/users'],
  ['medi', '#/ai'],
  ['health', '#/health'],
  ['push-brain', '#/push?tab=brain'],
  ['push-compose', '#/push?tab=compose'],
  ['orders', '#/orders'],
  ['packages', '#/packages'],
  ['sms', '#/sms'],
  ['pharmacy', '#/pharmacy'],
  ['rewards', '#/rewards?tab=overview'],
  ['campaigns', '#/rewards?tab=campaigns'],
  ['campaign-create', '#/rewards?tab=campaigns&edit=new'],
  ['partners', '#/rewards?tab=partners'],
  ['redemptions', '#/rewards?tab=redemptions'],
  ['codes', '#/rewards?tab=codes'],
  ['quality', '#/quality'],
  ['audit', '#/audit'],
  ['settings', '#/settings'],
];

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#login-form').isVisible().catch(() => false)) {
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASS);
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('.v3-sidebar, .sidebar', { timeout: 30000 });
  }
}

async function settle(page, key) {
  if (key === 'push-compose') {
    await page.waitForSelector('#push-compose-form, .push-compose-form', { timeout: 15000 }).catch(() => {});
    const composeTab = page.locator('[data-v3-sub="compose"], [data-push-tab="compose"]').first();
    if (await composeTab.count()) await composeTab.click();
    await page.waitForTimeout(600);
  }
  if (key === 'rewards' || key.startsWith('campaign') || key === 'partners' || key === 'codes' || key === 'redemptions') {
    await page.waitForFunction(() => !/იტვირთება/.test(document.querySelector('.workspace')?.innerText || ''), { timeout: 20000 }).catch(() => {});
  }
  if (key === 'medi') {
    await page.waitForSelector('#tab-ai .v3-medi, #tab-ai .ai-page, #tab-ai .v3-module', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  if (key === 'orders') {
    await page.waitForSelector('.orders-board, .v3-orders-queue', { timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const report = { shots: [], classify: {}, contact: {} };

try {
  // Login shot
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.removeItem('medicard.admin.token'); } catch {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'login-1440-light.png') });
  await page.screenshot({ path: path.join(ROOT, 'pass2', 'login-1440-light.png') });

  await login(page);

  for (const [key, hash] of ROUTES) {
    if (key === 'login') continue;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(900);
    await settle(page, key);
    const info = await page.evaluate(() => {
      const title = document.querySelector('.v3-page-title, .page-title, h1, .v3-header h2')?.textContent?.trim() || '';
      const opsKpis = [...document.querySelectorAll('.ops-kpis')].some((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
      const mosaic = !!document.querySelector('.orders-board[data-cols="4"]');
      const phone = [...document.querySelectorAll('.push-phone-bezel')].some((el) => getComputedStyle(el).display !== 'none');
      const composeForm = !!document.querySelector('#push-compose-form:not(.hidden), .push-compose-form');
      const composeVisible = composeForm && !document.querySelector('[data-push-panel="compose"].hidden');
      return {
        title,
        hash: location.hash,
        opsKpis,
        mosaic,
        phone,
        composeVisible,
        preview: !!document.querySelector('.v3-notif-preview, .v3-push-preview-col'),
        queue: !!document.querySelector('.v3-orders-queue, .orders-board[data-cols="1"]'),
        critical: document.querySelectorAll('.v3-critical-item, .v3-critical-strip').length,
        loading: /იტვირთება/.test(document.querySelector('.workspace')?.innerText || ''),
      };
    });
    const native = !info.opsKpis && !info.mosaic && !info.phone && !info.loading;
    report.classify[key] = { class: native ? 'V3_NATIVE' : 'V3_WITH_LEGACY_FRAGMENT', info };
    const dest = `${key}-1440-light.png`;
    await page.screenshot({ path: path.join(OUT, dest) });
    await page.screenshot({ path: path.join(ROOT, 'pass2', dest) });
    report.shots.push(dest);

    // Dark for majors
    if (['overview', 'users', 'medi', 'health', 'push-compose', 'orders', 'rewards', 'quality', 'settings', 'sms', 'packages'].includes(key)) {
      await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'dark'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      await page.evaluate((h) => { location.hash = h; }, hash);
      await page.waitForTimeout(1000);
      await settle(page, key);
      await page.screenshot({ path: path.join(OUT, `${key}-1440-dark.png`) });
      await page.screenshot({ path: path.join(ROOT, 'pass2', `${key}-1440-dark.png`) });
      await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
    }
  }

  // User detail
  await page.evaluate(() => { location.hash = '#/users'; });
  await page.waitForTimeout(1000);
  const row = page.locator('table tbody tr').first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, 'user-detail-1440-light.png') });
    await page.screenshot({ path: path.join(ROOT, 'pass2', 'user-detail-1440-light.png') });
  }

  // Widths
  for (const [w, label] of [[1280, '1280'], [1920, '1920'], [2560, '2560']]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const [key, hash] of [['orders', '#/orders'], ['push-compose', '#/push?tab=compose'], ['rewards', '#/rewards?tab=overview']]) {
      await page.evaluate((h) => { location.hash = h; }, hash);
      await page.waitForTimeout(800);
      await settle(page, key);
      await page.screenshot({ path: path.join(OUT, `${key}-${label}-light.png`) });
    }
  }

  // Contact sheets with absolute file URLs
  async function sheet(theme, files, outName) {
    const items = files.map((f) => {
      const abs = path.join(OUT, f).replace(/\\/g, '/');
      return `<figure><img src="file:///${abs}"/><figcaption>${f}</figcaption></figure>`;
    }).join('');
    const html = `<!doctype html><html><body style="margin:0;background:#111;color:#eee;font:12px system-ui">
      <h1 style="padding:16px">Admin V3 contact sheet — ${theme}</h1>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px">${items}</div>
    </body></html>`;
    const htmlPath = path.join(ROOT, `contact-sheet-${theme}.html`);
    fs.writeFileSync(htmlPath, html);
    const p = await context.newPage();
    await p.setViewportSize({ width: 1600, height: 2400 });
    await p.goto('file:///' + htmlPath.replace(/\\/g, '/'));
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(ROOT, outName), fullPage: true });
    await p.close();
  }

  const lightFiles = ROUTES.map(([k]) => `${k}-1440-light.png`).filter((f) => fs.existsSync(path.join(OUT, f)));
  lightFiles.push('user-detail-1440-light.png');
  await sheet('light', lightFiles.filter((f) => fs.existsSync(path.join(OUT, f))), 'contact-sheet-light.png');

  const darkFiles = fs.readdirSync(OUT).filter((f) => f.endsWith('1440-dark.png')).sort();
  await sheet('dark', darkFiles, 'contact-sheet-dark.png');

  fs.writeFileSync(path.join(ROOT, 'live-report-recapture.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ shots: report.shots.length, classify: report.classify }, null, 2));
} finally {
  await browser.close();
}
