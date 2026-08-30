import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDoctorSummary,
  buildPredictions,
  buildCycleAiUserPrompt,
  buildCycleTrends,
  daysBetween,
  inferCycleStats,
} from './cycle.js';
import {
  BASIC_STATS_MIN_CYCLES,
  RECURRING_PATTERN_MIN_CYCLES,
  civilDaysBetween,
  daysBeforeNextPeriod,
  historicalCycleDay,
  locateObservation,
  segmentHistoricalCycles,
} from './cycleHistory.js';
import {
  buildHistoricalAnalytics,
  buildPmsByDaysBefore,
  contraceptionRelation,
  historicalAnalyticsForAi,
  insightDataQuality,
} from './cycleHistoryAnalytics.js';
import { CYCLE_HISTORY_AI_RULES } from './cycleHonesty.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';

function bleed(date, flow = 'medium') {
  return { date, flow, symptoms: [], moods: [] };
}

function log(date, extras = {}) {
  return { date, flow: extras.flow ?? 'none', symptoms: extras.symptoms ?? [], moods: extras.moods ?? [], ...extras };
}

/** Old Phase 9 heatmap: current LMP + average modulo. Kept only to prove the bug. */
function legacyModuloPmsDay(lastPeriod, date, avgCycle) {
  const offset = daysBetween(lastPeriod, date);
  if (offset < 0) return null;
  return (offset % avgCycle) + 1;
}

describe('civil date helpers match the engine', () => {
  it('matches cycle.js daysBetween on month, year, and leap edges', () => {
    assert.equal(civilDaysBetween('2026-01-31', '2026-02-01'), daysBetween('2026-01-31', '2026-02-01'));
    assert.equal(civilDaysBetween('2025-12-31', '2026-01-01'), 1);
    assert.equal(civilDaysBetween('2024-02-28', '2024-03-01'), 2);
    assert.equal(civilDaysBetween('2024-02-28', '2024-02-29'), 1);
    assert.equal(civilDaysBetween('2026-01-01', '2026-01-29'), 28);
  });
});

describe('historical cycle segmentation', () => {
  it('measures Jan 1 → Jan 29 → Feb 27 as 28 and 29 day completed cycles', () => {
    const cycles = segmentHistoricalCycles(['2026-01-01', '2026-01-29', '2026-02-27']);
    assert.equal(cycles.length, 3);
    assert.equal(cycles[0].complete, true);
    assert.equal(cycles[0].cycleLength, 28);
    assert.equal(cycles[1].complete, true);
    assert.equal(cycles[1].cycleLength, 29);
    assert.equal(cycles[2].complete, false);
    assert.equal(cycles[2].cycleLength, null);
  });

  it('does not treat the open current cycle as a completed length', () => {
    const analytics = buildHistoricalAnalytics({
      inferred: { periodStarts: ['2026-01-01', '2026-01-29', '2026-02-27'] },
      logs: [bleed('2026-01-01'), bleed('2026-01-29'), bleed('2026-02-27')],
    });
    assert.deepEqual(
      analytics.cycleLengths.map((c) => c.length),
      [28, 29],
    );
    assert.equal(analytics.completedCycleCount, 2);
    assert.equal(analytics.historicalCycles.at(-1).complete, false);
  });

  it('leaves observations before the first period start as orphans', () => {
    const cycles = segmentHistoricalCycles(['2026-03-01']);
    const loc = locateObservation('2026-02-20', cycles);
    assert.equal(loc.kind, 'orphan');
    assert.equal(loc.cycleDay, null);
    assert.equal(loc.daysBeforeNextPeriod, null);
  });
});

describe('historical cycle-day and days-before-period', () => {
  it('uses civil-day difference + 1 for cycle day', () => {
    assert.equal(historicalCycleDay('2026-01-01', '2026-01-01'), 1);
    assert.equal(historicalCycleDay('2026-01-01', '2026-01-05'), 5);
    assert.equal(historicalCycleDay('2026-01-31', '2026-02-02'), 3);
  });

  it('uses 0 = period start day, 1 = one day before', () => {
    assert.equal(daysBeforeNextPeriod('2026-01-29', '2026-01-29'), 0);
    assert.equal(daysBeforeNextPeriod('2026-01-28', '2026-01-29'), 1);
    assert.equal(daysBeforeNextPeriod('2026-01-24', '2026-01-29'), 5);
  });

  it('maps irregular 24/35/27 cycles so day-5-before lands on daysBefore=5', () => {
    const starts = ['2026-01-01', '2026-01-25', '2026-03-01', '2026-03-28'];
    const cycles = segmentHistoricalCycles(starts);
    assert.deepEqual(
      cycles.filter((c) => c.complete).map((c) => c.cycleLength),
      [24, 35, 27],
    );
    const dates = ['2026-01-20', '2026-02-24', '2026-03-23'];
    for (const date of dates) {
      const loc = locateObservation(date, cycles);
      assert.equal(loc.kind, 'complete');
      assert.equal(loc.daysBeforeNextPeriod, 5);
    }
  });
});

