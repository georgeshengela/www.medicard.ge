import {
  JOURNEY_DAILY_UNITS,
  JOURNEY_MILESTONES,
  JOURNEY_THRESHOLDS,
  JOURNEY_WEEKLY_UNITS,
  milestonesAtOrBelow,
} from './catalog.js';

/**
 * Derive journeyProgress units from QuestCompletion rows.
 * Daily = 1, Weekly = 3. Claim state ignored. Achievements ignored.
 */
export function journeyUnitsFromCompletions(completions) {
  let units = 0;
  for (const row of completions || []) {
    const cadence = String(row?.userQuest?.template?.cadence || row?.cadence || 'DAILY').toUpperCase();
    units += cadence === 'WEEKLY' ? JOURNEY_WEEKLY_UNITS : JOURNEY_DAILY_UNITS;
  }
  return units;
}

export function resolveJourneyProgress(units) {
  const value = Math.max(0, Math.floor(Number(units) || 0));
  const unlocked = milestonesAtOrBelow(value);
  const current = unlocked.length ? unlocked[unlocked.length - 1] : null;
  const next = JOURNEY_MILESTONES.find((m) => m.at > value) || null;
  const chapterKey = current?.chapterKey || (next?.chapterKey || JOURNEY_MILESTONES[0].chapterKey);
  return {
    units: value,
    unlockedMilestoneKeys: unlocked.map((m) => m.key),
    currentMilestoneKey: current?.key || null,
    nextMilestoneKey: next?.key || null,
    nextAt: next?.at ?? null,
    chapterKey,
    completedAll: unlocked.length === JOURNEY_THRESHOLDS.length,
  };
}

/** Pure: which milestones should unlock for given units. */
export function milestonesToUnlock(units, alreadyUnlockedKeys = []) {
  const have = new Set(alreadyUnlockedKeys);
  return milestonesAtOrBelow(units).filter((m) => !have.has(m.key));
}
