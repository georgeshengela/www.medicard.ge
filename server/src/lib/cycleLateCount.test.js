import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPredictions, detectCyclePhase } from './cycle.js';

/** 2026-09-29 audit: a late cycle must keep counting and must not keep painting a missed forecast. */
describe('late cycle keeps counting', () => {
  const base = { lastPeriodStart: '2026-08-20', avgCycleLength: 28, avgPeriodLength: 5 };

  it('today never wraps back to "day 4 · period" without a logged bleed', () => {
    const p = detectCyclePhase({ ...base, today: '2026-09-20' });
    assert.equal(p.day, 32);
    assert.equal(p.phase, 'luteal');
  });

  it('forecast stamping still wraps when asked', () => {
    const p = detectCyclePhase({ ...base, today: '2026-09-20', wrap: true });
    assert.equal(p.day, 4);
    assert.equal(p.phase, 'period');
  });

  it('missed predicted period days are cleared and no cycles are projected past it', () => {
    const p = buildPredictions({ ...base, today: '2026-09-29' });
    assert.equal(p.late, true);
    assert.equal(p.nextPeriodStart, '2026-09-17');
    assert.equal(p.calendar['2026-09-18']?.period, undefined);
    assert.equal(p.calendar['2026-09-29']?.cycleDay, 41);
    assert.equal(p.calendar['2026-10-15'], undefined);
  });

  it('on time: forecasts are unchanged', () => {
    const p = buildPredictions({ lastPeriodStart: '2026-09-12', avgCycleLength: 28, avgPeriodLength: 5, today: '2026-09-29' });
    assert.equal(p.late, false);
    assert.equal(p.calendar['2026-10-10']?.period, true);
    assert.equal(p.calendar['2026-10-10']?.predicted, true);
  });

  it('a logged bleed on a forecast day stays logged even when late', () => {
    const p = buildPredictions({ ...base, today: '2026-09-29', logs: [{ date: '2026-09-18', flow: 'spotting' }] });
    assert.notEqual(p.calendar['2026-09-18'], undefined);
  });
});

import { pickLastPeriodStart, resolveLastPeriodStart } from './cycle.js';

describe('last period start: manual vs logged (2026-09-29 audit)', () => {
  const bleed = (d) => ({ date: d, flow: 'medium' });

  it('a newer manually set start is not overridden by an older logged period', () => {
    assert.equal(pickLastPeriodStart('2026-09-20', [bleed('2026-06-01'), bleed('2026-06-02')]), '2026-09-20');
  });

  it('a stored date right after a logged run is still stale (not a new period)', () => {
    assert.equal(resolveLastPeriodStart('2026-03-04', '2026-03-01', '2026-03-03'), '2026-03-01');
  });

  it('deleting the log behind the stored start drops that start', () => {
    assert.equal(pickLastPeriodStart('2026-09-20', [], undefined, undefined, ['2026-09-20']), null);
    assert.equal(
      pickLastPeriodStart('2026-09-20', [bleed('2026-08-22')], undefined, undefined, ['2026-09-20']),
      '2026-08-22',
    );
  });

  it('an untouched onboarding start with no logs is kept', () => {
    assert.equal(pickLastPeriodStart('2026-09-20', [], undefined, undefined, ['2026-09-25']), '2026-09-20');
  });
});

describe('short cycles (2026-09-29 audit)', () => {
  it('the fertile window never overlaps the projected period', () => {
    const p = buildPredictions({ lastPeriodStart: '2026-09-01', avgCycleLength: 21, avgPeriodLength: 7 });
    assert.equal(p.fertileWindow.start, '2026-09-08');
    assert.equal(p.calendar['2026-09-04']?.fertile, undefined);
  });
  it('a 28-day cycle keeps the classic ovulation −5 … +1 window', () => {
    const p = buildPredictions({ lastPeriodStart: '2026-09-01', avgCycleLength: 28, avgPeriodLength: 5 });
    assert.deepEqual(p.fertileWindow, { start: '2026-09-10', end: '2026-09-16' });
  });
});
