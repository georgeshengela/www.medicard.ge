/**
 * AiInteraction prompt/reply retention. Dry-run unless --execute is passed.
 * Does not run on API boot. Do not point this at production unless the owner
 * has approved the proposed 90/365-day policy.
 *
 *   node scripts/ai-interaction-retention.js
 *   node scripts/ai-interaction-retention.js --execute --limit 200
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { runAiInteractionRetention } from '../src/lib/aiInteractionRetention.js';

const execute = process.argv.includes('--execute');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 500;

const result = await runAiInteractionRetention(prisma, { dryRun: !execute, limit });
console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun: result.dryRun,
      policy: result.policy,
      wouldRedact: result.wouldRedact,
      wouldDelete: result.wouldDelete,
      redacted: result.redacted,
      deleted: result.deleted,
      executed: execute,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
