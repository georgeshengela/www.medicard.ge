/**
 * One table for the „3 over 6“ thermal shift, run against the server mirror (`cycleTemperature.js`
 * `findThermalShift`) and the app rule (`mobile/src/lib/cycleTtcSignals.ts` `findThermalShift`) —
 * both test files import it, so the two implementations cannot drift apart.
 *
 * `readings`: [cycle day, °C (BBT) or °C deviation (wrist)]. `expect`: null, or the shift with its first
 * high day, high-reading count, coverline and whether the run reaches the last reading.
 */
export const SHIFT_CASES = Object.freeze([
  {
    name: 'classic 3 over 6',
    readings: [[8, 36.3], [9, 36.35], [10, 36.4], [11, 36.3], [12, 36.45], [13, 36.35], [14, 36.7], [15, 36.75], [16, 36.8]],
    expect: { startDay: 14, days: 3, coverline: 36.45, ongoing: true },
  },
  {
    name: 'exactly 0.20 above counts, 0.19 does not',
    readings: [[1, 36.3], [2, 36.3], [3, 36.3], [4, 36.3], [5, 36.3], [6, 36.4], [7, 36.6], [8, 36.6], [9, 36.6]],
    expect: { startDay: 7, days: 3, coverline: 36.4, ongoing: true },
  },
  {
    name: '0.19 above is not a shift',
    readings: [[1, 36.3], [2, 36.3], [3, 36.3], [4, 36.3], [5, 36.3], [6, 36.4], [7, 36.59], [8, 36.59], [9, 36.59]],
    expect: null,
  },
  {
    name: 'fewer than six readings before the rise',
    readings: [[1, 36.3], [2, 36.3], [3, 36.3], [4, 36.3], [5, 36.3], [6, 36.7], [7, 36.7], [8, 36.7]],
    expect: null,
  },
  {
    name: 'a skipped day does not break the run',
    readings: [[1, 36.3], [3, 36.35], [4, 36.4], [6, 36.3], [7, 36.45], [8, 36.35], [10, 36.7], [12, 36.75], [13, 36.8], [14, 36.75]],
    expect: { startDay: 10, days: 4, coverline: 36.45, ongoing: true },
  },
  {
    name: 'a dip below the coverline ends the run',
    readings: [[1, 36.3], [2, 36.35], [3, 36.4], [4, 36.3], [5, 36.45], [6, 36.35], [7, 36.7], [8, 36.75], [9, 36.8], [10, 36.4], [11, 36.7]],
    expect: { startDay: 7, days: 3, coverline: 36.45, ongoing: false },
  },
  {
    name: 'only two high readings',
    readings: [[1, 36.3], [2, 36.35], [3, 36.4], [4, 36.3], [5, 36.45], [6, 36.35], [7, 36.7], [8, 36.75]],
    expect: null,
  },
  {
    name: 'wrist deviations (negative baseline side) use the same rule',
    readings: [[1, -0.3], [2, -0.25], [3, -0.2], [4, -0.3], [5, -0.15], [6, -0.25], [7, 0.1], [8, 0.15], [9, 0.2], [10, 0.1]],
    expect: { startDay: 7, days: 4, coverline: -0.15, ongoing: true },
  },
]);
