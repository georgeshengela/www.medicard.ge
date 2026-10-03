/**
 * Pure helpers for the women's Home cycle sections (hero ring, week strip, actions, stats, tips).
 *
 * No React Native and no `@/` value imports, so node tests load it. Every rule here mirrors the
 * cycle screen (`app/cycle/index.tsx`, `CycleHero`, `CycleStatusGauge`, `CycleDayStrip`,
 * `CycleStatsCard`) — the Home only shows less of it, never something the cycle screen would hide.
 * Eligibility flags (forecast / fertility / contraception / mode) are computed by the caller with
 * the real helpers and passed in as booleans.
 */
import { classifyCycleDay, mergeLoggedFlowOntoMarks } from '../cyclePresentation.js';
import type { CycleAverages, CycleDayMark } from '@/lib/api';

// ---------- civil dates (YYYY-MM-DD, no timezone shift — same math as src/lib/cyclePhase.ts) ----------

function utc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysKey(key: string, delta: number): string {
  const dt = new Date(utc(key));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round((utc(toKey) - utc(fromKey)) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday (WEEKDAYS_KA order). */
export function weekdayIndex(key: string): number {
  return (new Date(utc(key)).getUTCDay() + 6) % 7;
}

// ---------- ring ----------

export type RingPhaseKind = 'period' | 'follicular' | 'fertile' | 'luteal';

/** Degrees clockwise from 12 o'clock (0…360). `livedTo` = end of the full-colour part, null = all ahead. */
export type RingArc = { kind: RingPhaseKind; from: number; to: number; livedTo: number | null };

export type CycleRingModel = {
  /** Days around the ring (a late cycle grows the ring instead of wrapping today onto day 1). */
  count: number;
  arcs: RingArc[];
  /** Centre of today's slot; null when the day is unknown or the length is hidden. */
  todayDeg: number | null;
};

const MIN_ARC_DEG = 0.2;

/**
 * Phase arcs for the static Home ring — the same phase runs as the cycle dial
 * (`CycleStatusGauge`): bleeding (logged days when present, else the usual length) → follicular →
 * fertile window → luteal. Without a visible fertile window everything after bleeding is follicular,
 * exactly like the dial. `capDeg` pulls each end in so round caps leave a small gap.
 */
export function cycleRingModel({
  day,
  cycleLength,
  periodLength = 5,
  recordedPeriodDays = [],
  fertileDays = null,
  hideLengthChrome = false,
  capDeg = 0,
}: {
  day: number | null;
  cycleLength: number;
  periodLength?: number;
  recordedPeriodDays?: number[];
  fertileDays?: { from: number; to: number } | null;
  hideLengthChrome?: boolean;
  capDeg?: number;
}): CycleRingModel {
  const length = hideLengthChrome ? 0 : Math.max(14, Math.round(cycleLength) || 28);
  if (!length) return { count: 28, arcs: [], todayDeg: null };
  const count = Math.max(length, day ?? 0);
  const early = recordedPeriodDays.filter((d) => d <= 12);
  const loggedMax = early.length ? Math.max(...early) : 0;
  const periodEnd = Math.max(1, Math.min(loggedMax || periodLength, count));
  const fStart = fertileDays ? Math.min(fertileDays.from, fertileDays.to) : null;
  const fEnd = fertileDays ? Math.max(fertileDays.from, fertileDays.to) : null;
  const phases: { kind: RingPhaseKind; from: number; to: number }[] = [{ kind: 'period', from: 1, to: periodEnd }];
  if (fStart != null && fEnd != null && fStart > periodEnd) {
    if (fStart - 1 > periodEnd) phases.push({ kind: 'follicular', from: periodEnd + 1, to: fStart - 1 });
    phases.push({ kind: 'fertile', from: fStart, to: Math.min(fEnd, count) });
    if (fEnd < count) phases.push({ kind: 'luteal', from: fEnd + 1, to: count });
  } else if (periodEnd < count) {
    phases.push({ kind: 'follicular', from: periodEnd + 1, to: count });
  }

  const slot = (pos: number) => (pos / count) * 360;
  const arcs: RingArc[] = [];
  for (const p of phases) {
    const from = slot(p.from - 1) + capDeg;
    const to = slot(p.to) - capDeg;
    if (to - from <= MIN_ARC_DEG) continue;
    let livedTo: number | null = null;
    if (day != null && day >= p.from) {
      const end = Math.min(to, slot(Math.min(day, p.to)) - capDeg);
      livedTo = end - from > MIN_ARC_DEG ? end : null;
    }
    arcs.push({ kind: p.kind, from, to, livedTo });
  }
  return { count, arcs, todayDeg: day != null && day > 0 ? slot(day - 0.5) : null };
}

/** The estimated fertile window as cycle days of this cycle, clipped to its edges (CycleHero overlays). */
export function fertileDaysInCycle({
  today,
  day,
  cycleLength,
  window,
}: {
  today: string;
  day: number | null;
  cycleLength: number;
  /** Pass null when fertility marks or forecasts are not allowed. */
  window: { start: string; end: string } | null | undefined;
}): { from: number; to: number } | null {
  if (!window || day == null || day <= 0 || !cycleLength) return null;
  const cycleStart = addDaysKey(today, -(day - 1));
  const from = Math.max(1, daysBetweenKeys(cycleStart, window.start) + 1);
  const to = Math.min(cycleLength, daysBetweenKeys(cycleStart, window.end) + 1);
  return from <= to ? { from, to } : null;
}

/** Logged bleeding days of the current cycle as cycle-day numbers (dial's rose ticks / arc). */
export function recordedPeriodDaysInCycle({
  today,
  day,
  cycleLength,
  bleedDates,
}: {
  today: string;
  day: number | null;
  cycleLength: number;
  bleedDates: string[];
}): number[] {
  if (day == null || day <= 0) return [];
  const cycleStart = addDaysKey(today, -(day - 1));
  const max = Math.max(cycleLength, day);
  return bleedDates.map((date) => daysBetweenKeys(cycleStart, date) + 1).filter((d) => d >= 1 && d <= max);
}

// ---------- centre number and actions (CycleHero grammar) ----------

export type CycleCenter =
  | { kind: 'periodDay'; day: number | null }
  | { kind: 'periodToday' }
  | { kind: 'countdown'; days: number }
  /** Variable cycles (`isIrregular`): the period is expected between `from` and `to` days from today (both ≥ 1). */
  | { kind: 'countdownRange'; from: number; to: number }
  /** Variable cycles: the expected window already includes today and stays open for `to` more days (≥ 0). */
  | { kind: 'windowOpen'; to: number }
  | { kind: 'late'; day: number; lateBy: number }
  | { kind: 'cycleDay'; day: number | null; length: number | null }
  | { kind: 'none' };

/** Days before / after the server's single estimate that the period may realistically start. */
export type CycleSpread = { before: number; after: number };

/** With no history to measure, a variable cycle is shown as ± this many days (brief §9 item 12, Flo's rule). */
export const IRREGULAR_DEFAULT_SPREAD = 3;
/** A spread wider than this is „ვსწავლობთ“ territory — the window never grows past ± a week. */
export const IRREGULAR_MAX_SPREAD = 7;

/**
 * How far the period may move around the server's estimate when the person said her cycles vary
 * (`profile.isIrregular`). The server keeps one date (the forecast engine is unchanged), so the app
 * widens it from her own last cycles: shortest → days before, longest → days after, each at least one
 * day (a single confident date is never shown for a variable cycle) and at most a week. With fewer
 * than two completed cycles it is ± 3 days. Regular cycles return null and keep the single date.
 */
export function cycleSpreadModel({
  isIrregular,
  usedCycleLength,
  cycleLengths,
  nextPeriodStart = null,
  serverRange = null,
}: {
  isIrregular: boolean | null | undefined;
  usedCycleLength: number | null | undefined;
  cycleLengths: { length: number | null }[] | null | undefined;
  /** The server's single estimate, to place its window around (`predictions.nextPeriodStart`). */
  nextPeriodStart?: string | null;
  /** `predictions.nextPeriodRange` — the server's window wins (also for a regular-flag spread ≥ 8 days). */
  serverRange?: { from: string; to: string } | null;
}): CycleSpread | null {
  if (serverRange?.from && serverRange?.to && nextPeriodStart) {
    return {
      before: Math.max(0, daysBetweenKeys(serverRange.from, nextPeriodStart)),
      after: Math.max(0, daysBetweenKeys(nextPeriodStart, serverRange.to)),
    };
  }
  if (!isIrregular) return null;
  const lengths = (cycleLengths ?? [])
    .map((x) => x.length)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
    .slice(-6);
  if (lengths.length < 2) return { before: IRREGULAR_DEFAULT_SPREAD, after: IRREGULAR_DEFAULT_SPREAD };
  const used = Math.round(usedCycleLength ?? 0) || 28;
  const clamp = (n: number) => Math.min(IRREGULAR_MAX_SPREAD, Math.max(1, Math.round(n)));
  return { before: clamp(used - Math.min(...lengths)), after: clamp(Math.max(...lengths) - used) };
}

/** A variable cycle's whole window as dates, and where today sits in it. */
export type CyclePeriodWindow = {
  /** First and last day the period may start (the server's `nextPeriodRange.from` / `.to`). */
  from: string;
  to: string;
  /** `before` = still ahead, `open` = today is inside it, `late` = the whole window has passed. */
  state: 'before' | 'open' | 'late';
  /** Days from today to the window's first day (0 once open). */
  startsIn: number;
  /** Days after today the window stays open (0 on its last day, and once late). */
  daysLeft: number;
};

/**
 * The window every surface prints (Home glow, „წინ რა გელის“, the /cycle badge, the calendar caption,
 * the portal): always the full range around the estimate — `spread` comes from the server's
 * `nextPeriodRange` — never „from the single estimate to the window's end“, which under-stated an open
 * window (the ring said „დღეს“ while the badge started days later). Null without a window.
 */
export function cyclePeriodWindow({
  today,
  nextPeriodStart,
  spread,
}: {
  today: string;
  nextPeriodStart: string | null | undefined;
  spread: CycleSpread | null | undefined;
}): CyclePeriodWindow | null {
  if (!spread || !nextPeriodStart) return null;
  const from = addDaysKey(nextPeriodStart, -spread.before);
  const to = addDaysKey(nextPeriodStart, spread.after);
  const startsIn = daysBetweenKeys(today, from);
  const left = daysBetweenKeys(today, to);
  const state = startsIn > 0 ? 'before' : left >= 0 ? 'open' : 'late';
  return { from, to, state, startsIn: Math.max(0, startsIn), daysLeft: Math.max(0, left) };
}

/**
 * One number in the ring: bleeding day → „დღეს“ → countdown („სავარაუდოდ“) → cycle day.
 * With a `spread` (variable cycles) the countdown becomes a window — „3–7 დღე“, or „დღეს ან მომდევნო
 * N დღეში“ once the window has opened — and „late“ only begins after the whole window has passed.
 */
export function cycleCenter({
  hideLengthChrome,
  hidePredicted,
  onPeriod,
  predictedToday,
  forecastOn,
  inDays,
  day,
  cycleLength,
  spread = null,
}: {
  hideLengthChrome: boolean;
  hidePredicted: boolean;
  onPeriod: boolean;
  predictedToday: boolean;
  forecastOn: boolean;
  inDays: number | null;
  day: number | null;
  cycleLength: number;
  spread?: CycleSpread | null;
}): CycleCenter {
  if (hideLengthChrome) return { kind: 'none' };
  if (onPeriod) return { kind: 'periodDay', day };
  if (spread && forecastOn && !hidePredicted && inDays != null) {
    const to = inDays + spread.after;
    const from = inDays - spread.before;
    // The calendar already paints today as an expected period day: the window is open now.
    if (predictedToday) return { kind: 'windowOpen', to: Math.max(0, to) };
    if (to >= 0) return from <= 0 ? { kind: 'windowOpen', to } : { kind: 'countdownRange', from, to };
    // The whole window has passed: fall through to „late“ (counted from the estimate, like the alerts banner).
  }
  if (!hidePredicted && (predictedToday || (forecastOn && inDays === 0))) return { kind: 'periodToday' };
  if (forecastOn && inDays != null && inDays > 0) return { kind: 'countdown', days: inDays };
  if (forecastOn && inDays != null && inDays < 0 && day != null) return { kind: 'late', day, lateBy: -inDays };
  return { kind: 'cycleDay', day, length: Math.max(14, Math.round(cycleLength) || 28) };
}

/** „მენსტრუაცია დაიწყო“ leads when it is plausible soon, or the rhythm is unknown / late (CycleHero). */
export function startLeads({
  onPeriod,
  forecastOn,
  predictedToday,
  inDays,
}: {
  onPeriod: boolean;
  forecastOn: boolean;
  predictedToday: boolean;
  inDays: number | null;
}): boolean {
  return !onPeriod && (!forecastOn || predictedToday || (inDays != null && inDays <= 3));
}

export type CycleHeroActionId = 'start' | 'end' | 'log' | 'logFlow';

/**
 * Filled + tonal buttons. On the period: „დასრულება“ leads except on day 1 (ending day 1 would
 * erase the start — undo lives in the toast), where today's flow is the only action.
 */
export function cycleHeroActions({
  onPeriod,
  dayOne,
  leadsWithStart,
}: {
  onPeriod: boolean;
  dayOne: boolean;
  leadsWithStart: boolean;
}): { primary: CycleHeroActionId; secondary: CycleHeroActionId | null } {
  if (onPeriod) return dayOne ? { primary: 'logFlow', secondary: null } : { primary: 'end', secondary: 'log' };
  return leadsWithStart ? { primary: 'start', secondary: 'log' } : { primary: 'log', secondary: 'start' };
}

export type CycleHeroVariant =
  | 'lockUnknown'
  | 'locked'
  | 'loading'
  | 'failed'
  | 'setup'
  | 'pregnancy'
  | 'postpartum'
  | 'peri'
  /** „მენსტრუაციას არ ველი“ (brief §9 wave 2 item 17): today's date, „როგორ ხარ დღეს?“, log. */
  | 'tracking'
  | 'cycle';

/** Which hero to draw. The privacy lock wins over everything (fail-closed while unknown). */
export function cycleHeroVariant({
  locked,
  hasView,
  failed,
  setupNeeded,
  pregnancy,
  postpartum,
  peri,
  tracking = false,
}: {
  locked: boolean | null;
  hasView: boolean;
  failed: boolean;
  setupNeeded: boolean;
  pregnancy: boolean;
  postpartum: boolean;
  peri: boolean;
  /** Tracking (TRACK_PERIOD + expectsBleeding false) — never asks for a last period. */
  tracking?: boolean;
}): CycleHeroVariant {
  if (locked === null) return 'lockUnknown';
  if (locked) return 'locked';
  if (!hasView) return failed ? 'failed' : 'loading';
  if (pregnancy) return 'pregnancy';
  if (postpartum) return 'postpartum';
  if (peri) return 'peri';
  if (tracking) return 'tracking';
  if (setupNeeded) return 'setup';
  return 'cycle';
}

// ---------- week strip ----------

export type StripDay = {
  key: string;
  dayOfMonth: number;
  weekday: number;
  today: boolean;
  loggedPeriod: boolean;
  spotting: boolean;
  predictedPeriod: boolean;
  fertile: boolean;
  ovulation: boolean;
};

/**
 * Seven days −3…+3 in the cycle grammar. Only bleeding and estimate layers come out — never sex,
 * BBT, tests or "something logged" dots (those are private and stay inside /cycle).
 */
export function cycleWeekStrip({
  today,
  calendar,
  bleedLogs,
  showFertility,
  showOvulation,
  showPredicted,
}: {
  today: string;
  calendar: Record<string, CycleDayMark> | null | undefined;
  /** Only date + flow are read. */
  bleedLogs: { date: string; flow?: string | null }[];
  showFertility: boolean;
  showOvulation: boolean;
  showPredicted: boolean;
}): StripDay[] {
  const marks = mergeLoggedFlowOntoMarks(calendar ?? {}, bleedLogs) as Record<string, CycleDayMark>;
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDaysKey(today, i - 3);
    const layers = classifyCycleDay(marks[key], { showFertility, showPredicted });
    const ovulation = layers.ovulation && showOvulation;
    return {
      key,
      dayOfMonth: Number(key.slice(8, 10)),
      weekday: weekdayIndex(key),
      today: key === today,
      loggedPeriod: layers.loggedPeriod,
      spotting: layers.spotting,
      predictedPeriod: layers.predictedPeriod,
      // An ovulation day whose date may not be shown still sits inside the fertile window.
      fertile: layers.fertile || (layers.ovulation && !showOvulation),
      ovulation,
    };
  });
}

