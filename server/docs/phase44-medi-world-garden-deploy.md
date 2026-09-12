# Medi World Phase 44 — schema apply

Additive only. Do **not** use `prisma db push`. Do **not** run this against production from this working tree.

Do not rewrite historical Cycle migrations. Empty `prisma migrate deploy` still fails on historical Cycle SQL. That is separate release-infrastructure debt.

## One recommended path

Pick **exactly one**.

### A. Accepted Phase 43 disposable baseline (this phase’s verification path)

Start from a database that already has Phase 43 schema (movement tables present). Then:

```bash
cd server
npx prisma db execute --file prisma/phase44-medi-world-garden.sql --schema prisma/schema.prisma
npx prisma generate
```

On a migrate-tracked copy of that baseline (after Prisma baseline through `20260913010000_medi_world_movement`):

```bash
npx prisma migrate deploy
```

The Phase 44 folder is `prisma/migrations/20260913020000_medi_world_garden/`. It sorts **after** Phase 43.

### B. Historical `db execute` databases (no `_prisma_migrations`)

Same canonical file as A. Never also `migrate deploy` the same change on that database.

Idempotent SQL is **not** Prisma migration history.

## Verify

Tables `CareGarden`, `CareGardenPlant`, `CareGardenNurtureEvent`, `CareGardenEvent`, and `CareGardenMutation` exist. No historical plants. Existing World / Companion / Adventure / Explore / Movement rows unchanged.
