# MEDICARD web QA against a mock API

Renders the Expo app (`mobile/`, react-native-web) in a browser **signed in**, without touching
https://medicard.ge or any real account. Everything lives in this folder; no repo file is edited.

```
webqa/
  mock-api.mjs        dependency-free Node http server (+ minimal socket.io responder)
  lib.mjs             Tbilisi date helpers
  fixtures/*.mjs      one module per domain: init(state, ctx) + routes[]
  shoot.mjs           Playwright: seed token/theme/language, open a route, screenshot
  restart-mock.ps1    stop whatever listens on :4499 and start the mock detached (pid → mock.pid)
  shots/              screenshots + <name>.log.json (console/page errors, API calls)
```

## Fixtures

| module | serves | notes |
|---|---|---|
| `core.mjs` | `/api/auth/me` (GET/PATCH), `/api/health-profile` (GET/PUT, POST `/complete`), `/api/app/status` (every feature flag on, `minAppVersion 0.0.0`, no maintenance), `/api/ai-consent`, `/api/usage`, `/api/check-in`, funnel/client-error/client-guard sinks, push register | persona user + profile; reads `mobile/src/config/aiDisclosure.json` (read-only) |
| `cycle.mjs` | everything under `/api/cycle` (bundle, logs, period writes, tags, insights fallback, share, …) | builds the bundle with the **real server cycle engine** imported read-only from `server/src/lib/cycle*.js` (pure modules; `MEDICARD_REPO` overrides the repo path). Women: 28-day cycle, today = day 26, next period in 3 days, 6 completed cycles, no contraception. Man: 403 like the server |
| `engage.mjs` | `/api/medipulsi/grand`, `/api/quests*`, `/api/announcements*` (+ the news image), `/api/trainer/me|photos|overview`, `/api/identity/*`, `/api/community/membership`, `/api/push/templates`, Open-Meteo stand-ins under `/__ext/open-meteo/*` | grand = 0.23 % lit, campaign `upcoming`; quest 1 240 coins, level 4, daily 1/3, weekly steps 32 205/35 000; one MEDIRUN news card. Adds a Tbilisi `extraAnswers.location` to the profile (`ENGAGE_LOCATION=city` default, `gps`, `off`); with `gps` the browser calls Open-Meteo directly — intercept it (snippet at the end of engage.mjs). Reads `server/src/data/medirun-campaign.json`, push template sources and `server/public/medirun/img/city-sm.webp` read-only |
| `health.mjs` | `/api/health-metrics*` (pull, sync, hydration goal, steps capability), `/api/medications*`, `/api/account/app-state` (GET/PUT, server merge rules), `/api/account/email-preferences`, `/api/visits*`, `/api/records*`, `/api/push/dose-events`, `GET /__health/local-seed` | 6 400 steps today (goal shown 10 000 — app constant), 7 days of rows, water 1.25/2.5 L, D3 09:00 taken + B6 21:00 pending, 3 MEDIRUN walks (12.4 km), one upcoming visit |
| `nutrition.mjs` | 43 routes under `/api/nutrition/*` (program dashboard, plan, recipes, meals, foods, preferences, measurements, fasting) | plan 2 180 kcal, 3 meals = 1 240 kcal today, planned dinner, streak 3 (best 19); `state.weight` = goal 96.0 → 85.0, 92.4 kg today, 11 points |
| `profile.mjs` | `/api/pets`, `/api/rewards/entitlements`, `POST /api/check-in/session` | |

Routes are matched in file order (alphabetical), first match wins. All `/api` fixtures expect a
`Bearer` token (any string ≥ 8 chars).

## 1. Start the mock API

```bash
cd <this folder>
PERSONA=women node mock-api.mjs 4499      # PERSONA=man for a male account
```

or detached on Windows: `powershell -File restart-mock.ps1 -Port 4499 -Persona women`
(stop: `Stop-Process -Id (Get-Content mock.pid)`).

Control endpoints:

| | |
|---|---|
| `GET  /__state` | dump the in-memory state (+ unmocked counters) |
| `GET  /__unmocked` | `{ "GET /api/x": count }` for every /api request no fixture answered |
| `POST /__reset?persona=women\|man&layout=standard\|women\|active\|weight&onboarding=tail` | rebuild state |

