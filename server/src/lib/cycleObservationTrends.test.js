import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildPredictions, inferCycleStats } from './cycle.js';
import { getObservationDef } from './cycleObservationRegistry.js';
import {
  OBSERVATION_TREND_QUERY_DAYS,
  TREND_TYPES,
  buildObservationTrends,
  completedPeriodEpisodes,
  observationTrendPayloadHasSensitiveLeak,
} from './cycleObservationTrends.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildDoctorSummary } from './cycle.js';

const TODAY = '2026-09-09';

function log(date, extra = {}) {
  return { date, flow: extra.flow ?? 'none', ...extra };
}

function bleed(start, days = 4, extra = {}) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push(log(addDays(start, i), { flow: i === 0 ? 'medium' : 'light', ...extra }));
  }
  return rows;
}

describe('registry trend metadata', () => {
  it('defaults new keys to trendEligible false', () => {
    assert.equal(getObservationDef('night_sweats').trendEligible, false);
    assert.equal(getObservationDef('notes').trendEligible, false);
    assert.equal(getObservationDef('sexualActivity').trendEligible, false);
    assert.equal(getObservationDef('ovulationTest').trendEligible, false);
    assert.equal(getObservationDef('bbt').trendEligible, false);
    assert.equal(getObservationDef('cervicalMucus').trendEligible, false);
    assert.equal(getObservationDef('pregnancyTest').trendEligible, false);
    assert.equal(getObservationDef('libido').trendEligible, false);
    assert.equal(getObservationDef('irritable').trendEligible, false);
  });

  it('enables reviewed Phase 13 groups', () => {
    assert.equal(getObservationDef('pain').trendEligible, true);
    assert.equal(getObservationDef('energy').trendEligible, true);
    assert.equal(getObservationDef('bloating').trendEligible, true);
    assert.equal(getObservationDef('acne').trendEligible, true);
    assert.equal(getObservationDef('fatigue').trendEligible, true);
    assert.equal(getObservationDef('pain').trendGroup, 'pain');
    assert.equal(getObservationDef('energy').trendGroup, 'energy');
  });
});

describe('observation trends — thresholds', () => {
  it('A no observations: no trend claims', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [...bleed('2026-08-01'), log('2026-08-20')],
    });
    assert.equal(out.trends.length, 0);
    assert.equal(out.window.queryDays, OBSERVATION_TREND_QUERY_DAYS);
  });

  it('B one occurrence: no trend card', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [log('2026-09-01', { symptoms: ['bloating'] })],
    });
    assert.equal(out.trends.length, 0);
  });

  it('C two occurrences: factual recent count, no often language in args', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', { symptoms: ['bloating'] }),
        log('2026-09-04', { symptoms: ['bloating'] }),
      ],
    });
    assert.equal(out.trends.length, 1);
    assert.equal(out.trends[0].key, 'bloating');
    assert.equal(out.trends[0].summaryType, TREND_TYPES.RECENT_OCCURRENCE);
    assert.equal(out.trends[0].summaryArgs.days, 2);
    assert.equal(Object.hasOwn(out.trends[0].summaryArgs, 'often'), false);
  });

  it('D three+ occurrences: recurrence summary', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-08-20', { symptoms: ['acne'] }),
        log('2026-08-28', { symptoms: ['acne'] }),
        log('2026-09-05', { symptoms: ['acne'] }),
      ],
    });
    assert.equal(out.trends[0].key, 'acne');
    assert.equal(out.trends[0].summaryArgs.days, 3);
    assert.equal(out.trends[0].occurrenceCount, 3);
  });
});

describe('observation trends — pain canonicalization', () => {
  it('E pain across 4 actual periods uses episode recurrence', () => {
    const logs = [
      ...bleed('2026-05-01', 3, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
      ...bleed('2026-06-01', 3, { painEntries: [{ type: 'cramps', severity: 'mild' }] }),
      ...bleed('2026-07-01', 3, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
      ...bleed('2026-08-01', 3, { painEntries: [{ type: 'cramps', severity: 'severe' }] }),
      log('2026-09-01', { flow: 'none' }),
    ];
    const out = buildObservationTrends({ today: TODAY, logs });
    const cramps = out.trends.find((t) => t.key === 'pain.cramps');
    assert.ok(cramps);
    assert.equal(cramps.summaryType, TREND_TYPES.PERIOD_EPISODE_RECURRENCE);
    assert.equal(cramps.summaryArgs.episodeCount, 4);
    assert.ok(cramps.summaryArgs.eligibleEpisodes >= 4);
  });

  it('K legacy headache chip + painEntry count once', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', {
          symptoms: ['headache', 'bloating'],
          painEntries: [{ type: 'headache', severity: 'mild' }],
        }),
        log('2026-09-03', {
          symptoms: ['headache'],
          painEntries: [{ type: 'headache', severity: 'moderate' }],
        }),
        log('2026-09-05', { symptoms: ['headache'] }),
      ],
    });
    const headache = out.trends.find((t) => t.key === 'pain.headache');
    assert.equal(headache.occurrenceCount, 3);
    assert.equal(out.trends.filter((t) => t.key === 'headache').length, 0);
  });
});

