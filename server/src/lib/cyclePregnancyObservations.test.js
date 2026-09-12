import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './cycle.js';
import { buildPredictions } from './cycle.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildPartnerPayload } from './cycleShare.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { DOCTOR_SUMMARY, getObservationDef, observationAiAllowed, observationPartnerAllowed } from './cycleObservationRegistry.js';
import { parseObservationWrite } from './cycleObservations.js';
import { buildCyclePregnancyData } from './cyclePregnancy.js';
import {
  episodeObservationWindow,
  presentPregnancyDay,
  presentPregnancyRecentObservations,
} from './cyclePregnancyObservations.js';
import { presentPregnancyTimeline } from '../../../mobile/src/lib/pregnancyTimelinePresent.js';
import { attachWeekDevelopment } from '../../../mobile/src/lib/pregnancyWeekData.js';
import { presentPregnancyDating } from './cyclePregnancy.js';

const TODAY = '2026-09-10';
const LMP = '2026-05-14';

function episode(startedAt, extra = {}) {
  return {
    id: extra.id || 'ep-active',
    referenceDate: LMP,
    referenceType: 'LMP',
    status: 'ACTIVE',
    startedAt,
    endedAt: extra.endedAt || null,
    ...extra,
  };
}

function preg(logs, ep = episode(new Date('2026-08-20T10:00:00.000Z'))) {
  return buildCyclePregnancyData({
    today: TODAY,
    profile: { mode: 'PREGNANCY' },
    episode: ep,
    logs,
  });
}

describe('heartburn registry policy', () => {
  it('accepts heartburn as a canonical digestion chip with deny defaults', () => {
    const defn = getObservationDef('heartburn');
    assert.equal(defn.category, 'digestion');
    assert.equal(defn.storage, 'symptoms');
    assert.equal(observationAiAllowed('heartburn'), false);
    assert.equal(observationPartnerAllowed('heartburn'), false);
    assert.equal(defn.trendEligible, false);
    assert.equal(defn.pregnancyTrendEligible, true);
    assert.equal(defn.doctorSummary, DOCTOR_SUMMARY.EXCLUDE);
    const written = parseObservationWrite({ symptoms: ['heartburn', 'nausea'] });
    assert.deepEqual(written.symptoms.sort(), ['heartburn', 'nausea']);
  });
});

describe('Pregnancy observation window', () => {
  it('uses episode startedAt, not LMP/referenceDate', () => {
    const window = episodeObservationWindow({
      episode: episode(new Date('2026-09-01T08:00:00.000Z')),
      today: TODAY,
    });
    assert.equal(window.from, '2026-09-01');
    assert.equal(window.to, TODAY);
    assert.ok(window.from > LMP);
  });

  it('caps recent observations to 90 days inside a long episode', () => {
    const window = episodeObservationWindow({
      episode: episode(new Date('2025-12-01T10:00:00.000Z')),
      today: TODAY,
    });
    assert.equal(window.from, addDays(TODAY, -89));
  });
});

