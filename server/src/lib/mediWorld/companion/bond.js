/**
 * Canonical Bond ruleset: medi-world-bond-v1
 * Do not duplicate this formula on mobile.
 */

export const MEDI_WORLD_BOND_RULESET_ID = 'medi-world-bond-v1';
export const MEDI_WORLD_BOND_RULESET_VERSION = 1;
export const BOND_MAX_LEVEL = 20;
export const BOND_DAILY_REPEATABLE_CAP = 5;

export const BOND_REASON_CODES = Object.freeze({
  FIRST_VISIT: 'BOND_FIRST_VISIT',
  VERIFIED_GOAL: 'BOND_VERIFIED_GOAL',
  STAGE_UNLOCK: 'BOND_STAGE_UNLOCK',
  CARE_MOMENT: 'BOND_CARE_MOMENT',
});

export const BOND_REPEATABLE_REASONS = Object.freeze([
  BOND_REASON_CODES.FIRST_VISIT,
  BOND_REASON_CODES.VERIFIED_GOAL,
  BOND_REASON_CODES.CARE_MOMENT,
]);

export const BOND_POINTS = Object.freeze({
  FIRST_VISIT: 1,
  VERIFIED_GOAL: 2,
  STAGE_UNLOCK: 5,
  CARE_MOMENT: 1,
});

export function bondPointsRequiredForNextLevel(level) {
  const L = Math.floor(Number(level));
  if (!Number.isInteger(L) || L < 1) {
    const error = new Error('Invalid Bond level.');
    error.status = 400;
    error.code = 'WORLD_BOND_LEVEL';
    throw error;
  }
  if (L >= BOND_MAX_LEVEL) return 0;
  return 20 + 10 * (L - 1);
}

export function cumulativeBondToReachLevel(level) {
  const L = Math.max(1, Math.min(BOND_MAX_LEVEL, Math.floor(Number(level) || 1)));
  if (L <= 1) return 0;
  return 5 * (L - 1) * (L + 2);
}

export function bondProgressFromPoints(points) {
  const total = Math.max(0, Math.floor(Number(points) || 0));
  let level = 1;
  while (level < BOND_MAX_LEVEL && cumulativeBondToReachLevel(level + 1) <= total) {
    level += 1;
  }
  const levelStart = cumulativeBondToReachLevel(level);
  const nextCost = bondPointsRequiredForNextLevel(level);
  const into = total - levelStart;
  const atCap = level >= BOND_MAX_LEVEL;
  return {
    bondPoints: total,
    bondLevel: level,
    pointsIntoLevel: into,
    pointsRequiredForNextLevel: nextCost,
    pointsNeededForNextLevel: atCap ? 0 : Math.max(0, nextCost - into),
    progressPercent: atCap || nextCost <= 0 ? 100 : Math.min(100, Math.floor((into * 100) / nextCost)),
    atCap,
    rulesetId: MEDI_WORLD_BOND_RULESET_ID,
    rulesetVersion: MEDI_WORLD_BOND_RULESET_VERSION,
  };
}
