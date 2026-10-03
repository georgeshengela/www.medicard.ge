/**
 * Heavy / long bleeding signal (MEDICARD Cycle brief §9 item 15).
 *
 * Pure: reads only the dates and flows of logged days. The signal holds while the *current* bleeding
 * run — consecutive logged bleed days (light / medium / heavy) that reach today or ended yesterday —
 * either contains ≥ 3 consecutive days of heavy flow or is already longer than 7 days. Spotting, an
 * unlogged day or "none" ends a run; future dates and predicted days never count.
 *
 * The UI shows a calm card with ACOG's wording (soaking through a pad or tampon every hour for several
 * hours, clots larger than a coin, bleeding over 7 days → talk to a doctor). It is never a diagnosis
 * and never uses the danger colour.
 */

export const HEAVY_STREAK_DAYS = 3;
export const LONG_RUN_DAYS = 7;

export type BleedLogLike = { date: string; flow?: string | null };

export type HeavyBleedingSignal = {
  /** Whether the calm card should be shown. */
  show: boolean;
  /** Length of the current bleeding run in days (0 = no current run). */
  runDays: number;
  /** Longest streak of consecutive 'heavy' days inside the current run. */
  heavyStreak: number;
  /** Which rule fired (both → 'heavy'). */
  reason: 'heavy' | 'long' | null;
};

const NONE: HeavyBleedingSignal = { show: false, runDays: 0, heavyStreak: 0, reason: null };

function isBleed(flow: string | null | undefined): boolean {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The current bleeding run, read backwards from today (or yesterday, when today is not logged yet),
 * and the longest heavy streak inside it.
 */
export function heavyBleedingSignal(logs: ReadonlyArray<BleedLogLike>, today: string): HeavyBleedingSignal {
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return NONE;
  const flowByDate = new Map<string, string>();
  for (const log of logs) {
    if (!log || typeof log.date !== 'string' || log.date > today) continue;
    if (log.flow) flowByDate.set(log.date, log.flow);
  }
  const bleedOn = (key: string) => isBleed(flowByDate.get(key));

  let end: string | null = null;
  if (bleedOn(today)) end = today;
  else if (bleedOn(shiftKey(today, -1))) end = shiftKey(today, -1);
  if (!end) return NONE;

  let runDays = 0;
  let heavyStreak = 0;
  let streak = 0;
  let cursor = end;
  while (bleedOn(cursor)) {
    runDays += 1;
    if (flowByDate.get(cursor) === 'heavy') {
      streak += 1;
      if (streak > heavyStreak) heavyStreak = streak;
    } else {
      streak = 0;
    }
    cursor = shiftKey(cursor, -1);
    if (runDays > 400) break; // defensive: malformed history can never loop forever
  }

  const heavy = heavyStreak >= HEAVY_STREAK_DAYS;
  const long = runDays > LONG_RUN_DAYS;
  return { show: heavy || long, runDays, heavyStreak, reason: heavy ? 'heavy' : long ? 'long' : null };
}

/** Convenience for the screens: just the flag. */
export function showHeavyBleedingCard(logs: ReadonlyArray<BleedLogLike> | null | undefined, today: string): boolean {
  if (!logs?.length) return false;
  return heavyBleedingSignal(logs, today).show;
}

/**
 * The bleeding run a tapped calendar day belongs to (day sheet, brief §9 item 15): the day itself must
 * be a logged bleed day (light / medium / heavy, never after `today`), and the run is followed both
 * ways from it — so day 2 of a four-day heavy run already counts the two heavy days after it. Same
 * rule as the cycle screen: ≥ 3 consecutive heavy days or longer than 7 days.
 */
export function heavyBleedingSignalForDay(
  logs: ReadonlyArray<BleedLogLike> | null | undefined,
  date: string,
  today: string,
): HeavyBleedingSignal {
  if (!logs?.length || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return NONE;
  if (date > today) return NONE;
  const flowByDate = new Map<string, string>();
  for (const log of logs) {
    if (!log || typeof log.date !== 'string' || log.date > today) continue;
    if (log.flow) flowByDate.set(log.date, log.flow);
  }
  const bleedOn = (key: string) => key <= today && isBleed(flowByDate.get(key));
  if (!bleedOn(date)) return NONE;

  let start = date;
  for (let i = 0; i < 400 && bleedOn(shiftKey(start, -1)); i += 1) start = shiftKey(start, -1);
  let runDays = 0;
  let heavyStreak = 0;
  let streak = 0;
  for (let cursor = start; bleedOn(cursor) && runDays <= 400; cursor = shiftKey(cursor, 1)) {
    runDays += 1;
    if (flowByDate.get(cursor) === 'heavy') {
      streak += 1;
      if (streak > heavyStreak) heavyStreak = streak;
    } else {
      streak = 0;
    }
  }
  const heavy = heavyStreak >= HEAVY_STREAK_DAYS;
  const long = runDays > LONG_RUN_DAYS;
  return { show: heavy || long, runDays, heavyStreak, reason: heavy ? 'heavy' : long ? 'long' : null };
}
