import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferCycleStats, PERIOD_FLOWS } from './cycle.js';
import { filterLogsForEngine, engineLogWhere } from './cycleHistoryQuery.js';
import { isEngineEligibleLog, POSTPARTUM_TRACKING_CONTEXT } from './cyclePostpartum.js';
import { profileModeForAiPrompt, isCycleAiContextSupported, capabilitiesForProfileMode } from './cycleModes.js';
import { shouldObservePrediction } from './cyclePredictionHistory.js';
import { partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import {
  CLASSIFICATION_SOURCE_OWNER,
  MENSTRUAL_PERIOD_CLASSIFICATION,
  classifiedPeriodFlowDates,
  classificationCopyForbidden,
  filterLogsForMenstrualHistory,
  findBleedRunForDate,
  forecastLogsForMode,
  groupPostpartumBleedRuns,
  isFactualMenstrualHistoryLog,
  canMutatePostpartumBleedClassification,
  mergeForecastLogs,
  planClassificationReconciliation,
  presentBleedClassification,
  serializeBleedClassificationsForExport,
} from './cyclePostpartumBleedClassification.js';

const TODAY = '2026-09-11';
const EP = 'pp-active';
const EP_OLD = 'pp-ended';

function pp(date, flow, episodeId = EP) {
  return { date, flow, trackingContext: POSTPARTUM_TRACKING_CONTEXT, postpartumEpisodeId: episodeId };
}

describe('Phase 41 grouping', () => {
  it('groups consecutive PERIOD_FLOW days as one episode', () => {
    const runs = groupPostpartumBleedRuns([
      pp('2026-09-10', 'light'),
      pp('2026-09-11', 'medium'),
      pp('2026-09-12', 'heavy'),
      pp('2026-09-13', 'medium'),
      pp('2026-09-14', 'light'),
    ]);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].start, '2026-09-10');
    assert.equal(runs[0].end, '2026-09-14');
  });

  it('spotting-only is not a classifiable episode', () => {
    const runs = groupPostpartumBleedRuns([pp('2026-09-10', 'spotting')]);
    assert.equal(runs.length, 0);
  });

  it('does not group TRACK logs as postpartum bleed runs', () => {
    const runs = groupPostpartumBleedRuns([{ date: '2026-07-01', flow: 'heavy' }]);
    assert.equal(runs.length, 0);
  });

  it('does not mix two postpartum episodes', () => {
    const runs = groupPostpartumBleedRuns([
      pp('2026-08-01', 'heavy', EP_OLD),
      pp('2026-09-10', 'heavy', EP),
    ]);
    assert.equal(runs.length, 2);
    assert.equal(runs[0].postpartumEpisodeId, EP_OLD);
    assert.equal(runs[1].postpartumEpisodeId, EP);
  });
});

describe('Phase 41 default UNKNOWN / classify semantics', () => {
  it('A unclassified postpartum bleed stays out of menstrual history', () => {
    const logs = [pp('2026-09-10', 'heavy')];
    const history = filterLogsForMenstrualHistory(logs, TODAY, new Set());
    assert.equal(history.length, 0);
    assert.equal(isEngineEligibleLog(logs[0]), false);
    assert.equal(isFactualMenstrualHistoryLog(logs[0], new Set()), false);
  });

  it('B/C classified dates enter history once; unclassified neighbors stay out', () => {
    const logs = [
      pp('2026-09-10', 'heavy'),
      pp('2026-09-11', 'medium'),
      pp('2026-09-20', 'light'),
    ];
    const runs = groupPostpartumBleedRuns(logs.slice(0, 2));
    const dates = classifiedPeriodFlowDates(logs, runs);
    assert.equal(dates.has('2026-09-10'), true);
    assert.equal(dates.has('2026-09-20'), false);
    const history = filterLogsForMenstrualHistory(logs, TODAY, dates);
    assert.deepEqual(history.map((l) => l.date), ['2026-09-10', '2026-09-11']);
  });

  it('maps keep-row bleedStart/bleedEnd onto civil classified dates', () => {
    const logs = [
      pp('2026-09-10', 'heavy'),
      pp('2026-09-11', 'medium'),
    ];
    const dates = classifiedPeriodFlowDates(logs, [{
      postpartumEpisodeId: EP,
      bleedStart: '2026-09-10',
      bleedEnd: '2026-09-11',
    }]);
    assert.deepEqual([...dates].sort(), ['2026-09-10', '2026-09-11']);
  });

  it('normalizes Prisma Date objects to civil keys', () => {
    const logs = [{
      date: new Date('2026-09-10T00:00:00.000Z'),
      flow: 'heavy',
      trackingContext: POSTPARTUM_TRACKING_CONTEXT,
      postpartumEpisodeId: EP,
    }];
    const dates = classifiedPeriodFlowDates(logs, [{
      postpartumEpisodeId: EP,
      start: '2026-09-10',
      end: '2026-09-10',
    }]);
    assert.equal(dates.has('2026-09-10'), true);
    assert.equal([...dates].some((d) => d instanceof Date), false);
  });
});

