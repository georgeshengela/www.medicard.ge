/**
 * Authoritative Medi Quest level curve. Mobile must never compute thresholds.
 *
 * Levels 1–20 are an exact table. Level L >= 21:
 *   increment from previous = 1700 + 100 * (L - 21)
 */
export const QUEST_LEVEL_1_20 = Object.freeze([
  0, 200, 450, 750, 1100, 1500, 1950, 2450, 3000, 3600, 4300, 5100, 6000, 7000, 8100, 9300, 10600,
  12000, 13500, 15100,
]);

export const QUEST_RANK_KEYS = Object.freeze([
  { max: 4, key: 'LEVEL_1_4' },
  { max: 9, key: 'LEVEL_5_9' },
  { max: 14, key: 'LEVEL_10_14' },
  { max: 19, key: 'LEVEL_15_19' },
  { max: 29, key: 'LEVEL_20_29' },
  { max: 39, key: 'LEVEL_30_39' },
  { max: 49, key: 'LEVEL_40_49' },
  { max: Infinity, key: 'LEVEL_50_PLUS' },
]);

export function getLevelRankKey(level) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  return QUEST_RANK_KEYS.find((band) => n <= band.max)?.key || 'LEVEL_50_PLUS';
}

export function getXpThresholdForLevel(level) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  if (n <= 20) return QUEST_LEVEL_1_20[n - 1];
  const extra = n - 20;
  let xp = QUEST_LEVEL_1_20[19];
  for (let step = 0; step < extra; step += 1) {
    xp += 1700 + 100 * step;
  }
  return xp;
}

export function getLevelForXp(totalXp) {
  return getLevelProgress(totalXp);
}

export function getLevelProgress(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  if (xp >= getXpThresholdForLevel(20)) {
    let candidate = 20;
    while (xp >= getXpThresholdForLevel(candidate + 1)) {
      candidate += 1;
    }
    level = candidate;
  } else {
    for (let n = 20; n >= 1; n -= 1) {
      if (xp >= getXpThresholdForLevel(n)) {
        level = n;
        break;
      }
    }
  }

  const levelStartXp = getXpThresholdForLevel(level);
  const nextThreshold = getXpThresholdForLevel(level + 1);
  const span = Math.max(1, nextThreshold - levelStartXp);
  const xpIntoLevel = xp - levelStartXp;
  const xpNeededForNextLevel = nextThreshold - xp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpIntoLevel / span) * 100)));

  return {
    level,
    totalXp: xp,
    levelStartXp,
    nextLevelXp: nextThreshold,
    xpIntoLevel,
    xpNeededForNextLevel,
    progressPercent,
    isMaxLevel: false,
    rankKey: getLevelRankKey(level),
    currentLevelXp: xpIntoLevel,
  };
}
