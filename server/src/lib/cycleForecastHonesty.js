/**
 * Forecast honesty (brief §1 point 6, §8.2 item 5, §9 wave 2 items 12–13).
 *
 * Pure rules the prediction engine (`buildPredictions`) applies, so every consumer — the app, the web
 * portal, reminders, partner view, AI context — gets the same honest picture from one place:
 *
 *  1. 3-cycle gate. The fertile window and ovulation are estimated only after ≥ 3 completed, logged
 *     cycles (`inferred.cycleCount` — gaps between logged period starts; onboarding defaults never
 *     count). Before that the status is LEARNING and nothing fertile is drawn or announced. Trying to
 *     conceive is the exception: from cycle 1 a WIDE (~14-day) window, „widen rather than guess“.
 *  2. Ovulation is a 3-day band (centre ± 1), never a point.
 *  3. A positive ovulation test (OPK) on day D centres this cycle's band on D + 1; negative / unclear
 *     results change nothing. 4. A manual „ovulation was this day“ mark (`observations.ovulationMarked`)
 *     centres the band on that day and wins over OPK. Both are her own logs, so they apply even before
 *     the gate opens (the source is always named: „OPK-ის მიხედვით“ / „შენი აღნიშვნით“). The next-period
 *     estimate is NOT moved by them: the engine projects the next period from the cycle length and only
 *     derives ovulation from it (start + length − 14), never the other way round.
 *  5. Variable cycles get a next-period window (`nextPeriodRange`) instead of one date when the person
 *     said her cycles vary or the last cycles spread ≥ 8 days; late starts only after the window.
 *
 * The mobile mirror of rule 1 lives in `mobile/src/lib/cycleForecastEligibility.js` (same constants,
 * same cases in both test files).
 */

/** Confirmed bleed (same list as cycle.js PERIOD_FLOWS; kept local so cycle.js can import this module). */
const isPeriodFlow = (flow) => flow === 'light' || flow === 'medium' || flow === 'heavy';

/** Completed logged cycles before the fertile window / ovulation may be estimated. */
export const FERTILITY_MIN_CYCLES = 3;
/** Trying to conceive before the gate opens: a window this wide instead of a guess (Flo's rule). */
export const TTC_WIDE_WINDOW_DAYS = 14;
/** Days the wide window reaches before the calendar ovulation estimate (the rest is after it). */
export const TTC_WIDE_DAYS_BEFORE = 9;
/** Ovulation band = centre ± this many days (3 days in all). */
export const OVULATION_BAND_HALF_DAYS = 1;
/** The engine's luteal constant: ovulation ≈ next period − 14 days. */
export const LUTEAL_PHASE_DAYS = 14;
/** A positive OPK on day D → ovulation band centred on D + this. */
export const OPK_TO_OVULATION_DAYS = 1;
/** Spread (longest − shortest of the last cycles) from which the next period is shown as a window. */
export const NEXT_PERIOD_RANGE_MIN_SPREAD = 8;
/** A variable cycle with fewer than two measured cycles: ± this many days. */
export const NEXT_PERIOD_RANGE_DEFAULT_SPREAD = 3;
/** The window never grows past ± a week. */
export const NEXT_PERIOD_RANGE_MAX_SPREAD = 7;
/** How many recent cycles the window is measured from. */
export const NEXT_PERIOD_RANGE_CYCLES = 6;

export const FERTILITY_STATUS = Object.freeze({
  /** ≥ 3 completed cycles: the usual fertile window + 3-day ovulation band. */
  READY: 'READY',
  /** < 3 cycles, not trying to conceive: nothing fertile is drawn; „ვსწავლობთ შენს რიტმს · N/3“. */
  LEARNING: 'LEARNING',
  /** < 3 cycles while trying to conceive: one wide window, no ovulation day. */
  WIDE: 'WIDE',
});

export const OVULATION_SOURCE = Object.freeze({
  CALENDAR: 'calendar',
  OPK: 'opk',
  MANUAL: 'manual',
});

