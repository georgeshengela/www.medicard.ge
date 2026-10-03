/**
 * Doctor report „სიმპტომები ციკლის დღეების მიხედვით“ — a symptom heat map by cycle day (brief §9 „მერე“
 * item 6, Clue's report). Pure: numbers only, labels live in the app's doctor-summary copy.
 *
 * Rows = her most frequent logged pain places, symptoms and moods over the last completed cycles; columns =
 * cycle day 1…28 (stretched to her longest cycle, at most 35) plus one „36+“ column when a cycle ran longer;
 * a cell = in how many of those cycles the item was logged on that cycle day.
 *
 * Only HEALTH-sensitivity registry items: never sex, BBT, tests, mucus, discharge or intimate symptoms
 * (SENSITIVE / HIGHLY_SENSITIVE). Cycles she hid from averages („საშუალოდან დამალვა“) are left out, and a
 * cycle where she logged none of these items does not count — a missing log is not an absent symptom.
 */

import { daysBetween } from './cycle.js';
import {
  OBSERVATION_CATEGORIES,
  PAIN_SYMPTOM_TO_TYPE,
  PAIN_TYPES,
  SENSITIVITY,
  STORAGE,
  getObservationDef,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';

export const SYMPTOM_MAP_MAX_CYCLES = 6;
export const SYMPTOM_MAP_MAX_ROWS = 10;
export const SYMPTOM_MAP_MIN_DAYS = 28;
export const SYMPTOM_MAP_MAX_DAY = 35;
/** An item logged once in six cycles is noise in a clinician's grid. */
export const SYMPTOM_MAP_MIN_LOGGED_DAYS = 2;
/** HEALTH in the registry, but too close to intimacy for a document she hands to someone else. */
export const SYMPTOM_MAP_EXCLUDED_KEYS = Object.freeze(new Set(['romantic']));

function healthItem(id, storage) {
  if (SYMPTOM_MAP_EXCLUDED_KEYS.has(id)) return false;
  const defn = getObservationDef(id);
  if (!defn || !defn.enabled) return false;
  if (defn.storage !== storage) return false;
  if (defn.sensitivity !== SENSITIVITY.HEALTH) return false;
  // Belt and braces: the registry keeps these categories SENSITIVE+, but never let one slip in.
  if (
    defn.category === OBSERVATION_CATEGORIES.SEXUAL_HEALTH ||
    defn.category === OBSERVATION_CATEGORIES.FERTILITY ||
    defn.category === OBSERVATION_CATEGORIES.PREGNANCY_TEST ||
    defn.category === OBSERVATION_CATEGORIES.DISCHARGE
  ) {
    return false;
  }
  return true;
}

/** Whether a row id may ever appear in the map (`pain:cramps`, `symptom:bloating`, `mood:calm`). */
export function isSymptomMapItem(item) {
  const [kind, key] = String(item || '').split(':');
  if (kind === 'pain') return PAIN_TYPES.includes(key) && getObservationDef('pain')?.sensitivity === SENSITIVITY.HEALTH;
  if (kind === 'symptom') return !PAIN_SYMPTOM_TO_TYPE[key] && healthItem(key, STORAGE.SYMPTOMS);
  if (kind === 'mood') return healthItem(key, STORAGE.MOODS);
  return false;
}

/** The map's items on one day's log: pain places (chips folded into their pain type), symptoms, moods. */
export function symptomMapItemsForLog(log) {
  const out = new Set();
  const pain = Array.isArray(log?.painEntries) ? log.painEntries : [];
  for (const entry of pain) {
    if (PAIN_TYPES.includes(entry?.type)) out.add(`pain:${entry.type}`);
  }
  const symptoms = stripPainManagedSymptoms(Array.isArray(log?.symptoms) ? log.symptoms : [], pain);
  for (const id of symptoms) {
    const mapped = PAIN_SYMPTOM_TO_TYPE[id];
    const item = mapped ? `pain:${mapped}` : `symptom:${id}`;
    if (isSymptomMapItem(item)) out.add(item);
  }
  for (const id of Array.isArray(log?.moods) ? log.moods : []) {
    const item = `mood:${id}`;
    if (isSymptomMapItem(item)) out.add(item);
  }
  return [...out];
}

function dateKey(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return '';
}

/** Longest run of the busiest column; the earliest one on a tie. Columns are 1-based. */
function peakOf(counts) {
  const max = Math.max(0, ...counts);
  if (!max) return null;
  let best = null;
  let runStart = -1;
  for (let i = 0; i <= counts.length; i += 1) {
    if (i < counts.length && counts[i] === max) {
      if (runStart < 0) runStart = i;
      continue;
    }
    if (runStart >= 0) {
      const len = i - runStart;
      if (!best || len > best.to - best.from + 1) best = { from: runStart + 1, to: i, cycles: max };
      runStart = -1;
    }
  }
  return best;
}

/**
 * @param {{
 *   logs?: object[],
 *   periodStarts?: string[],
 *   hiddenStarts?: string[],
 *   from?: string,
 *   to?: string,
 * }} input
 * @returns {null | {
 *   cycleCount: number,
 *   dayCount: number,
 *   overflow: boolean,
 *   cycles: { start: string, end: string, lengthDays: number }[],
 *   rows: { kind: 'pain'|'symptom'|'mood', key: string, loggedDays: number, cyclesWithItem: number,
 *           counts: number[], peak: { from: number, to: number, cycles: number } }[],
 * }}
 * `counts` has `dayCount` cells (cycle day 1…dayCount) plus one „36+“ cell when `overflow`; in `peak`
 * column `dayCount + 1` is that „36+“ cell. `end` is the next period's first day (not part of the cycle).
 */
export function buildSymptomCycleMap({ logs = [], periodStarts = [], hiddenStarts = [], from = '', to = '' } = {}) {
  const hidden = new Set((hiddenStarts || []).map(String));
  const starts = [...new Set((periodStarts || []).map(String))].sort();
  const byDate = new Map();
  for (const log of logs || []) {
    const date = dateKey(log?.date);
    if (!date) continue;
    const items = symptomMapItemsForLog(log);
    if (!items.length) continue;
    const prev = byDate.get(date);
    byDate.set(date, prev ? [...new Set([...prev, ...items])] : items);
  }
  if (!byDate.size) return null;

  const tracked = [];
  for (let i = 0; i + 1 < starts.length; i += 1) {
    const start = starts[i];
    const end = starts[i + 1];
    if (hidden.has(start)) continue;
    if (from && start < from) continue;
    if (to && end > to) continue;
    const days = [];
    for (const [date, items] of byDate) {
      if (date >= start && date < end) days.push({ day: daysBetween(start, date) + 1, items });
    }
    if (!days.length) continue;
    tracked.push({ start, end, lengthDays: daysBetween(start, end), days });
  }
  const cycles = tracked.slice(-SYMPTOM_MAP_MAX_CYCLES);
  if (!cycles.length) return null;

  const longest = Math.max(...cycles.map((c) => c.lengthDays));
  const dayCount = Math.max(SYMPTOM_MAP_MIN_DAYS, Math.min(SYMPTOM_MAP_MAX_DAY, longest));
  const overflow = longest > SYMPTOM_MAP_MAX_DAY;
  const width = dayCount + (overflow ? 1 : 0);

  const rowsByItem = new Map();
  for (const cycle of cycles) {
    const seen = new Map();
    for (const { day, items } of cycle.days) {
      const col = Math.min(day, SYMPTOM_MAP_MAX_DAY + 1) - 1;
      for (const item of items) {
        if (!rowsByItem.has(item)) rowsByItem.set(item, { counts: new Array(width).fill(0), loggedDays: 0, cycles: 0 });
        const row = rowsByItem.get(item);
        row.loggedDays += 1;
        if (!seen.has(item)) {
          seen.set(item, new Set());
          row.cycles += 1;
        }
        const cols = seen.get(item);
        if (!cols.has(col)) {
          cols.add(col);
          row.counts[col] += 1;
        }
      }
    }
  }

  const rows = [...rowsByItem.entries()]
    .filter(([, row]) => row.loggedDays >= SYMPTOM_MAP_MIN_LOGGED_DAYS)
    .sort(
      ([a, ra], [b, rb]) => rb.loggedDays - ra.loggedDays || rb.cycles - ra.cycles || a.localeCompare(b),
    )
    .slice(0, SYMPTOM_MAP_MAX_ROWS)
    .map(([item, row]) => {
      const [kind, key] = item.split(':');
      return {
        kind,
        key,
        loggedDays: row.loggedDays,
        cyclesWithItem: row.cycles,
        counts: row.counts,
        peak: peakOf(row.counts),
      };
    });
  if (!rows.length) return null;

  return {
    cycleCount: cycles.length,
    dayCount,
    overflow,
    cycles: cycles.map(({ start, end, lengthDays }) => ({ start, end, lengthDays })),
    rows,
  };
}
