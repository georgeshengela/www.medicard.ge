import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildPredictions, inferCycleStats } from './cycle.js';
import { applyEndPeriodToLogs, planEndPeriod } from './cyclePeriod.js';
import { derivePeriodStatus, trimEndedPeriodProjection, typicalPeriodLength } from './cyclePeriodStatus.js';

const START = '2026-09-01';

function logs(rows) {
  return rows.map(([date, flow]) => ({ date, flow, symptoms: [], moods: [] }));
}

/** Bleeding on START + each offset (0 = day 1). */
function bleedDays(offsets, flow = 'medium') {
  return logs(offsets.map((i) => [addDays(START, i), flow]));
}

function status(rows, todayOffset, typicalLength = 5, mode = 'TRACK_PERIOD') {
  const ranges = inferCycleStats(rows).periodRanges;
  return derivePeriodStatus({ ranges, logs: rows, today: addDays(START, todayOffset), typicalLength, mode });
}

describe('period status — auto end at the typical length', () => {
  it('a one-tap start stays active through the usual length, asks once, then ends by itself', () => {
    const rows = bleedDays([0]);
    for (let day = 1; day <= 5; day += 1) {
      const s = status(rows, day - 1);
      assert.equal(s.state, 'active', `day ${day}`);
      assert.equal(s.day, day);
      assert.equal(s.autoEnded, false);
    }
    const ask = status(rows, 5);
    assert.equal(ask.state, 'askStill');
    assert.equal(ask.day, 6);
    assert.equal(ask.typicalLength, 5);
    const ended = status(rows, 6);
    assert.equal(ended.state, 'ended');
    assert.equal(ended.autoEnded, true);
    assert.equal(ended.day, null);
    // The run's end is its last logged bleeding day — nothing was invented.
    assert.equal(ended.lastBleed, START);
  });

  it('follows the typical length it is given (default 5, clamped 2–10)', () => {
    const rows = bleedDays([0, 1, 2]);
    assert.equal(status(rows, 3, 4).state, 'active');
    assert.equal(status(rows, 4, 4).state, 'askStill');
    assert.equal(status(rows, 5, 4).state, 'ended');
    assert.equal(typicalPeriodLength(undefined), 5);
    assert.equal(typicalPeriodLength(1), 2);
    assert.equal(typicalPeriodLength(14), 10);
    assert.equal(typicalPeriodLength(6.4), 6);
  });

  it('writes nothing — a later bleeding log simply extends the run again', () => {
    const rows = bleedDays([0, 1]);
    assert.equal(status(rows, 7).state, 'ended');
    const extended = [...rows, ...bleedDays([6])];
    // Day 7 bleeding joins the run? No — the gap is longer than the merge rule, so it is a new run.
    assert.equal(status(extended, 6).start, addDays(START, 6));
    // Within the merge rule (≤ 2 unlogged days) the same run continues and is active again.
    const joined = [...rows, ...bleedDays([4])];
    const s = status(joined, 5);
    assert.equal(s.start, START);
    assert.equal(s.lastBleed, addDays(START, 4));
    assert.equal(s.state, 'askStill');
  });
});

describe('period status — „still bleeding“ answer', () => {
  it('a bleeding log on the question day keeps the run active that day, and asks again the next', () => {
    const rows = [...bleedDays([0, 1, 2, 3, 4]), ...bleedDays([5], 'light')];
    const today = status(rows, 5);
    assert.equal(today.state, 'active');
    assert.equal(today.day, 6);
    const tomorrow = status(rows, 6);
    assert.equal(tomorrow.state, 'askStill');
    assert.equal(tomorrow.day, 7);
    assert.equal(status(rows, 7).state, 'ended');
    assert.equal(status(rows, 7).autoEnded, true);
  });

  it('logging past the usual length moves the question to the day after the last bleeding day', () => {
    const rows = bleedDays([0, 1, 2, 3, 4, 5, 6]);
    assert.equal(status(rows, 6).state, 'active');
    assert.equal(status(rows, 7).state, 'askStill');
    assert.equal(status(rows, 8).state, 'ended');
  });
});