// ---------- my cycle stats (CycleStatsCard math) ----------

/** Typical adult ranges shown as reference, never as a diagnosis (ACOG: cycle 21–35, bleeding 2–7). */
export const TYPICAL_RANGES = { cycle: [21, 35], period: [2, 7], variation: 7 } as const;

/** `learning`: a number is shown, the verdict waits for 3 completed cycles (brief §9 item 13). */
export type StatTone = 'typical' | 'longer' | 'shorter' | 'variable' | 'unknown' | 'learning';
export type CycleStat = { value: number | null; tone: StatTone };
export type CycleStatsModel = {
  cycleCount: number;
  cycle: CycleStat;
  period: CycleStat;
  variation: CycleStat;
  /** Set while verdicts wait: „ვსწავლობთ · N/3“. */
  learning?: { done: number; required: number } | null;
};

/** Completed cycles before „✓ ტიპური“ and the other verdicts (same as the fertility gate). */
export const STATS_VERDICT_MIN_CYCLES = 3;

const rangeTone = (v: number | null, [lo, hi]: readonly [number, number]): StatTone =>
  v == null ? 'unknown' : v < lo ? 'shorter' : v > hi ? 'longer' : 'typical';

/**
 * Stats only from a real pattern: an inferred average over at least 2 cycles. Settings defaults
 * (a new user's 28 / 5) never show up as „ტიპური“ on Home. `eligible` = classic overview mode and
 * the cycle length is not suppressed (same gate as the cycle screen).
 */
