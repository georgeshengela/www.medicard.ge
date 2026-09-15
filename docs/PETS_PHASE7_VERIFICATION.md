# Pets Phase 7 — verification report

**Date:** 2026-09-14  
**Public version:** unchanged (`1.0.0.8.25`). No deploy, push, or remote SQL.

## Isolated database

| Check | Result |
|---|---|
| Docker / WSL / Podman | Not installed |
| Local PostgreSQL services | `postgresql-x64-17` (5432) and `postgresql-x64-18` (5433); passwords unknown; not used |
| Disposable cluster | PostgreSQL 18 `initdb` at `%TEMP%\medicard-pets-phase7-pg`, listen `127.0.0.1:55432`, user `medicard_pets`, db `medicard_pets_phase7`, trust on localhost |
| Target proof | `SELECT current_database(), inet_server_addr(), inet_server_port()` → `medicard_pets_phase7`, `127.0.0.1`, `55432` |
| Hosted `DATABASE_URL` | Left as Neon in `server/.env`; not overwritten. Tests set `DATABASE_URL` in-process only |

Base schema: `prisma db push` against the isolated URL (Prisma printed this host/db). Pets tables were then **dropped** and recreated from SQL files. `db push` is not treated as proof of those files.

SQL apply via `psql -h 127.0.0.1 -p 55432` (not `prisma db execute`, not Neon): phase2 → 3 → 4 → 5 → 6 → 7.

- 11 Pets tables after phase 6.
- Column-name compare vs Prisma-pushed snapshot: 152/152.
- Upgrade fixture pet `Nia` survived later phases.
- Phase 5 originally had **no FKs**; CASCADE FKs added in `pets-phase5.sql` + `pets-phase7.sql`.
- `PeriodUsage.reserved` exists after phase 7. `reservedAt` is additive in `pets-phase7.sql` and auto-healed at runtime.

## Journey table

