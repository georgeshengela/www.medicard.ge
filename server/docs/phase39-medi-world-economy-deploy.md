# Medi World Phase 39 — local schema apply

Additive only. Requires Phase 38 World tables. Do **not** `prisma db push`. Do **not** run against production.

## Canonical apply

```bash
cd server
npx prisma db execute --file prisma/phase39-medi-world-economy.sql --schema prisma/schema.prisma
npx prisma generate
```

`prisma/migrations/20260912180000_medi_world_economy_v2/migration.sql` is the lockstep copy for migrate-tracked databases. **Do not run both** on the same database.

## Adds

Nullable ledger columns: `reasonCode`, `periodKey`, `logicalEventId`, `intentFingerprint`, plus indexes. Existing Phase 38 rows remain valid (`reasonCode` null → `FOUNDATION_LEGACY` in the API).
