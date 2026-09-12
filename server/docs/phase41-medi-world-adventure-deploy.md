# Medi World Phase 41 — schema apply

Additive only. Do **not** use `prisma db push`. Do **not** run this against production from this working tree.

## One recommended path

Pick **exactly one** based on whether the target database already has Prisma migration history.

### A. Migrate-tracked databases (recommended once `_prisma_migrations` exists)

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

The Phase 41 folder is `prisma/migrations/20260912220000_medi_world_adventure/`. It sorts **after** Phase 40 `20260912200000_medi_world_companion`.

### B. Historical `db execute` databases (no `_prisma_migrations`)

This repository’s live/production lineage historically applied additive SQL with `prisma db execute` (same as Phases 8/9/38–40). Those databases may still lack `_prisma_migrations`.

```bash
cd server
npx prisma db execute --file prisma/phase41-medi-world-adventure.sql --schema prisma/schema.prisma
npx prisma generate
```

Repeated `db execute` of the canonical file is idempotent (`IF NOT EXISTS`). That is **not** the same as Prisma migration history.

## Do not run both

Never apply the canonical SQL **and** `prisma migrate deploy` for the same Phase 41 change on the same database. The SQL bodies are kept in lockstep; the history table is not.

## Empty-database `prisma migrate deploy`

A brand-new empty PostgreSQL database **cannot** apply this repository’s migration chain from zero. The first folder `20260830120000_cycle_fertility_tests` is `ALTER TABLE "CycleLog"`; `CycleLog` was created by historical `db push`, not by a Prisma init migration. That failure predates Medi World. Do not rewrite that production history from this phase.

## Existing databases without `_prisma_migrations` (this repository’s live lineage)

Prisma `migrate deploy` returns **P3005** (“schema is not empty”) until the database is baselined. That is Prisma’s documented baseline process, not a Medicard script:

```bash
# Only on a disposable copy. Mark every already-present additive folder, then deploy the next one.
npx prisma migrate resolve --applied 20260912200000_medi_world_companion
npx prisma migrate deploy
```

Do **not** also `db execute` Phase 41 on a database that already received `20260912220000_medi_world_adventure` via `migrate deploy`.

Idempotent canonical SQL is **not** equivalent to Prisma migration history. The SQL bodies are kept in lockstep (comment lines excluded); `_prisma_migrations` is written only by migrate resolve/deploy.

## Verify

Tables `MediWorldAdventurePreference`, `MediWorldDailyAdventure`, `MediWorldAdventureSlot`, `MediWorldAdventureSwap` exist. Unique `(userId, periodKey)` on daily Adventure. No historical Adventure backfill.

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.
