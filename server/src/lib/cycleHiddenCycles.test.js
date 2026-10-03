// „ამ ციკლის დამალვა“ — Clue „Hide this cycle“ (brief §9 „მერე“ item 6). No database: raw-SQL storage
// with a fake client, the engine and every reader through their pure functions.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addDays,
  buildCycleAlerts,
  buildCycleTrends,
  buildPredictions,
  effectiveHiddenStarts,
  inferCycleStats,
  resolveForecastAverages,
} from './cycle.js';
import { evaluateCycleDeviations } from './cycleDeviations.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { buildHistoricalAnalytics } from './cycleHistoryAnalytics.js';
import { segmentHistoricalCycles } from './cycleHistory.js';
import { completedCycleIntervals } from './cyclePerimenopause.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import {
  MAX_HIDDEN_CYCLES,
  normalizeHiddenCycles,
  planHiddenCyclesUpdate,
  readCycleHiddenCycles,
  writeCycleHiddenCycles,
} from './cycleHiddenCycles.js';
import { cycleHiddenCyclesStatements } from '../../scripts/install-cycle-hidden-cycles.mjs';
import { profileUpdateSchema } from '../routes/cycle.routes.js';

const TODAY = '2026-10-03';

/** Periods of `lengths[i]` (default 5) days whose starts are `gaps` apart; the last starts `lastStartAgo` ago. */
function history(gaps, { lastStartAgo = 10, lengths = [] } = {}) {
  const starts = [addDays(TODAY, -lastStartAgo)];
  for (let i = gaps.length - 1; i >= 0; i -= 1) starts.unshift(addDays(starts[0], -gaps[i]));
  const logs = [];
  starts.forEach((start, i) => {
    const len = lengths[i] ?? 5;
    for (let d = 0; d < len; d += 1) logs.push({ date: addDays(start, d), flow: 'medium' });
  });
  return { starts, logs };
}

describe('engine: inferCycleStats with hidden cycles', () => {
  // 28, 28, 44 (ill), 28 — the third cycle is the atypical one.
  const h = history([28, 28, 44, 28], { lengths: [5, 5, 9, 5, 5] });
  const atypical = h.starts[2];

  it('without hidden cycles everything counts (unchanged behaviour)', () => {
    const s = inferCycleStats(h.logs);
    assert.deepEqual(s.cycleGaps, [28, 28, 44, 28]);
    assert.equal(s.cycleCount, 4);
    assert.equal(s.inferredCycleLength, 32);
    assert.equal(s.inferredPeriodLength, 6);
    assert.deepEqual(s.hiddenStarts, []);
    assert.ok(s.periodRanges.every((r) => !r.hidden));
  });

  it('a hidden cycle leaves the averages, gaps and count — never the logged period', () => {
    const s = inferCycleStats(h.logs, 28, 5, { hiddenStarts: [atypical] });
    assert.deepEqual(s.cycleGaps, [28, 28, 28]);
    assert.equal(s.cycleCount, 3);
    assert.equal(s.inferredCycleLength, 28);
    assert.equal(s.inferredPeriodLength, 5);
    assert.deepEqual(s.hiddenStarts, [atypical]);
    assert.deepEqual(s.periodStarts, h.starts, 'the period starts stay');
    assert.equal(s.periodRanges.length, 5);
    assert.equal(s.periodRanges.find((r) => r.start === atypical).hidden, true);
    assert.equal(s.lastPeriodStart, h.starts[4]);
  });

  it('unknown or stale dates are ignored', () => {
    const s = inferCycleStats(h.logs, 28, 5, { hiddenStarts: ['2020-01-01', addDays(atypical, 1), 'nope'] });
    assert.equal(s.cycleCount, 4);
    assert.deepEqual(s.hiddenStarts, []);
    assert.deepEqual(effectiveHiddenStarts(h.starts, [h.starts[1], h.starts[1], '2020-01-01']), [h.starts[1]]);
  });

  it('the 3-cycle fertility gate does NOT count a hidden cycle', () => {
    // Three completed cycles; hiding one leaves two → still learning, nothing fertile drawn.
    const three = history([28, 28, 28]);
    const predict = (inferred) => {
      const averages = resolveForecastAverages({ avgCycleLength: 28, avgPeriodLength: 5 }, inferred);
      return buildPredictions({
        lastPeriodStart: inferred.lastPeriodStart,
        avgCycleLength: averages.usedCycleLength,
        avgPeriodLength: averages.usedPeriodLength,
        cycleCount: averages.cycleCount,
        cycleLengths: inferred.cycleGaps,
        logs: three.logs,
        today: TODAY,
      });
    };
    assert.equal(predict(inferCycleStats(three.logs)).fertility.status, 'READY');
    const hid = predict(inferCycleStats(three.logs, 28, 5, { hiddenStarts: [three.starts[0]] }));
    assert.equal(hid.fertility.status, 'LEARNING');
    assert.equal(hid.fertility.completedCycles, 2);
    assert.equal(hid.fertileWindow, null);
  });

  it('averages switch back to the profile when fewer than 2 visible cycles remain', () => {
    const two = history([30, 30]);
    const hid = inferCycleStats(two.logs, 27, 4, { hiddenStarts: [two.starts[0]] });
    const averages = resolveForecastAverages({ avgCycleLength: 27, avgPeriodLength: 4 }, hid);
    assert.equal(averages.cycleCount, 1);
    assert.equal(averages.source, 'user');
    assert.equal(averages.usedCycleLength, 27);
  });

  it('an atypical cycle no longer widens the next-period window', () => {
    const wobbly = history([28, 28, 44, 28]);
    const predict = (hiddenStarts) => {
      const inferred = inferCycleStats(wobbly.logs, 28, 5, { hiddenStarts });
      const averages = resolveForecastAverages({}, inferred);
      return buildPredictions({
        lastPeriodStart: inferred.lastPeriodStart,
        avgCycleLength: averages.usedCycleLength,
        avgPeriodLength: averages.usedPeriodLength,
        cycleCount: averages.cycleCount,
        cycleLengths: inferred.cycleGaps,
        logs: wobbly.logs,
        today: TODAY,
      });
    };
    assert.ok(predict([]).nextPeriodRange, 'a 16-day spread → a window');
    assert.equal(predict([wobbly.starts[2]]).nextPeriodRange ?? null, null);
  });
});

