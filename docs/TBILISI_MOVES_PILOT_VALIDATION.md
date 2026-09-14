# თბილისი მოძრაობს — Phase 6 human-pilot preparation

**Date:** 2026-09-14  
**Public identity:** `1.0.0.8.25` (unchanged; no version bump)  
**Pilot mode:** true (not switchable to “verified”)  
**Hosted Neon / production flags / scheduler / push:** not touched

Owner runbook: `docs/TBILISI_MOVES_OWNER_PILOT.md`.

Synthetic API observations (Phase 5) prove the **competition pipeline**. They do **not** prove HealthKit or Health Connect integrity. This phase prepared a persistent owner-pilot environment, polished UI, and captured admin screenshots. An Android emulator appeared once (`emulator-5554`) then disconnected before install, so native sensor evidence is still pending.

---

## Phase 6 status

| Item | State |
|---|---|
| Backend pipeline (Phase 5 isolated Postgres, 7/7 + 32/32) | **Verified** — not re-run as a whole |
| Persistent owner-pilot DB `medicard_tbilisi_moves_pilot` | **Prepared** (`127.0.0.1:55433`, not the test DB) |
| Mobile visual checks | **Admin screenshots captured** on the isolated API; Expo Go/web cannot validate Noto at OS scale or sensors |
| Android native | **Pending** — emulator `emulator-5554` listed once, then `adb devices` empty; no APK installed |
| iOS native | **Pending** — Windows environment, no Xcode device |
| Production activation | **Not performed** |
| Scheduler | **Not registered** |

### Owner-pilot environment

Command (preserves data; does not run tests):

```bash
cd server
node scripts/tbilisi-moves-pilot.mjs
```

| Field | Value |
|---|---|
| Cluster | Same guarded user-space PG as Phase 5 (`127.0.0.1:55433` / `medicard_tm_test`) |
| Pilot DB | `medicard_tbilisi_moves_pilot` (not dropped between launches) |
| Visual-QA DB | `medicard_tbilisi_moves_visual` (`--visual-qa` only) |
| Test DBs (do not use for human pilot) | `medicard_tbilisi_moves_test` (+ `_b`, `_p2`) |
| API | `0.0.0.0:4011` (phone must use LAN IPv4, not `localhost`) |
| Postgres bind | `127.0.0.1` only |
| Clock | Real server time. Injected clocks stay in tests. |
| Login | `pilot.owner@medicard.test` (password in gitignored `server/.tbilisi-moves-pilot-account.json`) |
| Auth | Existing email/password. No production-user reuse, no insecure bypass. Phone OTP needs SMSOffice or `QA_OTP_CODE`; if those are absent, use email. |

Verify without secrets: `GET http://127.0.0.1:4011/api/tbilisi-moves/status` → `schemaReady`, flags, `pilotMode`, `visualQaFixture`, Tbilisi date. No tokens.

### Development build

| Check | Result |
|---|---|
| Config checked | Yes — HealthKit plugin + step wording; Health Connect `READ_STEPS` + Health Connect package query; `ACTIVITY_RECOGNITION` |
| Build created | **No** this pass. `mobile/android` already exists locally. Emulator `emulator-5554` was visible once, then `adb devices` went empty before `expo run:android`. Paid EAS was not started. |
| Installed | **No** |
| Device tested | **No** |

Expo Go / web remain unsupported for native step collection. `eas.json` preview/production still use `https://medicard.ge`. Pilot sessions must set `EXPO_PUBLIC_API_URL` to the printed LAN/emulator URL (`:4011`). Default `app.json` `extra.apiUrl` stays production.

Minimum local path:

```powershell
$env:EXPO_PUBLIC_API_URL="http://YOUR_LAN_IP:4011"
cd mobile
npx expo prebuild --platform android
npx expo run:android
```

### Visual QA

Admin `#/tbilisi-moves` (FiraGO) was captured against the **real isolated admin**, not source inspection:

