# Medi World Phase 38 — local schema apply

Additive only. Do **not** use `prisma db push`. Do **not** run this against production from the Phase 38 working tree.

## Canonical apply path

This repository historically applies additive SQL with `prisma db execute` (Phase 8/9 style). Live databases may lack `_prisma_migrations`.

**Canonical command:**

```bash
cd server
npx prisma db execute --file prisma/phase38-medi-world-foundation.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.

`prisma/migrations/20260912120000_medi_world_foundation/migration.sql` is kept in lockstep for environments that already use `prisma migrate deploy`. **Do not run both** against the same database.

Repeated `db execute` of the canonical file is idempotent (`IF NOT EXISTS`). Do not re-run the raw SQL by hand as a second deployment ritual.

## Verify

Tables `MediWorldProfile` and `MediWorldLedger` exist. Unique index on `MediWorldLedger.idempotencyKey`. CHECK constraints: non-negative balances/amounts, ratio 0–10000, `transactionType IN ('CREDIT','DEBIT')`.

## Runtime

- Routes: `GET /api/medi-world`, `GET /api/medi-world/ledger`
- No public award/spend route. `POST /api/medi-world/foundation-activity` was removed in Phase 38.1; tests use the internal engine.
- Quest completion hook: `applyQuestCompletionToMediWorld` inside `completeQuestInTx`
- Production default: `MEDI_WORLD_ENABLED` unset → disabled
- Public bootstrap: `settings.mediWorldEnabled` on `GET /api/app/status`
- Missing World tables while the flag is on: Quest still completes; World GET/ledger return `503 WORLD_UNAVAILABLE` with a privacy-safe `WORLD_SCHEMA_MISSING` log. No fake zero profile.

Historical `QuestCompletion` rows are never scanned or backfilled.

## Ledger direction (Phase 38.1)

`MediWorldLedger.transactionType` is `CREDIT` or `DEBIT`. Amounts stay non-negative integers. Phase 38 writes `CREDIT` only. Profile balances cannot become negative. No spend endpoint.

## Feature flags

Server `MEDI_WORLD_ENABLED` is authoritative for production availability. Mobile compile-time `__DEV__` / `EXPO_PUBLIC_MEDI_WORLD` can hide the entry, but cannot turn production on without `settings.mediWorldEnabled`.