export function cycleStatsModel({
  eligible,
  averages,
  cycleLengths,
}: {
  eligible: boolean;
  averages: Pick<CycleAverages, 'usedCycleLength' | 'usedPeriodLength' | 'source' | 'cycleCount'> | null | undefined;
  cycleLengths: { length: number }[] | null | undefined;
}): CycleStatsModel | null {
  if (!eligible || !averages) return null;
  if (averages.source !== 'inferred' || (averages.cycleCount ?? 0) < 2) return null;
  const cycle = averages.usedCycleLength ?? null;
  const period = averages.usedPeriodLength ?? null;
  if (cycle == null && period == null) return null;
  const lengths = (cycleLengths ?? []).map((x) => x.length).filter((n) => Number.isFinite(n)).slice(-6);
  const variation = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  const count = averages.cycleCount ?? 0;
  if (count < STATS_VERDICT_MIN_CYCLES) {
    // Numbers only: two cycles are too few to call anything „ტიპური“ or „ცვალებადი“.
    const learn = (value: number | null): CycleStat => ({ value, tone: value == null ? 'unknown' : 'learning' });
    return {
      cycleCount: count,
      cycle: learn(cycle),
      period: learn(period),
      variation: learn(variation),
      learning: { done: count, required: STATS_VERDICT_MIN_CYCLES },
    };
  }
  return {
    cycleCount: count,
    cycle: { value: cycle, tone: rangeTone(cycle, TYPICAL_RANGES.cycle) },
    period: { value: period, tone: rangeTone(period, TYPICAL_RANGES.period) },
    variation: {
      value: variation,
      tone: variation == null ? 'unknown' : variation <= TYPICAL_RANGES.variation ? 'typical' : 'variable',
    },
  };
}

