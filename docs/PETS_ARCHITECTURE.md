# Pets / Medi Vet — architecture & implementation handoff

**Status (2026-09-15):** Hosted Neon Pets SQL is applied (phase2 → phase7). Production `/api/pets` is live. Owner-reported Android tests of dog create, weight, allergies, and Medi Vet chat are accepted. Owner UI/design changes are preserved. **OS reminder banners, care-draft confirmation, iOS, and durable photos are not verified.** Rollout: `docs/PETS_RELEASE_READINESS.md`. Evidence: `docs/PETS_PHASE7_VERIFICATION.md`.  
**Public app identity:** do not bump in the readiness pass (tree currently `1.0.0.8.31`).  
**User-facing names:** hub **ჩემი ცხოველები**; assistant **Medi Vet**. Never Nightingale.
**Runbook:** `server/docs/pets-phase7-runbook.md`. Device screenshots: `qa/pets-phase7.1/` (Phase 7.1 isolated API only).

Historical 2026-09-14: PHASE 7.1 was an isolated-Postgres + Pixel_8 `:4010` smoke. That pass did **not** observe OS banners and is **not** the current hosted schema state.

This document is the implementation handoff. Later agents must re-read the live tree before coding.


---

## Phase 7 — verification (2026-09-14)

Integration pass against a disposable local PostgreSQL (`127.0.0.1:55432` / `medicard_pets_phase7`). Hosted Neon was not touched.

### Phase 5 SQL (resolved)

| Operation | Needs `PetReminderDelivery`? |
|---|---|
| `PATCH /schedules/:id/reminders` | No — writes `PetCareSchedule` only |
| `GET /api/pets/reminders/feed` | No — Phase 4 schedules/occurrences |
| Local OS Notification Brain | No |
| Complete / skip / cancel / archive | No |
| `POST .../reminder-delivery` | **Yes** — otherwise `202 { accepted: false, reminderSchemaReady: false }` |

Missing Phase 5 disables **telemetry only**, not reminder functionality. FKs for delete cascade were missing in `pets-phase5.sql` and were added (also in `pets-phase7.sql`).

### Quota

`PeriodUsage.reserved` + atomic SQL. One COMPLETE consumes once; replay/cancel/fail/partial release the reservation. Max 2 in-flight reservations per user. 30 provider starts / 10 minutes (process-local). User-facing used remains `count` until commit.

### Live OpenRouter (this pass)

Requested model `google/gemini-3.8-flash` is listed on OpenRouter and was the returned model on successful cases. `inclusionai/ling-3.0-flash-sante:free` is listed (fallback). Env `OPENROUTER_MODEL` is `openai/gpt-4o` for other product surfaces; VET routing does **not** use that ID. Eight synthetic requests (`maxTokens` 180). Seven COMPLETE. Bird/unsupported-species originally returned 502 because both OpenRouter models failed; Phase 7.1 short-circuits unsupported species **before** the provider and returns a bounded COMPLETE (`model: policy/unsupported-species`, OpenRouter-only routing, no bird clinical coverage). Emergency layer originally scrambled its own «112» into the prefix; prefix no longer contains digits. Retrieved source IDs are not proof of a grounded claim (routine-care retrieved EMA ids, `citedIds` empty, `grounding.status` is now `retrieved_not_cited` when nothing is cited). Clinical review outstanding. No EvidenceMD.

### Phase 7.1 (2026-09-14, same isolated target)

- `askVetAi` does not call the provider when `classifyVetTurn` marks `unsupportedSpecies`.
- `persistAndSettleVetComplete` writes COMPLETE and `commitAiCredit` in one `prisma.$transaction`. A failed commit rolls the message back. Transactional `commitAiCredit` throws if `reserved=0` so cancel cannot yield a free COMPLETE. `PeriodUsage.reservedAt` + 20-minute sweep recovers stale reservations after process death.
- Android: Pixel_8 development `assembleDebug` installed (JDK 17; stale Viro includes removed from the gitignored `mobile/android` tree). Metro `8082` + `EXPO_PUBLIC_API_URL=http://10.0.2.2:4010`. App `GET /api/pets` and login hit the isolated API. OS notification banners were **not** observed. iOS unverified.
- Public version still `1.0.0.8.25`. No Neon SQL, deploy, or push.

### SQL order now

`pets-phase2.sql` → `phase3` → `phase4` → `phase5` (optional for OS scheduling; required for delivery telemetry + delete-cascade FKs) → `phase6` → `pets-phase7.sql`.

---

## Phase 4 — what shipped

Functional care tracking: **მოვლა** on the pet profile. Product / schedule / event stay distinct. `PetCareOccurrence` is an architecture adjustment so Phase 5 can attach reminders without redesign.

### Implemented paths

| Area | Path |
|---|---|
| Prisma | `PetProduct`, `PetCareSchedule`, `PetCareOccurrence`, `PetCareEvent` |
| Additive SQL | `server/prisma/pets-phase4.sql` **after** phase2 then phase3 |
| Apply notes | `server/docs/pets-phase4-deploy.md` |
| Recurrence | `server/src/lib/petsCivilDate.js`, `petsSchedule.js` |
| Validation | `server/src/lib/petsCare.js` |
| Routes | `server/src/routes/petsCare.routes.js` mounted on `/api/pets` |
| Mobile | `mobile/app/pets/[id]/care/**` |
| Profile | `PetCareSummary` above health facts |
| Copy | `ka.pets` care / product / schedule keys |

### SQL execution order

1. `pets-phase2.sql`
2. `pets-phase3.sql`
3. `pets-phase4.sql`
4. `pets-phase5.sql` (optional for local OS scheduling; required only for server delivery log)
5. `pets-phase6.sql` then `pets-phase7.sql` (quota reservation + reminder FKs)
6. `npx prisma generate`

Hosted Neon **already has** these objects (inspected 2026-09-15). Do not re-apply as a release step. Do not `db push`.

### Domain (kept distinct)

| Concept | Model | Meaning |
|---|---|---|
| Product | `PetProduct` | What is used. `expiresOn` is **never** used to calculate next administration. No catalog. Archive does not cancel plans or wipe history. |
| Schedule | `PetCareSchedule` | What is planned. Full recurrence intent is stored. `nextDueOn` is derived for listing / Phase 5, not the only field. |
| Occurrence | `PetCareOccurrence` | Stable identity: `r{revision}\|{plannedOn}\|{plannedTime\|\|'date'}\|{sequence}`. Persisted on complete/skip. Skip is **not** an administration event. |
| Event | `PetCareEvent` | What actually happened. Snapshots of title/product/dose/unit/route. |

Kinds: `VACCINATION` \| `FLEA_TICK` \| `DEWORMING` \| `MEDICATION` \| `OTHER` (architecture originally said `VACCINE`; stored value is **VACCINATION**).

### Vet clinic directory (information only)

