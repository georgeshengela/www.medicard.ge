# თბილისი მოძრაობს / Tbilisi Moves — architecture & implementation handoff

**Status:** PHASE 6 — **hosted Neon schema applied** (phase2 → phase4). Live `https://medicard.ge` has `schemaReady`, `featureEnabled`, and `enrollmentOpen` with `pilotMode=true`. **Owner override (2026-09-15):** district war uses the same stored daily total as Home (`HealthMetricDaily.steps`). Native HealthKit/Health Connect still write personal daily; they are not a second competition sensor. Expo Go shows whatever is already in that daily row. Runner is **not** scheduled. No map, Hunt, or coins.

**Owner ingest (current):** `POST /api/health-metrics/sync` and `GET /api/tbilisi-moves/me` copy `HealthMetricDaily.steps` onto `TbilisiMovesCredit` for enrolled users (same YYYY-MM-DD, replace not add, competitive cap still applies). If Home shows 1000, district shows 1000 (eligible may still cap). Do not open Health permission sheets for district war.  
**Date:** 2026-09-15  
**Public app identity:** unchanged this phase (`mobile/app.json` is currently `1.0.0.8.31` from unrelated Pets work; this phase did not bump).  
**User-facing name:** **თბილისი მოძრაობს**. English internal name: Tbilisi Moves. Never Nightingale. Never “healthiest district” / „ყველაზე ჯანმრთელი რაიონი“. This is an **activity** competition (ნაბიჯები / სიარული), not a medical ranking.

This document is the implementation handoff. Later agents must re-read the live tree before coding. Do not hang this feature on `HealthProfile`, `ChatSession`, `MedicationSchedule`, `DoctorVisit`, Home section order, Medi Quest economy, Medi Hunt tables, or a fifth bottom tab.

Pilot evidence: `docs/TBILISI_MOVES_PILOT_VALIDATION.md`. Owner runbook: `docs/TBILISI_MOVES_OWNER_PILOT.md`. Synthetic API observations prove the competition pipeline, not native sensor integrity.

---

## Phase 6 — what is in the tree now

Persistent owner-pilot API against `medicard_tbilisi_moves_pilot` on the same guarded cluster as Phase 5 (`127.0.0.1:55433`). SQL order test-base → `tbilisi-moves-pilot-base.sql` → phase2 → phase4. Flags enabled **only** there. Real server clock. No auto-destroy. Optional `--visual-qa` uses a separate DB with `QA `-prefixed handles and a visible banner. Mobile/admin visual polish (Noto / FiraGO, hierarchy, empty states). HealthKit share string mentions steps.

Command: `cd server && node scripts/tbilisi-moves-pilot.mjs` (port **4011**). Do not point the live Expo Go session at production-or-pilot by rewriting `app.json` `extra.apiUrl`. Pilot Metro must be a **separate** process/port with `EXPO_PUBLIC_API_URL` only in that process.

### Runtime identified this pass (2026-09-15, this machine)

| Item | Observed |
|---|---|
| Live phone | `192.168.1.187` connected to Metro `:8081` (`expo start --lan`, **no** `EXPO_PUBLIC_API_URL`) |
| JS runtime | Expo Go (iOS + Android bundles on that Metro; LAN peer matches the earlier iPhone Expo Go session) |
| API target of that session | `https://medicard.ge` (`app.json` `extra.apiUrl`; do **not** retarget this session) |
| Native health in that session | **Unsupported** — Expo Go cannot load HealthKit / Health Connect. Home steps still render from `GET /api/health-metrics`. |
| Isolated pilot `:4011` | **Not running** this pass |
| `adb devices` | **Empty** (Pixel_8 AVD exists, not booted) |
| `mobile/ios` | **Absent** (Windows, no Xcode) |
| `mobile/android` | Present; no debug APK on disk this pass |

### Home steps on the live Expo Go session (not competition)

Traced 2026-09-15. **Do not infer HealthKit** from a visible total.

| Layer | Path |
|---|---|
| Screen | `HomeHealthMetricsSection` (`todayTotal`) and `/health-metrics/steps` |
| Hook | `useStepsMetrics` → `fetchStepsMetrics` |
| Native | `fetchStepsSamples` returns `[]` when `Constants.appOwnership === 'expo'`. `expo-sensors` / Pedometer is unused. |
| Store | `pullStoredHealth` → `GET /api/health-metrics` (12s memory TTL, then account cache `medicard.health.metrics.cache`) |
| Merge | empty native + `stepLogs` + `daily[].steps` for days with no samples |
| Date | device-local `ymd(new Date())`, not Asia/Tbilisi |
| Provenance | server `mergeDaily` always writes `source: 'merged'`. Typed `logManualHealthMetric('steps')` uses the same endpoint. |

`__DEV__` Metro log: `[steps-origin]` with `displaySource`, `nativeSkipped`, `deviceLocalYmd`, `tbilisiYmd`, `dailySource`, `dailySteps`, `dailySyncedAt`, `todayStepLogCount`, `displayTotal`, `pullKind`. No tokens or raw records.

**Contract check:** this source cannot supply a Tbilisi midnight→now single-origin total, cannot distinguish manual vs sensor vs overlapping apps, and must not be relabeled `APPLE_HEALTH` / `HEALTH_CONNECT`. Do **not** copy it into `PUT /api/tbilisi-moves/observations`.

### Post-enrollment same-day credit (client)

Already present: `PUT` observations, unique `(userId, date)` **replace-not-add**, cap on the server, origin/manual exclusion in `healthKitSensor.ts` / `healthConnectSensor.ts`, enroll trigger `reason: 'enroll'`.

**Missing behavior filled this pass (not a second ingest pipeline):**

1. Enroll **awaits** `runCompetitionSync({ reason: 'enroll', force: true })` for at most **12s**, then navigates. The POST is already committed; the sync may finish in the background.
2. Hub retry CTA for error / pending / permission / unsupported / offline / empty (`ka.tbilisiMoves.syncRetry` / `syncError`).
3. First-enroll `NO_DISTRICT_FOR_DATE` on yesterday (grace window) is skipped so today’s accepted credit is not thrown away. Yesterday permission/unsupported after an accepted today is also skipped.
4. After an accepted today, a later empty/manual yesterday reading does not replace the hub state with empty.
5. OS HealthKit / Health Connect permission sheets run only when `reason` is `enroll` or `refresh` (explicit retry). `focus` / `foreground` / `TbilisiMovesHost` read granted state only.
6. Native `TbilisiMovesHost` also syncs once on mount (still skipped in Expo Go).

Second refresh: new `clientObservationId` + later `recordedAt` **replaces** the same `(userId, date)` row; identical payload hash on the same observation id returns `idempotent: true`. It does not add. Personal `HealthMetricDaily` / typed steps are not read.

### Remaining (do not call this production-ready)

1. **Single native-test blocker:** a development build on the owner’s iPhone (HealthKit), pointed at isolated `:4011` with `pilot.owner@medicard.test` — not Expo Go, not this Windows box, not the live production Metro session. Exact steps in `docs/TBILISI_MOVES_OWNER_PILOT.md`.
2. Operator applies phase2 → phase4 on the intended hosted DB (not this agent).
3. Licensed Tbilisi district map (next **product** phase; Mapbox stack; never invent polygons).
4. Scheduler registration and production flag enable remain operator actions. `pilotMode` stays true.

---


## Phase 5 — what is in the tree now

Reproducible disposable Postgres harness, migration paths A/B, HTTP/service integration + lock races, one isolated pilot scenario, schema-readiness tightening, runner schedule documentation, and Georgian font fixes on the hub/profile. **Not production-ready** while Neon SQL, production flags, scheduler registration, and a development-build device run remain undone.

### Isolated database identity

| Item | Value |
|---|---|
| Env | `TBILISI_MOVES_TEST_DATABASE_URL` (never fall back to normal `DATABASE_URL`) |
| Host/port | `127.0.0.1:55433` (not the Windows PostgreSQL 17/18 services) |
| Role / DBs | `medicard_tm_test` / `medicard_tbilisi_moves_test` (+ `_b`, `_p2`) |
| Guard | `_tbilisi_moves_disposable.marker = medicard-tbilisi-moves-disposable` |
| Command | `cd server && node scripts/tbilisi-moves-isolated-pg.mjs` |
| Docker alt | `server/docker-compose.tbilisi-moves-test.yml` (not used this pass; PG 17 binaries + user-space `initdb` were available) |

### Verified defects fixed this phase

- Missing Phase 4 columns (`leaderRecognitionEnabled`, …) are treated as schema-unavailable (P2022 without `TbilisiMoves` in the message).
- `requireResultsSchema` also probes `TbilisiMovesAward` and uses `isTbilisiMovesSchemaMissing`.
- Ingest takes the round advisory lock **before** grace/finalized checks so ingest vs finalize serialize.
- Runner docs: bounded `*/15 * * * *` scan of existing `PROVISIONAL` rows by their own `graceEndsAt` (not a single 04:15 UTC job). **Not registered.**
- Hub/profile Georgian body copy now sets Noto Sans Georgian.

No additive SQL patch. Phase 2 + Phase 4 files applied as written on paths A and B. Operator-edited config survives `ON CONFLICT DO NOTHING`.

### Remaining (do not call this production-ready)

1. Operator applies phase2 → phase4 on the intended hosted DB (not this agent).
2. Development/store client + physical device for HealthKit / Health Connect (Expo Go / web are not sensor proof).
3. Licensed Tbilisi district map (next **product** phase; Mapbox stack; never invent polygons).
4. Scheduler registration and production flag enable remain operator actions. `pilotMode` stays true.

---


## Phase 4 — what is in the tree now

Daily round lifecycle, one idempotent finalization service (admin + runner), cosmetic award entitlements, contribution review, result history, and admin operations. Pilot mode remains mandatory. Personal health stores are unchanged.

### Implemented files (additive to Phases 2–3)

| Area | Path |
|---|---|
| Prisma | `TbilisiMovesResultRevision`, `TbilisiMovesAward`; config `leaderRecognitionEnabled` / `leaderRewardedRanks` / `districtGoalBadgeEnabled`; round `resultRevision` / `latestResultId` |
| SQL | `server/prisma/tbilisi-moves-phase4.sql` after phase2 |
| Deploy | `server/docs/tbilisi-moves-phase4-deploy.md` |
| Lifecycle | `server/src/lib/tbilisiMoves/lifecycle.js` |
| Compute / awards | `server/src/lib/tbilisiMoves/compute.js` |
| Finalize | `server/src/lib/tbilisiMoves/finalize.js` (shared by admin + runner) |
| Moderation | `server/src/lib/tbilisiMoves/moderate.js` |
| Ingest lock | `ingest.js` now `lockUserTx` then `lockRoundTx` |
| Runner | `server/scripts/tbilisi-moves-finalize.js` (`--dry-run`, `--limit`, `--date`) |
| Admin UI | `#/tbilisi-moves?tab=overview\|districts\|rules\|rounds\|review\|rewards` (`tbilisi-moves.js?v=v3.92`) |
| Mobile | `history/index`, `history/[date]`, `awards` |
| Tests | `lifecycle.test.js`, `compute.test.js` + HTTP extras (skip without local DB) |

