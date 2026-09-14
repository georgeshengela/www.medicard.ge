# Phase 5 — My Pets local reminders (schema)

Additive delivery-log table only. **Do not** use `prisma db push`. Do not run this against hosted Neon unless an operator explicitly asks.

Local OS scheduling does **not** wait on this table. Care CRUD uses Phase 4 tables.

**What depends on `PetReminderDelivery`:** only `POST /api/pets/:petId/schedules/:scheduleId/reminder-delivery`.

**What does not:** list/create/edit pets; weight/allergy/condition; products/schedules/events/complete/skip; `PATCH .../reminders`; `GET /api/pets/reminders/feed`; local Notification Brain scheduling.

Missing table → telemetry `202` `{ accepted: false, reminderSchemaReady: false }`. Reminder functionality stays up. This SQL is optional for OS scheduling and required only if you want the delivery log (and account-delete cascade FKs).

## Execution order

1. `pets-phase2.sql` — identity (`Pet`)
2. `pets-phase3.sql` — weight, allergies, conditions
3. `pets-phase4.sql` — products, schedules, occurrences, events
4. `pets-phase5.sql` — `PetReminderDelivery`

```bash
cd server
npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase4.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase5.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the Medicard API process first if `query_engine-windows.dll.node` is locked.

## Honesty

- `SCHEDULED_LOCAL` means this install asked the OS to schedule. It is not proof of a banner.
- `RECEIVED_CALLBACK` is only recorded when the installed notification handler ran.
- Dismissal is not a stored state.
- No notification copy or clinical notes in this table.
