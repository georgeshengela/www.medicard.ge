/**
 * Admin V3 Step 2 — live QA.
 * Shell / IA / chrome only. Does not submit mutations.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd().includes('server') ? '../qa/admin-v3-step2' : 'qa/admin-v3-step2');
const BASE = process.env.ADMIN_URL || 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';

fs.mkdirSync(OUT, { recursive: true });

const consoleLogs = [];
const pageErrors = [];
const failed = [];
const reqs = [];

function attach(page) {
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleLogs.push({ type, text: msg.text(), url: page.url() });
    }
  });
  page.on('pageerror', (err) => pageErrors.push({ message: err.message, url: page.url() }));
  page.on('request', (req) => {
    if (req.url().includes('/api/admin') || req.url().includes('/socket.io')) {
      reqs.push({ method: req.method(), url: req.url(), t: Date.now() });
    }
  });
  page.on('response', (res) => {
    const url = res.url();
    if ((url.includes('/api/admin') || url.includes('/admin/')) && res.status() >= 400) {
      failed.push({ status: res.status(), url, method: res.request().method() });
    }
  });
}

async function login(page, theme = 'light') {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((next) => localStorage.setItem('medicard.admin.theme', next), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#login-form').isVisible().catch(() => false)) {
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASS);
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('#app-view:not(.hidden), .sidebar', { timeout: 20000 });
  }
  await page.waitForSelector('.v3-sidebar, .sidebar', { timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function go(page, hash) {
  await page.evaluate((next) => { location.hash = next; }, hash);
  await page.waitForTimeout(1600);
}

async function shell(page) {
  return page.evaluate(() => {
    const groups = [...document.querySelectorAll('[data-nav-group]')].map((g) => ({
      id: g.getAttribute('data-nav-group'),
      label: g.querySelector('.v3-nav-group-toggle')?.textContent?.trim() || '',
      items: [...g.querySelectorAll('.nav')].map((b) => ({
        tab: b.dataset.tab,
        label: b.querySelector('.nav-label')?.textContent?.trim() || '',
        icon: b.dataset.icon,
        active: b.classList.contains('active'),
      })),
    }));
    const brand = document.querySelector('.v3-brand')?.innerText?.replace(/\s+/g, ' ').trim() || '';
    const plusLogo = Boolean(document.querySelector('.sidebar-brand .logo-mark, .logo-mark svg'));
    const themeAria = document.getElementById('theme-toggle')?.getAttribute('aria-label') || '';
    const logoutAria = document.getElementById('logout')?.getAttribute('aria-label') || '';
    const compactAria = document.getElementById('sidebar-compact')?.getAttribute('aria-label') || '';
    const kicker = document.getElementById('page-kicker')?.textContent || '';
    const heading = document.getElementById('page-greeting')?.textContent || '';
    const overflowX = document.body.scrollWidth > window.innerWidth + 4;
    const v3 = Boolean(window.AdminV3);
    const apis = v3 ? Object.keys(window.AdminV3).sort() : [];
    return {
      w: window.innerWidth,
      theme: document.documentElement.dataset.theme,
      brand,
      plusLogo,
      groups,
      themeAria,
      logoutAria,
      compactAria,
      kicker,
      heading,
      overflowX,
      scrollW: document.body.scrollWidth,
      v3,
      apis,
      hash: location.hash,
    };
  });
}

const DESTINATIONS = [
  ['overview', '#/overview'],
  ['users', '#/users'],
  ['push', '#/push'],
  ['health', '#/health'],
  ['ai', '#/ai'],
  ['rewards', '#/rewards'],
  ['packages', '#/packages'],
  ['orders', '#/orders'],
  ['sms', '#/sms'],
  ['pharmacy', '#/pharmacy'],
  ['quality', '#/quality'],
  ['audit', '#/audit'],
  ['settings', '#/settings'],
];

const SHELLS = [
  ['overview', '#/overview'],
  ['users', '#/users'],
  ['push', '#/push'],
  ['rewards', '#/rewards'],
  ['quality', '#/quality'],
];

const browser = await chromium.launch({ headless: true });
const findings = { viewports: {}, workflows: {}, notes: [] };

async function runViewport(width, theme) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  attach(page);
  const key = `${width}-${theme}`;
  const vp = { width, theme, shells: [], destinations: [], interactions: [] };
  try {
    await login(page, theme);
    if (width === 1440 && theme === 'light') {
      await page.screenshot({ path: path.join(OUT, 'login-if-skipped.png') });
      vp.shell = await shell(page);
      for (const [name, hash] of DESTINATIONS) {
        await go(page, hash);
        const s = await shell(page);
        vp.destinations.push({ name, heading: s.heading, kicker: s.kicker, hash: s.hash, overflowX: s.overflowX });
      }

      await go(page, '#/packages');
      const editPkg = page.locator('button:has-text("რედაქტირება")').first();
      if (await editPkg.count()) {
        await editPkg.click();
        await page.waitForTimeout(600);
        const open = await page.locator('#drawer:not(.hidden)').count();
        vp.interactions.push({ action: 'package-drawer', open: open > 0 });
        await page.screenshot({ path: path.join(OUT, '1440-package-drawer.png') });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
      }

      await go(page, '#/rewards');
      const campTab = page.locator('[data-rewards-sub="campaigns"]');
      if (await campTab.count()) {
        await campTab.click();
        await page.waitForTimeout(800);
      }
      const createCamp = page.locator('#rw-campaign-create, #rw-campaign-create-empty').first();
      if (await createCamp.count()) {
        await createCamp.click();
        await page.waitForTimeout(700);
        vp.interactions.push({
          action: 'campaign-modal',
          open: (await page.locator('#drawer:not(.hidden)').count()) > 0,
        });
        await page.screenshot({ path: path.join(OUT, '1440-campaign-modal.png') });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
      }

      const createPartner = page.locator('#rw-partner-create, #rw-partner-create-empty').first();
      await go(page, '#/rewards');
      const partnerTab = page.locator('[data-rewards-sub="partners"]');
      if (await partnerTab.count()) {
        await partnerTab.click();
        await page.waitForTimeout(700);
      }
      if (await createPartner.count() || await page.locator('#rw-partner-create').count()) {
        const btn = page.locator('#rw-partner-create, #rw-partner-create-empty').first();
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(600);
          vp.interactions.push({
            action: 'partner-modal',
            open: (await page.locator('#drawer:not(.hidden)').count()) > 0,
          });
          await page.keyboard.press('Escape');
        }
      }

      await go(page, '#/users');
      const row = page.locator('#users-tbody tr, .users-table tbody tr').first();
      if (await row.count()) {
        await row.click();
        await page.waitForTimeout(1800);
        vp.interactions.push({ action: 'user-page', hash: await page.evaluate(() => location.hash) });
        await page.screenshot({ path: path.join(OUT, '1440-user-page.png') });
      }

      await go(page, '#/audit');
      const auditRow = page.locator('#tab-audit table tbody tr, .admin-table tbody tr').first();
      if (await auditRow.count()) {
        await auditRow.click();
        await page.waitForTimeout(500);
        vp.interactions.push({
          action: 'audit-drawer',
          open: (await page.locator('#drawer:not(.hidden)').count()) > 0,
        });
        await page.keyboard.press('Escape');
      }

      await page.keyboard.press('Control+K');
      await page.waitForTimeout(400);
      const paletteText = await page.locator('#ops-palette').innerText().catch(() => '');
      vp.interactions.push({
        action: 'palette',
        open: paletteText.length > 0,
        hasRewards: /ჯილდოები|Rewards/i.test(paletteText),
        groups: ['Overview', 'People', 'Engagement', 'Commerce', 'Operations', 'Production']
          .filter((g) => paletteText.includes(g)),
      });
      await page.screenshot({ path: path.join(OUT, '1440-palette.png') });
      await page.keyboard.press('Escape');
    }

    for (const [name, hash] of SHELLS) {
      await go(page, hash);
      const s = await shell(page);
      vp.shells.push({ name, ...s });
      await page.screenshot({ path: path.join(OUT, `${width}-${theme}-${name}.png`) });
    }
  } catch (err) {
    vp.error = String(err);
  }
  findings.viewports[key] = vp;
  await context.close();
}

await runViewport(1440, 'light');
await runViewport(1440, 'dark');
await runViewport(1280, 'light');
await runViewport(1280, 'dark');
await runViewport(1920, 'light');
await runViewport(1920, 'dark');

await browser.close();

const byUrl = {};
for (const r of reqs) {
  const key = `${r.method} ${r.url.replace(/https?:\/\/[^/]+/, '').replace(/\?.*$/, '')}`;
  byUrl[key] = (byUrl[key] || 0) + 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  pageErrors,
  consoleLogs: consoleLogs.slice(0, 80),
  failedRequests: failed,
  totalAdminRequests: reqs.length,
  requestCounts: byUrl,
  findings,
};

fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 2));
const light1440 = findings.viewports['1440-light'];
console.log(JSON.stringify({
  pageErrors: pageErrors.length,
  console: consoleLogs.length,
  failed: failed.length,
  requests: reqs.length,
  brand: light1440?.shell?.brand,
  plusLogo: light1440?.shell?.plusLogo,
  groups: light1440?.shell?.groups?.map((g) => g.id),
  destinations: light1440?.destinations?.map((d) => `${d.name}:${d.kicker}/${d.heading}`),
  palette: light1440?.interactions?.find((i) => i.action === 'palette'),
  workflows: light1440?.interactions,
  overflow: Object.fromEntries(
    Object.entries(findings.viewports).map(([k, v]) => [
      k,
      (v.shells || []).filter((s) => s.overflowX).map((s) => s.name),
    ]),
  ),
  vpErrors: Object.fromEntries(Object.entries(findings.viewports).map(([k, v]) => [k, v.error || null])),
}, null, 2));