- Owner-pilot empty states (`visualQaFixture: false`): `qa/tbilisi-moves-phase6/admin-{light,dark}-{overview,districts,rules,rounds,review,rewards}.png`
- Labeled synthetic fixture (`visualQaFixture: true`, handles `QA `): `qa/tbilisi-moves-phase6/visual-qa/`

Observed: tab shell width matches the pane; KPI zeros and 52/110,160 tabular numbers; teal rank **1** on გლდანი; dark navy canvas; synthetic banner only on the visual DB; round `2026-09-15` OPEN / `DAY_STILL_OPEN`. Mobile native screens were not GPU-captured.

### Native step validation

**Not executed as a human walking day.** At inspect, `adb devices` listed `emulator-5554` (`sdk_gphone64_x86_64`, Android 15). It disconnected before a development APK could be installed. `adb devices` was empty on re-check. No Health Connect permission dialog, Tbilisi-interval query, or observation PUT was performed on a device. Expo Go / web remain unsupported.

See the ordered owner procedure in `docs/TBILISI_MOVES_OWNER_PILOT.md`.

---

# თბილისი მოძრაობს — Phase 5 pilot validation


**Date:** 2026-09-14  
**Public identity:** `1.0.0.8.25` (unchanged; no version bump)  
**Pilot mode:** true (not switchable to “verified”)  
**Hosted Neon / production flags / scheduler / push:** not touched

Synthetic API observations prove the **competition pipeline**. They do **not** prove HealthKit or Health Connect integrity.

---

## Reproducible test setup

This Windows machine has PostgreSQL 17.11 binaries. Docker and WSL were **not** used. System services `postgresql-x64-17` / `18` were **not** modified. A **user-space** cluster was `initdb`’d to `%TEMP%\medicard-tbilisi-moves-pg` and started on **127.0.0.1:55433**.

Disposable identity (localhost alone is not enough):

| Field | Required value |
|---|---|
| Env | `TBILISI_MOVES_TEST_DATABASE_URL` |
| Prisma child `DATABASE_URL` | **identical** to that URL (no hosted fallback) |
| Host / port | `127.0.0.1` / `55433` |
| Role | `medicard_tm_test` |
| Databases | `medicard_tbilisi_moves_test` (A + HTTP), `_b` (path B), `_p2` (phase2-only) |
| Guard row | `_tbilisi_moves_disposable.marker = medicard-tbilisi-moves-disposable` |

```bash
cd server
node scripts/tbilisi-moves-isolated-pg.mjs
```

Docker alternative (not executed this pass):

```bash
docker compose -f server/docker-compose.tbilisi-moves-test.yml up -d
cd server
node scripts/tbilisi-moves-isolated-pg.mjs
```

Prerequisite tables for FKs: `server/prisma/tbilisi-moves-test-base.sql` (`User`, `Admin`, `HealthMetricDaily`, `StepLog`, `AdminAuditLog`). Never apply that file to hosted Neon.

---

## Migration results

| Path | What ran | Result |
|---|---|---|
| A | test-base → `tbilisi-moves-phase2.sql` → `tbilisi-moves-phase4.sql` | Passed. Prisma reads Config (incl. Phase 4 columns), 10 raioni, unique indexes, User FK on credits. |
| B | test-base → phase2 + representative membership/credit/round → phase4 | Passed. Operator-edited `defaultDailyTarget=123456`, `cooldownDays=21`, Vake override `777000`, credit `4321` survived. New columns defaulted. `resultRevision=0`. |
| Seed | Re-run phase2 after editing target | Passed. `ON CONFLICT DO NOTHING` kept `111000`. |
| Phase2-only | base → phase2, no phase4 | `GET` status via `getPublicStatus`: `schemaReady=false`, `resultsReady=false`, `pilotMode=true`. `requireResultsSchema` → `SCHEMA_NOT_READY`. No raw 500. |

No additive Phase 5 SQL patch. Previously unapplied phase2/phase4 files were **not** rewritten; they applied as written.