describe('PMS heatmap historical fix', () => {
  it('places pre-current-LMP logs by actual next period, not current-LMP modulo', () => {
    const lastPeriod = '2026-03-28';
    const avgCycle = 28;
    const historicalDate = '2026-01-20';
    assert.equal(legacyModuloPmsDay(lastPeriod, historicalDate, avgCycle), null);

    const cycles = segmentHistoricalCycles(['2026-01-01', '2026-01-25', '2026-03-01', '2026-03-28']);
    const logs = [
      log('2026-01-20', { symptoms: ['cramps'] }),
      log('2026-02-24', { symptoms: ['cramps'] }),
      log('2026-03-23', { symptoms: ['cramps'] }),
    ];
    const series = buildPmsByDaysBefore(logs, cycles);
    const atFive = series.find((row) => row.daysBefore === 5);
    assert.ok(atFive);
    assert.equal(atFive.count, 3);

    const trends = buildCycleTrends({
      profile: { lastPeriodStart: lastPeriod, avgCycleLength: avgCycle, isIrregular: false },
      logs,
      inferred: { periodStarts: ['2026-01-01', '2026-01-25', '2026-03-01', '2026-03-28'] },
      averages: { usedCycleLength: avgCycle },
      today: '2026-04-10',
    });
    assert.deepEqual(trends.pmsByDay, []);
    assert.equal(trends.pmsByDaysBefore.find((row) => row.daysBefore === 5)?.count, 3);
  });

  it('does not put current unfinished-cycle days on the heatmap', () => {
    const cycles = segmentHistoricalCycles(['2026-01-01', '2026-01-29', '2026-02-26']);
    const logs = [log('2026-03-16', { symptoms: ['cramps'] })];
    const series = buildPmsByDaysBefore(logs, cycles);
    assert.equal(series.length, 0);
    const loc = locateObservation('2026-03-16', cycles);
    assert.equal(loc.kind, 'open');
    assert.equal(loc.daysBeforeNextPeriod, null);
  });
});

describe('period-range quality is preserved', () => {
  it('does not merge gapped bleed days into one range or one cycle', () => {
    const inferred = inferCycleStats([bleed('2026-08-10', 'medium'), bleed('2026-08-14', 'light')]);
    assert.equal(inferred.periodRanges.length, 2);
    assert.deepEqual(
      inferred.periodRanges.map((r) => r.start),
      ['2026-08-10', '2026-08-14'],
    );
    const cycles = segmentHistoricalCycles(inferred.periodStarts);
    assert.equal(cycles[0].cycleLength, 4);
    assert.equal(cycles[0].validForPatterns, false);
  });

  it('does not treat spotting as a period start', () => {
    const inferred = inferCycleStats([
      { date: '2026-01-01', flow: 'spotting', symptoms: [], moods: [] },
      bleed('2026-01-10'),
    ]);
    assert.deepEqual(inferred.periodStarts, ['2026-01-10']);
  });
});

describe('thresholds and data quality', () => {
  it('keeps recurring language off a single completed cycle', () => {
    const analytics = buildHistoricalAnalytics({
      inferred: { periodStarts: ['2026-01-01', '2026-01-29'] },
      logs: [bleed('2026-01-01'), log('2026-01-24', { symptoms: ['cramps'], painEntries: [{ type: 'cramps', severity: 'severe' }] })],
    });
    assert.equal(analytics.completedCycleCount, 1);
    assert.equal(analytics.insightDataQuality, 'LOW');
    assert.equal(analytics.pmsRecurringEligible, false);
    assert.equal(analytics.painPatterns.length, 0);
    assert.equal(analytics.symptomPatterns.length, 0);
  });

  it('allows basic length stats from two completed cycles', () => {
    assert.equal(BASIC_STATS_MIN_CYCLES, 2);
    const analytics = buildHistoricalAnalytics({
      inferred: { periodStarts: ['2026-01-01', '2026-01-29', '2026-02-26'] },
      logs: [bleed('2026-01-01'), bleed('2026-01-29'), bleed('2026-02-26')],
    });
    assert.equal(analytics.completedCycleCount, 2);
    assert.equal(analytics.cycleLengthStats.count, 2);
    assert.equal(analytics.pmsRecurringEligible, false);
  });

  it('requires three pattern-valid cycles and coverage before recurring insights', () => {
    assert.equal(RECURRING_PATTERN_MIN_CYCLES, 3);
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const sparse = buildHistoricalAnalytics({
      inferred: { periodStarts: starts },
      logs: starts.map((date) => bleed(date)),
    });
    assert.equal(sparse.completedCycleCount, 3);
    assert.ok(sparse.loggingCoverage < 0.15);
    assert.equal(sparse.pmsRecurringEligible, false);
    assert.equal(insightDataQuality({ completedCount: 3, coverage: 0.05 }), 'LOW');
    assert.equal(insightDataQuality({ completedCount: 2, coverage: 0.2 }), 'MEDIUM');
    assert.equal(insightDataQuality({ completedCount: 4, coverage: 0.4 }), 'HIGH');
  });
});