describe('period status — explicit end', () => {
  for (const flow of ['none', 'spotting']) {
    it(`„${flow}“ after the last bleeding day ends the run at once`, () => {
      const rows = [...bleedDays([0, 1, 2]), ...logs([[addDays(START, 3), flow]])];
      for (const offset of [3, 4, 5, 6]) {
        const s = status(rows, offset);
        assert.equal(s.state, 'ended');
        assert.equal(s.autoEnded, false);
      }
    });
  }

  it('a „none“ logged in the future does not count yet', () => {
    const rows = [...bleedDays([0, 1]), ...logs([[addDays(START, 4), 'none']])];
    assert.equal(status(rows, 2).state, 'active');
  });

  it('„დასრულდა“ on a bleeding day keeps that day as „none“ so the question never comes back', () => {
    const rows = bleedDays([0, 1, 2, 3]);
    const plan = planEndPeriod({ ranges: inferCycleStats(rows).periodRanges, logs: rows, endDate: addDays(START, 3) });
    assert.equal(plan.markNone, addDays(START, 3));
    const after = applyEndPeriodToLogs(rows, plan);
    assert.equal(after.find((l) => l.date === addDays(START, 3)).flow, 'none');
    assert.equal(status(after, 5).state, 'ended');
    assert.equal(status(after, 5).autoEnded, false);
  });

  it('„დასრულდა“ on the question day (nothing logged today) records „none“ for today', () => {
    const rows = bleedDays([0, 1, 2]);
    const plan = planEndPeriod({ ranges: inferCycleStats(rows).periodRanges, logs: rows, endDate: addDays(START, 5) });
    assert.deepEqual(plan.clear, []);
    assert.equal(plan.markNone, addDays(START, 5));
    const after = applyEndPeriodToLogs(rows, plan);
    assert.equal(status(after, 5).state, 'ended');
    assert.equal(status(after, 5).autoEnded, false);
  });

  it('ending day 1 (the undo of a one-tap start) still clears the day, no „none“ left behind', () => {
    const rows = bleedDays([0]);
    const plan = planEndPeriod({ ranges: inferCycleStats(rows).periodRanges, logs: rows, endDate: START });
    assert.equal(plan.markNone, null);
    assert.deepEqual(applyEndPeriodToLogs(rows, plan), []);
  });
});

describe('period status — long runs and modes', () => {
  it('a run longer than 7 days is flagged and is never auto-ended while bleeding is logged', () => {
    const rows = bleedDays([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const s = status(rows, 8);
    assert.equal(s.state, 'active');
    assert.equal(s.longRun, true);
    assert.equal(s.day, 9);
    assert.equal(status(rows, 9).state, 'askStill');
    assert.equal(status(rows, 9).longRun, true);
    assert.equal(status(bleedDays([0, 1, 2]), 2).longRun, false);
  });

  it('no status in pregnancy / postpartum, or without any logged run', () => {
    const rows = bleedDays([0]);
    assert.equal(status(rows, 1, 5, 'PREGNANCY'), null);
    assert.equal(status(rows, 1, 5, 'POSTPARTUM'), null);
    assert.equal(status(rows, 1, 5, 'TRY_TO_CONCEIVE').state, 'active');
    assert.equal(status(rows, 1, 5, 'PERIMENOPAUSE').state, 'active');
    assert.equal(derivePeriodStatus({ ranges: [], logs: [], today: START }), null);
    assert.equal(derivePeriodStatus({ ranges: inferCycleStats(rows).periodRanges, logs: rows, today: null }), null);
  });
});

describe('ended period — projection trim', () => {
  it('drops the expected days after the last bleeding day of an ended period, nothing else', () => {
    const rows = [...bleedDays([0, 1]), ...logs([[addDays(START, 2), 'none']])];
    const predictions = buildPredictions({ lastPeriodStart: START, avgCycleLength: 28, avgPeriodLength: 5, logs: rows, today: addDays(START, 3) });
    const s = status(rows, 3);
    assert.equal(s.state, 'ended');
    const trimmed = trimEndedPeriodProjection(predictions.calendar, s, { lastPeriodStart: START, periodLength: 5 });
    assert.equal(predictions.calendar[addDays(START, 3)].period, true);
    assert.equal(trimmed[addDays(START, 3)]?.period, undefined);
    assert.equal(trimmed[addDays(START, 4)]?.period, undefined);
    // Logged days and the next cycle's projection stay as they were.
    assert.equal(trimmed[START].period, true);
    assert.equal(trimmed[START].predicted, false);
    assert.equal(trimmed[addDays(START, 28)].period, true);
    assert.equal(trimmed[addDays(START, 28)].predicted, true);
    // Phase words stay on the trimmed days.
    assert.ok(trimmed[addDays(START, 3)]?.phase);
  });

  it('leaves the calendar alone while the period is active or the question is open', () => {
    const rows = bleedDays([0]);
    const predictions = buildPredictions({ lastPeriodStart: START, avgCycleLength: 28, avgPeriodLength: 5, logs: rows, today: addDays(START, 2) });
    for (const offset of [2, 5]) {
      const s = status(rows, offset);
      assert.equal(trimEndedPeriodProjection(predictions.calendar, s, { lastPeriodStart: START, periodLength: 5 }), predictions.calendar);
    }
  });
});
