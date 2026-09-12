import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildCycleAiUserPrompt, buildPredictions, detectLatePeriod, inferCycleStats, resolveForecastAverages } from './cycle.js';
import { shouldObservePrediction } from './cyclePredictionHistory.js';
import {
  CLASSIFICATION_SOURCE_OWNER,
  MENSTRUAL_PERIOD_CLASSIFICATION,
} from './cyclePostpartumBleedClassification.js';
import {
  applyForecastEligibilityToPredictions,
  evaluateForecastEligibility,
  forecastGateProfilePatch,
  FORECAST_ELIGIBILITY_REASON,
  FORECAST_GATE_KIND_POSTPARTUM_RETURN,
  omitForecastGateFromProfile,
  POSTPARTUM_RETURN_MIN_VALID_INTERVALS,
  publicForecastEligibility,
} from './cyclePostpartumReturnForecast.js';
import { partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { capabilitiesForProfileMode } from './cycleModes.js';

const EPISODE = 'pp-exit-1';
const OTHER = 'pp-old';

function ownerClassified(episodeId, start, end = start) {
  return {
    postpartumEpisodeId: episodeId,
    bleedStart: start,
    bleedEnd: end,
    classification: MENSTRUAL_PERIOD_CLASSIFICATION,
    source: CLASSIFICATION_SOURCE_OWNER,
  };
}

function starts(episodeId, dates) {
  return dates.map((date) => ownerClassified(episodeId, date));
}

describe('Phase 42 forecast gate provenance', () => {
  it('ordinary TRACK is STANDARD allowed', () => {
    const row = evaluateForecastEligibility({ forecastGateKind: null, classifications: starts(EPISODE, ['2026-01-01']) });
    assert.equal(row.allowed, true);
    assert.equal(row.reason, FORECAST_ELIGIBILITY_REASON.STANDARD);
  });

  it('leaving postpartum writes POSTPARTUM_RETURN provenance', () => {
    assert.deepEqual(
      forecastGateProfilePatch({ left: true, endedEpisodeId: EPISODE }),
      { forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN, forecastGateEpisodeId: EPISODE },
    );
  });

  it('re-entering postpartum clears the gate', () => {
    assert.deepEqual(
      forecastGateProfilePatch({ entered: true }),
      { forecastGateKind: null, forecastGateEpisodeId: null },
    );
  });

  it('public payload omits episode ids', () => {
    const pub = publicForecastEligibility({
      allowed: false,
      reason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT,
    });
    assert.equal(Object.hasOwn(pub, 'sourcePostpartumEpisodeId'), false);
    assert.equal(omitForecastGateFromProfile({
      mode: 'TRACK_PERIOD',
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
    }).forecastGateEpisodeId, undefined);
    assert.equal(omitForecastGateFromProfile({
      mode: 'TRACK_PERIOD',
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
    }).forecastGateKind, undefined);
  });
});

describe('Phase 42 readiness threshold', () => {
  it('A: zero classifications is insufficient', () => {
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: [],
    });
    assert.equal(row.allowed, false);
    assert.equal(row.reason, FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT);
  });

  it('B: one classified start is insufficient', () => {
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(EPISODE, ['2026-07-01']),
    });
    assert.equal(row.allowed, false);
  });

  it('C: two starts / one valid interval is insufficient', () => {
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(EPISODE, ['2026-06-01', '2026-06-29']),
    });
    assert.equal(inferCycleStats(starts(EPISODE, ['2026-06-01', '2026-06-29']).map((r) => ({ date: r.bleedStart, flow: 'medium' }))).cycleCount, 1);
    assert.equal(row.allowed, false);
  });

  it('D: three starts / two valid intervals is ready', () => {
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(EPISODE, ['2026-05-01', '2026-05-29', '2026-06-26']),
    });
    assert.equal(row.allowed, true);
    assert.equal(row.reason, FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_READY);
    assert.equal(POSTPARTUM_RETURN_MIN_VALID_INTERVALS, 2);
  });

  it('E: three starts with an invalid interval stay closed', () => {
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(EPISODE, ['2026-05-01', '2026-05-12', '2026-06-09']),
    });
    assert.equal(row.allowed, false);
  });

  it('F/G: stored average and default 28 do not satisfy readiness', () => {
    const inferred = inferCycleStats([{ date: '2026-07-01', flow: 'medium' }]);
    const averages = resolveForecastAverages({ avgCycleLength: 32, avgPeriodLength: 5 }, inferred);
    assert.equal(averages.source, 'user');
    assert.equal(averages.usedCycleLength, 32);
    const gated = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(EPISODE, ['2026-07-01']),
    });
    assert.equal(gated.allowed, false);
    const fallback = resolveForecastAverages({ avgCycleLength: 28, avgPeriodLength: 5 }, inferCycleStats([]));
    assert.equal(fallback.usedCycleLength, 28);
    assert.equal(evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: [],
    }).allowed, false);
  });

  it('H: pre-pregnancy cycles do not satisfy readiness', () => {
    const pre = ['2025-01-01', '2025-01-29', '2025-02-26', '2025-03-26'].map((date) => ({ date, flow: 'medium' }));
    assert.ok(inferCycleStats(pre).cycleCount >= 2);
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(EPISODE, ['2026-07-01']),
    });
    assert.equal(row.allowed, false);
  });

  it('I: unclassified postpartum bleeding does not count', () => {
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: [],
    });
    assert.equal(row.allowed, false);
  });

  it('J: other postpartum episode classifications do not count', () => {
    const row = evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(OTHER, ['2026-05-01', '2026-05-29', '2026-06-26']),
    });
    assert.equal(row.allowed, false);
  });

  it('K: unclassify below threshold closes the gate', () => {
    const ready = starts(EPISODE, ['2026-05-01', '2026-05-29', '2026-06-26']);
    assert.equal(evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: ready,
    }).allowed, true);
    assert.equal(evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: ready.slice(0, 2),
    }).allowed, false);
  });

  it('L: reclassify restores readiness', () => {
    const rows = starts(EPISODE, ['2026-05-01', '2026-05-29', '2026-06-26']);
    assert.equal(evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: rows,
    }).allowed, true);
  });

  it('N: delete classified episode recomputes closed', () => {
    assert.equal(evaluateForecastEligibility({
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: EPISODE,
      classifications: starts(EPISODE, ['2026-05-01', '2026-05-29']),
    }).allowed, false);
  });
});