describe('Phase 41 reconciliation', () => {
  it('P shrink end keeps classification', () => {
    const plan = planClassificationReconciliation({
      classifications: [{
        id: 'c1',
        postpartumEpisodeId: EP,
        bleedStart: '2026-09-10',
        bleedEnd: '2026-09-14',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      }],
      runs: [{ postpartumEpisodeId: EP, start: '2026-09-10', end: '2026-09-13' }],
    });
    assert.equal(plan.keep.length, 1);
    assert.equal(plan.keep[0].bleedEnd, '2026-09-13');
    assert.equal(plan.drop.length, 0);
  });

  it('P start-day removed keeps unique suffix as same episode', () => {
    const plan = planClassificationReconciliation({
      classifications: [{
        id: 'c1',
        postpartumEpisodeId: EP,
        bleedStart: '2026-09-10',
        bleedEnd: '2026-09-14',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      }],
      runs: [{ postpartumEpisodeId: EP, start: '2026-09-11', end: '2026-09-14' }],
    });
    assert.equal(plan.keep.length, 1);
    assert.equal(plan.keep[0].bleedStart, '2026-09-11');
    assert.equal(plan.drop.length, 0);
  });

  it('R split does not duplicate classification', () => {
    const plan = planClassificationReconciliation({
      classifications: [{
        id: 'c1',
        postpartumEpisodeId: EP,
        bleedStart: '2026-09-10',
        bleedEnd: '2026-09-14',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      }],
      runs: [
        { postpartumEpisodeId: EP, start: '2026-09-10', end: '2026-09-11' },
        { postpartumEpisodeId: EP, start: '2026-09-13', end: '2026-09-14' },
      ],
    });
    assert.equal(plan.keep.length, 1);
    assert.equal(plan.keep[0].bleedStart, '2026-09-10');
    assert.equal(plan.keep[0].bleedEnd, '2026-09-11');
  });

  it('S merge that loses start and extends outside stored range drops', () => {
    const plan = planClassificationReconciliation({
      classifications: [{
        id: 'c1',
        postpartumEpisodeId: EP,
        bleedStart: '2026-09-10',
        bleedEnd: '2026-09-12',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      }],
      runs: [{ postpartumEpisodeId: EP, start: '2026-09-06', end: '2026-09-14' }],
    });
    assert.equal(plan.keep.length, 0);
    assert.equal(plan.drop[0].reason, 'merge');
  });

  it('does not jump to a nearby non-overlapping run', () => {
    const plan = planClassificationReconciliation({
      classifications: [{
        id: 'c1',
        postpartumEpisodeId: EP,
        bleedStart: '2026-09-10',
        bleedEnd: '2026-09-12',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      }],
      runs: [{ postpartumEpisodeId: EP, start: '2026-09-20', end: '2026-09-22' }],
    });
    assert.equal(plan.keep.length, 0);
    assert.equal(plan.drop[0].reason, 'orphan');
  });

  it('T deleting all bleed drops classification', () => {
    const plan = planClassificationReconciliation({
      classifications: [{
        id: 'c1',
        postpartumEpisodeId: EP,
        bleedStart: '2026-09-10',
        bleedEnd: '2026-09-14',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      }],
      runs: [],
    });
    assert.equal(plan.drop[0].reason, 'orphan');
  });

  it('U new postpartum episode does not inherit old classification as current', () => {
    const plan = planClassificationReconciliation({
      classifications: [{
        id: 'c1',
        postpartumEpisodeId: EP_OLD,
        bleedStart: '2026-08-01',
        bleedEnd: '2026-08-03',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      }],
      runs: [{ postpartumEpisodeId: EP, start: '2026-09-10', end: '2026-09-12' }],
    });
    assert.equal(plan.keep.length, 0);
    assert.equal(plan.drop[0].reason, 'orphan');
  });
});

