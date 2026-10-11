/**
 * Nightly sleep totals from Apple Health / Health Connect samples.
 *
 * Health keeps one night as many pieces: in-bed, awake and sleep-stage samples, often from two sources
 * at once (iPhone + Watch, two Android apps). Summing every piece counted a 7-hour night as 12–15 hours
 * (Medi's weekly report, 2026-10-11). Here only asleep time counts — in-bed time only for a day with no
 * asleep data — overlapping pieces count once, and a night belongs to the day you wake up (18:00 → 18:00).
 */

export type SleepPiece = { start: number; end: number; asleep: boolean };

const DAY_SHIFT_MS = 6 * 3_600_000;
const HOUR_MS = 3_600_000;

function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** First instant that counts for `day`: 18:00 the evening before. */
export function sleepDayStart(day: Date): Date {
  return new Date(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() - DAY_SHIFT_MS);
}

/** Read Health from here so the first day's night is complete (samples are clipped to the day anyway). */
export function sleepQueryStart(firstDay: Date): Date {
  return new Date(sleepDayStart(firstDay).getTime() - 12 * HOUR_MS);
}

function union(pieces: SleepPiece[]): { start: number; end: number }[] {
  const sorted = pieces.filter((p) => p.end > p.start).sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const piece of sorted) {
    const last = out[out.length - 1];
    if (last && piece.start <= last.end) last.end = Math.max(last.end, piece.end);
    else out.push({ start: piece.start, end: piece.end });
  }
  return out;
}

function hoursByDay(spans: { start: number; end: number }[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const span of spans) {
    let at = span.start;
    while (at < span.end) {
      const shifted = new Date(at + DAY_SHIFT_MS);
      const nextDay = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate() + 1).getTime() - DAY_SHIFT_MS;
      const stop = Math.min(span.end, nextDay);
      const day = ymd(at + DAY_SHIFT_MS);
      byDay.set(day, (byDay.get(day) ?? 0) + (stop - at) / HOUR_MS);
      at = stop;
    }
  }
  return byDay;
}

/** One point per wake-up day from `fromDay` (YYYY-MM-DD) on, hours rounded to 0.1. */
export function nightlySleepHours(pieces: SleepPiece[], fromDay: string): { date: string; value: number }[] {
  const asleep = hoursByDay(union(pieces.filter((p) => p.asleep)));
  const inBed = hoursByDay(union(pieces.filter((p) => !p.asleep)));
  return [...new Set([...asleep.keys(), ...inBed.keys()])]
    .filter((date) => date >= fromDay)
    .sort()
    .map((date) => ({ date, value: Math.min(24, Math.round((asleep.get(date) ?? inBed.get(date) ?? 0) * 10) / 10) }))
    .filter((point) => point.value > 0);
}