/** Rule 1 — identical to `fertilityGate` in mobile/src/lib/cycleForecastEligibility.js. */
export function fertilityGate({ cycleCount = 0, mode = null } = {}) {
  const completed = Math.max(0, Math.floor(Number(cycleCount) || 0));
  const base = { completedCycles: completed, requiredCycles: FERTILITY_MIN_CYCLES };
  if (completed >= FERTILITY_MIN_CYCLES) return { ...base, status: FERTILITY_STATUS.READY };
  if (mode === 'TRY_TO_CONCEIVE') return { ...base, status: FERTILITY_STATUS.WIDE };
  return { ...base, status: FERTILITY_STATUS.LEARNING };
}

function utcDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function shiftDay(key, days) {
  const dt = new Date(utcDay(key));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function dayDiff(a, b) {
  return Math.round((utcDay(b) - utcDay(a)) / 86_400_000);
}

/** Rule 2 — the band around an ovulation centre. */
export function ovulationBand(center) {
  if (!center) return null;
  return {
    start: shiftDay(center, -OVULATION_BAND_HALF_DAYS),
    end: shiftDay(center, OVULATION_BAND_HALF_DAYS),
    center,
  };
}

function markedOvulation(log) {
  const bag = log?.observations;
  return Boolean(bag && typeof bag === 'object' && !Array.isArray(bag) && bag.ovulationMarked === true);
}

/**
 * Rules 3 + 4 — her own signal for the cycle that runs from `from` (its first period day) to `to`
 * (inclusive; usually today). A manual mark wins over any OPK (the latest mark if there are several);
 * otherwise the first positive OPK of the cycle (the start of the LH surge) → that day + 1.
 * Returns `{ date, source, logDate }` or null. Negative and unclear tests are ignored.
 */
export function cycleOvulationSignal(logs, { from, to = null } = {}) {
  if (!from || !Array.isArray(logs) || !logs.length) return null;
  const inCycle = logs
    .filter((log) => log?.date && log.date >= from && (!to || log.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date));
  // The bleeding that opened the cycle cannot be an ovulation day.
  const marks = inCycle.filter((log) => markedOvulation(log) && !(log.date === from && isPeriodFlow(log.flow)));
  if (marks.length) {
    const last = marks[marks.length - 1];
    return { date: last.date, source: OVULATION_SOURCE.MANUAL, logDate: last.date };
  }
  const positive = inCycle.find((log) => log.ovulationTest === 'positive');
  if (positive) {
    return {
      date: shiftDay(positive.date, OPK_TO_OVULATION_DAYS),
      source: OVULATION_SOURCE.OPK,
      logDate: positive.date,
    };
  }
  return null;
}

/**
 * The fertile window around an ovulation centre: the usual −5 … +1, or the wide −9 … +4 (14 days).
 * Never painted over the projected period days, never past the day before the next period.
 */
export function fertileWindowAround(center, { periodEnd, nextStart, wide = false }) {
  const rawStart = shiftDay(center, wide ? -TTC_WIDE_DAYS_BEFORE : -5);
  const rawEnd = shiftDay(center, wide ? TTC_WIDE_WINDOW_DAYS - TTC_WIDE_DAYS_BEFORE - 1 : 1);
  const lastDay = nextStart ? shiftDay(nextStart, -1) : rawEnd;
  const end = rawEnd > lastDay ? lastDay : rawEnd;
  const clampedStart = periodEnd && rawStart <= periodEnd ? shiftDay(periodEnd, 1) : rawStart;
  const start = clampedStart > end ? end : clampedStart;
  return { start, end };
}

/**
 * Rule 5 — the next period as a window. Null for a regular history (the single date stays).
 * `cycleLengths` = completed cycle lengths, oldest first (numbers or `{ length }`).
 * Before = typical length − shortest, after = longest − typical, each 1…7 days; ± 3 with < 2 cycles.
 */
export function nextPeriodRange({
  nextPeriodStart,
  isIrregular = false,
  cycleLengths = [],
  usedCycleLength = null,
} = {}) {
  if (!nextPeriodStart) return null;
  const lengths = (Array.isArray(cycleLengths) ? cycleLengths : [])
    .map((x) => Number(x && typeof x === 'object' ? x.length : x))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(-NEXT_PERIOD_RANGE_CYCLES);
  const spread = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null;
  const variable = Boolean(isIrregular) || (spread != null && spread >= NEXT_PERIOD_RANGE_MIN_SPREAD);
  if (!variable) return null;
  let before = NEXT_PERIOD_RANGE_DEFAULT_SPREAD;
  let after = NEXT_PERIOD_RANGE_DEFAULT_SPREAD;
  if (lengths.length >= 2) {
    const used = Math.round(Number(usedCycleLength) || 0) || Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length);
    const clamp = (n) => Math.min(NEXT_PERIOD_RANGE_MAX_SPREAD, Math.max(1, Math.round(n)));
    before = clamp(used - Math.min(...lengths));
    after = clamp(Math.max(...lengths) - used);
  }
  return {
    from: shiftDay(nextPeriodStart, -before),
    to: shiftDay(nextPeriodStart, after),
    reason: isIrregular ? 'irregular' : 'spread',
  };
}

