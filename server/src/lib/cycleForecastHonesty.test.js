import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildCycleAiUserPrompt,
  buildLocalInsights,
  buildPredictions,
  daysBetween,
  detectCyclePhase,
  detectLatePeriod,
  inferCycleStats,
} from './cycle.js';
import {
  FERTILITY_MIN_CYCLES,
  FERTILITY_STATUS,
  OVULATION_SOURCE,
  TTC_WIDE_WINDOW_DAYS,
  alignPhaseWithForecast,
  cycleOvulationSignal,
  fertilityGate,
  nextPeriodRange,
  ovulationBand,
} from './cycleForecastHonesty.js';
import {
  getObservationDef,
  observationAiAllowed,
  observationPartnerAllowed,
  parseObservationBag,
  SENSITIVITY,
  STORAGE,
  VALUE_TYPES,
} from './cycleObservationRegistry.js';
import { parseObservationWrite } from './cycleObservations.js';
import { serializeCycleLogForAi } from './cycleAiContext.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { ttcWindowBody } from './cycleHonesty.js';
import { fertilityGate as mobileFertilityGate, FERTILITY_MIN_CYCLES as MOBILE_MIN } from '../../../mobile/src/lib/cycleForecastEligibility.js';

const LMP = '2026-09-01';

// Same table as mobile/src/lib/cycleForecastEligibility.test.js („3-cycle gate — shared cases“).
const GATE_CASES = [
  { cycleCount: 0, mode: 'TRACK_PERIOD', status: 'LEARNING', completed: 0 },
  { cycleCount: 2, mode: 'TRACK_PERIOD', status: 'LEARNING', completed: 2 },
  { cycleCount: 2.9, mode: null, status: 'LEARNING', completed: 2 },
  { cycleCount: 3, mode: 'TRACK_PERIOD', status: 'READY', completed: 3 },
  { cycleCount: 6, mode: 'TRY_TO_CONCEIVE', status: 'READY', completed: 6 },
  { cycleCount: 0, mode: 'TRY_TO_CONCEIVE', status: 'WIDE', completed: 0 },
  { cycleCount: 1, mode: 'TRY_TO_CONCEIVE', status: 'WIDE', completed: 1 },
  { cycleCount: undefined, mode: 'PERIMENOPAUSE', status: 'LEARNING', completed: 0 },
  { cycleCount: -4, mode: 'TRACK_PERIOD', status: 'LEARNING', completed: 0 },
];

function fertileKeys(calendar) {
  return Object.keys(calendar).filter((k) => calendar[k].fertile).sort();
}
function ovulationKeys(calendar) {
  return Object.keys(calendar).filter((k) => calendar[k].ovulation).sort();
}

describe('3-cycle gate — shared cases', () => {
  it('server rule and mobile mirror agree case by case', () => {
    assert.equal(FERTILITY_MIN_CYCLES, 3);
    assert.equal(MOBILE_MIN, FERTILITY_MIN_CYCLES);
    for (const row of GATE_CASES) {
      const server = fertilityGate({ cycleCount: row.cycleCount, mode: row.mode });
      const mobile = mobileFertilityGate({ cycleCount: row.cycleCount, mode: row.mode });
      assert.equal(server.status, row.status, JSON.stringify(row));
      assert.equal(server.completedCycles, row.completed, JSON.stringify(row));
      assert.deepEqual(mobile, server, JSON.stringify(row));
    }
  });
});

describe('LEARNING (< 3 completed cycles, not TTC)', () => {
  const p = buildPredictions({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 2, mode: 'TRACK_PERIOD' });

  it('announces no fertile window and no ovulation', () => {
    assert.equal(p.fertility.status, FERTILITY_STATUS.LEARNING);
    assert.equal(p.fertility.completedCycles, 2);
    assert.equal(p.fertility.requiredCycles, 3);
    assert.equal(p.fertileWindow, null);
    assert.equal(p.ovulationDate, null);
    assert.equal(p.ovulationRange, null);
    assert.deepEqual(fertileKeys(p.calendar), []);
    assert.deepEqual(ovulationKeys(p.calendar), []);
    assert.ok(p.phases.every((ph) => ph.fertileStart == null && ph.ovulation == null));
  });

  it('keeps the next period and never says fertile / ovulation in the phase words', () => {
    assert.equal(p.nextPeriodStart, '2026-09-29');
    const words = new Set(Object.values(p.calendar).map((m) => m.phase));
    assert.equal(words.has('fertile'), false);
    assert.equal(words.has('ovulation'), false);
    // Follicular up to the calendar ovulation day, luteal after it.
    assert.equal(p.calendar['2026-09-15'].phase, 'follicular');
    assert.equal(p.calendar['2026-09-16'].phase, 'luteal');
    const today = alignPhaseWithForecast(
      detectCyclePhase({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, today: '2026-09-13' }),
      p,
      '2026-09-13',
    );
    assert.equal(today.phase, 'follicular');
  });

  it('local insights and the AI context do not mention a fertile window', () => {
    const profile = { mode: 'TRACK_PERIOD', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false, conditions: [] };
    const insights = buildLocalInsights({ profile, logs: [], predictions: p, pregnancy: null, averages: { usedCycleLength: 28, usedPeriodLength: 5 }, today: '2026-09-13' });
    assert.doesNotMatch(JSON.stringify(insights), /ნაყოფიერი/);
    const prompt = buildCycleAiUserPrompt({ profile, logs: [], predictions: p, pregnancy: null, user: { age: 30 }, averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'inferred' }, today: '2026-09-13' });
    assert.match(prompt, /სავარაუდო ნაყოფიერი ფანჯარა: —/);
    assert.match(prompt, /2\/3 სრული ციკლი/);
  });

  it('history days stamped with the gate never read fertile', () => {
    const stamped = buildPredictions({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 0 });
    assert.equal(Object.values(stamped.calendar).some((m) => m.phase === 'fertile' || m.phase === 'ovulation'), false);
  });
});

