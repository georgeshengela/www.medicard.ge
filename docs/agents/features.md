# Feature modules: MEDI QUEST, MEDI COACH, nutrition, reminders, web /app

Moved verbatim from AGENTS.md on 2026-10-08 (token diet). Read this file before working in its area; add new notes here, not in AGENTS.md.

## MEDI QUEST unified hub (2026-09-19)

Owner explicitly replaced the Profile robot and separate Companion pages with one native `/medi-quest` hub (missions/progress/rewards). Profile uses `QuestProfileCard`; Companion routes (`/medi-companion`, `/journey`, `/collection`) are 5-line compatibility redirects kept for old push `route`s; the Companion UI components were deleted 2026-09-27. `/api/medi-companion` and its tables stay: `useQuestJourney` reads journey/overview and writes equipment through it (see docs/DB-DROP-CANDIDATES.md). Keep the geometric progress seal, existing ownership/equipment and journey math (completed daily=1/weekly=3), separate from claimed XP/coins. Do not restore the robot entry or old separate home based on older notes. Quest/Companion cache reads and late responses must stay scoped to the captured account. Global bottom navigation stays hidden on Quest routes. Native version1.0.0.9.6 / iOS1.9.6; no DB schema change.

## Web app /app (2026-09-29)

Signed-in web version of the app at `https://medicard.ge/app` (owner request: every app feature on the site). Vanilla ES modules, no build step: `server/public/app/` (`js/main.js` router + shell, `api.js` same `/api` + Bearer JWT as the app, token in `localStorage` `medicard.web.token`, `ui.js` DOM toolkit, `charts.js` SVG charts, `aiConsent.js`, `pages/<module>.js`, `css/<module>.css`). Server serves `/app` and `/app/*` (no file extension) with `app/index.html`; files under `/app/` are `no-cache`. Sign-in = SMS code / email+password / register / reset (same endpoints); new accounts get a short onboarding that records the required privacy acceptance and never pre-accepts AI consent. Rules: every AI call goes through `withAiConsent`; no health text in URLs (Medi drafts travel in `sessionStorage` `medicard.web.mediPrefill`); `/api/health-metrics/sync` only from a click (loop incident); app-only things (steps sync, reminders/push, voice, barcode, GPS) show an App Store hint instead of being faked. Module pages export Home cards (`homeCard`, `homeActivityCard`, `newsCards/loadNews`). Site nav (`site-nav.js`) links „შესვლა“ → `/app`. Local preview: `node scripts/web-app-dev.mjs 4401` (local files + main API, the owner signs in) or `--mock <dir>` with fixture modules (no network).

## MEDI COACH — fitness trainers (2026-09-28, app 1.0.0.15.0)

Owner request 2026-09-28 (overrides the product freeze for this module). Verified trainers (phone + 18+ +
admin approval in `#/trainers`) get a separate workspace `/coach` with its own tab bar; clients use `/trainer`.
Linking is consent-first: named scopes (workouts, nutrition, weight, photos — photos off by default), revocable
instantly; trainers read client data only through `requireClientAccess` in `server/src/lib/trainerStore.js`.
A trainer's meal plan never overwrites the client's nutrition program — adherence is computed from the diary.
Gyms: `server/src/data/gyms-ge.json` (install adds missing rows only; admin edits persist). Times are
`TIMESTAMPTZ`. Health workouts: Android needs the READ_EXERCISE / READ_ACTIVE_CALORIES_BURNED native build.
No payments, no chat (not built: needs moderation/retention policy). Flag `coach`. See docs/TRAINER.md.

Photo avatars + personal QR (2026-09-28, app 1.0.0.15.1): `UserAvatar` / `UserQr` tables
(`prisma/20260928-avatar-qr.sql`, `install-avatar-qr.mjs`), API `/api/identity`. A photo is visible only to the
person, open trainer↔client links, everyone for VERIFIED trainers, and a verified trainer holding the person's
current QR token (`canViewAvatar`); the women's space never shows it. The personal QR is a random renewable
token (`https://medicard.ge/u/TOKEN`), never the user id; a trainer's scan returns identity only and an invite
(`TrainerLink.initiator = 'TRAINER'`) shares nothing until the client accepts with scopes. `StyledQr` geometry
was verified with a decoder (round dots failed) — keep modules ≥ 0.47 cell and logo ≤ 20 %. Codes stay as a
fallback until the owner says otherwise.

## Reminders always on (owner 2026-10-02, app 1.0.0.18.19)

Owner: every reminder is on by default and each can be turned off on Profile → შეტყობინებები → „შეხსენებები“ (`ReminderFamiliesSection`). One switch per family: meds, visits, pets, pregnancy, nutrition live in `src/lib/reminderPrefs.ts` (missing = on; only an explicit `false` from a switch turns one off; meal settings writes the same value, the server row only holds meal times); cycle uses `cycleReminderPrefs.enabled`; steps/weight use the goal's own `reminderEnabled`. Every sync function checks its switch and cancels its prefix when off. Pet care never reminded before: server schedules were created with `reminderEnabled:false` (now true, offsets [1,0]; `install-pet-reminders.mjs` turned existing ACTIVE schedules on once, marker table `OneTimeDataFix`), the device opt-in default was false and written back on every sync (now the pets switch), and overdue care had no follow-up (now 1/3/7/14/30 days then monthly for a year, next two queued, `PET_CARE_OVERDUE_STEPS`). `reconcileAllLocalReminders` (`src/lib/reminderReconcile.ts`) restores visits, meals, steps and weight after sign-in (after the account pull) and on foreground (≤ every 10 min), with a once-per-account switch-on of old default-off goals and cycle prefs; `reconcileCycleReminders` also does pregnancy care; a fresh notification grant schedules every family at once. Medication courses that started and end > 60 days out use repeating DAILY/WEEKLY triggers (dated slots only near the end — dated ones ran out after ~2 weeks). Android cycle/steps/weight/nutrition channels are `*-v2` at HIGH (old ids deleted). Never add a reminder family without a switch in that section and a call in the reconcile.

## Nutrition · Cal AI parity (2026-09-26, app 1.0.0.12.0)

`/nutrition/diary` logs food eight ways from one `+` menu: photo, gallery, barcode (`expo-camera` viewfinder → Open Food Facts via our server, code only), label scan, describe/dictate (text mode, no photo), search (saved → Georgian catalog `server/src/data/nutrition-catalog.json` → Open Food Facts / optional USDA), saved/recent, manual. `POST /api/nutrition/estimate` takes `mode=photo|label|text|fix`; only text and fix may omit the photo. Health score is a deterministic heuristic (`healthScore`), never AI. Budget = target + burned (if `addBurned`) + rollover ≤200 (if `rollover`), from `NutritionPreference`. Streak, week summary, projection, water/steps, measurements and activities ride on the dashboard. Meal reminders use the `nutrition:` prefix. Medi action `nutrition_log` → `/api/nutrition/quick-log`. Keep estimates unsaved until the person confirms; never claim accuracy. 2026-09-27 (app 1.0.0.13.0): macro split (re-divides plan calories only), meal/day copy, personal recipes (`NutritionFood.source='recipe'`), opt-in Apple Health / Health Connect write-back and an intermittent-fasting timer — daily 10–20 h windows only; never offer it under 18, in pregnancy/breastfeeding or with an eating-disorder history; glucose-lowering medication needs the person's doctor confirmation; no ketosis/autophagy claims. Quest still excludes calories; widgets/HealthKit write-back are a separate native train. See docs/NUTRITION.md.