/** One bar per completed cycle for the „ჩემი ციკლი“ chart: newest last, heights relative to the longest. */
export type CycleBar = { start: string; length: number; ratio: number; latest: boolean };

/**
 * The last completed cycles as bars (the same six the variation is computed from). Heights start
 * from a floor so a 27- and a 29-day cycle still read as different, never as "tiny vs huge".
 */
export function cycleBarsModel(
  cycleLengths: { start?: string; length: number }[] | null | undefined,
  limit = 6,
): CycleBar[] {
  const rows = (cycleLengths ?? []).filter((x) => Number.isFinite(x.length) && x.length > 0).slice(-limit);
  if (rows.length < 2) return [];
  const lengths = rows.map((x) => x.length);
  const max = Math.max(...lengths);
  const min = Math.min(...lengths);
  // Zoomed scale: the shortest cycle keeps 55 % of the height, the longest fills it.
  const span = Math.max(1, max - min);
  return rows.map((x, i) => ({
    start: x.start ?? '',
    length: x.length,
    ratio: max === min ? 0.8 : 0.55 + 0.45 * ((x.length - min) / span),
    latest: i === rows.length - 1,
  }));
}

// ---------- what's ahead ----------

export type AheadKind = 'period' | 'fertile' | 'ovulation';

/**
 * `inDays` 0 = today; `ongoing` = a window that already started (fertile days, the ovulation band, a
 * variable period's window). `wide` = the trying-to-conceive window before 3 cycles.
 */