describe('Phase 42 prediction / late / snapshot / AI stripping', () => {
  it('O/Q: gated predictions drop next/fertile/ovulation/late/snapshot', () => {
    const predictions = buildPredictions({
      lastPeriodStart: '2026-07-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 0,
    });
    assert.ok(predictions.nextPeriodStart);
    const eligibility = { allowed: false, reason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT };
    const gated = applyForecastEligibilityToPredictions(predictions, eligibility);
    assert.equal(gated.nextPeriodStart, null);
    assert.equal(gated.ovulationDate, null);
    assert.equal(gated.fertileWindow, null);
    const late = detectLatePeriod({
      today: addDays('2026-07-01', 50),
      profile: { mode: 'TRACK_PERIOD' },
      logs: [{ date: '2026-07-01', flow: 'medium' }],
      predictions,
      inferred: { cycleCount: 0, periodRanges: [] },
      forecastEligibility: eligibility,
    });
    assert.equal(late.status, 'unknown');
    assert.equal(late.reason, 'postpartum_return_insufficient');
    assert.equal(shouldObservePrediction({
      mode: 'TRACK_PERIOD',
      predictedDate: predictions.nextPeriodStart,
      cycleAnchorDate: '2026-07-01',
      forecastAllowed: false,
    }), false);
  });

  it('P: ready eligibility does not rewrite forecast arithmetic', () => {
    const predictions = buildPredictions({
      lastPeriodStart: '2026-06-26',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 2,
      cycleLengths: [28, 28],
    });
    const ovulation = addDays('2026-06-26', 28 - 14);
    assert.equal(predictions.ovulationDate, ovulation);
    const kept = applyForecastEligibilityToPredictions(predictions, {
      allowed: true,
      reason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_READY,
    });
    assert.equal(kept.nextPeriodStart, predictions.nextPeriodStart);
    assert.equal(kept.ovulationDate, ovulation);
  });

  it('U: AI omits ESTIMATED forecast lines while gated', () => {
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-07-01', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false, conditions: [] },
      logs: [{ date: '2026-07-01', flow: 'medium', symptoms: [], moods: [] }],
      predictions: { nextPeriodStart: '2026-07-29', ovulationDate: '2026-07-15', fertileWindow: { start: '2026-07-10', end: '2026-07-16' }, confidence: 'low' },
      pregnancy: null,
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2026-07-08',
      forecastEligibility: { allowed: false, reason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT },
    });
    assert.match(prompt, /TRACK_PERIOD|ციკლ/);
    assert.equal(prompt.includes('ESTIMATED:'), false);
    assert.equal(prompt.includes('სავარაუდო შემდეგი მენსტრუაცია'), false);
    assert.equal(prompt.includes('სავარაუდო ოვულაცია'), false);
    assert.equal(prompt.includes('ნაყოფიერი ფანჯარა'), false);
    assert.equal(prompt.includes('პროგნოზის წყარო: default'), false);
  });

  it('V: ordinary TRACK AI still receives ESTIMATED lines', () => {
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-07-01', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false, conditions: [] },
      logs: [{ date: '2026-07-01', flow: 'medium', symptoms: [], moods: [] }],
      predictions: { nextPeriodStart: '2026-07-29', ovulationDate: '2026-07-15', fertileWindow: { start: '2026-07-10', end: '2026-07-16' }, confidence: 'low' },
      pregnancy: null,
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2026-07-08',
      forecastEligibility: { allowed: true, reason: FORECAST_ELIGIBILITY_REASON.STANDARD },
    });
    assert.equal(prompt.includes('ESTIMATED:'), true);
    assert.equal(prompt.includes('სავარაუდო შემდეგი მენსტრუაცია'), true);
  });
});

describe('Phase 42 capability matrix and partner/doctor/export', () => {
  it('130: static capability matrix is unchanged by readiness', () => {
    const caps = capabilitiesForProfileMode('TRACK_PERIOD');
    assert.equal(caps.showNextPeriodForecast, true);
    assert.equal(Object.hasOwn(caps, 'forecastEligibility'), false);
  });

  it('partner payload must not include gate keys', () => {
    assert.equal(partnerPayloadHasLeak({ forecastEligibility: { allowed: false } }), true);
    assert.equal(partnerPayloadHasLeak({ forecastGateKind: 'POSTPARTUM_RETURN' }), true);
  });

  it('owner export may include postpartumReturn provenance', () => {
    const payload = buildCycleExportPayload({
      profile: { mode: 'TRACK_PERIOD' },
      postpartumReturn: {
        kind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
        sourcePostpartumEpisodeId: EPISODE,
        forecastAllowed: false,
        forecastReason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT,
      },
    });
    assert.equal(payload.postpartumReturn.kind, FORECAST_GATE_KIND_POSTPARTUM_RETURN);
    assert.equal(payload.postpartumReturn.forecastAllowed, false);
  });
});
