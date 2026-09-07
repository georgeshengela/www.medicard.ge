/**
 * Phase 7.1 — live API redemption QA against Neon via local/server process.
 * Credits coins through RewardLedger (server-side DEV script), then redeems.
 *
 * Usage: node scripts/phase71-e2e-rewards.js
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import {
  ensureRewardDefinitions,
  getActiveRewardEntitlements,
  listStoreRewards,
  redeemReward,
} from '../src/lib/rewards.js';
import { getQuestRewards, getRewardBalance } from '../src/lib/quest.js';
import { computeAchievementCounters } from '../src/lib/achievements.js';
import { LEDGER_SOURCE_REWARD_REDEMPTION } from '../src/lib/rewardDefs.js';

const EMAIL = process.env.PHASE71_USER_EMAIL || 'rewards-qa@medicard.local';

async function ensureQaUser() {
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: EMAIL,
        passwordHash: 'phase71-no-login',
        fullName: 'Rewards QA',
        status: 'ACTIVE',
      },
    });
  }
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
  return user;
}

async function wipeRewardSpends(userId) {
  const redemptions = await prisma.rewardRedemption.findMany({ where: { userId } });
  for (const row of redemptions) {
    await prisma.userRewardEntitlement.deleteMany({ where: { rewardRedemptionId: row.id } });
    await prisma.rewardRedemptionAudit.deleteMany({ where: { redemptionId: row.id } });
  }
  await prisma.rewardRedemption.deleteMany({ where: { userId } });
  await prisma.rewardLedger.deleteMany({
    where: { userId, sourceType: LEDGER_SOURCE_REWARD_REDEMPTION },
  });
  // Keep positive earnings for balance math; reset by deleting ALL coin rows then reseed.
  await prisma.rewardLedger.deleteMany({ where: { userId, currency: 'COIN' } });
  await prisma.userQuestProfile.update({
    where: { userId },
    data: { cachedCoinBalance: 0 },
  });
}

async function credit(userId, amount, sourceId) {
  await prisma.rewardLedger.create({
    data: {
      id: randomUUID(),
      userId,
      currency: 'COIN',
      amount,
      transactionType: 'EARN',
      sourceType: 'QUEST',
      sourceId,
    },
  });
  const bal = await getRewardBalance(userId);
  await prisma.userQuestProfile.update({
    where: { userId },
    data: { cachedCoinBalance: bal.coins },
  });
}

const results = {};

try {
  await ensureRewardDefinitions(prisma);
  const user = await ensureQaUser();
  console.log('user', user.id, user.email);

  const catalog = await listStoreRewards(user.id);
  results.catalogKeys = catalog.available.map((r) => r.key);
  results.partnerHidden = !catalog.available.some((r) => r.key === 'PARTNER_TEST_10');
  results.premiumHidden = !catalog.available.some((r) => r.key.startsWith('MEDI_PREMIUM'));

  await wipeRewardSpends(user.id);
  await credit(user.id, 30, `phase71-q-${randomUUID()}`);
  await prisma.rewardLedger.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      currency: 'COIN',
      amount: 50,
      transactionType: 'EARN',
      sourceType: 'ACHIEVEMENT',
      sourceId: `phase71-a-${randomUUID()}`,
    },
  });
  // Need enough for 300 theme: add 320 more → total earned 400, then spend 300 → balance 100
  // Spec §23 wants +30+50−60=20 with lifetime 80 — use cheap path with temporary cost validation.
  // For honesty E2E we redeem MEDI_THEME_7D (300). Seed balance 1000.
  await credit(user.id, 920, `phase71-pad-${randomUUID()}`); // 30+50+920=1000

  const before = await getRewardBalance(user.id);
  results.beforeBalance = before.coins;

  const theme = await prisma.rewardDefinition.findUnique({ where: { key: 'MEDI_THEME_7D' } });
  const idem = `phase71-live-${Date.now()}`;
  const redeemed = await redeemReward(user.id, theme.id, { idempotencyKey: idem });
  results.redeem = {
    status: redeemed.redemption.status,
    spent: redeemed.wallet.spent,
    previous: redeemed.wallet.previousBalance,
    current: redeemed.wallet.currentBalance,
    entitlementKey: redeemed.entitlement?.entitlementKey,
    startsAt: redeemed.entitlement?.startsAt,
    endsAt: redeemed.entitlement?.endsAt,
  };

  const after = await getRewardBalance(user.id);
  results.afterBalance = after.coins;
  results.ledgerDebit = await prisma.rewardLedger.findFirst({
    where: { userId: user.id, sourceType: LEDGER_SOURCE_REWARD_REDEMPTION },
  });

  const replay = await redeemReward(user.id, theme.id, { idempotencyKey: idem });
  results.idempotentReplay = replay.idempotentReplay === true;
  results.sameRedemptionId = replay.redemption.id === redeemed.redemption.id;
  const debitCount = await prisma.rewardLedger.count({
    where: { userId: user.id, sourceType: LEDGER_SOURCE_REWARD_REDEMPTION },
  });
  results.debitCount = debitCount;

  // Insufficient: try profile style (600) with remaining ~700? after theme 700 left — credit down
  // Force insufficient by wiping and giving 100
  await wipeRewardSpends(user.id);
  await credit(user.id, 100, `phase71-low-${randomUUID()}`);
  let insuffCode = null;
  try {
    await redeemReward(user.id, theme.id, { idempotencyKey: `phase71-insuff-${Date.now()}` });
  } catch (error) {
    insuffCode = error.code;
  }
  results.insufficientCode = insuffCode;
  results.insufficientNoDebit =
    (await prisma.rewardLedger.count({
      where: { userId: user.id, sourceType: LEDGER_SOURCE_REWARD_REDEMPTION },
    })) === 0;

  // Lifetime earned regression: +30 +50 -100(spend via theme needs 300 — use direct ledger -60)
  await wipeRewardSpends(user.id);
  await credit(user.id, 30, `life-q-${randomUUID()}`);
  await prisma.rewardLedger.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      currency: 'COIN',
      amount: 50,
      transactionType: 'EARN',
      sourceType: 'ACHIEVEMENT',
      sourceId: `life-a-${randomUUID()}`,
    },
  });
  await prisma.rewardLedger.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      currency: 'COIN',
      amount: -60,
      transactionType: 'REDEEM',
      sourceType: LEDGER_SOURCE_REWARD_REDEMPTION,
      sourceId: randomUUID(),
    },
  });
  const wallet = await getQuestRewards(user.id);
  const counters = await computeAchievementCounters(user.id);
  results.lifetime = {
    balance: wallet.balance.coins,
    earned: wallet.totalEarned.coins,
    spent: wallet.totalSpent.coins,
    coinsEarnedCounter: counters.coinsEarned,
  };

  // Entitlement duration check after real redeem
  await wipeRewardSpends(user.id);
  await credit(user.id, 1000, `ent-${randomUUID()}`);
  const r2 = await redeemReward(user.id, theme.id, { idempotencyKey: `phase71-ent-${Date.now()}` });
  const start = new Date(r2.entitlement.startsAt).getTime();
  const end = new Date(r2.entitlement.endsAt).getTime();
  results.entitlementDays = Math.round((end - start) / 86_400_000);
  const active = await getActiveRewardEntitlements(user.id);
  results.activeEntitlements = active.map((e) => e.entitlementKey);
  const expiredView = await getActiveRewardEntitlements(user.id, {
    now: new Date(end + 1000),
  });
  results.activeAfterExpiry = expiredView.length;

  // Period limit: second theme redeem should fail
  let periodCode = null;
  try {
    await redeemReward(user.id, theme.id, { idempotencyKey: `phase71-period-${Date.now()}` });
  } catch (error) {
    periodCode = error.code;
  }
  results.periodLimitCode = periodCode;

  // Profile style max-1 active
  const style = await prisma.rewardDefinition.findUnique({ where: { key: 'MEDI_PROFILE_STYLE_30D' } });
  await credit(user.id, 2000, `style-pad-${randomUUID()}`);
  const s1 = await redeemReward(user.id, style.id, { idempotencyKey: `phase71-style-${Date.now()}` });
  let styleLimit = null;
  try {
    await redeemReward(user.id, style.id, { idempotencyKey: `phase71-style2-${Date.now()}` });
  } catch (error) {
    styleLimit = error.code;
  }
  results.profileStyleFirst = s1.redemption.status;
  results.profileStyleSecondCode = styleLimit;

  // Price snapshot
  const snap = await prisma.rewardRedemption.findUnique({ where: { id: r2.redemption.id } });
  await prisma.rewardDefinition.update({ where: { id: theme.id }, data: { coinCost: 500 } });
  results.priceSnapshot = snap.coinCost;
  await prisma.rewardDefinition.update({ where: { id: theme.id }, data: { coinCost: 300 } });

  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  console.error('E2E_FAILED', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