export type AheadEvent = { kind: AheadKind; start: string; end: string | null; inDays: number; ongoing: boolean; wide?: boolean };

type AheadPhase = {
  periodStart: string;
  periodEnd: string;
  ovulation: string | null;
  ovulationStart?: string | null;
  ovulationEnd?: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
  fertileWindowKind?: 'standard' | 'wide' | null;
};

/** Ovulation is a 3-day band (brief §8.2 item 5): centre ± this many days when the server sent no band. */
export const OVULATION_BAND_HALF_DAYS = 1;

/**
 * „წინ რა გელის“ — the next estimated period, fertile window and ovulation, soonest first.
 * Everything here is an estimate from `predictions.phases`; the caller passes the same gates the
 * cycle screen uses (forecast allowed, fertility / ovulation visible) and nothing shows without them.
 * A late period is never replaced by the cycle after it (the hero says „გვიანია“ instead).
 */
export function cycleAheadModel({
  today,
  phases,
  nextPeriodStart,
  nextPeriodEnd,
  nextPeriodRange = null,
  onPeriod,
  showPeriod,
  showFertility,
  showOvulation,
  horizonDays = 45,
}: {
  today: string;
  phases: AheadPhase[] | null | undefined;
  nextPeriodStart: string | null | undefined;
  nextPeriodEnd?: string | null;
  /** Variable cycles: the period row spans the server's window and is late only after its end. */
  nextPeriodRange?: { from: string; to: string } | null;
  onPeriod: boolean;
  showPeriod: boolean;
  showFertility: boolean;
  showOvulation: boolean;
  horizonDays?: number;
}): AheadEvent[] {
  const list = phases ?? [];
  const events: AheadEvent[] = [];
  const within = (key: string) => daysBetweenKeys(today, key) <= horizonDays;

  const range = nextPeriodRange?.from && nextPeriodRange?.to && nextPeriodStart ? nextPeriodRange : null;
  if (showPeriod && range && !onPeriod) {
    // Inside the window: „ახლა“ until its last day; after that the hero carries „გვიანია“.
    if (daysBetweenKeys(today, range.to) >= 0 && within(range.from)) {
      const toStart = daysBetweenKeys(today, range.from);
      events.push({ kind: 'period', start: range.from, end: range.to, inDays: Math.max(0, toStart), ongoing: toStart <= 0 });
    }
  } else if (showPeriod) {
    const late = Boolean(nextPeriodStart) && daysBetweenKeys(today, nextPeriodStart as string) < 0;
    if (!late) {
      // While bleeding, "next" is the period after this one.
      const fromPhases = list.find((p) => daysBetweenKeys(today, p.periodStart) > (onPeriod ? 0 : -1));
      const useNext = Boolean(nextPeriodStart) && (!onPeriod || daysBetweenKeys(today, nextPeriodStart as string) > 0);
      const start = useNext ? (nextPeriodStart as string) : (fromPhases?.periodStart ?? null);
      const end = useNext ? (nextPeriodEnd ?? null) : (fromPhases?.periodEnd ?? null);
      if (start && within(start)) events.push({ kind: 'period', start, end, inDays: daysBetweenKeys(today, start), ongoing: false });
    }
  }
  if (showFertility) {
    // The 3-cycle gate sends cycles without a window (null) — those are skipped, never guessed.
    const win = list.find((p) => p.fertileStart && p.fertileEnd && daysBetweenKeys(today, p.fertileEnd) >= 0);
    if (win?.fertileStart && win.fertileEnd && within(win.fertileStart)) {
      const toStart = daysBetweenKeys(today, win.fertileStart);
      events.push({
        kind: 'fertile',
        start: win.fertileStart,
        end: win.fertileEnd,
        inDays: Math.max(0, toStart),
        ongoing: toStart <= 0,
        ...(win.fertileWindowKind === 'wide' ? { wide: true } : {}),
      });
    }
  }
  if (showFertility && showOvulation) {
    // Ovulation as a 3-day band, never one day.
    const bandOf = (p: AheadPhase) =>
      p.ovulation
        ? {
            start: p.ovulationStart ?? addDaysKey(p.ovulation, -OVULATION_BAND_HALF_DAYS),
            end: p.ovulationEnd ?? addDaysKey(p.ovulation, OVULATION_BAND_HALF_DAYS),
          }
        : null;
    const next = list.map(bandOf).find((band) => band && daysBetweenKeys(today, band.end) >= 0);
    if (next && within(next.start)) {
      const toStart = daysBetweenKeys(today, next.start);
      events.push({ kind: 'ovulation', start: next.start, end: next.end, inDays: Math.max(0, toStart), ongoing: toStart <= 0 });
    }
  }
  return events.sort((a, b) => a.inDays - b.inDays || utc(a.start) - utc(b.start));
}

