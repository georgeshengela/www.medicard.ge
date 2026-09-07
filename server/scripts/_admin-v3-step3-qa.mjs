/**
 * Admin V3 Step 3 — Command Center live QA.
 * Does not mutate production settings.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(
  process.cwd().endsWith('server') ? '../qa/admin-v3-step3' : 'qa/admin-v3-step3',
);
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
    if (req.url().includes('/api/admin')) {
      reqs.push({ method: req.method(), url: req.url(), t: Date.now() });
    }
  });
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/admin') && res.status() >= 400) {
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
  await page.waitForSelector('.v3-cc-status, #tab-overview .v3-error, #tab-overview .v25-overview', { timeout: 30000 }).catch(() => {});
}

async function goOverview(page, extra = '') {
  await page.evaluate((next) => { location.hash = next; }, `#/overview${extra}`);
  await page.waitForSelector('.v3-cc-status, #ops-today .v3-cc-strip, #ops-today .v3-error', { timeout: 30000 });
  await page.waitForTimeout(400);
}

async function inspect(page) {
  return page.evaluate(() => {
    const fold = window.innerHeight;
    const status = document.querySelector('.v3-cc-status');
    const attention = document.getElementById('ops-attention');
    const today = document.getElementById('ops-today');
    const below = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), inFold: r.bottom <= fold + 8 };
    };
    const pct = [...document.querySelectorAll('.v3-cc-signal em')].map((el) => el.textContent.trim());
    const over100 = pct.some((t) => {
      const n = parseFloat(t);
      return Number.isFinite(n) && n > 100;
    });
    return {
      w: window.innerWidth,
      h: window.innerHeight,
      theme: document.documentElement.dataset.theme,
      hash: location.hash,
      heading: document.getElementById('page-greeting')?.textContent || '',
      purpose: document.getElementById('page-subtitle')?.textContent || '',
      overflowX: document.body.scrollWidth > window.innerWidth + 4,
      scrollW: document.body.scrollWidth,
      statusClass: status?.className || '',
      statusText: status?.innerText?.replace(/\s+/g, ' ').trim() || '',
      attentionText: attention?.innerText?.replace(/\s+/g, ' ').slice(0, 400) || '',
      todayText: today?.innerText?.replace(/\s+/g, ' ').slice(0, 280) || '',
      hasActiveToday: /აქტიური დღეს/.test(document.body.innerText),
      hasScheduled: /დაგეგმილი/.test(document.body.innerText),
      hasSentLie: /\bგაგზავნილი\b/.test(document.body.innerText),
      hasIntegrity: /მთლიანობა|integrity/i.test(document.body.innerText),
      fold: {
        status: below(status),
        attention: below(attention),
        today: below(today),
      },
      featurePct: pct,
      featureOver100: over100,
      cc: Boolean(document.querySelector('.v3-cc')),
      refresh: Boolean(document.getElementById('ops-refresh')),
    };
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  shots: [],
  routes: {},
  live: {},
  notes: [],
};

const browser = await chromium.launch({ headless: true });

async function shot(page, name) {
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: true });
  report.shots.push(name);
}

const light = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await light.newPage();
attach(page);
await login(page, 'light');
const loadReqsBefore = reqs.length;
await goOverview(page, '?range=30d');
await page.waitForTimeout(1200);
const firstLoadReqs = reqs.slice(loadReqsBefore).map((r) => r.url.replace(/https?:\/\/[^/]+/, '').replace(/\?.*$/, ''));
const firstGetCount = firstLoadReqs.filter((u) => u.startsWith('/api/admin/analytics') || u === '/api/admin/system/health').length;
report.live.firstLoadGets = firstGetCount;
report.live.firstLoadPaths = [...new Set(firstLoadReqs)];
report.live.inspect1440 = await inspect(page);
await shot(page, '02-overview-light-1440');
await page.locator('.v3-cc-status').screenshot({ path: path.join(OUT, '06-status-attention.png') }).catch(() => {});
await page.locator('#ops-attention').screenshot({ path: path.join(OUT, '07-attention-list.png') }).catch(() => {});
await page.locator('#ops-today').screenshot({ path: path.join(OUT, '08-today.png') }).catch(() => {});
await page.locator('#ops-notif').screenshot({ path: path.join(OUT, '09-brain-summary.png') }).catch(() => {});
await page.locator('#ops-activity').screenshot({ path: path.join(OUT, '10-activity.png') }).catch(() => {});
await page.locator('#ops-retention').screenshot({ path: path.join(OUT, '11-retention.png') }).catch(() => {});

await page.evaluate(() => {
  const host = document.getElementById('ops-status');
  if (!host) return;
  host.innerHTML = `
    <section class="v3-cc-status is-healthy" aria-label="საოპერაციო მდგომარეობა">
      <div class="v3-cc-status-main">
        <span class="v3-badge is-ok">გამართული</span>
        <div>
          <h3>გამართული</h3>
          <p>კრიტიკული წარმოების პრობლემა არ ჩანს.</p>
        </div>
      </div>
    </section>`;
});
await page.locator('.v3-cc-status').screenshot({ path: path.join(OUT, '05-status-healthy.png') });
await goOverview(page, '?range=30d');

await page.evaluate(() => {
  const host = document.getElementById('ops-notif');
  if (!host) return;
  host.innerHTML = `<section class="v3-section"><div class="v3-section-head"><div><h3>შეტყობინებები</h3></div></div><div class="v3-section-body"><div class="v3-error" role="alert"><strong>Brain შეჯამება ვერ ჩაიტვირთა</strong><p>network</p><button type="button" class="btn secondary compact">ხელახლა ცდა</button></div></div></section>`;
});
await page.locator('#ops-notif').screenshot({ path: path.join(OUT, '12-partial-error.png') });
await page.evaluate(() => location.hash = '#/overview?range=30d&grain=wau');
await page.waitForTimeout(800);
report.live.grainHash = await page.evaluate(() => location.hash);

for (const [name, hash] of [
  ['users', '#/users'],
  ['push', '#/push'],
  ['rewards', '#/rewards'],
  ['health', '#/health'],
  ['quality', '#/quality'],
]) {
  await page.evaluate((next) => { location.hash = next; }, hash);
  await page.waitForTimeout(1200);
  report.routes[name] = await page.evaluate(() => ({
    hash: location.hash,
    heading: document.getElementById('page-greeting')?.textContent || '',
    hasError: Boolean(document.querySelector(`#tab-${location.hash.replace(/^#\//, '').split('?')[0]} .v3-error, #tab-${location.hash.replace(/^#\//, '').split('?')[0]} .ops-error`)),
    hidden: document.getElementById(`tab-${location.hash.replace(/^#\//, '').split('?')[0]}`)?.classList.contains('hidden') ?? null,
  }));
}

await page.setViewportSize({ width: 1280, height: 900 });
await goOverview(page, '?range=30d');
report.live.inspect1280 = await inspect(page);
await shot(page, '01-overview-light-1280');

await page.setViewportSize({ width: 1920, height: 900 });
await goOverview(page, '?range=30d');
report.live.inspect1920 = await inspect(page);
await shot(page, '03-overview-light-1920');

await light.close();

const dark = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dark.newPage();
attach(dpage);
await login(dpage, 'dark');
await goOverview(dpage, '?range=30d');
report.live.inspectDark1440 = await inspect(dpage);
await shot(dpage, '04-overview-dark-1440');
await dark.close();

await browser.close();

report.pageErrors = pageErrors;
report.consoleLogs = consoleLogs.slice(0, 60);
report.failedRequests = failed;
report.totalAdminRequests = reqs.length;

fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  pageErrors: pageErrors.length,
  console: consoleLogs.length,
  failed: failed.length,
  firstLoadGets: report.live.firstLoadGets,
  grainHash: report.live.grainHash,
  fold1280: report.live.inspect1280?.fold,
  overflow: {
    1280: report.live.inspect1280?.overflowX,
    1440: report.live.inspect1440?.overflowX,
    1920: report.live.inspect1920?.overflowX,
  },
  status: report.live.inspect1440?.statusClass,
  hasActiveToday: report.live.inspect1440?.hasActiveToday,
  hasScheduled: report.live.inspect1440?.hasScheduled,
  hasSentLie: report.live.inspect1440?.hasSentLie,
  featureOver100: report.live.inspect1440?.featureOver100,
  featurePct: report.live.inspect1440?.featurePct,
  routes: report.routes,
  shots: report.shots,
}, null, 2));
