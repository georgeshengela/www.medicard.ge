import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createQuestFakeDb } from './questFakeDb.js';
import { QUEST_TIMEZONE, isoWeekKey } from './questTime.js';
import { assignDailyQuests, claimQuest, updateQuestProgress } from './quest.js';
import { QUEST_ECONOMY, validateAchievementRewardAmounts } from './questEconomy.js';
import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_RARITIES,
  assertAchievementEconomy,
  ensureAchievementDefinitions,
} from './achievementDefs.js';
import {
  claimAchievement,
  computeAchievementCounters,
  evaluateAchievements,
  getAchievementsOverview,
  reconcileAchievements,
} from './achievements.js';

const NOW = new Date('2026-09-06T12:00:00+04:00');
const TODAY = '2026-09-06';
const USER = 'user-ach-1';
const WEEK = isoWeekKey(TODAY);

const EXPECTED_KEYS = [
  'FIRST_QUEST', 'FIRST_CLAIM', 'FIRST_WEEKLY',
  'QUESTS_5', 'QUESTS_10', 'QUESTS_25', 'QUESTS_50', 'QUESTS_100', 'QUESTS_250', 'QUESTS_500',
  'STREAK_3', 'STREAK_7', 'STREAK_14', 'STREAK_30', 'STREAK_60', 'STREAK_100', 'STREAK_365',
  'MOVE_3', 'MOVE_10', 'MOVE_25', 'MOVE_50', 'MOVE_100', 'MOVE_250',
  'HYDRATE_3', 'HYDRATE_10', 'HYDRATE_25', 'HYDRATE_50', 'HYDRATE_100',
  'MEDI_3', 'MEDI_10', 'MEDI_25', 'MEDI_50', 'MEDI_100',
  'WEEKLY_3', 'WEEKLY_10', 'WEEKLY_25', 'WEEKLY_52',
  'LEVEL_5', 'LEVEL_10', 'LEVEL_20', 'LEVEL_30', 'LEVEL_40', 'LEVEL_50',
  'COINS_EARNED_500', 'COINS_EARNED_2500', 'COINS_EARNED_10000', 'COINS_EARNED_25000',
  'COMEBACK', 'EARLY_BIRD', 'NIGHT_OWL',
];

/**
 * Hand-authored Phase 4 rarity catalog (NOT derived from achievementDefs.js).
 * Source of truth for the integrity audit — regenerating this from defs would
 * only snapshot implementation drift.
 */
const CANONICAL_RARITY_BY_KEY = Object.freeze({
  FIRST_QUEST: 'COMMON',
  FIRST_CLAIM: 'COMMON',
  FIRST_WEEKLY: 'UNCOMMON',
  QUESTS_5: 'COMMON',
  QUESTS_10: 'COMMON',
  QUESTS_25: 'UNCOMMON',
  QUESTS_50: 'UNCOMMON',
  QUESTS_100: 'RARE',
  QUESTS_250: 'EPIC',
  QUESTS_500: 'LEGENDARY',
  STREAK_3: 'COMMON',
  STREAK_7: 'UNCOMMON',
  STREAK_14: 'UNCOMMON',
  STREAK_30: 'RARE',
  STREAK_60: 'RARE',
  STREAK_100: 'EPIC',
  STREAK_365: 'LEGENDARY',
  MOVE_3: 'COMMON',
  MOVE_10: 'COMMON',
  MOVE_25: 'UNCOMMON',
  MOVE_50: 'RARE',
  MOVE_100: 'EPIC',
  MOVE_250: 'LEGENDARY',
  HYDRATE_3: 'COMMON',
  HYDRATE_10: 'COMMON',
  HYDRATE_25: 'UNCOMMON',
  HYDRATE_50: 'RARE',
  HYDRATE_100: 'EPIC',
  MEDI_3: 'COMMON',
  MEDI_10: 'COMMON',
  MEDI_25: 'UNCOMMON',
  MEDI_50: 'RARE',
  MEDI_100: 'EPIC',
  WEEKLY_3: 'UNCOMMON',
  WEEKLY_10: 'RARE',
  WEEKLY_25: 'EPIC',
  WEEKLY_52: 'LEGENDARY',
  LEVEL_5: 'COMMON',
  LEVEL_10: 'UNCOMMON',
  LEVEL_20: 'RARE',
  LEVEL_30: 'RARE',
  LEVEL_40: 'EPIC',
  LEVEL_50: 'LEGENDARY',
  COINS_EARNED_500: 'COMMON',
  COINS_EARNED_2500: 'UNCOMMON',
  COINS_EARNED_10000: 'RARE',
  COINS_EARNED_25000: 'EPIC',
  COMEBACK: 'UNCOMMON',
  EARLY_BIRD: 'UNCOMMON',
  NIGHT_OWL: 'UNCOMMON',
});

