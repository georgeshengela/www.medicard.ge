#!/usr/bin/env node
// Poster screenshots of the MEDICARD app (react-native-web) against the local mock API.
//   node snap.mjs run-hub run-wallet      shoot these (names from shots.mjs)
//   node snap.mjs --all | --list | --group run
// Output: ../screens/<name>.png (390×797 @3x = 1170×2391) and ../out/<name>-full.png (grown to the scroll content).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS } from './shots.mjs';

const require = createRequire('C:/Users/User/Desktop/www.medicard/server/package.json');
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'screens'); // PNGs; posters read screens/<name>.webp (convert after a re-shoot)
const LOGS = join(here, 'logs');
mkdirSync(OUT, { recursive: true });
mkdirSync(LOGS, { recursive: true });
const WEB = process.env.WEB_URL || 'http://localhost:8097';
const API = process.env.MOCK_URL || 'http://localhost:4519';
const TOKEN = 'mock-token-0123456789abcdefghijkl';
const W = 390, H = 797, DPR = 3, MAX_FULL = 6000;
const DEFAULT_AT = '2026-10-05T10:15';

const argv = process.argv.slice(2);
if (argv.includes('--list')) {
  for (const s of SHOTS) console.log(`${s.name.padEnd(22)} ${s.route}`);
  process.exit(0);
}
let names = argv.filter((a) => !a.startsWith('--'));
if (argv.includes('--all')) names = SHOTS.map((s) => s.name);
const gi = argv.indexOf('--group');
if (gi >= 0) names = SHOTS.filter((s) => s.name.startsWith(argv[gi + 1])).map((s) => s.name);
const keepOpen = argv.includes('--debug');

// The shipping client blocks /wallet and /leaderboard?…&board= (components/medipulsi/bridgePolicy.ts allowedApi),
// so the hub wallet and the leaderboard panel show an error against any server. Patch the served bundle only.
const POLICY_FROM = '|drops|leaderboard(?:\\?period=(week|season))?)$/';
const POLICY_TO = '|drops|wallet|leaderboard(?:\\?period=(week|season)(?:&board=(boxes|meters))?)?)$/';
let bundleCache = null;