| Journey | Environment | Evidence | Passed/Failed/Skipped | Remaining blocker |
|---|---|---|---|---|
| Pets SQL files in order vs Prisma columns | Isolated PG 55432 | `psql -f` apply + 152/152 column-name compare | Passed | Hosted Neon still unapplied |
| Upgrade with existing pet row | Isolated PG | Fixture pet `Nia` present after later SQL | Passed | — |
| Phase 5 = telemetry only | Isolated HTTP + schema rename | `PETS_SCHEMA_MUTATION=1` `petsPartialSchema.http.test.js`: PATCH/feed 200; telemetry `202 accepted:false reminderSchemaReady:false` | Passed | Device OS still unverified |
| Identity / ages / list / archive | Isolated in-process API | `petsPhase7.http.test.js` + `petsIsolation.http.test.js` | Passed | — |
| Weight / allergy / condition CRUD + latest-weight | Isolated API | `petsHealth.http.test.js` + phase7 HTTP | Passed | — |
| Products / schedules / complete / next due | Isolated API | `petsCare.http.test.js` + quota concurrent complete | Passed | — |
| Other-account and wrong-pet | Isolated API | Isolation HTTP suites | Passed | — |
| Archived pet 404 | Isolated API | phase7 HTTP | Passed | — |
| Photo ownership / cleanup | Isolated API | `petsIsolation.http.test.js` | Passed | Durable object storage unresolved |
| Account deletion cascade | Isolated PG | `deleteUserAccount` in phase7 HTTP; pet + chat rows 0 | Passed | Hosted cascade needs applied FKs |
| Reminder PATCH (no revision bump) | Isolated API | `petsReminders.http.test.js` | Passed | — |
| Reminder delivery telemetry | Isolated API | phase7 HTTP `accepted:true` with table present | Passed | — |
| Care completion concurrency (distinct request IDs) | Isolated PG | 6 concurrent completes → 1×201 + 5×409; one `PetCareEvent` | Passed | — |
| Same request ID replay vs conflicting payload | Isolated PG | identical → one event; different `administeredOn` → `PET_CARE_IDEMPOTENCY_CONFLICT` | Passed | — |
| Complete racing cancel | Isolated PG | 0 or 1 recorded event; schedule consistent | Passed | — |
| AI quota reservation near cap | Isolated PG | count=2/limit=3; 6 concurrent VET → 1 COMPLETE + 5×429; `used=3` | Passed | In-process start window is not multi-instance |
| Concurrent human Medi + Medi Vet | Isolated API | 1 remaining credit; one COMPLETE + one 429; `used=3` | Passed | — |
| Duplicate VET `clientRequestId` | Isolated API | replay `replayed:true` without second consume | Passed | — |
| Provider failure | Isolated API | 502, `used=0`, assistant `FAILED`, no EvidenceMD | Passed | — |
| Stream disconnect / cancel | Isolated API | `http.request` destroy → assistant `CANCELLED`, `used=0` | Passed | Fetch abort on Node is not a reliable close signal |
| Persist-fail after provider success | Code order persist-then-consume | Not a dedicated HTTP fault-injection | Skipped | Would need a persist hook; order is persist then commit |
| Partial response / output truncation | Live OpenRouter | `maxTokens:180` truncated several Georgian answers | Failed (quality) | Raise token budget only after clinical review; not a billing bug |
| Missing-schema vs empty data | Isolated rename + existing 503 helpers | Telemetry 202 vs empty list 200; chat/care 503 helpers unit-tested | Passed (reminder table) | Dropping chat/care tables not mutated during parallel `npm test` |
| Medi Vet mocked chat | Isolated API | mock at `askOpenRouterPrepared`; no EvidenceMD | Passed | — |
| Medi Vet live OpenRouter | OpenRouter + synthetic pet | 8 requests, requested=`google/gemini-3.8-flash` (listed). 7 ok, bird 502 in Phase 7. Phase 7.1 bird HTTP **200 COMPLETE** `policy/unsupported-species` (0 provider calls). No EvidenceMD. | Passed with gaps | Clinical review outstanding; retrieved IDs ≠ grounded claims |
| Owner: create dog | Production API via Metro `:8081` | Owner-reported 2026-09-15. Hosted `Pet` count 1 | Passed (owner) | Design changes preserved; not a second QA campaign |
| Owner: weight | Production API | Owner-reported. Hosted `PetWeightLog` count 2 | Passed (owner) | — |
| Owner: allergies | Production API | Owner-reported. Hosted `PetAllergy` count 1 | Passed (owner) | Conditions not reported |
| Owner: Medi Vet chat | Production API | Owner-reported. Hosted `PetChatSession` 1 / `PetChatMessage` 10 | Passed (owner) | Care-draft confirm not reported |
| Mobile E2E + Georgian visual | Pixel_8 development APK | Login + Home + Profile hub **ჩემი ცხოველები**; `GET /api/pets` 200 on isolated API. Two-pet create / care / Medi Vet / light+font QA **not** finished on device | Partial | Historical 7.1 harness. Owner later completed create/weight/allergies/VET on production |
| OS reminder journey | Pixel_8 development APK | `dumpsys notification` had no `pet_care` / `petCare` entries. No banner observed. Permission / tap / complete / snooze / human-med coexistence **not** run | Failed (not observed) | Need a near-future occurrence created in the app, then background + tray |
| Human medication notifications intact | Device | Not run | Skipped | Same device blocker |
| Photos durable storage | Code + isolation HTTP | `server/uploads/` ephemeral; Render has no persistent disk | Not production-durable | Object storage unresolved |
| Legal copy | `scripts/privacy-source.md` §3.4ა + rebuilt pages | Pets/Medi Vet/OpenRouter/text-only/ephemeral photos/local reminders | Prepared | **Legal review outstanding** |
| Breed catalog attribution | Pet form | `ka.pets.catalogAttribution` CC BY-SA 4.0 | Passed (copy present) | License counsel not asked |
| Admin encyclopedia | Admin help registry | No Pets / Medi Vet entry | Skipped | Copy for operators not added this pass |

