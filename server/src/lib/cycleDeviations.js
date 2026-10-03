/**
 * Cycle deviations (brief §9 wave 2 item 14, [კ-27]; Apple Health „Cycle Deviations“).
 *
 * Pure function over logged history. Structured data only — the app writes the words.
 * Conservative on purpose: the card exists only when there is enough history and nothing that
 * naturally changes the cycle is (or was recently) in play. Never a diagnosis, never a condition name.
 *
 * Rules over the last 180 days of logged history:
 *   irregular  — longest − shortest completed cycle ≥ 17 days (off in PERIMENOPAUSE mode)
 *   infrequent — only 1–2 period starts in the window
 *   prolonged  — ≥ 2 periods of ≥ 10 days
 *   spotting   — spotting days outside periods (± 2 days of the edges) in ≥ 2 cycles
 *
 * Gates (any one → null, not even „not enough data“):
 *   - Tracking (`expectsBleeding` false), PREGNANCY or POSTPARTUM mode;
 *   - a factor active (hormonal contraception — start date unknown counts as active) or ended < 90 days ago;
 *   - < 180 days of history counted from max(first logged period start, last factor end), so the
 *     window never reaches back into a pregnancy or postpartum stretch;
 *   - < 3 completed cycles in that history.
 *
 * Cycles she hid from averages (`hiddenStarts`, „საშუალოდან დამალვა“) are left out of the cycle count,
 * the irregular spread, prolonged periods and between-period spotting. The infrequent rule still counts
 * every logged period start: hiding a cycle never invents „infrequent periods“.
 */

import { addDays, daysBetween, todayInTimeZone } from './cycle.js';
import { contraceptionCategory } from './cycleContraception.js';

export const DEVIATION_WINDOW_DAYS = 180;
export const DEVIATION_MIN_CYCLES = 3;
export const DEVIATION_FACTOR_TAIL_DAYS = 90;
export const IRREGULAR_SPREAD_DAYS = 17;
export const PROLONGED_PERIOD_DAYS = 10;
export const PROLONGED_MIN_PERIODS = 2;
export const INFREQUENT_MAX_PERIODS = 2;
export const SPOTTING_MIN_CYCLES = 2;
/** Spotting this close to a period edge is part of the period, not „between periods“. */
export const SPOTTING_EDGE_DAYS = 2;
/** „Infrequent“ needs some log in this many recent days — an abandoned tracker is not a finding. */
export const INFREQUENT_RECENT_LOG_DAYS = 90;

export const DEVIATION_IDS = ['irregular', 'infrequent', 'prolonged', 'spotting'];

