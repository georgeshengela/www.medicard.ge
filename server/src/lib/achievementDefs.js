import { validateAchievementRewardAmounts } from './questEconomy.js';

/**
 * Phase 4 — canonical achievement catalog.
 *
 * Keys, families, thresholds, AND per-achievement reward values are locked by
 * the Phase 4 alignment spec. Every definition carries its own explicit
 * rewardXp / rewardCoins — rarity is presentation / difficulty metadata only
 * (badge tint, sorting, unlock treatment, analytics) and MUST NEVER derive
 * reward amounts. Rewards must stay within
 * QUEST_ECONOMY.maxSingleAchievementCoins / maxSingleAchievementXp; invalid
 * definitions are rejected at seed/claim time, never silently clamped.
 * Never change thresholds or rewards silently — report conflicts instead.
 */
export const ACHIEVEMENT_RARITIES = Object.freeze(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']);

function def(key, family, category, rarity, threshold, rewardXp, rewardCoins, extra = {}) {
  return {
    key,
    family,
    category,
    rarity,
    threshold,
    rewardCoins,
    rewardXp,
    isSecret: Boolean(extra.isSecret),
    titleKey: `achievement.${key.toLowerCase()}.title`,
    descriptionKey: `achievement.${key.toLowerCase()}.description`,
    sortOrder: extra.sortOrder ?? 0,
    isActive: true,
  };
}

/** tiers: [threshold, rarity, rewardXp, rewardCoins] — rewards are explicit per tier. */
function series(family, category, tiers, baseSort) {
  return tiers.map(([threshold, rarity, rewardXp, rewardCoins], index) =>
    def(`${family}_${threshold}`, family, category, rarity, threshold, rewardXp, rewardCoins, {
      sortOrder: baseSort + index,
    }),
  );
}

export const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  // Firsts
  def('FIRST_QUEST', 'FIRST', 'PROGRESSION', 'COMMON', 1, 20, 10, { sortOrder: 0 }),
  def('FIRST_CLAIM', 'FIRST', 'PROGRESSION', 'COMMON', 1, 20, 10, { sortOrder: 1 }),
  def('FIRST_WEEKLY', 'FIRST', 'PROGRESSION', 'UNCOMMON', 1, 50, 30, { sortOrder: 2 }),

  // Total quest completions
  ...series('QUESTS', 'PROGRESSION', [
    [5, 'COMMON', 30, 15],
    [10, 'COMMON', 50, 25],
    [25, 'UNCOMMON', 100, 50],
    [50, 'UNCOMMON', 150, 75],
    [100, 'RARE', 250, 125],
    [250, 'EPIC', 500, 250],
    [500, 'LEGENDARY', 800, 400],
  ], 10),

  // Longest daily streak
  ...series('STREAK', 'STREAK', [
    [3, 'COMMON', 40, 20],
    [7, 'UNCOMMON', 100, 50],
    [14, 'UNCOMMON', 150, 75],
    [30, 'RARE', 300, 150],
    [60, 'RARE', 500, 250],
    [100, 'EPIC', 800, 400],
    [365, 'LEGENDARY', 1500, 500],
  ], 20),

  // Movement quest completions
  ...series('MOVE', 'MOVEMENT', [
    [3, 'COMMON', 30, 15],
    [10, 'COMMON', 60, 30],
    [25, 'UNCOMMON', 120, 60],
    [50, 'RARE', 250, 125],
    [100, 'EPIC', 500, 250],
    [250, 'LEGENDARY', 1000, 500],
  ], 30),

  // Hydration quest completions
  ...series('HYDRATE', 'HYDRATION', [
    [3, 'COMMON', 30, 15],
    [10, 'COMMON', 60, 30],
    [25, 'UNCOMMON', 120, 60],
    [50, 'RARE', 250, 125],
    [100, 'EPIC', 500, 250],
  ], 40),

  // Medi quest completions
  ...series('MEDI', 'MEDI', [
    [3, 'COMMON', 30, 15],
    [10, 'COMMON', 60, 30],
    [25, 'UNCOMMON', 120, 60],
    [50, 'RARE', 250, 125],
    [100, 'EPIC', 500, 250],
  ], 50),

  // Weekly quest completions
  ...series('WEEKLY', 'WEEKLY', [
    [3, 'UNCOMMON', 100, 50],
    [10, 'RARE', 250, 125],
    [25, 'EPIC', 600, 300],
    [52, 'LEGENDARY', 1000, 500],
  ], 60),

  // Level milestones
  ...series('LEVEL', 'LEVEL', [
    [5, 'COMMON', 50, 25],
    [10, 'UNCOMMON', 100, 50],
    [20, 'RARE', 250, 125],
    [30, 'RARE', 350, 175],
    [40, 'EPIC', 600, 300],
    [50, 'LEGENDARY', 1000, 500],
  ], 70),

  // Lifetime Medi Coins earned
  ...series('COINS_EARNED', 'COINS', [
    [500, 'COMMON', 40, 20],
    [2500, 'UNCOMMON', 100, 50],
    [10000, 'RARE', 250, 125],
    [25000, 'EPIC', 500, 250],
  ], 80),

  // Comeback — completed a daily quest after 7+ fully missed days
  def('COMEBACK', 'COMEBACK', 'SPECIAL', 'UNCOMMON', 1, 100, 50, { sortOrder: 90 }),

  // Secret time-of-day achievements
  def('EARLY_BIRD', 'TIME_OF_DAY', 'SPECIAL', 'UNCOMMON', 1, 75, 40, { isSecret: true, sortOrder: 91 }),
  def('NIGHT_OWL', 'TIME_OF_DAY', 'SPECIAL', 'UNCOMMON', 1, 75, 40, { isSecret: true, sortOrder: 92 }),
]);

export function assertAchievementEconomy(definition) {
  validateAchievementRewardAmounts({
    rewardXp: definition.rewardXp,
    rewardCoins: definition.rewardCoins,
  });
  if (!ACHIEVEMENT_RARITIES.includes(definition.rarity)) {
    const error = new Error(`Unknown achievement rarity: ${definition.rarity}`);
    error.status = 500;
    throw error;
  }
  return definition;
}

/** Idempotent seed/upsert. Thresholds and keys never mutate silently in place. */
export async function ensureAchievementDefinitions(db) {
  if (typeof db?.achievementDefinition?.upsert !== 'function') return { upserted: 0 };
  let upserted = 0;
  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    assertAchievementEconomy(definition);
    await db.achievementDefinition.upsert({
      where: { key: definition.key },
      create: definition,
      update: {
        family: definition.family,
        category: definition.category,
        rarity: definition.rarity,
        threshold: definition.threshold,
        rewardCoins: definition.rewardCoins,
        rewardXp: definition.rewardXp,
        isSecret: definition.isSecret,
        titleKey: definition.titleKey,
        descriptionKey: definition.descriptionKey,
        sortOrder: definition.sortOrder,
        isActive: definition.isActive,
      },
    });
    upserted += 1;
  }
  return { upserted };
}