/** Days from `today` to the end of the window (negative once it has passed). */
export function daysToRangeEnd(range, today) {
  if (!range?.to || !today) return null;
  return dayDiff(today, range.to);
}

const PHASE_LABELS = {
  ka: {
    follicular: 'ფოლიკულური ფაზა',
    fertile: 'ნაყოფიერი ფანჯარა',
    ovulation: 'ოვულაცია',
    luteal: 'ლუთეალური ფაზა',
  },
  en: {
    follicular: 'Follicular phase',
    fertile: 'Fertile window',
    ovulation: 'Ovulation',
    luteal: 'Luteal phase',
  },
};

const BIOLOGICAL_PHASES = new Set(['follicular', 'fertile', 'ovulation', 'luteal']);

export function phaseLabel(phase, lang = 'ka') {
  return (lang === 'en' ? PHASE_LABELS.en : PHASE_LABELS.ka)[phase] || null;
}

/**
 * The phase word for a day follows what the calendar draws for it: an ovulation mark → ovulation,
 * a fertile mark → fertile window, otherwise follicular up to the cycle's ovulation centre and luteal
 * after it. So a LEARNING cycle never says „ნაყოფიერი ფანჯარა“, and the 3-day band reads „ოვულაცია“.
 * Period / unknown days are left alone. Returns the (possibly new) `{ phase, phaseKa }`.
 */
export function phaseForMarkedDay({ key, phase, mark, ovulationCenter, lang = 'ka' }) {
  if (!BIOLOGICAL_PHASES.has(phase)) return null;
  const next = mark?.ovulation
    ? 'ovulation'
    : mark?.fertile
      ? 'fertile'
      : ovulationCenter && key <= ovulationCenter
        ? 'follicular'
        : 'luteal';
  return { phase: next, phaseKa: phaseLabel(next, lang) };
}

/**
 * A stamped phase (history days, cycles without marks) with fertility hidden: fertile / ovulation
 * become follicular (up to the calendar ovulation day) or luteal.
 */
export function hideFertilePhase(info, { avgCycleLength, lang = 'ka' } = {}) {
  if (!info || (info.phase !== 'fertile' && info.phase !== 'ovulation')) return info;
  const ovulationCycleDay = (Number(avgCycleLength) || 28) - (LUTEAL_PHASE_DAYS - 1);
  const next = info.day != null && info.day <= ovulationCycleDay ? 'follicular' : 'luteal';
  return { ...info, phase: next, phaseKa: phaseLabel(next, lang) };
}

/**
 * Today's phase (from `detectCyclePhase`, which never wraps) told the same way as the calendar: while
 * today is inside the projected cycle, the calendar's stamped (and gated) phase wins.
 */
export function alignPhaseWithForecast(info, predictions, today) {
  if (!info || info.day == null || !today) return info;
  const next = predictions?.nextPeriodStart;
  if (next && today >= next) return info;
  const mark = predictions?.calendar?.[today];
  if (!mark || !BIOLOGICAL_PHASES.has(mark.phase) || !BIOLOGICAL_PHASES.has(info.phase)) return info;
  if (mark.phase === info.phase && mark.phaseKa) return { ...info, phaseKa: mark.phaseKa };
  return { ...info, phase: mark.phase, phaseKa: mark.phaseKa || info.phaseKa };
}

/** True when the forecast says fertile days / ovulation may be shown at all. */
export function fertilityShown(fertility) {
  return fertility?.status === FERTILITY_STATUS.READY || fertility?.status === FERTILITY_STATUS.WIDE || Boolean(fertility?.ovulationSource && fertility.ovulationSource !== OVULATION_SOURCE.CALENDAR);
}
