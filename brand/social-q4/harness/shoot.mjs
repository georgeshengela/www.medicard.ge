#!/usr/bin/env node
// Render a MEDICARD web route signed in against the mock API and screenshot it.
//
//   node shoot.mjs --path /home --out home [--persona women] [--layout women] [--onboarding tail]
//                  [--theme light|dark] [--lang ka|en] [--wait 6000] [--no-reset] [--no-full]
//                  [--time HH:MM] [--cold] [--scroll "text"] [--click "text"] [--clickWait 2000] [--keep-toast]
//
// Writes shots/<out>.png (390×844 viewport), shots/<out>-full.png (whole scroll content)
// and shots/<out>.log.json (console errors/warnings, page errors, failed + foreign requests).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/User/Desktop/www.medicard/server/package.json');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const WEB = process.env.WEB_URL || 'http://localhost:8085';
const API = process.env.MOCK_URL || 'http://localhost:4499';
// Git Bash rewrites '/home' into 'C:/Program Files/Git/home': undo that, and accept 'home' too.
const rawPath = String(args.path || '/home').replace(/^[A-Za-z]:\/.*?\/Git(?=\/)/, '');
const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
const out = args.out || path.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root';
const waitMs = Number(args.wait || 6000);
const TOKEN = 'mock-token-0123456789abcdefghijkl';
mkdirSync(join(here, 'shots'), { recursive: true });

let mockToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());
if (!args['no-reset']) {
  const q = new URLSearchParams();
  if (args.persona) q.set('persona', args.persona);
  if (args.layout) q.set('layout', args.layout);
  if (args.onboarding) q.set('onboarding', args.onboarding);
  const r = await fetch(`${API}/__reset?${q}`, { method: 'POST' });
  const body = await r.json();
  if (body.today) mockToday = body.today;
  console.log('reset', r.status, JSON.stringify(body));
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: Number(args.width || 390), height: 844 }, deviceScaleFactor: 2, locale: 'ka-GE', timezoneId: 'Asia/Tbilisi' });
await context.addInitScript(
  ({ token, theme, lang }) => {
    try {
      localStorage.setItem('medicard.auth.token', token);
      localStorage.setItem('medicard.theme.preference', theme);
      localStorage.setItem('medicard.language', lang);
    } catch {}
  },
  { token: TOKEN, theme: args.theme || 'light', lang: args.lang || 'ka' },
);
if (args.time) {
  // --time HH:MM: browser clock starts at that Tbilisi wall time on the mock's "today" and then runs
  // naturally (e.g. 13:30 shows the planned dinner, which the app hides after 21:00 local time).
  await context.clock.install({ time: new Date(`${mockToday}T${args.time}:00+04:00`) });
}
// Safety net: nothing may reach the real API.
await context.route(/medicard\.ge/, (route) => {
  console.log('BLOCKED real-API request', route.request().url());
  return route.abort();
});

const log = { path, consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [], foreignRequests: [], apiCalls: [] };
const page = await context.newPage();
page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error') log.consoleErrors.push(text);
  else if (msg.type() === 'warning') log.consoleWarnings.push(text);
});
page.on('pageerror', (err) => log.pageErrors.push(`${err.name}: ${err.message}\n${(err.stack || '').split('\n').slice(0, 8).join('\n')}`));
page.on('requestfailed', (req) => log.failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText}`));
page.on('response', (res) => {
  const url = res.url();
  if (url.startsWith(API)) log.apiCalls.push(`${res.status()} ${res.request().method()} ${url.slice(API.length)}`);
});
page.on('request', (req) => {
  const url = req.url();
  if (!url.startsWith(WEB) && !url.startsWith(API) && !url.startsWith('data:') && !url.startsWith('blob:')) log.foreignRequests.push(`${req.method()} ${url}`);
});

await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
await page.waitForTimeout(waitMs);
if (!args.cold) {
  // Warm start (default): the first visit is a fresh device — accountSync copies dose logs, MEDIRUN
  // walks, weight/steps goals and water logs from /api/account/app-state into localStorage ~1 s after
  // sign-in, after Home already read them. Reload once so the shot shows a returning user's device.
  // --cold keeps the first-visit frame instead.
  log.coldPageErrors = log.pageErrors.length;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(waitMs);
}
log.finalUrl = page.url();
if (args.scroll) {
  // Scroll the RN-web ScrollView until the given text is visible (e.g. --scroll "პარამეტრები").
  await page.getByText(String(args.scroll)).first().scrollIntoViewIfNeeded().catch((e) => console.log('scroll failed', e.message));
  await page.waitForTimeout(800);
}
if (args.click) {
  // Click the first element with this text (e.g. --click "მთავარი გვერდი") and let the sheet settle.
  await page.getByText(String(args.click)).first().click().catch((e) => console.log('click failed', e.message));
  await page.waitForTimeout(Number(args.clickWait || 2000));
}

// Expo's dev error toast (div#error-toast, shadow DOM) sits over the tab bar. Record its text in the
// log, then hide it for the screenshot unless --keep-toast. A toast means a console.error happened.
log.devErrorToast = await page.evaluate((keep) => {
  const host = document.getElementById('error-toast');
  const root = host?.shadowRoot || host;
  const msg = root?.querySelector?.('[class*="_message"]')?.textContent?.trim();
  const count = root?.querySelector?.('[class*="_countText"]')?.textContent?.trim();
  const text = msg ? `${count ? `${count}× ` : ''}${msg}` : null;
  if (host && !keep) host.style.display = 'none';
  return text;
}, Boolean(args['keep-toast']));
if (log.devErrorToast) console.log('DEV ERROR TOAST:', log.devErrorToast.slice(0, 200));

const shot = join(here, 'shots', `${out}.png`);
await page.screenshot({ path: shot });
console.log('viewport shot', shot, 'url', page.url());

if (!args['no-full']) {
  // RN-web scrolls inside a ScrollView div, not the document: grow the viewport to its content.
  const height = await page.evaluate(() => {
    let best = 0;
    for (const el of document.querySelectorAll('div')) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 300) {
        best = Math.max(best, el.scrollHeight);
      }
    }
    return best;
  });
  if (height > 844) {
    await page.setViewportSize({ width: Number(args.width || 390), height: Math.min(height + 40, 16000) });
    await page.waitForTimeout(1500);
  }
  const full = join(here, 'shots', `${out}-full.png`);
  await page.screenshot({ path: full, fullPage: true });
  console.log('full shot', full, 'contentHeight', height);
}

writeFileSync(join(here, 'shots', `${out}.log.json`), JSON.stringify(log, null, 2));
console.log(`console errors: ${log.consoleErrors.length}, page errors: ${log.pageErrors.length}, failed: ${log.failedRequests.length}, foreign: ${log.foreignRequests.length}`);
for (const e of log.pageErrors) console.log('PAGEERROR', e);
for (const e of log.consoleErrors.slice(0, 30)) console.log('CONSOLE', e.slice(0, 400));
await browser.close();
