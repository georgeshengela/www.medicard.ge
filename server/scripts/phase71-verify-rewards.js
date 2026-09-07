/**
 * Phase 7.1 — verify Neon reward tables + seed catalog.
 */
import { prisma } from '../src/lib/prisma.js';
import { ensureRewardDefinitions } from '../src/lib/rewards.js';

const TABLES = [
  'RewardPartner',
  'RewardDefinition',
  'RewardRedemption',
  'RewardCode',
  'RewardInventoryAdjustment',
  'UserRewardEntitlement',
  'RewardRedemptionAudit',
];

for (const name of TABLES) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS ok`,
    name,
  );
  console.log(`${name}:${rows[0]?.ok ? 'OK' : 'MISSING'}`);
}

const seeded = await ensureRewardDefinitions(prisma);
console.log(`seeded:${seeded.length}`);

const defs = await prisma.rewardDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
for (const d of defs) {
  console.log(
    JSON.stringify({
      key: d.key,
      type: d.type,
      status: d.status,
      coinCost: d.coinCost,
      inventoryMode: d.inventoryMode,
      perUserLimit: d.perUserLimit,
      periodLimitType: d.periodLimitType,
      periodLimitCount: d.periodLimitCount,
      periodWindowDays: d.periodWindowDays,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      entitlementKey: d.entitlementKey,
      entitlementDurationDays: d.entitlementDurationDays,
      fulfillment:
        d.entitlementKey
          ? `UserRewardEntitlement:${d.entitlementKey}:${d.entitlementDurationDays}d`
          : d.inventoryMode === 'CODE_POOL'
            ? 'RewardCode pool'
            : 'none',
    }),
  );
}

await prisma.$disconnect();
