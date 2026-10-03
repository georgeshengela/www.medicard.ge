import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bagAfterTypedBbt,
  bbtReadings,
  findThermalShift,
  onlyImportedTemperature,
  planTemperatureImport,
  shiftKey,
  temperatureOvulation,
  withoutImportKeys,
  wristReadings,
} from './cycleTemperature.js';
import { SHIFT_CASES } from './cycleTemperature.cases.js';
import {
  LUTEAL_PHASE_DAYS,
  OVULATION_SOURCE,
  cycleOvulationSignal,
  learnedLutealDays,
  pastOvulations,
} from './cycleForecastHonesty.js';
import { addDays, buildPredictions, overlayLogsOnCalendar } from './cycle.js';
import {
  getObservationDef,
  mergeObservationBag,
  parseObservationBag,
  SENSITIVITY,
  STORAGE,
} from './cycleObservationRegistry.js';
import { presentPredictions, interpretContraception } from './cycleContraception.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { serializeCycleLogForAi } from './cycleAiContext.js';
import { ttcWindowBody } from './cycleHonesty.js';

const START = '2026-08-01';
const day = (n, from = START) => addDays(from, n - 1);

/** Logs for a table case: BBT (or wrist deviation) on the listed cycle days. */
function caseLogs(readings, { wrist = false, from = START } = {}) {
  return readings.map(([d, v]) => (wrist
    ? { date: day(d, from), observations: { wristTempDelta: v } }
    : { date: day(d, from), bbt: v }));
}

describe('thermal shift — the shared table (server mirror of cycleTtcSignals.findThermalShift)', () => {
  for (const c of SHIFT_CASES) {
    it(c.name, () => {
      const readings = c.readings.map(([d, value]) => ({ date: day(d), value }));
      const shift = findThermalShift(readings);
      if (!c.expect) return assert.equal(shift, null);
      assert.equal(shift.start, day(c.expect.startDay));
      assert.equal(shift.days, c.expect.days);
      assert.equal(shift.coverline, c.expect.coverline);
      assert.equal(shift.ongoing, c.expect.ongoing);
    });
  }
});

describe('readings', () => {
  it('BBT: one per day, plausible 35–39 only, in date order; wrist deviations stay separate', () => {
    const logs = [
      { date: day(3), bbt: 36.5 },
      { date: day(1), bbt: 34.2 },
      { date: day(2), bbt: 39.6 },
      { date: day(4), observations: { wristTempDelta: 0.3 } },
      { date: day(5), observations: { wristTempDelta: 4 } },
    ];
    assert.deepEqual(bbtReadings(logs, START), [{ date: day(3), value: 36.5 }]);
    assert.deepEqual(wristReadings(logs, START), [{ date: day(4), value: 0.3 }]);
  });
});

describe('retrospective ovulation from temperature', () => {
  const classic = SHIFT_CASES[0].readings;

  it('BBT shift → the day before the first high reading', () => {
    const got = temperatureOvulation(caseLogs(classic), { from: START, to: day(20) });
    assert.deepEqual(got, { date: day(13), logDate: day(14), basis: 'bbt' });
  });

  it('a wrist shift is used only when BBT shows none — and never becomes BBT', () => {
    const wrist = caseLogs(SHIFT_CASES[7].readings, { wrist: true });
    const got = temperatureOvulation(wrist, { from: START, to: day(20) });
    assert.deepEqual(got, { date: day(6), logDate: day(7), basis: 'wrist' });
    assert.deepEqual(bbtReadings(wrist, START), []);
    const both = [...caseLogs(classic), ...wrist.map((l) => ({ ...l, date: l.date }))];
    // Same dates merge in real logs; here BBT and wrist sit on different days and BBT still wins.
    assert.equal(temperatureOvulation(both, { from: START, to: day(20) }).basis, 'bbt');
  });

  it('precedence: manual mark > OPK > temperature > calendar', () => {
    const logs = caseLogs(classic);
    const temp = cycleOvulationSignal(logs, { from: START, to: day(20) });
    assert.equal(temp.source, OVULATION_SOURCE.TEMPERATURE);
    assert.equal(temp.date, day(13));
    const opk = cycleOvulationSignal([...logs, { date: day(15), ovulationTest: 'positive' }], { from: START, to: day(20) });
    assert.equal(opk.source, OVULATION_SOURCE.OPK);
    const manual = cycleOvulationSignal(
      [...logs, { date: day(15), ovulationTest: 'positive' }, { date: day(12), observations: { ovulationMarked: true } }],
      { from: START, to: day(20) },
    );
    assert.equal(manual.source, OVULATION_SOURCE.MANUAL);
  });

  it('the current cycle: a past shift labels the band „temperature“ (retrospective) and never moves the next period', () => {
    const base = { lastPeriodStart: START, avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 4, today: day(18) };
    const before = buildPredictions({ ...base, logs: [] });
    const after = buildPredictions({ ...base, logs: caseLogs(classic) });
    assert.equal(after.nextPeriodStart, before.nextPeriodStart);
    assert.equal(after.fertility.ovulationSource, 'temperature');
    assert.equal(after.fertility.retrospective, true);
    assert.equal(after.ovulationDate, day(13));
    assert.equal(before.fertility.retrospective, false);
    assert.match(ttcWindowBody(after, {}, 'ka'), /ტემპერატურის მიხედვით · რეტროსპექტულად/);
    assert.match(ttcWindowBody(after, {}, 'en'), /from your temperature · in hindsight/);
    // The partner view never uses her signals.
    const partner = buildPredictions({ ...base, logs: caseLogs(classic), useOvulationSignals: false });
    assert.equal(partner.fertility.ovulationSource, 'calendar');
  });
});

