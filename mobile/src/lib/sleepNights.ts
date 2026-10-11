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

/** One Health sample with its stage (MEDISLEEP keeps the stages; the daily total above does not need them). */
export type StagedSleepPiece = { start: number; end: number; stage: 'inBed' | 'awake' | 'asleep' | 'core' | 'deep' | 'rem' };

export type SleepNightDetail = {
  night: string;
  bedAt: string;
  wakeAt: string;
  asleepMinutes: number | null;
  awakeMinutes: number | null;
  deepMinutes: number | null;
  remMinutes: number | null;
  coreMinutes: number | null;
};

const MIN_MS = 60_000;
const minutesOf = (spans: { start: number; end: number }[]) => Math.round(spans.reduce((a, s) => a + (s.end - s.start), 0) / MIN_MS);

/**
 * MEDISLEEP's view of a Health night: the main sleep of each wake-up day (18:00 → 18:00) with its bed and wake
 * times and minutes per stage. Pieces more than two hours apart are separate sleeps; the one with the most
 * sleep is the night, so an afternoon nap never stretches the night to 14:00. Overlapping pieces from two
 * sources count once (per stage). Nights without any asleep sample keep only their in-bed times.
 */
export function sleepNightDetails(pieces: StagedSleepPiece[], fromDay: string): SleepNightDetail[] {
  const valid = pieces.filter((p) => p.end > p.start && p.end - p.start < 20 * HOUR_MS).sort((a, b) => a.start - b.start);
  const clusters: StagedSleepPiece[][] = [];
  let reach = -Infinity;
  for (const piece of valid) {
    if (!clusters.length || piece.start > reach + 2 * HOUR_MS) {
      clusters.push([piece]);
      reach = piece.end;
    } else {
      clusters[clusters.length - 1].push(piece);
      reach = Math.max(reach, piece.end);
    }
  }
  const best = new Map<string, { detail: SleepNightDetail; weight: number }>();
  for (const cluster of clusters) {
    const start = Math.min(...cluster.map((p) => p.start));
    const end = Math.max(...cluster.map((p) => p.end));
    const night = ymd(end + DAY_SHIFT_MS);
    if (night < fromDay) continue;
    const of = (stages: StagedSleepPiece['stage'][]) => union(cluster.filter((p) => stages.includes(p.stage)).map((p) => ({ ...p, asleep: true })));
    const asleep = of(['asleep', 'core', 'deep', 'rem']);
    const asleepMinutes = asleep.length ? minutesOf(asleep) : null;
    const staged = cluster.some((p) => p.stage === 'core' || p.stage === 'deep' || p.stage === 'rem');
    const detail: SleepNightDetail = {
      night,
      bedAt: new Date(start).toISOString(),
      wakeAt: new Date(end).toISOString(),
      asleepMinutes,
      awakeMinutes: staged ? minutesOf(of(['awake'])) : null,
      deepMinutes: staged ? minutesOf(of(['deep'])) : null,
      remMinutes: staged ? minutesOf(of(['rem'])) : null,
      coreMinutes: staged ? minutesOf(of(['core'])) : null,
    };
    const weight = asleepMinutes ?? (end - start) / MIN_MS / 10;
    const current = best.get(night);
    if (!current || weight > current.weight) best.set(night, { detail, weight });
  }
  return [...best.values()].map((b) => b.detail).sort((a, b) => a.night.localeCompare(b.night));
}
