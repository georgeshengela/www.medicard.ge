import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, inferCycleStats, pickLastPeriodStart } from './cycle.js';

function logs(rows) {
  return rows.map(([date, flow]) => ({ date, flow, symptoms: [], moods: [] }));
}

describe('period segmentation matrix', () => {
  it('A: consecutive medium stays one episode', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'medium'],
      ['2026-03-03', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01']);
    assert.deepEqual(inferred.periodRanges, [
      { start: '2026-03-01', end: '2026-03-03', lengthDays: 3, source: 'logged' },
    ]);
  });

  it('B: one missing day inside an episode does not split LMP', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-03', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01']);
    assert.equal(inferred.periodRanges[0].end, '2026-03-03');
    assert.equal(inferred.lastPeriodStart, '2026-03-01');
  });

  it('C: explicit none is a new episode, not a logging gap', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'none'],
      ['2026-03-03', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01', '2026-03-03']);
  });

  it('D: spotting between bleed days bridges one interior day; spotting still does not start a period', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'spotting'],
      ['2026-03-03', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01']);
    assert.equal(inferCycleStats(logs([['2026-03-02', 'spotting']])).periodStarts.length, 0);
  });

  it('E: two missing days do not merge', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-04', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01', '2026-03-04']);
  });

  it('F: heavy / light / missing / light stays one episode', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'heavy'],
      ['2026-03-02', 'light'],
      ['2026-03-04', 'light'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01']);
    assert.equal(inferred.periodRanges[0].end, '2026-03-04');
  });

  it('G: one-day isolated flow stays its own range', () => {
    const inferred = inferCycleStats(logs([['2026-04-01', 'heavy']]));
    assert.deepEqual(inferred.periodRanges, [
      { start: '2026-04-01', end: '2026-04-01', lengthDays: 1, source: 'logged' },
    ]);
    assert.equal(inferred.inferredPeriodLength, null);
  });

  it('H: mistaken one-day flow 15 days later is a separate start, not a valid cycle gap', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'medium'],
      ['2026-03-16', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01', '2026-03-16']);
    assert.equal(inferred.cycleCount, 0);
  });

  it('I: a true new period after 18+ days stays two episodes', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-29', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01', '2026-03-29']);
    assert.equal(inferred.cycleCount, 1);
  });

  it('J: a 10-day consecutive bleed is one episode', () => {
    const rows = [];
    let d = '2026-03-01';
    for (let i = 0; i < 10; i += 1) {
      rows.push([d, 'medium']);
      d = addDays(d, 1);
    }
    const inferred = inferCycleStats(logs(rows));
    assert.equal(inferred.periodStarts.length, 1);
    assert.equal(inferred.periodRanges[0].lengthDays, 10);
  });

  it('K: very long consecutive bleed stays one logged episode and is excluded from period average', () => {
    const rows = [];
    let d = '2026-03-01';
    for (let i = 0; i < 18; i += 1) {
      rows.push([d, 'heavy']);
      d = addDays(d, 1);
    }
    const inferred = inferCycleStats(logs(rows));
    assert.equal(inferred.periodStarts.length, 1);
    assert.equal(inferred.periodRanges[0].lengthDays, 18);
    assert.equal(inferred.inferredPeriodLength, null);
  });

  it('L: historical none in the middle splits; restoring flow merges; missing stays merged', () => {
    const split = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'none'],
      ['2026-03-03', 'medium'],
      ['2026-03-04', 'medium'],
    ]));
    assert.deepEqual(split.periodStarts, ['2026-03-01', '2026-03-03']);

    const restored = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'medium'],
      ['2026-03-03', 'medium'],
      ['2026-03-04', 'medium'],
    ]));
    assert.deepEqual(restored.periodStarts, ['2026-03-01']);

    const skipped = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-03', 'medium'],
      ['2026-03-04', 'medium'],
    ]));
    assert.deepEqual(skipped.periodStarts, ['2026-03-01']);
    assert.equal(
      pickLastPeriodStart(null, logs([
        ['2026-03-01', 'medium'],
        ['2026-03-03', 'medium'],
        ['2026-03-04', 'medium'],
      ])),
      '2026-03-01',
    );
  });

  it('does not invent an 11-day period by bridging a gap past the envelope', () => {
    const days = [];
    let d = '2026-03-01';
    for (let i = 0; i < 9; i += 1) {
      days.push([d, 'medium']);
      d = addDays(d, 1);
    }
    days.push(['2026-03-11', 'medium']);
    const inferred = inferCycleStats(logs(days));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01', '2026-03-11']);
  });

  it('null flow on a row is missing, not explicit none, and may bridge', () => {
    const inferred = inferCycleStats(logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', null],
      ['2026-03-03', 'medium'],
    ]));
    assert.deepEqual(inferred.periodStarts, ['2026-03-01']);
  });

  it('is idempotent', () => {
    const rows = logs([
      ['2026-03-01', 'medium'],
      ['2026-03-03', 'medium'],
      ['2026-03-29', 'medium'],
    ]);
    assert.deepEqual(inferCycleStats(rows), inferCycleStats(rows));
  });
});