// ---------- daily tips ----------

/**
 * The tips row shows the everyday DAILY_TIPS cards only (`tip_*` from buildCycleAdvice): no
 * condition cards (PCOS, endometriosis…) and no log-driven cards at a glance.
 */
export function homeTipCards<T extends { id: string }>(cards: T[], limit = 3): T[] {
  return cards.filter((card) => card.id.startsWith('tip_')).slice(0, limit);
}

/**
 * Same gate as the cycle screen's tips panel (classic overview + forecast allowed), plus phase as
 * biology (hormonal contraception), a set-up cycle and a known phase.
 */
export function cycleTipsAllowed({
  locked,
  classicOverview,
  forecastAllowed,
  phaseBiological,
  setupNeeded,
  phase,
}: {
  locked: boolean | null;
  classicOverview: boolean;
  forecastAllowed: boolean;
  phaseBiological: boolean;
  setupNeeded: boolean;
  phase: string;
}): boolean {
  return locked === false && classicOverview && forecastAllowed && phaseBiological && !setupNeeded && phase !== 'unknown';
}

// ---------- Tracking (brief §9 wave 2 item 17) ----------

const TRACKING_BLEED_FLOWS = new Set(['light', 'medium', 'heavy']);

/**
 * Tracking hero actions: the day's log leads; beside it „ახალი ციკლის დაწყება“ (a spotting or
 * withdrawal bleed — logged, never a forecast) or, on a bleeding day, „დასრულება“.
 */