`GET /api/pets/clinics` fetches the public [Dogdog.ge vet listing](https://dogdog.ge/index.php?m=315), caches 6h, and computes open/closed in `Asia/Tbilisi` from published hours. Not a booking system, not Medicard clinics, not a new Pets SQL phase. Hub section only — not Home, not a fifth tab.

### Recurrence

Supported only with implemented behavior:

- `ONCE` (basis `NONE`)
- `EVERY_N_DAYS` / `EVERY_N_WEEKS` / `EVERY_N_MONTHS` with `FIXED_CALENDAR` or `FROM_ADMINISTRATION`
- `DAILY_COURSE` with explicit local times — **FIXED_CALENDAR only**; requires `courseEndsOn` or `occurrenceLimit`

Calendar months are not a fixed number of days. Month-end anchor: Jan 31 → Feb end → Mar 31. Year intervals are rejected, not approximated.

Occurrence listing is bounded: overdue lookback 14 days, max 3 overdue; upcoming 60 days, max 40. Missed occurrences are not auto-marked administered.

### Completion

Transactional: owner + active pet + schedule revision + occurrence → event + occurrence `ADMINISTERED` + schedule advance. Same `clientRequestId` + same payload replays. Same key + different payload → **409** `PET_CARE_IDEMPOTENCY_CONFLICT`. Two devices, different request IDs, same occurrence → **409** `PET_CARE_OCCURRENCE_COMPLETED`. Stale revision / cancelled schedule → 409 so the UI can refresh.

Standalone historical `POST /events` does **not** advance a plan.

### Phase 5 reminder contract (delivered locally)

- Saving a plan still does **not** enable reminders. `PATCH /schedules/:id/reminders` is the opt-in and does **not** bump `revision` or `nextDueOn`.
- Identity: `pets:{userId}:{petId}:{scheduleId}:{occurrenceKey}:{alertKind}` (`due` / `advance:n` / `followup:1` / `snooze`).
- Device-local Expo DATE triggers. No server cron, no `sendExpoPush` from pets routes. Closed app: already-scheduled OS notifications can fire; JS does not run continuously. Horizon **14 days**, replenished on login/foreground/pref/schedule/complete/skip/archive/timezone/permission.
- `GET /api/pets` HTTP 200 is **not** proof care or reminders work. Missing Phase 4 tables → care 503. Missing `PetReminderDelivery` → telemetry `reminderSchemaReady: false`, local scheduling still proceeds.

---

## Phase 5 — what shipped

Local pet care reminders on the existing Notification Brain. Profile navigation kept. No Home tile, no fifth tab. Medi Vet not started.

| Area | Path |
|---|---|
| Contract | `mobile/src/lib/petCareReminderContract.js` |
| Prefs / bookkeeping | `mobile/src/lib/petCareReminderPrefs.ts` |
| Reconcile | `mobile/src/lib/petCareReminders.ts` |
| Brain / actions / routes | `mediNotificationBrain.ts`, `mediNotificationActions.ts`, `notificationPlan.ts`, `notifications.ts` |
| Confirm screen | `mobile/app/pets/[id]/care/complete.tsx` |
| Reminder PATCH + feed | `PATCH /api/pets/:petId/schedules/:scheduleId/reminders`, `GET /api/pets/reminders/feed` |
| Telemetry | `POST .../reminder-delivery` + `server/prisma/pets-phase5.sql` |
| Copy | `ka.pets` reminder status strings; templates `pet-care` / `pet-care-masked` |

### Scheduling while the app is closed

Expo/OS can fire notifications that were already scheduled. JavaScript is not assumed to run in the background. The client schedules a **14-day** horizon and replenishes on login, foreground, preference changes, schedule edits/cancel, complete/skip, pet archive, detected timezone change, and permission changes. After 14 days without a successful reconcile, later occurrences are not on the device.

### Preferences

- Device/account opt-in (`globalOptIn`) plus per-schedule `reminderEnabled`.
- Date-only fire clock is owner-selected or visibly accepted (default 09:00). Prescribed `dueTime` / `EXACT_TIME` is separate and is **not** moved for quiet hours.
- Advance offsets allowlisted `{0,1,3}`. Optional one overdue follow-up. Snooze 10/20/60 minutes changes alert time only.
- Permission is requested only after an explicit toggle. Denied: settings link + upcoming list still works. Copy distinguishes preference saved / scheduled on this device / permission denied / sync failed.

### Reconciliation and capacity

Serialized (`createReconcileGate` + promise chain). Generation bump on logout aborts in-flight commits. Server occurrences remain authoritative. API failure / 503 is **not** an empty schedule: keep last-good `pets:` ids. Logout/archive/cancel cancel **this owner’s** `pets:` alerts only. Shared OS budget 64; pets cap 24; never cancel `med:`.

### Time / DST / travel

Device-local wall clock. Historical civil dates do not shift after travel. DST gap → fail closed (no alert). Repeated hour → first occurrence only. Quiet hours may bump date-based / follow-up / advance, not prescribed due times. Snooze does not infer catch-up doses.

### Completion from a notification

Actions open a focused confirm screen (`opensAppToForeground: true`). Background completion is **not** simulated. Same `clientRequestId` on retry. 409 fetches current state (other device vs schedule changed); no new idempotency key. Skip is not an administration event. Offline queue is account-scoped and must not replay under another user.

### Delivery states (honest)

`scheduled_local` | `schedule_failed` | `cancelled` | `received_callback` (handler ran) | `user_response` | `completion_confirmed`. A scheduled notification is not proof the OS showed a banner. Dismissal is not stored.

### Multiple devices

Two opted-in devices may both notify. One device cannot cancel the other’s pending locals while it is offline. On foreground, reconcile remote completions and drop stale locals.

### SQL order

1. `pets-phase2.sql`
2. `pets-phase3.sql`
3. `pets-phase4.sql`
4. `pets-phase5.sql` (`PetReminderDelivery`, optional for local scheduling)
5. `npx prisma generate`

Do not `db push`. Do not apply to hosted Neon unless an operator asks.

### Phase 6 integration

Medi Vet stays **server-side OpenRouter** (`SYSTEM_PROMPTS.VET`, pet-scoped context). Reminders do not call OpenRouter. Do not hang Vet on Home or a fifth tab.

### Checks this pass (2026-09-14)

| Check | Result |
|---|---|
| `petCareReminderContract.test.js` | **passed** (idempotency, capacity, DST, 409, logout gate, honest states, Engage isolation) |
| `petsReminders.test.js` | **passed** |
| `petsSchedule.test.js` / `petsCare.test.js` / mobile `petsCare.test.js` / `petsCopy.test.js` / `notificationPlan.test.ts` / `pushTemplates.test.js` | **passed** |
| `petsCare.http.test.js` | **skipped** — `DATABASE_URL` is hosted Neon, not localhost |
| `petsReminders.http.test.js` | **skipped** — same reason |
| Real OS schedule → background → banner → confirm → next occurrence | **not run** — no emulator/device session this pass |
| Concurrent DB completion across devices | **not verified** — Phase 4 tables missing on Neon |

Implementation is in the tree. Helper tests are **not** proof of OS delivery.

### Care API (auth, active owned pet)

| Method | Path |
|---|---|
| `GET` `POST` | `/api/pets/:petId/products` |
| `GET` `PATCH` | `/api/pets/:petId/products/:productId` |
| `POST` | `/api/pets/:petId/products/:productId/archive` |
| `GET` `POST` | `/api/pets/:petId/schedules` |
| `GET` `PATCH` | `/api/pets/:petId/schedules/:scheduleId` |
| `POST` | `/api/pets/:petId/schedules/:scheduleId/cancel` |
| `PATCH` | `/api/pets/:petId/schedules/:scheduleId/reminders` |
| `POST` | `/api/pets/:petId/schedules/:scheduleId/reminder-delivery` |
| `POST` | `/api/pets/:petId/schedules/:scheduleId/complete` |
| `POST` | `/api/pets/:petId/schedules/:scheduleId/skip` |
| `GET` | `/api/pets/:petId/care/upcoming` |
| `GET` | `/api/pets/reminders/feed` |
| `GET` `POST` | `/api/pets/:petId/events` |
| `GET` `PATCH` | `/api/pets/:petId/events/:eventId` |
| `POST` | `/api/pets/:petId/events/:eventId/void` |

Missing Phase 4 tables → **503** `{ schemaReady: false, careSchemaReady: false }`. Phase 2 identity and Phase 3 health stay up independently.

### Checks run (Phase 4)

| Check | Result |
|---|---|
| Pure helpers (`petsCivilDate`, `petsSchedule`, `petsCare`, mobile `petsCare`, `petsCopy`) | **passed** (41 pets tests including Phase 2/3 helpers; 0 failed) |
| `petsCare.http.test.js` / `petsHealth.http.test.js` / `petsIsolation.http.test.js` | **3 skipped** — `DATABASE_URL` is not local (`t.skip` with reason) |
| Device / Expo click-through | **not performed** |
| `pets-phase2/3/4.sql` against Neon | **not applied** |
| Concurrent completion on a real database | **not verified** (unique `(scheduleId, occurrenceKey)` is the guard; helper tests are not concurrency proof) |

### Next: Phase 5 (bounded)

Local Notification Brain under `pets:`. Confirm/skip from notification. No server cron. `reminderEnabled` opt-in.

---

## Phase 3 — what shipped

Pet profile health facts: **წონა**, **ალერგიები**, **ჯანმრთელობის მდგომარეობები**. Isolated from `HealthMetricDaily`, `medicard.weight.logs.v1`, and human `allergyCatalog`.

### Implemented paths

| Area | Path |
|---|---|
| Prisma | `PetWeightLog`, `PetAllergy`, `PetCondition` in `server/prisma/schema.prisma` |
| Additive SQL | `server/prisma/pets-phase3.sql` **after** `pets-phase2.sql` |
| Apply notes | `server/docs/pets-phase3-deploy.md` |
| Validation | `server/src/lib/petsHealth.js` |
| Routes | `server/src/routes/petsHealth.routes.js` mounted on `/api/pets` |
| Mobile | `mobile/app/pets/[id]/weight/**`, `allergies/**`, `conditions/**` |
| Profile sections | `PetHealthSummaries` on pet profile |
| Copy | `ka.pets` weight / allergies / conditions keys |

### SQL execution order

1. `npx prisma db execute --file prisma/pets-phase2.sql`
2. `npx prisma db execute --file prisma/pets-phase3.sql`
3. `npx prisma generate`

Do not `db push`. Do not apply to hosted Neon unless an operator asks.

### Health API (auth, active owned pet)

| Method | Path |
|---|---|
| `GET` `POST` | `/api/pets/:petId/weight` |
| `GET` `PATCH` `DELETE` | `/api/pets/:petId/weight/:logId` |
| `GET` `POST` | `/api/pets/:petId/allergies` |
| `GET` `PATCH` `DELETE` | `/api/pets/:petId/allergies/:allergyId` |
| `GET` `POST` | `/api/pets/:petId/conditions` |
| `GET` `PATCH` `DELETE` | `/api/pets/:petId/conditions/:conditionId` |

Child IDs on another pet URL (including same owner) → Georgian 404. Archived pet reads/writes → 404. Missing Phase 3 tables → **503** `{ schemaReady: false, healthSchemaReady: false }`. Identity `/api/pets` is unchanged if only Phase 3 is missing.

Weight: `inputValue` + `inputUnit` (`kg`/`g`/`lb`) + normalized `weightKg` (5 decimals). Multiple measurements per day allowed (no silent overwrite). Latest = `recordedOn` desc, then `createdAt`, then `id`. Create retries use `clientRequestId`. List bounded (`limit` default 50, max 100).

Allergies: empty list copy is **ალერგიები ჯერ არ არის დამატებული** — not “no allergies”. `reportedStatus` is `suspected` or `veterinarian_confirmed`.

Conditions: `active` / `resolved` / `unknown`; resolved stay in history. Dates optional; `resolvedOn` only when status is resolved.

### Checks run (Phase 3)

| Check | Result |
|---|---|
| Phase 2+3 `node --test` (petsAge, catalog, ownership, petsHealth, petsCopy, petsHealth mobile, privateUploads, homeSectionOrder) | **53 passed**, **2 skipped**, **0 failed** |
| `petsIsolation.http.test.js` | **skipped** — `DATABASE_URL` is not local (`t.skip` with reason) |
| `petsHealth.http.test.js` | **skipped** — same reason; hosted Neon not used |
| `npx prisma generate` | succeeded after stopping local `node --watch src/server.js` |
| Lint on new mobile/server files | no issues reported |
| Device / Expo click-through | **not performed** |
| `pets-phase2.sql` / `pets-phase3.sql` against Neon | **not applied** |

---

## Phase 2 — what shipped

Working identity flow: Profile → **ჩემი ცხოველები** → list → add → profile → edit/archive.

### Implemented paths

| Area | Path |
|---|---|
| Prisma model | `server/prisma/schema.prisma` `Pet` |
| Additive SQL | `server/prisma/pets-phase2.sql` |
| Apply notes | `server/docs/pets-phase2-deploy.md` |
| Catalog | `server/src/lib/petsCatalog.js` + `mobile/src/lib/petsCatalog.js` (`pets-species-v1`) |
| Age / identity | `server/src/lib/petsAge.js` |
| Ownership | `server/src/lib/petsOwnership.js` |
| Routes | `server/src/routes/pets.routes.js` mounted at `/api/pets` |
| Private photos | `findOwnedPetUpload` / `findOwnedPrivateUpload` in `privateUploads.js` |
| Account wipe | `deleteUser.js` unlinks `Pet.photoUrl` |
| Mobile routes | `mobile/app/pets/_layout.tsx`, `index.tsx`, `new.tsx`, `[id]/index.tsx`, `[id]/edit.tsx` |
| Profile entry | `ProfilePetsSection` in `mobile/app/(tabs)/profile.tsx` |
| Copy | `ka.pets` in `mobile/src/i18n/ka.ts` |
| API client | `api.pets` in `mobile/src/lib/api.ts` |

### API (auth required)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/pets/catalog` | no DB |
| `GET` | `/api/pets` | `{ schemaReady, pets }` — active only; **503** if table missing |
| `POST` | `/api/pets` | create; 409 at 20 pets |
| `GET` | `/api/pets/:petId` | 404 if missing, other owner, or archived |
| `PATCH` | `/api/pets/:petId` | allowlisted fields; age invariant on merge |
| `POST` | `/api/pets/:petId/archive` | sets `archivedAt`; no reminders in this phase |
| `POST` | `/api/pets/:petId/photo` | multipart `file`, 12 MB, sniffed JPEG/PNG/WEBP/GIF |
| `DELETE` | `/api/pets/:petId/photo` | nulls `photoUrl` then unlinks |

`photoUrl` is never accepted from JSON. Owner id is always `req.user.id`.

### Age representations (mutually exclusive)

| `ageKind` | Stored | Forbidden |
|---|---|---|
| `EXACT` | `birthDate` `@db.Date` UTC midnight | approx fields |
| `APPROXIMATE` | years and/or months + `approxAgeRecordedOn` | `birthDate` |
| `UNKNOWN` | all age fields null | any birth/approx data |

Display age for approximate = recorded age + elapsed civil months since `approxAgeRecordedOn`. No fabricated birthday.

### Catalog provenance

- Version `pets-species-v1`.
- Dog/cat: **limited** companion subset from Wikipedia “List of dog breeds” / “List of cat breeds” (**CC BY-SA 4.0**). Not FCI/CFA complete. Breed **labels stay English**; ids are kebab-case slugs.
- Other species: sentinels only (`unknown` / `custom`; `mixed` where it makes sense — not fish/reptile/other).
- Creation is never blocked on missing breed (`unknown` default).

### Checks run

| Check | Result |
|---|---|
| `node --test` petsAge, catalog, ownership, privateUploads (incl. pet finder), petsCopy, homeSectionOrder | **38 passed** (re-run 2026-09-14 evening) |
| `petsIsolation.http.test.js` | **skipped** (`t.skip`) — `DATABASE_URL` is hosted Neon, not localhost |
| `npx prisma generate` | succeeded after stopping the local API lock |
| `GET /api/pets` unauthenticated on local API | **401** Georgian |
| Lint on new mobile/server files | no issues reported |
| Device / Expo click-through | **not performed** (static review only) |
| `pets-phase2.sql` against Neon | **not applied** (per request) |

### Known limitations / release blockers

1. **Pet table is not on hosted Neon.** Local API uses that Neon URL, so authenticated `/api/pets` will **503** `schemaReady: false` until an operator runs `pets-phase2.sql` then `pets-phase3.sql` (not done here).
2. **Render uploads are ephemeral.** Copy says photos are temporary (`ka.pets.photoHint`). `storage.js` remains the swap point — no new provider in this phase.
3. No Home entry, no fifth tab, no Medi Vet, no care products/schedules/reminders.
4. Store version not bumped; camera usage strings still human-clinical.

---

## 1. Inspection summary (what exists today)

There is **no pet, species, breed, vaccine, or veterinary domain**. Closest false friends:

| Hit | What it actually is | Do not reuse as Pets |
|---|---|---|
| `mobile/src/constants/allergyCatalog.ts` `pet-dander` | Human allergen chip «ცხოველის ბეწვი» | Human HealthProfile only |
| `DoctorVisit.doctorType` `PED` | Pediatrician | Human visits |
| `CAREGIVER_RULES_KA` in `server/src/lib/prompts.js` | Human child vs account holder | Not a named pet |
| Medi Companion | Cosmetic robot loadout | `/api/medi-companion` |
| `MedicationSchedule` / `MedicationDoseEvent` | Human meds | Feeds `withPatientAiContext` |
| `HealthProfile` / `HealthMetricDaily` | 1:1 human | Injected into every Medi call |

Repo shape (RA-00 still accurate): Expo app in `mobile/`, Express + Prisma in `server/`, Cycle/pregnancy contracts in `docs/`, no shared npm package (Metro must not import repo-root).

### 1.1 Stack to reuse

| Concern | Actual path | Pattern |
|---|---|---|
| Auth | `server/src/middleware/auth.js` `requireAuth` | JWT `sub` → `req.user`; never trust client `userId` |
| Ownership 404 | `server/src/lib/ownerAccess.js` + `updateMany`/`deleteMany` `{ id, userId }` | Miss or wrong owner → Georgian 404, not 403 |
| Civil dates | `DoctorVisit.visitDate`, `MedicationDoseEvent.date`, `HealthMetricDaily.date` | `YYYY-MM-DD` string |
| Clock times | `DoctorVisit.visitTime`, med `frequency` | `HH:mm` |
| Postgres DATE | `User.birthDate` `@db.Date` | UTC midnight write; age via UTC getters (`server/src/lib/patient.js`) |
| Uploads | `server/src/lib/storage.js` `saveUpload` → `/uploads/<uuid>.ext` | Bytes only via `GET /api/files/:filename` + owner check |
| HEIC | `mobile/src/lib/imageUpload.ts` | Transcode before upload |
| AI quota | `server/src/middleware/aiLimiter.js` `enforceAiQuota` | `PeriodUsage` `roll:daily`, Tbilisi midnight, 24h lock |
| OpenRouter | `server/src/lib/aiEngine.js` | User `aiEngine`: `gemini_flash` (default), `ling_free`, `evidencemd` |
| Chat persist | `ChatSession` + `POST /api/ai/query` | Modes `DOCTOR` \| `CONSILIUM` only (`ai.routes.js` Zod) |
| Patient context | `withPatientAiContext` | Profile + 14-day metrics + human meds + cycle mode |
| Local reminders | Notification Brain | Sole scheduler for meds/cycle/pregnancy/visits; no server reminder cron |
| i18n | `mobile/src/i18n/ka.ts` | Product UI is Georgian-first; no `en.ts` |
| Theme | `mobile/src/theme/colors.ts` + `mobile/global.css` | Cool gray-950 dark, not teal charcoal |
| Modals | `mobile/src/components/ui/appModal.ts` `APP_MODAL_PROPS` | Fade, never slide on transparent overlays |
| Account wipe | `server/src/lib/deleteUser.js` | FK cascade + unlink `MedicalRecord.imageUrl` |
| Neon schema | `npx prisma db execute` additive SQL | Render `release` = generate + seed, **not** `db push` |
| Tests | `node:test` colocated `*.test.js` | New files **must** be added to `server/package.json` `"test"` |

### 1.2 Navigation that Pets must not disturb

Bottom pill in `mobile/src/components/navigation/FloatingTabBar.tsx`: Home, Records, Run, Medications, Profile. Nested stacks hide the pill. **Do not add a fifth tab.**

Home order is `buildHomeSectionOrder` in `mobile/src/lib/home/homeSectionOrder.ts` (NextDose → Steps → Hydration → Weight → Cycle → Weather → Symptom → Analysis → Consilium → Recent). Lab lives on Records. Medi Quest + Companion live on Profile. Pets are not the account-holder’s body — they do **not** belong on Home in v1.

Root stack registration: `mobile/app/_layout.tsx` (`<Stack.Screen name="visits" … />` is the analog).

---

## 2. Product rules (non-negotiable)

1. Multiple pets per account. Every row has `userId` **and** `petId` (except `Pet` itself). Ownership is checked on the pet first, then the child.
2. Completed care, future schedules, and reminder delivery are **three tables**. Confirming a dose writes an event; it does not mutate a delivery row into history.
3. Product `expiresOn` is not `nextDueOn`. A flea pipette can expire in 2027 and still be due tomorrow.
4. No universal vaccine or medication interval in code, seed, or catalog auto-apply. Catalogs may show **informational** typical ranges, labeled as such, never used to write `nextDueOn`.
5. Exact birth date and approximate age are different representations. Approximate age never fabricates `birthDate`.
6. Medi Vet context is only that pet. Human `HealthProfile`, `HealthMetricDaily`, `MedicationSchedule`, Cycle, and `withPatientAiContext` are forbidden on vet calls.
7. Human Medi (`/api/ai/query`, `/chat/doctor`) must not receive pet rows.
8. Visual language is existing Medicard (tokens, `Card`, `HomeSectionTitle`, `DateField`, Georgian `ka.pets`). No new design system.

---

## 3. Domain model

All new models go in `server/prisma/schema.prisma` and an additive SQL file `server/prisma/pets-phase2.sql`. Follow Hunt/Companion: apply with `npx prisma db execute`, then `npx prisma generate`. Do not `db push` against hosted Neon. Do not invent `_prisma_migrations` history.

`GET /api/pets` (and related) must fail **honestly** if tables are missing (`schemaReady: false` / 503), same lesson as Hunt. Optional runtime `ensurePetTables()` is a local-dev convenience, not a substitute for the SQL file.

Cap: **20 pets per user** (safety bound, not a product upsell).

### 3.1 `Pet`

Account-owned animal. Not `HealthProfile`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `userId` | UUID | FK User, `onDelete: Cascade` |
| `name` | String | 1–40 Unicode |
| `speciesId` | String | Catalog id (`dog`, `cat`, … `other`) |
| `breedId` | String | Catalog id; `mixed` / `unknown` / `custom` always valid |
| `customBreed` | String? | Required when `breedId = custom`; otherwise null |
| `sex` | String | `MALE` \| `FEMALE` \| `UNKNOWN` |
| `neutered` | Boolean? | `null` = unknown; never default false |
| `ageKind` | String | `EXACT` \| `APPROXIMATE` \| `UNKNOWN` |
| `birthDate` | DateTime? `@db.Date` | **Only when `ageKind = EXACT`** |
| `approxAgeYears` | Int? | Whole years at `approxAgeRecordedOn` |
| `approxAgeMonths` | Int? | 0–11; both years/months allowed |
| `approxAgeRecordedOn` | String? | Civil `YYYY-MM-DD` when the estimate was stated |
| `photoUrl` | String? | Storage key `/uploads/<uuid>.ext`, not a public URL |
| `vetClinicName` | String? | Current clinic (max 160) |
| `vetName` | String? | |
| `vetPhone` | String? | |
| `vetAddress` | String? | User text; no geocode/maps in v1 |
| `vetNotes` | String? | |
| `archivedAt` | DateTime? | Soft-hide; do not hard-delete care history by default |
| `createdAt` / `updatedAt` | DateTime | Instants |

Indexes: `[userId]`, unique enough via UUID. List query: `userId` + `archivedAt IS NULL`.

**Age invariant (server Zod + unit tests):**

- `EXACT` → `birthDate` required; approx fields null.
- `APPROXIMATE` → `birthDate` **null**; at least one of years/months; `approxAgeRecordedOn` required.
- `UNKNOWN` → `birthDate` and approx fields all null.
- Display age for approximate: recorded age + elapsed civil months since `approxAgeRecordedOn`. **Do not back-write `birthDate`.**
- Exact age: same UTC DATE method as `calculateAge` in `patient.js`.

### 3.2 `PetWeightLog` (Phase 3)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `userId`, `petId` | UUID | Dual ownership |
| `recordedOn` | String | Civil `YYYY-MM-DD`; not future |
| `weightKg` | Decimal(10,5) | Normalized kg; min 0.001, max 5000 |
| `inputValue` | Decimal(12,4) | What the owner typed |
| `inputUnit` | String | `kg` \| `g` \| `lb` |
| `note` | String? | max 280 |
| `clientRequestId` | String? | Create retry idempotency |
| `createdAt` / `updatedAt` | DateTime | |

No unique `(petId, recordedOn)` — same-day rows are not silently overwritten. Latest = recordedOn desc, createdAt desc, id desc. **Never** write `HealthMetricDaily.weightKg` or `medicard.weight.logs.v1`.

### 3.3 `PetAllergy` / `PetCondition` (Phase 3)

| Allergy | Notes |
|---|---|
| `name` | Allergen text |
| `category` | `medication` \| `food` \| `environmental` \| `other` \| `unknown` |
| `reaction` | Optional observed reaction |
| `reportedStatus` | `suspected` \| `veterinarian_confirmed` |
| `notedOn` | Optional civil date |
| `notes` | Optional |

| Condition | Notes |
|---|---|
| `name` | Owner text |
| `status` | `active` \| `resolved` \| `unknown` |
| `reportedBasis` | `owner_reported` \| `veterinarian_confirmed` |
| `onsetOn` | Optional; onset or diagnosis if known |
| `resolvedOn` | Only when status is resolved; ≥ onsetOn |
| `notes` | Optional |

Empty allergy list is not “no allergies”. Do not reuse human `allergyCatalog.ts`.

### 3.4 `PetProduct`

Physical item the owner has (tube, vaccine vial, tablet pack). Kind `VACCINATION` | `FLEA_TICK` | `DEWORMING` | `MEDICATION` | `OTHER`. Name, optional formulation/strength, notes, batch, `expiresOn`. **Expiry never computes next due.** No fabricated catalog.

### 3.5 `PetCareSchedule`

Planned care. Recurrence intent is stored (`recurrenceKind`, `intervalCount`, `recurrenceBasis`, `startOn`, times, course bounds, `revision`). `nextDueOn` is derived. `reminderEnabled` default **false**.

### 3.6 `PetCareEvent`

What actually happened. Snapshots only. Optional schedule/occurrence link. Standalone history allowed.

### 3.6b `PetCareOccurrence` (Phase 4 adjustment)

Stable occurrence identity for Phase 5. Status `OPEN` | `ADMINISTERED` | `SKIPPED` | `CANCELLED`. Unique `(scheduleId, occurrenceKey)`.

### 3.7 `PetReminderDelivery` (delivery record)

What the OS/Brain did. Separate from events and schedules.

| Field | Type | Notes |
|---|---|---|
| `scheduleId` | UUID | |
| `userId`, `petId` | | |
| `identity` | String | Dedupe key (see §6) |
| `plannedOn` | String | Civil date of the occurrence |
| `plannedTime` | String | `HH:mm` after quiet-hour bump |
| `status` | String | `SCHEDULED` \| `SHOWN` \| `CONFIRMED` \| `SKIPPED` \| `CANCELLED` \| `SUPPRESSED` |
| `shownAt` | DateTime? | |
| `resolvedAt` | DateTime? | |
| `reason` | String? | Brain reason code |

This is **not** `NotificationDecision` (admin-sanitized Engage audit). Pets may still POST sanitized decisions for admin later; domain truth lives here.

### 3.8 `PetChatSession`

Isolated from `ChatSession`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `userId`, `petId` | | Session dies if pet is hard-deleted |
| `title` | String | From first message, like human chats |
| `messages` | Json | `{ role, content, timestamp }` |
| `createdAt` / `updatedAt` | DateTime | |

`ChatSession.mode` stays `DOCTOR` \| `CONSILIUM`. Do not add `VET` to `POST /api/ai/query`.

`AiInteraction.mode` gains `'VET'`. `chatSessionId` may store the pet session id (loose string, same as today). Quest `MEDI_USED` stays human DOCTOR/CONSILIUM only (`server/src/lib/quest.js`).

### 3.9 Relationships (logical)

```
User 1 ──< Pet
Pet  1 ──< PetWeightLog
Pet  1 ──< PetCondition
Pet  1 ──< PetAllergy
Pet  1 ──< PetProduct
Pet  1 ──< PetCareOccurrence
PetCareSchedule 1 ──< PetCareOccurrence
PetCareOccurrence optional 1—1 PetCareEvent
PetProduct  optional on Schedule and Event
```

Account delete: Prisma `onDelete: Cascade` from User → Pet → children. Extend `deleteUser.js` to `unlinkStoredUpload` for `Pet.photoUrl` (today it only unlinks `MedicalRecord`).

---

## 4. Species and breed catalogs

**Source of truth:** `server/src/lib/petsCatalog.js`  
**Mobile snapshot (offline labels):** `mobile/src/lib/petsCatalog.js` — duplicated, Metro cannot import server.  
**API:** `GET /api/pets/catalog` returns `{ version, species, coverageNotes }`.

### 4.1 Honest coverage

| `speciesId` | Breed list | Honesty |
|---|---|---|
| `dog` | Common companion breeds + Georgian-relevant names | Not FCI-complete |
| `cat` | Common companion breeds | Not CFA-complete |
| `bird` | Empty breeds | `unknown` / `custom` / `mixed` only |
| `rabbit` | Same | |
| `rodent` | Same | hamster/guinea pig as custom or later subtype |
| `fish` | Same | |
| `reptile` | Same | |
| `horse` | Same | |
| `other` | No breeds | `custom` required |

Every species includes breed sentinels: `unknown`, `mixed`, `custom`. UI copy must say coverage is incomplete (Georgian). Do not ship a fake 400-breed picker for birds.

Catalog version string: `pets-species-v1`. Removing an id: keep historical `Pet.speciesId` / `breedId`; stop offering it on create. Same pattern as pregnancy catalog obsolescence.

Informational preventive notes (optional later file `docs/PETS_PREVENTIVE_DATA.md`) are **not** schedules.

---

## 5. API contracts

Mount in `server/src/server.js`:

```js
app.use('/api/pets', petsRouter);
```

New files: `server/src/routes/pets.routes.js`, `server/src/lib/petsOwnership.js`, `server/src/lib/petsAge.js`, `server/src/lib/petsCivilDate.js`, `server/src/lib/petsAiContext.js`.

All routes: `router.use(requireAuth)`. Resolve pet with `findFirst({ where: { id, userId: req.user.id } })`. Child routes take `:petId` from the path, never from body as the authority.

### 5.1 Pets

| Method | Path | Body / notes |
|---|---|---|
| `GET` | `/api/pets` | `{ schemaReady, pets: PetSummary[] }` |
| `POST` | `/api/pets` | create; 409 if 20 already |
| `GET` | `/api/pets/:petId` | full pet + latest weight |
| `PATCH` | `/api/pets/:petId` | partial; age invariant |
| `POST` | `/api/pets/:petId/archive` | sets `archivedAt` |
| `POST` | `/api/pets/:petId/photo` | multipart `file`; `saveUpload`; replace previous key + unlink |
| `GET` | `/api/pets/catalog` | species/breed |

Photo GET stays `GET /api/files/:filename`. Extend `authorizePrivateUpload` / `findOwnedMedicalUpload` in `server/src/lib/privateUploads.js` to also match `Pet.photoUrl` (and later product images if any). Tests in `privateUploads.test.js`.

### 5.2 Weight, conditions, allergies

| Method | Path |
|---|---|
| `GET/POST` | `/api/pets/:petId/weights` |
| `PATCH/DELETE` | `/api/pets/:petId/weights/:id` |
| `GET/POST` | `/api/pets/:petId/conditions` |
| `PATCH/DELETE` | `/api/pets/:petId/conditions/:id` |
| `GET/POST` | `/api/pets/:petId/allergies` |
| `PATCH/DELETE` | `/api/pets/:petId/allergies/:id` |

### 5.3 Products, schedules, events, confirm

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/pets/:petId/products` | `expiresOn` only; archive does not cancel plans |
| CRUD | `/api/pets/:petId/schedules` | full recurrence; reminder default off |
| `GET` | `/api/pets/:petId/care/upcoming` | bounded due / overdue / upcoming |
| `GET` `POST` | `/api/pets/:petId/events` | history; standalone does not advance a plan |
| `POST` | `/api/pets/:petId/schedules/:id/complete` | event + occurrence + advance, idempotent |
| `POST` | `/api/pets/:petId/schedules/:id/skip` | occurrence `SKIPPED`, not an event |
| `POST` | `/api/pets/:petId/events/:id/void` | confirmation; FROM_ADMINISTRATION needs `confirmRecalculate` |

### 5.4 Medi Vet (isolated)

**Do not** extend `querySchema` in `server/src/routes/ai.routes.js`.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/pets/:petId/chat/query` | `enforceAiQuota`; SSE like `/api/ai/query`; `mode` implicit `VET` |
| `GET` | `/api/pets/:petId/chats` | that pet only |
| `GET/DELETE` | `/api/pets/:petId/chats/:id` | 404 if other pet |

`withPetAiContext(petId, userId)` loads **only**: pet identity, species/breed, age representation (exact or approximate, labeled), sex, neuter, latest weights (bounded), active allergies/conditions, recent care events, active schedules, current vet fields. **Never** call `withPatientAiContext` / `loadPatientAiBundle`.

Engine: **OpenRouter only** via `resolveOpenRouterModel(user)`. If `user.aiEngine === 'evidencemd'`, still use OpenRouter for VET. EvidenceMD is the human clinical engine (`evidencemd.js`) and must not see animals.

Prompt: `SYSTEM_PROMPTS.VET` in `prompts.js` (bump `PROMPT_VERSION`). Georgian; Medi voice; **not a veterinarian**; species-aware; no human dosing; 112/emergency for people is not a pet protocol — tell the owner to contact an emergency vet / clinic. Disclaimer appended in code (new constant, not `DISCLAIMER_KA`).

Client: new `streamPetVetQuery` next to `mobile/src/lib/aiQueryStream.js` (do not send `mode: 'DOCTOR'`). Screen `/pets/[id]/chat`, not `/chat/vet` (human `getConversationalChatProfile` would fall through to Medi).

Quota: same `PeriodUsage` credits. Records tab `api.chats.list()` stays human. Home recent activity stays human.

### 5.5 Mobile API namespace

`mobile/src/lib/api.ts` — `api.pets` beside `api.visits` / `api.medications`. Auth: existing `getToken()` Bearer.

Local drafts (add-pet wizard): `getScopedPreference('medicard.pets.draft.v1')` in `mobile/src/lib/localAccount.ts`. No unscoped keys.

---

## 6. Navigation, UI, copy

### 6.1 Routes

```
mobile/app/pets/_layout.tsx
mobile/app/pets/index.tsx          hub list
mobile/app/pets/new.tsx            add flow
mobile/app/pets/[id]/index.tsx     profile
mobile/app/pets/[id]/edit.tsx
mobile/app/pets/[id]/weight.tsx
mobile/app/pets/[id]/care.tsx      history (events)
mobile/app/pets/[id]/schedule.tsx
mobile/app/pets/[id]/chat.tsx      Medi Vet
```

Register `<Stack.Screen name="pets" options={{ headerShown: false }} />` in `mobile/app/_layout.tsx`.

Entry: **Profile**, after Companion/Quest, titled section `HomeSectionTitle` + pet cards / empty CTA. Not a bottom tab. Not inside `ka.profile.medicalProfile` (that card is the human). Not Home v1. Optional `MODULE_TILES` skip (analysis bento is human lab/imaging/skin).

Reuse: `Card`, `Button`, `Input`, `DateField`, `EmptyState`, `APP_MODAL_PROPS`, static `Pressable` styles (NativeWind drops function-form styles). Photo: `toUploadableImage` / `IMAGE_PICKER_OPTIONS`, not `AvatarCarousel`.

Copy: `ka.pets` in `mobile/src/i18n/ka.ts`. Voice: Profile/settings formal (`თქვენ`); Medi Vet UI direct (`შენ`), matching `docs/GEORGIAN_STYLE_GUIDE.md`. Latin **Medi Vet** with hyphenated Georgian cases (`Medi Vet-ს`, `Medi Vet-თან`).

Store-facing copy bump: when the first Pets UI ships, increment `expo.version` revision (`1.0.0.8.24` → `1.0.0.8.25`) per `AGENTS.md`. Architecture-only does **not** bump.

### 6.2 Chat UI

Reuse `ChatScreenShell`, bubbles, input bar, quota sheet. New `ChatUiProfile` for Medi Vet (`mobile/src/lib/chatUiConfig.ts`) used only by `/pets/[id]/chat`. Suggestions species-light and non-diagnostic.

---

## 7. Notification flow

Brain remains the **sole** delivery authority. No Expo send from `pets.routes.js`. No Render cron. Server `sendExpoPush` stays admin campaigns + quota refill (`server/src/lib/usageNotify.js`).

### 7.1 Client pieces to add

| File | Change |
|---|---|
| `mobile/src/lib/notifications.ts` | `NOTIF_PREFIX.pets = 'pets:'`, Android channel `pet-care-reminders` |
| `mobile/src/lib/petCareReminders.ts` | `syncPetCareReminders` (pregnancy analog) |
| `mobile/src/lib/petCareReminderContract.js` | candidates + identity |
| `mobile/src/lib/notificationPlan.ts` | `routeFromNotificationData` → `/pets/:id/schedule` |
| `mobile/src/lib/mediNotificationBrain.ts` | `shouldDeliverNotification` branch like pregnancy care |
| `mobile/src/lib/mediNotificationActions.ts` | confirm / snooze category |
| `mobile/src/lib/pushCopy.ts` + `server/src/lib/pushTemplates.js` | `pet-care` / `pet-care-masked` |

### 7.2 Semantics

- **Meaning:** `USER_SCHEDULED_CARE` — the owner set `nextDueOn`. Not `SPECIES_DUE_ITEM`.
- Opt-in: saving a schedule does **not** enable reminders (`reminderEnabled` default false).
- Identity: `pets:{userId}:{petId}:{scheduleId}:{occurrenceKey}`.
- Date-based: 09:00 device local, then `bumpOutOfQuiet`. Exact time only if `timeMode = EXACT_TIME` and `dueTime` set (pregnancy Phase 36 pattern: adding a date never auto-upgrades to exact).
- Caps: **not** Engage daily pool. **not** human medication channel. Reliability: dedicated Brain branch; suppress only if pet missing, schedule inactive, already `CONFIRMED`/`SKIPPED` for that `plannedOn`, or fire time in the past (no catch-up).
- Quiet hours: bump, no silent drop.
- Confirm action: `POST .../confirm` then cancel prefix + resync.
- Mask: if global discreet (`mediEngagePrefs.discreet`), use `pet-care-masked` («Medi-სგან შეხსენება» / no pet name, no product). Default unmasked may include pet name. Cycle privacy flags do **not** apply.

Hydrate: after `api.pets.list()`, `syncPetCareReminders` from Auth/AppShell (same place meds sync).

`NotificationDecision` ingest may record `family: petCareReminder` for admin later; not required for v1 delivery.

---

## 8. Timezone and DST

| Clock | Rule |
|---|---|
| Stored care/visit/weight days | Civil `YYYY-MM-DD`. Never `Date#toISOString()` as identity. `assertStableCivilDate`. |
| Exact birth date | `@db.Date` + UTC midnight, same as `User.birthDate` |
| «Today» for due/overdue | Device IANA (`X-Client-Timezone`, already sent by `aiQueryStream.js` / API client) → fallback `Asia/Tbilisi` |
| Reminder fire | Device local (Expo DATE/TIME), same as meds/visits |
| Quota / analytics / check-in | Unchanged: `Asia/Tbilisi`, `TBILISI_OFFSET = '+04:00'` |

**DST:** Georgia / `Asia/Tbilisi` has **no DST** (`server/src/lib/adminAnalyticsRange.js`). Travelers’ phones may. Historical `YYYY-MM-DD` rows do not shift when the device TZ changes (Cycle rule). Delivery follows the current device TZ; identity key includes `nextDueOn`, not a UTC instant.

Helper: `server/src/lib/petsCivilDate.js` may wrap `cycleCivilDate.js` / `todayInTimeZone` rather than forking calendar math. Do not use host TZ.

---

## 9. Phased rollout

Do not implement later phases in the same PR as schema without the matching tests. Each phase is Android-first (iOS native QA is deferred by product, same as Cycle).

### Phase 1 — this document

Architecture + handoff. No schema, no routes, no UI, no Neon execute, no deploy.

**Acceptance:** this file exists; MEMORY/AGENTS point at it; no production mutation.

### Phase 2 — identity

**Implemented 2026-09-14** (schema SQL file + Prisma `Pet`, CRUD, photo, catalog, Profile hub). Table not applied on Neon. See the Phase 2 section at the top of this file.

**AC:**

- User can add ≥2 pets; another account’s UUID 404s.
- `EXACT` stores `birthDate`; `APPROXIMATE` stores years/months + recorded-on and **no** birthDate.
- Catalog offers unknown/mixed/custom; bird/rabbit/etc. do not fake full breed lists.
- Photo served only with Bearer owner match.
- `deleteUserAccount` unlinks pet photos.

### Phase 3 — health facts

**Implemented 2026-09-14.** SQL file not applied on Neon. Identity endpoints stay up if only Phase 3 tables are missing.

**AC:**

- Weight / allergy / condition rows are per pet; human weight hub unchanged.
- Same-day weight is not silently overwritten; retries replay `clientRequestId`.
- Latest weight follows recordedOn, not insert order of a backdated row.
- Empty allergies copy does not claim “no allergies”.
- Cross-pet and cross-account child IDs 404. Archived pets 404.

### Phase 4 — care ledger

**Implemented 2026-09-14.** SQL file not applied on Neon. Identity and Phase 3 health stay up if only Phase 4 tables are missing.

**AC:** owner types interval or a next date; empty interval + confirm closes one-shot; product expiry can pass while `nextDueOn` is in the future; past vaccine can be logged as event without a schedule; occurrence identity is stable for Phase 5.

### Phase 5 — reminders

**Implemented 2026-09-14** (local Notification Brain). SQL `pets-phase5.sql` not applied on Neon. Care tables still missing on hosted Neon → reminder feed/PATCH 503.

**AC (code):** reminder off by default; reminder PATCH does not bump revision; confirm writes event via Phase 4 complete endpoint; Brain suppressions in contract tests; no server cron; human `med:` never evicted; Pets not in Engage pool.

**AC (device):** OS banner + closed-app fire **not verified** this pass (no emulator run). Do not treat helper tests as OS delivery proof.

### Phase 6 — Medi Vet

Implemented in the tree (2026-09-14). Isolated pet assistant via server-side OpenRouter. Text chat is the complete v1 path. Attachments are deferred (no capability-checked image pipeline reused).

#### AI routing (actual)

| Rule | Implementation |
|---|---|
| Route | `POST /api/pets/:petId/chat/query` in `server/src/routes/petsChat.routes.js` |
| Prompt | `SYSTEM_PROMPTS.VET` (`prompts.js`, version **1.8.0**) |
| Transport | `askOpenRouterPrepared` / `askVetAi` — **never** `askAi()`, **never** `askEvidenceMd`, **never** `withPatientAiContext` |
| Human query | `POST /api/ai/query` remains `DOCTOR` \| `CONSILIUM` only |
| EvidenceMD | Excluded from the initial model **and** the VET fallback chain. User picker `evidencemd` still maps to configured OpenRouter Gemini via `resolveOpenRouterModel` |
| Fallback chain | `vetOpenRouterModels(user)` = `openRouterFallbackModels(resolveOpenRouterModel(user))` filtered to `OPENROUTER_MODELS` values only (`google/gemini-3.8-flash`; Ling only if the user picked `ling_free`). If OpenRouter is missing/down → 503 `OPENROUTER_UNAVAILABLE` |
| Images | Not assumed. No attachment control on `/pets/[id]/chat` |

#### Context and privacy

`server/src/lib/petsAiContext.js` (`pets-ai-context-v1`) loads a bounded snapshot for the owned active pet only: name, species/breed representation, exact/approximate/unknown age (labeled), sex/neutering, latest weight + date/units, allergy reported/confirmed status, active + resolved conditions, recent **RECORDED** administrations, upcoming **plans** marked as plans. Missing records are not absence of disease.

Never sent: owner human health, address, microchip, vet clinic/phone/name/address, other pets, `HealthProfile` / meds / cycle. Pet names, notes, chat, and retrieved text are wrapped in untrusted tagged blocks and **not** interpolated into the static system prompt.

#### Session / message APIs

| Method | Path |
|---|---|
| GET | `/api/pets/:petId/chats` |
| POST | `/api/pets/:petId/chats` |
| GET | `/api/pets/:petId/chats/:sessionId` |
| GET | `/api/pets/:petId/chats/:sessionId/messages` |
| DELETE | `/api/pets/:petId/chats/:sessionId` |
| POST | `/api/pets/:petId/chat/query` |
| POST | `/api/pets/:petId/chat/drafts/validate` |

Every row resolves through an owned **active** pet. Cross-account and same-account wrong-pet session IDs → 404. History is loaded from `PetChatMessage` (user/assistant, COMPLETE only). Client-supplied `messages` / `role` / `system` is rejected. Bounds: 2–4000 input chars, last 12 turns, 2400 output tokens, 1 in-flight assistant per pet. `clientRequestId` is required for query idempotency. Statuses: PENDING / PARTIAL / COMPLETE / FAILED / CANCELLED. Incomplete streams are not stored as COMPLETE.

SQL: `server/prisma/pets-phase6.sql` after phase2→3→4 (phase5 optional). Missing chat schema → 503 `{ chatSchemaReady: false }` and must not break identity/health/care/reminders.

#### Quota

Shared `enforceAiQuota`. Reservation is `PeriodUsage.reserved` (Phase 7). One logical **COMPLETE** accepted request is billed once (`shouldConsumeVetCredit` + `commitAiCredit`). Replays, cancel, fail, and partial **release** the reservation and do not consume. Concurrent requests cannot pass `count + reserved < limit`. Max 2 in-flight reservations per user. `AiInteraction.mode = 'VET'`. Quest `MEDI_USED` stays human DOCTOR/CONSILIUM.

#### Grounding

`server/src/lib/petsVetReferences.js` — curated Medicard-authored summaries pointing at official public pages (EMA Bravecto/NexGard EPARs, WOAH rabies, WSAVA vaccination landing). Not copies of those publications. Retrieved source **content** is passed to the model. Citation IDs are filtered server-side to retrieved IDs. Ungrounded output is never labeled verified. No arbitrary URL fetch. Product-specific dose/interval claims are restricted when nothing was retrieved. This is a bounded v1 set, not a complete veterinary corpus — remaining clinical review is a release gap.

#### Draft confirmation

Medi Vet may emit a `care-draft` JSON fence. Server validates via `validateCareDraft` (petId from route, optional owned product, user-provided dose/dates/recurrence only). The model cannot write care, mark administered, cancel schedules, or enable reminders. Mobile shows a review card and opens the existing Phase 4 plan form prefilled. Save is `POST /api/pets/:petId/schedules` after explicit confirm. Reminder opt-in remains the Phase 5 flow. UI says saved only after that API succeeds.

#### Mobile

`/pets/[id]/chat`, Medi Vet entry on the pet profile, copy under `ka.pets`, `ChatUiProfile` key `vet` only for this screen, streaming via `streamPetVetQuery`, first-use OpenRouter disclosure, no camera/mic attachment control.

**AC:** `/api/ai/query` still only DOCTOR/CONSILIUM; Records chat list has no VET; evidencemd users still get OpenRouter for VET; prompt never asks «ეს შენ ხარ თუ შვილი?» for a dog; other pet’s facts not in context.

**Verification this pass**

| Result | What |
|---|---|
| Passed | Isolated routing (no EvidenceMD in VET chain); context isolation; planned ≠ administered; citation allowlist; draft validation; quota reservation HTTP; VET prompt; Georgian copy; policy eval set; `petsChat.http.test.js` on isolated PG |
| Skipped on hosted Neon | All pets `*.http.test.js` unless `127.0.0.1:55432/medicard_pets_phase7` or `PETS_HTTP_TEST=1` |
| Live OpenRouter | Bounded eval ran 2026-09-14: 7/8 ok on `google/gemini-3.8-flash`; bird case 502; clinical review outstanding |
| Not run | OS notification device QA; Neon apply; Expo/dev-build visual QA; `qa/pets-phase7/` screenshots |

Unit tests do **not** prove clinical safety. Keyword/policy layers are application behavior, not a veterinarian.

### Phase 7 — verification / release prep

Local SQL + HTTP candidate. Hosted Neon still unapplied. Device reminder journey, iOS, Georgian visual screenshots, durable photos, legal sign-off, and clinical review remain blockers. No version bump. No `qa/pets-phase7/` screenshot folder (no attached device). Admin encyclopedia still has no Pets entry.

---

## 10. Tests (required per phase)

Add every new file to `server/package.json` `"test"` (the script is an explicit list).

| File | Asserts | Phase |
|---|---|---|
| `server/src/lib/petsAge.test.js` | exact / approximate / unknown; no fabricated birthDate; civil-date TZ round trip | 2 |
| `server/src/lib/petsOwnership.test.js` | missing/other-owner/archived → 404 | 2 |
| `server/src/lib/petsCatalog.test.js` | sentinels; honest empty breed lists | 2 |
| `server/src/lib/petsIsolation.http.test.js` | cross-account list/detail/edit/archive/photo; archive exclusion | 2 (localhost DB only) |
| `server/src/lib/privateUploads.test.js` | pet photo owner | 2 |
| `mobile/src/lib/petsCatalog.test.js` | catalog version + sentinels | 2 |
| `mobile/src/i18n/petsCopy.test.js` | hub copy; no Nightingale | 2 |
| `mobile/src/lib/home/homeSectionOrder.test.ts` | Home order **unchanged** | 2 (pre-existing) |
| `server/src/lib/petsHealth.test.js` | conversion, latest-weight, dates, allergy/condition status, schema split | 3 |
| `server/src/lib/petsHealth.http.test.js` | cross-account/pet/archive child resources (localhost DB only; explicit skip) | 3 |
| `mobile/src/lib/petsHealth.test.js` | 503 ≠ empty; trend text has no invented dates | 3 |
| `server/src/lib/petsCivilDate.test.js` | month-end anchor; leap years; months ≠ N days | 4 |
| `server/src/lib/petsSchedule.test.js` | occurrence ids; fixed vs admin recurrence; backlog bound; idempotency hash | 4 |
| `server/src/lib/petsCare.test.js` | validation; snapshots; wrong-pet helper | 4 |
| `server/src/lib/petsCare.http.test.js` | cross-account/pet completion, cancel, archive (localhost DB only; explicit skip) | 4 |
| `mobile/src/lib/petsCare.test.js` | 503 ≠ empty; Georgian plan summary; complete labels | 4 |
| `mobile/src/lib/petCareReminderContract.test.js` | identity, opt-in, no catch-up, DST, capacity, 409, logout gate, honest states | 5 |
| `server/src/lib/petsReminders.test.js` | reminder PATCH must not mutate care; telemetry allowlist | 5 |
| `server/src/lib/petsReminders.http.test.js` | reminder PATCH revision unchanged (localhost DB only; explicit skip) | 5 |
| `mobile/src/lib/notificationPlan.test.js` | `pet_care` deep link + `pets:` prefix | 5 |
| `server/src/lib/petsAiContext.test.js` | human profile/meds/cycle absent; only requested pet | 6 |
| `server/src/lib/petsVetRouting.test.js` | EvidenceMD excluded from initial + fallback; no askAi | 6 |
| `server/src/lib/petsChat.test.js` | server-controlled roles; quota accounting; schema split | 6 |
| `server/src/lib/petsChat.http.test.js` | cross-account / wrong-pet chat (localhost DB only; explicit skip) | 6 |
| `server/src/lib/petsVetDraft.test.js` | draft validation; no invented dose; no mutation | 6 |
| `server/src/lib/petsVetReferences.test.js` | citation allowlist; no arbitrary URL fetch | 6 |
| `server/src/lib/petsVetEval.test.js` | Georgian eval set via policy layers (not clinical proof) | 6 |
| `server/src/lib/petsVetLive.eval.test.js` | live OpenRouter opt-in (`PETS_VET_LIVE_EVAL=1`); not clinical proof | 6/7 |
| `server/src/lib/petsPhase7.http.test.js` | identity/health/care/reminder telemetry/chat mock/delete on isolated DB | 7 |
| `server/src/lib/petsQuota.http.test.js` | concurrent complete, shared quota, stream cancel, provider fail | 7 |
| `server/src/lib/petsPartialSchema.http.test.js` | rename `PetReminderDelivery`; telemetry-only (`PETS_SCHEMA_MUTATION=1`) | 7 |
| `server/src/lib/prompts.test.js` | VET prompt exists; DOCTOR unchanged | 6 |

---

## 11. Implementation map (when coding starts)

| Work | Paths |
|---|---|
| Schema | `server/prisma/schema.prisma`, `server/prisma/pets-phase2.sql`, `server/docs/pets-phase2-deploy.md` (Companion-style) |
| Routes | `server/src/routes/pets.routes.js`, mount in `server/src/server.js` |
| AI | `server/src/lib/prompts.js`, `petsAiContext.js`, **not** `ai.routes.js` query enum |
| Files | `privateUploads.js`, `deleteUser.js` |
| Quota | reuse `enforceAiLimiter`; no new Package row required for v1 (`features.vetChat` optional later in `seed.js`) |
| Mobile screens | `mobile/app/pets/**`, root `_layout.tsx` |
| API client | `mobile/src/lib/api.ts` |
| Profile entry | `mobile/app/(tabs)/profile.tsx` |
| i18n | `mobile/src/i18n/ka.ts` `pets` |
| Catalog | `server/src/lib/petsCatalog.js`, `mobile/src/lib/petsCatalog.js` |
| Reminders | files in §7.1 |
| Theme | existing tokens only |

---

## 12. Real infrastructure blockers

1. **Neon apply is manual, and for Pets it is already done (2026-09-15 inspect).** Live DB has no `_prisma_migrations`. Render `preDeployCommand` still does **not** apply Pets SQL (`prisma generate` + seed only). **Do not re-execute** `pets-phase2.sql` … `pets-phase7.sql` as a release step. Do not `db push` (can propose dropping runtime tables such as `UserLocation`). See `docs/PETS_RELEASE_READINESS.md`.
2. **Upload disk is ephemeral.** `render.yaml` has **no persistent disk**. `saveUpload` writes `server/uploads/`. Pet photos (and lab images) vanish on Render restart/redeploy. Object storage (S3/R2) is the real fix; `storage.js` is already the swap point. Until then, photos are best-effort on that host.
3. **EvidenceMD is the wrong engine for animals.** VET must pin OpenRouter even when the user’s picker is EvidenceMD.
4. **Legal / store copy.** Pets/Medi Vet/OpenRouter/text-only/ephemeral photos/local reminders are drafted in `scripts/privacy-source.md` §3.4ა and rebuilt pages. **Legal review outstanding.** Camera/library strings in `mobile/app.json` mention pet photos. Breed-catalog attribution (CC BY-SA 4.0 Wikipedia subset) is on the pet form. Do not invent retention periods.
5. **Android remote push ≠ local reminders.** Medication-style reliability is local Expo notifications + Brain. Android FCM remote is a separate infra gap; Pets must not depend on it.
6. **iOS native QA deferred** — product decision, not a Pets blocker, but do not claim iOS visual sign-off.
7. **Quota product decision (documented, not blocked):** VET consumes the same daily AI credits as Medi. FREE is 3/day. Confirm before marketing «unlimited pet chat».
8. **Do not mix into frozen Cycle/pregnancy contracts.** No Cycle engine change. No Home section reorder in v1.

---

## 13. Explicit non-goals (v1)

- Veterinary marketplace, clinic search, geocoding, insurance
- Hardcoded national vaccine schedules
- Pet social, sharing, partner peek
- Pet labs/OCR (human `/module/lab` stays human)
- Putting pets in `DoctorVisit`, `MedicationSchedule`, `HealthProfile`, `ChatSession`, or Home next-dose
- EvidenceMD vet mode
- New bottom tab
- Inventing birthdays from «3 years old»
- Nightingale in UI copy

---

## 14. Handoff checklist for the next agent

1. Re-read this file and live `schema.prisma` / `pets.routes.js` / `petsHealth.routes.js` before coding.
2. Phase 7 local verification is in the tree. **Next operator action (do not do it unless asked):** apply SQL phase2→7 to a confirmed non-prod URL after `SELECT current_database(), inet_server_addr(), inet_server_port()`, then device reminder QA on a development build. No Home tile, no fifth tab.
3. Do **not** execute pets SQL against hosted Neon unless the user explicitly asks. Apply **phase2 → phase3 → phase4**, then **phase5** (telemetry/FKs), then **phase6**, then **phase7**.
4. Keep pets isolated from `HealthProfile`, `HealthMetricDaily`, and `medicard.weight.logs.v1`.
5. No deploy, no push, no `db push`, no version bump unless asked.
6. HTTP 200 on `/health` or `GET /api/pets` does **not** prove care/reminders: hosted Neon still lacks Phase 4 tables until an operator applies SQL.