/**
 * Locked Phase 4 economy snapshot: [rarity, threshold, rewardXp, rewardCoins, isSecret].
 * Hand-authored from the Phase 4 specification — NOT generated from achievementDefs.js.
 * Rewards are explicit per definition — rarity NEVER derives them.
 * Any accidental change to threshold / rarity / rewards / secrecy fails here.
 */
const EXPECTED_ECONOMY = {
  FIRST_QUEST: ['COMMON', 1, 20, 10, false],
  FIRST_CLAIM: ['COMMON', 1, 20, 10, false],
  FIRST_WEEKLY: ['UNCOMMON', 1, 50, 30, false],
  QUESTS_5: ['COMMON', 5, 30, 15, false],
  QUESTS_10: ['COMMON', 10, 50, 25, false],
  QUESTS_25: ['UNCOMMON', 25, 100, 50, false],
  QUESTS_50: ['UNCOMMON', 50, 150, 75, false],
  QUESTS_100: ['RARE', 100, 250, 125, false],
  QUESTS_250: ['EPIC', 250, 500, 250, false],
  QUESTS_500: ['LEGENDARY', 500, 800, 400, false],
  STREAK_3: ['COMMON', 3, 40, 20, false],
  STREAK_7: ['UNCOMMON', 7, 100, 50, false],
  STREAK_14: ['UNCOMMON', 14, 150, 75, false],
  STREAK_30: ['RARE', 30, 300, 150, false],
  STREAK_60: ['RARE', 60, 500, 250, false],
  STREAK_100: ['EPIC', 100, 800, 400, false],
  STREAK_365: ['LEGENDARY', 365, 1500, 500, false],
  MOVE_3: ['COMMON', 3, 30, 15, false],
  MOVE_10: ['COMMON', 10, 60, 30, false],
  MOVE_25: ['UNCOMMON', 25, 120, 60, false],
  MOVE_50: ['RARE', 50, 250, 125, false],
  MOVE_100: ['EPIC', 100, 500, 250, false],
  MOVE_250: ['LEGENDARY', 250, 1000, 500, false],
  HYDRATE_3: ['COMMON', 3, 30, 15, false],
  HYDRATE_10: ['COMMON', 10, 60, 30, false],
  HYDRATE_25: ['UNCOMMON', 25, 120, 60, false],
  HYDRATE_50: ['RARE', 50, 250, 125, false],
  HYDRATE_100: ['EPIC', 100, 500, 250, false],
  MEDI_3: ['COMMON', 3, 30, 15, false],
  MEDI_10: ['COMMON', 10, 60, 30, false],
  MEDI_25: ['UNCOMMON', 25, 120, 60, false],
  MEDI_50: ['RARE', 50, 250, 125, false],
  MEDI_100: ['EPIC', 100, 500, 250, false],
  WEEKLY_3: ['UNCOMMON', 3, 100, 50, false],
  WEEKLY_10: ['RARE', 10, 250, 125, false],
  WEEKLY_25: ['EPIC', 25, 600, 300, false],
  WEEKLY_52: ['LEGENDARY', 52, 1000, 500, false],
  LEVEL_5: ['COMMON', 5, 50, 25, false],
  LEVEL_10: ['UNCOMMON', 10, 100, 50, false],
  LEVEL_20: ['RARE', 20, 250, 125, false],
  LEVEL_30: ['RARE', 30, 350, 175, false],
  LEVEL_40: ['EPIC', 40, 600, 300, false],
  LEVEL_50: ['LEGENDARY', 50, 1000, 500, false],
  COINS_EARNED_500: ['COMMON', 500, 40, 20, false],
  COINS_EARNED_2500: ['UNCOMMON', 2500, 100, 50, false],
  COINS_EARNED_10000: ['RARE', 10000, 250, 125, false],
  COINS_EARNED_25000: ['EPIC', 25000, 500, 250, false],
  COMEBACK: ['UNCOMMON', 1, 100, 50, false],
  EARLY_BIRD: ['UNCOMMON', 1, 75, 40, true],
  NIGHT_OWL: ['UNCOMMON', 1, 75, 40, true],
};