export function trackingHeroActions({ bleedingToday }: { bleedingToday: boolean }): {
  primary: 'log';
  secondary: 'newCycle' | 'end';
} {
  return { primary: 'log', secondary: bleedingToday ? 'end' : 'newCycle' };
}

/**
 * The Tracking ring on /cycle: the last `days` days (position `days` = today, at 12 o'clock's left
 * edge): logged bleeding fills its slot in rose, spotting is a rose dot, any other logged day a muted dot
 * (the calendar's grammar). Nothing estimated.
 */
export function trackingRingDays({
  today,
  logs,
  days = 28,
}: {
  today: string;
  logs: { date: string; flow?: string | null }[] | null | undefined;
  days?: number;
}): { days: number; bleed: number[]; spotting: number[]; logged: number[] } {
  const bleed = new Set<number>();
  const spotting = new Set<number>();
  const logged = new Set<number>();
  for (const log of logs ?? []) {
    if (!log?.date) continue;
    const back = daysBetweenKeys(log.date, today);
    if (back < 0 || back >= days) continue;
    const pos = days - back;
    if (TRACKING_BLEED_FLOWS.has(String(log.flow ?? ''))) bleed.add(pos);
    else if (log.flow === 'spotting') spotting.add(pos);
    else logged.add(pos);
  }
  const sort = (set: Set<number>) => [...set].sort((a, b) => a - b);
  return { days, bleed: sort(bleed), spotting: sort(spotting), logged: sort(logged) };
}