describe('Phase 41 engine vs history vs forecast', () => {
  it('engineLogWhere still excludes all POSTPARTUM', () => {
    const where = engineLogWhere('u1', TODAY);
    assert.ok(where.OR.some((row) => row.trackingContext === null));
    assert.ok(where.OR.some((row) => row.trackingContext?.not === POSTPARTUM_TRACKING_CONTEXT));
  });

  it('102 unclassified still excluded from engine', () => {
    const logs = [pp('2026-09-10', 'heavy')];
    assert.equal(filterLogsForEngine(logs, TODAY).length, 0);
  });

  it('103 classified may enter history but not POSTPARTUM forecast input', () => {
    const historical = [
      { date: '2026-07-01', flow: 'medium' },
      { date: '2026-07-29', flow: 'medium' },
    ];
    const classified = [pp('2026-09-10', 'heavy'), pp('2026-09-11', 'medium')];
    const dates = new Set(['2026-09-10', '2026-09-11']);
    const forecast = forecastLogsForMode('POSTPARTUM', [...historical, ...classified], TODAY, dates);
    const history = filterLogsForMenstrualHistory([...historical, ...classified], TODAY, dates);
    assert.deepEqual(forecast.map((l) => l.date), ['2026-07-01', '2026-07-29']);
    assert.ok(history.some((l) => l.date === '2026-09-10'));
    assert.equal(history.some((l) => l.date === '2026-09-20'), false);
  });

  it('104 POSTPARTUM forecast capabilities stay suppressed even with two classified episodes', () => {
    const caps = capabilitiesForProfileMode('POSTPARTUM');
    assert.equal(caps.showNextPeriodForecast, false);
    assert.equal(caps.showLatePeriod, false);
    assert.equal(caps.showFertileEstimates, false);
    assert.equal(caps.showOvulationEstimate, false);
  });

  it('W TRACK forecast input may include classified postpartum period-flow days', () => {
    const logs = [
      { date: '2026-07-01', flow: 'medium' },
      pp('2026-09-10', 'heavy'),
    ];
    const dates = new Set(['2026-09-10']);
    const forecast = forecastLogsForMode('TRACK_PERIOD', logs, TODAY, dates);
    assert.ok(forecast.some((l) => l.date === '2026-09-10'));
    const inferred = inferCycleStats(forecast);
    assert.ok(inferred.periodStarts.includes('2026-09-10'));
  });

  it('106 POSTPARTUM still does not observe next-period snapshots', () => {
    assert.equal(shouldObservePrediction({
      mode: 'POSTPARTUM',
      predictedDate: '2026-10-08',
      cycleAnchorDate: '2026-09-10',
    }), false);
  });

  it('does not change PERIOD_FLOWS', () => {
    assert.deepEqual(PERIOD_FLOWS, ['light', 'medium', 'heavy']);
  });
});

