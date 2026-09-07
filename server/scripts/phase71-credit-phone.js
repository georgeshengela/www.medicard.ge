/**
 * Credit Medi Coins for a phone QA user (Phase 7.1 Pixel redemption).
 * Usage: node scripts/phase71-credit-phone.js +995500000005 1500
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { getRewardBalance } from '../src/lib/quest.js';
import { ensureRewardDefinitions } from '../src/lib/rewards.js';

const phone = process.argv[2] || '+995500000005';
const amount = Math.floor(Number(process.argv[3]) || 1500);

const user = await prisma.user.findFirst({ where: { phone } });
if (!user) {
  console.error('USER_NOT_FOUND', phone);
  process.exit(1);
}
await ensureRewardDefinitions(prisma);
await prisma.userQuestProfile.upsert({
  where: { userId: user.id },
  create: {
    userId: user.id,
    currentLevel: 1,
    totalXp: 0,
    cachedCoinBalance: 0,
    currentStreak: 0,
    longestStreak: 0,
    timezone: 'Asia/Tbilisi',
  },
  update: {},
});
await prisma.rewardLedger.create({
  data: {
    id: randomUUID(),
    userId: user.id,
    currency: 'COIN',
    amount,
    transactionType: 'EARN',
    sourceType: 'SYSTEM',
    sourceId: `phase71-credit-${Date.now()}`,
  },
});
const bal = await getRewardBalance(user.id);
await prisma.userQuestProfile.update({
  where: { userId: user.id },
  data: { cachedCoinBalance: bal.coins },
});
console.log(JSON.stringify({ userId: user.id, phone, credited: amount, balance: bal.coins }));
await prisma.$disconnect();
