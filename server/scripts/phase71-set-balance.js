/**
 * Set exact Medi Coin balance for phone QA (ledger adjust + cache).
 * Usage: node scripts/phase71-set-balance.js +995500000005 50
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { getRewardBalance } from '../src/lib/quest.js';

const phone = process.argv[2] || '+995500000005';
const target = Math.floor(Number(process.argv[3]));
if (!Number.isFinite(target) || target < 0) {
  console.error('BAD_TARGET');
  process.exit(1);
}
const user = await prisma.user.findFirst({ where: { phone } });
if (!user) {
  console.error('USER_NOT_FOUND');
  process.exit(1);
}
const bal = await getRewardBalance(user.id);
const delta = target - bal.coins;
if (delta !== 0) {
  await prisma.rewardLedger.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      currency: 'COIN',
      amount: delta,
      transactionType: delta > 0 ? 'EARN' : 'REDEEM',
      sourceType: 'SYSTEM',
      sourceId: `phase71-set-balance-${Date.now()}`,
    },
  });
}
const next = await getRewardBalance(user.id);
await prisma.userQuestProfile.update({
  where: { userId: user.id },
  data: { cachedCoinBalance: next.coins },
});
console.log(JSON.stringify({ phone, previous: bal.coins, balance: next.coins, delta }));
await prisma.$disconnect();
