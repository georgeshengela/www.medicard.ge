/**
 * Redeem PROFILE style for phone QA user (server path).
 * Usage: node scripts/phase71-redeem-profile.js +995500000005
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { redeemReward, ensureRewardDefinitions } from '../src/lib/rewards.js';

const phone = process.argv[2] || '+995500000005';
const user = await prisma.user.findFirst({ where: { phone } });
if (!user) {
  console.error('USER_NOT_FOUND');
  process.exit(1);
}
await ensureRewardDefinitions(prisma);
const reward = await prisma.rewardDefinition.findUnique({ where: { key: 'MEDI_PROFILE_STYLE_30D' } });
if (!reward) {
  console.error('REWARD_MISSING');
  process.exit(1);
}
try {
  const result = await redeemReward(user.id, reward.id, {
    idempotencyKey: `phase71-profile-${Date.now()}-${randomUUID().slice(0, 8)}`,
  });
  console.log(
    JSON.stringify({
      ok: true,
      spent: result.wallet?.spent,
      balance: result.wallet?.currentBalance,
      entitlement: result.entitlement,
      redemptionId: result.redemption?.id,
    }),
  );
} catch (err) {
  console.error(JSON.stringify({ ok: false, code: err.code || err.statusCode, message: err.message }));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