describe('completed cycles teach the luteal length', () => {
  // Three 28-day cycles; shifts put ovulation on cycle day 17 → luteal 12 days.
  const starts = ['2026-05-01', '2026-05-29', '2026-06-26', '2026-07-24'];
  const shiftLogs = (from) => caseLogs(
    [[10, 36.3], [11, 36.35], [12, 36.4], [13, 36.3], [14, 36.45], [15, 36.35], [18, 36.7], [19, 36.75], [20, 36.8]],
    { from },
  );
  const logs = starts.slice(0, 3).flatMap(shiftLogs);

  it('past ovulations carry their source and luteal days; the median is learned (≥ 2 cycles)', () => {
    const past = pastOvulations(logs, starts);
    assert.equal(past.length, 3);
    assert.deepEqual(past[0], { cycleStart: starts[0], nextStart: starts[1], date: '2026-05-17', source: 'temperature', lutealDays: 12 });
    assert.equal(learnedLutealDays(past), 12);
    assert.equal(learnedLutealDays(past.slice(0, 1)), null);
    assert.equal(learnedLutealDays([{ lutealDays: 9 }, { lutealDays: 9 }]), 10, 'kept inside 10…16');
  });

  it('the calendar ovulation ahead moves by the learned length; the next period does not', () => {
    const base = { lastPeriodStart: starts[3], avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 4, today: '2026-07-26', logs };
    const plain = buildPredictions(base);
    const taught = buildPredictions({ ...base, periodStarts: starts });
    assert.equal(taught.nextPeriodStart, plain.nextPeriodStart);
    assert.equal(plain.ovulationDate, addDays(starts[3], 28 - LUTEAL_PHASE_DAYS));
    assert.equal(taught.ovulationDate, addDays(starts[3], 28 - 12));
    assert.equal(taught.fertility.lutealDays, 12);
    assert.equal(taught.fertility.pastOvulations.length, 3);
    assert.equal(taught.fertility.ovulationSource, 'calendar');
    assert.equal(plain.fertility.lutealDays, null);
    // The partner view learns nothing.
    const partner = buildPredictions({ ...base, periodStarts: starts, useOvulationSignals: false });
    assert.equal(partner.ovulationDate, plain.ovulationDate);
    assert.deepEqual(partner.fertility.pastOvulations, []);
  });

  it('a combined pill (LIMITED) hides the past ovulations with the rest of fertility', () => {
    const taught = buildPredictions({ lastPeriodStart: starts[3], avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 4, today: '2026-07-26', logs, periodStarts: starts });
    const contraception = interpretContraception({ contraceptionMethod: 'COMBINED_PILL', mode: 'TRACK_PERIOD' }, {});
    const shown = presentPredictions(taught, contraception, 'ka');
    assert.deepEqual(shown.fertility.pastOvulations, []);
    assert.equal(shown.fertility.retrospective, false);
  });
});