async function setup(extra = {}) {
  const db = createQuestFakeDb();
  await db.stepTrackingCapability.create({ data: { userId: USER, status: 'AVAILABLE', source: 'APPLE_HEALTH' } });
  await db.hydrationPreference.create({ data: { userId: USER, goalMl: 2000 } });
  const options = { db, now: extra.now || NOW, timezone: QUEST_TIMEZONE };
  return { db, options };
}

async function unlockedKeys(db) {
  const rows = await db.userAchievement.findMany({ where: { userId: USER } });
  const defs = await db.achievementDefinition.findMany({});
  const byId = new Map(defs.map((d) => [d.id, d.key]));
  return rows.map((row) => byId.get(row.achievementId)).sort();
}

async function seedCompletedQuests(db, { count, category = 'MOVEMENT', cadence = 'DAILY', startDay = 1, status = 'COMPLETED', completedHour = 12, keyPrefix = 'seed' }) {
  const template = await db.questTemplate.create({
    data: {
      key: `${keyPrefix}_${category.toLowerCase()}_${cadence.toLowerCase()}`,
      category,
      cadence,
      titleKey: 't',
      descriptionKey: 'd',
      progressType: 'STEPS',
      defaultTarget: 1,
      rewardCoins: 10,
      rewardXp: 10,
      isActive: true,
      config: {},
    },
  });
  for (let i = 0; i < count; i += 1) {
    const day = String(startDay + i).padStart(2, '0');
    const periodKey = cadence === 'WEEKLY' ? `2026-W${String(10 + i).padStart(2, '0')}` : `2026-08-${day}`;
    const completedAt = new Date(`2026-08-${cadence === 'WEEKLY' ? '15' : day}T${String(completedHour).padStart(2, '0')}:00:00+04:00`);
    await db.userQuest.create({
      data: {
        userId: USER,
        templateId: template.id,
        periodKey,
        target: 1,
        progress: 1,
        status,
        assignedAt: completedAt,
        completedAt,
        expiresAt: completedAt,
        metadata: { assignedTimezone: 'Asia/Tbilisi' },
      },
    });
  }
}

