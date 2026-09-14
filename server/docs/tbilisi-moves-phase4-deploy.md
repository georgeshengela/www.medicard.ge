# Phase 4 — თბილისი მოძრაობს daily results + cosmetic awards

Additive only. **Do not** use `prisma db push`. Do not run this against hosted Neon unless an operator explicitly asks.

This revision’s Prisma models include Phase 4 columns (`leaderRecognitionEnabled`, `resultRevision`, result/award tables). Apply **phase2 then phase4** before this server build talks to a database.

## Apply (local / operator)

```bash
cd server
npx prisma db execute --file prisma/tbilisi-moves-phase2.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/tbilisi-moves-phase4.sql --schema prisma/schema.prisma
npx prisma generate
```

On an existing Phase 2 schema, run **only** `tbilisi-moves-phase4.sql` (it uses `ADD COLUMN IF NOT EXISTS`).

On Windows, stop the API process first if `query_engine-windows.dll.node` is locked.

Render `release` (`prisma generate` + seed) **does not** apply these files.

## Runner (implemented, not scheduled)

```bash
cd server
node scripts/tbilisi-moves-finalize.js --dry-run
node scripts/tbilisi-moves-finalize.js --limit 8
node scripts/tbilisi-moves-finalize.js --date YYYY-MM-DD
```

Proposed operator scan, **not registered**: `*/15 * * * *` (every 15 minutes). The runner selects existing `PROVISIONAL` rounds whose **own** `graceEndsAt <= now`. It does not invent missing dates. A single daily `15 4 * * *` UTC job only matches the default 8h grace; admin can set `lateSyncGraceHours` from 1–24.

Automatic daily finalization is **not live** until an operator configures that scheduler. Do not add an in-process timer on API instances.

## Rollback (destructive; operator only)

Drop Phase 4 objects first. This deletes published results and cosmetic entitlements. It does **not** touch `HealthMetricDaily` / `StepLog` or Phase 2 credits.

```sql
DROP TABLE IF EXISTS "TbilisiMovesAward";
DROP TABLE IF EXISTS "TbilisiMovesResultRevision";
ALTER TABLE "TbilisiMovesRound" DROP COLUMN IF EXISTS "latestResultId";
ALTER TABLE "TbilisiMovesRound" DROP COLUMN IF EXISTS "resultRevision";
ALTER TABLE "TbilisiMovesConfig" DROP COLUMN IF EXISTS "districtGoalBadgeEnabled";
ALTER TABLE "TbilisiMovesConfig" DROP COLUMN IF EXISTS "leaderRewardedRanks";
ALTER TABLE "TbilisiMovesConfig" DROP COLUMN IF EXISTS "leaderRecognitionEnabled";
```

Then restore the Phase 2 config CHECK from `tbilisi-moves-phase2.sql` if you still need it.

## Runtime

- User: `GET /api/tbilisi-moves/history`, `/results/:date`, `/awards`
- Admin: `#/tbilisi-moves?tab=rounds|review|rewards` plus finalize/correct/exclude
- Missing Phase 4 tables: `GET /status` stays **200** (`resultsReady: false`). History/finalize/awards **503**.
