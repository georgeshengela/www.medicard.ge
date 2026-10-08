// MEDICARD web — default daily step goal = the person's own typical day (owner 2026-10-08; no fixed 10 000).
// Mirror of mobile/src/lib/personalStepsGoal.ts (mobile/src/lib/personalStepsGoal.test.ts runs both on
// one table): median of the last 14 completed days that have steps (at least 3 such days), rounded to
// the nearest 500, kept within 2 000–10 000; 4 000 until there is enough data. Today is left out.
// No imports: the node test loads this file.

export const STEPS_GOAL_FALLBACK = 4000;
export const STEPS_GOAL_FLOOR = 2000;
export const STEPS_GOAL_CEILING = 10000;
export const STEPS_GOAL_ROUND = 500;
export const STEPS_GOAL_WINDOW_DAYS = 14;
export const STEPS_GOAL_MIN_DAYS = 3;

/** Daily totals of the goal window (any order) → the goal. Missing, zero and invalid days do not count. */
export function personalStepsGoal(dailyTotals) {
  const days = (dailyTotals || [])
    .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (days.length < STEPS_GOAL_MIN_DAYS) return STEPS_GOAL_FALLBACK;
  const mid = Math.floor(days.length / 2);
  const median = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
  const rounded = Math.round(median / STEPS_GOAL_ROUND) * STEPS_GOAL_ROUND;
  return Math.min(STEPS_GOAL_CEILING, Math.max(STEPS_GOAL_FLOOR, rounded));
}

const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Local `YYYY-MM-DD` keys of the completed days before `now`, oldest first (today is not included). */
export function goalWindowKeys(now = new Date(), days = STEPS_GOAL_WINDOW_DAYS) {
  const keys = [];
  for (let i = days; i >= 1; i -= 1) keys.push(localYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  return keys;
}

/** Goal from the `/api/health-metrics/daily` rows (`{ date, steps }`). */
export function stepsGoalFromDaily(rows, now = new Date()) {
  const byDate = new Map();
  for (const row of rows || []) {
    const steps = Number(row?.steps);
    if (row?.date && Number.isFinite(steps)) byDate.set(String(row.date).slice(0, 10), steps);
  }
  return personalStepsGoal(goalWindowKeys(now).map((key) => byDate.get(key)));
}
