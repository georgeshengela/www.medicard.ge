# Phase 2 — თბილისი მოძრაობს foundation (schema)

Additive only. **Do not** use `prisma db push`. Do not run this against hosted Neon unless an operator explicitly asks.

Phase 4 additive SQL (`prisma/tbilisi-moves-phase4.sql`) must run **after** this file. See `server/docs/tbilisi-moves-phase4-deploy.md`. Isolated verification: `docs/TBILISI_MOVES_PILOT_VALIDATION.md` (`node scripts/tbilisi-moves-isolated-pg.mjs`). Never apply `tbilisi-moves-test-base.sql` to hosted Neon.

## Apply (local / operator)

```bash
cd server
npx prisma db execute --file prisma/tbilisi-moves-phase2.sql --schema prisma/schema.prisma
npx prisma generate
```

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.

Render `release` (`prisma generate` + seed) **does not** apply this file. Apply SQL, then deploy code that reads the tables with `schemaReady` guards.

## Seed behaviour

- Config singleton `id=default` and the ten raioni use `ON CONFLICT DO NOTHING`.
- Re-running the file does **not** overwrite operator-edited targets, overrides, flags, or revision.

## Rollback (destructive; operator only)

Drop in this order if you must unwind an unused environment. This deletes competition data. It does **not** touch `HealthMetricDaily` / `StepLog`.

```sql
DROP TABLE IF EXISTS "TbilisiMovesObservation";
DROP TABLE IF EXISTS "TbilisiMovesCredit";
DROP TABLE IF EXISTS "TbilisiMovesDistrictDay";
DROP TABLE IF EXISTS "TbilisiMovesIngestHold";
DROP TABLE IF EXISTS "TbilisiMovesMembershipPeriod";
DROP TABLE IF EXISTS "TbilisiMovesMembership";
DROP TABLE IF EXISTS "TbilisiMovesRound";
DROP TABLE IF EXISTS "TbilisiMovesDistrict";
DROP TABLE IF EXISTS "TbilisiMovesConfig";
```

## Runtime

- User: `/api/tbilisi-moves/*` (feature default **off**)
- Admin: `/api/admin/tbilisi-moves/*` + `#/tbilisi-moves`
- Missing tables: `GET /api/tbilisi-moves/status` returns **200** `{ schemaReady: false }`. Other routes **503**.
