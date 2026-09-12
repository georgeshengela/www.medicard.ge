/**
 * Admin V3 Step 3.1 — Command Center visual QA.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(
  process.cwd().endsWith('server') ? '../qa/admin-v3-step3.1' : 'qa/admin-v3-step3.1',
);
const BASE = process.env.ADMIN_URL || 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';
fs.mkdirSync(OUT, { recursive: true });

const pageErrors = [];
const consoleLogs = [];

function attach(page) {
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLogs.push(msg.text());
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
  await page.waitForSelector('.v3-cc-status, .v3-cc-skel-status', { timeout: 30000 });
  await page.waitForSelector('.v3-cc-status', { timeout: 30000 });
}

async function styles(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const cs = getComputedStyle(el);
      return {
        sel,
        className: el.className,
        display: cs.display,
        padding: cs.padding,
        borderRadius: cs.borderRadius,
        background: cs.backgroundColor,
        borderTopWidth: cs.borderTopWidth,
        borderTopColor: cs.borderTopColor,
        fontSize: cs.fontSize,
        color: cs.color,
        maxWidth: cs.maxWidth,
        minHeight: cs.minHeight,
        gap: cs.gap,
      };
    };
    return {
      theme: document.documentElement.dataset.theme,
      hash: location.hash,
      overflowX: document.body.scrollWidth > window.innerWidth + 4,
      scrollW: document.body.scrollWidth,
      w: window.innerWidth,
      h: window.innerHeight,
      fold: {
        status: document.querySelector('.v3-cc-status')?.getBoundingClientRect().bottom,
        attention: document.getElementById('ops-attention')?.getBoundingClientRect().bottom,
        today: document.getElementById('ops-today')?.getBoundingClientRect().bottom,
        brain: document.getElementById('ops-notif')?.getBoundingClientRect().top,
      },
      computed: {
        header: pick('.v3-page-header'),
        status: pick('.v3-cc-status'),
        attention: pick('.v3-cc-alert'),
        metric: pick('.v3-cc-metric'),
        chart: pick('.v3-cc-plot'),
        section: pick('#ops-today .v3-section'),
        button: pick('.v3-cc .btn'),
        filter: pick('.v3-cc .v3-filterbar, .v3-cc .ops-range'),
      },
    };
  });
}

const http = await fetch(`${BASE.replace(/\/admin\/?$/, '')}/admin/admin-v3.css?v=v3.3`);
const ccCss = await fetch(`${BASE.replace(/\/admin\/?$/, '')}/admin/command-center-v3.css?v=v3.32`);
const cssHttp = {
  v3: { status: http.status, type: http.headers.get('content-type'), len: Number(http.headers.get('content-length') || (await http.clone().text()).length) },
  cc: { status: ccCss.status, type: ccCss.headers.get('content-type'), len: Number(ccCss.headers.get('content-length') || (await ccCss.clone().text()).length) },
  hasNamespace: (await ccCss.text()).includes('.v3-cc {'),
};

const report = { generatedAt: new Date().toISOString(), cssHttp, shots: [], computed: {}, fold: {}, cache: {}, pageErrors, consoleLogs };
const browser = await chromium.launch({ headless: true });

async function shot(page, name, opts = {}) {
  const dest = path.join(OUT, `${name}.png`);
  if (opts.clip) {
    await page.screenshot({ path: dest, clip: opts.clip });
  } else {
    await page.screenshot({ path: dest, fullPage: Boolean(opts.full) });
  }
  report.shots.push(name);
}

async function clipBetween(page, startSel, endSel) {
  return page.evaluate((ids) => {
    const a = document.querySelector(ids[0])?.getBoundingClientRect();
    const b = document.querySelector(ids[1])?.getBoundingClientRect();
    if (!a) return null;
    const right = Math.max(a.right, b?.right || a.right);
    const bottom = Math.max(a.bottom, b?.bottom || a.bottom);
    return {
      x: Math.max(0, a.left - 8),
      y: Math.max(0, a.top - 8),
      width: Math.min(window.innerWidth, right - a.left + 16),
      height: bottom - a.top + 16,
    };
  }, [startSel, endSel]);
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
attach(page);
await login(page, 'light');
report.computed.light1440 = await styles(page);
report.fold.light1440 = report.computed.light1440.fold;
await shot(page, '01-light-1440-above-fold');
await shot(page, '02-light-1440-full', { full: true });
const attClip = await clipBetween(page, '#ops-status', '#ops-attention');
if (attClip) await shot(page, '08-attention', { clip: attClip });
await page.locator('#ops-notif').screenshot({ path: path.join(OUT, '12-brain-summary.png') });
report.shots.push('12-brain-summary');
await page.locator('#ops-activity').screenshot({ path: path.join(OUT, '13-activity.png') });
report.shots.push('13-activity');
await page.locator('.v3-cc-split').nth(1).screenshot({ path: path.join(OUT, '14-retention-product-signals.png') });
report.shots.push('14-retention-product-signals');
await page.locator('.v3-cc-toolbar').screenshot({ path: path.join(OUT, '15-filter-toolbar.png') });
report.shots.push('15-filter-toolbar');

await page.evaluate(() => {
  document.getElementById('ops-status').innerHTML = `
    <section class="v3-cc-status is-healthy" aria-label="საოპერაციო მდგომარეობა">
      <div class="v3-cc-status-main"><span class="v3-cc-status-mark"></span><div><h3>გამართული</h3><p>კრიტიკული წარმოების პრობლემა არ ჩანს.</p></div></div>
      <div class="v3-cc-sys"><span class="v3-cc-chip">API</span><span class="v3-cc-chip">ბაზა</span></div>
    </section>`;
  document.getElementById('ops-attention').innerHTML = `<section class="v3-section"><div class="v3-section-head"><div><h3>საჭიროებს ყურადღებას</h3></div></div><div class="v3-section-body"><p class="v3-cc-healthy">ქმედებას საჭირო სიგნალი არ არის.</p></div></section>`;
});
const healthyClip = await clipBetween(page, '#ops-status', '#ops-attention');
if (healthyClip) await shot(page, '09-healthy', { clip: healthyClip });

await page.evaluate(() => {
  document.getElementById('ops-notif').innerHTML = `<section class="v3-section"><div class="v3-section-head"><div><h3>შეტყობინებები</h3></div></div><div class="v3-section-body"><div class="v3-error" role="alert"><strong>Brain შეჯამება ვერ ჩაიტვირთა</strong><p>network</p><button type="button" class="btn secondary compact">ხელახლა ცდა</button></div></div></section>`;
});
await page.locator('#ops-notif').screenshot({ path: path.join(OUT, '11-partial-error.png') });
report.shots.push('11-partial-error');

await page.evaluate(() => { location.hash = '#/overview'; });
await page.waitForTimeout(200);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.v3-cc-skel-status, .v3-cc-status', { timeout: 15000 });
if (await page.locator('.v3-cc-skel-status').count()) {
  await shot(page, '10-loading');
}
await page.waitForSelector('.v3-cc-status', { timeout: 30000 });

await page.setViewportSize({ width: 1440, height: 768 });
await page.waitForTimeout(300);
report.fold.h768 = await page.evaluate(() => ({
  today: document.getElementById('ops-today')?.getBoundingClientRect().bottom,
  h: window.innerHeight,
}));
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(400);
report.computed.light1280 = await styles(page);
await shot(page, '05-light-1280', { full: true });

await page.setViewportSize({ width: 1920, height: 900 });
await page.waitForTimeout(400);
report.computed.light1920 = await styles(page);
await shot(page, '07-light-1920', { full: true });

await page.evaluate(() => {
  const links = [...document.styleSheets].map((s) => s.href).filter(Boolean);
  return links;
}).then((links) => { report.stylesheets = links; });

await ctx.close();

const dark = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dark.newPage();
attach(dpage);
await login(dpage, 'dark');
report.computed.dark1440 = await styles(dpage);
await shot(dpage, '03-dark-1440-above-fold');
await shot(dpage, '04-dark-1440-full', { full: true });
await dpage.setViewportSize({ width: 1280, height: 900 });
await dpage.waitForTimeout(400);
await shot(dpage, '06-dark-1280', { full: true });
await dark.close();

const cacheCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const cpage = await cacheCtx.newPage();
attach(cpage);
await login(cpage, 'light');
const a = await cpage.locator('.v3-cc-status').evaluate((el) => getComputedStyle(el).borderRadius);
await cpage.reload({ waitUntil: 'domcontentloaded' });
await cpage.waitForSelector('.v3-cc-status', { timeout: 30000 });
const b = await cpage.locator('.v3-cc-status').evaluate((el) => getComputedStyle(el).borderRadius);
report.cache = { firstRadius: a, reloadRadius: b, same: a === b };
await cacheCtx.close();

await browser.close();
fs.writeFileSync(path.join(OUT, 'live-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  cssHttp,
  pageErrors: pageErrors.length,
  console: consoleLogs.length,
  overflow: {
    1440: report.computed.light1440?.overflowX,
    1280: report.computed.light1280?.overflowX,
    1920: report.computed.light1920?.overflowX,
  },
  fold1440: report.fold.light1440,
  fold768: report.fold.h768,
  status: report.computed.light1440?.computed?.status,
  filter: report.computed.light1440?.computed?.filter,
  chart: report.computed.light1440?.computed?.chart,
  cache: report.cache,
  shots: report.shots,
}, null, 2));