describe('the import: her typed BBT always wins', () => {
  const today = '2026-09-20';

  it('fills empty days, marks them health, skips typed BBT and unchanged values', () => {
    const existing = [
      { date: '2026-09-10', bbt: 36.4, observations: {} },
      { date: '2026-09-11', bbt: 36.5, observations: { bbtSource: 'health' } },
      { date: '2026-09-12', bbt: 36.5, observations: { bbtSource: 'health' } },
    ];
    const plan = planTemperatureImport(existing, [
      { date: '2026-09-09', bbt: 36.45 },
      { date: '2026-09-10', bbt: 36.9 },
      { date: '2026-09-11', bbt: 36.5 },
      { date: '2026-09-12', bbt: 36.62 },
    ], { today });
    assert.deepEqual(plan, [
      { date: '2026-09-09', create: true, bbt: 36.45, observations: { bbtSource: 'health' } },
      { date: '2026-09-12', create: false, bbt: 36.62, observations: { bbtSource: 'health' } },
    ]);
  });

  it('a wrist deviation is stored as wristTempDelta, never as BBT', () => {
    const plan = planTemperatureImport([], [{ date: '2026-09-15', wristTempDelta: 0.234 }], { today });
    assert.deepEqual(plan, [{ date: '2026-09-15', create: true, observations: { wristTempDelta: 0.23 } }]);
    assert.equal('bbt' in plan[0], false);
  });

  it('dedupes dates, refuses implausible values, future days and days older than 45', () => {
    const plan = planTemperatureImport([], [
      { date: '2026-09-14', bbt: 36.5 },
      { date: '2026-09-14', bbt: 36.9 },
      { date: '2026-09-13', bbt: 41 },
      { date: '2026-09-12', wristTempDelta: 3.1 },
      { date: '2026-09-21', bbt: 36.5 },
      { date: '2026-08-01', bbt: 36.5 },
    ], { today });
    assert.deepEqual(plan.map((p) => [p.date, p.bbt]), [['2026-09-14', 36.5]]);
  });

  it('a typed change clears the import flag; the same value keeps it', () => {
    const existing = { bbt: 36.5, observations: { bbtSource: 'health', energy: 'low' } };
    assert.deepEqual(bagAfterTypedBbt(existing, 36.7, undefined), { energy: 'low' });
    assert.deepEqual(bagAfterTypedBbt(existing, null, undefined), { energy: 'low' });
    assert.equal(bagAfterTypedBbt(existing, 36.5, undefined), undefined);
    assert.equal(bagAfterTypedBbt(existing, undefined, undefined), undefined);
    assert.deepEqual(bagAfterTypedBbt(existing, 36.7, { bbtSource: 'health', energy: 'high' }), { energy: 'high' });
    assert.deepEqual(withoutImportKeys({ bbtSource: 'health', wristTempDelta: 0.2, energy: 'low' }), { energy: 'low' });
  });

  it('a day with only imported temperature draws no „logged“ dot; anything she logged does', () => {
    const imported = { date: '2026-09-15', bbt: 36.5, observations: { bbtSource: 'health', wristTempDelta: 0.1 } };
    const typed = { date: '2026-09-16', bbt: 36.5, observations: {} };
    const withMood = { date: '2026-09-17', moods: ['calm'], observations: { wristTempDelta: 0.1 } };
    assert.equal(onlyImportedTemperature(imported), true);
    assert.equal(onlyImportedTemperature(typed), false);
    assert.equal(onlyImportedTemperature(withMood), false);
    const cal = overlayLogsOnCalendar({}, [imported, typed, withMood]);
    assert.equal(cal['2026-09-15'], undefined);
    assert.equal(cal['2026-09-16'].logged, true);
    assert.equal(cal['2026-09-17'].logged, true);
  });
});

describe('registry: bbtSource and wristTempDelta', () => {
  it('SENSITIVE bag keys, never AI / partner / analytics / doctor summary', () => {
    for (const key of ['bbtSource', 'wristTempDelta']) {
      const def = getObservationDef(key);
      assert.ok(def, key);
      assert.equal(def.storage, STORAGE.OBSERVATIONS);
      assert.equal(def.sensitivity, SENSITIVITY.SENSITIVE);
      assert.equal(def.aiDefaultAllowed, false);
      assert.equal(def.partnerDefaultAllowed, false);
      assert.equal(def.analyticsAllowed, false);
      assert.equal(def.doctorSummary, 'EXCLUDE');
    }
  });

  it('the bag accepts them in range only', () => {
    assert.deepEqual(parseObservationBag({ bbtSource: 'health', wristTempDelta: 0.234 }), { bbtSource: 'health', wristTempDelta: 0.23 });
    assert.deepEqual(parseObservationBag({ bbtSource: 'apple', wristTempDelta: 9 }), {});
    assert.throws(() => parseObservationBag({ wristTempDelta: '0.2' }, { strict: true }));
    assert.deepEqual(mergeObservationBag({ wristTempDelta: 0.2, energy: 'low' }, { energy: 'high' }), { wristTempDelta: 0.2, energy: 'high' });
  });

  it('never reaches the AI line or the partner payload', () => {
    const log = { date: '2026-09-15', bbt: null, observations: { bbtSource: 'health', wristTempDelta: 0.3 } };
    const line = JSON.stringify(serializeCycleLogForAi(log) ?? '');
    assert.doesNotMatch(line, /wristTempDelta|bbtSource|0\.3/);
    const payload = buildPartnerPayload({
      today: '2026-09-15',
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: START, avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: [log],
    });
    assert.equal(partnerPayloadHasLeak(payload), false);
    assert.doesNotMatch(JSON.stringify(payload), /wristTempDelta|bbtSource|pastOvulations/);
    assert.equal(partnerPayloadHasLeak({ ...payload, x: { wristTempDelta: 0.3 } }), true);
  });
});

it('shiftKey is a civil-day shift', () => {
  assert.equal(shiftKey('2026-03-01', -1), '2026-02-28');
});