describe('phase 4 catalog', () => {
  it('contains exactly the locked achievement keys', () => {
    const keys = ACHIEVEMENT_DEFINITIONS.map((d) => d.key).sort();
    assert.deepEqual(keys, [...EXPECTED_KEYS].sort());
    assert.equal(ACHIEVEMENT_DEFINITIONS.length, 50);
  });

  it('matches the locked per-definition economy exactly (all 50)', () => {
    assert.equal(Object.keys(EXPECTED_ECONOMY).length, 50);
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      const expected = EXPECTED_ECONOMY[def.key];
      assert.ok(expected, `unexpected achievement ${def.key}`);
      assert.deepEqual(
        {
          rarity: def.rarity,
          threshold: def.threshold,
          rewardXp: def.rewardXp,
          rewardCoins: def.rewardCoins,
          isSecret: def.isSecret,
        },
        {
          rarity: expected[0],
          threshold: expected[1],
          rewardXp: expected[2],
          rewardCoins: expected[3],
          isSecret: expected[4],
        },
        def.key,
      );
    }
  });

  it('rewards are per-definition, not uniform per rarity', () => {
    // Same rarity, different rewards — proves rarity does not derive the economy.
    const byKey = new Map(ACHIEVEMENT_DEFINITIONS.map((d) => [d.key, d]));
    assert.notEqual(byKey.get('QUESTS_5').rewardXp, byKey.get('STREAK_3').rewardXp); // both COMMON
    assert.notEqual(byKey.get('FIRST_WEEKLY').rewardXp, byKey.get('WEEKLY_3').rewardXp); // both UNCOMMON
    assert.notEqual(byKey.get('QUESTS_500').rewardXp, byKey.get('STREAK_365').rewardXp); // both LEGENDARY
  });

  it('hand-authored canonical rarity map has 50 unique keys and exact per-key match', () => {
    const canonicalKeys = Object.keys(CANONICAL_RARITY_BY_KEY);
    assert.equal(canonicalKeys.length, 50);
    assert.equal(new Set(canonicalKeys).size, 50);
    assert.deepEqual([...canonicalKeys].sort(), [...EXPECTED_KEYS].sort());

    const dist = Object.fromEntries(ACHIEVEMENT_RARITIES.map((r) => [r, 0]));
    for (const rarity of Object.values(CANONICAL_RARITY_BY_KEY)) dist[rarity] += 1;
    assert.deepEqual(dist, {
      COMMON: 13,
      UNCOMMON: 14,
      RARE: 10,
      EPIC: 8,
      LEGENDARY: 5,
    });

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      assert.equal(def.rarity, CANONICAL_RARITY_BY_KEY[def.key], def.key);
      assert.equal(EXPECTED_ECONOMY[def.key][0], CANONICAL_RARITY_BY_KEY[def.key], def.key);
    }
    assert.equal(CANONICAL_RARITY_BY_KEY.FIRST_WEEKLY, 'UNCOMMON');
    assert.equal(CANONICAL_RARITY_BY_KEY.COMEBACK, 'UNCOMMON');
    assert.equal(CANONICAL_RARITY_BY_KEY.EARLY_BIRD, 'UNCOMMON');
    assert.equal(CANONICAL_RARITY_BY_KEY.NIGHT_OWL, 'UNCOMMON');
  });

  it('Phase 8.1: FIRST_WEEKLY and COMEBACK are UNCOMMON (presentation only)', () => {
    const byKey = new Map(ACHIEVEMENT_DEFINITIONS.map((d) => [d.key, d]));
    assert.equal(byKey.get('FIRST_WEEKLY').rarity, 'UNCOMMON');
    assert.equal(byKey.get('FIRST_WEEKLY').rewardXp, 50);
    assert.equal(byKey.get('FIRST_WEEKLY').rewardCoins, 30);
    assert.equal(byKey.get('COMEBACK').rarity, 'UNCOMMON');
    assert.equal(byKey.get('COMEBACK').rewardXp, 100);
    assert.equal(byKey.get('COMEBACK').rewardCoins, 50);
  });

  it('reports rarity distribution across 50 definitions', () => {
    assert.equal(ACHIEVEMENT_DEFINITIONS.length, 50);
    const counts = Object.fromEntries(ACHIEVEMENT_RARITIES.map((r) => [r, 0]));
    for (const def of ACHIEVEMENT_DEFINITIONS) counts[def.rarity] += 1;
    // Derived from the explicit Phase 4 per-key rarity list (not a marketing summary).
    assert.deepEqual(counts, {
      COMMON: 13,
      UNCOMMON: 14,
      RARE: 10,
      EPIC: 8,
      LEGENDARY: 5,
    });
  });

  it('encodes thresholds from the key and stays inside the economy ceilings', () => {
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      assertAchievementEconomy(def);
      assert.ok(ACHIEVEMENT_RARITIES.includes(def.rarity), def.key);
      assert.ok(def.rewardCoins <= QUEST_ECONOMY.maxSingleAchievementCoins, def.key);
      assert.ok(def.rewardXp <= QUEST_ECONOMY.maxSingleAchievementXp, def.key);
      const suffix = def.key.match(/_(\d+)$/);
      if (suffix) assert.equal(def.threshold, Number(suffix[1]), def.key);
    }
    const secrets = ACHIEVEMENT_DEFINITIONS.filter((d) => d.isSecret).map((d) => d.key).sort();
    assert.deepEqual(secrets, ['EARLY_BIRD', 'NIGHT_OWL']);
  });

  it('STREAK_365 (1500 XP / 500 coins) passes the safety ceiling without clamping', () => {
    assert.ok(QUEST_ECONOMY.maxSingleAchievementXp >= 1500);
    const streak365 = ACHIEVEMENT_DEFINITIONS.find((d) => d.key === 'STREAK_365');
    assert.equal(streak365.rewardXp, 1500);
    assert.equal(streak365.rewardCoins, 500);
    const validated = validateAchievementRewardAmounts({ rewardXp: 1500, rewardCoins: 500 });
    assert.deepEqual(validated, { xp: 1500, coins: 500 }); // exact, never clamped
    assert.doesNotThrow(() => assertAchievementEconomy(streak365));
    // Ceiling still rejects (not clamps) anything above it.
    assert.throws(
      () => validateAchievementRewardAmounts({ rewardXp: QUEST_ECONOMY.maxSingleAchievementXp + 1, rewardCoins: 0 }),
      { code: 'ACHIEVEMENT_REWARD_CEILING' },
    );
  });

  it('seeds idempotently', async () => {
    const { db } = await setup();
    const first = await ensureAchievementDefinitions(db);
    const second = await ensureAchievementDefinitions(db);
    assert.equal(first.upserted, 50);
    assert.equal(second.upserted, 50);
    const rows = await db.achievementDefinition.findMany({});
    assert.equal(rows.length, 50);
  });

  it('rarity-only seed resync creates no RewardLedger rows and preserves claim state', async () => {
    const { db } = await setup();
    await ensureAchievementDefinitions(db);

    // Poison rarities to the pre-correction values (presentation drift only).
    const poison = {
      MOVE_100: 'RARE',
      MOVE_250: 'EPIC',
      WEEKLY_3: 'COMMON',
      WEEKLY_10: 'UNCOMMON',
      WEEKLY_25: 'RARE',
      WEEKLY_52: 'EPIC',
    };
    for (const [key, rarity] of Object.entries(poison)) {
      await db.achievementDefinition.update({ where: { key }, data: { rarity } });
    }

    const move100 = await db.achievementDefinition.findUnique({ where: { key: 'MOVE_100' } });
    await db.userAchievement.create({
      data: {
        userId: USER,
        achievementId: move100.id,
        progressAtUnlock: 100,
        status: 'CLAIMED',
        claimedAt: NOW,
      },
    });

    const ledgerBefore = await db.rewardLedger.findMany({});
    const unlocksBefore = await db.userAchievement.findMany({ where: { userId: USER } });
    assert.equal(ledgerBefore.length, 0);

    await ensureAchievementDefinitions(db);

    const ledgerAfter = await db.rewardLedger.findMany({});
    const unlocksAfter = await db.userAchievement.findMany({ where: { userId: USER } });
    assert.equal(ledgerAfter.length, 0);
    assert.equal(unlocksAfter.length, unlocksBefore.length);
    assert.equal(unlocksAfter[0].status, 'CLAIMED');
    assert.equal(unlocksAfter[0].claimedAt?.toISOString?.() || unlocksAfter[0].claimedAt, unlocksBefore[0].claimedAt?.toISOString?.() || unlocksBefore[0].claimedAt);

    for (const [key, rarity] of Object.entries(CANONICAL_RARITY_BY_KEY)) {
      if (!(key in poison) && !['MOVE_100', 'MOVE_250', 'WEEKLY_3', 'WEEKLY_10', 'WEEKLY_25', 'WEEKLY_52'].includes(key)) continue;
      const row = await db.achievementDefinition.findUnique({ where: { key } });
      assert.equal(row.rarity, rarity, key);
      assert.equal(row.rewardXp, EXPECTED_ECONOMY[key][2], key);
      assert.equal(row.rewardCoins, EXPECTED_ECONOMY[key][3], key);
      assert.equal(row.threshold, EXPECTED_ECONOMY[key][1], key);
    }
  });
});

