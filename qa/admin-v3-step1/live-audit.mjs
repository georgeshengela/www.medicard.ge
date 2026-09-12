/**
 * Admin V3 Step 1 — live QA helper (read-only).
 * Clicks through screens, records console/network, checks overflow.
 * Does not submit mutations.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd().includes('server') ? '../qa/admin-v3-step1' : 'qa/admin-v3-step1');
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

async function login(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (await page.locator('#login-form').isVisible().catch(() => false)) {
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASS);
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('#app-view:not(.hidden), .sidebar', { timeout: 20000 });
  }
  await page.waitForSelector('.sidebar', { timeout: 20000 });
  await page.waitForTimeout(1800);
}

async function go(page, hash) {
  await page.evaluate((next) => { location.hash = next; }, hash);
  await page.waitForTimeout(2200);
}

async function measure(page, name) {
  return page.evaluate((label) => {
    const body = document.body;
    const overflowX = body.scrollWidth > window.innerWidth + 4;
    const drawer = document.getElementById('drawer');
    const drawerOpen = drawer && !drawer.classList.contains('hidden');
    const panel = document.getElementById('drawer-body');
    const panelRect = panel ? panel.getBoundingClientRect() : null;
    const foot = panel?.querySelector('.umodal-foot');
    const footGone = foot ? (foot.getBoundingClientRect().bottom > window.innerHeight + 8) : false;
    const untitledBtns = [...document.querySelectorAll('button')].filter((b) => {
      const t = (b.innerText || '').trim();
      const al = b.getAttribute('aria-label') || b.getAttribute('title') || '';
      return !t && !al && b.offsetParent;
    }).map((b) => b.outerHTML.slice(0, 180));
    const heading = document.getElementById('page-greeting')?.textContent || '';
    const sub = document.getElementById('page-subtitle')?.textContent || '';
    return {
      label,
      w: window.innerWidth,
      h: window.innerHeight,
      overflowX,
      scrollW: body.scrollWidth,
      heading,
      sub,
      drawerOpen: Boolean(drawerOpen),
      drawerClasses: drawer?.className || '',
      panelH: panelRect ? Math.round(panelRect.height) : null,
      footGone,
      untitledButtons: untitledBtns.slice(0, 12),
      hash: location.hash,
    };
  }, name);
}

const routes = [
  ['overview', '#/overview'],
  ['users', '#/users'],
  ['ai', '#/ai'],
  ['health', '#/health'],
  ['push', '#/push'],
  ['orders', '#/orders'],
  ['packages', '#/packages'],
  ['sms', '#/sms'],
  ['pharmacy', '#/pharmacy'],
  ['rewards', '#/rewards'],
  ['quality', '#/quality'],
  ['audit', '#/audit'],
  ['settings', '#/settings'],
  ['missing', '#/does-not-exist'],
];

const browser = await chromium.launch({ headless: true });
const findings = { viewports: {}, clicks: [], notes: [] };

async function runViewport(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  attach(page);
  const vp = { width, screens: [], interactions: [] };
  try {
    await login(page);
    for (const [name, hash] of routes) {
      await go(page, hash);
      const m = await measure(page, name);
      await page.screenshot({ path: path.join(OUT, `${width}-${name}.png`), fullPage: false });
      vp.screens.push(m);
    }

    await go(page, '#/push');
    for (const tab of ['brain', 'history', 'copy', 'engage', 'devices']) {
      const loc = page.locator(`[data-push-tab="${tab}"]`);
      if (await loc.count()) {
        await loc.first().click();
        await page.waitForTimeout(1600);
        vp.interactions.push({ action: `push-tab-${tab}`, ...await measure(page, `push-${tab}`) });
        await page.screenshot({ path: path.join(OUT, `${width}-push-${tab}.png`) });
      } else {
        vp.interactions.push({ action: `push-tab-${tab}`, missing: true });
      }
    }

    await go(page, '#/rewards');
    for (const tab of ['campaigns', 'partners', 'redemptions', 'codes']) {
      const loc = page.locator(`[data-rewards-sub="${tab}"]`);
      if (await loc.count()) {
        await loc.first().click();
        await page.waitForTimeout(1400);
        vp.interactions.push({ action: `rewards-${tab}`, ...await measure(page, `rw-${tab}`) });
        await page.screenshot({ path: path.join(OUT, `${width}-rewards-${tab}.png`) });
      }
    }

    const createPartner = page.locator('#rw-partner-create, #rw-partner-create-empty').first();
    if (await createPartner.count()) {
      await createPartner.click();
      await page.waitForTimeout(700);
      vp.interactions.push({ action: 'partner-create-modal', ...await measure(page, 'partner-modal') });
      await page.screenshot({ path: path.join(OUT, `${width}-partner-modal.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    const createCamp = page.locator('#rw-campaign-create, #rw-campaign-create-empty').first();
    await go(page, '#/rewards');
    const campTab = page.locator('[data-rewards-sub="campaigns"]');
    if (await campTab.count()) {
      await campTab.click();
      await page.waitForTimeout(900);
    }
    if (await createCamp.count() || await page.locator('#rw-campaign-create').count()) {
      const btn = page.locator('#rw-campaign-create, #rw-campaign-create-empty').first();
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(900);
        vp.interactions.push({ action: 'campaign-create-modal', ...await measure(page, 'camp-modal') });
        await page.screenshot({ path: path.join(OUT, `${width}-campaign-modal.png`) });
        await page.keyboard.press('Escape');
      }
    }

    await go(page, '#/users');
    const row = page.locator('#users-tbody tr, .users-table tbody tr').first();
    if (await row.count()) {
      await row.click();
      await page.waitForTimeout(2200);
      vp.interactions.push({ action: 'user-page', ...await measure(page, 'user-page') });
      await page.screenshot({ path: path.join(OUT, `${width}-user-page.png`) });
      const saveVisible = await page.locator('#user-save').isVisible().catch(() => false);
      const saveBox = await page.locator('#user-save').boundingBox().catch(() => null);
      vp.interactions.push({
        action: 'user-save-visibility',
        saveVisible,
        saveInViewport: saveBox ? saveBox.y + saveBox.height <= 900 : false,
        saveBox,
      });
      const decLink = page.locator('[data-decision-id], .inv-copy[data-copy], a[data-open-decision]').first();
      const notifTab = page.locator('[data-user-tab="notifications"]');
      if (await notifTab.count()) {
        await notifTab.click();
        await page.waitForTimeout(800);
        vp.interactions.push({ action: 'user-notifications', ...await measure(page, 'user-notif') });
      }
    }

    await go(page, '#/packages');
    const editPkg = page.locator('button:has-text("რედაქტირება")').first();
    if (await editPkg.count()) {
      await editPkg.click();
      await page.waitForTimeout(600);
      vp.interactions.push({ action: 'package-drawer', ...await measure(page, 'pkg') });
      await page.screenshot({ path: path.join(OUT, `${width}-package-drawer.png`) });
      await page.keyboard.press('Escape');
    }

    await go(page, '#/audit');
    const auditRow = page.locator('#tab-audit table tbody tr, .admin-table tbody tr').first();
    if (await auditRow.count()) {
      await auditRow.click();
      await page.waitForTimeout(500);
      vp.interactions.push({ action: 'audit-modal', ...await measure(page, 'audit') });
      await page.screenshot({ path: path.join(OUT, `${width}-audit-modal.png`) });
      await page.keyboard.press('Escape');
    }

    await page.keyboard.press('Control+K');
    await page.waitForTimeout(500);
    const palette = await page.locator('.ops-palette, #ops-palette').count();
    vp.interactions.push({ action: 'command-palette', visible: palette > 0, ...await measure(page, 'palette') });
    await page.screenshot({ path: path.join(OUT, `${width}-palette.png`) });
    await page.keyboard.press('Escape');

    await go(page, '#/quality');
    const issue = page.locator('.ops-issue, [data-href]').first();
    if (await issue.count()) {
      await issue.click();
      await page.waitForTimeout(1500);
      vp.interactions.push({ action: 'quality-issue-nav', hash: await page.evaluate(() => location.hash) });
    }
  } catch (err) {
    vp.error = String(err);
  }
  await context.close();
  findings.viewports[String(width)] = vp;
}

await runViewport(1440);
await runViewport(1280);
await runViewport(1920);

await browser.close();

const byUrl = {};
for (const r of reqs) {
  const key = `${r.method} ${r.url.replace(/https?:\/\/[^/]+/, '')}`;
  byUrl[key] = (byUrl[key] || 0) + 1;
}
const duplicates = Object.entries(byUrl).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 40);

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  pageErrors,
  consoleLogs: consoleLogs.slice(0, 80),
  failedRequests: failed,
  duplicateHeavy: duplicates,
  totalAdminRequests: reqs.length,
  findings,
};

fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  pageErrors: pageErrors.length,
  console: consoleLogs.length,
  failed: failed.length,
  requests: reqs.length,
  overflow1280: findings.viewports['1280']?.screens?.filter((s) => s.overflowX).map((s) => s.label),
  overflow1440: findings.viewports['1440']?.screens?.filter((s) => s.overflowX).map((s) => s.label),
  overflow1920: findings.viewports['1920']?.screens?.filter((s) => s.overflowX).map((s) => s.label),
  vpErrors: Object.fromEntries(Object.entries(findings.viewports).map(([k, v]) => [k, v.error || null])),
}, null, 2));
