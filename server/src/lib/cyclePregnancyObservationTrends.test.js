import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildPredictions, buildCycleAiUserPrompt } from './cycle.js';
import { buildPartnerPayload } from './cycleShare.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { getObservationDef } from './cycleObservationRegistry.js';
import { buildObservationTrends } from './cycleObservationTrends.js';
import { buildCyclePregnancyData, presentPregnancyDating } from './cyclePregnancy.js';
import { presentPregnancyTimeline } from '../../../mobile/src/lib/pregnancyTimelinePresent.js';
import { attachWeekDevelopment } from '../../../mobile/src/lib/pregnancyWeekData.js';
import {
  PREGNANCY_TREND_MIN_OCCURRENCES,
  PREGNANCY_TREND_RECENT_DAYS,
  PREGNANCY_TREND_TYPES,
  buildPregnancyObservationTrends,
  pregnancyObservationTrendHasDenominator,
  pregnancyObservationTrendPayloadHasSensitiveLeak,
} from './cyclePregnancyObservationTrends.js';

const TODAY = '2026-09-10';
const LMP = '2026-05-14';

function episode(startedAt, extra = {}) {
  return {
    id: extra.id || 'ep-active',
    referenceDate: extra.referenceDate || LMP,
    referenceType: extra.referenceType || 'LMP',
    status: extra.status || 'ACTIVE',
    startedAt,
    endedAt: extra.endedAt || null,
    ...extra,
  };
}

function activeEp(daysAgo = 40) {
  return episode(new Date(`${addDays(TODAY, -daysAgo)}T10:00:00.000Z`));
}

function trends(logs, ep = activeEp()) {
  return buildPregnancyObservationTrends({
    logs,
    today: TODAY,
    episode: ep,
    pregnancyActive: true,
  });
}

function preg(logs, ep = activeEp()) {
  return buildCyclePregnancyData({
    today: TODAY,
    profile: { mode: 'PREGNANCY' },
    episode: ep,
    logs,
  });
}

function days(symptom, count, startOffset) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(TODAY, startOffset + i), symptoms: [symptom] });
  }
  return rows;
}

describe('pregnancy trend registry metadata', () => {
  it('defaults new and sensitive keys to pregnancyTrendEligible false', () => {
    assert.equal(getObservationDef('discharge').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('gas').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('notes').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('pregnancyTest').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('bbt').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('sleepQuality').pregnancyTrendEligible, false);
    assert.equal(getObservationDef('stressLevel').pregnancyTrendEligible, false);
  });

  it('marks reviewed Pregnancy keys without changing Phase 13 trendEligible', () => {
    assert.equal(getObservationDef('nausea').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('heartburn').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('heartburn').trendEligible, false);
    assert.equal(getObservationDef('swelling').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('short_breath').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('frequent_urination').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('flow').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('pain').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('energy').pregnancyTrendEligible, true);
    assert.equal(getObservationDef('fatigue').pregnancyTrendEligible, true);
  });
});