describe('observation trends — energy / digestion / skin', () => {
  it('F energy low/very_low grouped, never averaged', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', { observations: { energy: 'very_low' } }),
        log('2026-09-02', { observations: { energy: 'low' } }),
        log('2026-09-03', { observations: { energy: 'normal' } }),
        log('2026-09-06', { observations: { energy: 'low' } }),
      ],
    });
    const energy = out.trends.find((t) => t.key === 'energy.low');
    assert.equal(energy.summaryArgs.days, 3);
    assert.equal(Object.hasOwn(energy.summaryArgs, 'average'), false);
    assert.equal(Object.hasOwn(energy.summaryArgs, 'mean'), false);
  });

  it('G digestion around actual period days, not predicted', () => {
    const logs = [
      ...bleed('2026-08-01', 3, { symptoms: ['bloating'] }),
      log('2026-08-20', { symptoms: ['bloating'] }),
      log('2026-09-02', { symptoms: ['bloating'] }),
    ];
    const inferred = inferCycleStats(logs);
    const predicted = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs,
    });
    const out = buildObservationTrends({ today: TODAY, logs, inferred });
    const bloating = out.trends.find((t) => t.key === 'bloating');
    assert.ok(bloating);
    const predictedStart = predicted.nextPeriodStart;
    assert.ok(predictedStart);
    assert.ok(!bloating.recentDates.includes(predictedStart));
  });

  it('H skin recurrence', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-08-22', { symptoms: ['acne'] }),
        log('2026-09-01', { symptoms: ['acne', 'oily_skin'] }),
        log('2026-09-08', { symptoms: ['acne'] }),
      ],
    });
    assert.ok(out.trends.find((t) => t.key === 'acne'));
    assert.equal(out.trends.find((t) => t.key === 'oily_skin'), undefined);
  });

  it('C digestion: two keys on one day count separately, once each', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', { symptoms: ['bloating', 'nausea'] }),
        log('2026-09-04', { symptoms: ['bloating', 'nausea'] }),
        log('2026-09-07', { symptoms: ['bloating'] }),
      ],
    });
    assert.equal(out.trends.find((t) => t.key === 'bloating').occurrenceCount, 3);
    assert.equal(out.trends.find((t) => t.key === 'nausea').occurrenceCount, 2);
  });
});

describe('observation trends — missing data and sensitive', () => {
  it('missing days are not treated as symptom absent', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', { symptoms: ['gas'] }),
        log('2026-09-08', { symptoms: ['gas'] }),
        log('2026-09-09', { symptoms: ['gas'] }),
      ],
    });
    const gas = out.trends.find((t) => t.key === 'gas');
    assert.equal(gas.summaryArgs.days, 3);
    assert.equal(Object.hasOwn(gas.summaryArgs, 'percent'), false);
    assert.equal(Object.hasOwn(gas.summaryArgs, 'rate'), false);
    assert.equal(gas.summaryType, TREND_TYPES.RECENT_OCCURRENCE);
  });

  it('L sensitive-only observations produce no trend cards', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', {
          sexualActivity: true,
          libido: 4,
          ovulationTest: 'positive',
          pregnancyTest: 'positive',
          bbt: 36.7,
          cervicalMucus: 'eggwhite',
          notes: 'private',
          symptoms: ['pain_sex', 'unprotected'],
        }),
        log('2026-09-03', {
          sexualActivity: true,
          libido: 3,
          ovulationTest: 'positive',
          pregnancyTest: 'negative',
          bbt: 36.8,
          cervicalMucus: 'creamy',
          notes: 'still private',
          symptoms: ['pain_sex'],
        }),
        log('2026-09-06', {
          sexualActivity: true,
          notes: 'x',
          symptoms: ['unprotected'],
        }),
      ],
    });
    assert.equal(out.trends.length, 0);
    assert.equal(observationTrendPayloadHasSensitiveLeak(out), false);
  });

  it('unknown stored keys never generate trends', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', { symptoms: ['future_chip_xyz', 'bloating'] }),
        log('2026-09-04', { symptoms: ['future_chip_xyz', 'bloating'] }),
        log('2026-09-07', { symptoms: ['future_chip_xyz'] }),
      ],
    });
    assert.equal(out.trends.find((t) => t.key === 'future_chip_xyz'), undefined);
    assert.ok(out.trends.find((t) => t.key === 'bloating'));
  });
});