### Lifecycle (server clock, Asia/Tbilisi, round snapshot)

| Phase | Meaning |
|---|---|
| OPEN | Competition civil day still in progress. No finalize. |
| GRACE | Day ended; late eligible observations still accepted until `graceEndsAt`. No finalize. |
| READY | Grace expired; ingest closed. Eligible for finalize. |
| FINALIZED | Immutable published result revision. |
| VOIDED | **Unused.** Existing pause flags do not void a round. |

`ingestionPaused`: still finalizes with whatever eligible credits exist.  
`competitionPaused` (live **or** `competitionPausedAtOpen`): still finalizes, **issues no awards**.  
Missing historical dates are **not** reconstructed with today’s settings.

### Finalization / correction

One service: `finalizeRound`. Lock is `lockRoundTx` (same key ingest takes after the user lock). Preview hash is SHA-256 of eligible credits + snapshotted targets/cap/min/reward policy + pause-at-finalize. Stale preview → `409 PREVIEW_STALE`. Identical retry returns the existing published revision. Crash/retry: awards upsert on unique `(userId, date, awardKey, districtId)` **before** the revision row; unpublished entitlements are hidden until `round.status = FINALIZED`. Bounded to that round’s credits — not a global user scan.

Correction: `TBILISI_MOVES_CORRECT`, reason required, `fromRevision` checked, previous revision rows kept, obsolete awards `REVOKED`, newly earned `ACTIVE` without duplicate identities. Public reads always use the latest published revision. No raw score entry. Ordinary config/moderation edits do not rewrite published history; exclude after finalize updates the credit (and survives later sync) but the published snapshot stays until explicit correction.

Empty rounds persist an empty result. No invented winners.

### Cosmetic rewards (not Medi Coins)

Snapshotted on round **open** as `rulesSnapshot.rewards`. If an old round has no `rewards` object → finalize with **no awards** (do not invent a policy). Default policy: district individual leaders at dense ranks **1–3** (all ties qualify), plus a district-goal badge for every positive eligible contributor when the district hits its snapshotted target **and** `minParticipantsForRank`. Entitlement ≠ delivery. No push.

Mobile **ჩემი ჯილდოები** lists only published entitlements (date, district, badge, reason, ACTIVE/REVOKED). Provisional ranks are never shown as awards.

### Capabilities

| Cap | Mutating |
|---|---|
| `TBILISI_MOVES_VIEW` | read, finalize preview |
| `TBILISI_MOVES_MANAGE` | config, first finalize |
| `TBILISI_MOVES_REVIEW` | exclude / reinstate (`reason` required) |
| `TBILISI_MOVES_CORRECT` | correction preview + publish |

Legacy `capabilities: null` remains full access. Read-only VIEW cannot mutate.

### Runner vs scheduler

`node scripts/tbilisi-moves-finalize.js` is **implemented**. No Render cron, no in-process timer. Proposed `15 4 * * *` UTC. Automatic daily finalization is **not live**.

### Verification (2026-09-14, Phase 4)

- Unit: lifecycle (OPEN/GRACE/READY/FINALIZED, grace boundary) + compute (empty, dense ties, min participants, snapshot-less awards, pause, exclusion hash) + existing ranking/membership/sensor policy tests.
- Isolated Postgres (Phase 4 write-up): **blocked at the time**. Phase 5 later used user-space PostgreSQL 17.11 on `127.0.0.1:55433`. See `docs/TBILISI_MOVES_PILOT_VALIDATION.md`.
- HTTP isolation: still skipped unless `DATABASE_URL` is localhost.
- UI: admin/mobile screens are in the tree; this pass did not capture device screenshots or run HealthKit / Health Connect.
- Native sensor gaps from Phase 3 remain.

### Remaining SQL / operator steps (do not execute on shared DBs from this agent)

1. Isolated local Postgres, then `phase2.sql` → `phase4.sql` on **fresh** and **Phase-2-only** schemas.
2. `node scripts/tbilisi-moves-finalize.js --dry-run` against that DB.
3. Hosted Neon apply is still an explicit operator action.
4. Feature/enrollment flags stay off; `pilotMode` stays true.
5. Scheduler registration is a later operator action.
6. Map only with licensed OSM ODbL or operator shapefile.

---


## Phase 3 — what is in the tree now

Dedicated competition ingest on mobile, Profile entry, enrollment, membership, and polished overview + leaderboards. Pilot mode remains mandatory. Personal health step accounting is unchanged.

### Implemented files (additive to Phase 2)

| Area | Path |
|---|---|
| Membership fix | `server/src/lib/tbilisiMoves/membership.js` (`evaluateRejoin`, no same-day district rewrite, lock preserved on leave/rejoin) |
| Clock / status | `server/src/lib/tbilisiMoves/time.js` `tbilisiClock`; `config.js` `GET /status` clock + limits + `ingestEligible` |
| User API | unchanged paths; `/status` and `/me` gained clock/sync/limit fields |
| Mobile routes | `mobile/app/tbilisi-moves/` (`index`, `enroll`, `membership`) — **not** `mobile/src/app` |
| Profile entry | `mobile/src/components/tbilisiMoves/ProfileTbilisiMovesSection.tsx` on Profile after Pets |
| Sensor adapter | `mobile/src/lib/tbilisiMoves/sensor.ts` + `.ios.ts` / `.android.ts` |
| Civil clock | `mobile/src/lib/tbilisiMoves/civilTime.js` (Asia/Tbilisi, never device-local day) |
| Origin policy | `mobile/src/lib/tbilisiMoves/originPolicy.js` |
| Sync | `mobile/src/lib/tbilisiMoves/sync.ts` + `syncPolicy.js` + scoped `storage.ts` |
| Foreground host | `mobile/src/components/tbilisiMoves/TbilisiMovesHost.tsx` |
| Tests | `membership.test.js`, `civilTime.test.js`, `originPolicy.test.js`, `syncPolicy.test.js` + expanded HTTP isolation (still skipped without local DB) |

### User-visible behaviour

- Profile → **თბილისი მოძრაობს**. No Home tile, no fifth tab, no map button.
- Feature off / schema missing: Georgian unavailable state (not a broken enroll wizard). Distinct from “not enrolled”.
- Enroll: explanation, server district list, handle + avatar, lock + public-board consents using **server `cooldownDays`** (not hard-coded 30). No GPS.
- Hub: district hero, credited/target, progress bar (fill capped at 100%, label may exceed), participants, district rank, personal contribution + cap, last successful sync, „დღის შედეგები წინასწარია“.
- In-screen switch: district board vs paginated people (`FlatList`). Dense ties. Compact tied-leader group when many rank-1. Sticky „შენი ადგილი“ when off-page. No rank for zero credit.
- Membership: current district, next change date, pending + activation, change/cancel, leave confirmation.

### Additive API fields (Phase 2 paths)

`GET /api/tbilisi-moves/status` (still **200** if tables missing):

```
clock: { timezone: 'Asia/Tbilisi', serverNow, date, dayStart, dayEnd, nextMidnight }
timezone, date, serverNow, dayStart, dayEnd, nextMidnight   // flattened
cooldownDays, competitiveCap, defaultDailyTarget, minParticipantsForRank, lateSyncGraceHours  // null if !schemaReady
ingestEligible, sync: { schemaReady, featureEnabled, enrollmentOpen, ingestionPaused, competitionPaused, ingestEligible }
```

`GET /api/tbilisi-moves/me` also returns `clock`, expanded `config` (`minParticipantsForRank`, `lateSyncGraceHours`), and `sync.ingestEligible` (enrolled and not ingestion-paused). Overview includes `clock`. Observation `PUT` contract is unchanged.

New client-facing error: `409 SAME_DAY_DISTRICT_CHANGE` (leave/rejoin cannot rewrite today’s period to a second district). `409 DISTRICT_LOCKED` now also applies to re-enrollment into a **different** district while `lockUntilDate` is in the future. Same-district rejoin keeps the original lock.

### Sensor source / dedup / manual filtering

| Platform | What we use | Manual filter | Overlap policy | Honest gaps |
|---|---|---|---|---|
| iOS HealthKit (`@kingstinct/react-native-healthkit`) | `queryStatisticsForQuantity` / `queryStatisticsForQuantitySeparateBySource` with **explicit Tbilisi midnight–intervalEnd**, not device-local day | `queryQuantitySamples` drops `HKWasUserEntered` before choosing a source | Highest **single source** statistics total. Never sum sources. Combined `cumulativeSum` is fallback | Statistics queries cannot reliably exclude user-entered samples. Denied read vs empty samples cannot always be distinguished. Not cryptographic. |
| Android Health Connect (`react-native-health-connect`) | `readRecords('Steps', between Tbilisi start/end)` + `aggregateRecord` per `dataOrigin` when present | Drop `recordingMethod === MANUAL_ENTRY` (3) | Highest single origin. Overlapping records **inside** one origin take max, not SUM | `aggregateRecord` without origin filter is not used as the scored total (it would include manuals). Empty vs denied cannot always be distinguished. |
| Expo Go / web | Unsupported | — | — | Do **not** substitute `HealthMetricDaily`, `StepLog`, or cached personal totals. |

Installation id: random UUID in **account-scoped** prefs (`medicard.tbilisiMoves.installId.{userId}`). Not IDFA/hardware.

### Sync / retry / account isolation / source conflict