describe('READY (≥ 3 cycles): ovulation is a 3-day band', () => {
  const p = buildPredictions({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 6, cycleLengths: [28, 28, 28, 28, 28, 28] });

  it('keeps the classic window and adds the band beside the old single date', () => {
    assert.equal(p.fertility.status, FERTILITY_STATUS.READY);
    assert.equal(p.fertility.window, 'standard');
    assert.equal(p.fertility.ovulationSource, OVULATION_SOURCE.CALENDAR);
    assert.equal(p.ovulationDate, '2026-09-15');
    assert.deepEqual(p.ovulationRange, { start: '2026-09-14', end: '2026-09-16' });
    assert.deepEqual(p.fertileWindow, { start: '2026-09-10', end: '2026-09-16' });
    assert.deepEqual(ovulationKeys(p.calendar).filter((k) => k < '2026-09-29'), ['2026-09-14', '2026-09-15', '2026-09-16']);
    for (const key of ['2026-09-14', '2026-09-15', '2026-09-16']) assert.equal(p.calendar[key].phase, 'ovulation');
    assert.equal(p.calendar['2026-09-13'].phase, 'fertile');
    assert.equal(p.calendar['2026-09-17'].phase, 'luteal');
    assert.equal(p.nextPeriodRange, null);
  });

  it('the TTC copy names a 3-day range, never one date', () => {
    const body = ttcWindowBody(p, { cautious: false, pcos: false }, 'ka');
    assert.match(body, /სავარაუდო ოვულაცია: 14 სექტემბერი 2026 – 16 სექტემბერი 2026/);
  });
});

describe('TTC before 3 cycles: one wide window', () => {
  const p = buildPredictions({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 1, mode: 'TRY_TO_CONCEIVE' });

  it('shows ~14 fertile days and no ovulation day', () => {
    assert.equal(p.fertility.status, FERTILITY_STATUS.WIDE);
    assert.equal(p.fertility.window, 'wide');
    assert.equal(p.ovulationDate, null);
    assert.equal(p.ovulationRange, null);
    assert.deepEqual(p.fertileWindow, { start: '2026-09-06', end: '2026-09-19' });
    assert.equal(daysBetween(p.fertileWindow.start, p.fertileWindow.end) + 1, TTC_WIDE_WINDOW_DAYS);
    assert.deepEqual(ovulationKeys(p.calendar), []);
    assert.equal(fertileKeys(p.calendar).filter((k) => k < '2026-09-29').length, TTC_WIDE_WINDOW_DAYS);
    assert.match(ttcWindowBody(p, {}, 'ka'), /ფართო დიაპაზონი, სანამ 3 ციკლს დავითვლით/);
  });

  it('never covers the projected period on a short cycle', () => {
    const short = buildPredictions({ lastPeriodStart: LMP, avgCycleLength: 22, avgPeriodLength: 6, cycleCount: 0, mode: 'TRY_TO_CONCEIVE' });
    assert.ok(short.fertileWindow.start > '2026-09-06');
    assert.ok(short.fertileWindow.end < '2026-09-23');
  });
});