`onboarding=tail` = a user who still needs the onboarding tail (`assessmentPhaseComplete`,
`privacyAccepted`, `aiPrivacyPrompted`, `notificationsEnabled` true; no `homeLayout`; `completedAt: null`),
so the app routes to `/profile-setup/home-layout`.

Every other `/api/*` request is logged as `UNMOCKED <method> <path>` and answered
`404 { "error": "mock: not found" }`; nothing is proxied. `PUT /api/health-profile` shallow-merges
`extraAnswers` like `server/src/routes/health-profile.routes.js` and returns `{ profile, user }`, so a
layout chosen in the app survives reloads (until the next `/__reset`). `MOCK_VERBOSE=1` logs every hit.

## 2. Start the web app pointed at the mock

`mobile/.env.development.local` sets `EXPO_PUBLIC_API_URL=https://medicard.ge`. Expo's env loader
(`@expo/env`) never overrides a variable that already exists in the process environment, so set it
for this run only — no file edit:

```bash
# Git Bash (repo root)
EXPO_PUBLIC_API_URL=http://localhost:4499 BROWSER=none npm --prefix mobile run web -- --port 8085
```

```powershell
# PowerShell (repo root)
$env:EXPO_PUBLIC_API_URL='http://localhost:4499'; npm --prefix mobile run web -- --port 8085
```

or detached on Windows: `powershell -File restart-web.ps1 -Port 8085 -Api http://localhost:4499`
(runs `mobile/node_modules/expo/bin/cli start --web --port 8085` with the env var set and `CI`
removed, like `scripts/start.mjs`; pid → `web.pid`, logs → `web.log`; add `-Clear` to clear Metro's cache).

Verified: with this, the app's requests go to `http://localhost:4499` only (shoot.mjs also aborts any
request to `*medicard.ge` and prints `BLOCKED …` if one ever happens). If an old bundle still points at
medicard.ge, add `--clear` once (`npm --prefix mobile run web -- --port 8085 --clear`).

## 3. Screenshot with Playwright

Playwright is `server/node_modules/playwright` (Chromium already installed under
`%LOCALAPPDATA%\ms-playwright`).

```bash
node shoot.mjs --path home --out standard --persona women --layout standard --time 13:30
node shoot.mjs --path home --out women  --persona women --layout women  --time 13:30
node shoot.mjs --path home --out active --persona women --layout active --time 13:30
node shoot.mjs --path home --out weight --persona women --layout weight --time 13:30
node shoot.mjs --path profile-setup/home-layout --out onboarding-home-layout --persona women --onboarding tail
node shoot.mjs --path profile --out profile --persona women --layout women
node shoot.mjs --path profile --out profile-layout-picker --persona women --layout women --scroll "მთავარი გვერდი" --click "მთავარი გვერდი" --no-full
```

Recommended for review shots: add `--time 13:30` (browser clock starts at 13:30 Tbilisi on the mock's
"today" and then runs; the app hides the planned dinner after 21:00 local time and greets by time of day).
By default shoot.mjs loads the page, waits, then **reloads once** (a returning device: `accountSync`
copies dose logs, walks, goals from `/api/account/app-state` into localStorage only after Home has read
them); `--cold` keeps the first-visit frame. Expo's dev error toast (`div#error-toast`) is recorded in the
log and hidden in the PNG unless `--keep-toast`.