describe('Pregnancy observation trend fixtures', () => {
  it('A — no observations, no trend rows', () => {
    const data = trends([]);
    assert.deepEqual(data.trends, []);
    assert.equal(pregnancyObservationTrendHasDenominator(data), false);
  });

  it('B — one nausea log, no trend row', () => {
    const data = trends([{ date: TODAY, symptoms: ['nausea'] }]);
    assert.equal(data.trends.length, 0);
  });

  it('C — two nausea logs, one factual row', () => {
    const data = trends([
      { date: addDays(TODAY, -3), symptoms: ['nausea'] },
      { date: TODAY, symptoms: ['nausea'] },
    ]);
    assert.equal(data.trends.length, 1);
    assert.equal(data.trends[0].key, 'nausea');
    assert.equal(data.trends[0].occurrenceCount, 2);
    assert.equal(data.trends[0].summaryType, PREGNANCY_TREND_TYPES.RECENT_OCCURRENCE);
    assert.deepEqual(data.trends[0].summaryArgs, { days: 2 });
    assert.equal(data.trends[0].lastLoggedDate, TODAY);
  });

  it('D — five nausea logs over 30 days with missing days, count 5, no denominator', () => {
    const logs = [0, 6, 12, 18, 24].map((ago) => ({
      date: addDays(TODAY, -ago),
      symptoms: ['nausea'],
    }));
    const data = trends(logs);
    const row = data.trends.find((item) => item.key === 'nausea');
    assert.equal(row.occurrenceCount, 5);
    assert.equal(row.exposure, undefined);
    assert.equal(row.summaryArgs.windowDays, undefined);
    assert.equal(pregnancyObservationTrendHasDenominator(data), false);
    assert.doesNotMatch(JSON.stringify(data), /%|42%|of 30|out of/);
  });

  it('E — pain severities are categorical, not averaged', () => {
    const data = trends([
      { date: addDays(TODAY, -4), painEntries: [{ type: 'lower_back', severity: 'mild' }] },
      { date: addDays(TODAY, -3), painEntries: [{ type: 'lower_back', severity: 'moderate' }] },
      { date: addDays(TODAY, -2), painEntries: [{ type: 'lower_back', severity: 'moderate' }] },
      { date: addDays(TODAY, -1), painEntries: [{ type: 'lower_back', severity: 'moderate' }] },
    ]);
    const row = data.trends.find((item) => item.key === 'pain.lower_back');
    assert.equal(row.occurrenceCount, 4);
    assert.deepEqual(row.severityCounts, { mild: 1, moderate: 3, severe: 0 });
    assert.equal(JSON.stringify(row).includes('mean'), false);
    assert.equal(JSON.stringify(row).includes('average'), false);
  });

  it('F — spotting / bleeding counts only', () => {
    const data = trends([
      { date: addDays(TODAY, -5), flow: 'spotting' },
      { date: addDays(TODAY, -2), flow: 'spotting' },
      { date: addDays(TODAY, -1), flow: 'light' },
    ]);
    const row = data.trends.find((item) => item.key === 'flow');
    assert.equal(row.summaryType, PREGNANCY_TREND_TYPES.RECENT_BLEEDING_OCCURRENCE);
    assert.equal(row.occurrenceCount, 3);
    assert.deepEqual(row.flowCounts, { spotting: 2, light: 1, medium: 0, heavy: 0 });
    assert.doesNotMatch(JSON.stringify(row), /persistent|concern|miscarriage|increasing/);
  });

  it('G — low and very_low energy are grouped, not numeric-averaged', () => {
    const data = trends([
      { date: addDays(TODAY, -5), observations: { energy: 'very_low' } },
      { date: addDays(TODAY, -4), observations: { energy: 'low' } },
      { date: addDays(TODAY, -3), observations: { energy: 'low' } },
      { date: addDays(TODAY, -2), observations: { energy: 'normal' } },
      { date: addDays(TODAY, -1), energy: 'low' },
    ]);
    const row = data.trends.find((item) => item.key === 'energy.low');
    assert.equal(row.occurrenceCount, 4);
    assert.equal(data.trends.some((item) => item.key === 'energy'), false);
  });

  it('H — heartburn occurrence only', () => {
    const data = trends([
      { date: addDays(TODAY, -4), symptoms: ['heartburn'] },
      { date: addDays(TODAY, -1), symptoms: ['heartburn'] },
    ]);
    const row = data.trends.find((item) => item.key === 'heartburn');
    assert.equal(row.occurrenceCount, 2);
    assert.equal(row.summaryType, PREGNANCY_TREND_TYPES.RECENT_OCCURRENCE);
  });

  it('I — sensitive-only fertility/private data yields no cards', () => {
    const data = trends([
      {
        date: addDays(TODAY, -2),
        notes: 'secret',
        sexualActivity: true,
        libido: 3,
        pregnancyTest: 'positive',
        ovulationTest: 'positive',
        bbt: 36.6,
        cervicalMucus: 'eggwhite',
        symptoms: ['discharge'],
      },
      {
        date: TODAY,
        notes: 'secret 2',
        sexualActivity: true,
        pregnancyTest: 'positive',
        symptoms: ['discharge'],
      },
    ]);
    assert.equal(data.trends.length, 0);
    assert.equal(pregnancyObservationTrendPayloadHasSensitiveLeak(data), false);
  });

  it('J — historical edit/delete recomputes', () => {
    const before = trends([
      { date: addDays(TODAY, -2), symptoms: ['nausea'] },
      { date: addDays(TODAY, -1), symptoms: ['nausea'] },
      { date: TODAY, symptoms: ['nausea'] },
    ]);
    assert.equal(before.trends[0].occurrenceCount, 3);
    const afterEdit = trends([
      { date: addDays(TODAY, -2), symptoms: ['nausea'] },
      { date: TODAY, symptoms: ['nausea'] },
    ]);
    assert.equal(afterEdit.trends[0].occurrenceCount, 2);
    const afterDelete = trends([{ date: TODAY, symptoms: ['nausea'] }]);
    assert.equal(afterDelete.trends.length, 0);
  });

  it('K — previous Pregnancy episode does not mix into a new ACTIVE episode', () => {
    const startedB = new Date(`${addDays(TODAY, -5)}T10:00:00.000Z`);
    const logs = [
      { date: addDays(TODAY, -10), symptoms: ['nausea'] },
      { date: addDays(TODAY, -8), symptoms: ['nausea'] },
      { date: addDays(TODAY, -7), symptoms: ['nausea'] },
      { date: addDays(TODAY, -6), symptoms: ['nausea'] },
      { date: addDays(TODAY, -1), symptoms: ['nausea'] },
      { date: TODAY, symptoms: ['nausea'] },
    ];
    const data = trends(logs, episode(startedB, { id: 'ep-b' }));
    const row = data.trends.find((item) => item.key === 'nausea');
    assert.equal(row.occurrenceCount, 2);
    assert.ok(data.window.episodeFrom >= addDays(TODAY, -5));
  });

  it('L — unknown stored keys are not trended', () => {
    const data = trends([
      { date: addDays(TODAY, -2), symptoms: ['mystery_chip', 'nausea'] },
      { date: TODAY, symptoms: ['mystery_chip', 'nausea'] },
    ]);
    assert.equal(data.trends.some((item) => item.key === 'mystery_chip'), false);
    assert.equal(data.trends.find((item) => item.key === 'nausea').occurrenceCount, 2);
  });
});