describe('observation trends — edit / delete / predicted', () => {
  it('I historical edit recomputes', () => {
    const before = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', { symptoms: ['acne'] }),
        log('2026-09-04', { symptoms: ['acne'] }),
        log('2026-09-07', { symptoms: ['acne'] }),
      ],
    });
    assert.equal(before.trends[0].occurrenceCount, 3);
    const after = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', { symptoms: ['acne'] }),
        log('2026-09-04', { symptoms: [] }),
        log('2026-09-07', { symptoms: ['acne'] }),
      ],
    });
    assert.equal(after.trends[0].occurrenceCount, 2);
  });

  it('J deletion removes the trend when below threshold', () => {
    const after = buildObservationTrends({
      today: TODAY,
      logs: [log('2026-09-01', { symptoms: ['acne'] })],
    });
    assert.equal(outEmpty(after), 0);
  });

  it('predicted period days never count as episode association', () => {
    const logs = [...bleed('2026-08-01', 3, { symptoms: ['bloating'] }), log('2026-08-20')];
    const inferred = inferCycleStats(logs);
    const pred = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 2,
      logs,
    });
    const fakePredictedRange = {
      start: pred.nextPeriodStart,
      end: addDays(pred.nextPeriodStart, 4),
      source: 'predicted',
    };
    const episodes = completedPeriodEpisodes([...(inferred.periodRanges || []), fakePredictedRange], {
      today: TODAY,
      windowStart: addDays(TODAY, -179),
    });
    assert.ok(episodes.every((r) => r.end < TODAY));
    assert.ok(!episodes.some((r) => r.start === pred.nextPeriodStart));
    assert.ok(!(inferred.periodRanges || []).some((r) => r.start === pred.nextPeriodStart));
  });
});

function outEmpty(out) {
  return out.trends.length;
}

describe('observation trends — privacy / engine / performance', () => {
  it('payload contains only approved aggregates', () => {
    const out = buildObservationTrends({
      today: TODAY,
      logs: [
        log('2026-09-01', {
          symptoms: ['bloating'],
          notes: 'secret',
          sexualActivity: true,
          ovulationTest: 'positive',
        }),
        log('2026-09-04', { symptoms: ['bloating'], notes: 'secret2' }),
        log('2026-09-07', { symptoms: ['bloating'] }),
      ],
    });
    assert.equal(observationTrendPayloadHasSensitiveLeak(out), false);
    assert.equal(JSON.stringify(out).includes('secret'), false);
  });

  it('does not change forecast and is not added to partner or AI', () => {
    const base = [...bleed('2026-08-01'), ...bleed('2026-08-29')];
    const withObs = base.map((row, i) =>
      i === 0 ? { ...row, symptoms: ['bloating', 'acne'], observations: { energy: 'low' } } : row,
    );
    const predA = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: base,
    });
    const predB = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: withObs,
    });
    assert.equal(predA.nextPeriodStart, predB.nextPeriodStart);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: '2026-08-01', avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: withObs,
      predictions: predB,
    });
    assert.equal(Object.hasOwn(partner, 'observationTrends'), false);
    assert.equal(partnerPayloadHasLeak(partner), false);
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-01' },
      logs: withObs,
      predictions: predB,
      observationTrends: outForPrompt(),
    });
    assert.equal(String(prompt).includes('observationTrends'), false);
    assert.equal(String(prompt).includes('energy.low'), false);
    const summary = buildDoctorSummary({
      profile: { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5 },
      logs: withObs,
      predictions: predB,
      analytics: null,
    });
    assert.equal(Object.hasOwn(summary, 'observationTrends'), false);
  });

  it('180 / 365 dense synthetic stays bounded to the query window', () => {
    const logs = [];
    let d = addDays(TODAY, -400);
    for (let i = 0; i < 401; i += 1) {
      logs.push(
        log(d, {
          flow: i % 28 < 4 ? 'medium' : 'none',
          symptoms: i % 3 === 0 ? ['bloating'] : [],
        }),
      );
      d = addDays(d, 1);
    }
    const out = buildObservationTrends({ today: TODAY, logs });
    assert.ok(out.window.from >= addDays(TODAY, -(OBSERVATION_TREND_QUERY_DAYS - 1)));
    for (const t of out.trends) {
      for (const date of t.recentDates) {
        assert.ok(date >= out.window.from);
        assert.ok(date <= TODAY);
      }
    }
  });
});

function outForPrompt() {
  return { trends: [{ key: 'energy.low', summaryType: 'RECENT_OCCURRENCE' }] };
}
