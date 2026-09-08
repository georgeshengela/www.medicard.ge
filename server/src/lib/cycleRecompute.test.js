import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPredictions,
  detectLatePeriod,
  emptyCycleAiCache,
  inferCycleStats,
  pickLastPeriodStart,
} from './cycle.js';

function logs(rows) {
  return rows.map(([date, flow]) => ({ date, flow, symptoms: [], moods: [] }));
}

function forecast(inferred) {
  return buildPredictions({
    lastPeriodStart: inferred.lastPeriodStart,
    avgCycleLength: inferred.inferredCycleLength || inferred.avgCycleLength,
    avgPeriodLength: inferred.inferredPeriodLength || inferred.avgPeriodLength,
    cycleCount: inferred.cycleCount,
    cycleLengths: inferred.cycleGaps,
  });
}

describe('historical correction recompute', () => {
  it('flow → none splits an episode and moves LMP', () => {
    const before = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'medium'],
      ['2026-03-03', 'medium'],
    ]));
    assert.deepEqual(before.periodStarts, ['2026-03-01']);
    const after = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'none'],
      ['2026-03-03', 'medium'],
    ]));
    assert.deepEqual(after.periodStarts, ['2026-03-01', '2026-03-03']);
    assert.equal(after.lastPeriodStart, '2026-03-03');
    assert.notEqual(forecast(before).nextPeriodStart, forecast(after).nextPeriodStart);
  });

  it('none/missing → flow merges and keeps a stable LMP', () => {
    const missing = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-03', 'medium'],
    ]));
    const restored = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'medium'],
      ['2026-03-03', 'medium'],
    ]));
    assert.equal(missing.lastPeriodStart, '2026-03-01');
    assert.equal(restored.lastPeriodStart, '2026-03-01');
    assert.deepEqual(missing.periodStarts, restored.periodStarts);
    assert.equal(pickLastPeriodStart('2026-03-03', logs([
      ['2026-03-01', 'medium'],
      ['2026-03-03', 'medium'],
    ])), '2026-03-01');
  });

  it('rebuilds confidence, fertile, and ovulation from the new structure', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23', '2026-05-21', '2026-06-18'];
    const inferred = inferCycleStats(starts.map((date) => ({ date, flow: 'medium', symptoms: [], moods: [] })));
    const pred = forecast(inferred);
    assert.equal(pred.confidence, 'high');
    assert.equal(pred.nextPeriodStart, '2026-07-16');
    assert.ok(pred.ovulationDate);
    assert.ok(pred.fertileWindow?.start);
    assert.equal(pred.estimated, true);
  });

  it('always exposes an empty AI cache shape for write invalidation', () => {
    assert.deepEqual(emptyCycleAiCache(), { aiInsights: null, aiInsightsAt: null });
    assert.deepEqual(emptyCycleAiCache(), emptyCycleAiCache());
  });

  it('does not duplicate derived periods on repeated inference', () => {
    const rows = logs([
      ['2026-03-01', 'medium'],
      ['2026-03-03', 'medium'],
      ['2026-03-29', 'medium'],
    ]);
    const a = inferCycleStats(rows);
    const b = inferCycleStats(rows);
    assert.deepEqual(a.periodStarts, ['2026-03-01', '2026-03-29']);
    assert.deepEqual(a, b);
    assert.equal(a.periodStarts.length, new Set(a.periodStarts).size);
  });

  it('late status follows the corrected LMP and never requests a push', () => {
    const stale = inferCycleStats(logs([['2026-01-01', 'medium']]));
    const stalePred = forecast(stale);
    const late = detectLatePeriod({
      today: '2026-02-20',
      profile: { mode: 'TRACK_PERIOD' },
      logs: logs([['2026-01-01', 'medium']]),
      predictions: stalePred,
      inferred: stale,
    });
    assert.equal(late.status, 'late');
    assert.equal(late.notifyEligible, false);

    const correctedLogs = logs([['2026-02-01', 'medium']]);
    const corrected = inferCycleStats(correctedLogs);
    const onTime = detectLatePeriod({
      today: '2026-02-20',
      profile: { mode: 'TRACK_PERIOD' },
      logs: correctedLogs,
      predictions: forecast(corrected),
      inferred: corrected,
    });
    assert.equal(onTime.status, 'unknown');
    assert.equal(onTime.notifyEligible, false);
  });
});