---

## Integration / concurrency (executed)

Authenticated isolated `@medicard.test` accounts. Clock via `now` injection. Races used `pg_advisory_xact_lock` holders + waiter polling on `pg_locks` / `pg_stat_activity` (not sleep-only).

Covered and passing in `tbilisiMoves.phase5.int.test.js` + `tbilisiMoves.http.test.js`:

- Concurrent initial enroll (one `ALREADY_ENROLLED`)
- Leave / rejoin cooldown; pending midnight change vs historical credit district
- Concurrent district-change (one `CHANGE_PENDING`)
- Duplicate observation id, conflicting payload, stale order, downward correction, cap, one credit per user/date, `SOURCE_CONFLICT`
- Manual `/api/health-metrics/sync` does not create competition credit
- Exclusion survives a later observation
- Snapshotted target/cap/rewards vs later live config
- Exact-ratio district board, dense people ties, min-participants unranked, own rank off page
- Ingest vs finalize (lock before closed check)
- Moderation vs finalize; runner vs admin finalize
- Retry/idempotent or `ROUND_FINALIZED` without duplicate award rows
- Stale preview `PREVIEW_STALE`; correction revision ≥ 2
- VIEW denied config/district/archive/exclude/finalize; MANAGE denied correction
- Personal `HealthMetricDaily` unchanged as a competition ledger
- `--dry-run` / `finalizeDueRounds({ dryRun: true })` did not increment rounds, revisions, awards, or round audits
- Catch-up did not invent `2026-07-19`

Harness run **2026-09-14** (user-space PG 17.11): **7/7 isolated tests pass**. Unit lifecycle/compute/ranking/membership/errors: **32/32 pass**.

Quest `UserQuest*` tables are absent on this disposable schema; health-metrics still returns 200 because quest refresh is caught. That is expected, not a competition defect.

---

## Pilot scenario evidence (synthetic)

Clock: `2026-07-22` Tbilisi day, then injected `2026-07-23T04:01:00.000Z` (not the OS clock). Flags enabled **only** on `medicard_tbilisi_moves_test`.

| Step | Result |
|---|---|
| `GET /status` | 200, `pilotMode: true` |
| Enroll 5 synthetic users (გლდანი ×3, დიდუბე, ვაკე) | lib enroll OK |
| Dedicated observations 9000/9000/1000/8000/8000 | pipeline OK |
| `POST /api/health-metrics/sync` 33333 | 200; **0** competition credits with 33333 |
| Injected overview credited | 9000 |
| `GET /me`, district board, people `limit=1` | 200; own rank **2** off page |
| Tied დიდუბე/ვაკე | same `goalRatio`, dense rank **2** |
| Live target patched 40000 | today’s snapshot stayed **20000** |
| Exclude გლდ3; board eligible dropped | OK |
| Finalize revision 1 | 4 ACTIVE awards |
| Repeat finalize | no duplicate award identities |
| `GET /history` | 200, 3 items (includes leftover isolated dates) |
| `GET /awards` | 200, 1 row for the caller |
| Dry-run after finalize | `scanned: 0` |
| Correction revision 2 | OK |
| Personal health steps | **33333** still |

Raw log (no secrets): `qa/tbilisi-moves-phase5/evidence.json`.

---

## Visual QA

| Surface | What was done | Screenshots |
|---|---|---|
| Mobile hub / profile entry | Code review + Noto Sans Georgian on Georgian body copy (hub, profile subtitle, sync banner) | **Not captured** — no emulator/device attached (`adb devices` empty) |
| Admin `#/tbilisi-moves` | FiraGO is the V3 shell font; Georgian copy has no “healthiest district” | **Not captured** — isolated API was not bound to the production admin login |
| Light/dark, large text, safe areas | Stack headers provide safe area; dark tokens already navy | Native renderer not run |
| Tied leaders / off-page sticky row | Layout present (`tiedLeaders`, sticky `yourPlace`) | Not exercised on a GPU list |