describe('Phase 41 firewalls', () => {
  it('X AI fail-closed unchanged after classification exists', () => {
    assert.equal(profileModeForAiPrompt('POSTPARTUM'), null);
    assert.equal(isCycleAiContextSupported('POSTPARTUM'), false);
  });

  it('Y partner denylist includes classification keys', () => {
    assert.equal(partnerPayloadHasLeak({ classification: 'MENSTRUAL_PERIOD' }), true);
    assert.equal(partnerPayloadHasLeak({ bleedClassifications: [] }), true);
    assert.equal(partnerPayloadHasLeak({ ownerClassifiedPeriod: true }), true);
  });

  it('export marks classification as owner-entered, not inferred', () => {
    const payload = buildCycleExportPayload({
      profile: { mode: 'POSTPARTUM' },
      postpartumBleedClassifications: [{
        postpartumEpisodeId: EP,
        bleedStart: '2026-09-10',
        bleedEnd: '2026-09-14',
        classification: MENSTRUAL_PERIOD_CLASSIFICATION,
        source: CLASSIFICATION_SOURCE_OWNER,
        classifiedAt: '2026-09-11T10:00:00.000Z',
      }],
    });
    const row = payload.postpartumBleedClassifications[0];
    assert.equal(row.ownerClassified, true);
    assert.equal(row.inferred, false);
    assert.equal(row.source, 'OWNER');
    assert.equal(row.classification, 'MENSTRUAL_PERIOD');
  });

  it('presentation copy does not claim fertility/ovulation/lochia/PPH', () => {
    const ok = 'შენ მონიშნე როგორც მენსტრუაცია. Medicard ნაყოფიერებას ან ოვულაციას არ ადასტურებს.';
    assert.deepEqual(classificationCopyForbidden(ok), {
      fertilityReturn: false,
      ovulationReturn: false,
      lochia: false,
      hemorrhage: false,
      medicardDetected: false,
    });
    assert.equal(classificationCopyForbidden('ნაყოფიერება დაბრუნდა').fertilityReturn, true);
    assert.equal(classificationCopyForbidden('ლოხია').lochia, true);
  });

  it('presentBleedClassification is owner-only V1', () => {
    const shown = presentBleedClassification({
      postpartumEpisodeId: EP,
      bleedStart: '2026-09-10',
      bleedEnd: '2026-09-14',
      classifiedAt: new Date('2026-09-11T00:00:00.000Z'),
    });
    assert.equal(shown.source, 'OWNER');
    assert.equal(shown.inferred, false);
    assert.equal(shown.ownerClassified, true);
  });

  it('findBleedRunForDate classifies the episode not a random day', () => {
    const runs = [{ postpartumEpisodeId: EP, start: '2026-09-10', end: '2026-09-14' }];
    assert.equal(findBleedRunForDate(runs, '2026-09-12').start, '2026-09-10');
    assert.equal(findBleedRunForDate(runs, '2026-09-20'), null);
  });

  it('serialize export helper does not invent diagnosis categories', () => {
    const rows = serializeBleedClassificationsForExport([{
      postpartumEpisodeId: EP,
      bleedStart: '2026-09-10',
      bleedEnd: '2026-09-11',
    }]);
    assert.equal(rows[0].classification, 'MENSTRUAL_PERIOD');
    assert.equal(JSON.stringify(rows).includes('LOCHIA'), false);
    assert.equal(JSON.stringify(rows).includes('PPH'), false);
  });

  it('mergeForecastLogs does not overwrite engine rows', () => {
    const merged = mergeForecastLogs(
      [{ date: '2026-07-01', flow: 'medium' }],
      [pp('2026-09-10', 'heavy')],
    );
    assert.equal(merged.length, 2);
  });

  it('Z doctor postpartumContext has no classification / return-of-period fields', () => {
    const out = buildCycleDoctorSummaryData({
      profile: { mode: 'POSTPARTUM' },
      logs: [pp(TODAY, 'heavy')],
      today: TODAY,
      postpartumEpisode: { id: EP, status: 'ACTIVE', referenceDate: '2026-08-19' },
    });
    const blob = JSON.stringify(out.postpartumContext || {});
    assert.equal(Object.hasOwn(out.postpartumContext || {}, 'classification'), false);
    assert.equal(blob.includes('MENSTRUAL_PERIOD'), false);
    assert.equal(blob.includes('returnOfPeriod'), false);
    assert.equal(blob.includes('fertilityReturned'), false);
  });

  it('Phase 42: historical classify remains possible after TRACK, not Pregnancy', () => {
    assert.equal(canMutatePostpartumBleedClassification('POSTPARTUM'), true);
    assert.equal(canMutatePostpartumBleedClassification('TRACK_PERIOD'), true);
    assert.equal(canMutatePostpartumBleedClassification('TRY_TO_CONCEIVE'), true);
    assert.equal(canMutatePostpartumBleedClassification('PERIMENOPAUSE'), true);
    assert.equal(canMutatePostpartumBleedClassification('PREGNANCY'), false);
  });
});
