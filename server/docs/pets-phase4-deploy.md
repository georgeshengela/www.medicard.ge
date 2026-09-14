# Phase 4 — My Pets care ledger (schema)

Additive only. **Do not** use `prisma db push`. Do not run this against hosted Neon unless an operator explicitly asks.

## Execution order

1. `pets-phase2.sql` — identity (`Pet`)
2. `pets-phase3.sql` — weight, allergies, conditions
3. `pets-phase4.sql` — products, schedules, occurrences, events

```bash
cd server
npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase4.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.

## Runtime

Missing Phase 4 tables return **503** `{ schemaReady: false, careSchemaReady: false }`. Phase 2 identity and Phase 3 health keep working independently.

`PetCareOccurrence` is an architecture adjustment: stable occurrence identity for Phase 5 (`pets:{userId}:{petId}:{scheduleId}:{occurrenceKey}`). Reminders are **not** delivered in this phase (`reminderEnabled` stays false).