- Runs only when authenticated, opted-in (`membership.enrolled`), and server `ingestEligible`.
- Triggers: after enroll (**awaited** before leaving the enroll screen); hub focus (90s throttle); app foreground and native mount (`TbilisiMovesHost` / `AppState`, skipped in Expo Go); pull-to-refresh (`force`); hub **კიდევ სცადე** when the last sync failed.
- First enroll still counts **today’s** Tbilisi-interval eligible steps (pre-enrollment walking). Yesterday during grace is queried separately; `409 NO_DISTRICT_FOR_DATE` on that extra date is skipped so today’s credit is kept.
- No background fetch, no new permission flow, no polling while backgrounded.
- Collection is serialized per `userId`. Retry the **same** observation id/payload. A new sensor reading gets a new id + `clientSequence`.
- Transient: 3 retries, 1s/2s/4s… capped 8s. Do not retry 4xx validation, `SOURCE_CONFLICT`, `NOT_ENROLLED`, `FEATURE_DISABLED`, `SCHEMA_NOT_READY`.
- 401 stops. Queue is scoped to `userId`; logout/`resetSession` increments a generation and will not PUT user A’s queue under user B.
- Server date anchors collection. Yesterday is queried **separately** while late-sync grace is open. A cumulative interval never spans two Tbilisi dates. If midnight flips during a read, the interval is collected again.
- `SOURCE_CONFLICT` is stored and shown. The client does not switch provider/installation.
- After an **accepted** observation, hub refetches ranking/own contribution (no optimistic rank).
- Unreadable / empty / manual-only is **not** submitted as 0.

### Verification (2026-09-14, Phase 3)

- Unit: `ranking`, `membership` (rejoin/clock), `civilTime`, `originPolicy`, `syncPolicy` → **25 pass**, HTTP isolation **1 skip**.
- Skip reason unchanged: `DATABASE_URL` is hosted Neon. Docker/WSL/Postgres are **not** installed on this Windows machine. Isolated DB was **not** provisioned. Hosted Neon was **not** used as a fallback. Operator SQL was **not** applied.
- Unverified against a real database: advisory locks, unique `(userId, date)` / `(userId, clientObservationId)` under concurrency, period unique `(userId, startDate)`, pending-apply transaction, leave/rejoin HTTP path.
- UI: no emulator/device screenshots this pass. No Expo Go / development-build HealthKit or Health Connect run. Native sensor fixtures were **not** used as a stand-in for real OS data.
- Platforms that still need a **development or production build + physical device**: iOS HealthKit interval/provenance, Android Health Connect origin aggregation + `recordingMethod`.

### Remaining SQL / native-build requirements

1. Operator applies `server/prisma/tbilisi-moves-phase2.sql` on the intended database (not this agent).
2. Admin enables `featureEnabled` + `enrollmentOpen` (pilot stays true).
3. Store/dev client with HealthKit / Health Connect native modules (not Expo Go) for real ingest.
4. Isolated local Postgres should be used before trusting transaction safety.

### Known blockers / next phase

No licensed district geometry → **no map**. Transaction safety on Postgres is still unverified. Isolated DB verification remains **blocked** on this machine. Recommended next step: isolated Postgres + phase2/phase4 SQL + a controlled end-to-end pilot. Map only with licensed OSM ODbL or operator shapefile.

---

## Phase 2 — what is in the tree now

Foundation behind flags. Feature/enrollment default **off**. Pilot ingest is explicit and not switchable to “verified.”

### Implemented files

| Area | Path |
|---|---|
| Prisma models | `server/prisma/schema.prisma` (`TbilisiMoves*`) |
| Operator SQL | `server/prisma/tbilisi-moves-phase2.sql` |
| Deploy notes | `server/docs/tbilisi-moves-phase2-deploy.md` |
| Domain | `server/src/lib/tbilisiMoves/*` |
| User API | `server/src/routes/tbilisiMoves.routes.js` mount `/api/tbilisi-moves` |
| Admin API | `server/src/routes/adminTbilisiMoves.routes.js` mount `/api/admin/tbilisi-moves` |
| Capabilities | `TBILISI_MOVES_VIEW` / `MANAGE` / `REVIEW` / `CORRECT` |
| Admin UI | `#/tbilisi-moves` — `server/admin/v3/modules/tbilisi-moves.js` |
| Tests | `server/src/lib/tbilisiMoves/ranking.test.js`, `server/src/lib/tbilisiMoves.http.test.js` |

No geometry route. Hunt remains unmounted. Phase 3 added `mobile/app/tbilisi-moves` (see above).

### User contracts (auth unless noted)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/tbilisi-moves/status` | optional auth; **200** even if tables missing (`schemaReady: false`) |
| `GET` | `/api/tbilisi-moves/catalog` | ACTIVE districts + enrollment flags |
| `GET` | `/api/tbilisi-moves/me` | membership + today overview |
| `PATCH` | `/api/tbilisi-moves/me` | handle / avatar only |
| `POST` | `/api/tbilisi-moves/enroll` | `{ districtId, publicHandle, publicAvatarId?, acceptLock: true, acceptPublicBoard: true }` |
| `POST` | `/api/tbilisi-moves/district-change` | pending next Tbilisi midnight |
| `POST` | `/api/tbilisi-moves/district-change/cancel` | lockUntilDate unchanged |
| `POST` | `/api/tbilisi-moves/leave` | stops new credits; history stays |
| `PUT` | `/api/tbilisi-moves/observations` | dedicated ingest; see observation contract |
| `GET` | `/api/tbilisi-moves/rounds/:date` | |
| `GET` | `/api/tbilisi-moves/rounds/:date/districts` | dense rank, exact `goalRatio` |
| `GET` | `/api/tbilisi-moves/rounds/:date/districts/:id` | + `you` |
| `GET` | `/api/tbilisi-moves/rounds/:date/districts/:id/people` | paginated + `you` row |

Feature off → `404 FEATURE_DISABLED` (except status). Missing tables → `503 SCHEMA_NOT_READY` (except status). Admin JWT on user routes → `403`.

### Observation contract (future mobile adapter)

```
PUT /api/tbilisi-moves/observations
{
  clientObservationId: uuid,
  provider: 'APPLE_HEALTH' | 'HEALTH_CONNECT',
  sourceInstallationId: string 1–80,   // metadata, not proof
  tbilisiDate: YYYY-MM-DD,
  intervalStart: iso,                  // must equal tbilisiMidnight(date)
  intervalEnd: iso,                    // (start, min(now+2min, next midnight)]
  cumulativeSteps: int 0…sanityMax,
  recordedAt: iso,
  clientSequence?: int
}
```

Reject `MANUAL` / `TYPED` / `UNKNOWN` / `OTHER` / `PEDOMETER`. A dishonest client can still spoof allowed provider strings — **pilotMode is always true** and cannot be patched false.

### Final source / correction / pause policies

- **Ledger:** `TbilisiMovesCredit` / `TbilisiMovesObservation` remain the competition tables. Owner override: those credits are filled from `HealthMetricDaily.steps` (same date) on health sync and GET `/me`. Client `PUT /observations` with a `HEALTH_METRIC_DAILY` provider label is still rejected; the server copies using `HEALTH_CONNECT` metadata.
- **One authoritative source per user/day:** first accepted `(provider, sourceInstallationId)` wins. Later different source → `409 SOURCE_CONFLICT` (no SUM, no silent switch). Ignored observation is stored with `ignoreReason`.
- **Replace, not add:** 4000 then 6200 → 6200. Same observation id + same payload → idempotent. Same id + different payload → `409 OBSERVATION_CONFLICT`. Older/out-of-order → `200 { accepted: false, reason: 'STALE' }`. Newer downward correction reduces **provisional** credit; large drop flags `DROP_CORRECTION`.
- **Cap / district:** from the **round snapshot**. Credit `districtId` frozen on first insert from membership **history** for that Tbilisi date.
- **Pause:** `ingestionPaused` is immediate. Opening a pause creates `TbilisiMovesIngestHold`. While paused, PUT → `409 INGESTION_PAUSED`. After resume, any observation whose interval overlaps a hold → `409 INGESTION_HOLD_OVERLAP`. Because intervalStart is always that day’s Tbilisi midnight, a midday pause **blocks the rest of that civil day** from later full-day cumulatives. Next Tbilisi day is clean. `competitionPaused` hides contest ranks but does not create holds.
- **Grace:** snapshotted at round open. After `graceEndsAt`, ingest is `ROUND_CLOSED`. Status stays **PROVISIONAL**. This phase does **not** write `FINALIZED` or issue badges.
- **Locks:** `lockUntilDate` is stored on enroll/apply. Changing `cooldownDays` does not rewrite existing locks.
- **Scoring edits:** operational flags immediate; cap/target/grace/minParticipants/cooldown apply to **unopened** rounds only.

### Admin

`#/tbilisi-moves?tab=overview|districts|rules`. Capabilities on **every** admin endpoint. Mutations require `revision` (`409 CONFIG_STALE` / `DISTRICT_STALE`). Audit via `writeAdminAudit`; **reason lives in `newValue.reason`**. No finalize / exclude / rewards buttons.

### SQL apply (operator; do not run on shared Neon unless asked)

```bash
cd server
npx prisma db execute --file prisma/tbilisi-moves-phase2.sql --schema prisma/schema.prisma
npx prisma generate
```

Seeds `ON CONFLICT DO NOTHING`. Render `release` does not apply this file. Rollback drop order is in `server/docs/tbilisi-moves-phase2-deploy.md`.

### Verification (2026-09-14)

- `npx prisma generate` after stopping the local `--watch` API (Windows DLL lock).
- `node --test src/lib/tbilisiMoves/ranking.test.js src/lib/tbilisiMoves.http.test.js` → **12 pass, 1 skip**.
- Skip reason: `DATABASE_URL is not a local/test database; hosted Neon is not used for integration tests`. Transaction/constraint safety was **not** executed against a database.
- Admin UI: module + nav wired; live `#/tbilisi-moves` needs a running local API. Device testing not performed.
- SQL was **not** executed against hosted Neon.

### Chosen defaults (previously open)

| Topic | Choice |
|---|---|
| Clock skew | 2 minutes |
| People page | default/max 50 |
| Leave | allowed; re-join is a new lock |
| Same-day re-join | today’s period updated if it started today |
| Rank load | in-memory dense rank of **positive** contributors for that district-day (MVP scale) |
| `sanityMaxRawSteps` / `correctionDropFlagPct` | in config + rules form; immediate; not a verified-mode switch |

### Deferred (not Phase 2; Phase 3 mobile is now in the tree)

Finalization job, badge grants, contribution moderation, geometry/`GET /geometry`, scheduler/cron, version bump.

### Exact Phase 4 scope

**Implemented in this revision:** finalization, cosmetic rewards, admin operations, history, runner command. **Map remains later**, only when licensed district boundaries are in-tree. Still no Hunt, no coins, no `HealthMetricDaily` ledger, no invented polygons.

---

## Phase 1 — what this document is

A verified audit of the current repository plus a proportionate MVP design: district membership, daily district goals, capped individual boards, honest step ingestion, admin control, cosmetic rewards, and a Tbilisi map that uses real district boundaries.

**No code in `mobile/` or `server/src/` was added or changed for this feature in this phase.**

---

## A. Verified repository findings

