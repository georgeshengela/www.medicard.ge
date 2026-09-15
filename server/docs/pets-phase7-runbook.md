# Pets Phase 7 — operator runbook (local / hosted)

Do **not** `prisma db push` on hosted Neon. Do not invent `_prisma_migrations` history. Render `preDeployCommand` does not apply these files.

## Isolated local target (Phase 7 verification)

A disposable PostgreSQL 18 cluster was used at `127.0.0.1:55432` / database `medicard_pets_phase7`. That process is local-only. It is **not** `DATABASE_URL` in `server/.env` (hosted Neon).

Before every `psql` / `prisma db execute`, print:

```sql
SELECT current_database() AS db, inet_server_addr() AS addr, inet_server_port() AS port, current_user;
```

Refuse if `db` is not the intended database or `addr` is not `127.0.0.1` for local work.

## Required order

Base schema (local empty database only): established `prisma db push` **or** current production schema.

Then additive Pets SQL, in this order, using the **SQL files** (not `db push` as proof):

1. `server/prisma/pets-phase2.sql` — `Pet`
2. `server/prisma/pets-phase3.sql` — weight / allergy / condition
3. `server/prisma/pets-phase4.sql` — product / schedule / occurrence / event
4. `server/prisma/pets-phase5.sql` — `PetReminderDelivery` (optional for OS reminders; required for telemetry + delete cascade FKs)
5. `server/prisma/pets-phase6.sql` — Medi Vet `PetChatSession` / `PetChatMessage`
6. `server/prisma/pets-phase7.sql` — `PeriodUsage.reserved`, reminder FKs if missing, one in-flight Medi Vet index
7. `npx prisma generate`

`server/prisma/ai-quota-reservation.sql` is the same `reserved` column as step 6, for operators who apply quota without Pets.

## Operator commands (placeholders)

```bash
cd server
# Confirm target first. Replace the URL only after the SELECT above matches.
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB?sslmode=require'

npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase4.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase5.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase6.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase7.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop Medicard `node --watch src/server.js` if `query_engine-windows.dll.node` is locked.

## Schema verification

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'Pet%' ORDER BY 1;
SELECT column_name FROM information_schema.columns WHERE table_name = 'PeriodUsage' AND column_name = 'reserved';
SELECT indexname FROM pg_indexes WHERE indexname = 'PetChatMessage_petId_inflight_key';
```

Expect 11 Pets tables after phase 6. `reserved` after phase 7.

## Configuration

- `OPENROUTER_API_KEY` — required for Medi Vet. Missing → 503, never EvidenceMD.
- `OPENROUTER_MODEL` default `google/gemini-3.8-flash`. Do not invent IDs.
- Mobile `EXPO_PUBLIC_API_URL` — for QA point at the **isolated** API, never accidentally `https://medicard.ge` while Pets SQL is unapplied.
- No new feature-flag platform. Gate is schema-ready 503 (`schemaReady` / `careSchemaReady` / `chatSchemaReady` / `reminderSchemaReady`).

## Backend / mobile compatibility

- Identity works with phase 2 only.
- Health needs phase 3. Care needs phase 4. Chat needs phase 6. Reminders (OS) need phase 4 + device permissions; telemetry needs phase 5.
- Missing later tables must not 500 earlier routes.
- `PeriodUsage.reserved` is shared with human Medi. Apply before enabling concurrent AI in production.

## Authenticated smoke

1. Create accounts A and B. Create two pets on A (exact / approximate / unknown age).
2. Weight, allergy, condition CRUD. Confirm other-account 404.
3. Product → schedule → complete one occurrence → next due advances once.
4. `PATCH .../reminders` does not bump `revision`.
5. `POST .../reminder-delivery` → `accepted: true` if phase 5 present, else `reminderSchemaReady: false`.
6. Medi Vet text query with `clientRequestId`. Replay same id. Confirm no EvidenceMD.
7. Archive pet → 404 on reads. Delete account A → no leftover pet rows.

Isolated HTTP (this machine):

```bash
export DATABASE_URL='postgresql://medicard_pets@127.0.0.1:55432/medicard_pets_phase7'
cd server
node --test --test-concurrency=1 \
  src/lib/petsIsolation.http.test.js src/lib/petsHealth.http.test.js \
  src/lib/petsCare.http.test.js src/lib/petsReminders.http.test.js \
  src/lib/petsChat.http.test.js src/lib/petsPhase7.http.test.js \
  src/lib/petsQuota.http.test.js
PETS_SCHEMA_MUTATION=1 node --test --test-concurrency=1 src/lib/petsPartialSchema.http.test.js
PETS_VET_LIVE_EVAL=1 node --test src/lib/petsVetLive.eval.test.js
```

Do not run `PETS_SCHEMA_MUTATION=1` in parallel with other pets HTTP files.

## Reminder acceptance (device)

Needs a development build with the Notification Brain. Expo Go is **not** sufficient proof if DATE triggers or background handlers are limited.

- Enable permission → schedule near-future occurrence → OS pending list → background → open occurrence → complete → obsolete ids removed → reconcile without duplicates.
- Human medication notifications must remain.
- Denied permission, snooze, cancel/archive, logout: see architecture. Do not promise every OS state.

## AI acceptance

- One COMPLETE consumes once. Replay / cancel / fail / partial do not.
- Concurrent requests near the cap cannot bypass `count + reserved < limit`.
- Max 2 in-flight AI reservations per user. 30 provider starts / 10 minutes (in-process).
- Clinical review of live answers is **outstanding** unless an appropriate reviewer signed off.
- Bounded live eval: `PETS_VET_LIVE_EVAL=1`. VET models are `google/gemini-3.8-flash` then `inclusionai/ling-3.0-flash-sante:free`. Do not invent IDs. Env `OPENROUTER_MODEL` (this host: `openai/gpt-4o`) is not the VET chain.

## Rollback / disable (preserve history)

Do **not** drop Pets tables. History stays.

- Chat: stop mounting `petsChatRouter` or leave tables and let clients hide Medi Vet if `chatSchemaReady` is false (do not drop).
- Care: same with care routes / 503 if tables removed — **do not remove tables** to “disable”.
- Reminders: `PATCH` `reminderEnabled: false`; local reconcile cancels pending OS ids.
- Quota reservation column can remain; it does not bill by itself.

## Honesty

**2026-09-15:** Hosted Neon Pets SQL **is applied** (11 `Pet*` tables, `PeriodUsage.reserved`/`reservedAt`, reminder FKs, inflight chat index). Production `/api/pets` is mounted. **Do not re-apply SQL. Do not `db push`.** Phase 7.1 Pixel_8 `:4010` remains isolated-only evidence. **OS reminder banners and iOS were not observed.** Owner-reported create/weight/allergies/Medi Vet chat on production is recorded in `docs/PETS_PHASE7_VERIFICATION.md`. Rollout: `docs/PETS_RELEASE_READINESS.md`.