describe('phase 4 evaluator', () => {
  it('unlocks FIRST_QUEST automatically when a quest completes through the engine', async () => {
    const { db, options } = await setup();
    await assignDailyQuests(USER, TODAY, options);
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 6000 } });
    await updateQuestProgress(USER, {}, options);
    const keys = await unlockedKeys(db);
    assert.ok(keys.includes('FIRST_QUEST'));
    assert.ok(!keys.includes('FIRST_CLAIM'));
  });

  it('unlocks FIRST_CLAIM after claiming and keeps unlock rows immutable', async () => {
    const { db, options } = await setup();
    await assignDailyQuests(USER, TODAY, options);
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 6000 } });
    const updated = await updateQuestProgress(USER, {}, options);
    const steps = updated.find((row) => row.template?.key === 'daily_steps');
    await claimQuest(USER, steps.id, options);
    let keys = await unlockedKeys(db);
    assert.ok(keys.includes('FIRST_CLAIM'));

    // Immutability: even if the source rows disappear, re-evaluation never revokes.
    await db.userQuest.updateMany({ where: { userId: USER }, data: { status: 'EXPIRED' } });
    await evaluateAchievements(USER, options);
    keys = await unlockedKeys(db);
    assert.ok(keys.includes('FIRST_QUEST'));
    assert.ok(keys.includes('FIRST_CLAIM'));
  });

  it('unlocks family tiers from completion counters', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 10, category: 'MOVEMENT' });
    await evaluateAchievements(USER, options);
    const keys = await unlockedKeys(db);
    assert.ok(keys.includes('MOVE_3'));
    assert.ok(keys.includes('MOVE_10'));
    assert.ok(!keys.includes('MOVE_25'));
    assert.ok(keys.includes('QUESTS_5'));
    assert.ok(keys.includes('QUESTS_10'));
    assert.ok(!keys.includes('QUESTS_25'));
  });

  it('unlocks hydration, medi and weekly tiers from their own counters', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 3, category: 'HYDRATION', keyPrefix: 'h' });
    await seedCompletedQuests(db, { count: 3, category: 'MEDI', keyPrefix: 'm', startDay: 10 });
    await seedCompletedQuests(db, { count: 3, category: 'MOVEMENT', cadence: 'WEEKLY', keyPrefix: 'w' });
    await evaluateAchievements(USER, options);
    const keys = await unlockedKeys(db);
    assert.ok(keys.includes('HYDRATE_3'));
    assert.ok(keys.includes('MEDI_3'));
    assert.ok(keys.includes('WEEKLY_3'));
    assert.ok(keys.includes('FIRST_WEEKLY'));
    assert.ok(!keys.includes('HYDRATE_10'));
  });

  it('unlocks streak tiers from the profile longest streak', async () => {
    const { db, options } = await setup();
    await db.userQuestProfile.create({ data: { userId: USER, currentStreak: 2, longestStreak: 7 } });
    await evaluateAchievements(USER, options);
    const keys = await unlockedKeys(db);
    assert.ok(keys.includes('STREAK_3'));
    assert.ok(keys.includes('STREAK_7'));
    assert.ok(!keys.includes('STREAK_14'));
  });

  it('unlocks coins-earned tiers from the ledger (positive EARN only)', async () => {
    const { db, options } = await setup();
    await db.rewardLedger.create({
      data: { userId: USER, currency: 'COIN', amount: 600, transactionType: 'EARN', sourceType: 'QUEST', sourceId: 'q1' },
    });
    await db.rewardLedger.create({
      data: { userId: USER, currency: 'COIN', amount: -200, transactionType: 'ADJUST', sourceType: 'SYSTEM', sourceId: 's1' },
    });
    await evaluateAchievements(USER, options);
    const counters = await computeAchievementCounters(USER, options);
    assert.equal(counters.coinsEarned, 600);
    const keys = await unlockedKeys(db);
    assert.ok(keys.includes('COINS_EARNED_500'));
    assert.ok(!keys.includes('COINS_EARNED_2500'));
  });

  it('ignores REWARD_REDEMPTION spends for COINS_EARNED lifetime progress (phase 7)', async () => {
    const { db, options } = await setup();
    await db.rewardLedger.create({
      data: { userId: USER, currency: 'COIN', amount: 600, transactionType: 'EARN', sourceType: 'QUEST', sourceId: 'q-earn' },
    });
    await db.rewardLedger.create({
      data: {
        userId: USER,
        currency: 'COIN',
        amount: -300,
        transactionType: 'REDEEM',
        sourceType: 'REWARD_REDEMPTION',
        sourceId: 'redemption-1',
      },
    });
    const counters = await computeAchievementCounters(USER, options);
    assert.equal(counters.coinsEarned, 600);
    await evaluateAchievements(USER, options);
    assert.ok((await unlockedKeys(db)).includes('COINS_EARNED_500'));
  });

  it('detects a comeback gap of 8+ local days', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 1, startDay: 1 });
    await seedCompletedQuests(db, { count: 1, startDay: 12, keyPrefix: 'later' });
    const counters = await computeAchievementCounters(USER, options);
    assert.equal(counters.comeback, 1);
    await evaluateAchievements(USER, options);
    assert.ok((await unlockedKeys(db)).includes('COMEBACK'));
  });

  it('does not flag a comeback for consecutive days', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 4, startDay: 1 });
    const counters = await computeAchievementCounters(USER, options);
    assert.equal(counters.comeback, 0);
  });

  it('unlocks secret time-of-day achievements from local completion hours', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 1, completedHour: 5 });
    await seedCompletedQuests(db, { count: 1, completedHour: 23, startDay: 5, keyPrefix: 'owl' });
    await evaluateAchievements(USER, options);
    const keys = await unlockedKeys(db);
    assert.ok(keys.includes('EARLY_BIRD'));
    assert.ok(keys.includes('NIGHT_OWL'));
  });

  it('masks locked secrets in the overview and reveals them after unlock', async () => {
    const { db, options } = await setup();
    const before = await getAchievementsOverview(USER, options);
    const maskedSecrets = before.items.filter((item) => item.secret && !item.unlocked);
    assert.equal(maskedSecrets.length, 2);
    for (const item of maskedSecrets) {
      assert.equal(item.key, null);
      assert.equal(item.threshold, null);
      assert.equal(item.progress, null);
    }
    await seedCompletedQuests(db, { count: 1, completedHour: 5 });
    const after = await getAchievementsOverview(USER, options);
    const earlyBird = after.items.find((item) => item.key === 'EARLY_BIRD');
    assert.ok(earlyBird);
    assert.equal(earlyBird.unlocked, true);
    assert.equal(earlyBird.claimable, true);
  });

  it('reports server-authoritative progress for locked achievements', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 4, category: 'MOVEMENT' });
    const overview = await getAchievementsOverview(USER, options);
    const move10 = overview.items.find((item) => item.key === 'MOVE_10');
    assert.equal(move10.unlocked, false);
    assert.equal(move10.progress, 4);
    assert.equal(move10.progressPercent, 40);
    assert.equal(overview.summary.total, 50);
    assert.equal(overview.summary.unlocked, 2); // FIRST_QUEST + MOVE_3 (4 completions < QUESTS_5)
  });
});