describe('Pregnancy trend missing-data and partial-log semantics', () => {
  it('counts logged days only when there are unlogged days in between', () => {
    const data = trends([
      { date: addDays(TODAY, -10), symptoms: ['nausea'] },
      { date: TODAY, symptoms: ['nausea'] },
    ]);
    assert.equal(data.trends[0].occurrenceCount, 2);
    assert.equal(JSON.stringify(data.trends[0].summaryArgs), '{"days":2}');
  });

  it('does not treat an energy-only day as nausea=false', () => {
    const data = trends([
      { date: addDays(TODAY, -2), symptoms: ['nausea'] },
      { date: addDays(TODAY, -1), observations: { energy: 'low' } },
      { date: TODAY, symptoms: ['nausea'] },
    ]);
    const nausea = data.trends.find((item) => item.key === 'nausea');
    const energy = data.trends.find((item) => item.key === 'energy.low');
    assert.equal(nausea.occurrenceCount, 2);
    assert.equal(energy, undefined);
  });

  it('does not emit a trimester-comparison summary across a trimester boundary', () => {
    const data = trends([
      { date: addDays(TODAY, -20), symptoms: ['nausea'] },
      { date: addDays(TODAY, -10), symptoms: ['nausea'] },
      { date: TODAY, symptoms: ['nausea'] },
    ]);
    assert.equal(data.trends.filter((item) => item.key === 'nausea').length, 1);
    assert.doesNotMatch(JSON.stringify(data), /trimester|T1|T2|first trimester/);
  });

  it('keeps fatigue and energy distinct', () => {
    const data = trends([
      { date: addDays(TODAY, -2), symptoms: ['fatigue'], observations: { energy: 'low' } },
      { date: addDays(TODAY, -1), symptoms: ['fatigue'] },
      { date: TODAY, observations: { energy: 'low' } },
    ]);
    assert.equal(data.trends.find((item) => item.key === 'fatigue').occurrenceCount, 2);
    assert.equal(data.trends.find((item) => item.key === 'energy.low').occurrenceCount, 2);
  });

  it('uses episode startedAt, not LMP, as the lower bound', () => {
    const lateStart = episode(new Date(`${addDays(TODAY, -4)}T08:00:00.000Z`));
    const data = trends(
      [
        { date: addDays(TODAY, -20), symptoms: ['heartburn'] },
        { date: addDays(TODAY, -3), symptoms: ['heartburn'] },
        { date: TODAY, symptoms: ['heartburn'] },
      ],
      lateStart,
    );
    assert.equal(data.trends.find((item) => item.key === 'heartburn').occurrenceCount, 2);
    assert.ok(data.window.from >= addDays(TODAY, -4));
    assert.ok(data.window.from > LMP);
  });

  it('requires at least two occurrences', () => {
    assert.equal(PREGNANCY_TREND_MIN_OCCURRENCES, 2);
    assert.equal(PREGNANCY_TREND_RECENT_DAYS, 30);
  });
});

