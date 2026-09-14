# Phase 3 — My Pets health facts (schema)

Additive only. **Do not** use `prisma db push`. Do not run this against hosted Neon unless an operator explicitly asks.

## Execution order

Phase 3 foreign keys reference `Pet`. Apply Phase 2 first.

```bash
cd server
npx prisma db execute --file prisma/pets-phase2.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/pets-phase3.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.

## Runtime

- Identity `/api/pets` continues to work if only Phase 2 is applied.
- Weight / allergy / condition endpoints return **503** `{ schemaReady: false, healthSchemaReady: false }` when Phase 3 tables are missing.
- A missing Phase 3 table must not 503 identity list/create/get/patch/archive/photo.

## Isolation

Do not write `HealthMetricDaily.weightKg` or `medicard.weight.logs.v1`. Pet allergies are not the human `allergyCatalog`.
