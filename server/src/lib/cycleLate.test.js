import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildCycleAlerts,
  buildPredictions,
  detectLatePeriod,
  inferCycleStats,
  LATE_FALLBACK_DAYS_SINCE_FLOW,
} from './cycle.js';
import { latePeriodAlertKa } from './cycleHonesty.js';
import { interpretContraception } from './cycleContraception.js';

function startsToLogs(starts) {
  return starts.map((date) => ({ date, flow: 'medium', symptoms: [], moods: [] }));
}

function regularHistory(lmp, length, count) {
  const starts = [];
  let d = lmp;
  for (let i = 0; i < count; i += 1) {
    starts.unshift(d);
    d = addDays(d, -length);
  }
  return starts;
}

function pack({ lmp, length = 28, starts = 7, today, isIrregular = false, contraceptionMethod = 'NONE' }) {
  const periodStarts = regularHistory(lmp, length, starts);
  const logs = startsToLogs(periodStarts);
  const inferred = inferCycleStats(logs);
  const predictions = buildPredictions({
    lastPeriodStart: lmp,
    avgCycleLength: length,
    avgPeriodLength: 5,
    cycleCount: inferred.cycleCount,
    cycleLengths: inferred.cycleGaps,
    isIrregular,
  });
  const profile = { mode: 'TRACK_PERIOD', isIrregular, contraceptionMethod, conditions: [] };
  return { logs, inferred, predictions, profile, today };
}

describe('detectLatePeriod', () => {
  it('A: regular 28-day user on predicted day 29 is not late', () => {
    const ctx = pack({ lmp: '2026-03-01', length: 28, today: '2026-03-29' });
    assert.equal(ctx.predictions.nextPeriodStart, '2026-03-29');
    assert.equal(detectLatePeriod({ ...ctx }).status, 'on_time');
  });

  it('B: regular 28-day high-confidence user on day 32 is late', () => {
    const ctx = pack({ lmp: '2026-03-01', length: 28, today: '2026-04-01' });
    const late = detectLatePeriod({ ...ctx });
    assert.equal(late.status, 'late');
    assert.equal(late.reason, 'predicted');
    assert.equal(late.notifyEligible, false);
  });

  it('C: regular 21-day user on day 25 is late under a personalized predicted start', () => {
    const ctx = pack({ lmp: '2026-03-01', length: 21, today: '2026-03-25' });
    assert.equal(ctx.predictions.nextPeriodStart, '2026-03-22');
    assert.equal(detectLatePeriod({ ...ctx }).status, 'late');
  });

  it('D: regular 35-day user on day 38 is not late', () => {
    const ctx = pack({ lmp: '2026-03-01', length: 35, today: '2026-04-07' });
    assert.equal(ctx.predictions.nextPeriodStart, '2026-04-05');
    assert.equal(detectLatePeriod({ ...ctx }).status, 'on_time');
  });

  it('E: irregular flag uses a wide grace and is not aggressive on day 32', () => {
    const ctx = pack({ lmp: '2026-03-01', length: 28, today: '2026-04-01', isIrregular: true });
    const late = detectLatePeriod({ ...ctx });
    assert.equal(late.status, 'on_time');
    assert.equal(late.reason, 'within_wide_grace');
  });

  it('F: low-history user is unknown until 45 days since last flow', () => {
    const logs = startsToLogs(['2026-01-01']);
    const inferred = inferCycleStats(logs);
    const early = detectLatePeriod({
      today: '2026-02-12',
      profile: { mode: 'TRACK_PERIOD', isIrregular: false },
      logs,
      predictions: { nextPeriodStart: '2026-01-29', confidence: 'low' },
      inferred,
    });
    assert.equal(early.status, 'unknown');
    const late = detectLatePeriod({
      today: addDays('2026-01-01', LATE_FALLBACK_DAYS_SINCE_FLOW),
      profile: { mode: 'TRACK_PERIOD', isIrregular: false },
      logs,
      predictions: { confidence: 'low' },
      inferred,
    });
    assert.equal(late.status, 'late');
    assert.equal(late.reason, 'low_history_fallback');
  });

  it('G: LIMITED contraception still allows a period-late status without fertility claims', () => {
    const ctx = pack({ lmp: '2026-03-01', length: 28, today: '2026-04-01', contraceptionMethod: 'COMBINED_PILL' });
    const contra = interpretContraception({ contraceptionMethod: 'COMBINED_PILL' });
    assert.equal(contra.predictionAvailability, 'LIMITED');
    assert.equal(detectLatePeriod({ ...ctx }).status, 'late');
    assert.doesNotMatch(latePeriodAlertKa(), /ორსულ|ნაყოფიერ|ოვულაც/);
  });

  it('H: a pregnancy-sized silence is late as a cycle deviation, not a pregnancy claim', () => {
    const logs = startsToLogs(['2025-01-01']);
    const late = detectLatePeriod({
      today: '2025-10-08',
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      predictions: { confidence: 'low' },
      inferred: inferCycleStats(logs),
    });
    assert.equal(late.status, 'late');
    assert.doesNotMatch(latePeriodAlertKa(), /ორსულ/);
  });

  it('I: correcting LMP forward clears a stale late status', () => {
    const old = pack({ lmp: '2026-01-01', length: 28, today: '2026-02-10' });
    assert.equal(detectLatePeriod({ ...old }).status, 'late');
    const corrected = pack({ lmp: '2026-02-01', length: 28, today: '2026-02-10' });
    assert.equal(detectLatePeriod({ ...corrected }).status, 'on_time');
  });

  it('does not imply pregnancy in alert copy or engine status', () => {
    assert.doesNotMatch(latePeriodAlertKa(), /ორსულ|გადაუდებ|საშიში/);
    const alerts = buildCycleAlerts({
      profile: { mode: 'TRACK_PERIOD', isIrregular: false, conditions: [] },
      logs: startsToLogs(['2026-01-01']),
      predictions: { confidence: 'low' },
      inferred: inferCycleStats(startsToLogs(['2026-01-01'])),
      today: '2026-02-15',
    });
    const late = alerts.find((a) => a.messageKa.includes('გვიანია'));
    assert.ok(late);
    assert.equal(late.late.notifyEligible, false);
    assert.doesNotMatch(late.messageKa, /ორსულ/);
  });
});