Repo shape: Expo Router app in `mobile/` (routes in `mobile/app/` only), Express + Prisma in `server/`, admin as static V3 HTML/JS under `server/admin/`, Postgres on Neon, Render web + one pharmacy cron (`render.yaml`). No shared npm package. Metro must not import repo-root.

### A.1 Stack (reuse, do not replace)

| Concern | Actual path | What it is |
|---|---|---|
| Mobile | `mobile/` Expo SDK 57, Expo Router, NativeWind v4, React 19 | Product app |
| API | `server/src/server.js` Express | JWT `requireAuth` |
| DB | `server/prisma/schema.prisma` PostgreSQL / Neon | Additive SQL, not `db push` on hosted |
| Admin UI | `server/admin/index.html` + `admin-v3.js` + `v3/modules/*.js` | Hash routes `#/overview` … `#/settings` |
| Admin auth | `server/src/middleware/adminAuth.js` | JWT `role === 'admin'` → `req.admin` |
| Admin RBAC | `server/src/lib/adminCapabilities.js` | `capabilities: Json?`; `null` = full legacy access. **Enforced only on** `adminRewards.routes.js` today. Main `admin.routes.js` is `requireAdmin` only. Sidebar does **not** hide tabs by capability. |
| Audit | `server/src/lib/adminAudit.js` `writeAdminAudit` | `AdminAuditLog`; secrets scrubbed; **no `reason` column** — put exclusion/correction reason in `newValue` |
| Civil dates (product) | `server/src/lib/checkIn.js` `tbilisiYmd`; `adminAnalyticsRange.js` `tbilisiMidnight` / `TBILISI_OFFSET = '+04:00'` | Georgia has no DST |
| Next midnight | `server/src/lib/usageWindow.js` `nextTbilisiMidnight` | Quota reset already uses this |
| Validation | Zod in routes (`health-metrics.routes.js`, `admin.routes.js`) | Bounded numbers, ISO dates |
| Ownership 404 | `server/src/lib/ownerAccess.js` | Miss or wrong owner → Georgian 404, not 403 |
| Account wipe | `server/src/lib/deleteUser.js` | User row cascade; extra unlink for uploads |
| Tests | `server/package.json` `npm test` → `node --test` explicit file list | Isolation HTTP tests skip unless local DB |
| Deploy | `render.yaml` `preDeployCommand: npm run release` = `prisma generate` + `seed` | **Does not apply SQL** |
| Store version | `mobile/app.json` `expo.version` `1.0.0.8.24` | Bump only when store-facing UI ships |

### A.2 Steps: origin → server (this is not a trusted competition pipeline)

**Mobile origin**

| Platform | File | Behaviour |
|---|---|---|
| iOS | `mobile/src/lib/healthSyncPlatform.ios.ts` `fetchStepsNative` | HealthKit `queryStatisticsForQuantity(StepCount, cumulativeSum)` per **device-local** day; optional hourly collection for today; fallback raw samples aggregated by local day |
| Android | `mobile/src/lib/healthSyncPlatform.android.ts` `fetchStepsNative` | Health Connect `readRecords('Steps')` after `since`; each record `{ at, count }` — **not** marked `daily` |
| Gate | `mobile/src/lib/healthSync.shared.ts` | Pref `medicard.health.sync.enabled`; Expo Go cannot read native health |
| Capability | `PUT /api/health-metrics/steps/capability` | `StepTrackingCapability` — status + coarse source only. Comment in schema: “No device hardware identifiers.” |
| Sync trigger | `mobile/src/lib/healthMetrics.ts`, `stepsMetrics.ts` | Foreground read when screens load. `void syncNativeHealthToServer(...)`. **No** `BackgroundFetch` / `TaskManager` step job |

Payload builder: `mobile/src/lib/healthMetricsStorage.ts` `buildSyncPayloadFromNative`.

- Daily HealthKit totals (`sample.daily === true`) become `daily[].steps` and are **excluded** from `stepLogs`.
- Non-daily samples (Android records, iOS hourly) become `stepLogs[]`.
- Device calendar day = `ymd(new Date(s.at))` in **device local TZ**, not Asia/Tbilisi.

**Server ingest** — `server/src/routes/health-metrics.routes.js` `POST /api/health-metrics/sync` (`requireAuth`):

- `daily[].steps`: int 0…200_000. `mergeDaily` uses **`Math.max`** with the existing row (`@@unique([userId, date])`).
- `stepLogs[]`: `createMany({ skipDuplicates: true })` on `StepLog @@unique([userId, recordedAt])`, then **SUM** logs whose `recordedAt` falls in a **UTC** window `dateT00:00Z`–`dateT23:59Z` derived from `at.slice(0, 10)` (UTC date, not Tbilisi, not device local), then `Math.max` that sum onto `HealthMetricDaily.steps`.
- `mergeDaily` **always** writes `source: 'merged'`. Schema comment allows `device | manual | merged`, but live writes do not preserve a manual/device split.
- **In-app typed steps exist.** `mobile/src/lib/logManualHealthMetric.ts` + `HealthMetricLogSheet` (`key: 'steps'`) POST `daily.steps` **and** a `stepLog` `{ at: now ISO, count }` for today (device-local `todayYmd`). Server still labels that StepLog `source: 'device'`. A competition cannot tell typed totals from HealthKit/Connect totals from stored rows.
- `emptyStoredDaily` on the client also defaults `source: 'manual'` for **local cache placeholders** — not authoritative.
- No transaction around the find-then-upsert loop. Concurrent syncs can race (last write wins on the row; unique key prevents duplicates but not lost merges).
- Failed sync: local cache only; **no durable retry queue** for steps (`pushHealthToServer` swallows errors).
- After step touch: `refreshQuestProgressForUser(..., QuestSignal.STEPS_CHANGED)`.
- `expo-sensors` / `Pedometer` is in `mobile/package.json` but **unused**. Medi Run `estimateSteps` in `mobile/src/lib/run/store.ts` does **not** write `HealthMetricDaily`.

**What Quest actually uses:** `server/src/lib/quest.js` `computeQuestProgress` reads `HealthMetricDaily.steps` for the quest `periodKey` (user TZ with Tbilisi **fallback** via `questTime.js`). Step quests assign only when `StepTrackingCapability.status === AVAILABLE`.

**Personal health UI** retains the uncapped total: Home steps (`HomeStepsAreaChart`), `/health-metrics/steps/*`, Smart Quest movement cards. That must stay true for Tbilisi Moves.

**Evidence actually available today**

| Question | Evidence |
|---|---|
| Can we tell Health Connect manual entry from sensor? | **No.** Android mapper ignores `recordingMethod`. |
| Can we tell HealthKit manual / other-app sources? | **No.** Statistics query has no source filter. Cycle flow code reads some HK metadata; steps do not. |
| Can we tell **in-app typed** steps from sensor sync? | **No.** `logManualHealthMetric('steps')` uses the same sync endpoint; StepLog is always `device`; daily `source` becomes `merged`. |
| Device / watch vs phone? | **No** hardware id. Capability source is `APPLE_HEALTH` \| `HEALTH_CONNECT` \| `OTHER` \| `UNKNOWN` only. |
| Duplicate cumulative totals (4 000 then 6 200)? | Daily `max` path: **6 200**, not 10 200. Android `stepLogs` SUM of overlapping records from phone+watch **can** over-count before the daily max. |
| Idempotent retries? | Daily max: yes for identical/higher totals. `stepLogs` skipDuplicates on timestamp. Concurrent requests: not serialized. |
| Stale vs correction downward? | **Blind max.** A later legitimate 8 000 after a wrong 12 000 **cannot** decrease `HealthMetricDaily.steps`. |
| Background late sync? | Only when the app is opened and a metrics/steps screen (or similar) runs `fetchStepsNative`. |
| Day boundary? | Device local on client; UTC slice on `stepLogs` aggregate; Quest period TZ ≠ competition TZ. **Not** Asia/Tbilisi. |
| Anti-cheat? | None. Sanity caps exist (200k daily, 100k per stepLog). Smart Quest has a 100k baseline ceiling — unrelated to competition integrity. |

**Honest conclusion:** reuse `HealthMetricDaily` as the **personal health** store. Do **not** treat it as the competition ledger. MVP ingestion for თბილისი მოძრაობს must be a **separate, Tbilisi-dated, idempotent credit** with a documented **pilot trust model** (cosmetic rewards, admin review, no anti-cheat claim).

### A.3 Admin (reuse)

| Piece | Path |
|---|---|
| Shell / nav | `server/admin/index.html` (groups + `data-tab`), `admin-v3.js` |
| Current tabs | overview, users, push, health, ai, rewards, packages, orders, sms, pharmacy, quality, cycleqa, audit, settings |
| New module pattern | `server/admin/v3/modules/<name>.js` + cache-bust `?v=` on the script tag in `index.html` |
| Tab shell width | `AGENTS.md` — `.v3-tab-shell`; tablist and pane same left/right edges |
| Settings today | `AppSettings` singleton `id="default"`: maintenance, min version, force update, registrations, QA OTP, support email. **No JSON blob for feature flags.** `PATCH /api/admin/settings` allowlists those columns only (`admin.routes.js`) |
| Health tab | Feature-usage aggregates only (`v3/modules/health.js`). Not a person-level step inspector. Copy already says this is not live user health. |
| Rewards RBAC | `REWARDS_VIEW` / `REWARDS_MANAGE` / … via `requireAdminCapability` on `adminRewards.routes.js` |
| Hunt leftover | `server/src/lib/hunt/*`, `adminHunt.routes.js`, `v3/modules/hunt.js` exist on disk; **`server.js` does not mount `/api/hunt` or `/api/admin/hunt`**. Hunt tables were dropped in `server/prisma/migrations/20260914180000_drop_medi_hunt/migration.sql`. **Do not revive Hunt.** Mapbox WebView + `writeAdminAudit` patterns may be copied. |
| Dates | `fmtDate` / `adminDateParts` — Georgian months, Asia/Tbilisi |

### A.4 Maps, location, identity

