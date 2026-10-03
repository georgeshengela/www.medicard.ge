/**
 * Temperature from Apple Health / Health Connect → a retrospective ovulation estimate
 * (MEDICARD Cycle brief §9 „მერე“ item 5, §4 convention #10, Apple's model: „რეტროსპექტულად“).
 *
 * Two kinds of readings live on a day's cycle log:
 *  - BBT (`CycleLog.bbt`, °C). Her own typed value always wins; a value read from Apple Health /
 *    Health Connect carries `observations.bbtSource = 'health'` and may be refreshed by a later import.
 *  - `observations.wristTempDelta` (°C, sleeping wrist / skin temperature relative to her baseline).
 *    It is NOT a body temperature and is never stored as BBT — it is only read here, for the shift.
 *
 * The shift rule is the „3 over 6“ coverline rule of the app's TTC line (mobile
 * `src/lib/cycleTtcSignals.ts` `findThermalShift`) — this is its server mirror, and both run the same
 * table (`cycleTemperature.cases.js`). A shift is only visible after it happened, so the ovulation it
 * gives is always retrospective: the day before the first of the three high readings.
 *
 * What the engine does with it (`cycleForecastHonesty.cycleOvulationSignal` / `buildPredictions`):
 * source `temperature`, label „ტემპერატურის მიხედვით · რეტროსპექტულად“, precedence manual mark > OPK >
 * temperature > calendar. It never moves the next period; over completed cycles it only teaches the
 * luteal length (`learnedLutealDays`).
 *
 * Privacy: BBT, `bbtSource` and `wristTempDelta` are SENSITIVE — never AI, partner or analytics.
 * Pure (no Prisma): node tests load it.
 */

export const BBT_SOURCE_HEALTH = 'health';
export const BBT_SOURCES = Object.freeze([BBT_SOURCE_HEALTH]);

export const SHIFT_PRIOR_READINGS = 6;
export const SHIFT_HIGH_READINGS = 3;
/** 0.20 °C, in hundredths. */
export const SHIFT_MIN_RISE_CENTI = 20;

export const BBT_PLAUSIBLE_MIN = 35;
export const BBT_PLAUSIBLE_MAX = 39;
/** Wrist / skin temperature deviation from her baseline, °C. */
export const WRIST_DELTA_MAX = 2.5;

/** How far back an import may write (the app reads 40 days; a little slack for time zones). */
export const IMPORT_MAX_AGE_DAYS = 45;
export const IMPORT_MAX_READINGS = 62;
/** Modes that read temperature at all (cycle tracking and trying to conceive). */
export const TEMPERATURE_MODES = Object.freeze(['TRACK_PERIOD', 'TRY_TO_CONCEIVE']);

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const centi = (value) => Math.round(value * 100);
const round2 = (value) => Math.round(value * 100) / 100;

function utcDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function shiftKey(key, days) {
  const dt = new Date(utcDay(key) + days * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

export function daysFromTo(from, to) {
  return Math.round((utcDay(to) - utcDay(from)) / 86_400_000);
}

function bagOf(log) {
  const bag = log?.observations;
  return bag && typeof bag === 'object' && !Array.isArray(bag) ? bag : {};
}

export function isPlausibleBbt(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= BBT_PLAUSIBLE_MIN && value <= BBT_PLAUSIBLE_MAX;
}

export function isPlausibleWristDelta(value) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= WRIST_DELTA_MAX;
}

/** True when the day's BBT came from Apple Health / Health Connect (not typed by her). */
export function bbtFromHealth(log) {
  return bagOf(log).bbtSource === BBT_SOURCE_HEALTH;
}

function readingsBetween(logs, from, to, pick) {
  const byDate = new Map();
  for (const log of Array.isArray(logs) ? logs : []) {
    if (!log || !DATE_KEY.test(String(log.date)) || log.date < from || (to && log.date > to)) continue;
    const value = pick(log);
    if (value == null) continue;
    byDate.set(log.date, value);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
}

/** BBT readings (typed or imported) from `from` to `to`, one per day, plausible only, in date order. */
export function bbtReadings(logs, from, to = null) {
  return readingsBetween(logs, from, to, (log) => {
    const bbt = typeof log.bbt === 'number' ? log.bbt : log.bbt != null ? Number(log.bbt) : null;
    return isPlausibleBbt(bbt) ? bbt : null;
  });
}

/** Wrist temperature deviations from `from` to `to`, one per day, plausible only, in date order. */
export function wristReadings(logs, from, to = null) {
  return readingsBetween(logs, from, to, (log) => {
    const delta = bagOf(log).wristTempDelta;
    return isPlausibleWristDelta(delta) ? delta : null;
  });
}

/**
 * The „3 over 6“ thermal shift in date-ordered `{ date, value }` readings (identical to the mobile
 * `findThermalShift`): the coverline for reading i is the highest of the six readings before it; a shift
 * starts at the first i where readings i, i+1, i+2 are each ≥ 0.20 °C above it (in hundredths) and
 * lasts while readings stay above the coverline. Unmeasured days are skipped, never break a run.
 */
export function findThermalShift(readings) {
  const list = Array.isArray(readings) ? readings : [];
  for (let i = SHIFT_PRIOR_READINGS; i + SHIFT_HIGH_READINGS <= list.length; i += 1) {
    const coverCenti = Math.max(...list.slice(i - SHIFT_PRIOR_READINGS, i).map((r) => centi(r.value)));
    const high = list.slice(i, i + SHIFT_HIGH_READINGS).every((r) => centi(r.value) >= coverCenti + SHIFT_MIN_RISE_CENTI);
    if (!high) continue;
    let end = i + SHIFT_HIGH_READINGS - 1;
    while (end + 1 < list.length && centi(list[end + 1].value) > coverCenti) end += 1;
    return {
      start: list[i].date,
      coverline: coverCenti / 100,
      days: end - i + 1,
      last: list[end].date,
      ongoing: end === list.length - 1,
    };
  }
  return null;
}

/**
 * Retrospective ovulation from temperature for the cycle that runs from `from` (its first period day)
 * to `to` (inclusive). BBT first (a direct body temperature), wrist deviation only when BBT shows no
 * shift. Returns `{ date, logDate, basis }` — date = the day before the first high reading — or null.
 */
export function temperatureOvulation(logs, { from, to = null } = {}) {
  if (!from || !DATE_KEY.test(from)) return null;
  for (const [basis, readings] of [['bbt', bbtReadings(logs, from, to)], ['wrist', wristReadings(logs, from, to)]]) {
    const shift = findThermalShift(readings);
    if (!shift) continue;
    const date = shiftKey(shift.start, -1);
    if (date <= from) continue;
    return { date, logDate: shift.start, basis };
  }
  return null;
}

/**
 * A log whose only content is imported temperature (health BBT and / or a wrist deviation). The calendar
 * does not draw the „logged“ dot for it — she did not log anything that day.
 */
export function onlyImportedTemperature(log) {
  if (!log) return false;
  const bag = bagOf(log);
  const imported = (log.bbt != null && bag.bbtSource === BBT_SOURCE_HEALTH) || bag.wristTempDelta != null;
  if (!imported) return false;
  if (log.bbt != null && bag.bbtSource !== BBT_SOURCE_HEALTH) return false;
  const otherBag = Object.keys(bag).some((key) => key !== 'bbtSource' && key !== 'wristTempDelta' && bag[key] != null);
  const arr = (value) => (Array.isArray(value) ? value.length : 0);
  return !(
    log.flow ||
    arr(log.symptoms) ||
    arr(log.moods) ||
    log.notes ||
    log.sexualActivity != null ||
    log.libido != null ||
    log.cervicalMucus ||
    log.ovulationTest ||
    log.pregnancyTest ||
    arr(log.painEntries) ||
    log.sleepQuality ||
    log.stressLevel ||
    log.exerciseLevel ||
    log.caffeine ||
    log.alcohol ||
    arr(log.customTagIds) ||
    otherBag
  );
}

/**
 * A typed BBT write (`PUT /logs/:date`): when the value changes or is cleared, the day's BBT is hers now
 * and `bbtSource` goes. Returns the bag to store, or undefined when nothing changes.
 * `nextBag` = the bag the write would store (or undefined when the write leaves the bag alone).
 */
export function bagAfterTypedBbt(existing, bodyBbt, nextBag) {
  if (bodyBbt === undefined) return nextBag;
  const base = nextBag !== undefined ? nextBag : bagOf(existing);
  if (base?.bbtSource == null) return nextBag;
  const before = existing?.bbt != null ? Number(existing.bbt) : null;
  const same = bodyBbt != null && before != null && centi(bodyBbt) === centi(before);
  if (same) return nextBag;
  const { bbtSource, ...rest } = base;
  return rest;
}

/** Strip the import-only keys from a typed log write's bag: only the import endpoint sets them. */
export function withoutImportKeys(bag) {
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return bag;
  if (!('bbtSource' in bag) && !('wristTempDelta' in bag)) return bag;
  const { bbtSource, wristTempDelta, ...rest } = bag;
  return rest;
}

/**
 * Plan an import: readings `{ date, bbt?, wristTempDelta? }` (°C, already converted on the phone) against
 * the stored logs. Her typed BBT always wins; an imported value is refreshed only when it changed; a
 * wrist deviation never becomes BBT. Dates outside [today − 45, today] and implausible values are
 * skipped. Returns `[{ date, create, bbt?, observations }]` — only days that change.
 */
export function planTemperatureImport(existingLogs, readings, { today }) {
  const byDate = new Map((Array.isArray(existingLogs) ? existingLogs : []).map((log) => [log.date, log]));
  const oldest = shiftKey(today, -IMPORT_MAX_AGE_DAYS);
  const seen = new Set();
  const out = [];
  for (const reading of Array.isArray(readings) ? readings.slice(0, IMPORT_MAX_READINGS) : []) {
    const date = String(reading?.date || '');
    if (!DATE_KEY.test(date) || date > today || date < oldest || seen.has(date)) continue;
    seen.add(date);
    const existing = byDate.get(date) || null;
    const bag = { ...bagOf(existing) };
    let bbt;
    let changed = false;

    const incomingBbt = typeof reading.bbt === 'number' ? round2(reading.bbt) : null;
    if (isPlausibleBbt(incomingBbt)) {
      const typed = existing?.bbt != null && bag.bbtSource !== BBT_SOURCE_HEALTH;
      const same = existing?.bbt != null && centi(Number(existing.bbt)) === centi(incomingBbt);
      if (!typed && !same) {
        bbt = incomingBbt;
        bag.bbtSource = BBT_SOURCE_HEALTH;
        changed = true;
      }
    }

    const incomingDelta = typeof reading.wristTempDelta === 'number' ? round2(reading.wristTempDelta) : null;
    if (isPlausibleWristDelta(incomingDelta)) {
      const before = isPlausibleWristDelta(bag.wristTempDelta) ? centi(bag.wristTempDelta) : null;
      if (before !== centi(incomingDelta)) {
        bag.wristTempDelta = incomingDelta;
        changed = true;
      }
    }

    if (!changed) continue;
    out.push({ date, create: !existing, ...(bbt !== undefined ? { bbt } : {}), observations: bag });
  }
  return out;
}