describe('readers: trends, alerts, history, analytics, perimenopause', () => {
  const h = history([28, 28, 44, 28]);
  const atypical = h.starts[2];
  const inferred = inferCycleStats(h.logs, 28, 5, { hiddenStarts: [atypical] });

  it('trends leave the hidden length out of the points and the spread, and count it', () => {
    const t = buildCycleTrends({ profile: {}, logs: h.logs, inferred, averages: {}, today: TODAY });
    assert.deepEqual(t.cycleLengths.map((c) => c.length), [28, 28, 28]);
    assert.equal(t.variability, 0);
    assert.equal(t.hiddenCycleCount, 1);
    assert.deepEqual(t.periodStarts, h.starts);
  });

  it('a hidden last completed cycle raises no length alert', () => {
    const odd = history([28, 28, 50]);
    const alertsFor = (hiddenStarts) =>
      buildCycleAlerts({
        profile: {},
        logs: odd.logs,
        predictions: {},
        inferred: inferCycleStats(odd.logs, 28, 5, { hiddenStarts }),
        today: addDays(odd.starts[3], 2),
      });
    assert.equal(alertsFor([]).length, 1);
    assert.equal(alertsFor([odd.starts[2]]).length, 0);
  });

  it('history segmentation keeps the cycle but never as a pattern cycle', () => {
    const cycles = segmentHistoricalCycles(h.starts, { hiddenStarts: [atypical] });
    const row = cycles.find((c) => c.startDate === atypical);
    assert.equal(row.hidden, true);
    assert.equal(row.complete, true);
    assert.equal(row.validForPatterns, false);
    assert.equal(cycles.filter((c) => c.hidden).length, 1);
    assert.ok(segmentHistoricalCycles(h.starts).every((c) => c.hidden === false));
  });

  it('analytics: hidden cycles leave the stats and the completed count, stay marked in the list', () => {
    const a = buildHistoricalAnalytics({ logs: h.logs, inferred });
    assert.equal(a.completedCycleCount, 3);
    assert.equal(a.hiddenCycleCount, 1);
    assert.deepEqual(a.cycleLengths.map((c) => c.length), [28, 28, 28]);
    assert.equal(a.historicalCycles.find((c) => c.startDate === atypical).hidden, true);
    const plain = buildHistoricalAnalytics({ logs: h.logs, inferred: inferCycleStats(h.logs) });
    assert.equal(plain.completedCycleCount, 4);
    assert.ok(plain.historicalCycles.every((c) => !('hidden' in c)));
  });

  it('perimenopause intervals skip a hidden cycle', () => {
    const all = completedCycleIntervals(h.starts, { today: TODAY });
    const shown = completedCycleIntervals(h.starts, { today: TODAY, hiddenStarts: [atypical] });
    assert.equal(all.length, 4);
    assert.deepEqual(shown.map((r) => r.days), [28, 28, 28]);
  });
});