describe('her own signals: OPK and the manual mark', () => {
  const base = { lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, cycleCount: 6, today: '2026-09-20' };

  it('a positive OPK on day D centres this cycle on D + 1 („OPK-ის მიხედვით“)', () => {
    const logs = [{ date: '2026-09-17', ovulationTest: 'positive' }];
    const p = buildPredictions({ ...base, logs });
    assert.equal(p.fertility.ovulationSource, OVULATION_SOURCE.OPK);
    assert.equal(p.ovulationDate, '2026-09-18');
    assert.deepEqual(p.ovulationRange, ovulationBand('2026-09-18') && { start: '2026-09-17', end: '2026-09-19' });
    assert.deepEqual(p.fertileWindow, { start: '2026-09-13', end: '2026-09-19' });
    // The next-period estimate is the cycle length, not moved by the test.
    assert.equal(p.nextPeriodStart, '2026-09-29');
    assert.match(ttcWindowBody(p, {}, 'ka'), /OPK-ის მიხედვით/);
  });

  it('negative and unclear tests change nothing', () => {
    const logs = [
      { date: '2026-09-12', ovulationTest: 'negative' },
      { date: '2026-09-13', ovulationTest: 'unclear' },
    ];
    const p = buildPredictions({ ...base, logs });
    assert.equal(p.fertility.ovulationSource, OVULATION_SOURCE.CALENDAR);
    assert.equal(p.ovulationDate, '2026-09-15');
  });

  it('the first positive of the cycle is the surge; earlier cycles do not count', () => {
    const logs = [
      { date: '2026-08-20', ovulationTest: 'positive' },
      { date: '2026-09-16', ovulationTest: 'positive' },
      { date: '2026-09-17', ovulationTest: 'positive' },
    ];
    assert.deepEqual(cycleOvulationSignal(logs, { from: LMP, to: '2026-09-20' }), { date: '2026-09-17', source: 'opk', logDate: '2026-09-16' });
  });

  it('a manual mark wins over OPK („შენი აღნიშვნით“)', () => {
    const logs = [
      { date: '2026-09-17', ovulationTest: 'positive' },
      { date: '2026-09-20', observations: { ovulationMarked: true } },
    ];
    const p = buildPredictions({ ...base, logs });
    assert.equal(p.fertility.ovulationSource, OVULATION_SOURCE.MANUAL);
    assert.equal(p.ovulationDate, '2026-09-20');
    assert.deepEqual(p.ovulationRange, { start: '2026-09-19', end: '2026-09-21' });
    assert.match(ttcWindowBody(p, {}, 'ka'), /შენი აღნიშვნით/);
    assert.match(ttcWindowBody(p, {}, 'en'), /from your own mark/);
  });

  it('her own signal is shown even before the gate opens; the partner view never uses it', () => {
    const logs = [{ date: '2026-09-17', ovulationTest: 'positive' }];
    const learning = buildPredictions({ ...base, cycleCount: 1, logs });
    assert.equal(learning.fertility.status, FERTILITY_STATUS.LEARNING);
    assert.equal(learning.fertility.ovulationSource, OVULATION_SOURCE.OPK);
    assert.deepEqual(learning.ovulationRange, { start: '2026-09-17', end: '2026-09-19' });
    const partner = buildPredictions({ ...base, logs, useOvulationSignals: false });
    assert.equal(partner.ovulationDate, '2026-09-15');
  });

  it('a mark on the bleeding day that opened the cycle is ignored', () => {
    const logs = [{ date: LMP, flow: 'heavy', observations: { ovulationMarked: true } }];
    assert.equal(cycleOvulationSignal(logs, { from: LMP }), null);
  });
});

describe('ovulationMarked observation', () => {
  it('is registered: SENSITIVE, never AI / partner / analytics', () => {
    const def = getObservationDef('ovulationMarked');
    assert.ok(def);
    assert.equal(def.sensitivity, SENSITIVITY.SENSITIVE);
    assert.equal(def.storage, STORAGE.OBSERVATIONS);
    assert.equal(def.valueType, VALUE_TYPES.BOOLEAN);
    assert.equal(def.aiDefaultAllowed, false);
    assert.equal(def.partnerDefaultAllowed, false);
    assert.equal(def.analyticsAllowed, false);
    assert.equal(observationAiAllowed('ovulationMarked'), false);
    assert.equal(observationPartnerAllowed('ovulationMarked'), false);
  });

  it('the JSON bag accepts it (boolean only) and still rejects unknown keys', () => {
    assert.deepEqual(parseObservationBag({ ovulationMarked: true }, { strict: true }), { ovulationMarked: true });
    assert.throws(() => parseObservationBag({ ovulationMarked: 'yes' }, { strict: true }));
    assert.throws(() => parseObservationBag({ ovulationMarkedd: true }, { strict: true }));
    const written = parseObservationWrite({ observations: { energy: null, ovulationMarked: true } }, { observations: { energy: 'low' } });
    assert.deepEqual(written.observations, { ovulationMarked: true });
    const cleared = parseObservationWrite({ observations: { ovulationMarked: null } }, { observations: { ovulationMarked: true, energy: 'low' } });
    assert.deepEqual(cleared.observations, { energy: 'low' });
    // An older build that only sends energy keeps the mark.
    const older = parseObservationWrite({ observations: { energy: 'high' } }, { observations: { ovulationMarked: true } });
    assert.deepEqual(older.observations, { ovulationMarked: true, energy: 'high' });
  });

  it('never reaches the AI line or the partner payload', () => {
    const log = { date: '2026-09-15', flow: null, symptoms: [], moods: [], observations: { ovulationMarked: true } };
    assert.doesNotMatch(JSON.stringify(serializeCycleLogForAi(log)), /ovulation|ოვულაც/i);
    const payload = buildPartnerPayload({
      today: '2026-09-15',
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: [log],
    });
    assert.equal(partnerPayloadHasLeak(payload), false);
    assert.equal(partnerPayloadHasLeak({ ...payload, x: { ovulationMarked: true } }), true);
  });
});