async function shoot(spec, browser) {
  const s = { persona: 'man', layout: 'standard', theme: 'light', at: DEFAULT_AT, wait: 5000, full: true, reduced: true, warm: true, patchPolicy: false, ...spec };
  const log = { name: s.name, route: s.route, consoleErrors: [], pageErrors: [], failed: [], foreign: [], api: [], notes: [] };
  const atIso = `${s.at}:00+04:00`;
  const q = new URLSearchParams({ persona: s.persona, layout: s.layout || '', now: atIso });
  if (s.onboarding) q.set('onboarding', s.onboarding);
  const reset = await (await fetch(`${API}/__reset?${q}`, { method: 'POST' })).json();
  if (s.prepare) await s.prepare({ api: API, fetch });
  // A returning device: pre-seed what accountSync / hydration keep in localStorage (doses, walks, water logs …).
  let storage = { ...(s.storage || {}) };
  if (s.seedLocal !== false && !s.signedOut) {
    const seed = await (await fetch(`${API}/__health/local-seed`)).json().catch(() => null);
    if (seed?.keys) storage = { ...Object.fromEntries(Object.entries(seed.keys).filter(([, v]) => v !== '')), ...storage };
  }
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: DPR,
    locale: 'ka-GE',
    timezoneId: 'Asia/Tbilisi',
    reducedMotion: s.reduced ? 'reduce' : 'no-preference',
    colorScheme: s.theme === 'dark' ? 'dark' : 'light',
    geolocation: s.geo || { latitude: 41.7119, longitude: 44.7531, accuracy: 8 },
    permissions: s.permissions || [],
  });
  if (!s.noIntlPolyfill) await context.addInitScript({ path: join(here, 'intl-ka.js') });
  await context.addInitScript(
    ({ token, theme, signedOut, extra }) => {
      try {
        if (!signedOut) localStorage.setItem('medicard.auth.token', token);
        localStorage.setItem('medicard.theme.preference', theme);
        localStorage.setItem('medicard.language', 'ka');
        for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v);
      } catch {}
    },
    { token: TOKEN, theme: s.theme, signedOut: Boolean(s.signedOut), extra: storage },
  );
  await context.clock.install({ time: new Date(atIso) });
  // Lowest priority (registered first): any other outside host is never contacted (pharmacy favicons, fonts CDNs …).
  await context.route((url) => !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname), (route) => { log.foreign.push(`BLOCKED ${route.request().url().slice(0, 120)}`); return route.abort(); });
  // Nothing reaches medicard.ge: store prize renders (https://medicard.ge/rewards/*.webp, the real imageUrl) are
  // answered from the repo's server/public/rewards; everything else is aborted.
  await context.route(/medicard\.ge/, async (route) => {
    const u = new URL(route.request().url());
    const m = /^\/rewards\/([a-z0-9-]+\.webp)$/.exec(u.pathname);
    if (m && existsSync(`C:/Users/User/Desktop/www.medicard/server/public/rewards/${m[1]}`)) {
      return route.fulfill({ status: 200, contentType: 'image/webp', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(`C:/Users/User/Desktop/www.medicard/server/public/rewards/${m[1]}`) });
    }
    log.foreign.push(`BLOCKED ${route.request().url()}`);
    return route.abort();
  });
  // Third-party map tiles use the owner's Mapbox token: never fetched (the run screens fall back to their plain state).
  if (!s.allowMapbox) await context.route(/mapbox\.com/, (route) => { log.notes.push('mapbox blocked'); return route.abort(); });
  await context.route(/open-meteo\.com\//, async (route) => {
    const u = new URL(route.request().url());
    const kind = u.hostname.startsWith('air-quality') ? 'air-quality' : 'forecast';
    const r = await fetch(`${API}/__ext/open-meteo/${kind}${u.search}`);
    await route.fulfill({ status: r.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: await r.text() });
  });
  if (s.patchPolicy) {
    await context.route(/\.bundle(\?|$)/, async (route) => {
      try {
        if (!bundleCache || bundleCache.url !== route.request().url()) {
          const resp = await route.fetch();
          let body = await resp.text();
          const hit = body.includes(POLICY_FROM);
          body = body.split(POLICY_FROM).join(POLICY_TO);
          bundleCache = { url: route.request().url(), body, headers: resp.headers(), status: resp.status(), hit };
        }
        log.notes.push(`policy patch ${bundleCache.hit ? 'applied' : 'NOT FOUND'}`);
        await route.fulfill({ status: bundleCache.status, headers: { ...bundleCache.headers, 'content-length': undefined }, body: bundleCache.body });
      } catch (e) {
        log.notes.push(`bundle route failed ${e.message}`);
        await route.continue();
      }
    });
  }
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 500)); });
  page.on('pageerror', (e) => log.pageErrors.push(`${e.name}: ${e.message}`));
  page.on('requestfailed', (r) => log.failed.push(`${r.method()} ${r.url().slice(0, 160)} ${r.failure()?.errorText}`));
  page.on('response', (r) => { const u = r.url(); if (u.startsWith(API)) log.api.push(`${r.status()} ${r.request().method()} ${u.slice(API.length, API.length + 140)}`); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(WEB) && !u.startsWith(API) && !/^(data|blob):/.test(u) && !/medicard\.ge\/rewards\//.test(u)) log.foreign.push(`${r.method()} ${u.slice(0, 160)}`); });

  const go = async (route) => {
    await page.goto(`${WEB}${route}`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(s.wait);
  };
  await go(s.warmRoute || s.route);
  if (s.warm) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 240_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(s.wait);
  }
  if (s.warmRoute && s.warmRoute !== s.route) await go(s.route);

  const h = helpers(page, log);
  if (s.steps) await s.steps(page, h);
  await h.hideToast();
  log.toast = h.toastText;
  log.finalUrl = page.url();
  const file = join(OUT, `${s.name}.png`);
  await page.screenshot({ path: file });
  if (s.full) {
    const height = await page.evaluate(() => {
      let best = 0;
      for (const el of document.querySelectorAll('div')) {
        const cs = getComputedStyle(el);
        if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 300) best = Math.max(best, el.scrollHeight);
      }
      return best;
    });
    if (height > H) {
      await page.setViewportSize({ width: W, height: Math.min(height + (s.fullPad ?? 0), MAX_FULL) });
      await page.waitForTimeout(1500);
      if (s.afterGrow) await s.afterGrow(page, h);
      await h.hideToast();
      await page.screenshot({ path: join(OUT, `${s.name}-full.png`) });
      log.fullHeight = Math.min(height, MAX_FULL);
    } else log.fullHeight = 0;
  }
  log.unmocked = await (await fetch(`${API}/__unmocked`)).json();
  writeFileSync(join(LOGS, `${s.name}.json`), JSON.stringify(log, null, 2));
  const um = Object.keys(log.unmocked);
  console.log(`${s.name}: ok  url=${log.finalUrl.replace(WEB, '')}  pageErrors=${log.pageErrors.length} consoleErrors=${log.consoleErrors.length} toast=${log.toast ? 'YES' : 'no'} unmocked=${um.length ? um.join(', ') : '-'} foreign=${log.foreign.length} ${[...new Set(log.notes)].slice(0, 3).join(' ')}`);
  if (log.toast) console.log('   toast:', log.toast.slice(0, 200));
  for (const e of log.pageErrors.slice(0, 3)) console.log('   pageerror:', e.slice(0, 200));
  for (const e of log.consoleErrors.slice(0, 4)) console.log('   console:', e.slice(0, 200));
  if (keepOpen) await page.waitForTimeout(600_000);
  await context.close();
}