describe('deviations with hidden cycles', () => {
  const evaluate = (h, hiddenStarts = []) =>
    evaluateCycleDeviations({
      today: TODAY,
      periodRanges: inferCycleStats(h.logs).periodRanges,
      logs: h.logs,
      hiddenStarts,
    });

  it('hiding the one odd cycle removes the irregular finding', () => {
    const h = history([28, 28, 47, 28, 28, 28], { lastStartAgo: 5 });
    assert.deepEqual(evaluate(h).deviations.findings.map((f) => f.id), ['irregular']);
    assert.equal(evaluate(h, [h.starts[2]]).reason, 'no_findings');
  });

  it('hidden cycles do not count toward the 3 completed cycles', () => {
    const h = history([60, 60, 60, 28], { lastStartAgo: 5 });
    assert.notEqual(evaluate(h).reason, 'cycles');
    assert.equal(evaluate(h, [h.starts[0], h.starts[1]]).reason, 'cycles');
  });

  it('a hidden long period is not „prolonged“; hiding never invents „infrequent“', () => {
    const h = history([28, 28, 28, 28, 28, 28, 28], { lastStartAgo: 5, lengths: [5, 5, 5, 5, 5, 11, 11, 5] });
    assert.ok(evaluate(h).deviations.findings.some((f) => f.id === 'prolonged'));
    const r = evaluate(h, [h.starts[5]]);
    assert.ok(!(r.deviations?.findings ?? []).some((f) => f.id === 'prolonged'));
    assert.ok(!(r.deviations?.findings ?? []).some((f) => f.id === 'infrequent'));
  });
});

describe('doctor summary lists hidden cycles without a reason', () => {
  const h = history([28, 28, 44, 28], { lastStartAgo: 5 });
  const atypical = h.starts[2];

  it('statistics exclude it; the period stays an episode; excludedCycles names it', () => {
    const s = buildCycleDoctorSummaryData({
      profile: { mode: 'TRACK_PERIOD' },
      logs: h.logs,
      today: TODAY,
      hiddenCycles: [atypical],
      options: { from: addDays(TODAY, -180) },
    });
    assert.deepEqual(s.menstrualHistory.cycleLengths.map((c) => c.lengthDays), [28, 28, 28]);
    assert.deepEqual(s.menstrualHistory.excludedCycles, [
      { start: atypical, end: h.starts[3], lengthDays: 44, source: 'EXCLUDED_BY_USER' },
    ]);
    assert.ok(s.menstrualHistory.episodes.some((e) => e.start === atypical));
    assert.equal(s.cycleCount, 3);
    assert.equal(s.longestCycle, 28);
    assert.ok(!/reason|illness|miscarriage/i.test(JSON.stringify(s.menstrualHistory.excludedCycles)));
  });

  it('the bundle path (inferred given) reads the same', () => {
    const inferred = inferCycleStats(h.logs, 28, 5, { hiddenStarts: [atypical] });
    const s = buildCycleDoctorSummaryData({ profile: {}, logs: h.logs, today: TODAY, inferred, options: { from: addDays(TODAY, -180) } });
    assert.equal(s.menstrualHistory.excludedCycles.length, 1);
    assert.equal(s.shortestCycle, 28);
  });

  it('nothing hidden → an empty list and the old numbers', () => {
    const s = buildCycleDoctorSummaryData({ profile: {}, logs: h.logs, today: TODAY, options: { from: addDays(TODAY, -180) } });
    assert.deepEqual(s.menstrualHistory.excludedCycles, []);
    assert.equal(s.longestCycle, 44);
  });
});

describe('partner view follows her hidden cycles and never names them', () => {
  it('the estimate uses the same averages; no hidden field leaks', () => {
    const h = history([28, 28, 44, 28], { lastStartAgo: 3 });
    const base = {
      profile: { avgCycleLength: 28, avgPeriodLength: 5 },
      logs: h.logs,
      permissions: { period: true, cyclePhase: true, fertileWindow: true },
      today: TODAY,
    };
    const shown = buildPartnerPayload(base);
    const hid = buildPartnerPayload({ ...base, hiddenCycles: [h.starts[2]] });
    assert.equal(hid.period.nextPeriodStart, addDays(h.starts[4], 28));
    assert.notEqual(shown.period.nextPeriodStart, hid.period.nextPeriodStart);
    assert.equal(partnerPayloadHasLeak(hid), false);
    assert.ok(!/hidden/i.test(JSON.stringify(hid)));
  });
});