describe('phase 4 claim', () => {
  async function unlockFirstQuest() {
    const context = await setup();
    await seedCompletedQuests(context.db, { count: 1 });
    await evaluateAchievements(USER, context.options);
    const defs = await context.db.achievementDefinition.findMany({});
    const firstQuest = defs.find((d) => d.key === 'FIRST_QUEST');
    return { ...context, firstQuest };
  }

  it('issues the definition rewards exactly once through the RewardLedger', async () => {
    const { db, options, firstQuest } = await unlockFirstQuest();
    const first = await claimAchievement(USER, firstQuest.id, options);
    assert.equal(first.claimed, true);
    assert.equal(first.reward.coinsAwarded, 10); // FIRST_QUEST exact economy
    assert.equal(first.reward.xpAwarded, 20);

    const second = await claimAchievement(USER, firstQuest.id, options);
    assert.equal(second.claimed, false);
    assert.equal(second.alreadyClaimed, true);
    assert.equal(second.reward.coinsAwarded, 0);

    const ledger = await db.rewardLedger.findMany({ where: { userId: USER, sourceType: 'ACHIEVEMENT' } });
    assert.equal(ledger.length, 2); // one XP row + one COIN row
    const profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.cachedCoinBalance, 10);
    assert.equal(profile.totalXp, 20);
  });

  it('claim pays the exact per-definition rewards across reward patterns', async () => {
    // FIRST_QUEST / QUESTS_500 / STREAK_365 / EARLY_BIRD / LEVEL_30 deliberately
    // span different rewards within shared rarities — claim must use the
    // definition values verbatim and never recalculate from rarity.
    const expected = {
      FIRST_QUEST: { xp: 20, coins: 10 },
      QUESTS_500: { xp: 800, coins: 400 },
      STREAK_365: { xp: 1500, coins: 500 },
      EARLY_BIRD: { xp: 75, coins: 40 },
      LEVEL_30: { xp: 350, coins: 175 },
    };
    const { db, options } = await setup();
    await ensureAchievementDefinitions(db);
    const defs = await db.achievementDefinition.findMany({});
    for (const [key, reward] of Object.entries(expected)) {
      const definition = defs.find((d) => d.key === key);
      const unlock = await db.userAchievement.create({
        data: { userId: USER, achievementId: definition.id, status: 'UNLOCKED', progressAtUnlock: definition.threshold },
      });
      const result = await claimAchievement(USER, definition.id, options);
      assert.equal(result.claimed, true, key);
      assert.equal(result.reward.xpAwarded, reward.xp, key);
      assert.equal(result.reward.coinsAwarded, reward.coins, key);
      const rows = await db.rewardLedger.findMany({
        where: { userId: USER, sourceType: 'ACHIEVEMENT', sourceId: unlock.id },
      });
      const xpRow = rows.find((row) => row.currency === 'XP');
      const coinRow = rows.find((row) => row.currency === 'COIN');
      assert.equal(xpRow.amount, reward.xp, key);
      assert.equal(coinRow.amount, reward.coins, key);
    }
  });

  it('rejects claiming an achievement that is not unlocked', async () => {
    const { db, options } = await setup();
    await ensureAchievementDefinitions(db);
    const defs = await db.achievementDefinition.findMany({});
    const legend = defs.find((d) => d.key === 'QUESTS_500');
    await assert.rejects(() => claimAchievement(USER, legend.id, options), { status: 409 });
    const ledger = await db.rewardLedger.findMany({ where: { userId: USER } });
    assert.equal(ledger.length, 0);
  });

  it('rejects a tampered reward above the ceiling without paying', async () => {
    const { db, options, firstQuest } = await unlockFirstQuest();
    await db.achievementDefinition.update({
      where: { id: firstQuest.id },
      data: { rewardCoins: QUEST_ECONOMY.maxSingleAchievementCoins + 1 },
    });
    await assert.rejects(() => claimAchievement(USER, firstQuest.id, options), { code: 'ACHIEVEMENT_REWARD_CEILING' });
    const ledger = await db.rewardLedger.findMany({ where: { userId: USER, sourceType: 'ACHIEVEMENT' } });
    assert.equal(ledger.length, 0);
  });

  it('cascades safely: claim XP can unlock LEVEL_* but never auto-claims it', async () => {
    const { db, options } = await setup();
    // 1100 XP puts the user at level 5 (threshold 1100).
    await db.rewardLedger.create({
      data: { userId: USER, currency: 'XP', amount: 1060, transactionType: 'EARN', sourceType: 'QUEST', sourceId: 'seed-xp' },
    });
    await seedCompletedQuests(db, { count: 1 });
    await evaluateAchievements(USER, options);
    let keys = await unlockedKeys(db);
    assert.ok(!keys.includes('LEVEL_5'));

    const defs = await db.achievementDefinition.findMany({});
    const firstQuest = defs.find((d) => d.key === 'FIRST_QUEST');
    const result = await claimAchievement(USER, firstQuest.id, options); // +20 XP → 1080… still level 4
    assert.equal(result.profile.leveledUp, false);

    const move3 = defs.find((d) => d.key === 'MOVE_3');
    await seedCompletedQuests(db, { count: 2, startDay: 20, keyPrefix: 'more' });
    await evaluateAchievements(USER, options);
    const claim2 = await claimAchievement(USER, move3.id, options); // +30 XP → 1110 → level 5
    assert.equal(claim2.profile.leveledUp, true);
    assert.equal(claim2.profile.currentLevel, 5);

    keys = await unlockedKeys(db);
    assert.ok(keys.includes('LEVEL_5'));
    const level5 = defs.find((d) => d.key === 'LEVEL_5');
    const rows = await db.userAchievement.findMany({ where: { userId: USER, achievementId: level5.id } });
    assert.equal(rows[0].status, 'UNLOCKED'); // unlocked by cascade, never auto-claimed
    const level5Ledger = await db.rewardLedger.findMany({
      where: { userId: USER, sourceType: 'ACHIEVEMENT', sourceId: rows[0].id },
    });
    assert.equal(level5Ledger.length, 0);
  });
});

describe('phase 4 reconciliation', () => {
  it('repairs missing unlocks from the source of truth', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 5 });
    // Simulate drift: definitions exist but no unlock rows were written.
    await ensureAchievementDefinitions(db);
    const before = await db.userAchievement.findMany({ where: { userId: USER } });
    assert.equal(before.length, 0);
    const result = await reconcileAchievements(USER, options);
    assert.ok(result.repairedUnlocks >= 3);
    const keys = await unlockedKeys(db);
    assert.ok(keys.includes('FIRST_QUEST'));
    assert.ok(keys.includes('QUESTS_5'));
    assert.ok(keys.includes('MOVE_5' in keys ? 'MOVE_5' : 'MOVE_3'));
  });

  it('is idempotent — a second run repairs nothing', async () => {
    const { db, options } = await setup();
    await seedCompletedQuests(db, { count: 5 });
    await reconcileAchievements(USER, options);
    const again = await reconcileAchievements(USER, options);
    assert.equal(again.repairedUnlocks, 0);
    const rows = await db.userAchievement.findMany({ where: { userId: USER } });
    const unique = new Set(rows.map((row) => row.achievementId));
    assert.equal(unique.size, rows.length);
  });
});
