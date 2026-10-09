/**
 * Default daily step goal = one small step above the person's own typical day (owner 2026-10-08;
 * replaces the fixed 10 000). Median of the last 14 completed days that have steps (at least 3 such
 * days), rounded to the nearest 500, plus 500, kept within 2 000–10 000; 4 000 until there is enough
 * data. Today is left out: a half-finished day would pull the median down and move the goal while the
 * person walks. The +500 makes it a reachable stretch, not a copy of the usual day (strategy deck P4).
 * The goal wizard (`stepsGoal.ts`), MEDIQUEST's adaptive target and MEDIRUN presets are separate.
 * Pure (node tests load this file). Web mirror: server/public/app/js/stepsGoal.js — the test runs both.
 */

export const STEPS_GOAL_FALLBACK = 4_000;
export const STEPS_GOAL_FLOOR = 2_000;
export const STEPS_GOAL_CEILING = 10_000;
export const STEPS_GOAL_ROUND = 500;
/** Added to the rounded typical day — a reachable stretch above it. */
export const STEPS_GOAL_STRETCH = 500;
export const STEPS_GOAL_WINDOW_DAYS = 14;
export const STEPS_GOAL_MIN_DAYS = 3;

/** Daily totals of the goal window (any order) → the goal. Missing, zero and invalid days do not count. */
export function personalStepsGoal(dailyTotals: ReadonlyArray<number | null | undefined>): number {
  const days = dailyTotals
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (days.length < STEPS_GOAL_MIN_DAYS) return STEPS_GOAL_FALLBACK;
  const mid = Math.floor(days.length / 2);
  const median = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
  const rounded = Math.round(median / STEPS_GOAL_ROUND) * STEPS_GOAL_ROUND + STEPS_GOAL_STRETCH;
  return Math.min(STEPS_GOAL_CEILING, Math.max(STEPS_GOAL_FLOOR, rounded));
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local `YYYY-MM-DD` keys of the completed days before `now`, oldest first (today is not included). */
export function goalWindowKeys(now = new Date(), days = STEPS_GOAL_WINDOW_DAYS): string[] {
  const keys: string[] = [];
  for (let i = days; i >= 1; i -= 1) keys.push(localYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  return keys;
}

/**
 * Goal from per-day totals (`YYYY-MM-DD` → steps). Several sources (server rows, the phone's own
 * samples) → the larger value of each day wins, like the steps screen's merge.
 */
export function personalStepsGoalFor(
  sources: ReadonlyArray<ReadonlyMap<string, number> | Readonly<Record<string, number>>>,
  now = new Date(),
): number {
  const read = (source: ReadonlyMap<string, number> | Readonly<Record<string, number>>, key: string): number => {
    const value = source instanceof Map ? source.get(key) : (source as Readonly<Record<string, number>>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };
  return personalStepsGoal(goalWindowKeys(now).map((key) => Math.max(0, ...sources.map((source) => read(source, key)))));
}
