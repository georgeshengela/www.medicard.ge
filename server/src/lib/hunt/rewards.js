import { getRewardBalance } from '../quest.js';
import { getLevelForXp } from '../questLevels.js';
import { HUNT_LEDGER_SOURCE, httpError } from './config.js';
import { huntDayKey, clampAward } from './missions.js';

function dayFromRow(row, timezone) {
  if (row?.metadata?.dayKey) return row.metadata.dayKey;
  return huntDayKey(row.createdAt || new Date(), timezone);
}

export async function huntLedgerTotals(db, userId, { dayKey, sessionId, timezone, now } = {}) {
  const rows = await db.rewardLedger.findMany({ where: { userId, sourceType: HUNT_LEDGER_SOURCE } });
  const day = dayKey || huntDayKey(now || new Date(), timezone);
  let daily = 0;
  let session = 0;
  for (const row of rows) {
    if (row.currency !== 'COIN' || row.amount <= 0) continue;
    if (dayFromRow(row, timezone) === day) daily += row.amount;
    if (sessionId && (row.metadata?.sessionId === sessionId || String(row.sourceId || '').includes(sessionId))) {
      session += row.amount;
    }
  }
  return { daily, session, day };
}

export async function creditHuntCoins(tx, opts) {
  const {
    userId,
    amount,
    sourceId,
    now,
    simulation,
    rewardsEnabled,
    liveRewardsEnabled,
    config,
    timezone,
    sessionId,
    metadata = {},
  } = opts;
  if (simulation) return { created: false, amount: 0, reason: 'SIMULATION' };
  if (!rewardsEnabled || !liveRewardsEnabled) return { created: false, amount: 0, reason: 'REWARDS_OFF' };
  const want = Math.max(0, Math.floor(Number(amount) || 0));
  if (!want) return { created: false, amount: 0, reason: 'ZERO' };

  const existing = await tx.rewardLedger.findUnique({
    where: {
      userId_currency_sourceType_sourceId: {
        userId,
        currency: 'COIN',
        sourceType: HUNT_LEDGER_SOURCE,
        sourceId,
      },
    },
  });
  if (existing) return { created: false, amount: 0, reason: 'EXISTS' };

  const totals = await huntLedgerTotals(tx, userId, { dayKey: huntDayKey(now, timezone), sessionId, timezone, now });
  const award = clampAward(want, { daily: totals.daily, session: totals.session, config });
  if (!award) return { created: false, amount: 0, reason: 'CAP', totals };

  await tx.rewardLedger.create({
    data: {
      userId,
      currency: 'COIN',
      amount: award,
      transactionType: 'EARN',
      sourceType: HUNT_LEDGER_SOURCE,
      sourceId,
      createdAt: now,
      metadata: { ...metadata, dayKey: totals.day, sessionId },
    },
  });

  const after = await getRewardBalance(userId, { db: tx });
  const level = getLevelForXp(after.xp);
  if (typeof tx.userQuestProfile?.upsert === 'function') {
    await tx.userQuestProfile
      .upsert({
        where: { userId },
        update: { totalXp: after.xp, cachedCoinBalance: after.coins, currentLevel: level.level },
        create: { userId, totalXp: after.xp, cachedCoinBalance: after.coins, currentLevel: level.level },
      })
      .catch(() => null);
  }
  return { created: true, amount: award, coinBalance: after.coins, totals: { daily: totals.daily + award, session: totals.session + award } };
}

export function assertNotSimulationPayout(session) {
  if (session?.simulation) {
    throw httpError('სიმულაცია ჯილდოს არ იძლევა.', 403, 'HUNT_SIMULATION');
  }
}
