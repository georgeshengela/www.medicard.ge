/** Admin Medi Coins adjustment (grant/revoke) — shared by the admin console and the Director. */
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { getLevelForXp } from './questLevels.js';

const httpError = (message, status = 400, code) => Object.assign(new Error(message), { status, code });

export async function ledgerBalance(db, userId) {
  const rows = await db.rewardLedger.groupBy({ by: ['currency'], where: { userId }, _sum: { amount: true } });
  const sum = (c) => rows.find((r) => r.currency === c)?._sum.amount ?? 0;
  return { coins: sum('COIN'), xp: sum('XP') };
}

/** Writes one ADJUST ledger row and refreshes the cached profile. Never lets the balance go below 0. */
export async function adjustCoins({ userId, amount, reason, adminEmail }, { db = prisma } = {}) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 5000) throw httpError('თანხა უნდა იყოს ±1…5000.');
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw httpError('მომხმარებელი ვერ მოიძებნა.', 404);
    const before = await ledgerBalance(tx, userId);
    if (before.coins + amount < 0) throw httpError(`ბალანსი ${before.coins} coin-ია — ამდენის ჩამოჭრა შეუძლებელია.`, 409, 'COINS_NEGATIVE');
    await tx.rewardLedger.create({
      data: {
        userId, currency: 'COIN', amount, transactionType: 'ADJUST', sourceType: 'SYSTEM',
        sourceId: `admin:${randomUUID()}`, metadata: { reason, adminEmail: adminEmail || null },
      },
    });
    const after = await ledgerBalance(tx, userId);
    const level = getLevelForXp(after.xp).level;
    await tx.userQuestProfile.upsert({
      where: { userId },
      update: { cachedCoinBalance: after.coins, totalXp: after.xp, currentLevel: level },
      create: { userId, cachedCoinBalance: after.coins, totalXp: after.xp, currentLevel: level },
    });
    return { before: before.coins, after: after.coins };
  });
}
