/**
 * Admin V3 Step 4 — Users + full-width + section help live QA.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(
  process.cwd().endsWith('server') ? '../qa/admin-v3-step4' : 'qa/admin-v3-step4',
);
const BASE = process.env.ADMIN_URL || 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';
fs.mkdirSync(OUT, { recursive: true });

const pageErrors = [];
const consoleLogs = [];
const networkFails = [];

function attach(page) {
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLogs.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/admin/api')) {
      networkFails.push(`${res.status()} ${res.url()}`);
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
    await page.waitForSelector('.v3-sidebar, .sidebar', { timeout: 20000 });
  }
}

async function shot(page, name, full = false) {
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: full });
  report.shots.push(name);
}

async function gotoHash(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(800);
}

async function waitOverviewReady(page) {
  await page.waitForSelector('.v3-cc-status', { timeout: 45000 });
  await page.waitForSelector('[data-v3-help]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function waitUsersReady(page) {
  await page.waitForSelector('.v3-users #users-tbody', { timeout: 30000 });
  await page.waitForFunction(() => {
    const t = document.querySelector('#users-tbody');
    return t && !t.querySelector('.users-skel') && t.children.length > 0;
  }, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function waitUserDetailReady(page) {
  await page.waitForSelector('.v3-user-summary, #user-edit-form', { timeout: 45000 });
  await page.waitForFunction(() => !document.querySelector('.user-page-loading'), { timeout: 45000 });
  await page.waitForTimeout(400);
}

const report = {
  generatedAt: new Date().toISOString(),
  shots: [],
  measures: {},
  flows: {},
  pageErrors,
  consoleLogs,
  networkFails,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
attach(page);

try {
  await login(page, 'light');

  // —— Overview width regression + help ——
  await gotoHash(page, '#/overview');
  await waitOverviewReady(page);
  report.measures.overview1440 = await page.evaluate(() => {
    const panel = document.querySelector('.workspace > .panel, .v3-cc');
    const cc = document.querySelector('.v3-cc');
    return {
      vw: window.innerWidth,
      panelW: panel?.getBoundingClientRect().width,
      ccMax: cc ? getComputedStyle(cc).maxWidth : null,
      pageMax: getComputedStyle(document.documentElement).getPropertyValue('--v3-page-max').trim(),
      overflowX: document.body.scrollWidth > window.innerWidth + 4,
      helpBtns: document.querySelectorAll('[data-v3-help]').length,
      hasAdminV3: !!window.AdminV3?.infoButton,
      hasAdminHelp: !!window.AdminHelp?.get,
    };
  });
  await shot(page, '14-section-help-overview');
  const helpBtn = page.locator('[data-v3-help="overview.today"]').first();
  if (await helpBtn.count()) {
    await helpBtn.click();
    await page.waitForTimeout(400);
    report.flows.overviewHelp = await page.locator('#v3-help-pop, .v3-dialog, [role="dialog"]').count();
    await page.keyboard.press('Escape');
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  report.measures.overview1920 = await page.evaluate(() => ({
    vw: window.innerWidth,
    panelW: document.querySelector('.workspace > .panel, .v3-cc')?.getBoundingClientRect().width,
    pageMax: getComputedStyle(document.documentElement).getPropertyValue('--v3-page-max').trim(),
  }));
  await shot(page, '15-full-width-overview-1920');

  // —— Users registry ——
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoHash(page, '#/users');
  await waitUsersReady(page);
  report.measures.users1440 = await page.evaluate(() => ({
    hasV3: !!document.querySelector('.v3-users'),
    tableW: document.querySelector('.v3-table')?.getBoundingClientRect().width,
    panelW: document.querySelector('.workspace > .panel')?.getBoundingClientRect().width,
    statusText: document.querySelector('.v3-acct, .users-live')?.textContent || '',
    chips: document.querySelectorAll('[data-status-chip], .users-filter-chips button').length,
    help: document.querySelectorAll('[data-v3-help]').length,
  }));
  await shot(page, '01-users-light-1440');

  await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'dark'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitUsersReady(page);
  await shot(page, '02-users-dark-1440');
  await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitUsersReady(page);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await gotoHash(page, '#/users');
  await waitUsersReady(page);
  report.measures.users1920 = await page.evaluate(() => ({
    vw: window.innerWidth,
    panelW: document.querySelector('.workspace > .panel')?.getBoundingClientRect().width,
    tableW: document.querySelector('.v3-table')?.getBoundingClientRect().width,
  }));
  await shot(page, '03-users-light-1920');
  await shot(page, '16-full-width-users-1920');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  report.measures.users1280 = await page.evaluate(() => ({
    overflowX: document.body.scrollWidth > window.innerWidth + 4,
    panelW: document.querySelector('.workspace > .panel')?.getBoundingClientRect().width,
  }));
  await shot(page, '04-users-light-1280');

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoHash(page, '#/users');
  await waitUsersReady(page);
  await page.selectOption('#user-activity', 'today');
  await page.waitForTimeout(1000);
  report.flows.filterHash = await page.evaluate(() => location.hash);
  await shot(page, '05-users-filtered');

  await page.fill('#user-q', '__no_such_user_zzz__');
  await page.waitForTimeout(800);
  await shot(page, '06-users-empty-filter');
  report.flows.emptyClear = await page.locator('#users-empty-clear, #user-clear-filters').count();
  await page.click('#user-clear-filters');
  await page.waitForTimeout(700);
  report.flows.clearedHash = await page.evaluate(() => location.hash);

  // Help on users
  const usersHelp = page.locator('[data-v3-help="users.registry"]').first();
  if (await usersHelp.count()) {
    await usersHelp.click();
    await page.waitForTimeout(350);
    await shot(page, '13-section-help-users');
    await page.keyboard.press('Escape');
  }

  // Open first user
  const firstRow = page.locator('#users-tbody tr[data-id]').first();
  let userId = null;
  if (await firstRow.count()) {
    userId = await firstRow.getAttribute('data-id');
    await firstRow.click();
    await waitUserDetailReady(page);
    await shot(page, '07-user-detail-light');

    await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitUserDetailReady(page);
    await shot(page, '08-user-detail-dark');
    await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitUserDetailReady(page);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await shot(page, '09-user-detail-1920');

    // Telemetry empty / notifications
    const notifTab = page.locator('[data-user-tab="notifications"]');
    if (await notifTab.count()) {
      await notifTab.click();
      await page.waitForTimeout(500);
      report.flows.notifTabHash = await page.evaluate(() => location.hash);
    }
    await shot(page, '10-user-telemetry-empty', true);

    // Sticky save + dirty
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-user-tab="overview"]').click().catch(() => {});
    const note = page.locator('#edit-note');
    if (await note.count()) {
      await note.fill(`qa-step4 ${Date.now()}`);
      await page.waitForTimeout(200);
      report.flows.dirty = await page.evaluate(() => !!window.AdminV3?.dirty);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, '11-user-sticky-save');

    // Delete confirm (cancel)
    const del = page.locator('#user-del');
    if (await del.count()) {
      await del.click();
      await page.waitForTimeout(400);
      await shot(page, '12-user-delete-confirm');
      const cancel = page.locator('.v3-confirm [data-v3-confirm-cancel], #v3-confirm-cancel, .v3-dialog .btn.ghost, button:has-text("გაუქმება")').first();
      if (await cancel.count()) await cancel.click();
      else await page.keyboard.press('Escape');
    }

    // Decision inspector if any decision link
    const decision = page.locator('[data-decision], [data-open-decision], button[data-id]').first();
    if (await decision.count()) {
      await decision.click().catch(() => {});
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    // Back / forward
    await page.goBack();
    await page.waitForTimeout(600);
    report.flows.backHash = await page.evaluate(() => location.hash);
    await page.goForward();
    await page.waitForTimeout(600);
    report.flows.forwardHash = await page.evaluate(() => location.hash);
  } else {
    report.flows.noUsers = true;
  }

  // Regression smoke
  for (const hash of ['#/push', '#/rewards', '#/quality']) {
    await gotoHash(page, hash);
    await page.waitForTimeout(900);
    report.flows[`smoke_${hash}`] = await page.evaluate(() => ({
      hash: location.hash,
      hasError: !!document.querySelector('.error-boundary, .fatal'),
      textLen: (document.querySelector('.workspace')?.innerText || '').length,
    }));
  }
} catch (err) {
  report.fatal = String(err?.stack || err);
} finally {
  fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify({
  out: OUT,
  shots: report.shots.length,
  fatal: report.fatal || null,
  measures: report.measures,
  flows: report.flows,
  pageErrors: pageErrors.slice(0, 8),
  consoleLogs: consoleLogs.slice(0, 8),
  networkFails: networkFails.slice(0, 8),
}, null, 2));
