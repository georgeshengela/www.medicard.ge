# Medicard.GE — release runbook

Related: `docs/RELEASE_READINESS.md`, `docs/RELEASE_BLOCKERS.md`.

---

## Beta execution (2026-09-15 night)

Limited external beta (TestFlight external + Play internal). Not a production-store listing. Plans/quotas/purchasing flag unchanged. No invites sent. No production data/SQL changes.

**Owner-tested candidate (do not reuse for stores):** EAS `@gamoiwere/medicard-ge`, Expo `gamoiwere`. iOS `24d8f375-d8ea-4c18-ba0c-df6816bbbe62` preview internal IPA `1.0.0.8.41` build `2` commit `f3c4a51` — provisioning `*[expo] ge.medicard.app AdHoc`, 1 device, `beta-reports-active` absent. Android `aa066a6d-04c7-4bd5-97fe-548beca2f5a2` preview internal **APK** `1.0.0.8.41` versionCode `2` same commit. Every listed EAS artifact is preview/internal; no store IPA or AAB exists. Public App Store lookup `ge.medicard.app` resultCount 0; Play details URL 404. Owner-reported device testing accepted for this preview.

**Tree vs that binary:** working tree marketing `1.0.0.8.56` / iOS `1.8.56` includes post-`f3c4a51` crash/import fix (`trackQuestEvent` on reward detail). Next store candidate must be this tree, not `1.0.0.8.41`.

**Submit attempted:** `eas.json` now has `submit.beta` (Android `internal` + `draft`; iOS team `7699S4PS73` George Shengelia Individual). Commands:

- iOS: `Set ascAppId in the submit profile (eas.json) or re-run this command in interactive mode.`
- Android: `Google Service Account Keys cannot be set up in --non-interactive mode.`

Expo credentials: iOS signing present; **no** App Store Connect API key; **no** Google Play service account. Apple cookie session expired (`Your session has expired. Please log in.`).

**Not started (needs explicit paid approval):** store-distribution rebuilds.

```
cd mobile
npx eas-cli build --profile production --platform ios
npx eas-cli build --profile production --platform android
```

Reason: TestFlight needs App Store distribution IPA; Play internal needs AAB; preview AdHoc/APK cannot be uploaded. `autoIncrement` will raise native build from remote `2` → `3`. Keep marketing `1.0.0.8.56` / `1.8.56`. API stays `https://medicard.ge`. After those finish and Apple/Play login exist:

```
npx eas-cli submit --platform ios --latest --profile beta --what-to-test "Medicard limited external beta. Georgian assistant Medi, medications, cycle, Pets/Medi Vet, Tbilisi Moves walking competition. Not a medical device. In-app purchase off. API https://medicard.ge. Privacy https://medicard.ge/privacy Support support@medicard.ge."
npx eas-cli submit --platform android --latest --profile beta
```

Use `--profile beta` only (Play internal/draft). Do not use production track. Do not start the build commands above until the owner approves the EAS charge/quota.

**Tester link:** none issued. Do not share Expo internal artifact URLs as TestFlight/Play.

---

## 0. Authority

**This document does not authorize:** `prisma db push`, re-applying Pets/Tbilisi SQL, rotating secrets, sending user notifications, charging users, paid EAS (until the owner approves the two production builds above), production-track store submit, or registering the Tbilisi cron until the owner pastes that YAML.

**This document prepares:** server deploy order, optional Tbilisi cron, optional object storage env, optional AiInteraction `--execute`, EAS commands, device smoke.

---

## 1. Preflight (local)

1. Working tree includes REL-AI-01, auth-write limiter, seed policy, purchase flag, crash fixes.  
2. Focused tests (40/40): see readiness §10.  
3. `mobile/eas.json` production `EXPO_PUBLIC_API_URL=https://medicard.ge`.  
4. Render `NODE_ENV=production`.  
5. Live `minAppVersion` must stay a five-part floor (currently `1.0.0.1.11`), never `1.7.x`.  
6. Confirm Render `ADMIN_PASSWORD` is **set** (do not print it). Seed will **not** rotate an existing hash.  
7. SQL to apply: **none**.  
8. Decide listing: free quotas vs wait for IAP+org account. Leave `CONSUMER_PURCHASES_ENABLED` unset.

**Version:** bump `1.0.0.8.56` → next revision **only when cutting the store/dev binary**, not on the server-only deploy.

