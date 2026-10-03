/**
 * „ბოლო ციკლები“ — cycle-to-cycle comparison (brief §9 „მერე“ item 7; Clue's „enhanced Cycle View“).
 *
 * The last ≤ 6 completed cycles she did not hide from averages, oldest first, each with its length and
 * how many of its first days were logged period days, plus one fact: the latest cycle against her own
 * median of the cycles before it. Never against population norms, never a verdict. The app and the web
 * portal word it („ბოლო ციკლი 31 დღე იყო — შენს ჩვეულზე (28) 3 დღით გრძელი“).
 *
 * Which cycles: the same ones every other number uses, so Home („ჩემი ციკლი“ bars), the stats card and
 * this card agree — `buildCycleTrends.cycleLengths` (18–45 day gaps, hidden cycles left out) in the
 * period-tracking modes, and the unclamped perimenopause intervals (`completedCycleIntervals`) in
 * PERIMENOPAUSE, where 50- or 90-day cycles are real. Pregnancy and postpartum: null.
 */
import { addDays, daysBetween } from './cycle.js';
import { completedCycleIntervals } from './cyclePerimenopause.js';

export const COMPARISON_CYCLES = 6;
/** Earlier cycles needed before the latest is compared with her usual. */
export const COMPARISON_MIN_EARLIER = 2;
/** The in-band gap rule shared with `buildCycleTrends` / `inferCycleStats`. */
const MIN_GAP = 18;
const MAX_GAP = 45;

const NO_COMPARISON_MODES = new Set(['PREGNANCY', 'POSTPARTUM']);

/** Median of numbers, rounded to whole days (null for none). */
export function medianDays(values = []) {
  const nums = values.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return Math.round(nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2);
}

function inBandCycles(periodStarts = [], hiddenStarts = []) {
  const starts = [...(periodStarts || [])].filter(Boolean).sort();
  const hidden = new Set(hiddenStarts || []);
  const rows = [];
  for (let i = 1; i < starts.length; i += 1) {
    if (hidden.has(starts[i - 1])) continue;
    const length = daysBetween(starts[i - 1], starts[i]);
    if (length >= MIN_GAP && length <= MAX_GAP) rows.push({ start: starts[i - 1], next: starts[i], length });
  }
  return rows;
}

function periodDaysFor(start, length, periodRanges = []) {
  const range = (periodRanges || []).find((r) => r?.start === start);
  if (!range) return 0;
  const days = Number(range.lengthDays) || (range.end ? daysBetween(range.start, range.end) + 1 : 0);
  return Math.max(0, Math.min(length, days));
}

/**
 * `{ cycles: [{ start, end, length, periodDays, latest }], latestDays, usualDays, diffDays, basedOn }`
 * or null (< 2 cycles, or a mode without cycles). `usualDays` / `diffDays` are null until there are
 * COMPARISON_MIN_EARLIER cycles before the latest one.
 */
export function buildCycleComparison({
  mode = null,
  periodStarts = [],
  periodRanges = [],
  hiddenStarts = [],
  today = null,
  limit = COMPARISON_CYCLES,
} = {}) {
  if (NO_COMPARISON_MODES.has(mode)) return null;
  const rows =
    mode === 'PERIMENOPAUSE'
      ? completedCycleIntervals(periodStarts, { today, window: limit, hiddenStarts }).map((r) => ({
          start: r.from,
          next: r.to,
          length: r.days,
        }))
      : inBandCycles(periodStarts, hiddenStarts).slice(-limit);
  if (rows.length < 2) return null;
  const cycles = rows.map((row, index) => ({
    start: row.start,
    end: addDays(row.next, -1),
    length: row.length,
    periodDays: periodDaysFor(row.start, row.length, periodRanges),
    latest: index === rows.length - 1,
  }));
  const latestDays = cycles[cycles.length - 1].length;
  const earlier = cycles.slice(0, -1).map((c) => c.length);
  const usualDays = earlier.length >= COMPARISON_MIN_EARLIER ? medianDays(earlier) : null;
  return {
    cycles,
    latestDays,
    usualDays,
    diffDays: usualDays == null ? null : latestDays - usualDays,
    basedOn: cycles.length,
  };
}