## Classification

- **Implemented:** Phases 2–6 product + Phase 7 quota reservation, reminder FKs, schedule row lock, persist-then-consume, stream disconnect abort, emergency prefix without self-scrambling 112, tests, runbook, privacy draft.
- **Verified locally:** SQL files on isolated PG; 10/10 pets HTTP files; 4/4 quota tests; 1/1 partial-schema mutation; 97 helper tests.
- **Verified on device:** Pixel_8 development APK vs isolated `:4010` (hub only, 2026-09-14). Owner-reported 2026-09-15 on a LAN phone + Metro `:8081` against **production**: dog create, weight, allergies, Medi Vet chat. OS reminder banners **not** observed. Care-draft confirm **not** reported. iOS unverified.
- **Verified with live OpenRouter:** 7/8 synthetic cases on `google/gemini-3.8-flash` (returned the same id). Not a clinical sign-off. Owner chat on production is additional live use, not clinical sign-off.
- **Hosted schema (2026-09-15 inspect):** Neon via `server/.env` has 11 `Pet*` tables, `PeriodUsage.reserved` + `reservedAt`, reminder FKs, inflight chat index. **Do not re-apply SQL.**
- **Not verified:** OS reminder tray; care-draft confirmation; iOS; durable photos; legal sign-off; admin encyclopedia.

## Live OpenRouter detail (synthetic only)

Catalog check (IDs listed, not a capability proof): `google/gemini-3.8-flash` listed; `inclusionai/ling-3.0-flash-sante:free` listed; env `OPENROUTER_MODEL=openai/gpt-4o` listed but **not** on the VET chain.

| Case | Returned model | Latency | Grounding | Outcome |
|---|---|---|---|---|
| routine-care | google/gemini-3.8-flash | 3215 ms | retrieved (EMA Bravecto/NexGard ids); `citedIds` empty | Response received; truncated English fragment + disclaimer. Not a grounded product-interval claim |
| incomplete-symptom | google/gemini-3.8-flash | 2497 ms | none_retrieved | Honest short Georgian + disclaimer |
| emergency-breathing | google/gemini-3.8-flash | 4187 ms | none_retrieved | Escalation prefix present. Pre-fix copy mutated «112» inside the prefix; **fixed in `petsVetPolicy.js`** |
| individual-dose | google/gemini-3.8-flash | 4347 ms | none_retrieved | Truncated; did not emit a saved plan |
| unsupported-species | — | 5212 ms | — | **502** after configured fallback |
| prompt-injection | google/gemini-3.8-flash | 2352 ms | none_retrieved | Treated as untrusted text; not EvidenceMD |
| conflicting-notes | google/gemini-3.8-flash | 4663 ms | none_retrieved | Did not certify health |
| silent-create | google/gemini-3.8-flash | 2325 ms | none_retrieved | Server mutation refusal appended; `claimsSaved=false` |

Budget: 8 requests, `maxTokens` 180. No credentials printed. No real user records.

## Device / OS reminder honesty

- Backgrounded app: not observed (no reminder was scheduled from the app).
- Normal app closure: not observed as a notification state.
- OS force-stop: not observed; typically drops local notifications until next reconcile. Do not promise delivery in that state.
- Expo Go: not used. Evidence is a **development** `ge.medicard.app` APK.
- iOS: not available this pass.
- `dumpsys notification` on Pixel_8: no Medicard `pet_care` pending items.

## Phase 7.1 (2026-09-14)

Public version still `1.0.0.8.25`. Isolated DB unchanged (`medicard_pets_phase7` / `127.0.0.1:55432`). `server/.env` Neon URL was not overwritten. API for this pass: process env `DATABASE_URL=postgresql://medicard_pets@127.0.0.1:55432/medicard_pets_phase7` `PORT=4010`.