---

## 2. Backup (not executed)

| Asset | Before | Rollback |
|---|---|---|
| Neon | Console snapshot / PITR if you will run **any** SQL (this ship: none) | Restore branch |
| Render | Note current deploy ID | Redeploy previous |
| Uploads | Ephemeral — not a backup | Do not promise photos |
| EAS remote counter | Never lower | autoIncrement |

---

## 3. Order (prepared, not executed)

### A. Server JS (this candidate)

1. Optional Neon snapshot.  
2. Commit/push `main` → Render `build` → `preDeployCommand: npm run release` (generate+seed) → `npm start`.  
3. Seed updates admin **fullName only**.  
4. Smoke §4 (unauthenticated + one owner Medi turn).

### B. Mobile binary (separate from owner Expo Go)

1. Bump `expo.version` / `ios.version` per AGENTS.md.  
2. EAS `preview` or `development` first (`EXPO_PUBLIC_API_URL=https://medicard.ge`). Cloud compile **does not require a Mac**; it **does** require EAS credentials and may be billed — **not started here**.  
3. Install on a **test** device. Do not retarget the live Expo Go Metro session.  
4. Native smoke §4.  
5. Production EAS + store submit only after eligibility §8.

### C. Jobs

| Job | Now | Action |
|---|---|---|
| Pharmacy sync | Registered `0 */6 * * *` | Leave |
| Quota sweeper | In-process | Leave |
| Tbilisi finalize | **Not registered** | Optional: copy `server/docs/tbilisi-moves-finalize.render.yaml` into root `render.yaml`. Direct Neon URL. `TBILISI_MOVES_FINALIZE_SCHEDULED=true` **on the cron only** |
| AiInteraction retention | Script only | `node server/scripts/ai-interaction-retention.js` then `--execute` if you accept 90/365 |

### D. Durable uploads (optional later)

Set R2/S3 env (all four). Do **not** `db execute`. Do not delete production files until a copy job exists.

---

## 4. Smoke

**Unauthenticated:** `/health` ok; `/api/app/status` maintenance off, **`consumerPurchasesEnabled: false`**, do not log `mapboxToken`; `/uploads/<uuid>.jpg` 401; `/api/pets` 401; Tbilisi status `pilotMode=true`; `/privacy` `/terms`.

**Authenticated (non-destructive):** login; `/me` not 429 after retries; one Medi turn, disclaimer, quota −1; Cycle more-tracking; meds list; Pets list; Tbilisi hub credit = Home daily for that date; logout → local alarms gone **on this device**.

**Native binary only:** Health grant; same-day steps; repeat sync replaces not adds; one med banner; one pet-care banner; notification deep link; logout; Tbilisi refresh.

**Account delete:** disposable user only.

---

## 5. Activation flags

Do not turn Pets/Tbilisi off. `CONSUMER_PURCHASES_ENABLED` stays unset. Tbilisi `pilotMode` stays true. Registrations/maintenance as live.

---

## 6. Monitoring (first 48h after a real ship)

Render 5xx, OpenRouter/EvidenceMD errors, Prisma P2021, `/api/app/status` purchase flag still false, Tbilisi rounds stay PROVISIONAL unless cron or admin finalize, upload 401.

---

## 7. Rollback

| Failure | Action |
|---|---|
| Server 5xx | Previous Render deploy. No SQL undo |
| Seed incident | Existing admin hash is not rotated by this seed; if a **new** admin was created, disable that email |
| Bad binary | New store build. Do not trap five-part clients with a three-part `minAppVersion` |
| Tbilisi scoring | `ingestionPaused` / `competitionPaused`; do not delete credits |
| Purchase CTA leak | Confirm env flag false; ship JS that treats missing field as off |

---

## 8. Store submission (owner)

Not this pass. Required from owner: Organization conversion **or** accept Individual rejection risk; legal address; screenshots; Health declaration; demo account; privacy nutrition from **actual** collection (see readiness). Official URLs in readiness §9.

**Build commands (when you choose to run them):**

```
# Android/iOS cloud (billed; not run here)
cd mobile && eas build --profile preview --platform android
cd mobile && eas build --profile preview --platform ios

# Local Android needs a generated native project + ANDROID_HOME + keystore.
# This machine: Java 17 yes, gradlew no, adb empty.
```

Artifacts this pass: **none**.
