# თბილისი მოძრაობს — owner pilot runbook (Phase 6)

Short procedure for the owner. Full evidence: `docs/TBILISI_MOVES_PILOT_VALIDATION.md`.

This is **not** production. `pilotMode` stays true. Hosted Neon, production flags, scheduler, push, and the public version are **not** touched.

## Status (this machine, 2026-09-14)

| Item | State |
|---|---|
| Backend pipeline (Phase 5 isolated Postgres) | **Verified** |
| Owner-pilot API/DB (persistent, non-test DB) | **Running locally** — `GET /api/tbilisi-moves/status` returned schemaReady/flags/`pilotMode` without secrets |
| Mobile visual checks | **Admin captured** (empty owner-pilot + labeled visual-QA). Expo/native screens pending a development build |
| Android native Health Connect | **Pending** — emulator appeared then disconnected; no APK install this pass |
| iOS native HealthKit | **Pending** — no Mac/device |
| Production activation | **Not performed** |
| Scheduler | **Not registered** |

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

Attach a development-build Android phone (or iOS on a Mac), point it at `http://LAN:4011`, and run steps 4–8. That is the only remaining blocker for native sensor evidence. After that pipeline is trusted, the next **product** phase is the licensed Tbilisi district map (existing Mapbox stack; OSM ODbL or operator shapefile — never invented polygons).
