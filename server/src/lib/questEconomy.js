/**
 * Central Medi Quest economy and safety ceilings.
 * Do not scatter reward constants. Admin will own these later.
 *
 * Expected Phase 1.1 earnings (not ceilings):
 *   daily_steps 30 + daily_hydration 20 + daily_medi 10 = 60 coins/day
 *   weekly_steps 150 → perfect week ≈ 570 coins
 */
export const QUEST_ECONOMY = Object.freeze({
  maxStandardDailyCoins: 150,
  maxStandardWeeklyCoins: 1000,
  maxSingleQuestCoins: 250,
  maxSingleAchievementCoins: 500,
  /** Must stay ≥ 1500 — STREAK_365 awards 1500 XP by spec. Invalid defs are rejected, never clamped. */
  maxSingleAchievementXp: 2000,
  maxSingleDailyQuestXp: 250,
  maxSingleWeeklyQuestXp: 1000,
  /** Phase 7 — Rewards Store coin cost guards (reject, never clamp). */
  minRewardCoinCost: 100,
  maxRewardCoinCost: 100000,
  /** Distinct daily periodKeys cannot be assigned faster than this unless they are last+1. */
  dailyHopGuardMs: 20 * 60 * 60 * 1000,
  /** Natural next local day (or one-day eastbound travel) needs this gap. */
  dailySuccessorGuardMs: 12 * 60 * 60 * 1000,
  dailyStepsReconciliationHours: 6,
  weeklyStepsReconciliationHours: 12,
  hydrationReconciliationHours: 2,
  mediReconciliationHours: 0,
  hydrationGoalMlMin: 250,
  hydrationGoalMlMax: 8000,
});

export function reconciliationHoursForProgressType(progressType, cadence) {
  if (progressType === 'HYDRATION_GOAL_PERCENT') return QUEST_ECONOMY.hydrationReconciliationHours;
  if (progressType === 'MEDI_DAILY_USE') return QUEST_ECONOMY.mediReconciliationHours;
  if (progressType === 'STEPS' && cadence === 'WEEKLY') return QUEST_ECONOMY.weeklyStepsReconciliationHours;
  return QUEST_ECONOMY.dailyStepsReconciliationHours;
}

export function xpCeilingForCadence(cadence) {
  return cadence === 'WEEKLY' ? QUEST_ECONOMY.maxSingleWeeklyQuestXp : QUEST_ECONOMY.maxSingleDailyQuestXp;
}

export function coinCeilingForCadence(cadence) {
  return cadence === 'WEEKLY' ? QUEST_ECONOMY.maxStandardWeeklyCoins : QUEST_ECONOMY.maxSingleQuestCoins;
}

export function validateQuestRewardAmounts({ cadence, rewardXp, rewardCoins } = {}) {
  const xp = Math.floor(Number(rewardXp) || 0);
  const coins = Math.floor(Number(rewardCoins) || 0);
  const xpMax = xpCeilingForCadence(cadence);
  const coinMax = coinCeilingForCadence(cadence);
  if (xp < 0 || coins < 0) {
    const error = new Error('Quest rewards cannot be negative.');
    error.status = 400;
    throw error;
  }
  if (xp > xpMax || coins > coinMax) {
    const error = new Error('Quest reward exceeds safety ceiling.');
    error.status = 400;
    error.code = 'QUEST_REWARD_CEILING';
    throw error;
  }
  return { xp, coins };
}

/** Achievement rewards must respect the achievement-specific ceilings. */
export function validateAchievementRewardAmounts({ rewardXp, rewardCoins } = {}) {
  const xp = Math.floor(Number(rewardXp) || 0);
  const coins = Math.floor(Number(rewardCoins) || 0);
  if (xp < 0 || coins < 0) {
    const error = new Error('Achievement rewards cannot be negative.');
    error.status = 400;
    throw error;
  }
  if (xp > QUEST_ECONOMY.maxSingleAchievementXp || coins > QUEST_ECONOMY.maxSingleAchievementCoins) {
    const error = new Error('Achievement reward exceeds safety ceiling.');
    error.status = 400;
    error.code = 'ACHIEVEMENT_REWARD_CEILING';
    throw error;
  }
  return { xp, coins };
}

export function validateHydrationGoalMl(goalMl) {
  const goal = Math.floor(Number(goalMl));
  if (!Number.isFinite(goal) || goal < QUEST_ECONOMY.hydrationGoalMlMin || goal > QUEST_ECONOMY.hydrationGoalMlMax) {
    const error = new Error('არასწორი ჰიდრატაციის მიზანი.');
    error.status = 400;
    error.code = 'HYDRATION_GOAL_RANGE';
    throw error;
  }
  return goal;
}

/** Phase 7 — store reward costs are explicit; reject invalid values, never clamp. */
export function validateRewardCoinCost(coinCost) {
  const cost = Math.floor(Number(coinCost));
  if (!Number.isFinite(cost) || cost <= 0) {
    const error = new Error('Reward coin cost must be positive.');
    error.status = 400;
    error.code = 'REWARD_INVALID_COST';
    throw error;
  }
  if (cost < QUEST_ECONOMY.minRewardCoinCost || cost > QUEST_ECONOMY.maxRewardCoinCost) {
    const error = new Error('Reward coin cost outside allowed range.');
    error.status = 400;
    error.code = 'REWARD_INVALID_COST';
    throw error;
  }
  return cost;
}

/** Safety ceilings reject — they never silently mutate a configured reward. */
export function assertIssuableQuestReward(template) {
  try {
    return validateQuestRewardAmounts({
      cadence: template?.cadence,
      rewardXp: template?.rewardXp,
      rewardCoins: template?.rewardCoins,
    });
  } catch (error) {
    console.warn('[quest] invalid reward config blocked issuance', {
      key: template?.key,
      cadence: template?.cadence,
      rewardXp: template?.rewardXp,
      rewardCoins: template?.rewardCoins,
      code: error.code,
    });
    throw error;
  }
}