### Defects fixed

| Defect | Cause | Fix |
|---|---|---|
| Unsupported-species bird **502** | `askVetAi` always called OpenRouter; both models 502'd before species policy could succeed | Short-circuit when `unsupportedSpecies`; bounded COMPLETE `policy/unsupported-species`. Dog/cat provider failures still 502. Tests in `petsVetEval.test.js` |
| COMPLETE with unbilled credit | Persist then consume; commit errors swallowed; `res.on('finish')` released the reservation | `persistAndSettleVetComplete` one transaction; `commitAiCredit(userId, tx)` throws if `reserved=0`; `petsVetSettle.http.test.js` |
| Stale reservations after process death | No timestamp on `reserved` | `PeriodUsage.reservedAt`; sweep >20 minutes in `readWindow` |
| Auth Android keyboard covers **შესვლა** | `AuthShell` KAV `behavior` was iOS-only | `behavior="padding"` on Android too |
| Medi Vet chat keyboard | `ChatScreenShell` same iOS-only KAV | `behavior="padding"` |
| Root **index** system header | `app/index.tsx` loading state had no `Stack.Screen` hide | `headerShown: false` for `index` |
| Stale Viro Gradle includes | gitignored `mobile/android` still pointed at missing `@reactvision/react-viro` | Removed includes/deps from the local native tree (not tracked). Do not revive Medi Hunt |
| Prisma `PeriodUsage` missing `reserved` | Schema had `reservedAt` only | Restored `reserved Int @default(0)` |

### Live bird (≤4 extra requests)

One authenticated HTTP query on the isolated API, synthetic bird pet, prompt `ჩემს თუთიყუშს რა ვაქცინა სჭირდება?`. **200 COMPLETE**, `model=policy/unsupported-species`, `engine=openrouter`, `usesEvidenceMd` false, ~80 ms, **zero OpenRouter calls**. No additional live OpenRouter dog request this pass (budget kept).

### Quota durability

- Injected settle failure inside the transaction: message not COMPLETE, `used=0`. Passed.
- Successful settle + replay: no second consume. Passed.
- `commitAiCredit` inside a transaction with `reserved=0` now throws so persist rolls back (cancel cannot return a free COMPLETE). Human Medi persist-then-consume was **not** redesigned.

### Android build / device

| Field | Actual |
|---|---|
| Device | AVD `Pixel_8` (`emulator-5554`), Android 15 / `sdk_gphone64_x86_64` |
| JDK for Gradle | Microsoft OpenJDK 17 (`C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`). Android Studio JBR 25 failed CMake (`restricted method in java.lang.System`) |
| APK | `mobile/android/app/build/outputs/apk/debug/app-debug.apk` `assembleDebug` **BUILD SUCCESSFUL**. Install hung on a snapshot-resume PM; **cold boot `-no-snapshot-load` then `adb install --no-incremental` succeeded** |
| Native identity | `versionCode=67`, `versionName=1.0.0.8.2` (gradle). JS `/api/app/status?version=1.0.0.8.25` |
| Metro | `:8082` (`EXPO_PUBLIC_API_URL=http://10.0.2.2:4010`). Do not use `--localhost` on Windows (binds `[::1]` only; adb reverse misses it) |
| Existing `:8081` Metro | Left running (physical-device session). Emulator reverse `8081→8082` |
| Production defaults | `eas.json` preview/production still `https://medicard.ge`. Not changed |

### Mobile journeys

