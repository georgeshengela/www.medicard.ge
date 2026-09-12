import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildCycleAiUserPrompt, buildPredictions } from './cycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { getObservationDef } from './cycleObservationRegistry.js';
import { buildObservationTrends } from './cycleObservationTrends.js';
import { buildPregnancyObservationTrends } from './cyclePregnancyObservationTrends.js';
import { buildPerimenopauseContext } from './cyclePerimenopause.js';
import { CYCLE_CANDIDATE_TYPES } from '../../../mobile/src/lib/cycleNotificationContract.js';
import {
  PERI_SUMMARY_MIN_OCCURRENCES,
  PERI_SUMMARY_RECENT_DAYS,
  PERI_SUMMARY_TYPES,
  buildPerimenopauseObservationSummaries,
  periObservationSummaryHasDenominator,
  periObservationSummaryHasSensitiveLeak,
} from './cyclePerimenopauseObservationTrends.js';

const TODAY = '2026-09-10';

function summaries(logs, extra = {}) {
  return buildPerimenopauseObservationSummaries({
    logs,
    today: TODAY,
    mode: extra.mode || 'PERIMENOPAUSE',
  });
}

function peri(logs) {
  return buildPerimenopauseContext({
    mode: 'PERIMENOPAUSE',
    logs,
    inferred: { periodStarts: [], periodRanges: [] },
    predictions: { confidence: 'low' },
    today: TODAY,
  });
}

describe('perimenopause summary registry metadata', () => {
  it('defaults new, private, fertility, and unknown-adjacent keys to false', () => {
    assert.equal(getObservationDef('vaginal_dryness').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('notes').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('bbt').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('ovulationTest').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('pregnancyTest').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('cervicalMucus').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('sexualActivity').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('libido').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('discharge').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('anxious').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('nausea').perimenopauseSummaryEligible, false);
    assert.equal(getObservationDef('gas').perimenopauseSummaryEligible, false);
  });

  it('marks reviewed Perimenopause keys without changing Phase 13 or Phase 23 flags', () => {
    assert.equal(getObservationDef('hot_flashes').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('night_sweats').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('hot_flashes').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('night_sweats').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('flow').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('pain').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('energy').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('sleepQuality').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('fatigue').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('migraine').perimenopauseSummaryEligible, true);
    assert.equal(getObservationDef('heartburn').trendEligible, false);
    assert.equal(getObservationDef('heartburn').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('heartburn').perimenopauseSummaryEligible, true);
  });
});

