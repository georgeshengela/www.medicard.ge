# Medi World Phase 42 — schema apply

Additive only. Do **not** use `prisma db push`. Do **not** run this against production from this working tree.

Do not rewrite historical Cycle migrations. The repository still cannot `prisma migrate deploy` from an empty database (`CycleLog` missing). That is separate release-infrastructure debt.

## One recommended path

Pick **exactly one**.

### A. Accepted Phase 41 disposable baseline (this phase’s verification path)

Start from a database that already has Phase 41 schema (Adventure tables present). Then:

```bash
cd server
npx prisma db execute --file prisma/phase42-medi-world-explore.sql --schema prisma/schema.prisma
npx prisma generate
```

On a migrate-tracked copy of that baseline (after Prisma baseline through `20260912220000_medi_world_adventure`):

```bash
npx prisma migrate deploy
```

The Phase 42 folder is `prisma/migrations/20260912230000_medi_world_explore/`. It sorts **after** Phase 41.

### B. Historical `db execute` databases (no `_prisma_migrations`)

Same canonical file as A. Never also `migrate deploy` the same change on that database.

Idempotent SQL is **not** Prisma migration history.

## Verify

Tables `WorldPlace`, `CareSparkDefinition`, `CareSparkSpawn`, `CareSparkCollection` exist. No user coordinate columns on collection. No historical Spark backfill. Existing World / Companion / Adventure rows unchanged.