describe('Pregnancy recentObservations fixtures', () => {
  it('A — empty day is a logging state, not symptom absence', () => {
    const data = preg([]);
    assert.equal(data.todayObservations, null);
    assert.deepEqual(data.recentObservations, []);
    assert.equal(JSON.stringify(data).includes('No nausea'), false);
    assert.equal(JSON.stringify(data).includes('არ არის გულისრევა'), false);
  });

  it('B — nausea + fatigue', () => {
    const data = preg([{ date: TODAY, symptoms: ['nausea', 'fatigue'] }]);
    assert.deepEqual(data.todayObservations.symptoms.sort(), ['fatigue', 'nausea']);
    assert.equal(data.recentObservations[0].date, TODAY);
  });

  it('C — spotting + cramps stay factual', () => {
    const data = preg([
      {
        date: TODAY,
        flow: 'spotting',
        painEntries: [{ type: 'cramps', severity: 'mild' }],
      },
    ]);
    assert.equal(data.todayObservations.bleeding, 'spotting');
    assert.equal(data.todayObservations.spotting, true);
    assert.deepEqual(data.todayObservations.pain, [{ type: 'cramps', severity: 'mild' }]);
    assert.equal(JSON.stringify(data.todayObservations).includes('miscarriage'), false);
    assert.equal(JSON.stringify(data.todayObservations).includes('implantation'), false);
  });

  it('D — lower-back pain severity is passed through', () => {
    const data = preg([
      { date: TODAY, painEntries: [{ type: 'lower_back', severity: 'moderate' }] },
    ]);
    assert.deepEqual(data.todayObservations.pain, [{ type: 'lower_back', severity: 'moderate' }]);
  });

  it('E — digestion-rich day', () => {
    const data = preg([
      {
        date: TODAY,
        symptoms: ['bloating', 'nausea', 'vomiting', 'constipation', 'diarrhea', 'heartburn'],
      },
    ]);
    assert.deepEqual(data.todayObservations.symptoms.sort(), [
      'bloating',
      'constipation',
      'diarrhea',
      'heartburn',
      'nausea',
      'vomiting',
    ]);
  });

  it('F — energy + sleep + stress', () => {
    const data = preg([
      {
        date: TODAY,
        sleepQuality: 'poor',
        stressLevel: 'high',
        observations: { energy: 'low' },
        energy: 'low',
      },
    ]);
    assert.deepEqual(data.todayObservations.wellness, {
      energy: 'low',
      sleepQuality: 'poor',
      stressLevel: 'high',
    });
  });

  it('G — new heartburn field is presented', () => {
    const data = preg([{ date: TODAY, symptoms: ['heartburn'] }]);
    assert.deepEqual(data.todayObservations.symptoms, ['heartburn']);
  });

  it('H — legacy pain chips do not double-count with painEntries', () => {
    const data = preg([
      {
        date: TODAY,
        symptoms: ['cramps', 'nausea', 'headache'],
        painEntries: [{ type: 'cramps', severity: 'mild' }, { type: 'headache', severity: 'moderate' }],
      },
    ]);
    assert.deepEqual(data.todayObservations.symptoms, ['nausea']);
    assert.equal(data.todayObservations.pain.length, 2);
  });

  it('I — private notes and sexual data stay out of Overview todayObservations', () => {
    const data = preg([
      {
        date: TODAY,
        notes: 'private diary',
        sexualActivity: true,
        symptoms: ['protected', 'nausea', 'discharge'],
      },
    ]);
    assert.deepEqual(data.todayObservations.symptoms, ['nausea']);
    assert.equal(JSON.stringify(data.todayObservations).includes('protected'), false);
    assert.equal(JSON.stringify(data.todayObservations).includes('private diary'), false);
    assert.equal(data.todayLogged.hasNotes, true);
    const journal = presentPregnancyDay(
      { date: TODAY, symptoms: ['discharge', 'nausea'] },
      { includeIntimate: true },
    );
    assert.ok(journal.symptoms.includes('discharge'));
  });

  it('J — previous episode history does not mix into a new ACTIVE episode', () => {
    const previous = { date: '2026-08-01', symptoms: ['nausea'], flow: 'spotting' };
    const current = { date: TODAY, symptoms: ['fatigue'] };
    const data = preg([previous, current], episode(new Date(`${TODAY}T09:00:00.000Z`), { id: 'ep-new' }));
    assert.equal(data.recentObservations.length, 1);
    assert.equal(data.recentObservations[0].date, TODAY);
    assert.deepEqual(data.recentObservations[0].symptoms, ['fatigue']);
    assert.equal(data.recentObservations.some((row) => row.date === '2026-08-01'), false);
  });

  it('K — unknown stored keys are hidden', () => {
    const presented = presentPregnancyDay({
      date: TODAY,
      symptoms: ['nausea', 'mystery_chip', 'preeclampsia_flag'],
    });
    assert.deepEqual(presented.symptoms, ['nausea']);
    assert.equal(JSON.stringify(presented).includes('mystery'), false);
  });

  it('L — offline-shaped rich write presents through the same normalizer', () => {
    const rows = presentPregnancyRecentObservations(
      [
        {
          date: TODAY,
          flow: 'light',
          symptoms: ['nausea', 'heartburn', 'fatigue'],
          painEntries: [{ type: 'lower_back', severity: 'mild' }],
          observations: { energy: 'very_low' },
          sleepQuality: 'okay',
        },
      ],
      { from: TODAY, to: TODAY },
    );
    assert.equal(rows[0].bleeding, 'light');
    assert.ok(rows[0].symptoms.includes('heartburn'));
    assert.equal(rows[0].wellness.energy, 'very_low');
  });
});

describe('Pregnancy observation privacy / engine / dating regression', () => {
  it('does not add heartburn to AI, partner, or doctor summary', () => {
    const log = { date: TODAY, symptoms: ['heartburn', 'nausea'] };
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [log],
      predictions: buildPredictions({
        lastPeriodStart: LMP,
        avgCycleLength: 28,
        avgPeriodLength: 5,
        cycleCount: 3,
        logs: [{ date: LMP, flow: 'medium' }],
      }),
    });
    assert.doesNotMatch(prompt, /heartburn|გულძმარვა/);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP },
      logs: [log],
    });
    const blob = JSON.stringify(partner);
    assert.equal(blob.includes('heartburn'), false);
    const doctor = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: [log],
    });
    assert.equal(JSON.stringify(doctor).includes('heartburn'), false);
  });

  it('does not change forecast arithmetic when non-flow observations are added', () => {
    const bleed = [
      { date: '2026-06-17', flow: 'medium' },
      { date: '2026-07-15', flow: 'medium' },
      { date: LMP, flow: 'medium' },
    ];
    const withObs = [
      ...bleed,
      { date: TODAY, symptoms: ['nausea', 'heartburn'], painEntries: [{ type: 'cramps', severity: 'mild' }] },
    ];
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
    assert.deepEqual(a.fertileWindow, b.fertileWindow);
    assert.equal(a.ovulationDate, b.ovulationDate);
  });

  it('does not change pregnancy dating, baby-size, or timeline attachment', () => {
    const data = preg([{ date: TODAY, symptoms: ['nausea'] }]);
    const dating = presentPregnancyDating({ referenceDate: LMP, referenceType: 'LMP', today: TODAY });
    assert.deepEqual(data.estimatedGestationalAge, dating.estimatedGestationalAge);
    assert.equal(data.weekDevelopment.week, attachWeekDevelopment(dating).week);
    const timeline = presentPregnancyTimeline({
      mode: 'PREGNANCY',
      pregnancyActive: true,
      dating,
    });
    assert.equal(data.timeline.currentWeek, timeline.currentWeek);
    assert.equal(data.timeline.available, true);
  });

  it('does not return raw observations JSON or pregnancyTest in recentObservations', () => {
    const data = preg([
      {
        date: TODAY,
        observations: { energy: 'low', mystery: true },
        pregnancyTest: 'positive',
        bbt: 36.6,
        cervicalMucus: 'eggwhite',
        symptoms: ['nausea'],
      },
    ]);
    const row = data.recentObservations[0];
    assert.equal(row.wellness.energy, 'low');
    assert.equal(JSON.stringify(row).includes('mystery'), false);
    assert.equal(JSON.stringify(row).includes('eggwhite'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'pregnancyTest'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'observations'), false);
  });
});