describe('Perimenopause observation summary fixtures', () => {
  it('A — no eligible repeated logs, no summary rows', () => {
    const data = summaries([]);
    assert.deepEqual(data.summaries, []);
    assert.equal(periObservationSummaryHasDenominator(data), false);
  });

  it('B — one hot-flash day, no summary row', () => {
    const data = summaries([{ date: TODAY, symptoms: ['hot_flashes'] }]);
    assert.equal(data.summaries.length, 0);
  });

  it('C — two hot-flash days, one factual row', () => {
    const data = summaries([
      { date: addDays(TODAY, -3), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ]);
    assert.equal(data.summaries.length, 1);
    assert.equal(data.summaries[0].key, 'hot_flashes');
    assert.equal(data.summaries[0].occurrenceCount, 2);
    assert.equal(data.summaries[0].summaryType, PERI_SUMMARY_TYPES.RECENT_OCCURRENCE);
    assert.deepEqual(data.summaries[0].summaryArgs, { days: 2 });
    assert.equal(data.summaries[0].lastLoggedDate, TODAY);
    const blob = JSON.stringify(data);
    assert.equal(/perimenopause hot flash/i.test(blob), false);
    assert.equal(blob.includes('percent'), false);
  });

  it('D — missing days are not a denominator', () => {
    const data = summaries([
      { date: addDays(TODAY, -15), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ]);
    assert.equal(data.summaries[0].occurrenceCount, 2);
    assert.equal(periObservationSummaryHasDenominator(data), false);
    assert.equal(data.summaries[0].summaryArgs.windowDays, undefined);
  });

  it('E — sleep-only day does not infer hot_flashes false', () => {
    const data = summaries([
      { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
      { date: addDays(TODAY, -1), sleepQuality: 'poor' },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ]);
    const hot = data.summaries.find((row) => row.key === 'hot_flashes');
    assert.equal(hot.occurrenceCount, 2);
    assert.equal(data.summaries.some((row) => row.key === 'hot_flashes' && row.occurrenceCount === 3), false);
  });

  it('F — night sweats, factual count only', () => {
    const data = summaries([
      { date: addDays(TODAY, -4), symptoms: ['night_sweats'] },
      { date: addDays(TODAY, -2), symptoms: ['night_sweats'] },
      { date: TODAY, symptoms: ['night_sweats'] },
    ]);
    const row = data.summaries.find((item) => item.key === 'night_sweats');
    assert.equal(row.occurrenceCount, 3);
    assert.equal(JSON.stringify(row).includes('hormone'), false);
  });

  it('G — bleeding categorical counts, no interpretation', () => {
    const data = summaries([
      { date: addDays(TODAY, -6), flow: 'spotting' },
      { date: addDays(TODAY, -5), flow: 'spotting' },
      { date: addDays(TODAY, -3), flow: 'light' },
      { date: addDays(TODAY, -1), flow: 'heavy' },
    ]);
    const row = data.summaries.find((item) => item.key === 'flow');
    assert.equal(row.occurrenceCount, 4);
    assert.equal(row.summaryType, PERI_SUMMARY_TYPES.RECENT_BLEEDING_OCCURRENCE);
    assert.deepEqual(row.flowCounts, { spotting: 2, light: 1, medium: 0, heavy: 1 });
    const blob = JSON.stringify(row);
    assert.equal(blob.includes('abnormal'), false);
    assert.equal(blob.includes('menopausal'), false);
  });

  it('H — energy low/very_low grouping, no average', () => {
    const data = summaries([
      { date: addDays(TODAY, -3), observations: { energy: 'low' } },
      { date: addDays(TODAY, -1), observations: { energy: 'very_low' } },
      { date: TODAY, observations: { energy: 'high' } },
    ]);
    const row = data.summaries.find((item) => item.key === 'energy.low');
    assert.equal(row.occurrenceCount, 2);
    assert.equal(row.summaryArgs.average, undefined);
    assert.equal(row.summaryArgs.score, undefined);
  });

  it('I — poor sleep category count, no score', () => {
    const data = summaries([
      { date: addDays(TODAY, -2), sleepQuality: 'poor' },
      { date: addDays(TODAY, -1), sleepQuality: 'good' },
      { date: TODAY, sleepQuality: 'poor' },
    ]);
    const row = data.summaries.find((item) => item.key === 'sleep.poor');
    assert.equal(row.occurrenceCount, 2);
    assert.equal(row.summaryArgs.score, undefined);
  });

  it('J — mood is factual irritable/sad only, no diagnosis', () => {
    const data = summaries([
      { date: addDays(TODAY, -2), moods: ['irritable'] },
      { date: TODAY, moods: ['irritable', 'anxious'] },
    ]);
    assert.ok(data.summaries.some((row) => row.key === 'irritable' && row.occurrenceCount === 2));
    assert.equal(data.summaries.some((row) => row.key === 'anxious'), false);
    assert.equal(JSON.stringify(data).includes('depression'), false);
  });

  it('K — private vaginal dryness, sexual data, notes never summarize', () => {
    const data = summaries([
      {
        date: addDays(TODAY, -2),
        symptoms: ['vaginal_dryness', 'hot_flashes'],
        notes: 'secret',
        sexualActivity: true,
      },
      { date: TODAY, symptoms: ['vaginal_dryness', 'hot_flashes'], libido: 3 },
    ]);
    assert.ok(data.summaries.some((row) => row.key === 'hot_flashes'));
    assert.equal(data.summaries.some((row) => row.key === 'vaginal_dryness'), false);
    assert.equal(periObservationSummaryHasSensitiveLeak(data), false);
  });

  it('L — TTC fields never summarize', () => {
    const data = summaries([
      { date: addDays(TODAY, -2), ovulationTest: 'positive', bbt: 36.5, cervicalMucus: 'egg_white' },
      { date: TODAY, ovulationTest: 'positive', pregnancyTest: 'negative', bbt: 36.6 },
    ]);
    assert.deepEqual(data.summaries, []);
  });

  it('M — unknown keys never summarize', () => {
    const data = summaries([
      { date: addDays(TODAY, -2), symptoms: ['mystery_chip', 'hot_flashes'] },
      { date: TODAY, symptoms: ['mystery_chip', 'hot_flashes'] },
    ]);
    assert.equal(data.summaries.some((row) => row.key === 'mystery_chip'), false);
    assert.ok(data.summaries.some((row) => row.key === 'hot_flashes'));
  });

  it('N — edit/delete recomputes; below threshold disappears', () => {
    const two = summaries([
      { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ]);
    assert.equal(two.summaries[0].occurrenceCount, 2);
    const deleted = summaries([{ date: TODAY, symptoms: ['hot_flashes'] }]);
    assert.equal(deleted.summaries.length, 0);
  });

  it('O — TRACK logs summarized after switch-in remain factual, not perimenopausal labels', () => {
    const data = summaries([
      { date: addDays(TODAY, -4), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ]);
    assert.equal(data.summaries[0].key, 'hot_flashes');
    const blob = JSON.stringify(data);
    assert.equal(/perimenopause hot flash/i.test(blob), false);
    assert.equal(blob.includes('since entering'), false);
  });

  it('P — TRACK/TTC/PREGNANCY mode does not emit peri summaries', () => {
    const logs = [
      { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ];
    assert.deepEqual(summaries(logs, { mode: 'TRACK_PERIOD' }).summaries, []);
    assert.deepEqual(summaries(logs, { mode: 'TRY_TO_CONCEIVE' }).summaries, []);
    assert.deepEqual(summaries(logs, { mode: 'PREGNANCY' }).summaries, []);
    assert.equal(buildPerimenopauseContext({ mode: 'TRACK_PERIOD', logs, today: TODAY }), null);
  });

  it('window is last 30 civil days and ignores older repeats', () => {
    const data = summaries([
      { date: addDays(TODAY, -40), symptoms: ['hot_flashes'] },
      { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
    ]);
    assert.equal(data.summaries.length, 0);
    assert.equal(data.window.recentDays, PERI_SUMMARY_RECENT_DAYS);
    assert.equal(data.window.queryCapDays, 90);
    assert.equal(data.window.from, addDays(TODAY, -29));
    assert.equal(data.window.to, TODAY);
  });

  it('pain severity is categorical and headache/migraine stay distinct', () => {
    const data = summaries([
      { date: addDays(TODAY, -3), painEntries: [{ type: 'headache', severity: 'mild' }], symptoms: ['migraine'] },
      { date: TODAY, painEntries: [{ type: 'headache', severity: 'severe' }], symptoms: ['migraine'] },
    ]);
    const headache = data.summaries.find((row) => row.key === 'pain.headache');
    const migraine = data.summaries.find((row) => row.key === 'migraine');
    assert.equal(headache.occurrenceCount, 2);
    assert.equal(headache.severityCounts.mild, 1);
    assert.equal(headache.severityCounts.severe, 1);
    assert.equal(migraine.occurrenceCount, 2);
  });

  it('fatigue stays distinct from energy.low', () => {
    const data = summaries([
      { date: addDays(TODAY, -2), symptoms: ['fatigue'], observations: { energy: 'low' } },
      { date: TODAY, symptoms: ['fatigue'], observations: { energy: 'low' } },
    ]);
    assert.ok(data.summaries.some((row) => row.key === 'fatigue' && row.occurrenceCount === 2));
    assert.ok(data.summaries.some((row) => row.key === 'energy.low' && row.occurrenceCount === 2));
  });
});

describe('Perimenopause observation summary firewalls', () => {
  it('Q — Phase 23 Pregnancy summaries unchanged', () => {
    const preg = buildPregnancyObservationTrends({
      logs: [
        { date: addDays(TODAY, -3), symptoms: ['nausea'] },
        { date: TODAY, symptoms: ['nausea'] },
      ],
      today: TODAY,
      episode: {
        id: 'ep',
        status: 'ACTIVE',
        startedAt: new Date(`${addDays(TODAY, -40)}T10:00:00.000Z`),
        referenceDate: '2026-05-14',
        referenceType: 'LMP',
      },
      pregnancyActive: true,
    });
    assert.equal(preg.trends[0].key, 'nausea');
    assert.equal(preg.trends[0].occurrenceCount, 2);
    assert.equal(getObservationDef('hot_flashes').pregnancyTrendEligible, false);
  });

  it('does not change Phase 13 generic trends', () => {
    const trends = buildObservationTrends({
      logs: [
        { date: addDays(TODAY, -20), flow: 'medium' },
        { date: addDays(TODAY, -19), flow: 'light' },
        { date: addDays(TODAY, -2), symptoms: ['bloating'] },
        { date: TODAY, symptoms: ['bloating'] },
      ],
      today: TODAY,
    });
    assert.ok(trends.trends.some((row) => row.key === 'bloating' && row.occurrenceCount >= 2));
  });

  it('S — doctor summary does not gain derived observation summaries', () => {
    const doctor = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE', avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [
        { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
        { date: TODAY, symptoms: ['hot_flashes'] },
      ],
    });
    assert.equal(Object.hasOwn(doctor, 'observationSummaries'), false);
    assert.equal(doctor.perimenopauseContext.current, true);
    assert.equal(JSON.stringify(doctor).includes('observationSummaries'), false);
  });

  it('does not add summaries to AI or partner', () => {
    const logs = [
      { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ];
    const prompt = buildCycleAiUserPrompt({
      profile: {
        mode: 'PERIMENOPAUSE',
        lastPeriodStart: addDays(TODAY, -20),
        avgCycleLength: 28,
        avgPeriodLength: 5,
        isIrregular: false,
        conditions: [],
      },
      logs,
      predictions: { confidence: 'low', nextPeriodStart: addDays(TODAY, 10), ovulationDate: addDays(TODAY, -2) },
      pregnancy: null,
      user: { age: 48 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: TODAY,
    });
    assert.equal(prompt.includes('observationSummaries'), false);
    assert.equal(prompt.includes('hot_flashes logged'), false);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'PERIMENOPAUSE', lastPeriodStart: addDays(TODAY, -20), avgCycleLength: 28, avgPeriodLength: 5 },
      logs,
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    assert.equal(JSON.stringify(partner).includes('observationSummaries'), false);
    assert.equal(
      partnerPayloadHasLeak({ ...partner, observationSummaries: summaries(logs) }),
      true,
    );
  });

  it('does not add a Notification Brain summary candidate', () => {
    assert.equal(CYCLE_CANDIDATE_TYPES.includes('periObservationSummary'), false);
    assert.equal(CYCLE_CANDIDATE_TYPES.includes('hotFlashesRepeated'), false);
  });

  it('owner peri payload includes summaries without diagnosis language', () => {
    const payload = peri([
      { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ]);
    assert.equal(payload.observationSummaries.summaries[0].occurrenceCount, 2);
    const blob = JSON.stringify(payload);
    assert.equal(blob.includes('patient is perimenopausal'), false);
    assert.equal(blob.includes('entered menopause'), false);
    assert.equal(periObservationSummaryHasSensitiveLeak(payload.observationSummaries), false);
  });

  it('forecast arithmetic is not fed by summaries', () => {
    const logs = [
      { date: addDays(TODAY, -40), flow: 'medium' },
      { date: addDays(TODAY, -39), flow: 'light' },
      { date: addDays(TODAY, -2), symptoms: ['hot_flashes'] },
      { date: TODAY, symptoms: ['hot_flashes'] },
    ];
    const a = buildPredictions({
      lastPeriodStart: addDays(TODAY, -40),
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      cycleLengths: [28, 28, 28],
      logs,
    });
    const b = buildPredictions({
      lastPeriodStart: addDays(TODAY, -40),
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      cycleLengths: [28, 28, 28],
      logs: logs.filter((row) => row.flow),
    });
    assert.equal(a.nextPeriodStart, b.nextPeriodStart);
  });
});
