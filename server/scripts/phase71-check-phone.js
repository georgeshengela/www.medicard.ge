import { prisma } from '../src/lib/prisma.js';

const u = await prisma.user.findFirst({ where: { phone: '+995500000005' } });
const red = await prisma.rewardRedemption.findMany({
  where: { userId: u.id },
  include: { reward: true },
  orderBy: { redeemedAt: 'desc' },
  take: 5,
});
const led = await prisma.rewardLedger.findMany({
  where: { userId: u.id, currency: 'COIN' },
  orderBy: { createdAt: 'desc' },
  take: 8,
});
const ent = await prisma.userRewardEntitlement.findMany({
  where: { userId: u.id },
  orderBy: { createdAt: 'desc' },
  take: 5,
});
const balance = led.reduce((s, r) => s + r.amount, 0);
console.log(
  JSON.stringify(
    {
      balance,
      redemptions: red.map((r) => ({ key: r.reward.key, cost: r.coinCost, status: r.status })),
      ledger: led.map((r) => ({ a: r.amount, s: r.sourceType })),
      ents: ent.map((e) => ({ k: e.entitlementKey, end: e.endsAt, status: e.status })),
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