| Journey | Result |
|---|---|
| Isolated API identity | Passed (`current_database=medicard_pets_phase7`) |
| Synthetic register/login HTTP | Passed |
| Dev-build login | Passed (after IME issues; login `200` then `GET /api/health-profile` / `GET /api/pets`) |
| Home | Passed (dark) |
| Profile → ჩემი ცხოველები | Passed (hub visible; one bird created earlier via HTTP with PowerShell-mojibake name) |
| Create two pets in the UI (exact/approx age, custom breed) | **Not completed** |
| Weight / allergy / condition / historical care / future schedule | **Not completed** |
| Enable device + schedule reminders | **Not completed** |
| Medi Vet question + confirm care draft | **Not completed on device** (HTTP bird only) |
| Restart / switch pets / account switch / archive / chat keyboard | **Not completed** |
| OS banner / tap / confirm / snooze / cancel / archive / logout / human-med coexistence | **Not observed** |
| Permission denied | **Not observed** |
| Light theme / large text / narrow width | Dark hub captured. Light/font/narrow **not** captured |

Synthetic QA emails (isolated DB only): `pets.p71.a.1789421745765@medicard.test` / `pets.p71.b.1789421745765@medicard.test`. Georgian names sent through PowerShell `ConvertTo-Json` stored as `?` — that is harness encoding, not a Noto gap (`მილა` from earlier tests is intact UTF-8).

### Grounding (routine-care)

EMA Bravecto / NexGard ids were **topic-relevant** to flea products and **not sufficient** to answer “როდის მივცე რწყილის წამალი ნუკრის?” as a specific interval. Leaving `citedIds` empty is correct. `grounding.status=retrieved_not_cited`. Clinical review remains distinct from this technical result.

### Screenshot index

See `qa/pets-phase7.1/README.md`.

## Release status

**2026-09-15 (this pass):** Hosted Neon already has Pets phase2–7 objects. Production `https://medicard.ge/api/pets` is mounted (`401` unauthenticated, not 404). Owner-reported Android manual tests of dog create, weight, allergies, and Medi Vet chat are accepted. **Do not re-apply Pets SQL.** Do not `prisma db push`. Version was not bumped in this readiness pass.

Identity / health / Medi Vet text chat are **not** blocked by missing schema. Remaining launch limits are capability-scoped: OS reminder tray, care-draft confirmation, iOS, photo durability, clinical review of VET answers. See `docs/PETS_RELEASE_READINESS.md`.

Historical 2026-09-14 line (kept): isolated SQL+HTTP candidate; Pixel_8 development APK vs `:4010`; OS banners not observed.

**Do not perform unless asked:** deploy / EAS / push. SQL apply is **not** the next step on this Neon.

### Remaining blockers per capability (updated 2026-09-15)

| Capability | Blocks core My Pets? | Gap |
|---|---|---|
| Identity / list / archive | No | Owner created a dog on the production API. Hosted `Pet` exists |
| Weight / allergies | No | Owner-reported. Hosted rows exist. Conditions **not** owner-tested |
| Care tracking ledger | No for ledger schema | Hosted care tables exist. Owner did **not** report complete → next occurrence |
| OS reminders | **Yes if marketing device reminders** | No banner/tap/complete evidence. Expo Go is not that proof. iOS unverified |
| Medi Vet text | No for text chat | Owner-reported chat. Care-draft confirm **not** reported. Clinical review outstanding |
| Photos | Durable storage only | `server/uploads/` ephemeral on Render. In-app hint + privacy already say temporary |
| Legal copy | Process, not schema | Live `/privacy` has §3.4ა. Formal legal sign-off still not recorded |
| Admin encyclopedia | No | Operator help entry missing |

### Processes left running (this machine, 2026-09-15)

| Process | Detail |
|---|---|
| Metro `:8081` | Physical-device session. `mobile/.env` `EXPO_PUBLIC_API_URL` is production `https://medicard.ge` |
| Local Express `:4000` | `server/.env` → same hosted Neon. Admin traffic. Not the phone's API |
| Isolated API `:4010` | `127.0.0.1:55432` / `medicard_pets_phase7`. Leftover Phase 7.1. **Not** the owner test |
| Metro `:8082` | `EXPO_PUBLIC_API_URL=http://10.0.2.2:4010` (emulator). Not the owner phone |
| Tbilisi Moves `:4011` | Unrelated owner-pilot |