| Piece | Finding |
|---|---|
| Map stack | **Mapbox GL JS v3.8.0 in a WebView** — `mobile/src/components/run/RunMap.tsx` + `mobile/src/lib/run/mapHtml.ts`. Hunt used the same. Admin user geo: `command-center-v3.js` + `server/src/lib/adminUserGeo.js`. Token: `MAPBOX_PUBLIC_TOKEN` → `GET /api/app/status` `mapboxToken`. |
| Leaflet | Only `mobile/src/lib/visitMapHtml.ts` (visit place). Do not add as a second product map. |
| `react-native-maps` | **Not** a dependency. Do not introduce it. |
| District polygons | **None in the repo.** No GeoJSON, no raioni catalog. |
| User GPS | `UserLocation` (`server/src/lib/userLocation.js`) — city/country at **grant**, Nominatim ka. Heartbeat must not rewrite home place. Expo reverse-geocode may expose a `district` string (`userLocation.ts` / `geoPlace.ts`); it is used only as a **city-name fallback** and is **not persisted** as a Tbilisi raioni. Product rule: membership is explicit; GPS must not auto-select. |
| Public name | `User.fullName` is the account legal name. UI first name = `accountFirstName` / `fullName.split`. **Not** a public handle. |
| Avatar | Cosmetic `avatarId` in `HealthProfile.extraAnswers` (`mobile/src/constants/avatarAssets.ts`). Fine as a public picture **after opt-in**; never medical. |
| Reduced motion | `mobile/src/hooks/usePrefersReducedMotion.ts` |
| Empty / offline | `EmptyState.tsx`, `OfflineBanner.tsx` (`useOffline`) |
| Typography | Georgian copy in `mobile/src/i18n/ka.ts`; voice guide `docs/GEORGIAN_STYLE_GUIDE.md`. **Mobile UI font is Noto Sans Georgian** (`NotoSansGeorgian_*`), not FiraGO. FiraGO is landing/admin web (`server/public/landing.css`, admin). Theme tokens: `mobile/src/theme/colors.ts` + `mobile/global.css` (cool gray-950 dark). |
| Modals | `APP_MODAL_PROPS` fade only |
| Pressable | Static `style` objects — NativeWind drops function-form styles |
| Home order | `mobile/src/lib/home/homeSectionOrder.ts` — frozen list; Quest/Pets/Lab already moved off Home. **Do not add a Home section in MVP.** |
| Entry analogue | `ProfilePetsSection` + `Stack.Screen name="pets"` in `mobile/app/_layout.tsx` |

### A.5 Rewards / economy (do not mix)

| System | Use for Tbilisi Moves? |
|---|---|
| `RewardLedger` / Medi Coins / XP | **No.** Commercial + Quest economy. |
| `AchievementDefinition` MOVE series | Completing step **quests**, pays XP/coins. **Do not** auto-unlock these from district walking. |
| Rewards Store / `UserRewardEntitlement` | Coin spend and purchased perks. **No.** |
| `PointAward` | Retired login/steps points (`checkIn.js` `DAILY_LOGIN_POINTS = 0`). Unique `(userId, kind, ref)` is a useful **idempotency pattern** only. |
| **`MediJourneyUnlock`** | Economy-free cosmetics (`mediCompanion/service.js` does not write `RewardLedger`). Closest existing pattern to copy for badge grants — **new table still**; do not overload Journey milestones. |
| Quest rarity tokens | Visual language may be echoed; do not spend coins. |

MVP rewards = **new** idempotent grants (badge keys), issued only after round finalization, configurable from admin, never cash / coins / medical incentives.

### A.6 Confirmed missing capabilities

1. Competition ledger (Tbilisi-dated eligible steps, cap, district snapshot).
2. Enrollment, 30-day lock, pending midnight switch.
3. District catalog + licensed geometry.
4. Public display handle (separate from `fullName`).
5. Competition opt-in + visibility copy.
6. Admin: rollout, dual pause, targets, cap, grace, min participants, review/exclusion, round inspector, dashboard.
7. Finalization job (Render has only `medicard-pharmacy-sync` cron).
8. Provenance / anti-cheat (will remain limited — see H).
9. Background step sync.
10. GeoJSON asset in-tree.

---

## B. Reuse vs build

### B.1 Reuse

- Auth: `requireAuth` / `requireAdmin` / `requireAdminCapability`.
- Tbilisi clock: `tbilisiYmd`, `tbilisiMidnight`, `nextTbilisiMidnight`, `addDaysYmd` (`adminAnalyticsRange.js`, `usageWindow.js`).
- Idempotent unique keys: `DailyCheckIn (userId, date)`, `HydrationIntakeEvent (userId, clientEventId)`, `RewardLedger (userId, currency, sourceType, sourceId)`.
- Snapshot-not-rewrite: Quest assignment freezes `target` + `metadata.smart` (`quest.js`).
- Hydration **snapshot MAX** comments in `hydrationSync.js` — same “retries must not add” idea; competition still needs **correction policy**, not max-only.
- Audit: `writeAdminAudit`.
- Admin module + `.v3-tab-shell`.
- Mapbox token + WebView choropleth (new HTML builder beside `mapHtml.ts`, do not overload Run chase-cam).
- UI: `Card`, `Button`, `EmptyState`, `HomeSectionTitle`, `APP_MODAL_PROPS`, `usePrefersReducedMotion`, `ka.ts`, theme tokens.
- `schemaReady: false` → 503 pattern (`petsOwnership.js` / Hunt lesson): missing tables must not 500.
- Account delete cascade via `onDelete: Cascade` on `userId` FKs; hook `deleteUser.js` only if non-cascaded files exist (none expected).
- Socket.IO `user:${userId}` is optional UX (Quest). Leaderboards stay HTTP-reconciled.

### B.2 Do not reuse as the competition source of truth

- `HealthMetricDaily.steps` / `StepLog` (wrong TZ, max-only, SUM overlap, no provenance).
- `UserLocation.cityKa` (not a district; grant-only city).
- `AppSettings` columns (no room; do not stuff JSON into unrelated fields).
- HuntConfig / HuntSuspicious / HuntSession.
- Quest templates / achievements / rewards store.
- Home `steps` section (personal health).

### B.3 New (MVP-sized)

Isolated domain: `server/src/lib/tbilisiMoves/` + `server/src/routes/tbilisiMoves.routes.js` + `adminTbilisiMoves.routes.js` + `mobile/app/tbilisi-moves/` + `ka.tbilisiMoves`. One admin hash `#/tbilisi-moves`. Not a generic competition platform.

---

## C. Entities, relationships, indexes

Additive Prisma models. Hosted apply: `server/prisma/tbilisi-moves-phase2.sql` via `npx prisma db execute` (same as `pets-phase2.sql`). **Never** `prisma db push` on Neon. Do not invent `_prisma_migrations` history.

Civil keys are `YYYY-MM-DD` **Asia/Tbilisi** strings unless noted as `DateTime`.

### C.1 Catalog & config