(In Git Bash write `--path home`, not `--path /home` — MSYS rewrites `/home` into a Windows path;
shoot.mjs undoes that, but the bare form is simpler.) Options: `--theme dark`, `--lang en`,
`--wait 6000`, `--time HH:MM`, `--cold`, `--no-reset` (keep current mock state), `--no-full`,
`--scroll "text"`, `--click "text"`, `--keep-toast`.
Each run writes `shots/<out>.png` (390×844 @2x), `shots/<out>-full.png` (viewport grown to the
ScrollView's content height — RN-web scrolls inside a div, not the document) and `shots/<out>.log.json`.

Minimal snippet (what shoot.mjs does):

```js
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Users/User/Desktop/www.medicard/server/package.json')('playwright');

await fetch('http://localhost:4499/__reset?persona=women&layout=women', { method: 'POST' });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Tbilisi' });
await context.addInitScript(() => {
  localStorage.setItem('medicard.auth.token', 'mock-token-0123456789abcdefghijkl'); // mobile/src/lib/storage.ts TOKEN_KEY
  localStorage.setItem('medicard.theme.preference', 'light');                      // theme preference key
  localStorage.setItem('medicard.language', 'ka');                                  // mobile/src/i18n/locale.js STORAGE_KEY
});
await context.route(/medicard\.ge/, (r) => r.abort());                              // never the real API
const page = await context.newPage();
await page.goto('http://localhost:8085/home', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(6000);
await page.screenshot({ path: 'shots/women.png' });
// full content: grow the viewport to the inner ScrollView's scrollHeight, then screenshot again
const h = await page.evaluate(() => Math.max(...[...document.querySelectorAll('div')]
  .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.clientHeight > 300)
  .map((el) => el.scrollHeight)));
await page.setViewportSize({ width: 390, height: Math.min(h + 40, 16000) });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/women-full.png', fullPage: true });
await browser.close();
```

## Stopping

- mock: `Stop-Process -Id (Get-Content mock.pid)` (or kill whatever listens on 4499)
- web: `Stop-Process -Id (Get-Content web.pid)` — the Expo CLI may leave a child; to be sure, kill whatever listens on 8085:
  `Get-NetTCPConnection -State Listen -LocalPort 8085 | % { Stop-Process -Id $_.OwningProcess -Force }`

## Poster shots (this copy, 2026-10-04)

Ports: mock 4519, Expo web 8097. Output: `../out/<name>.png` (390×797 @3x = 1170×2391) and `<name>-full.png`.

```powershell
powershell -File restart-mock.ps1 -Port 4519 -Persona man           # mock (pid → mock.pid)
powershell -File restart-web.ps1 -Port 8097 -Api http://localhost:4519  # Expo web (pid → web.pid)
node snap.mjs --list                 # shot names (shots.mjs)
node snap.mjs run-hub quest-store    # re-shoot some
node snap.mjs --group run            # every MEDIRUN shot
node sheet.mjs                       # ../out/index.json + ../out/_sheet.jpg
```

- `snap.mjs` resets the mock with `now=<shot time>` (`clock.mjs` shifts the mock's Date), installs the same browser
  clock, seeds localStorage from `/__health/local-seed`, injects `intl-ka.js` (Georgian Intl for Chromium), blocks
  medicard.ge (prize renders `https://medicard.ge/rewards/*.webp` are answered from `server/public/rewards`) and Mapbox.
- New fixtures: `medirun.mjs` (bootstrap, drops, wallet, leaderboard, territory, sessions, nearby, claim),
  `store.mjs` (rewards catalog/detail, /api/quests/rewards, prize images), nutrition `POST /__seed/fasting`.
- More fixtures (2026-10-04): `pets.mjs` (MEDIVET; ბონი `b0a1e7d2-5c4f-4e8a-9b13-2f6d8c0a4b71`, მია `c4d2a9f0-7b3e-4c51-8a06-9e1f3b5d7c28`;
  `PETS_FIXTURE=off`), `coach.mjs` (man = verified trainer, women = client of ლევან ჩხეიძე; gym names neutralised;
  `COACH_ROLE=off`), `lab.mjs` (3 lab sheets → app-state labPanels + records; `/lab/param/vitamin_d`), `medi.mjs`
  (Medi catalog/plan/execute/chats + SSE `/api/ai/query`; saved threads `/assistant?sessionId=…`), `scan.mjs`
  (extract-lab / explain-lab / analyze-image; `/__scan/config`), `pharmacy.mjs` (40 products, 3 neutral pharmacy
  names; D3 product `6cdd048d-b6ad-4ca9-ac82-254809f7d564`). `node check-fixtures.mjs` / `check-fixtures2.mjs` smoke-test them.
- Mock time: MEDIRUN shots use Thu 2026-10-22 10:15 (12:41 for the countdown hero), the rest Mon 2026-10-05 10:15.
