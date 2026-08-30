import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildCycleAiUserPrompt,
  buildCycleTrends,
  buildDoctorSummary,
  buildPredictions,
  inferCycleStats,
  overlayLogsOnCalendar,
  toDateKey,
} from './cycle.js';
import {
  applyEndPeriodToLogs,
  assertCycleDateKey,
  eachDateKey,
  isValidCycleDateKey,
  observedFlowSamples,
  planEndPeriod,
  planFillRange,
  planStartPeriod,
} from './cyclePeriod.js';

function logs(rows) {
  return rows.map(([date, flow]) => ({ date, flow, symptoms: [], moods: [] }));
}

describe('cycle date keys', () => {
  it('accepts real calendar days and rejects impossible ones', () => {
    assert.equal(isValidCycleDateKey('2026-08-10'), true);
    assert.equal(isValidCycleDateKey('2024-02-29'), true);
    assert.equal(isValidCycleDateKey('2026-02-29'), false);
    assert.equal(isValidCycleDateKey('2026-13-01'), false);
    assert.equal(isValidCycleDateKey('2026-08-32'), false);
    assert.equal(isValidCycleDateKey('08-10-2026'), false);
    assert.equal(isValidCycleDateKey('2026-08-10T00:00:00.000Z'), false);
  });

  it('rejects future dates against an explicit today', () => {
    assert.doesNotThrow(() => assertCycleDateKey('2026-08-10', '2026-08-10'));
    assert.throws(() => assertCycleDateKey('2026-08-11', '2026-08-10'), /მომავალი/);
  });

  it('walks inclusive ranges across month and year boundaries', () => {
    assert.deepEqual(eachDateKey('2026-01-30', '2026-02-02'), [
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
    assert.deepEqual(eachDateKey('2025-12-30', '2026-01-02'), [
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
    assert.deepEqual(eachDateKey('2024-02-28', '2024-03-01'), [
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });
});

describe('start period plan', () => {
  it('writes medium on a new day and is idempotent when bleed already exists', () => {
    const first = planStartPeriod('2026-08-10', null);
    assert.equal(first.alreadyLogged, false);
    assert.equal(first.flow, 'medium');
    const again = planStartPeriod('2026-08-10', 'light');
    assert.equal(again.alreadyLogged, true);
    assert.equal(again.flow, 'light');
  });
});

function endPeriod(existing, endDate) {
  const ranges = inferCycleStats(existing).periodRanges;
  const plan = planEndPeriod({ ranges, logs: existing, endDate });
  return { plan, next: applyEndPeriodToLogs(existing, plan) };
}

const TRACK_PROFILE = {
  mode: 'TRACK_PERIOD',
  lastPeriodStart: '2026-08-10',
  avgCycleLength: 28,
  avgPeriodLength: 5,
  isIrregular: false,
};

describe('end period plan', () => {
  it('does not invent medium flow for unlogged days between start and end', () => {
    const existing = logs([['2026-08-10', 'medium']]);
    const { plan, next } = endPeriod(existing, '2026-08-14');
    assert.equal(plan.start, '2026-08-10');
    assert.deepEqual(plan.fill, []);
    assert.deepEqual(plan.clear, []);
    assert.deepEqual(plan.unlogged, ['2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']);
    assert.deepEqual(
      next.map((l) => [l.date, l.flow]),
      [['2026-08-10', 'medium']],
    );
    assert.deepEqual(inferCycleStats(next).periodRanges, [
      { start: '2026-08-10', end: '2026-08-10', lengthDays: 1, source: 'logged' },
    ]);
  });

  it('preserves already logged flow and does not overwrite it', () => {
    const existing = logs([
      ['2026-08-10', 'light'],
      ['2026-08-11', 'heavy'],
    ]);
    const { plan, next } = endPeriod(existing, '2026-08-14');
    assert.deepEqual(plan.fill, []);
    assert.deepEqual(
      next.map((l) => [l.date, l.flow]),
      [
        ['2026-08-10', 'light'],
        ['2026-08-11', 'heavy'],
      ],
    );
  });

  it('shortens a range by clearing bleed after the new end', () => {
    const existing = logs([
      ['2026-08-10', 'light'],
      ['2026-08-11', 'medium'],
      ['2026-08-12', 'heavy'],
      ['2026-08-13', 'medium'],
      ['2026-08-14', 'light'],
    ]);
    const { plan, next } = endPeriod(existing, '2026-08-13');
    assert.deepEqual(plan.fill, []);
    assert.deepEqual(plan.clear, ['2026-08-14']);
    assert.deepEqual(
      next.map((l) => [l.date, l.flow]),
      [
        ['2026-08-10', 'light'],
        ['2026-08-11', 'medium'],
        ['2026-08-12', 'heavy'],
        ['2026-08-13', 'medium'],
      ],
    );
  });

  it('refuses to apply a plan that still wants synthetic fill', () => {
    assert.throws(
      () => applyEndPeriodToLogs(logs([['2026-08-10', 'medium']]), { fill: ['2026-08-11'], clear: [] }),
      /must not synthesize/,
    );
  });
});

describe('end period does not leak synthetic flow', () => {
  it('keeps doctor summary, trends, AI, and health export on observed days only', () => {
    const existing = logs([['2026-08-10', 'medium']]);
    const { next } = endPeriod(existing, '2026-08-14');
    const predictions = buildPredictions({
      lastPeriodStart: '2026-08-10',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const summary = buildDoctorSummary({
      profile: TRACK_PROFILE,
      logs: next,
      predictions,
    });
    assert.equal(summary.periodDaysLogged, 1);
    assert.equal(summary.loggedDays, 1);

    const inferred = inferCycleStats(next);
    const trends = buildCycleTrends({
      profile: TRACK_PROFILE,
      logs: next,
      inferred,
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2026-08-14',
    });
    assert.deepEqual(trends.periodStarts, ['2026-08-10']);

    const ai = buildCycleAiUserPrompt({
      profile: TRACK_PROFILE,
      logs: next,
      predictions,
      pregnancy: null,
      user: { age: 28 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2026-08-14',
    });
    assert.match(ai, /2026-08-10: flow=medium/);
    assert.doesNotMatch(ai, /2026-08-11: flow=/);
    assert.doesNotMatch(ai, /2026-08-12: flow=/);
    assert.doesNotMatch(ai, /2026-08-13: flow=/);
    assert.doesNotMatch(ai, /2026-08-14: flow=/);

    assert.deepEqual(observedFlowSamples(next), [{ date: '2026-08-10', flow: 'medium' }]);
  });
});

describe('fill range plan', () => {
  it('does not overwrite an existing flow level', () => {
    const existing = logs([['2026-08-10', 'light'], ['2026-08-12', 'heavy']]);
    const plan = planFillRange('2026-08-10', '2026-08-12', existing, 'medium');
    assert.deepEqual(plan.fill, ['2026-08-11']);
  });
});

describe('period range inference extras', () => {
  it('keeps 1 / 3 / 7 day ranges and ignores spotting', () => {
    const one = inferCycleStats(logs([['2026-05-01', 'light']]));
    assert.deepEqual(one.periodRanges, [
      { start: '2026-05-01', end: '2026-05-01', lengthDays: 1, source: 'logged' },
    ]);

    const three = inferCycleStats(
      logs([
        ['2026-05-01', 'light'],
        ['2026-05-02', 'medium'],
        ['2026-05-03', 'heavy'],
      ]),
    );
    assert.equal(three.periodRanges[0].lengthDays, 3);

    const seven = inferCycleStats(
      logs([
        ['2026-06-01', 'light'],
        ['2026-06-02', 'medium'],
        ['2026-06-03', 'heavy'],
        ['2026-06-04', 'medium'],
        ['2026-06-05', 'medium'],
        ['2026-06-06', 'light'],
        ['2026-06-07', 'light'],
      ]),
    );
    assert.equal(seven.periodRanges[0].lengthDays, 7);
  });

  it('splits after deleting the middle day', () => {
    const afterDelete = inferCycleStats(
      logs([
        ['2026-08-10', 'light'],
        ['2026-08-11', 'medium'],
        ['2026-08-13', 'medium'],
        ['2026-08-14', 'light'],
      ]),
    );
    assert.deepEqual(afterDelete.periodRanges, [
      { start: '2026-08-10', end: '2026-08-11', lengthDays: 2, source: 'logged' },
      { start: '2026-08-13', end: '2026-08-14', lengthDays: 2, source: 'logged' },
    ]);
  });

  it('crosses month and year boundaries', () => {
    const month = inferCycleStats(
      logs([
        ['2026-01-30', 'medium'],
        ['2026-01-31', 'medium'],
        ['2026-02-01', 'light'],
      ]),
    );
    assert.deepEqual(month.periodRanges[0], {
      start: '2026-01-30',
      end: '2026-02-01',
      lengthDays: 3,
      source: 'logged',
    });

    const year = inferCycleStats(
      logs([
        ['2025-12-31', 'heavy'],
        ['2026-01-01', 'medium'],
      ]),
    );
    assert.equal(year.periodRanges[0].start, '2025-12-31');
    assert.equal(year.periodRanges[0].end, '2026-01-01');
  });
});

describe('historical correction updates predictions', () => {
  it('moves next period when the latest LMP changes', () => {
    const first = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const corrected = buildPredictions({
      lastPeriodStart: '2026-08-04',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    assert.equal(first.nextPeriodStart, '2026-08-29');
    assert.equal(corrected.nextPeriodStart, '2026-09-01');
    assert.notEqual(first.nextPeriodStart, corrected.nextPeriodStart);
  });

  it('keeps actual overlay marks predicted=false after a correction', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-08-04',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const calendar = overlayLogsOnCalendar(pred.calendar, logs([['2026-08-04', 'medium']]));
    assert.equal(calendar['2026-08-04'].predicted, false);
    assert.equal(calendar['2026-08-04'].estimated, false);
    assert.equal(calendar[addDays('2026-08-04', 28)].predicted, true);
    assert.equal(calendar[addDays('2026-08-04', 28)].estimated, true);
  });
});

describe('midnight / timezone date identity', () => {
  it('does not shift a YYYY-MM-DD key through a Date conversion', () => {
    assert.equal(toDateKey('2026-08-10'), '2026-08-10');
    assert.equal(toDateKey(new Date('2026-08-10T00:00:00.000Z')), '2026-08-10');
  });
});
