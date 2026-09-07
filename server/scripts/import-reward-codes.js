/**
 * Internal script: import partner coupon codes into a CODE_POOL reward.
 * Never prints full codes. Not a public endpoint.
 *
 * Usage:
 *   node scripts/import-reward-codes.js PARTNER_TEST_10 codes.txt
 *
 * codes.txt: one code per line.
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma.js';
import { importRewardCodes } from '../src/lib/rewards.js';

const rewardKey = process.argv[2];
const filePath = process.argv[3];

if (!rewardKey || !filePath) {
  console.error('Usage: node scripts/import-reward-codes.js <rewardKey> <codes.txt>');
  process.exit(1);
}

const raw = readFileSync(filePath, 'utf8');
const codes = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const result = await importRewardCodes(rewardKey, codes);
console.log(
  JSON.stringify({
    rewardKey,
    accepted: result.accepted,
    rejected: result.rejected,
    total: result.total,
  }),
);
await prisma.$disconnect();
