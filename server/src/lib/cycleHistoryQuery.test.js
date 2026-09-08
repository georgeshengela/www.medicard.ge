import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, inferCycleStats } from './cycle.js';
import {
  CYCLE_DISPLAY_LOG_LIMIT,
  CYCLE_ENGINE_HISTORY_DAYS,
  filterLogsForEngine,
  naiveRecentWindow,
} from './cycleHistoryQuery.js';

function dayLog(date, flow = 'none') {
  return { date, flow, symptoms: flow === 'none' ? ['cramps'] : [], moods: [] };
}

function historyYears(years, today = '2026-09-01') {
  const logs = [];
  const start = addDays(today, -(365 * years) + 1);
  let cursor = start;
  let offset = 0;
  while (cursor <= today) {
    logs.push(dayLog(cursor, offset % 28 < 5 ? 'medium' : 'none'));
    cursor = addDays(cursor, 1);
    offset += 1;
  }
  return logs;
}

describe('cycle history windows', () => {
  it('naive take:400 drops old period starts when daily symptom rows fill the window', () => {
    const logs = historyYears(2, '2026-09-01');
    const naive = naiveRecentWindow(logs, CYCLE_DISPLAY_LOG_LIMIT);
    const naiveInferred = inferCycleStats(naive);
    const engine = filterLogsForEngine(logs, '2026-09-01');
    const engineInferred = inferCycleStats(engine);
    assert.ok(logs.length > CYCLE_DISPLAY_LOG_LIMIT);
    assert.equal(naive.length, CYCLE_DISPLAY_LOG_LIMIT);
    assert.ok(engineInferred.periodStarts[0] < naiveInferred.periodStarts[0]);
    assert.ok(engineInferred.cycleCount > naiveInferred.cycleCount);
  });

  it('1 / 2 / 5 year synthetic histories keep LMP and in-band gaps without rewriting raw logs', () => {
    for (const years of [1, 2, 5]) {
      const today = '2026-09-01';
      const logs = historyYears(years, today);
      const t0 = Date.now();
      const inferred = inferCycleStats(filterLogsForEngine(logs, today));
      const ms = Date.now() - t0;
      assert.ok(inferred.lastPeriodStart);
      assert.ok(inferred.cycleCount >= Math.min(years * 10, 10), `${years}y count ${inferred.cycleCount}`);
      assert.equal(logs.find((l) => l.date === inferred.lastPeriodStart)?.flow, 'medium');
      assert.ok(ms < 250, `${years}y infer ${ms}ms`);
    }
  });

  it('engine cutoff is 5 civil years, not 400 rows', () => {
    assert.equal(CYCLE_ENGINE_HISTORY_DAYS, 365 * 5);
    assert.equal(filterLogsForEngine([dayLog('2020-01-01', 'medium')], '2026-09-01').length, 0);
    assert.equal(filterLogsForEngine([dayLog('2022-09-01', 'medium')], '2026-09-01').length, 1);
  });

  it('6 / 24 / 60 cycle-start histories infer in well under 50ms', () => {
    for (const cycles of [6, 24, 60]) {
      const logs = [];
      let d = '2020-01-01';
      for (let i = 0; i < cycles; i += 1) {
        logs.push(dayLog(d, 'medium'));
        d = addDays(d, 28);
      }
      const t0 = Date.now();
      const inferred = inferCycleStats(logs);
      const ms = Date.now() - t0;
      assert.equal(inferred.periodStarts.length, cycles);
      assert.ok(ms < 50, `${cycles} cycles ${ms}ms`);
    }
  });
});