**`TbilisiMovesDistrict`** — seed the 10 Tbilisi raioni (legal units; Matsne decree on boundaries: [matsne.gov.ge/ka/document/view/2602696](https://matsne.gov.ge/ka/document/view/2602696)). OSM wiki admin_level 9: გლდანი, დიდუბე, ვაკე, ისანი, კრწანისი, მთაწმინდა, ნაძალადევი, საბურთალო, სამგორი, ჩუღურეთი.

| Field | Notes |
|---|---|
| `id` | uuid |
| `slug` | unique: `gldani`, `didube`, `vake`, `isani`, `krtsanisi`, `mtatsminda`, `nadzaladevi`, `saburtalo`, `samgori`, `chughureti` |
| `nameKa` | e.g. `საბურთალო` |
| `sortOrder` | stable display / tie-break |
| `status` | `ACTIVE` \| `ARCHIVED` — **no hard delete** once referenced by history |
| `dailyTargetOverride` | nullable int; null → global default |
| `geometryVersion` | string; matches bundled GeoJSON version or null if list-only |
| `mapFillHint` | optional token; not medical color |

**`TbilisiMovesConfig`** — singleton `id = "default"` (like `AppSettings`).

| Field | Proposed default | Bounds |
|---|---|---|
| `featureEnabled` | false | rollout master |
| `enrollmentOpen` | false | can enroll / change |
| `ingestionPaused` | false | see D.6 |
| `competitionPaused` | false | see D.6 |
| `rewardsEnabled` | true | cosmetic issue after finalize |
| `pilotMode` | **true** | honest copy; no anti-cheat claim |
| `defaultDailyTarget` | 100_000 | 1_000…50_000_000 (100k is **illustrative**, not a code constant forever) |
| `competitiveCap` | 10_000 | 1_000…50_000 |
| `cooldownDays` | 30 | 1…365 |
| `minParticipantsForRank` | 5 | 1…10_000 |
| `lateSyncGraceHours` | 8 | 1…24 |
| `sanityMaxRawSteps` | 80_000 | 20_000…200_000 |
| `correctionDropFlagPct` | 40 | 10…90 — drops larger than this while provisional → review flag, still applied |
| `geometryAssetVersion` | `tbilisi-districts-v1` or null | |
| `updatedAt` | | |

No executable formulas. No eval. Numeric bounds enforced server-side with Zod.

### C.2 Membership

**`TbilisiMovesMembership`** — 1:1 `userId`.

| Field | Notes |
|---|---|
| `userId` | PK, FK User cascade |
| `status` | `ACTIVE` \| `LEFT` |
| `optedInAt` | competition + public-board consent |
| `districtId` | current **effective** district |
| `publicHandle` | 2–24 Georgian/Latin letters/digits/spaces; unique **among opted-in** recommended but not required for MVP; never `fullName` |
| `publicAvatarId` | copy of cosmetic avatar id at opt-in (may update later without touching health) |
| `enrolledAt` | first confirmed select |
| `lockUntilDate` | Tbilisi `YYYY-MM-DD` — first day a **new** change may be **requested** (see D.2) |
| `pendingDistrictId` | nullable |
| `pendingEffectiveDate` | Tbilisi date when pending becomes current (the next Tbilisi calendar day after request) |
| `pendingRequestedAt` | |
| `leftAt` | |

### C.3 Daily rounds & credits

**`TbilisiMovesRound`** — one city day.

| Field | Notes |
|---|---|
| `id` | uuid |
| `date` | unique `YYYY-MM-DD` Tbilisi |
| `status` | `PROVISIONAL` \| `FINALIZED` |
| `rulesSnapshot` | JSON: cap, defaultTarget, graceHours, minParticipants, cooldownDays, pilotMode, rewardsEnabled **at round open** |
| `districtTargetsSnapshot` | JSON map `districtId → target` resolved at open |
| `openedAt` | Tbilisi midnight of `date` |
| `graceEndsAt` | `openedAt` + 24h + graceHours (end of that Tbilisi day + grace) |
| `finalizedAt` | |
| `ingestionPausedAtOpen` / `competitionPausedAtOpen` | booleans copied at open |

Open the round lazily on first enroll/ingest/read for that Tbilisi date, or via sweeper. Snapshot **once**; later config edits do not mutate it.

**`TbilisiMovesDistrictDay`** — per district per round (aggregates; can be rebuilt from credits until finalized, then frozen).

| Field | Notes |
|---|---|
| unique `(roundId, districtId)` | |
| `target` | from snapshot |
| `eligibleStepsSum` | sum of non-excluded credits |
| `contributorCount` | users with eligibleSteps > 0 |
| `enrolledCount` | membership effective that date |
| `goalPct` | `eligibleStepsSum / target` (may be > 1) |
| `rank` | nullable if below min participants **or** competition paused display |
| `goalReached` | eligibleStepsSum >= target |

**`TbilisiMovesCredit`** — **the competition ledger**. One row per user per Tbilisi date.

| Field | Notes |
|---|---|
| unique `(userId, date)` | **prevents double-credit** across enroll, district change, retries, rule edits |
| `roundId` | |
| `districtId` | district **credited that date** — never rewritten when membership changes later |
| `rawObservedSteps` | last accepted observation (uncapped), for admin |
| `eligibleSteps` | `min(raw, capSnapshot)` unless excluded → 0 |
| `capSnapshot` | cap in force that round |
| `source` | `APPLE_HEALTH` \| `HEALTH_CONNECT` \| `UNKNOWN` |
| `clientObservationId` | idempotency (optional unique `(userId, clientObservationId)`) |
| `observedAt` | client clock, informational |
| `acceptedAt` | server |
| `excludedAt` / `excludedReason` / `excludedByAdminId` | admin exclusion; **does not** touch `HealthMetricDaily` |
| `flaggedAt` / `flagReason` | suspicious, still counts until excluded |
| `correctionCount` | |

**`TbilisiMovesObservation`** — append-only ingest log (audit of what was submitted). Unique `(userId, clientObservationId)`. Not summed. Latest accepted row drives the credit.

### C.4 Rewards & admin review

**`TbilisiMovesRewardDef`** — `key` unique (`daily_individual_leader`, `district_goal_contributor`), `active`, titles ka, no coins.

**`TbilisiMovesRewardGrant`** — unique `(userId, rewardKey, date, districtId)` so finalize/retries/admin re-issue are idempotent. `revokedAt` for corrections.

**`TbilisiMovesAdminAction`** — optional; primary audit remains `AdminAuditLog` with `targetType: 'tbilisi_moves'`. Preview payload stored in `previousValue` / `newValue`. `AdminAuditLog` has **no reason column**; required exclusion/correction `reason` lives in `newValue.reason` (same pattern as rewards inventory adjust). Zod-require a non-empty reason on those POSTs.

### C.5 Indexes

- `TbilisiMovesCredit (date, districtId, eligibleSteps DESC)` — district board
- `TbilisiMovesCredit (date, eligibleSteps DESC)` — city-wide ops
- `TbilisiMovesCredit (userId, date)` unique
- `TbilisiMovesMembership (districtId, status)`
- `TbilisiMovesRound (date)` unique
- `TbilisiMovesDistrictDay (roundId, goalPct DESC)`

---

## D. Daily lifecycle

Clock: **Asia/Tbilisi only**. Device TZ is ignored for competition dates. Georgia offset `+04:00`, no DST (`adminAnalyticsRange.js`).

### D.1 Enrollment (first time)

Preconditions: `featureEnabled`, `enrollmentOpen`, `schemaReady`, user `ACTIVE`, step capability **not** required to pick a district (required to **contribute**).

1. User opens თბილისი მოძრაობს → copy explains: activity not medical; public handle+avatar only; 30-day lock; walking **anywhere** counts for the chosen raioni; GPS is not used.
2. Pick district → confirmation sheet repeats lock (`cooldownDays` from live config) and next eligible **request** date.
3. Confirm: `districtId` **effective immediately**, including **today** if today has no credit yet. `lockUntilDate = addDaysYmd(tbilisiYmd(now), cooldownDays)`. `optedInAt` now. Handle required before the membership is `ACTIVE` for public boards.
4. Today’s eligible steps may count **once** (`unique userId+date`). If they already had a credit today (should not happen on first enroll), do not insert a second.

After confirm, show `nextChangeEligibleOn = lockUntilDate` (that Tbilisi date at 00:00 — they may **request** a change on that morning; it still takes effect the **following** midnight — see D.2).

### D.2 Subsequent district change

| Case | Behaviour |
|---|---|
| `tbilisiYmd(now) < lockUntilDate` | 409 `DISTRICT_LOCKED`; show lockUntilDate |
| Pending already exists | 409 `CHANGE_PENDING`; offer cancel |
| `enrollmentOpen` false | 409 |
| Target `ARCHIVED` | 400 |
| Request at Tbilisi time `T` | `pendingEffectiveDate = addDaysYmd(tbilisiYmd(T), 1)` (next Tbilisi calendar date). Until that midnight, credits stay on **current** `districtId`. |
| Request at exactly 00:00:00 Tbilisi | Still “next” midnight = end of that civil day. Same-day steps stay on the old district. |
| Cancel pending | Allowed while `now < tbilisiMidnight(pendingEffectiveDate)`. Clears pending. **Does not** change `lockUntilDate`. |
| Apply pending | Sweeper or lazy on first request after midnight: set `districtId = pending`, clear pending, `lockUntilDate = addDaysYmd(pendingEffectiveDate, cooldownDays)`. |
| Historical credits | Untouched. |

**Cooldown config edits:** existing `lockUntilDate` values stay. New `cooldownDays` applies only to **future** lock computations (next successful apply). Rounds snapshot the cooldown in `rulesSnapshot` for audit, not for rewriting locks.

**Leave competition:** stops new credits and public listing; historical rows remain; health metrics untouched. Re-join is a new enrollment (new lock). Product default: leave allowed; cooldown does not block leaving.

### D.3 Ingestion (pilot)

Endpoint: `PUT /api/tbilisi-moves/observations` (auth). Body:

```
{
  clientObservationId: string,      // uuid, unique per user
  tbilisiDate: YYYY-MM-DD,          // must equal server tbilisiYmd(now) OR a still-provisional past date within grace
  observedSteps: int,               // cumulative day total from HealthKit/HC, not a delta
  source: APPLE_HEALTH | HEALTH_CONNECT | UNKNOWN,
  observedAt: iso datetime
}
```

Server:

1. Reject if `!featureEnabled` or `ingestionPaused` → 409 `INGESTION_PAUSED` (personal `/api/health-metrics/sync` still works).
2. Reject if no ACTIVE membership with opted-in.
3. Resolve `tbilisiDate`: **server wins**. If client date ≠ allowed set, 400 `DATE_MISMATCH`.
4. Ensure round exists; if `FINALIZED`, reject late data with 409 `ROUND_FINALIZED` (do not silently rewrite winners).
5. Idempotency: same `clientObservationId` → return current credit (no add).
6. **Never SUM** observations. Latest accepted total **replaces** `rawObservedSteps`.
7. **Primary source:** `StepTrackingCapability.source` if AVAILABLE; if observation source disagrees, flag `SOURCE_MISMATCH`, still accept in pilot (do not invent a second stream).
8. **Corrections (provisional only):**
   - Increase: accept if `<= sanityMaxRawSteps`; if `> competitiveCap` still store raw, eligible = cap.
   - Decrease: accept (provider correction). If drop ≥ `correctionDropFlagPct`, set `flagReason=DROP_CORRECTION`.
   - Do **not** use blind max as the only rule.
9. `eligibleSteps = excluded ? 0 : min(raw, capSnapshot)`.
10. Attach `districtId` = membership **effective for that date**:
    - If `date < pendingEffectiveDate` (or no pending): current `districtId`.
    - If applying historical grace for **yesterday** and pending applied at yesterday’s midnight: use the district that was effective **on that date** (store effective district on the credit at first insert; never move it).
11. Recompute that district-day aggregates if round still PROVISIONAL.
12. Do not write `HealthMetricDaily`.

Client adapter (Phase 2+): after native fetch, convert the **Tbilisi** day’s cumulative total (query HealthKit/HC with Tbilisi midnight bounds, not device local) and PUT here. Personal health screens keep existing device-local sync.

4 000 then 6 200 → credit 6 200. Retry of 6 200 → 6 200. Two devices: one credit row, last accepted observation, flag if interleaved sources.

### D.4 Ranking

- District rank: `goalPct = eligibleStepsSum / target` descending. Target from **round snapshot**. Dense rank: equal pct → equal rank. Display order: pct DESC, `sortOrder` ASC, `slug` ASC.
- If `contributorCount < minParticipantsForRank`: `rank = null` (unranked). Still show progress, participants, steps. Do not invent a place.
- Individual (within selected district): `eligibleSteps` DESC, dense rank, display order steps DESC, handle ASC, userId ASC. Persistent **your row** even outside top N (default top 50).
- Copy: „რაიონების აქტივობა“, „ნაბიჯების მიზანი“, never ჯანმრთელობა as the ranking axis.
- Progress > 100%: numeric pct shown; bar/map fill saturates at 100% plus an “exceeded” chip (`+12%`). Do not clip the number to 100. Do not use medical-red for high activity.

### D.5 Finalization & rewards

`graceEndsAt = tbilisiMidnight(date+1) + lateSyncGraceHours`. Default 8h → 08:00 Tbilisi next morning. Client clocks never decide whether finalization is allowed.

Finalize (idempotent, shared by admin and `scripts/tbilisi-moves-finalize.js`):

1. Refuse before the snapshotted grace deadline (`DAY_STILL_OPEN` / `GRACE_ACTIVE`).
2. Lock the round; rank from **eligible** credits (`excludedAt` null, `eligibleSteps > 0` for people).
3. Persist `TbilisiMovesResultRevision` + award entitlements; mark `FINALIZED` only when both are complete.
4. If `rulesSnapshot.rewards` is missing → **no awards**. If `rewardsEnabled` is false or competition is paused (live or at open) → finalize without awards.
5. **District individual leaders:** dense ranks `1..leaderRewardedRanks` (default 3) **in each district**. All ties at a rewarded rank qualify.
6. **District-goal badge:** every positive eligible contributor of a district that hit its snapshotted target **and** `minParticipantsForRank`.
7. Unique `(userId, date, awardKey, districtId)`. Correction revokes obsolete ACTIVE rows and reactivates newly earned ones.

After finalize: public APIs return the **latest published snapshot**, never today’s live cache. Exclude after finalize does not rewrite that snapshot until an audited correction. Copy: „შედეგი დაფიქსირდა“; if `revision > 1`, „შედეგი კორექტირებულია“.

### D.6 Pause controls

| Flag | New enroll | Ingest | Live board | In-flight round | Personal health |
|---|---|---|---|---|---|
| `featureEnabled=false` | no | no | 404/hidden | no new rounds | unchanged |
| `enrollmentOpen=false` | no (existing stay) | yes | yes | normal | unchanged |
| `ingestionPaused` | n/a | reject | last provisional numbers, stale label | still finalizes with what it has | unchanged |
| `competitionPaused` | no | yes unless ingest paused | show paused state, no ranks as a contest | finalize without issuing rewards | unchanged |

### D.7 Rule changes vs history

Config writes apply to **future** rounds (and today’s round **only if it has not been opened yet**). Once `TbilisiMovesRound` exists for a date, its snapshots are immutable except via audited admin “replace snapshot before finalize” (preview + reason; rare). Ordinary edits never recalc old `goalPct`.

---

## E. API contracts

Mount: `app.use('/api/tbilisi-moves', tbilisiMovesRouter)` next to pets. Admin: `app.use('/api/admin/tbilisi-moves', ...)` with `requireAdmin` + capabilities.

### E.1 Mobile (Bearer user JWT; admin JWT 403 like other user routes)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/tbilisi-moves/status` | optional auth | `{ schemaReady, featureEnabled, enrollmentOpen, ingestionPaused, competitionPaused, pilotMode, date, serverNow }` — 200 even if table missing (`schemaReady: false`) |
| `GET` | `/api/tbilisi-moves/catalog` | auth | districts ACTIVE, no geometry required |
| `GET` | `/api/tbilisi-moves/me` | auth | membership, lock, pending, handle, capability, lastSync |
| `POST` | `/api/tbilisi-moves/enroll` | auth | `{ districtId, publicHandle, acceptLock, acceptPublicBoard }` |
| `POST` | `/api/tbilisi-moves/district-change` | auth | `{ districtId, acceptLock }` → pending |
| `POST` | `/api/tbilisi-moves/district-change/cancel` | auth | |
| `PATCH` | `/api/tbilisi-moves/me` | auth | handle/avatar only |
| `PUT` | `/api/tbilisi-moves/observations` | auth | see D.3 |
| `GET` | `/api/tbilisi-moves/rounds/:date` | auth | `{ status, graceEndsAt, lastAggregatedAt, rules: public subset }` |
| `GET` | `/api/tbilisi-moves/rounds/:date/districts` | auth | ranks, pct, steps, participants, `unranked` flag. **No** medical fields |
| `GET` | `/api/tbilisi-moves/rounds/:date/districts/:id` | auth | detail + `you` contribution |
| `GET` | `/api/tbilisi-moves/rounds/:date/districts/:id/people` | auth | top 50 public handles + `you` row. Opt-in users only |
| `GET` | `/api/tbilisi-moves/history` | auth | paginated rounds; never invents missing dates |
| `GET` | `/api/tbilisi-moves/results/:date` | auth | published snapshot if FINALIZED, else live + lifecycle. `source: published\|live` |
| `GET` | `/api/tbilisi-moves/awards` | auth | published entitlements only |
| `GET` | `/api/tbilisi-moves/geometry` | auth | GeoJSON URL or inline if small; 404 if unpublished |

Never return: `fullName`, email, phone, birthDate, HealthMetricDaily, meds, cycle.

Owner id always `req.user.id`.

### E.2 Admin

Capabilities (add to `adminCapabilities.js`; legacy `null` still full access):

- `TBILISI_MOVES_VIEW`
- `TBILISI_MOVES_MANAGE` (config, districts, pauses)
- `TBILISI_MOVES_REVIEW` (flags, exclude/reinstate)
- `TBILISI_MOVES_CORRECT` (preview corrections, republish — gated)

| Method | Path | Cap |
|---|---|---|
| `GET` | `/api/admin/tbilisi-moves/overview` | VIEW |
| `GET/PATCH` | `/api/admin/tbilisi-moves/config` | VIEW / MANAGE |
| `GET/PATCH` | `/api/admin/tbilisi-moves/districts/:id` | VIEW / MANAGE |
| `POST` | `/api/admin/tbilisi-moves/districts/:id/archive` | MANAGE |
| `GET` | `/api/admin/tbilisi-moves/rounds` | VIEW |
| `GET` | `/api/admin/tbilisi-moves/rounds/:date` | VIEW |
| `POST` | `/api/admin/tbilisi-moves/rounds/:date/finalize/preview` | VIEW |
| `POST` | `/api/admin/tbilisi-moves/rounds/:date/finalize` | MANAGE — `{ previewHash, revision }` |
| `POST` | `/api/admin/tbilisi-moves/rounds/:date/correct/preview` | CORRECT |
| `POST` | `/api/admin/tbilisi-moves/rounds/:date/correct` | CORRECT — `{ previewHash, fromRevision, reason }` |
| `GET` | `/api/admin/tbilisi-moves/credits` | VIEW or REVIEW |
| `GET` | `/api/admin/tbilisi-moves/observations` | VIEW or REVIEW |
| `POST` | `/api/admin/tbilisi-moves/credits/:id/exclude` | REVIEW — `{ reason }` |
| `POST` | `/api/admin/tbilisi-moves/credits/:id/reinstate` | REVIEW — `{ reason }` |
| `GET` | `/api/admin/tbilisi-moves/rewards` | VIEW |
| `GET` | `/api/admin/tbilisi-moves/awards` | VIEW |

Every mutating call: Zod bounds + `writeAdminAudit`. Georgian 403 `ADMIN_CAPABILITY_DENIED`.

---

## F. Admin settings matrix

| Setting | Default | Validation | Scope | Effective | Historical | Permission |
|---|---|---|---|---|---|---|
| `featureEnabled` | false | boolean | global | immediate (hides product) | none | MANAGE |
| `enrollmentOpen` | false | boolean | global | immediate | members stay | MANAGE |
| `ingestionPaused` | false | boolean | global | immediate on new observations | credits stay | MANAGE |
| `competitionPaused` | false | boolean | global | immediate on boards/rewards | rounds still finalize | MANAGE |
| `pilotMode` | true | boolean | global | copy + API flag | snapshot on round | MANAGE |
| `defaultDailyTarget` | 100000 | int 1e3–5e7 | global default | next **unopened** round | snapshot | MANAGE |
| `district.dailyTargetOverride` | null | int or null | district | next unopened round | snapshot | MANAGE |
| `competitiveCap` | 10000 | int 1e3–5e4 | global | next unopened round | snapshot on credits | MANAGE |
| `cooldownDays` | 30 | int 1–365 | global | future lock **computations** | existing `lockUntilDate` kept | MANAGE |
| `minParticipantsForRank` | 5 | int 1–10000 | global | next unopened round | snapshot | MANAGE |
| `lateSyncGraceHours` | 8 | int 1–24 | global | next unopened round | snapshot | MANAGE |
| `sanityMaxRawSteps` | 80000 | int | ingest | immediate | n/a | MANAGE |
| `correctionDropFlagPct` | 40 | int | ingest | immediate | n/a | MANAGE |
| `rewardsEnabled` | true | boolean | global | next finalize | already issued grants stay | MANAGE |
| Reward defs active | true | boolean | per key | next finalize | grants stay | MANAGE |
| District `ACTIVE`/`ARCHIVED` | ACTIVE | enum | district | no new enroll; members stay | history kept | MANAGE |
| Geometry version | null until asset | string | global | map clients | old rounds keep version id | MANAGE |

100 000 is **not** hard-coded in mobile UI; always from API snapshot.

---

## G. Screen specifications

Voice: Profile/settings formal (`თქვენ`) for legal/lock copy; hub can be direct (`შენ`) like Quest — follow `docs/GEORGIAN_STYLE_GUIDE.md`. Title always **თბილისი მოძრაობს**.

### G.1 Mobile (`mobile/app/tbilisi-moves/`)

Register `Stack.Screen name="tbilisi-moves" options={{ headerShown: false }}` in `mobile/app/_layout.tsx`.

Entry: Profile section after Pets (`ProfileTbilisiMovesSection`), `HomeSectionTitle` above the card. Not a fifth tab. Not Home.

| Screen | Job | States |
|---|---|---|
| `index` | Hub: date, provisional/final, last sync, map or list, selected district panel, CTAs to boards | loading, offline cached, paused, schema 503, permission-denied (capability), empty not enrolled, error |
| `enroll` | District picker + lock explanation + handle + public visibility | confirm sheet before POST |
| `district` | Change flow with pending + cancel | locked (show next date) |
| `city-board` | District ranking | unranked callout, ties, >100% |
| `people` | Individual board in selected district + sticky you-row | capped callout, hidden handle |

Map: Mapbox GL WebView, Tbilisi bounds, fill by `goalPct` (teal scale, saturate 100%, distinct exceeded). OSM/Mapbox **attribution visible** (Run map currently hides `.mapboxgl-ctrl-attrib` — do **not** copy that hide for district geometry). Tap district → panel: target, eligible steps, pct, participants. If geometry missing or WebView fail → accessible **list** (name, pct bar, rank or „არ არის რეიტინგში“). Optional later: static city SVG + `SymptomHotspot`-style taps (`mobile/src/components/symptoms/SymptomHotspot.tsx`) **only if** the SVG traces the same licensed polygons — never a decorative stand-in. **No invented shapes.**

Top-three: dense rank; if four-way tie for 1, show four as rank 1 — do not invent 2nd/3rd. Tie label: „თანაბარი შედეგი“.

Reduced motion: static fills, no pulse on map. Contrast: do not rely on red/green as health.

Never fabricate participants, scores, or winners. Empty city: honest empty.

Pilot banner when `pilotMode`: cosmetic recognition; steps from the phone health app; not independently verified.

### G.2 Admin (`#/tbilisi-moves`)

New nav under Engagement (not Health — avoid implying clinical ranking). Subnav + pane **same width**.

Tabs: Overview · Config · Districts · Rounds · Review · Rewards.

Overview KPIs (Tbilisi today): enrolled, contributors, eligible steps, districts at/over goal, flagged, sync 409 counts. No chat text, no raw health besides competition steps.

Districts: name, override target, status, sort, geometry version. Archive not delete.

Rounds: date, status, freshness, open snapshot JSON (read-only). Manual finalize button.

Review: flagged credits, exclude/reinstate with reason + preview of board impact **if still provisional**.

---

## H. Trust, privacy, retention

### H.1 Trust model (pilot)

Ship **pilotMode=true**. User-visible: „ეს არის აქტივობის შეჯიბრი, არა სამედიცინო შეფასება. ნაბიჯები მოდის შენი ტელეფონის ჯანმრთელობის აპიდან. Medicard ვერ ადასტურებს თითოეულ ნაბიჯს.“

Allowed controls: capability AVAILABLE to contribute; sanity cap; competitive cap; source mismatch flag; drop-correction flag; admin exclude; idempotent replace; Tbilisi day; no device SUM.

Not claimed: anti-cheat, GPS proof of walking in-district, distinction of Health Connect/HealthKit manual samples, distinction of **in-app typed** steps (`HealthMetricLogSheet`), multi-device uniqueness.

Competition ingest must **not** copy `logManualHealthMetric` into the Tbilisi credit path. Phase 2 observations come from native HealthKit/HC day totals only; typed health-sheet steps remain personal `HealthMetricDaily` only. (Pilot still cannot stop a client from POSTing a fake observation — hence `pilotMode`.)

If product later requires trusted ingest: HealthKit source revision, HC `recordingMethod`, server-side session, longer observation log — new phase, not MVP.

### H.2 Privacy

Public: handle, cosmetic avatar, district name, eligible capped steps, rank.  
Private: `fullName`, contact, GPS, uncapped health, medical records.  
Admin VIEW sees aggregates + flagged competition rows, not cycle/chat.

Opt-in is explicit. Without handle, user may be enrolled for **district totals** but omitted from the public people list; owner still sees „შენი ადგილი“.

### H.3 Retention

Credits and rounds kept for feature history (not medical records). Account delete cascades membership/credits/grants. Exclusions do not delete `HealthMetricDaily`. Do not use competition rows in Medi/`withPatientAiContext`.

Legal pages (`scripts/privacy-source.md`) need a future clause when UI ships — not this phase.

---

## I. Migration / deployment

Follow `server/docs/pets-phase2-deploy.md`:

```bash
cd server
npx prisma db execute --file prisma/tbilisi-moves-phase2.sql --schema prisma/schema.prisma
npx prisma generate
```

Windows: stop API if query engine DLL locked.

Render `release` will **not** apply the file. Operator applies SQL, then deploy code that reads the tables with `schemaReady` guards.

Seed 10 districts + config singleton + reward defs in that SQL (idempotent `INSERT … ON CONFLICT`).

**Do not** run Hunt drop/create. **Do not** `prisma db push`.

Finalizer: **command implemented** (`node scripts/tbilisi-moves-finalize.js`). **Scheduler not configured.** Proposed Render cron `medicard-tbilisi-moves-finalize` at `15 4 * * *` UTC remains an operator action. Do **not** add an in-process sweeper on every API instance. Do **not** lazy-finalize on GET.

GeoJSON: vendor `server/data/tbilisi-districts-v1.geojson` + `LICENSE` (ODbL attribution if OSM). Not live Overpass in the app (Hunt overpass was for streets; production-fragile).

Store version: bump revision when the Profile entry is first user-visible (`1.0.0.8.24` → `1.0.0.8.25`). Architecture-only does not bump.

---

## J. Implementation phases (acceptance)

### Phase 2 — Foundation (IMPLEMENTED 2026-09-14; flags off; Neon SQL not applied)

Measurable:

1. Additive SQL + Prisma models; `GET /status` returns `schemaReady: false` without 500 when tables missing, `true` after execute.
2. Config + 10 districts seed; admin `#/tbilisi-moves` Config/Districts/Overview (enrolled=0 OK).
3. Enroll + lock + pending change + cancel; tests in K.
4. Observation PUT: Tbilisi date, replace not add, cap, unique credit, does not write `HealthMetricDaily`.
5. `GET me` + catalog; Profile entry **or** hidden route behind `featureEnabled` (default false).
6. Copy: lock explained before confirm; next date after; activity not health.
7. No Mapbox geometry required yet (list picker).
8. Tests listed in K for ingest/lock pass under `node --test`.
9. No version bump until a visible screen ships; if Profile card ships, bump revision.
10. Neon not applied unless operator asks.

### Phase 3 — Boards

Round snapshot, district + people APIs, hub list UI, you-row, ties, >100%, paused/unranked/capped/offline states. Still list map fallback.

### Phase 4 — Finalize + cosmetic rewards + review (IMPLEMENTED 2026-09-14; flags off; Neon SQL not applied; runner not scheduled)

Sweeper command, grants idempotent, admin exclude/reinstate, correction revisions, history APIs, dashboard rounds/review/rewards. Pilot banner remains. Map is **not** this phase.

### Phase 5 — Map

Licensed GeoJSON in-tree, Mapbox choropleth, attribution, fail-open to list. Do not invent polygons.

### Phase 6 — Polish / store

Reduced motion, a11y, legal privacy sentence, EAS if store-facing.

---

## K. Tests (meaningful, not theatrical)

`node --test` files: `server/src/lib/tbilisiMoves/*.test.js`. Fake DB like `questFakeDb.js`. Add paths to `server/package.json` `test` script.

| Case | Expect |
|---|---|
| 4000 then 6200 same day | credit 6200 eligible 6200 (if cap ≥ 6200) |
| 6200 retried same `clientObservationId` | one observation, one credit |
| Concurrent two observations different ids | serialized per user (promise chain like `userLocation.js` `withUserLocationLock`); final = last accepted; never 4000+6200 |
| Android-style two sources 5000+5000 as two observations | still one credit row; not 10000 unless a single observation says 10000 |
| Cap 10000, raw 15000 | eligible 10000; personal health untested here |
| Device TZ UTC−4 sending “yesterday” | reject or rebucket to server Tbilisi date; never credit two dates from one civil Tbilisi day |
| Enroll 23:50 Tbilisi | today may credit chosen district once |
| Change 23:50 | today old district; pending effective tomorrow |
| Change at 00:00:00 | pending effective **next** date, not immediate |
| Cancel pending | old district remains; lockUntil unchanged |
| Second change while locked | 409 |
| Cooldown 30 → 7 | existing lockUntil unchanged |
| Config target mid-day after round open | today’s snapshot unchanged |
| Equal goal pct | equal rank; sortOrder breaks display only |
| minParticipants | rank null, still listed |
| Finalize then late observation | 409; winners unchanged |
| Finalize twice | one grant set |
| Tie for individual max | both get leader grant |
| Exclude provisional | eligible 0, aggregates drop, health row untouched |
| Exclude after finalize | grant revoked; HealthMetricDaily untouched |
| Admin without `TBILISI_MOVES_MANAGE` | 403 |
| Unauthenticated mobile write | 401 |
| Admin JWT on user route | 403 |

HTTP isolation test (skip unless local DATABASE_URL): enroll/ingest like `petsIsolation.http.test.js`.

---

## L. Open questions

### L.1 Resolvable now (defaults)

| Topic | Default |
|---|---|
| Entry | Profile, not Home, not fifth tab |
| Trust | `pilotMode=true` |
| Individual leader | City-wide max eligible that Tbilisi date; ties share |
| District goal badge | All positive contributors of districts that hit target |
| Podium ties | Dense rank; show all tied, do not fake unique 1–2–3 |
| Leave | Allowed; historical credits stay |
| Handle | Required to appear on people board; district totals still count |
| Grace | 8 hours |
| Min participants | 5 |
| Finalizer | In-process sweeper + lazy GET + admin button; Render cron optional later |
| Map | Mapbox WebView; list until GeoJSON vendored |
| Geometry license | OSM extract ODbL + attribution; not Matsne text as polygons |
| Exclusion vs health | Never write health tables |
| Pause ingest vs health sync | Independent |
| Display >100% | Number honest; fill saturates |
| Lock start | From effective membership time (enroll now / pending apply date) |
| Pending vs lock | Request allowed only when unlocked; pending does not extend lock until apply |

### L.2 Genuine blockers / operator inputs

1. **District GeoJSON not in the repo.** Official legal description exists (Matsne) but is not a machine polygon. OSM raioni (`admin_level=9`) exist under **ODbL** (share-alike + © OpenStreetMap). `open-admin-data/georgia-administrative-divisions` lists Tbilisi with **0 children** — not a raioni source. Phase 2 can ship **without** a map. Phase 4 must not draw invented shapes. Operator must accept OSM (or supply another licensed shapefile).
2. **Hosted Neon apply** is manual (`db execute`). Same as Pets.
3. **Trusted step provenance is absent.** Turning `pilotMode` off without new evidence would be dishonest.
4. **Background sync is absent.** Late-night walkers need to open the app before `graceEndsAt` or they under-count. Copy must say this in pilot.
5. **Hunt/Run Mapbox token** must remain valid (`MAPBOX_PUBLIC_TOKEN`). No token → list fallback only.
6. **Privacy policy / terms** do not yet describe a public walking board. Need a legal edit before public launch (not Phase 2 if `featureEnabled` stays false).
7. **Figma:** no Tbilisi Moves frame was provided this phase. Implement with existing tokens, not a second kit.

---

## Recommended Phase 2 scope (exact)

Implement **foundation only** (section J Phase 2): SQL + config + 10 districts + enrollment/lock/pending + observation credit pipeline (Tbilisi, replace-not-add, cap, unique) + admin config/districts/overview + `GET status/me/catalog` + tests in K that do not need geometry. Feature flag **off**. No Mapbox choropleth, no rewards issuance, no Home tile, no Quest/Coin coupling, no Neon apply unless asked, no EAS, no `expo.version` bump unless a user-visible Profile card is included (prefer hidden routes until flag on).

Reuse: Tbilisi clock helpers, admin V3 module pattern, `writeAdminAudit`, `requireAdminCapability`, Zod, `schemaReady` 503, Profile entry pattern from Pets.

Do not: generic competition engine, GPS verification, Hunt revival, `HealthMetricDaily` as ledger, `prisma db push`, fabricated map.

---

## Summary

Verified: Medicard already has device step **health** sync (`HealthKit` / Health Connect → `POST /api/health-metrics/sync` → `HealthMetricDaily` max + `StepLog` SUM), Tbilisi civil time helpers, admin V3 + capability RBAC + audit, Mapbox WebView for Run, cosmetic avatars, and additive-SQL deploy. It does **not** have Tbilisi-dated competition credits, district membership, public handles, licensed raioni polygons, dual pause, or step provenance.

Handoff path: **`docs/TBILISI_MOVES_ARCHITECTURE.md`**.

Phase 2: foundation behind flags, honest pilot ingest, no map required.

**Phase 2 foundation is in the tree behind flags (see the Phase 2 section at the top).** No Neon apply, no mobile UI, no map, no version bump.

Phase 3: dedicated mobile sensor adapter, enrollment, and polished real-data leaderboards; map only when licensed boundaries are available.

Audit follow-up (same day): parallel repo reads confirmed in-app typed steps (`logManualHealthMetric` / `HealthMetricLogSheet`), Noto Sans Georgian on mobile (FiraGO is web/admin), `AdminAuditLog` without a reason column, GPS `district` not persisted, and rewards RBAC limited to `/api/admin/rewards`. The sections above were corrected; Phase 2 scope is unchanged.