const HORMONAL_CATEGORIES = new Set(['hormonal', 'hormonal_iud']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && DATE_RE.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Factors that pause the card. `kind` is informational; `active` true or an `endedAt` within the tail
 * disables it; `endedAt` also moves the start of usable history.
 */
export function deviationFactors({ mode, contraceptionMethod, pregnancyEndedAt, postpartumEndedAt } = {}) {
  const factors = [];
  if (mode === 'PREGNANCY') factors.push({ kind: 'pregnancy', active: true, endedAt: null });
  if (mode === 'POSTPARTUM') factors.push({ kind: 'postpartum', active: true, endedAt: null });
  if (HORMONAL_CATEGORIES.has(contraceptionCategory(contraceptionMethod ?? null))) {
    factors.push({ kind: 'hormonal_contraception', active: true, endedAt: null });
  }
  const pregnancyEnd = dateKey(pregnancyEndedAt);
  if (pregnancyEnd) factors.push({ kind: 'pregnancy', active: false, endedAt: pregnancyEnd });
  const postpartumEnd = dateKey(postpartumEndedAt);
  if (postpartumEnd) factors.push({ kind: 'postpartum', active: false, endedAt: postpartumEnd });
  return factors;
}

/**
 * Full evaluation with a reason, for tests and debugging.
 * @returns {{ shown: boolean, reason: string, deviations: object | null }}
 */
export function evaluateCycleDeviations({
  today,
  mode = 'TRACK_PERIOD',
  expectsBleeding = true,
  periodRanges = [],
  logs = [],
  factors = [],
  hiddenStarts = [],
} = {}) {
  const hidden = (reason) => ({ shown: false, reason, deviations: null });
  const hiddenSet = new Set(Array.isArray(hiddenStarts) ? hiddenStarts : []);
  const day = dateKey(today);
  if (!day) return hidden('no_today');
  if (expectsBleeding === false) return hidden('tracking');
  if (mode === 'PREGNANCY' || mode === 'POSTPARTUM') return hidden('mode');

  let lastFactorEnd = null;
  for (const factor of factors || []) {
    if (factor?.active) return hidden(`factor:${factor.kind}`);
    const end = dateKey(factor?.endedAt);
    if (!end) continue;
    // An end date in the future still counts as active.
    if (end > day || daysBetween(end, day) < DEVIATION_FACTOR_TAIL_DAYS) return hidden(`factor:${factor.kind}`);
    if (!lastFactorEnd || end > lastFactorEnd) lastFactorEnd = end;
  }

  const ranges = (periodRanges || [])
    .filter((r) => r && dateKey(r.start) && dateKey(r.start) <= day)
    .map((r) => {
      const start = dateKey(r.start);
      const end = dateKey(r.end) || start;
      const lengthDays = Number(r.lengthDays) || daysBetween(start, end) + 1;
      return { start, end, lengthDays };
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  // Usable history starts after the last factor ended (the window never spans a pregnancy).
  const usable = lastFactorEnd ? ranges.filter((r) => r.start > lastFactorEnd) : ranges;
  if (!usable.length) return hidden('history');
  const historyStart = usable[0].start;
  if (daysBetween(historyStart, day) + 1 < DEVIATION_WINDOW_DAYS) return hidden('history');
  const completedShown = usable.slice(0, -1).filter((r) => !hiddenSet.has(r.start)).length;
  if (completedShown < DEVIATION_MIN_CYCLES) return hidden('cycles');

  const windowStart = addDays(day, -(DEVIATION_WINDOW_DAYS - 1));
  const starts = usable.map((r) => r.start);
  const findings = [];

  // irregular — completed cycles that start inside the window (hidden cycles left out).
  const lengths = [];
  for (let i = 0; i < starts.length - 1; i += 1) {
    if (hiddenSet.has(starts[i])) continue;
    if (starts[i] >= windowStart) lengths.push(daysBetween(starts[i], starts[i + 1]));
  }
  const rulesOff = mode === 'PERIMENOPAUSE' ? ['irregular'] : [];
  if (!rulesOff.includes('irregular') && lengths.length >= 2) {
    const shortest = Math.min(...lengths);
    const longest = Math.max(...lengths);
    if (longest - shortest >= IRREGULAR_SPREAD_DAYS) {
      findings.push({ id: 'irregular', shortestDays: shortest, longestDays: longest, spreadDays: longest - shortest, cycles: lengths.length });
    }
  }

  // infrequent — period starts inside the window, only while she is still logging.
  const inWindow = usable.filter((r) => r.start >= windowStart);
  const lastLog = (logs || []).reduce((max, l) => {
    const d = dateKey(l?.date);
    return d && d <= day && (!max || d > max) ? d : max;
  }, null);
  const latestActivity = [lastLog, inWindow.length ? inWindow[inWindow.length - 1].end : null].filter(Boolean).sort().pop();
  const loggingRecently = latestActivity && daysBetween(latestActivity, day) < INFREQUENT_RECENT_LOG_DAYS;
  if (inWindow.length >= 1 && inWindow.length <= INFREQUENT_MAX_PERIODS && loggingRecently) {
    findings.push({ id: 'infrequent', periods: inWindow.length });
  }

  // prolonged — periods of ≥ 10 days inside the window.
  const long = inWindow.filter((r) => !hiddenSet.has(r.start) && r.lengthDays >= PROLONGED_PERIOD_DAYS);
  if (long.length >= PROLONGED_MIN_PERIODS) {
    findings.push({ id: 'prolonged', periods: long.length, longestDays: Math.max(...long.map((r) => r.lengthDays)) });
  }

  // spotting — spotting days between periods, grouped by the cycle they fall in.
  const nearPeriod = (date) =>
    usable.some((r) => date >= addDays(r.start, -SPOTTING_EDGE_DAYS) && date <= addDays(r.end, SPOTTING_EDGE_DAYS));
  const spotCycles = new Set();
  let spotDays = 0;
  for (const log of logs || []) {
    const date = dateKey(log?.date);
    if (!date || date < windowStart || date > day || date < historyStart) continue;
    if (log.flow !== 'spotting') continue;
    if (nearPeriod(date)) continue;
    let owner = null;
    for (const s of starts) if (s <= date) owner = s;
    if (!owner || hiddenSet.has(owner)) continue;
    spotCycles.add(owner);
    spotDays += 1;
  }
  if (spotCycles.size >= SPOTTING_MIN_CYCLES) {
    findings.push({ id: 'spotting', cycles: spotCycles.size, days: spotDays });
  }

  if (!findings.length) return hidden('no_findings');
  return {
    shown: true,
    reason: 'findings',
    deviations: {
      version: 1,
      windowDays: DEVIATION_WINDOW_DAYS,
      from: windowStart,
      to: day,
      findings,
      rulesOff,
    },
  };
}

/** Bundle field `deviations`: the findings, or null when the card must not be drawn at all. */
export function buildCycleDeviations(input) {
  return evaluateCycleDeviations(input).deviations;
}


/**
 * Latest ended pregnancy / postpartum episode as civil dates in the user's timezone.
 * Never throws: a missing table or a failed query means „no ended factor known“.
 */
export async function loadDeviationFactorEnds(prisma, userId, timezone) {
  const latestEnd = async (model) => {
    try {
      const row = await prisma[model].findFirst({
        where: { userId, endedAt: { not: null } },
        orderBy: { endedAt: 'desc' },
        select: { endedAt: true },
      });
      return row?.endedAt ? todayInTimeZone(timezone, new Date(row.endedAt)) : null;
    } catch {
      return null;
    }
  };
  const [pregnancyEndedAt, postpartumEndedAt] = await Promise.all([
    latestEnd('cyclePregnancyEpisode'),
    latestEnd('cyclePostpartumEpisode'),
  ]);
  return { pregnancyEndedAt, postpartumEndedAt };
}
