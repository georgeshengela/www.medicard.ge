import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildDoctorSummary,
  buildPredictions,
  cycleLengthStats,
  inferCycleStats,
  isPeriodFlow,
  overlayLogsOnCalendar,
  pickLastPeriodStart,
  predictionConfidence,
} from './cycle.js';

function logs(rows) {
  return rows.map(([date, flow]) => ({ date, flow, symptoms: [], moods: [] }));
}

describe('isPeriodFlow', () => {
  it('treats spotting as not a period', () => {
    assert.equal(isPeriodFlow('spotting'), false);
    assert.equal(isPeriodFlow('none'), false);
    assert.equal(isPeriodFlow(null), false);
    assert.equal(isPeriodFlow('light'), true);
    assert.equal(isPeriodFlow('medium'), true);
    assert.equal(isPeriodFlow('heavy'), true);
  });
});

describe('inferCycleStats', () => {
  it('uses fallbacks when history is missing', () => {
    const stats = inferCycleStats([], 28, 5);
    assert.equal(stats.avgCycleLength, 28);
    assert.equal(stats.avgPeriodLength, 5);
    assert.equal(stats.lastPeriodStart, null);
    assert.deepEqual(stats.periodStarts, []);
  });

  it('does not start a period from spotting only', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-01-01', 'spotting'],
        ['2026-01-02', 'spotting'],
        ['2026-01-20', 'spotting'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, []);
    assert.equal(stats.lastPeriodStart, null);
  });

  it('infers a 28-day cycle from two gaps', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-01-02', 'medium'],
        ['2026-01-03', 'light'],
        ['2026-01-29', 'medium'],
        ['2026-01-30', 'medium'],
        ['2026-02-26', 'heavy'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, ['2026-01-01', '2026-01-29', '2026-02-26']);
    assert.equal(stats.avgCycleLength, 28);
    assert.equal(stats.lastPeriodStart, '2026-02-26');
    assert.equal(stats.avgPeriodLength, 3);
  });

  it('infers 21-day and 35-day cycles from valid gaps', () => {
    const short = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-01-22', 'medium'],
        ['2026-02-12', 'medium'],
      ]),
    );
    assert.equal(short.avgCycleLength, 21);

    const long = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-02-05', 'medium'],
        ['2026-03-12', 'medium'],
      ]),
    );
    assert.equal(long.avgCycleLength, 35);
  });

  it('ignores irregular gaps outside 18–45 when averaging', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-01-10', 'medium'],
        ['2026-02-07', 'medium'],
        ['2026-03-07', 'medium'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, ['2026-01-01', '2026-01-10', '2026-02-07', '2026-03-07']);
    assert.equal(stats.avgCycleLength, 28);
  });

  it('uses fallback averages with only one period start (insufficient data)', () => {
    const stats = inferCycleStats(logs([['2026-03-01', 'medium']]), 28, 5);
    assert.deepEqual(stats.periodStarts, ['2026-03-01']);
    assert.equal(stats.lastPeriodStart, '2026-03-01');
    assert.equal(stats.avgCycleLength, 28);
    assert.equal(stats.avgPeriodLength, 5);
  });

  it('rewinds a run start when an earlier same-run bleed is logged', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-03-02', 'medium'],
        ['2026-03-03', 'medium'],
        ['2026-03-01', 'light'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, ['2026-03-01']);
    assert.equal(stats.lastPeriodStart, '2026-03-01');
  });
});

describe('pickLastPeriodStart', () => {
  it('keeps onboarding start when logs have no bleed', () => {
    assert.equal(pickLastPeriodStart('2026-02-01', logs([['2026-02-03', 'spotting']])), '2026-02-01');
    assert.equal(pickLastPeriodStart('2026-02-01', []), '2026-02-01');
  });

  it('does not let an older missed period steal the latest start', () => {
    const next = pickLastPeriodStart(
      '2026-03-01',
      logs([
        ['2026-01-05', 'medium'],
        ['2026-01-06', 'medium'],
        ['2026-03-01', 'medium'],
        ['2026-03-02', 'medium'],
      ]),
    );
    assert.equal(next, '2026-03-01');
  });

  it('moves last start earlier when the current run is edited', () => {
    const next = pickLastPeriodStart(
      '2026-03-02',
      logs([
        ['2026-03-01', 'medium'],
        ['2026-03-02', 'medium'],
      ]),
    );
    assert.equal(next, '2026-03-01');
  });
});

