import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildCycleTrends, inferCycleStats } from './cycle.js';
import { buildCycleComparison, medianDays } from './cycleComparison.js';

function bleed(start, days = 4) {
  return Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' }));
}

function starts(first, lengths) {
  const out = [first];
  for (const n of lengths) out.push(addDays(out[out.length - 1], n));
  return out;
}

function history(first, lengths, periodDays = 4) {
  const s = starts(first, lengths);
  const logs = s.flatMap((d) => bleed(d, periodDays));
  return { s, logs, inferred: inferCycleStats(logs) };
}

describe('cycle comparison („ბოლო ციკლები“)', () => {
  it('median rounds to whole days', () => {
    assert.equal(medianDays([28, 29]), 29);
    assert.equal(medianDays([31, 27, 28]), 28);
    assert.equal(medianDays([]), null);
  });

  it('the last 6 completed cycles with their period days, oldest first', () => {
    const { s, inferred } = history('2026-01-01', [27, 28, 30, 28, 29, 28, 31], 5);
    const cmp = buildCycleComparison({
      mode: 'TRACK_PERIOD',
      periodStarts: inferred.periodStarts,
      periodRanges: inferred.periodRanges,
      hiddenStarts: [],
    });
    assert.equal(cmp.cycles.length, 6);
    assert.deepEqual(cmp.cycles.map((c) => c.length), [28, 30, 28, 29, 28, 31]);
    assert.equal(cmp.cycles[0].start, s[1]);
    assert.equal(cmp.cycles[0].end, addDays(s[2], -1));
    assert.ok(cmp.cycles.every((c) => c.periodDays === 5));
    assert.equal(cmp.cycles.at(-1).latest, true);
    assert.equal(cmp.cycles.filter((c) => c.latest).length, 1);
    // latest 31 vs median of the five before it (28 28 28 29 30 → 28)
    assert.equal(cmp.latestDays, 31);
    assert.equal(cmp.usualDays, 28);
    assert.equal(cmp.diffDays, 3);
  });

  it('agrees with the stats / Home cycle lengths (same cycles, same order)', () => {
    const { inferred, logs } = history('2026-01-01', [27, 50, 30, 28, 29]);
    const trends = buildCycleTrends({ profile: { isIrregular: false }, logs, inferred, averages: {}, today: '2026-08-01' });
    const cmp = buildCycleComparison({ mode: 'TRACK_PERIOD', periodStarts: inferred.periodStarts, periodRanges: inferred.periodRanges });
    assert.deepEqual(cmp.cycles.map((c) => c.length), trends.cycleLengths.map((c) => c.length).slice(-6));
  });

  it('hidden cycles are left out', () => {
    const { s, inferred } = history('2026-01-01', [28, 29, 40, 28]);
    const cmp = buildCycleComparison({
      mode: 'TRACK_PERIOD',
      periodStarts: inferred.periodStarts,
      periodRanges: inferred.periodRanges,
      hiddenStarts: [s[2]],
    });
    assert.deepEqual(cmp.cycles.map((c) => c.length), [28, 29, 28]);
    assert.equal(cmp.cycles.some((c) => c.start === s[2]), false);
  });

  it('two cycles: bars, but no comparison with her usual yet', () => {
    const { inferred } = history('2026-01-01', [28, 31]);
    const cmp = buildCycleComparison({ mode: 'TRY_TO_CONCEIVE', periodStarts: inferred.periodStarts, periodRanges: inferred.periodRanges });
    assert.equal(cmp.cycles.length, 2);
    assert.equal(cmp.usualDays, null);
    assert.equal(cmp.diffDays, null);
  });

  it('fewer than 2 cycles, pregnancy and postpartum: null', () => {
    const one = history('2026-01-01', [28]);
    assert.equal(buildCycleComparison({ mode: 'TRACK_PERIOD', periodStarts: one.inferred.periodStarts }), null);
    const many = history('2026-01-01', [28, 29, 30]);
    assert.equal(buildCycleComparison({ mode: 'PREGNANCY', periodStarts: many.inferred.periodStarts }), null);
    assert.equal(buildCycleComparison({ mode: 'POSTPARTUM', periodStarts: many.inferred.periodStarts }), null);
  });

  it('perimenopause keeps long cycles the period modes leave out', () => {
    const { inferred, s } = history('2025-10-01', [24, 31, 62, 29]);
    const today = addDays(s[s.length - 1], 5);
    const track = buildCycleComparison({ mode: 'TRACK_PERIOD', periodStarts: inferred.periodStarts, periodRanges: inferred.periodRanges, today });
    const peri = buildCycleComparison({ mode: 'PERIMENOPAUSE', periodStarts: inferred.periodStarts, periodRanges: inferred.periodRanges, today });
    assert.deepEqual(track.cycles.map((c) => c.length), [24, 31, 29]);
    assert.deepEqual(peri.cycles.map((c) => c.length), [24, 31, 62, 29]);
    assert.equal(peri.usualDays, 31);
    assert.equal(peri.diffDays, -2);
  });

  it('period days never exceed the cycle', () => {
    const cmp = buildCycleComparison({
      mode: 'TRACK_PERIOD',
      periodStarts: ['2026-01-01', '2026-01-20', '2026-02-10'],
      periodRanges: [{ start: '2026-01-01', end: '2026-01-25', lengthDays: 25 }],
    });
    assert.equal(cmp.cycles[0].periodDays, 19);
    assert.equal(cmp.cycles[1].periodDays, 0);
  });
});
