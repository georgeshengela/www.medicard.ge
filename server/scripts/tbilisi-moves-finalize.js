/**
 * თბილისი მოძრაობს — bounded finalization runner.
 *
 * Implemented, not scheduled. Do not add a Render cron or in-process timer.
 *
 *   cd server
 *   node scripts/tbilisi-moves-finalize.js --dry-run
 *   node scripts/tbilisi-moves-finalize.js --limit 8
 *   node scripts/tbilisi-moves-finalize.js --date 2026-09-13
 *
 * Catch-up selects existing PROVISIONAL rounds whose own graceEndsAt <= now.
 * It does not invent missing historical dates.
 *
 * Proposed operator scan, **not registered**:
 *   every 15 minutes (cron example: `*/15 * * * *`)
 *   because admin can change lateSyncGraceHours (1–24). A single 04:15 UTC
 *   job only matches the default 8h grace.
 *
 * Automatic daily finalization is NOT live until that scheduler is configured.
 */

import 'dotenv/config';
import { finalizeDueRounds } from '../src/lib/tbilisiMoves/finalize.js';
import { prisma } from '../src/lib/prisma.js';

function arg(name, fallback = null) {
  const prefix = `--${name}`;
  const hit = process.argv.find((value) => value === prefix || value.startsWith(`${prefix}=`));
  if (!hit) return fallback;
  if (hit === prefix) return true;
  return hit.slice(prefix.length + 1);
}

const dryRun = Boolean(arg('dry-run', false));
const limit = Number(arg('limit', 8)) || 8;
const date = typeof arg('date') === 'string' ? arg('date') : null;

const result = await finalizeDueRounds({ dryRun, limit, date });
console.log(
  JSON.stringify(
    {
      ok: result.failed.length === 0,
      scanned: result.scanned,
      processed: result.processed.length,
      failed: result.failed.length,
      dryRun: result.dryRun,
      automaticExecutionConfigured: false,
      items: result.processed,
      errors: result.failed,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
process.exit(result.failed.length ? 1 : 0);
