# თბილისი მოძრაობს — owner pilot runbook (Phase 6)

Short procedure for the owner. Full evidence: `docs/TBILISI_MOVES_PILOT_VALIDATION.md`.

This is **not** production. `pilotMode` stays true. Hosted Neon, production flags, scheduler, push, and the public version are **not** touched.

## Status (this machine, 2026-09-15)

| Item | State |
|---|---|
| Backend pipeline (Phase 5 isolated Postgres) | **Verified** (not re-run) |
| Owner-pilot API/DB | Prepared; **not running** this pass (`:4011` down) |
| Live phone | `192.168.1.187` → Metro `:8081` Expo Go → **`https://medicard.ge`**. Not retargeted. |
| Native health on that session | **Expo Go — cannot read HealthKit/Health Connect** |
| Android native | **Not installed** — `adb` empty; Pixel_8 AVD listed, not booted; no debug APK on disk |
| iOS native | **Not built** — `mobile/ios` missing; this PC has no Xcode |
| Production activation | **Not performed** |
| Scheduler | **Not registered** |

## Exact remaining device action (iPhone)

The owner’s 1,000+ Medicard steps live on the **production** Expo Go session as **personal `HealthMetricDaily` / `StepLog`** (`GET /api/health-metrics`, device-local day, `source: 'merged'`). They are **not** a live HealthKit total and **cannot** be ingested as competition observations. Expo Go still cannot call HealthKit / Health Connect. This Windows repo cannot compile iOS.

On a **Mac with Xcode**, without touching the live `:8081` production Metro:

1. Start the isolated API: `cd server && node scripts/tbilisi-moves-pilot.mjs` and confirm `GET http://127.0.0.1:4011/api/tbilisi-moves/status` (`pilotMode: true`, `visualQaFixture: false`). Use the printed LAN IPv4 (last time `http://192.168.1.104:4011`).
2. `cd mobile && npx expo prebuild --platform ios`
3. In **that shell only**: `$env:EXPO_PUBLIC_API_URL="http://LAN:4011"` (PowerShell) or `EXPO_PUBLIC_API_URL=http://LAN:4011` then `npx expo run:ios --device` on the physical iPhone. Do **not** set that env on the existing `--lan` Metro.
4. Sign in as `pilot.owner@medicard.test` (password in gitignored `server/.tbilisi-moves-pilot-account.json`). Do not copy production account rows.
5. Grant HealthKit **steps** read. Profile → თბილისი მოძრაობს → enroll a district.
6. Confirm Metro `[tbilisi-moves] sensor` for today’s Asia/Tbilisi interval + `steps`, hub **შენი წვლილი**, then pull-to-refresh once more (`idempotent` / same credit, not a sum).

Android equivalent (separate Metro port, never `:8081`): `npx expo run:android --device --port 8082` with `EXPO_PUBLIC_API_URL=http://LAN:4011`. An emulator cannot see the owner’s phone Health Connect/HealthKit history.

## 1. Start the isolated persistent API / database

From `server/`:

```bash
node scripts/tbilisi-moves-pilot.mjs
```

This reuses the guarded user-space cluster `127.0.0.1:55433` / role `medicard_tm_test`. It creates **`medicard_tbilisi_moves_pilot`** if missing and **does not drop it** between launches. SQL order: test-base → `tbilisi-moves-pilot-base.sql` → phase2 → phase4. Feature/enrollment/ingestion are enabled **only** on that database.

Do **not** use `node scripts/tbilisi-moves-isolated-pg.mjs` for the human pilot — that script runs the Phase 5 tests and resets competition rows.

The database listens on **127.0.0.1 only**. The API binds `0.0.0.0:4011`. On this PC the printed LAN address was `http://192.168.1.104:4011`. Do not open a public tunnel or expose Postgres.

## 2. Verify schema and test-only flags (no secrets)

```bash
curl http://127.0.0.1:4011/api/tbilisi-moves/status
```

Expect `schemaReady: true`, `featureEnabled: true`, `enrollmentOpen: true`, `ingestEligible: true`, `pilotMode: true`, `visualQaFixture: false`, `timezone: Asia/Tbilisi`. The JSON has no tokens, passwords, or raw health records.

Confirm the process is **not** using hosted Neon: the script prints `database=medicard_tbilisi_moves_pilot user=medicard_tm_test port=55433`. The password is never printed.

Admin (same isolated API): `http://127.0.0.1:4011/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env` hashed **into this disposable DB only**.

## 3. Build / install the development app

Config checked in this repo: HealthKit plugin + `NSHealthShareUsageDescription` (steps included), Health Connect plugin + `READ_STEPS` + `<queries>` for `com.google.android.apps.healthdata`. Expo Go / web **cannot** read competition steps.

`mobile/app.json` `extra.apiUrl` is production (`https://medicard.ge`). For the pilot, override **only in the Metro/dev-client session**:

```powershell
# Physical phone, same Wi‑Fi as this PC (use the LAN IP printed by the pilot script):
$env:EXPO_PUBLIC_API_URL="http://YOUR_LAN_IP:4011"

# Android emulator (host loopback):
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:4011"

cd mobile
npx expo prebuild --platform android
npx expo run:android
```

iOS (on a Mac with Xcode): `npx expo prebuild --platform ios` then `npx expo run:ios`. Not available on this Windows PC.

Do **not** run a paid EAS build or store submit for this phase. `eas.json` preview/production still point at `https://medicard.ge` — leave them.

Login: email `pilot.owner@medicard.test`. Password is in gitignored `server/.tbilisi-moves-pilot-account.json` (isolated DB only). Sign-in is **ელ-ფოსტა**. Phone OTP needs SMSOffice or `QA_OTP_CODE` in `server/.env`; if those are unset, use email — do not add a production auth bypass.

## 4–8. Native procedure (owner, on a development build)

1. Profile → **თბილისი მოძრაობს** → enroll a district (no GPS).
2. Grant Health Connect (Android) or HealthKit (iOS) **steps read**.
3. On a phone whose TZ is **not** Asia/Tbilisi, confirm the adapter still queries the Tbilisi civil interval (`competitionInterval`).
4. Pull-to-refresh / foreground: `PUT /api/tbilisi-moves/observations`. Hub **შენი წვლილი** and district total update.
5. Refresh again: same observation id → `idempotent: true`; still **one** credit row per user/date.
6. Record: platform, build (`1.0.0.8.25` unchanged), query interval, sync result, screenshots. Do not attach raw health dumps or tokens.

Leaving the competition must stop further PUTs. Logout must not replay another account’s queue. A manual entry in Medicard personal health must **not** create competition credit. Platform-store manuals: record whether the native query actually excluded them; do **not** claim iOS `HKWasUserEntered` filtering unless demonstrated.

## Phone network

`localhost` on the phone is the phone. Use the printed LAN IPv4 and port **4011**. If Windows Firewall blocks inbound 4011, allow it yourself — this runbook does not change firewall policy.

## Visual-QA fixture (optional, separate DB)

```bash
node scripts/tbilisi-moves-pilot.mjs --visual-qa
```

Database `medicard_tbilisi_moves_visual`. Handles are prefixed `QA `. Status `visualQaFixture: true` shows a banner. Do not treat this as a human walking day.

## Next owner action

Run the **Exact remaining device action (iPhone)** above. That is the only remaining blocker for native sensor evidence. Do not treat Expo Go, an empty `adb`, or a Windows iOS prebuild as that evidence. After that pipeline is trusted, the next **product** phase is the licensed Tbilisi district map (existing Mapbox stack; OSM ODbL or operator shapefile — never invented polygons).
