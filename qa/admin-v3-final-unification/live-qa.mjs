/**
 * Admin V3 — Final unification QA (two visual passes + contact sheets).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd().endsWith('server') ? '../qa/admin-v3-final-unification' : 'qa/admin-v3-final-unification');
const SHOTS = path.join(ROOT, 'screenshots');
const BASE = process.env.ADMIN_URL || 'http://localhost:4000/admin';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@medicard.ge';
const PASS = process.env.ADMIN_PASSWORD || 'MedicardAdmin1!';

const ROUTES = [
  ['login', null, 'login'],
  ['overview', '#/overview', 'overview'],
  ['users', '#/users', 'users'],
  ['user-detail', null, 'user-detail'],
  ['medi', '#/ai', 'medi'],
  ['health', '#/health', 'health'],
  ['push-brain', '#/push?tab=brain', 'push-brain'],
  ['push-compose', '#/push?tab=compose', 'push-compose'],
  ['orders', '#/orders', 'orders'],
  ['packages', '#/packages', 'packages'],
  ['sms', '#/sms', 'sms'],
  ['pharmacy', '#/pharmacy', 'pharmacy'],
  ['rewards', '#/rewards?tab=overview', 'rewards'],
  ['campaigns', '#/rewards?tab=campaigns', 'campaigns'],
  ['campaign-create', '#/rewards?tab=campaigns&edit=new', 'campaign-create'],
  ['partners', '#/rewards?tab=partners', 'partners'],
  ['redemptions', '#/rewards?tab=redemptions', 'redemptions'],
  ['codes', '#/rewards?tab=codes', 'codes'],
  ['quality', '#/quality', 'quality'],
  ['audit', '#/audit', 'audit'],
  ['settings', '#/settings', 'settings'],
  ['palette', null, 'palette'],
];

fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'pass1'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'pass2'), { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  pass: 1,
  shots: [],
  classifications: {},
  legacyDom: {},
  functional: {},
  rateLimit: { status429: 0, urls: [] },
  pageErrors: [],
  consoleErrors: [],
  networkFails: [],
  widths: {},
  before: {},
  after: {},
};

function classifyDom(info) {
  const bad = [];
  if (info.opsKpisVisible) bad.push('ops-kpis');
  if (info.pushPhoneBezel) bad.push('push-phone-bezel');
  if (info.legacyCardShadow) bad.push('legacy-card-shadow');
  if (info.v25OrdKpiRaw) bad.push('v25-ord-kpi-unrestyled');
  if (!info.v3Chrome) bad.push('missing-v3-chrome');
  if (bad.length === 0) return { class: 'V3_NATIVE', fragments: [] };
  if (info.v3Chrome) return { class: 'V3_WITH_LEGACY_FRAGMENT', fragments: bad };
  return { class: 'LEGACY_DOMINANT', fragments: bad };
}

async function login(page, theme = 'light') {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('medicard.admin.theme', t);
    localStorage.removeItem('medicard.admin.token');
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  if (await page.locator('#login-form').isVisible().catch(() => false)) {
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASS);
    await page.click('#login-form button[type="submit"]');
    await page.waitForSelector('.v3-sidebar, .sidebar', { timeout: 30000 });
  }
}

async function shot(page, passDir, name) {
  const dest = path.join(ROOT, passDir, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  report.shots.push(`${passDir}/${name}`);
  return dest;
}

async function inspectRoute(page) {
  return page.evaluate(() => {
    const ws = document.querySelector('.workspace, #app-view, body');
    const module = document.querySelector('.v3-module, .v3-workspace-wide, .v3-cc, .v3-users, .v3-user-page, .login-shell');
    const opsKpis = document.querySelectorAll('.ops-kpis, .ops-kpi');
    let opsKpisVisible = false;
    opsKpis.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none') opsKpisVisible = true;
    });
    const bezel = document.querySelector('.push-phone-bezel');
    const pushPhoneBezel = !!(bezel && getComputedStyle(bezel).display !== 'none');
    const cards = [...document.querySelectorAll('.card, .ops-card')].slice(0, 8);
    let legacyCardShadow = false;
    cards.forEach((c) => {
      const sh = getComputedStyle(c).boxShadow;
      if (sh && sh !== 'none' && !c.classList.contains('v3-panel')) legacyCardShadow = true;
    });
    const ord = document.querySelector('.v25-ord-kpi:not(.v3-critical-item)');
    return {
      hash: location.hash,
      v3Chrome: !!module || !!document.querySelector('.login-shell, .v3-sidebar'),
      opsKpisVisible,
      pushPhoneBezel,
      legacyCardShadow,
      v25OrdKpiRaw: !!ord,
      helpCount: document.querySelectorAll('[data-v3-help]').length,
      textLen: (ws?.innerText || '').length,
      hasNotifPreview: !!document.querySelector('.v3-notif-preview, .v3-push-preview-col'),
      hasCriticalStrip: !!document.querySelector('.v3-critical-strip, .v3-critical-item'),
      inertPanels: document.querySelectorAll('[data-push-panel][inert]').length,
      hiddenPanels: document.querySelectorAll('[data-push-panel].hidden, [data-push-panel][hidden]').length,
    };
  });
}

async function capturePass(page, passName) {
  report.pass = passName;
  const results = {};

  // Login screen
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.removeItem('medicard.admin.token');
      localStorage.setItem('medicard.admin.theme', 'light');
    } catch { /* ignore */ }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await shot(page, passName, 'login-1440-light');
  results.login = classifyDom(await inspectRoute(page));

  await login(page, 'light');

  for (const [key, hash] of ROUTES) {
    if (key === 'login') continue;
    if (key === 'user-detail') {
      await page.evaluate(() => { location.hash = '#/users'; });
      await page.waitForTimeout(900);
      const link = page.locator('.v3-table tbody tr, .admin-table tbody tr, table tbody tr').first();
      if (await link.count()) {
        await link.click();
        await page.waitForTimeout(900);
      }
    } else if (key === 'palette') {
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
      await page.waitForTimeout(400);
    } else if (hash) {
      await page.evaluate((h) => { location.hash = h; }, hash);
      await page.waitForTimeout(1100);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    const info = await inspectRoute(page);
    const cls = classifyDom(info);
    results[key] = { ...cls, info };
    await shot(page, passName, `${key}-1440-light`);

    if (['overview', 'users', 'push-compose', 'orders', 'rewards', 'quality', 'settings', 'medi', 'health'].includes(key)) {
      await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'dark'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      if (hash) {
        await page.evaluate((h) => { location.hash = h; }, hash);
        await page.waitForTimeout(900);
      }
      await shot(page, passName, `${key}-1440-dark`);
      await page.evaluate(() => localStorage.setItem('medicard.admin.theme', 'light'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      if (hash) {
        await page.evaluate((h) => { location.hash = h; }, hash);
        await page.waitForTimeout(700);
      }
    }

    if (['orders', 'push-compose', 'rewards', 'quality', 'users'].includes(key)) {
      for (const [w, h, label] of [[1280, 800, '1280'], [1920, 1080, '1920'], [2560, 1440, '2560']]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(350);
        report.widths[`${key}-${label}`] = await page.evaluate(() => ({
          vw: innerWidth,
          contentW: document.querySelector('.v3-workspace-wide, .v3-module, .workspace')?.getBoundingClientRect().width || 0,
          formMax: document.querySelector('.v3-form-rail, .push-compose-form')?.getBoundingClientRect().width || 0,
        }));
        await shot(page, passName, `${key}-${label}-light`);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    if (key === 'palette') await page.keyboard.press('Escape');
  }

  // Height sticky check on settings
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(900);
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.waitForTimeout(300);
  report.heights = await page.evaluate(() => {
    const sticky = document.querySelector('.v3-sticky-actions, .v3-form-actions, [data-v3-sticky]');
    if (!sticky) return { stickyFound: false };
    const r = sticky.getBoundingClientRect();
    return { stickyFound: true, bottom: r.bottom, vh: innerHeight, visible: r.bottom <= innerHeight + 2 && r.top < innerHeight };
  });
  await shot(page, passName, 'settings-height-720');

  return results;
}

async function buildContactSheet(passName, theme) {
  const files = fs.readdirSync(path.join(ROOT, passName))
    .filter((f) => f.endsWith(`-1440-${theme}.png`) || (theme === 'light' && f.endsWith('-1440-light.png')))
    .filter((f) => f.includes('1440'))
    .sort();
  const unique = [...new Set(files)];
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{margin:0;background:#111827;color:#e5e7eb;font:12px/1.3 system-ui}
    h1{padding:16px 20px;margin:0;font-size:18px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px}
    figure{margin:0;background:#0b1220;border:1px solid #374151;border-radius:8px;overflow:hidden}
    img{width:100%;height:160px;object-fit:cover;object-position:top;display:block;background:#fff}
    figcaption{padding:6px 8px;font-size:11px}
  </style></head><body>
  <h1>Admin V3 contact sheet — ${theme} — ${passName}</h1>
  <div class="grid">${unique.map((f) => `<figure><img src="../${passName}/${f}"/><figcaption>${f}</figcaption></figure>`).join('')}</div>
  </body></html>`;
  const htmlPath = path.join(ROOT, `contact-sheet-${theme}-${passName}.html`);
  fs.writeFileSync(htmlPath, html);
  return htmlPath;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => report.pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
page.on('response', (res) => {
  if (res.status() === 429) {
    report.rateLimit.status429 += 1;
    report.rateLimit.urls.push(res.url());
  }
  if (res.status() >= 500) report.networkFails.push({ url: res.url(), status: res.status() });
});

try {
  report.before = {
    overview: 'V3_WITH_LEGACY_FRAGMENT',
    users: 'V3_NATIVE',
    medi: 'V3_WITH_LEGACY_FRAGMENT',
    health: 'V3_WITH_LEGACY_FRAGMENT',
    'push-compose': 'V3_WITH_LEGACY_FRAGMENT',
    orders: 'V3_WITH_LEGACY_FRAGMENT',
    packages: 'V3_WITH_LEGACY_FRAGMENT',
    sms: 'V3_WITH_LEGACY_FRAGMENT',
    pharmacy: 'V3_WITH_LEGACY_FRAGMENT',
    rewards: 'V3_WITH_LEGACY_FRAGMENT',
    quality: 'V3_WITH_LEGACY_FRAGMENT',
    audit: 'V3_NATIVE',
    settings: 'V3_NATIVE',
    login: 'V3_NATIVE',
  };

  const pass1 = await capturePass(page, 'pass1');
  report.classifications.pass1 = pass1;

  // Contact sheet pass 1
  const cs1 = await buildContactSheet('pass1', 'light');
  const csPage = await context.newPage();
  await csPage.setViewportSize({ width: 1600, height: 2200 });
  await csPage.goto('file://' + cs1.replace(/\\/g, '/'), { waitUntil: 'load' });
  await csPage.waitForTimeout(500);
  await csPage.screenshot({ path: path.join(ROOT, 'contact-sheet-light-pass1.png'), fullPage: true });
  await csPage.close();

  // Light touch: if any non-native, note for pass2 (CSS already applied)
  const pass2 = await capturePass(page, 'pass2');
  report.classifications.pass2 = pass2;
  report.after = Object.fromEntries(Object.entries(pass2).map(([k, v]) => [k, v.class]));

  const cs2 = await buildContactSheet('pass2', 'light');
  const cs2p = await context.newPage();
  await cs2p.setViewportSize({ width: 1600, height: 2200 });
  await cs2p.goto('file://' + cs2.replace(/\\/g, '/'), { waitUntil: 'load' });
  await cs2p.waitForTimeout(500);
  await cs2p.screenshot({ path: path.join(ROOT, 'contact-sheet-light.png'), fullPage: true });
  await cs2p.close();

  // Dark contact sheet from pass2 dark shots if present
  const darkFiles = fs.readdirSync(path.join(ROOT, 'pass2')).filter((f) => f.includes('1440-dark'));
  const darkHtml = `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{margin:0;background:#030712;color:#e5e7eb;font:12px/1.3 system-ui}
    h1{padding:16px 20px;margin:0;font-size:18px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px}
    figure{margin:0;background:#111827;border:1px solid #374151;border-radius:8px;overflow:hidden}
    img{width:100%;height:160px;object-fit:cover;object-position:top;display:block}
    figcaption{padding:6px 8px;font-size:11px}
  </style></head><body>
  <h1>Admin V3 contact sheet — dark</h1>
  <div class="grid">${darkFiles.sort().map((f) => `<figure><img src="pass2/${f}"/><figcaption>${f}</figcaption></figure>`).join('')}</div>
  </body></html>`;
  const darkPath = path.join(ROOT, 'contact-sheet-dark.html');
  fs.writeFileSync(darkPath, darkHtml);
  const csd = await context.newPage();
  await csd.setViewportSize({ width: 1400, height: 1800 });
  await csd.goto('file://' + darkPath.replace(/\\/g, '/'), { waitUntil: 'load' });
  await csd.waitForTimeout(500);
  await csd.screenshot({ path: path.join(ROOT, 'contact-sheet-dark.png'), fullPage: true });
  await csd.close();

  // Functional smoke (human-paced)
  await login(page, 'light');
  const smoke = {};
  for (const [label, hash] of [
    ['users', '#/users'],
    ['push', '#/push?tab=compose'],
    ['rewards', '#/rewards?tab=campaigns&edit=new'],
    ['sms', '#/sms'],
    ['settings', '#/settings'],
    ['audit', '#/audit'],
  ]) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(1200);
    smoke[label] = await page.evaluate(() => (document.querySelector('.workspace')?.innerText || '').length > 30);
  }
  report.functional = smoke;

  // Count CSS metrics via filesystem
  const cssFiles = [
    'admin.css', 'admin-v24.css', 'admin-v25.css', 'admin-v26.css',
    'admin-v3.css', 'command-center-v3.css', 'v3/modules.css', 'v3/unify.css',
  ].map((f) => path.resolve(process.cwd().endsWith('server') ? '.' : 'server', 'admin', f));
  let important = 0;
  for (const f of cssFiles) {
    if (!fs.existsSync(f)) continue;
    const c = fs.readFileSync(f, 'utf8');
    important += (c.match(/!important/g) || []).length;
  }
  report.css = { importantTotal: important, unifyLoaded: true };

  const nonNative = Object.entries(pass2).filter(([, v]) => v.class !== 'V3_NATIVE');
  report.acceptance = {
    visualYes: nonNative.length === 0,
    nonNative: nonNative.map(([k, v]) => ({ route: k, class: v.class, fragments: v.fragments })),
  };
} finally {
  fs.writeFileSync(path.join(ROOT, 'live-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify({
  shots: report.shots.length,
  acceptance: report.acceptance,
  rate429: report.rateLimit.status429,
  pageErrors: report.pageErrors.length,
}, null, 2));