describe('variable cycles: next period as a window', () => {
  it('irregular with no history → ± 3 days; spread ≥ 8 → measured; regular → none', () => {
    assert.deepEqual(nextPeriodRange({ nextPeriodStart: '2026-10-01', isIrregular: true }), { from: '2026-09-28', to: '2026-10-04', reason: 'irregular' });
    assert.deepEqual(
      nextPeriodRange({ nextPeriodStart: '2026-10-01', cycleLengths: [26, 34, 29, 30], usedCycleLength: 30 }),
      { from: '2026-09-27', to: '2026-10-05', reason: 'spread' },
    );
    assert.equal(nextPeriodRange({ nextPeriodStart: '2026-10-01', cycleLengths: [27, 29, 28, 30], usedCycleLength: 28 }), null);
    assert.equal(nextPeriodRange({ nextPeriodStart: '2026-10-01', cycleLengths: [26, 34], usedCycleLength: 30 }).reason, 'spread');
    assert.equal(nextPeriodRange({ nextPeriodStart: '2026-10-01', cycleLengths: [27, 34], usedCycleLength: 30 }), null);
    // Never wider than a week each side.
    const wide = nextPeriodRange({ nextPeriodStart: '2026-10-01', cycleLengths: [21, 45], usedCycleLength: 33 });
    assert.deepEqual([wide.from, wide.to], ['2026-09-24', '2026-10-08']);
  });

  it('draws expected days over the whole window and is late only after its end', () => {
    const lengths = [26, 34, 29, 30, 25, 33];
    const args = { lastPeriodStart: LMP, avgCycleLength: 30, avgPeriodLength: 5, cycleCount: 6, cycleLengths: lengths };
    const p = buildPredictions({ ...args, today: '2026-09-20' });
    assert.equal(p.nextPeriodStart, '2026-10-01');
    // Typical 30: shortest 25 → 5 days before, longest 34 → 4 days after.
    assert.deepEqual(p.nextPeriodRange, { from: '2026-09-26', to: '2026-10-05' });
    for (let key = '2026-09-26'; key <= '2026-10-05'; key = addDays(key, 1)) {
      assert.equal(p.calendar[key]?.period, true, key);
      assert.equal(p.calendar[key]?.predicted, true, key);
    }
    // Inside the window after the single estimate: still this cycle, not late, marks kept.
    const open = buildPredictions({ ...args, today: '2026-10-03' });
    assert.equal(open.late, false);
    assert.equal(open.calendar['2026-10-05'].predicted, true);
    assert.equal(open.calendar['2026-10-03'].cycleDay, 33);
    const lateDay = buildPredictions({ ...args, today: '2026-10-06' });
    assert.equal(lateDay.late, true);
    assert.equal(lateDay.calendar['2026-10-02']?.predicted, undefined);
  });

  it('detectLatePeriod waits for the window end', () => {
    const starts = ['2026-03-01', '2026-03-27', '2026-04-30', '2026-05-29', '2026-06-28', '2026-07-23', '2026-08-25'];
    const logs = starts.map((date) => ({ date, flow: 'medium', symptoms: [], moods: [] }));
    const inferred = inferCycleStats(logs);
    const profile = { mode: 'TRACK_PERIOD', isIrregular: false, conditions: [] };
    const predictionsFor = (today) =>
      buildPredictions({
        lastPeriodStart: inferred.lastPeriodStart,
        avgCycleLength: inferred.avgCycleLength,
        avgPeriodLength: 5,
        cycleCount: inferred.cycleCount,
        cycleLengths: inferred.cycleGaps,
        today,
      });
    const range = predictionsFor('2026-09-20').nextPeriodRange;
    assert.ok(range, 'a spread ≥ 8 history gets a window');
    const inside = detectLatePeriod({ today: range.to, profile, logs, predictions: predictionsFor(range.to), inferred });
    assert.equal(inside.status, 'on_time');
    assert.equal(inside.reason, 'within_range');
    const after = addDays(range.to, 20);
    assert.equal(detectLatePeriod({ today: after, profile, logs, predictions: predictionsFor(after), inferred }).status, 'late');
  });
});