describe('storage + validation', () => {
  it('the SQL file only adds the defaulted column; schema.prisma keeps it @ignore', () => {
    const sql = readFileSync(new URL('../../prisma/20261004-cycle-hidden-cycles.sql', import.meta.url), 'utf8');
    assert.equal(cycleHiddenCyclesStatements(sql).length, 1);
    assert.throws(
      () => cycleHiddenCyclesStatements('ALTER TABLE "CycleProfile" DROP COLUMN "hiddenCycles";'),
      /non-additive/,
    );
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
    assert.match(schema, /hiddenCycles\s+Json\s+@default\("\[\]"\) @ignore/);
  });

  it('reads default to [] when the column is missing; normalizes what is stored', async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const broken = { $queryRaw: async () => { throw new Error('no column'); } };
      assert.deepEqual(await readCycleHiddenCycles(broken, 'u1'), []);
    } finally {
      console.warn = warn;
    }
    const stored = { $queryRaw: async () => [{ hiddenCycles: ['2026-05-02', 'x', '2026-03-01', '2026-05-02'] }] };
    assert.deepEqual(await readCycleHiddenCycles(stored, 'u1'), ['2026-03-01', '2026-05-02']);
    assert.deepEqual(await readCycleHiddenCycles({ $queryRaw: async () => [] }, 'u1'), []);
    assert.deepEqual(normalizeHiddenCycles('["2026-01-01"]'), ['2026-01-01']);
    assert.deepEqual(normalizeHiddenCycles('{bad'), []);
  });

  it('writes the whole list as JSON and fails with a bilingual 503', async () => {
    const calls = [];
    const db = { $executeRaw: async (strings, ...values) => { calls.push(values); return 1; } };
    await writeCycleHiddenCycles(db, 'u1', ['2026-05-02', '2026-03-01']);
    assert.deepEqual(calls[0], ['["2026-03-01","2026-05-02"]', 'u1']);
    const error = console.error;
    console.error = () => {};
    try {
      const broken = { $executeRaw: async () => { throw new Error('missing'); } };
      await assert.rejects(writeCycleHiddenCycles(broken, 'u1', []), (err) => {
        assert.equal(err.status, 503);
        assert.ok(err.messageEn);
        return true;
      });
    } finally {
      console.error = error;
    }
  });

  it('PUT validation: only logged starts; stale stored dates drop quietly; at most 24', () => {
    const starts = ['2026-06-01', '2026-06-29', '2026-07-27'];
    assert.deepEqual(planHiddenCyclesUpdate({ requested: ['2026-06-29', '2026-06-29'], periodStarts: starts }), ['2026-06-29']);
    assert.deepEqual(planHiddenCyclesUpdate({ requested: [], stored: ['2026-06-29'], periodStarts: starts }), []);
    assert.throws(
      () => planHiddenCyclesUpdate({ requested: ['2026-06-30'], periodStarts: starts }),
      (err) => err.status === 400 && Boolean(err.messageEn),
    );
    assert.deepEqual(
      planHiddenCyclesUpdate({ requested: ['2026-05-01', '2026-06-01'], stored: ['2026-05-01'], periodStarts: starts }),
      ['2026-06-01'],
    );
    const many = Array.from({ length: MAX_HIDDEN_CYCLES + 1 }, (_, i) => addDays('2024-01-01', i * 28));
    assert.throws(() => planHiddenCyclesUpdate({ requested: many, periodStarts: many }), (err) => err.status === 400);
    assert.equal(planHiddenCyclesUpdate({ requested: many.slice(1), periodStarts: many }).length, MAX_HIDDEN_CYCLES);
  });

  it('the profile schema takes an optional list of dates', () => {
    assert.deepEqual(profileUpdateSchema.parse({ hiddenCycles: ['2026-06-01'] }).hiddenCycles, ['2026-06-01']);
    assert.equal(profileUpdateSchema.parse({}).hiddenCycles, undefined);
    assert.throws(() => profileUpdateSchema.parse({ hiddenCycles: ['06/01/2026'] }));
  });
});
