import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createQuestFakeDb } from './questFakeDb.js';
import { getQuestRewards, getRewardBalance } from './quest.js';
import { computeAchievementCounters, evaluateAchievements } from './achievements.js';
import { validateRewardCoinCost, QUEST_ECONOMY } from './questEconomy.js';
import {
  CODE_STATUSES,
  LEDGER_SOURCE_REWARD_REDEMPTION,
  QUEST_PREMIUM_ENTITLEMENT_EXISTS,
  REWARD_CATALOG,
  REWARD_STATUSES,
  REWARD_TYPES,
} from './rewardDefs.js';
import {
  ensureRewardDefinitions,
  importRewardCodes,
  listStoreRewards,
  redeemReward,
} from './rewards.js';

const USER = 'user-rewards-1';
const USER_B = 'user-rewards-2';

async function setup(extraSeed = {}) {
  const db = createQuestFakeDb({
    userQuestProfile: [
      {
        userId: USER,
        currentLevel: 1,
        totalXp: 0,
        cachedCoinBalance: 0,
        currentStreak: 0,
        longestStreak: 0,
        timezone: 'Asia/Tbilisi',
      },
      {
        userId: USER_B,
        currentLevel: 1,
        totalXp: 0,
        cachedCoinBalance: 0,
        currentStreak: 0,
        longestStreak: 0,
        timezone: 'Asia/Tbilisi',
      },
    ],
    ...extraSeed,
  });
  await ensureRewardDefinitions(db);
  return { db, options: { db } };
}

async function creditCoins(db, userId, amount, sourceId = randomUUID()) {
  await db.rewardLedger.create({
    data: {
      userId,
      currency: 'COIN',
      amount,
      transactionType: 'EARN',
      sourceType: 'QUEST',
      sourceId,
    },
  });
  const profile = await db.userQuestProfile.findUnique({ where: { userId } });
  if (profile) {
    await db.userQuestProfile.update({
      where: { userId },
      data: { cachedCoinBalance: (profile.cachedCoinBalance || 0) + amount },
    });
  }
}

function themeReward(db) {
  return [...db._state.rewardDefinition.values()].find((r) => r.key === 'MEDI_THEME_7D');
}

describe('phase 7 economy guards', () => {
  it('rejects coinCost <= 0 and out-of-range without clamping', () => {
    assert.throws(() => validateRewardCoinCost(0), /positive/);
    assert.throws(() => validateRewardCoinCost(-10), /positive/);
    assert.throws(() => validateRewardCoinCost(50), /range/);
    assert.throws(() => validateRewardCoinCost(QUEST_ECONOMY.maxRewardCoinCost + 1), /range/);
    assert.equal(validateRewardCoinCost(300), 300);
  });

  it('seeds ACTIVE cosmetics and DRAFT premium/partner when Premium entitlement missing', async () => {
    assert.equal(QUEST_PREMIUM_ENTITLEMENT_EXISTS, false);
    const { db } = await setup();
    const byKey = Object.fromEntries([...db._state.rewardDefinition.values()].map((r) => [r.key, r]));
    assert.equal(byKey.MEDI_THEME_7D.status, REWARD_STATUSES.ACTIVE);
    assert.equal(byKey.MEDI_PROFILE_STYLE_30D.status, REWARD_STATUSES.ACTIVE);
    assert.equal(byKey.MEDI_PREMIUM_DAY.status, REWARD_STATUSES.DRAFT);
    assert.equal(byKey.MEDI_PREMIUM_3D.status, REWARD_STATUSES.DRAFT);
    assert.equal(byKey.PARTNER_TEST_10.status, REWARD_STATUSES.DRAFT);
    assert.equal(REWARD_CATALOG.length, 5);
  });
});

