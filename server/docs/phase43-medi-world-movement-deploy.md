# Medi World Phase 43 — schema apply

Additive only. Do **not** use `prisma db push`. Do **not** run this against production from this working tree.

Do not rewrite historical Cycle migrations. The repository still cannot `prisma migrate deploy` from an empty database (`CycleLog` missing). That is separate release-infrastructure debt.

## One recommended path

Pick **exactly one**.

### A. Accepted Phase 42 disposable baseline (this phase’s verification path)

Start from a database that already has Phase 42 schema (Explore tables present). Then:

```bash
cd server
npx prisma db execute --file prisma/phase43-medi-world-movement.sql --schema prisma/schema.prisma
npx prisma generate
```

On a migrate-tracked copy of that baseline (after Prisma baseline through `20260912230000_medi_world_explore`):

```bash
npx prisma migrate deploy
```

The Phase 43 folder is `prisma/migrations/20260913010000_medi_world_movement/`. It sorts **after** Phase 42.

### B. Historical `db execute` databases (no `_prisma_migrations`)

Same canonical file as A. Never also `migrate deploy` the same change on that database.

Idempotent SQL is **not** Prisma migration history.

## Verify

Tables `WorldMovementPreference` and `WorldMovementSession` exist. No user coordinate, route, or token columns. Existing World / Companion / Adventure / Explore rows unchanged.