describe('Pregnancy trend privacy / engine / dating / timeline regression', () => {
  it('does not leak trends into AI, partner, or doctor summary', () => {
    const logs = [
      { date: addDays(TODAY, -2), symptoms: ['nausea', 'heartburn'] },
      { date: TODAY, symptoms: ['nausea', 'heartburn'] },
    ];
    const payload = preg(logs);
    assert.ok(payload.observationTrends.trends.length >= 1);
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5 },
      logs,
      predictions: buildPredictions({
        lastPeriodStart: LMP,
        avgCycleLength: 28,
        avgPeriodLength: 5,
        cycleCount: 3,
        logs: [{ date: LMP, flow: 'medium' }],
      }),
    });
    assert.doesNotMatch(prompt, /observationTrends|RECENT_OCCURRENCE|heartburn/);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP },
      logs,
    });
    assert.equal(JSON.stringify(partner).includes('observationTrends'), false);
    const doctor = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs,
      episode: activeEp(),
    });
    assert.equal(JSON.stringify(doctor).includes('observationTrends'), false);
  });

  it('does not change forecast arithmetic', () => {
    const bleed = [
      { date: '2026-06-17', flow: 'medium' },
      { date: '2026-07-15', flow: 'medium' },
      { date: LMP, flow: 'medium' },
    ];
    const withObs = [...bleed, ...days('nausea', 5, -20)];
    const a = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: bleed,
    });
    const b = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: withObs,
    });
    assert.equal(a.nextPeriodStart, b.nextPeriodStart);
    assert.equal(a.cycleDay, b.cycleDay);
  });

  it('does not change pregnancy dating, baby-size, or timeline attachment', () => {
    const ep = activeEp();
    const data = preg(days('nausea', 3, -6), ep);
    const dating = presentPregnancyDating({
      referenceDate: ep.referenceDate,
      referenceType: 'LMP',
      today: TODAY,
    });
    assert.deepEqual(data.estimatedGestationalAge, dating.estimatedGestationalAge);
    assert.equal(data.weekDevelopment.week, attachWeekDevelopment(dating).week);
    assert.equal(
      data.timeline.currentWeek,
      presentPregnancyTimeline({
        mode: 'PREGNANCY',
        pregnancyActive: true,
        dating,
      }).currentWeek,
    );
  });

  it('does not change Phase 13 generic trend types', () => {
    const payload = buildObservationTrends({
      logs: [
        { date: addDays(TODAY, -2), symptoms: ['nausea'] },
        { date: addDays(TODAY, -1), symptoms: ['nausea'] },
        { date: TODAY, symptoms: ['nausea'] },
      ],
      today: TODAY,
    });
    assert.ok(payload.trends.some((item) => item.key === 'nausea'));
    assert.equal(
      payload.trends.some((item) => item.summaryType === 'PERIOD_EPISODE_RECURRENCE' && item.key === 'flow'),
      false,
    );
  });

  it('TRACK / ended episode produce no current Pregnancy trend rows', () => {
    const logs = days('nausea', 4, -8);
    const track = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      episode: activeEp(),
      logs,
    });
    assert.deepEqual(track.observationTrends.trends, []);
    const ended = trends(logs, episode(new Date('2026-07-01T10:00:00.000Z'), { status: 'ENDED', endedAt: new Date('2026-08-01T10:00:00.000Z') }));
    assert.deepEqual(ended.trends, []);
  });
});