**Native gap:** Expo Go / web rendering cannot validate HealthKit, Health Connect, or Noto at runtime OS scale. Remaining: development or store build on a phone.

---

## Native step validation

**Not executed.** `adb devices` listed no device. Do not treat fixtures, Expo Go, or this report as device proof.

### Operator procedure (short)

1. Build a **development or production** client with HealthKit / Health Connect native modules (not Expo Go).
2. Point it at an API whose DB has phase2+phase4 SQL and **test-only** `featureEnabled` + `enrollmentOpen` (pilot stays true).
3. Profile → **თბილისი მოძრაობს** → enroll a district (no GPS).
4. Grant HealthKit (iOS) or Health Connect (Android) step read.
5. On a **non-Tbilisi** phone TZ, confirm the adapter queries `competitionInterval(ymd)` (Asia/Tbilisi midnight → `intervalEnd`), not the device-local day.
6. Pull-to-refresh / foreground: `PUT /api/tbilisi-moves/observations` with the dedicated payload. Repeat sync: same `clientObservationId` → `idempotent: true`. New reading → new id, still one credit row per user/date.
7. Offline: queue retries; 4xx `SOURCE_CONFLICT` / `NOT_ENROLLED` must not retry.
8. Log out / switch account: queued user A must not PUT as user B.
9. Manual HealthKit / Health Connect entry: must not be submitted as competition 0. **iOS limitation (unchanged):** statistics-by-source cannot always exclude `HKWasUserEntered`.
10. Collect: permission dialogs, request JSON (no PHI beyond step counts), server 200/409 codes, credit row count.

---

## Runner / schema readiness

- `node scripts/tbilisi-moves-finalize.js --dry-run` option is a boolean flag (`--dry-run`, not `--dryRun`).
- Dry-run calls `previewFinalize` only; isolated test showed no extra FINALIZED rounds, revisions, awards, or `tbilisi_moves.round.*` audits.
- Catch-up: `status=PROVISIONAL AND graceEndsAt <= now`, ordered by date, limit 1–50. Missing dates are **not** created.
- Proposed scan, **not registered:** `*/15 * * * *` selecting expired rounds by **their own** `graceEndsAt`. A single `15 4 * * *` UTC job only matches default 8h grace.

---

## Status matrix

| Item | implemented | executed | passed | blocked |
|---|---|---|---|---|
| Disposable PG harness + identity guard | yes | yes | yes | — |
| Migration A (Medicard base → p2 → p4) | yes | yes | yes | — |
| Migration B (phase2 records → p4) | yes | yes | yes | — |
| HTTP isolation | yes | yes | yes | — |
| Concurrency / advisory-lock races | yes | yes | yes | — |
| Isolated pilot scenario (synthetic API) | yes | yes | yes | — |
| Dry-run non-mutation | yes | yes | yes | — |
| Phase 4 missing-schema → controlled 200/503 | yes | yes | yes | — |
| Additive SQL patch | not needed | — | — | — |
| Hosted Neon apply | no | no | — | operator |
| Production flags / scheduler / push | no | no | — | operator (must stay off) |
| Mobile screenshots | font fixes only | no device | — | emulator/device |
| Native HealthKit / Health Connect | adapter in tree | no | — | development build + phone |
| Licensed district map | no | no | — | next product phase |

**Not production-ready.** SQL is verified only on the disposable cluster. Native sensors are unverified. Neon still has no Tbilisi Moves tables until an operator applies them.

---

## Smallest next step to run the (human) pilot

On the **intended non-production** database, apply `tbilisi-moves-phase2.sql` then `tbilisi-moves-phase4.sql`, enable `featureEnabled` + `enrollmentOpen` there only (`pilotMode` stays true), install a development build, and walk the native procedure above.

After that pipeline is trusted, the next **product** phase is the licensed Tbilisi district map on the existing Mapbox stack (OSM ODbL or operator shapefile). Do not invent geometry and do not drop the map from the roadmap.