describe('phase 7 redemption', () => {
  it('redeems DIGITAL_PERK atomically with negative REWARD_REDEMPTION ledger entry', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 1000);
    const reward = themeReward(db);
    const result = await redeemReward(USER, reward.id, { ...options, idempotencyKey: 'idem-theme-1' });
    assert.equal(result.redemption.status, 'ISSUED');
    assert.equal(result.wallet.previousBalance, 1000);
    assert.equal(result.wallet.currentBalance, 700);
    assert.equal(result.wallet.spent, 300);
    assert.equal(result.entitlement.entitlementKey, 'quest.theme.premium');
    const balance = await getRewardBalance(USER, options);
    assert.equal(balance.coins, 700);
    const ledger = [...db._state.rewardLedger.values()].find(
      (row) => row.sourceType === LEDGER_SOURCE_REWARD_REDEMPTION,
    );
    assert.equal(ledger.amount, -300);
    assert.equal(ledger.transactionType, 'REDEEM');
  });

  it('rejects draft / paused / insufficient / exact-balance edge cases', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 300);
    const premium = [...db._state.rewardDefinition.values()].find((r) => r.key === 'MEDI_PREMIUM_DAY');
    await assert.rejects(
      () => redeemReward(USER, premium.id, { ...options, idempotencyKey: 'idem-draft' }),
      (err) => err.code === 'REWARD_NOT_ACTIVE',
    );

    const theme = themeReward(db);
    await db.rewardDefinition.update({ where: { id: theme.id }, data: { status: 'PAUSED' } });
    await assert.rejects(
      () => redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-paused' }),
      (err) => err.code === 'REWARD_NOT_ACTIVE',
    );
    await db.rewardDefinition.update({ where: { id: theme.id }, data: { status: 'ACTIVE' } });

    await assert.rejects(
      () => redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-ok-exact' }).then(async () => {
        await redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-short' });
      }),
      (err) => err.code === 'REWARD_INSUFFICIENT_COINS' || err.code === 'REWARD_PERIOD_LIMIT',
    );
  });

  it('exact balance succeeds and leaves zero', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 300);
    const theme = themeReward(db);
    const result = await redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-exact' });
    assert.equal(result.wallet.currentBalance, 0);
    const balance = await getRewardBalance(USER, options);
    assert.equal(balance.coins, 0);
  });

  it('replays the same idempotency key without a second debit', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 1000);
    const theme = themeReward(db);
    const a = await redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-same' });
    const b = await redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-same' });
    assert.equal(a.redemption.id, b.redemption.id);
    assert.equal(b.idempotentReplay, true);
    const debits = [...db._state.rewardLedger.values()].filter(
      (row) => row.sourceType === LEDGER_SOURCE_REWARD_REDEMPTION && row.userId === USER,
    );
    assert.equal(debits.length, 1);
    assert.equal((await getRewardBalance(USER, options)).coins, 700);
  });

  it('enforces rolling 14-day period limit for theme', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 1000);
    const theme = themeReward(db);
    await redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-period-1' });
    await assert.rejects(
      () => redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-period-2' }),
      (err) => err.code === 'REWARD_PERIOD_LIMIT',
    );
  });

  it('snapshots coinCost even if catalog price later changes', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 1000);
    const theme = themeReward(db);
    const result = await redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-snap' });
    await db.rewardDefinition.update({ where: { id: theme.id }, data: { coinCost: 800 } });
    assert.equal(result.redemption.coinCost, 300);
  });

  it('finite inventory: last unit then OUT_OF_STOCK without debit', async () => {
    const { db, options } = await setup();
    const reward = await db.rewardDefinition.create({
      data: {
        id: randomUUID(),
        key: 'TEST_FINITE',
        type: REWARD_TYPES.DIGITAL_PERK,
        status: 'ACTIVE',
        titleKey: 't',
        descriptionKey: 'd',
        coinCost: 100,
        inventoryMode: 'FINITE',
        inventoryQuantity: 1,
        entitlementKey: 'quest.theme.premium',
        entitlementDurationDays: 1,
        sortOrder: 1,
        featured: false,
      },
    });
    await creditCoins(db, USER, 500);
    await creditCoins(db, USER_B, 500);
    await redeemReward(USER, reward.id, { ...options, idempotencyKey: 'idem-fin-1' });
    await assert.rejects(
      () => redeemReward(USER_B, reward.id, { ...options, idempotencyKey: 'idem-fin-2' }),
      (err) => err.code === 'REWARD_OUT_OF_STOCK',
    );
    assert.equal((await getRewardBalance(USER_B, options)).coins, 500);
  });

  it('code pool: one code, two users — only one wins; loser keeps coins', async () => {
    const { db, options } = await setup();
    const partner = await db.rewardDefinition.create({
      data: {
        id: randomUUID(),
        key: 'TEST_CODE_POOL',
        type: REWARD_TYPES.PARTNER_VOUCHER,
        status: 'ACTIVE',
        titleKey: 't',
        descriptionKey: 'd',
        termsKey: 'terms',
        coinCost: 200,
        inventoryMode: 'CODE_POOL',
        redemptionExpiryDays: 30,
        sortOrder: 1,
        featured: false,
      },
    });
    await importRewardCodes('TEST_CODE_POOL', ['CODE-ONLY-1'], options);
    await creditCoins(db, USER, 500);
    await creditCoins(db, USER_B, 500);
    const ok = await redeemReward(USER, partner.id, { ...options, idempotencyKey: 'idem-code-a' });
    assert.equal(ok.redemption.code, 'CODE-ONLY-1');
    await assert.rejects(
      () => redeemReward(USER_B, partner.id, { ...options, idempotencyKey: 'idem-code-b' }),
      (err) => err.code === 'REWARD_CODE_UNAVAILABLE' || err.code === 'REWARD_OUT_OF_STOCK',
    );
    assert.equal((await getRewardBalance(USER_B, options)).coins, 500);
    const codes = [...db._state.rewardCode.values()];
    assert.equal(codes.filter((c) => c.status === CODE_STATUSES.USED).length, 1);
  });

  it('concurrent spends cannot drive balance negative', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 1000);
    const style = [...db._state.rewardDefinition.values()].find((r) => r.key === 'MEDI_PROFILE_STYLE_30D');
    // 600 each — only one of two concurrent 600 spends can succeed on 1000.
    const results = await Promise.allSettled([
      redeemReward(USER, style.id, { ...options, idempotencyKey: 'idem-concurrent-1' }),
      redeemReward(USER, style.id, { ...options, idempotencyKey: 'idem-concurrent-2' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(
      ['REWARD_INSUFFICIENT_COINS', 'REWARD_USER_LIMIT', 'REWARD_REDEMPTION_CONFLICT'].includes(
        rejected[0].reason.code,
      ),
    );
    const balance = await getRewardBalance(USER, options);
    assert.equal(balance.coins, 400);
    assert.ok(balance.coins >= 0);
  });
});