describe('buildPredictions', () => {
  it('returns empty calendar without a last period start', () => {
    const pred = buildPredictions({ lastPeriodStart: null });
    assert.equal(pred.nextPeriodStart, null);
    assert.deepEqual(pred.calendar, {});
  });

  it('marks forecast period days as predicted until logs overlay them', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    assert.equal(pred.calendar['2026-03-01'].period, true);
    assert.equal(pred.calendar['2026-03-01'].predicted, true);
    assert.equal(pred.calendar['2026-03-02'].predicted, true);
    assert.equal(pred.nextPeriodStart, '2026-03-29');
    assert.equal(pred.ovulationDate, '2026-03-15');
    assert.deepEqual(pred.fertileWindow, { start: '2026-03-10', end: '2026-03-16' });
  });

  it('keeps future cycles predicted', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    assert.equal(pred.calendar['2026-03-29'].predicted, true);
    assert.equal(pred.calendar['2026-03-29'].period, true);
  });

  it('still estimates when the irregular flag is on', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 32,
      avgPeriodLength: 5,
    });
    assert.equal(pred.nextPeriodStart, '2026-04-02');
    assert.equal(pred.ovulationDate, '2026-03-19');
    assert.equal(predictionConfidence({ cycleCount: 4, isIrregular: true }), 'low');
    const summary = buildDoctorSummary({
      profile: {
        mode: 'TRACK_PERIOD',
        avgCycleLength: 32,
        avgPeriodLength: 5,
        isIrregular: true,
      },
      logs: logs([
        ['2026-01-04', 'medium'],
        ['2026-02-01', 'medium'],
        ['2026-03-01', 'medium'],
      ]),
      predictions: pred,
    });
    assert.equal(summary.cycleCount, 2);
    assert.equal(summary.confidence, 'low');
    assert.equal(summary.nextPeriodStart, '2026-04-02');
  });
});

describe('overlayLogsOnCalendar', () => {
  it('marks logged bleed predicted:false and leaves forecast predicted:true', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const calendar = overlayLogsOnCalendar(pred.calendar, logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'light'],
    ]));
    assert.equal(calendar['2026-03-01'].predicted, false);
    assert.equal(calendar['2026-03-01'].period, true);
    assert.equal(calendar['2026-03-01'].logged, true);
    assert.equal(calendar['2026-03-03'].predicted, true);
    assert.equal(calendar['2026-03-03'].period, true);
    assert.equal(calendar['2026-03-29'].predicted, true);
  });

  it('treats spotting as logged, not a period day', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const calendar = overlayLogsOnCalendar(pred.calendar, logs([['2026-03-01', 'spotting']]));
    assert.equal(calendar['2026-03-01'].logged, true);
    assert.equal(calendar['2026-03-01'].period, false);
    assert.equal(calendar['2026-03-01'].flow, 'spotting');
  });
});

describe('cycleLengthStats + confidence', () => {
  it('computes shortest, longest, and range', () => {
    const stats = cycleLengthStats([
      { start: '2026-01-01', length: 26 },
      { start: '2026-01-27', length: 30 },
      { start: '2026-02-26', length: 28 },
    ]);
    assert.equal(stats.shortest, 26);
    assert.equal(stats.longest, 30);
    assert.equal(stats.variability, 4);
    assert.equal(stats.count, 3);
  });

  it('returns low confidence for one cycle or irregular flag', () => {
    assert.equal(predictionConfidence({ cycleCount: 0 }), 'low');
    assert.equal(predictionConfidence({ cycleCount: 1 }), 'low');
    assert.equal(predictionConfidence({ cycleCount: 4, isIrregular: true }), 'low');
    assert.equal(predictionConfidence({ cycleCount: 3 }), 'medium');
    assert.equal(predictionConfidence({ cycleCount: 6 }), 'high');
  });
});

describe('addDays', () => {
  it('stays on calendar days', () => {
    assert.equal(addDays('2026-01-30', 2), '2026-02-01');
  });
});