describe('pain and contraception limits', () => {
  it('returns severe cramps before 3 of 4 completed periods with sample size', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23'];
    const logs = [];
    for (const start of starts) logs.push(bleed(start));
    const beforeDates = ['2026-01-26', '2026-02-23', '2026-03-23'];
    for (const date of beforeDates) {
      logs.push(
        log(date, {
          painEntries: [{ type: 'cramps', severity: 'severe' }],
          symptoms: ['cramps'],
        }),
      );
    }
    for (const start of starts.slice(0, -1)) {
      for (let i = 2; i <= 20; i += 1) {
        const d = new Date(Date.UTC(...start.split('-').map(Number).map((n, idx) => (idx === 1 ? n - 1 : n))));
        d.setUTCDate(d.getUTCDate() + i);
        const key = d.toISOString().slice(0, 10);
        if (starts.includes(key) || beforeDates.includes(key)) continue;
        if (key >= starts[starts.length - 1]) continue;
        logs.push(log(key, { moods: ['calm'] }));
      }
    }
    const analytics = buildHistoricalAnalytics({
      inferred: { periodStarts: starts, periodRanges: starts.map((start) => ({ start, end: start, lengthDays: 1 })) },
      logs,
    });
    const pain = analytics.painPatterns.find((p) => p.painType === 'cramps');
    assert.ok(pain);
    assert.equal(pain.cyclesWithObservation, 3);
    assert.equal(pain.eligibleCycles, 4);
    assert.equal(pain.severeCycles, 3);
    assert.ok(pain.daysBeforeMin >= 1);
    assert.ok(pain.daysBeforeMax <= 5);
    assert.equal(analytics.pmsRecurringEligible, true);
  });

  it('does not label cycles before contraceptionStartedAt as current-method cycles', () => {
    const analytics = buildHistoricalAnalytics({
      inferred: { periodStarts: ['2026-01-01', '2026-01-29', '2026-02-26'] },
      logs: [bleed('2026-01-01'), bleed('2026-01-29'), bleed('2026-02-26')],
      contraceptionStartedAt: '2026-02-20',
    });
    assert.equal(contraceptionRelation('2026-01-01', '2026-02-20'), 'before_current_method');
    assert.equal(analytics.contraceptionContext.doNotRetroactivelyApply, true);
    assert.equal(analytics.contraceptionContext.applyLimitedHistorically, false);
    assert.equal(analytics.contraceptionContext.cyclesBeforeCurrentMethod, 2);
    assert.equal(analytics.historicalCycles[0].contraceptionRelation, 'before_current_method');
    assert.equal(analytics.historicalCycles[1].contraceptionRelation, 'before_current_method');
    assert.equal(analytics.historicalCycles[2].contraceptionRelation, 'on_or_after_current_start');
    assert.equal(JSON.stringify(analytics).includes('combined_pill'), false);
  });
});

describe('prediction engine regression', () => {
  it('keeps next period, ovulation, fertile window, confidence, and ranges identical', () => {
    const logs = [
      bleed('2026-01-01'),
      bleed('2026-01-02'),
      bleed('2026-01-03'),
      bleed('2026-01-29'),
      bleed('2026-01-30'),
      bleed('2026-02-26'),
    ];
    const inferred = inferCycleStats(logs);
    const predictions = buildPredictions({
      lastPeriodStart: inferred.lastPeriodStart,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: inferred.cycleCount,
      logs,
    });
    assert.deepEqual(inferred.periodStarts, ['2026-01-01', '2026-01-29', '2026-02-26']);
    assert.equal(inferred.periodRanges.length, 3);
    assert.equal(predictions.nextPeriodStart, '2026-03-26');
    assert.equal(predictions.ovulationDate, '2026-03-12');
    assert.deepEqual(predictions.fertileWindow, { start: '2026-03-07', end: '2026-03-13' });
    assert.equal(predictions.confidence, 'medium');
    assert.equal(predictions.estimated, true);

    const analytics = buildHistoricalAnalytics({ logs, inferred });
    assert.ok(analytics);
    const again = buildPredictions({
      lastPeriodStart: inferred.lastPeriodStart,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: inferred.cycleCount,
      logs,
    });
    assert.deepEqual(again.nextPeriodStart, predictions.nextPeriodStart);
    assert.deepEqual(again.ovulationDate, predictions.ovulationDate);
    assert.deepEqual(again.fertileWindow, predictions.fertileWindow);
    assert.equal(again.confidence, predictions.confidence);
  });
});