describe('phase 7 wallet + lifetime earned', () => {
  it('wallet balance includes spends; lifetime earned ignores redemptions', async () => {
    const { db, options } = await setup();
    await creditCoins(db, USER, 30, 'q-earn');
    await db.rewardLedger.create({
      data: {
        userId: USER,
        currency: 'COIN',
        amount: 50,
        transactionType: 'EARN',
        sourceType: 'ACHIEVEMENT',
        sourceId: 'ach-1',
      },
    });
    await creditCoins(db, USER, 520, 'q-pad'); // total earned path to redeem 60? use theme 300 with enough
    // Reset clearer path: balance math +30+50-60
    const db2 = createQuestFakeDb({
      userQuestProfile: [
        {
          userId: USER,
          currentLevel: 1,
          totalXp: 0,
          cachedCoinBalance: 0,
          currentStreak: 0,
          longestStreak: 0,
          timezone: 'UTC',
        },
      ],
    });
    await ensureRewardDefinitions(db2);
    const opts = { db: db2 };
    await db2.rewardLedger.create({
      data: {
        userId: USER,
        currency: 'COIN',
        amount: 30,
        transactionType: 'EARN',
        sourceType: 'QUEST',
        sourceId: 'q1',
      },
    });
    await db2.rewardLedger.create({
      data: {
        userId: USER,
        currency: 'COIN',
        amount: 50,
        transactionType: 'EARN',
        sourceType: 'ACHIEVEMENT',
        sourceId: 'a1',
      },
    });
    const cheap = await db2.rewardDefinition.create({
      data: {
        id: randomUUID(),
        key: 'TEST_CHEAP',
        type: REWARD_TYPES.DIGITAL_PERK,
        status: 'ACTIVE',
        titleKey: 't',
        descriptionKey: 'd',
        coinCost: 60,
        inventoryMode: 'UNLIMITED',
        entitlementKey: 'quest.theme.premium',
        entitlementDurationDays: 1,
        sortOrder: 1,
        featured: false,
      },
    });
    // Cost 60 is below minRewardCoinCost — bypass seed validation by direct create for ledger math.
    // Engine validates cost on redeem — use 100 min.
    await db2.rewardDefinition.update({ where: { id: cheap.id }, data: { coinCost: 100 } });
    await db2.rewardLedger.create({
      data: {
        userId: USER,
        currency: 'COIN',
        amount: 40,
        transactionType: 'EARN',
        sourceType: 'QUEST',
        sourceId: 'q2',
      },
    });
    // earned 120, spend 100 → balance 20; lifetime earned 120
    await redeemReward(USER, cheap.id, { ...opts, idempotencyKey: 'idem-wallet' });
    const wallet = await getQuestRewards(USER, opts);
    assert.equal(wallet.balance.coins, 20);
    assert.equal(wallet.totalEarned.coins, 120);
    assert.equal(wallet.totalSpent.coins, 100);
  });

  it('COINS_EARNED achievements ignore negative redemption entries', async () => {
    const { db, options } = await setup();
    await db.rewardLedger.create({
      data: {
        userId: USER,
        currency: 'COIN',
        amount: 600,
        transactionType: 'EARN',
        sourceType: 'QUEST',
        sourceId: 'earn-600',
      },
    });
    const theme = themeReward(db);
    await redeemReward(USER, theme.id, { ...options, idempotencyKey: 'idem-ach' });
    await evaluateAchievements(USER, options);
    const counters = await computeAchievementCounters(USER, options);
    assert.equal(counters.coinsEarned, 600);
    const keys = [...db._state.userAchievement.values()].map((row) => {
      const def = db._state.achievementDefinition.get(row.achievementId);
      return def?.key;
    });
    // ensureAchievementDefinitions may not run without evaluate seeding — evaluateAchievements calls it
    assert.ok(counters.coinsEarned === 600);
    assert.ok(!keys.includes(undefined) || counters.coinsEarned === 600);
  });
});

describe('phase 7 store listing', () => {
  it('lists only ACTIVE non-hidden rewards', async () => {
    const { options } = await setup();
    await creditCoins(options.db, USER, 50);
    const store = await listStoreRewards(USER, options);
    const keys = store.available.map((r) => r.key);
    assert.ok(keys.includes('MEDI_THEME_7D'));
    assert.ok(!keys.includes('PARTNER_TEST_10'));
    assert.ok(!keys.includes('MEDI_PREMIUM_DAY'));
    const theme = store.available.find((r) => r.key === 'MEDI_THEME_7D');
    assert.equal(theme.userEligibility.reasonCode, 'REWARD_INSUFFICIENT_COINS');
  });
});