function helpers(page, log) {
  const h = {
    toastText: null,
    wait: (ms) => page.waitForTimeout(ms),
    /** Scroll the nearest scrollable ancestor so the element with this text sits `offset` px below the top. */
    async scrollToText(text, { offset = 12, nth = 0, exact = false } = {}) {
      const loc = page.getByText(text, { exact }).nth(nth);
      await loc.waitFor({ state: 'attached', timeout: 15_000 });
      const ok = await loc.evaluate((el, off) => {
        let p = el.parentElement;
        while (p) {
          const cs = getComputedStyle(p);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 2) break;
          p = p.parentElement;
        }
        if (!p) return false;
        const top = el.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - off;
        p.scrollTop = Math.max(0, top);
        return true;
      }, offset);
      if (!ok) log.notes.push(`scrollToText(${text}) found no scroller`);
      await page.waitForTimeout(700);
    },
    async scrollBy(px) {
      await page.evaluate((dy) => {
        let best = null;
        for (const el of document.querySelectorAll('div')) {
          const cs = getComputedStyle(el);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 300) if (!best || el.scrollHeight > best.scrollHeight) best = el;
        }
        if (best) best.scrollTop += dy;
      }, px);
      await page.waitForTimeout(600);
    },
    async click(text, { nth = 0, exact = false, wait = 1500 } = {}) {
      await h.hideToast();
      await page.getByText(text, { exact }).nth(nth).click({ timeout: 15_000 });
      await page.waitForTimeout(wait);
    },
    async clickLabel(label, { wait = 1500 } = {}) {
      await h.hideToast();
      await page.getByLabel(label).first().click({ timeout: 15_000 });
      await page.waitForTimeout(wait);
    },
    async hideToast() {
      h.toastText = (await page.evaluate(() => {
        const host = document.getElementById('error-toast');
        const root = host?.shadowRoot || host;
        const msg = root?.querySelector?.('[class*="_message"]')?.textContent?.trim();
        if (host) host.style.display = 'none';
        return msg || (host ? 'toast(no text)' : null);
      })) || h.toastText;
    },
  };
  return h;
}

const specs = names.map((n) => SHOTS.find((s) => s.name === n)).filter(Boolean);
if (!specs.length) {
  console.log('no shots selected; --list to see names');
  process.exit(1);
}
const browser = await chromium.launch();
for (const spec of specs) {
  try {
    await shoot(spec, browser);
  } catch (error) {
    console.log(`${spec.name}: FAILED ${error.message.split('\n')[0]}`);
  }
}
await browser.close();