describe('AI, partner, and payload bounds', () => {
  it('labels HISTORICAL_LOG_PATTERN with sample sizes and omits journal/tags', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23'];
    const logs = starts.map((date) => bleed(date));
    for (const date of ['2026-01-26', '2026-02-23', '2026-03-23']) {
      logs.push(
        log(date, {
          painEntries: [{ type: 'cramps', severity: 'severe' }],
          notes: 'private journal night shift',
          customTagIds: ['11111111-1111-4111-8111-111111111111'],
        }),
      );
    }
    for (const start of starts.slice(0, -1)) {
      for (let i = 2; i <= 18; i += 1) {
        const d = new Date(Date.UTC(...start.split('-').map(Number).map((n, idx) => (idx === 1 ? n - 1 : n))));
        d.setUTCDate(d.getUTCDate() + i);
        const key = d.toISOString().slice(0, 10);
        if (logs.some((l) => l.date === key) || starts.includes(key)) continue;
        logs.push(log(key));
      }
    }
    const analytics = buildHistoricalAnalytics({
      inferred: { periodStarts: starts },
      logs,
    });
    const lines = historicalAnalyticsForAi(analytics);
    assert.ok(lines.some((line) => line.includes('completedCycles=')));
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-04-23', avgCycleLength: 28, avgPeriodLength: 5 },
      logs,
      predictions: { nextPeriodStart: '2026-05-21', confidence: 'medium' },
      user: { age: 28 },
      analytics,
    });
    assert.match(prompt, /HISTORICAL_LOG_PATTERN:/);
    assert.match(prompt, /3\/4/);
    assert.doesNotMatch(prompt, /private journal/);
    assert.doesNotMatch(prompt, /11111111-1111-4111-8111-111111111111/);
    assert.doesNotMatch(prompt, /You have PMS-related/);
    for (const rule of CYCLE_HISTORY_AI_RULES) {
      assert.match(prompt, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('does not leak analytics keys through partner serializers', () => {
    const payload = buildPartnerPayload({
      today: '2026-04-10',
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: '2026-03-28', avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: [bleed('2026-03-28')],
    });
    const text = JSON.stringify(payload);
    for (const key of [
      'analytics',
      'historicalCycles',
      'pmsByDaysBefore',
      'insightDataQuality',
      'painPatterns',
      'symptomPatterns',
      'moodPatterns',
      'lifestylePatterns',
      'loggingCoverage',
    ]) {
      assert.equal(Object.hasOwn(payload, key), false);
      assert.doesNotMatch(text, new RegExp(`"${key}"`));
    }
    assert.equal(partnerPayloadHasLeak(payload), false);
    assert.equal(partnerPayloadHasLeak({ ...payload, analytics: { insightDataQuality: 'HIGH' } }), true);
    assert.equal(partnerPayloadHasLeak({ ...payload, painPatterns: [] }), true);
  });

  it('keeps the analytics object small versus a 400-log horizon', () => {
    const starts = [];
    let cursor = new Date(Date.UTC(2025, 0, 1));
    for (let i = 0; i < 14; i += 1) {
      starts.push(cursor.toISOString().slice(0, 10));
      cursor = new Date(cursor.getTime() + 28 * 86_400_000);
    }
    const logs = [];
    for (let i = 0; i < 400; i += 1) {
      const d = new Date(Date.UTC(2025, 0, 1 + i));
      logs.push(log(d.toISOString().slice(0, 10), i % 20 === 0 ? { symptoms: ['fatigue'] } : {}));
    }
    const inferred = inferCycleStats(starts.map((date) => bleed(date)));
    const analytics = buildHistoricalAnalytics({ logs, inferred });
    const bytes = Buffer.byteLength(JSON.stringify(analytics), 'utf8');
    assert.ok(analytics.horizonCycles <= 12);
    assert.ok(bytes < 80_000, `analytics payload ${bytes} bytes`);
    const summary = buildDoctorSummary({
      profile: { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false },
      logs,
      predictions: { nextPeriodStart: '2026-01-01', ovulationDate: null, fertileWindow: null },
      analytics,
    });
    assert.equal(summary.historical.source, 'calculated_from_logged_history');
    assert.equal(summary.historical.completeness, 'based_on_recorded_days');
  });
});
