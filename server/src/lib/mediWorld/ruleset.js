/**
 * Canonical Medi World economy ruleset: medi-world-economy-v2
 * Do not scatter these constants across routes, UI, Quest templates, or SQL.
 */

export const MEDI_WORLD_RULESET_ID = 'medi-world-economy-v2';
export const MEDI_WORLD_RULESET_VERSION = 2;

/** Frozen Phase 38 linear interpreter. Historical ledger rows keep version 1. Never rewrite them. */
export const MEDI_WORLD_FOUNDATION_V1 = Object.freeze({
  id: 'medi-world-foundation-v1',
  rulesetVersion: 1,
  maxEnergyPerEvent: 10,
  maxFoundationXpPerEvent: 5,
  xpPerLevel: 50,
  completionRatioCapBps: 10_000,
});

export const REASON_CODES = Object.freeze({
  PERSONAL_GOAL_BELOW_HALF: 'PERSONAL_GOAL_BELOW_HALF',
  PERSONAL_GOAL_HALF_COMPLETE: 'PERSONAL_GOAL_HALF_COMPLETE',
  PERSONAL_GOAL_MOSTLY_COMPLETE: 'PERSONAL_GOAL_MOSTLY_COMPLETE',
  PERSONAL_GOAL_COMPLETE: 'PERSONAL_GOAL_COMPLETE',
  DAILY_CATEGORY_CAP_REACHED: 'DAILY_CATEGORY_CAP_REACHED',
  DAILY_XP_CAP_REACHED: 'DAILY_XP_CAP_REACHED',
  UNVERIFIED_ACTIVITY: 'UNVERIFIED_ACTIVITY',
  DUPLICATE_ACTIVITY: 'DUPLICATE_ACTIVITY',
  LEVEL_UP_REWARD: 'LEVEL_UP_REWARD',
  INSUFFICIENT_CARE_ENERGY: 'INSUFFICIENT_CARE_ENERGY',
  FOUNDATION_LEGACY: 'FOUNDATION_LEGACY',
});

export const DEBIT_REASON_CODES = Object.freeze(['INTERNAL_TEST', 'COMPANION_UNLOCK', 'GARDEN_PLANT']);

export const ACTIVITY_SOURCE_TYPES = Object.freeze(['QUEST_COMPLETION', 'FOUNDATION_TEST', 'MOVEMENT_SESSION']);

export const WORLD_MAX_LEVEL = 50;
export const LEVEL_UP_CONNECTION_ENERGY = 5;
export const COMPLETION_RATIO_CAP_BPS = 10_000;

/**
 * Reward bands on normalized personal-goal completion (basis points).
 * Upper bound is exclusive except the 100% band.
 */
export const REWARD_BANDS = Object.freeze([
  { minBps: 0, maxBpsExclusive: 5_000, energy: 0, worldXp: 0, reasonCode: REASON_CODES.PERSONAL_GOAL_BELOW_HALF },
  { minBps: 5_000, maxBpsExclusive: 7_500, energy: 4, worldXp: 4, reasonCode: REASON_CODES.PERSONAL_GOAL_HALF_COMPLETE },
  { minBps: 7_500, maxBpsExclusive: 10_000, energy: 7, worldXp: 8, reasonCode: REASON_CODES.PERSONAL_GOAL_MOSTLY_COMPLETE },
  { minBps: 10_000, maxBpsExclusive: 10_001, energy: 10, worldXp: 12, reasonCode: REASON_CODES.PERSONAL_GOAL_COMPLETE },
]);

export const MEDI_WORLD_ECONOMY_V2 = Object.freeze({
  id: MEDI_WORLD_RULESET_ID,
  rulesetVersion: MEDI_WORLD_RULESET_VERSION,
  completionRatioCapBps: COMPLETION_RATIO_CAP_BPS,
  perEventEnergyCap: 10,
  perEventWorldXpCap: 12,
  dailyCategoryEnergyCap: 20,
  dailyWorldXpCap: 60,
  maxLevel: WORLD_MAX_LEVEL,
  levelUpConnectionEnergy: LEVEL_UP_CONNECTION_ENERGY,
  /** xpRequiredForNextLevel(L) = 100 + 25 * (L - 1) for L in 1..49 */
  levelBaseXp: 100,
  levelXpStep: 25,
  eligibleProgressStates: Object.freeze(['verified']),
  zeroRewardProgressStates: Object.freeze(['user_reported', 'estimated', 'pending', 'rejected']),
  activitySourceTypes: ACTIVITY_SOURCE_TYPES,
  rewardBands: REWARD_BANDS,
  reasonCodes: REASON_CODES,
});

export function xpRequiredForNextLevel(level) {
  const L = Math.floor(Number(level) || 0);
  if (L < 1 || L >= WORLD_MAX_LEVEL) return 0;
  return MEDI_WORLD_ECONOMY_V2.levelBaseXp + MEDI_WORLD_ECONOMY_V2.levelXpStep * (L - 1);
}

/** Cumulative lifetime XP required to *be* at level L (level 1 = 0). Integer only. */
export function cumulativeXpToReachLevel(level) {
  const L = Math.min(WORLD_MAX_LEVEL, Math.max(1, Math.floor(Number(level) || 1)));
  if (L <= 1) return 0;
  const n = L - 1;
  return 100 * n + 25 * Math.floor((n * (n - 1)) / 2);
}

export function worldProgressFromXp(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  let lo = 1;
  let hi = WORLD_MAX_LEVEL;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cumulativeXpToReachLevel(mid) <= xp) {
      level = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const levelStartXp = cumulativeXpToReachLevel(level);
  const span = xpRequiredForNextLevel(level);
  const xpIntoLevel = xp - levelStartXp;
  const atCap = level >= WORLD_MAX_LEVEL;
  const xpNeededForNextLevel = atCap ? 0 : Math.max(0, span - xpIntoLevel);
  const progressBps = atCap || span <= 0 ? 10_000 : Math.min(10_000, Math.floor((xpIntoLevel * 10_000) / span));
  return {
    worldLevel: level,
    level,
    worldXp: xp,
    totalXp: xp,
    levelStartXp,
    nextLevelXp: atCap ? xp : levelStartXp + span,
    xpIntoLevel,
    xpRequiredForNextLevel: span,
    xpNeededForNextLevel,
    progressBps,
    progressPercent: Math.min(100, Math.round(progressBps / 100)),
    atCap,
  };
}

export function bandForRatioBps(ratioBps) {
  if (!Number.isInteger(ratioBps)) {
    const error = new Error('completionRatioBps must be an integer.');
    error.status = 400;
    error.code = 'WORLD_INVALID_PROGRESS';
    throw error;
  }
  if (ratioBps < 0) {
    const error = new Error('completionRatioBps must be a non-negative integer.');
    error.status = 400;
    error.code = 'WORLD_INVALID_PROGRESS';
    throw error;
  }
  const ratio = Math.min(COMPLETION_RATIO_CAP_BPS, ratioBps);
  if (ratio >= COMPLETION_RATIO_CAP_BPS) return REWARD_BANDS[3];
  return REWARD_BANDS.find((band) => ratio >= band.minBps && ratio < band.maxBpsExclusive) || REWARD_BANDS[0];
}

export function isActivitySourceType(value) {
  return ACTIVITY_SOURCE_TYPES.includes(value);
}

export function levelUpIdempotencyKey(userId, level) {
  return `world-level-up:${userId}:${level}`;
}
