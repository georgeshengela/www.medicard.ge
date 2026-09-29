/**
 * XP / coin totals. Summed in the database (one grouped row per currency) instead of loading the
 * whole ledger, which grows with every quest for the life of the account. Test doubles without
 * groupBy fall back to summing rows.
 */
export async function sumRewardLedger(db, userId) {
  if (typeof db.rewardLedger.groupBy === 'function') {
    const groups = await db.rewardLedger.groupBy({
      by: ['currency'],
      where: { userId },
      _sum: { amount: true },
    });
    const earned = await db.rewardLedger.aggregate({
      where: { userId, currency: 'COIN', amount: { gt: 0 } },
      _sum: { amount: true },
    });
    const total = (currency) => Number(groups.find((g) => g.currency === currency)?._sum?.amount ?? 0);
    return { xp: total('XP'), coins: total('COIN'), coinsEarned: Number(earned?._sum?.amount ?? 0) };
  }
  const rows = await db.rewardLedger.findMany({ where: { userId } });
  let xp = 0;
  let coins = 0;
  let coinsEarned = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (row.currency === 'XP') xp += amount;
    if (row.currency === 'COIN') coins += amount;
    if (row.currency === 'COIN' && amount > 0) coinsEarned += amount;
  }
  return { xp, coins, coinsEarned };
}
