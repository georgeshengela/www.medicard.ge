import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildPredictions, buildDoctorSummary, inferCycleStats } from './cycle.js';
import { DOCTOR_SUMMARY, getObservationDef } from './cycleObservationRegistry.js';
import {
  buildCycleDoctorSummaryData,
  doctorSummaryHasSensitiveLeak,
  DOCTOR_SUMMARY_QUERY_DAYS,
} from './cycleDoctorSummary.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import {
  estimatedDueDateFromReference,
  gestationalAgeFromReference,
  PREGNANCY_EPISODE_ACTIVE,
  PREGNANCY_EPISODE_ENDED,
  presentPregnancyDating,
} from './cyclePregnancy.js';
import {
  POSTPARTUM_EPISODE_ACTIVE,
  POSTPARTUM_EPISODE_ENDED,
  postpartumElapsed,
} from './cyclePostpartum.js';
import { profileModeForAiPrompt } from './cycleModes.js';

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

describe('registry doctor-summary metadata', () => {
  it('defaults new and unknown keys to EXCLUDE', () => {
    assert.equal(getObservationDef('gas').doctorSummary, DOCTOR_SUMMARY.EXCLUDE);
    assert.equal(getObservationDef('notes').doctorSummary, DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN);
    assert.equal(getObservationDef('irritable').doctorSummary, DOCTOR_SUMMARY.EXCLUDE);
    assert.equal(getObservationDef('customTagIds').doctorSummary, DOCTOR_SUMMARY.EXCLUDE);
    assert.equal(getObservationDef('heartburn').doctorSummary, DOCTOR_SUMMARY.EXCLUDE);
  });

  it('includes reviewed menstrual/pain/wellness keys', () => {
    assert.equal(getObservationDef('flow').doctorSummary, DOCTOR_SUMMARY.INCLUDE);
    assert.equal(getObservationDef('pain').doctorSummary, DOCTOR_SUMMARY.INCLUDE);
    assert.equal(getObservationDef('bloating').doctorSummary, DOCTOR_SUMMARY.INCLUDE);
    assert.equal(getObservationDef('energy').doctorSummary, DOCTOR_SUMMARY.INCLUDE);
    assert.equal(getObservationDef('migraine').doctorSummary, DOCTOR_SUMMARY.INCLUDE);
    assert.equal(getObservationDef('ovulationTest').doctorSummary, DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN);
    assert.equal(getObservationDef('pain_sex').doctorSummary, DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN);
  });
});

describe('doctor summary fixtures', () => {
  it('A period only: menstrual facts, no symptom/private sections', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [...bleed('2026-08-01'), ...bleed('2026-08-29')],
    });
    assert.ok(out.menstrualHistory.episodes.length);
    assert.ok(out.cycleCount >= 1);
    assert.equal(out.pain, null);
    assert.equal(out.symptoms, null);
    assert.equal(out.fertilityObservations, null);
    assert.equal(out.privateObservations, null);
  });

  it('B pain: legacy chip + painEntry count once', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', {
          symptoms: ['cramps', 'headache'],
          painEntries: [{ type: 'cramps', severity: 'moderate' }],
        }),
        log('2026-09-03', { painEntries: [{ type: 'pelvic', severity: 'mild' }] }),
      ],
    });
    assert.equal(out.pain.aggregates.find((p) => p.type === 'cramps').dayCount, 1);
    assert.ok(out.pain.aggregates.find((p) => p.type === 'pelvic'));
    assert.equal(out.pain.rows.filter((r) => r.type === 'cramps').length, 1);
  });

  it('C wellness allowlist only', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', {
          symptoms: ['bloating', 'gas', 'acne', 'dry_skin', 'fatigue'],
          observations: { energy: 'low' },
          sleepQuality: 'poor',
          stressLevel: 'high',
        }),
        log('2026-09-04', { symptoms: ['bloating', 'nausea'] }),
      ],
    });
    const keys = (out.symptoms?.rows || []).map((r) => r.key);
    assert.ok(keys.includes('bloating'));
    assert.ok(keys.includes('acne'));
    assert.ok(keys.includes('fatigue'));
    assert.ok(keys.includes('nausea'));
    assert.equal(keys.includes('gas'), false);
    assert.equal(keys.includes('dry_skin'), false);
    assert.ok(out.wellness.energy.some((r) => r.value === 'low'));
    assert.equal(out.wellness.energy.some((r) => Object.hasOwn(r, 'average')), false);
  });

  it('D fertility default excluded', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', {
          ovulationTest: 'positive',
          pregnancyTest: 'negative',
          bbt: 36.7,
          cervicalMucus: 'eggwhite',
        }),
        log('2026-09-05', { ovulationTest: 'positive', bbt: 36.8 }),
      ],
    });
    assert.equal(out.fertilityObservations, null);
    assert.equal(out.inclusions.fertility, false);
  });

  it('E fertility opt-in is raw facts only', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [log('2026-09-05', { ovulationTest: 'positive', bbt: 36.6, cervicalMucus: 'eggwhite' })],
      options: { includeFertility: true },
    });
    assert.equal(out.fertilityObservations.ovulationTests[0].result, 'positive');
    assert.equal(out.fertilityObservations.bbt[0].temperature, 36.6);
    assert.equal(JSON.stringify(out).includes('confirms ovulation'), false);
    assert.equal(JSON.stringify(out).includes('ovulation occurred'), false);
  });

  it('F sexual data default excluded', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', { sexualActivity: true, libido: 4, symptoms: ['pain_sex', 'unprotected'] }),
        log('2026-09-03', { sexualActivity: true, symptoms: ['pain_sex'] }),
      ],
    });
    assert.equal(out.privateObservations, null);
    assert.equal(JSON.stringify(out).includes('pain_sex'), false);
    assert.equal(JSON.stringify(out).includes('unprotected'), false);
  });

  it('G sexual opt-in is document-scoped and factual', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [log('2026-09-01', { sexualActivity: true, symptoms: ['pain_sex'] })],
      options: { includeSexual: true },
    });
    assert.ok(out.privateObservations.sexual.some((r) => r.key === 'pain_sex'));
    const off = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [log('2026-09-01', { sexualActivity: true, symptoms: ['pain_sex'] })],
    });
    assert.equal(off.privateObservations, null);
  });

  it('H notes excluded by default', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [log('2026-09-01', { notes: 'private journal' })],
    });
    assert.equal(out.privateObservations, null);
    assert.equal(JSON.stringify(out).includes('private journal'), false);
  });

  it('I unknown keys excluded', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', { symptoms: ['future_chip_xyz', 'bloating'] }),
        log('2026-09-04', { symptoms: ['future_chip_xyz'] }),
      ],
    });
    assert.equal((out.symptoms?.rows || []).some((r) => r.key === 'future_chip_xyz'), false);
  });

  it('J empty does not claim no symptoms', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [log('2026-09-01', { flow: 'none' })],
    });
    assert.equal(out.pain, null);
    assert.equal(out.symptoms, null);
    assert.equal(JSON.stringify(out).includes('No cramps'), false);
    assert.equal(JSON.stringify(out).includes('No symptoms'), false);
  });

  it('K historical edit recomputes', () => {
    const before = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', { symptoms: ['bloating'] }),
        log('2026-09-04', { symptoms: ['bloating'] }),
      ],
    });
    assert.equal(before.symptoms.rows[0].dayCount, 2);
    const after = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [log('2026-09-01', { symptoms: ['bloating'] }), log('2026-09-04', { symptoms: [] })],
    });
    assert.equal(after.symptoms.rows[0].dayCount, 1);
  });

  it('L date range excludes data outside the window', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-01-01', { symptoms: ['bloating'] }),
        log('2026-09-01', { symptoms: ['bloating'] }),
        log('2026-09-08', { symptoms: ['acne'] }),
      ],
      options: { from: '2026-09-01', to: '2026-09-09' },
    });
    assert.equal(out.symptoms.rows.find((r) => r.key === 'bloating').dayCount, 1);
    assert.ok(out.range.from >= '2026-09-01');
  });
});

describe('doctor summary fire-walls', () => {
  it('does not present predictions as facts and does not change the engine', () => {
    const logs = [...bleed('2026-08-01'), log('2026-08-20')];
    const pred = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 2,
      logs,
    });
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5 },
      logs,
    });
    assert.equal(Object.hasOwn(out, 'nextPeriodStart'), false);
    assert.equal(Object.hasOwn(out, 'ovulationDate'), false);
    assert.equal(out.disclaimer, 'history_not_diagnosis');
    const predAfter = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 2,
      logs,
    });
    assert.equal(pred.nextPeriodStart, predAfter.nextPeriodStart);
  });

  it('AI prompt and partner payload stay unchanged by doctor-summary opt-in', () => {
    const logs = [
      log('2026-09-01', {
        flow: 'medium',
        symptoms: ['bloating', 'unprotected'],
        notes: 'secret',
        ovulationTest: 'positive',
        observations: { energy: 'low' },
      }),
    ];
    const pred = { nextPeriodStart: '2026-09-29', ovulationDate: '2026-09-15', confidence: 'low' };
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-01' },
      logs,
      predictions: pred,
    });
    const withDoctor = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      options: { includeFertility: true, includeSexual: true, includeNotes: true },
    });
    const promptAfter = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-01' },
      logs,
      predictions: pred,
      doctorSummary: withDoctor,
    });
    assert.equal(prompt, promptAfter);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: '2026-08-01', avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs,
      predictions: pred,
    });
    assert.equal(Object.hasOwn(partner, 'fertilityObservations'), false);
    assert.equal(partnerPayloadHasLeak(partner), false);
  });

  it('personal export still includes user-owned fields the doctor summary omits', () => {
    const logs = [log('2026-09-01', { notes: 'keep me', sexualActivity: true, ovulationTest: 'positive' })];
    const personal = buildCycleExportPayload({
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      inferred: inferCycleStats(logs),
    });
    assert.equal(personal.logs[0].notes, 'keep me');
    assert.equal(personal.logs[0].ovulationTest, 'positive');
    const doctor = buildCycleDoctorSummaryData({ today: TODAY, profile: { mode: 'TRACK_PERIOD' }, logs });
    assert.equal(JSON.stringify(doctor).includes('keep me'), false);
  });

  it('predicted period ranges never appear as menstrual history', () => {
    const logs = bleed('2026-08-01', 3);
    const inferred = inferCycleStats(logs);
    inferred.periodRanges.push({
      start: '2026-09-10',
      end: '2026-09-14',
      lengthDays: 5,
      source: 'predicted',
    });
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      inferred,
    });
    assert.ok(!(out.menstrualHistory?.episodes || []).some((e) => e.start === '2026-09-10'));
  });

  it('headache and migraine stay distinct', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', { painEntries: [{ type: 'headache', severity: 'mild' }], symptoms: ['migraine'] }),
        log('2026-09-03', { symptoms: ['migraine'] }),
      ],
    });
    assert.ok(out.pain.aggregates.some((p) => p.type === 'headache'));
    assert.ok(out.symptoms.rows.some((r) => r.key === 'migraine'));
    assert.equal((out.pain.aggregates || []).some((p) => p.type === 'migraine'), false);
  });

  it('query window is bounded', () => {
    const logs = [];
    let d = addDays(TODAY, -400);
    for (let i = 0; i < 401; i += 1) {
      logs.push(log(d, { symptoms: i % 5 === 0 ? ['bloating'] : [] }));
      d = addDays(d, 1);
    }
    const out = buildCycleDoctorSummaryData({ today: TODAY, profile: { mode: 'TRACK_PERIOD' }, logs });
    assert.ok(out.range.queryDays <= DOCTOR_SUMMARY_QUERY_DAYS || out.range.queryDays <= 366);
    assert.ok(out.range.from >= addDays(TODAY, -365));
  });

  it('default payload does not leak sensitive fields', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [
        log('2026-09-01', {
          notes: 'private journal',
          sexualActivity: true,
          ovulationTest: 'positive',
          symptoms: ['bloating'],
        }),
      ],
    });
    assert.equal(doctorSummaryHasSensitiveLeak(out), false);
  });
});

describe('doctor summary pregnancy context', () => {
  const LMP = '2026-07-13';
  const episode = {
    id: 'ep-active',
    referenceDate: LMP,
    referenceType: 'LMP',
    status: PREGNANCY_EPISODE_ACTIVE,
  };
  const pregnancyLogs = [
    ...bleed('2026-06-17'),
    ...bleed('2026-07-13'),
    log(TODAY, { pregnancyTest: 'positive', ovulationTest: 'positive', bbt: 36.7, notes: 'private journal' }),
  ];

  function doctor(profileMode, extra = {}) {
    return buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: profileMode },
      logs: pregnancyLogs,
      pregnancyEpisode: extra.episode === undefined ? episode : extra.episode,
      options: extra.options,
    });
  }

  it('A TRACK has no pregnancy header', () => {
    const out = doctor('TRACK_PERIOD');
    assert.equal(out.pregnancyContext, null);
    assert.equal(out.inclusions.pregnancyContext, false);
  });

  it('B TTC has no pregnancy header', () => {
    const out = doctor('TRY_TO_CONCEIVE');
    assert.equal(out.pregnancyContext, null);
  });

  it('C Pregnancy valid active episode includes factual header only', () => {
    const dating = presentPregnancyDating({
      referenceDate: LMP,
      referenceType: 'LMP',
      today: TODAY,
    });
    const out = doctor('PREGNANCY');
    assert.equal(out.pregnancyContext.current, true);
    assert.equal(out.pregnancyContext.trackingMode, 'PREGNANCY');
    assert.equal(out.perimenopauseContext, null);
    assert.equal(out.inclusions.perimenopauseContext, false);
    assert.equal(out.pregnancyContext.referenceDate, LMP);
    assert.equal(out.pregnancyContext.referenceType, 'LMP');
    assert.equal(out.pregnancyContext.reviewRequired, false);
    assert.deepEqual(out.pregnancyContext.estimatedGestationalAge, {
      week: dating.estimatedGestationalAge.week,
      day: dating.estimatedGestationalAge.day,
    });
    assert.equal(out.pregnancyContext.estimatedDueDate.date, dating.estimatedDueDate.date);
    assert.equal(out.pregnancyContext.estimatedDueDate.estimated, true);
    assert.equal(out.inclusions.pregnancyContext, true);
    const text = JSON.stringify(out);
    assert.equal(text.includes('Confirmed pregnancy'), false);
    assert.equal(text.includes('Pregnant'), false);
    assert.equal(text.includes('viability'), false);
    assert.equal(text.includes('weekDevelopment'), false);
    assert.equal(text.includes('comparisonKey'), false);
    assert.equal(out.disclaimer, 'history_not_diagnosis');
    assert.ok(out.menstrualHistory?.episodes?.length);
  });

  it('D positive test in TRACK does not create the header', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: [log(TODAY, { pregnancyTest: 'positive' })],
    });
    assert.equal(out.pregnancyContext, null);
  });

  it('E positive test in TTC does not create the header', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs: [log(TODAY, { pregnancyTest: 'positive' })],
    });
    assert.equal(out.pregnancyContext, null);
  });

  it('F review-required omits stale week/day and due date', () => {
    const old = addDays(TODAY, -320);
    const out = doctor('PREGNANCY', {
      episode: {
        id: 'ep-old',
        referenceDate: old,
        referenceType: 'LMP',
        status: PREGNANCY_EPISODE_ACTIVE,
      },
    });
    assert.equal(out.pregnancyContext.reviewRequired, true);
    assert.equal(out.pregnancyContext.estimatedGestationalAge, null);
    assert.equal(out.pregnancyContext.estimatedDueDate, null);
    assert.equal(out.pregnancyContext.referenceDate, old);
    assert.equal(out.pregnancyContext.trackingMode, 'PREGNANCY');
  });

  it('G reference edit uses the new server dating values', () => {
    const nextDate = '2026-07-20';
    const dating = presentPregnancyDating({
      referenceDate: nextDate,
      referenceType: 'USER_SELECTED',
      today: TODAY,
    });
    const out = doctor('PREGNANCY', {
      episode: {
        id: 'ep-edit',
        referenceDate: nextDate,
        referenceType: 'USER_SELECTED',
        status: PREGNANCY_EPISODE_ACTIVE,
      },
    });
    assert.equal(out.pregnancyContext.referenceDate, nextDate);
    assert.equal(out.pregnancyContext.referenceType, 'USER_SELECTED');
    assert.equal(out.pregnancyContext.estimatedGestationalAge.week, dating.estimatedGestationalAge.week);
    assert.equal(out.pregnancyContext.estimatedDueDate.date, dating.estimatedDueDate.date);
  });

  it('H leaving Pregnancy mode omits the header', () => {
    const out = doctor('TRACK_PERIOD', { episode });
    assert.equal(out.pregnancyContext, null);
  });

  it('I fertility stays off by default in Pregnancy', () => {
    const out = doctor('PREGNANCY');
    assert.equal(out.fertilityObservations, null);
    assert.equal(out.inclusions.fertility, false);
    assert.equal(out.privateObservations, null);
  });

  it('J fertility opt-in is independent of the pregnancy header', () => {
    const out = doctor('PREGNANCY', { options: { includeFertility: true } });
    assert.ok(out.pregnancyContext);
    assert.ok(out.fertilityObservations.pregnancyTests.some((t) => t.result === 'positive'));
    assert.ok(out.fertilityObservations.ovulationTests.length);
  });

  it('K fruit/week-development keys stay out of the doctor payload', () => {
    const out = doctor('PREGNANCY');
    const text = JSON.stringify(out);
    assert.equal(text.includes('weekDevelopment'), false);
    assert.equal(text.includes('comparisonKey'), false);
    assert.equal(text.includes('lengthCm'), false);
    assert.equal(text.includes('weightGrams'), false);
    assert.equal(text.includes('developmentFactKeys'), false);
    assert.equal(text.includes('illustrationKey'), false);
    assert.equal(text.includes('raspberry'), false);
    assert.equal(text.includes('anatomy_scan'), false);
    assert.equal(text.includes('beyondStandardTerm'), false);
    assert.equal(text.includes('ms_heart'), false);
    assert.equal(doctorSummaryHasSensitiveLeak(out), false);
  });

  it('ended episode is not current context', () => {
    const out = doctor('PREGNANCY', {
      episode: { ...episode, status: PREGNANCY_EPISODE_ENDED },
    });
    assert.equal(out.pregnancyContext, null);
  });

  it('unknown reference type does not print a raw key and omits derived age', () => {
    const out = doctor('PREGNANCY', {
      episode: {
        id: 'ep-unknown',
        referenceDate: LMP,
        referenceType: 'ULTRASOUND_CONFIRMED',
        status: PREGNANCY_EPISODE_ACTIVE,
      },
    });
    assert.equal(out.pregnancyContext.referenceType, null);
    assert.equal(out.pregnancyContext.reviewRequired, true);
    assert.equal(out.pregnancyContext.estimatedGestationalAge, null);
    assert.equal(JSON.stringify(out).includes('ULTRASOUND_CONFIRMED'), false);
  });

  it('does not change Phase 18 dating or the forecast engine', () => {
    const ageBefore = gestationalAgeFromReference(LMP, TODAY);
    const dueBefore = estimatedDueDateFromReference(LMP);
    const logs = bleed('2026-07-13');
    const pred = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 2,
      logs,
    });
    doctor('PREGNANCY');
    const ageAfter = gestationalAgeFromReference(LMP, TODAY);
    const dueAfter = estimatedDueDateFromReference(LMP);
    assert.deepEqual(ageAfter, ageBefore);
    assert.equal(dueAfter, dueBefore);
    const predAfter = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 2,
      logs,
    });
    assert.equal(pred.nextPeriodStart, predAfter.nextPeriodStart);
  });

  it('does not add pregnancy context to AI or partner', () => {
    const out = doctor('PREGNANCY');
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP },
      logs: pregnancyLogs,
      predictions: { nextPeriodStart: '2026-10-01' },
      doctorSummary: out,
    });
    assert.equal(prompt.includes('pregnancyContext'), false);
    assert.equal(prompt.includes(out.pregnancyContext.estimatedDueDate.date), false);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP },
      logs: pregnancyLogs,
      predictions: predBleed(),
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    assert.equal(JSON.stringify(partner).includes('pregnancyContext'), false);
  });
});

function predBleed() {
  return buildPredictions({
    lastPeriodStart: '2026-07-13',
    avgCycleLength: 28,
    avgPeriodLength: 5,
    cycleCount: 2,
    logs: bleed('2026-07-13'),
  });
}

function periIntervalLogs(today = TODAY) {
  const s4 = addDays(today, -10);
  const s3 = addDays(s4, -29);
  const s2 = addDays(s3, -46);
  const s1 = addDays(s2, -31);
  const s0 = addDays(s1, -24);
  return [
    ...bleed(s0, 4),
    ...bleed(s1, 3),
    ...bleed(s2, 5, { flow: 'heavy' }),
    ...bleed(s3, 4),
    ...bleed(s4, 3),
    log(today, { symptoms: ['hot_flashes', 'night_sweats', 'vaginal_dryness'], notes: 'private journal' }),
  ];
}

describe('Phase 25 perimenopause tracking context', () => {
  it('A TRACK has no perimenopause context', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs: periIntervalLogs(),
    });
    assert.equal(out.perimenopauseContext, null);
    assert.equal(out.inclusions.perimenopauseContext, false);
  });

  it('B TTC has no perimenopause context', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs: periIntervalLogs(),
    });
    assert.equal(out.perimenopauseContext, null);
  });

  it('C Pregnancy keeps Phase 20 header and has no peri context', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: periIntervalLogs(),
      pregnancyEpisode: {
        id: 'ep-1',
        referenceDate: '2026-07-13',
        referenceType: 'LMP',
        status: PREGNANCY_EPISODE_ACTIVE,
      },
    });
    assert.ok(out.pregnancyContext);
    assert.equal(out.perimenopauseContext, null);
  });

  it('D PERIMENOPAUSE includes user-selected current context, not a diagnosis', () => {
    const logs = periIntervalLogs();
    const inferred = inferCycleStats(logs);
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred,
    });
    assert.equal(out.perimenopauseContext.current, true);
    assert.equal(out.perimenopauseContext.trackingMode, 'PERIMENOPAUSE');
    assert.equal(out.perimenopauseContext.userSelected, true);
    assert.equal(out.pregnancyContext, null);
    assert.equal(out.postpartumContext, null);
    const blob = JSON.stringify(out);
    assert.equal(/patient is perimenopausal/i.test(blob), false);
    assert.equal(/confirmed menopause/i.test(blob), false);
    assert.equal(/diagnosed perimenopause/i.test(blob), false);
    assert.equal(blob.includes('nextPeriodStart'), false);
    assert.equal(blob.includes('fertileWindow'), false);
    assert.equal(blob.includes('lateStatus'), false);
    assert.equal(out.perimenopauseContext.forecast, undefined);
    assert.equal(doctorSummaryHasSensitiveLeak(out), false);
  });

  it('E symptoms without the mode do not create the header', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', birthDate: '1952-01-01' },
      logs: [
        ...periIntervalLogs(),
        log(TODAY, { symptoms: ['hot_flashes', 'night_sweats', 'vaginal_dryness'] }),
      ],
    });
    assert.equal(out.perimenopauseContext, null);
  });

  it('F age alone does not create the header', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', birthDate: '1948-03-12' },
      logs: [log(TODAY, { symptoms: ['hot_flashes'] })],
    });
    assert.equal(out.perimenopauseContext, null);
  });

  it('G variable cycles without the mode do not create the header', () => {
    const logs = periIntervalLogs();
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      inferred: inferCycleStats(logs),
    });
    assert.equal(out.perimenopauseContext, null);
  });

  it('H leaving Perimenopause omits the header', () => {
    const logs = periIntervalLogs();
    const inferred = inferCycleStats(logs);
    const peri = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred,
    });
    assert.ok(peri.perimenopauseContext);
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      inferred,
    });
    assert.equal(out.perimenopauseContext, null);
  });

  it('I old report range still labels current context only', () => {
    const logs = periIntervalLogs();
    const inferred = inferCycleStats(logs);
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred,
      options: { from: '2025-01-01', to: '2025-06-01' },
    });
    assert.equal(out.perimenopauseContext.current, true);
    assert.equal(out.perimenopauseContext.userSelected, true);
    assert.equal(out.range.from, '2025-01-01');
    assert.equal(JSON.stringify(out.perimenopauseContext).includes('last year'), false);
  });

  it('J variability is 24–46 over 4 intervals with no irregular label', () => {
    const logs = periIntervalLogs();
    const inferred = inferCycleStats(logs);
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred,
    });
    assert.equal(out.perimenopauseContext.variability.intervalCount, 4);
    assert.equal(out.perimenopauseContext.variability.shortestDays, 24);
    assert.equal(out.perimenopauseContext.variability.longestDays, 46);
    assert.equal(out.perimenopauseContext.variability.sourceWindow, 'last_6_completed_intervals');
    const blob = JSON.stringify(out.perimenopauseContext);
    assert.equal(blob.includes('irregular'), false);
    assert.equal(blob.includes('worsening'), false);
    assert.equal(blob.includes('score'), false);
  });

  it('K one interval omits the variability range', () => {
    const start = addDays(TODAY, -40);
    const logs = [...bleed(start, 4), ...bleed(TODAY, 3)];
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred: inferCycleStats(logs),
    });
    assert.equal(out.perimenopauseContext.current, true);
    assert.equal(out.perimenopauseContext.variability, null);
  });

  it('L private fields stay excluded by default', () => {
    const logs = periIntervalLogs();
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred: inferCycleStats(logs),
    });
    assert.equal(out.privateObservations, null);
    assert.equal(out.inclusions.sexual, false);
    assert.equal(out.inclusions.notes, false);
    assert.equal(out.inclusions.fertility, false);
    const header = JSON.stringify(out.perimenopauseContext);
    assert.equal(header.includes('vaginal_dryness'), false);
    assert.equal(header.includes('private journal'), false);
  });

  it('does not add perimenopause context to AI or partner', () => {
    const logs = periIntervalLogs();
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred: inferCycleStats(logs),
    });
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE', lastPeriodStart: '2026-08-30' },
      logs,
      predictions: { nextPeriodStart: '2026-10-01' },
      doctorSummary: out,
    });
    assert.equal(prompt.includes('perimenopauseContext'), false);
    assert.equal(prompt.includes('PERIMENOPAUSE'), false);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'PERIMENOPAUSE', lastPeriodStart: '2026-08-30' },
      logs,
      predictions: predBleed(),
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    assert.equal(JSON.stringify(partner).includes('perimenopauseContext'), false);
    assert.equal(JSON.stringify(partner).includes('PERIMENOPAUSE'), false);
  });
});

describe('doctor summary postpartum context', () => {
  const TODAY_PP = '2026-09-11';
  const REF = '2026-08-19';
  const STARTED = '2026-07-01';
  const PREGNANCY_ENDED = '2026-08-01';
  const activeEpisode = {
    id: 'pp-active',
    referenceDate: REF,
    status: POSTPARTUM_EPISODE_ACTIVE,
    startedAt: STARTED,
    endedAt: null,
  };

  function doctor(mode, extra = {}) {
    return buildCycleDoctorSummaryData({
      today: TODAY_PP,
      profile: { mode },
      logs: extra.logs || [log(TODAY_PP, { flow: 'heavy' })],
      pregnancyEpisode: extra.pregnancyEpisode ?? null,
      postpartumEpisode: extra.episode === undefined ? activeEpisode : extra.episode,
      options: extra.options,
    });
  }

  it('A POSTPARTUM active + reference: current, mode, exact date, canonical elapsed', () => {
    const expected = postpartumElapsed(REF, TODAY_PP);
    const out = doctor('POSTPARTUM');
    assert.equal(out.postpartumContext.current, true);
    assert.equal(out.postpartumContext.trackingMode, 'POSTPARTUM');
    assert.equal(out.postpartumContext.referenceDate, REF);
    assert.deepEqual(out.postpartumContext.elapsed, { week: expected.week, day: expected.day });
    assert.equal(out.postpartumContext.elapsed.week, 3);
    assert.equal(out.postpartumContext.elapsed.day, 2);
    assert.equal(Object.hasOwn(out.postpartumContext.elapsed, 'days'), false);
    assert.equal(out.inclusions.postpartumContext, true);
    assert.equal(out.pregnancyContext, null);
    assert.equal(out.perimenopauseContext, null);
    assert.equal(out.postpartumContext.id, undefined);
    assert.equal(out.postpartumContext.startedAt, undefined);
    assert.equal(out.postpartumContext.endedAt, undefined);
    assert.equal(out.postpartumContext.trackingContext, undefined);
    assert.equal(doctorSummaryHasSensitiveLeak(out), false);
  });

  it('B POSTPARTUM active no reference: context present, reference and elapsed null', () => {
    const out = doctor('POSTPARTUM', {
      episode: {
        id: 'pp-none',
        referenceDate: null,
        status: POSTPARTUM_EPISODE_ACTIVE,
        startedAt: STARTED,
        endedAt: null,
      },
    });
    assert.equal(out.postpartumContext.current, true);
    assert.equal(out.postpartumContext.trackingMode, 'POSTPARTUM');
    assert.equal(out.postpartumContext.referenceDate, null);
    assert.equal(out.postpartumContext.elapsed, null);
    assert.equal(out.postpartumContext.referenceDate === STARTED, false);
  });

  it('C TRACK has no postpartum context', () => {
    const out = doctor('TRACK_PERIOD');
    assert.equal(out.postpartumContext, null);
    assert.equal(out.inclusions.postpartumContext, false);
  });

  it('D TTC has no postpartum context', () => {
    const out = doctor('TRY_TO_CONCEIVE');
    assert.equal(out.postpartumContext, null);
  });

  it('E Pregnancy has no postpartum context; pregnancy context unchanged', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: bleed('2026-07-13'),
      pregnancyEpisode: {
        id: 'ep-active',
        referenceDate: '2026-07-13',
        referenceType: 'LMP',
        status: PREGNANCY_EPISODE_ACTIVE,
      },
      postpartumEpisode: activeEpisode,
    });
    assert.ok(out.pregnancyContext);
    assert.equal(out.pregnancyContext.trackingMode, 'PREGNANCY');
    assert.equal(out.pregnancyContext.referenceDate, '2026-07-13');
    assert.equal(out.postpartumContext, null);
    assert.equal(out.perimenopauseContext, null);
  });

  it('F Perimenopause has no postpartum context; peri context unchanged', () => {
    const logs = periIntervalLogs(TODAY);
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred: inferCycleStats(logs),
      postpartumEpisode: activeEpisode,
    });
    assert.ok(out.perimenopauseContext);
    assert.equal(out.perimenopauseContext.trackingMode, 'PERIMENOPAUSE');
    assert.equal(out.postpartumContext, null);
    assert.equal(out.pregnancyContext, null);
  });

  it('G ended postpartum + TRACK is not current context', () => {
    const out = doctor('TRACK_PERIOD', {
      episode: {
        id: 'pp-old',
        referenceDate: REF,
        status: POSTPARTUM_EPISODE_ENDED,
        startedAt: STARTED,
        endedAt: '2026-09-01',
      },
    });
    assert.equal(out.postpartumContext, null);
  });

  it('H re-entry uses the new active episode reference only', () => {
    const refB = '2026-09-01';
    const out = doctor('POSTPARTUM', {
      episode: {
        id: 'pp-new',
        referenceDate: refB,
        status: POSTPARTUM_EPISODE_ACTIVE,
        startedAt: TODAY_PP,
        endedAt: null,
      },
    });
    assert.equal(out.postpartumContext.referenceDate, refB);
    assert.equal(out.postpartumContext.referenceDate === REF, false);
    const expected = postpartumElapsed(refB, TODAY_PP);
    assert.deepEqual(out.postpartumContext.elapsed, { week: expected.week, day: expected.day });
  });

  it('I no pregnancy-outcome fields added by Phase 39', () => {
    const out = doctor('POSTPARTUM');
    const text = JSON.stringify(out);
    for (const key of [
      'liveBirth',
      'birthDate',
      'deliveryDate',
      'deliveryType',
      'vaginalBirth',
      'cSection',
      'miscarriage',
      'stillbirth',
      'abortion',
      'ectopic',
      'neonatalOutcome',
      'infantStatus',
      'plannedPlace',
      'plannedTime',
      'reminderMode',
      'carePlannerSummary',
    ]) {
      assert.equal(text.includes(`"${key}"`), false, key);
    }
    assert.equal(/live birth/i.test(text), false);
    assert.equal(/lochia/i.test(text), false);
    assert.equal(/recovery/i.test(text), false);
  });

  it('J pregnancy endedAt is not reused as postpartum reference', () => {
    const out = doctor('POSTPARTUM', {
      episode: {
        id: 'pp-none',
        referenceDate: null,
        status: POSTPARTUM_EPISODE_ACTIVE,
        startedAt: STARTED,
        endedAt: null,
      },
      pregnancyEpisode: {
        id: 'ep-ended',
        referenceDate: '2026-01-01',
        referenceType: 'LMP',
        status: PREGNANCY_EPISODE_ENDED,
        endedAt: PREGNANCY_ENDED,
      },
    });
    assert.equal(out.postpartumContext.referenceDate, null);
    assert.equal(out.postpartumContext.elapsed, null);
    assert.equal(JSON.stringify(out.postpartumContext).includes(PREGNANCY_ENDED), false);
  });

  it('K postpartum startedAt is not rendered as reference when reference is null', () => {
    const out = doctor('POSTPARTUM', {
      episode: {
        id: 'pp-none',
        referenceDate: null,
        status: POSTPARTUM_EPISODE_ACTIVE,
        startedAt: STARTED,
        endedAt: null,
      },
    });
    assert.equal(out.postpartumContext.referenceDate, null);
    assert.equal(JSON.stringify(out.postpartumContext).includes(STARTED), false);
  });

  it('P Pregnancy payload regression: shape unchanged', () => {
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: bleed('2026-07-13'),
      pregnancyEpisode: {
        id: 'ep-active',
        referenceDate: '2026-07-13',
        referenceType: 'LMP',
        status: PREGNANCY_EPISODE_ACTIVE,
      },
    });
    assert.equal(out.pregnancyContext.current, true);
    assert.equal(out.pregnancyContext.trackingMode, 'PREGNANCY');
    assert.equal(out.pregnancyContext.referenceType, 'LMP');
    assert.ok(out.pregnancyContext.estimatedGestationalAge);
    assert.ok(out.pregnancyContext.estimatedDueDate);
    assert.equal(out.postpartumContext, null);
  });

  it('Q Perimenopause payload regression: shape unchanged', () => {
    const logs = periIntervalLogs(TODAY);
    const out = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred: inferCycleStats(logs),
    });
    assert.equal(out.perimenopauseContext.current, true);
    assert.equal(out.perimenopauseContext.userSelected, true);
    assert.ok(out.perimenopauseContext.variability);
    assert.equal(out.postpartumContext, null);
  });

  it('R prenatal planner keys stay out of postpartum context', () => {
    const blob = JSON.stringify(doctor('POSTPARTUM').postpartumContext);
    assert.equal(blob.includes('plannedPlace'), false);
    assert.equal(blob.includes('plannedTime'), false);
    assert.equal(blob.includes('reminderMode'), false);
    assert.equal(blob.includes('calendarEventId'), false);
  });

  it('S Phase 38 AI fail-closed is unchanged', () => {
    assert.equal(profileModeForAiPrompt('POSTPARTUM'), null);
    const prompt = buildCycleAiUserPrompt({
      today: TODAY_PP,
      profile: { mode: 'POSTPARTUM', lastPeriodStart: '2026-07-01' },
      logs: [log(TODAY_PP, { flow: 'heavy', trackingContext: 'POSTPARTUM' })],
      predictions: { nextPeriodStart: '2026-10-01' },
      doctorSummary: doctor('POSTPARTUM'),
    });
    assert.equal(prompt, '');
    assert.equal(prompt.includes('postpartumContext'), false);
    assert.equal(prompt.includes(REF), false);
  });

  it('T partner payload still omits postpartumContext', () => {
    const partner = buildPartnerPayload({
      today: TODAY_PP,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'POSTPARTUM', lastPeriodStart: '2026-07-01' },
      logs: [log(TODAY_PP, { flow: 'heavy' })],
      predictions: predBleed(),
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    const text = JSON.stringify(partner);
    assert.equal(text.includes('postpartumContext'), false);
    assert.equal(text.includes('POSTPARTUM'), false);
  });

  it('U personal export is not the doctor summary', () => {
    const personal = buildCycleExportPayload({
      profile: { mode: 'POSTPARTUM' },
      logs: [log(TODAY_PP, { flow: 'heavy', trackingContext: 'POSTPARTUM' })],
      postpartumEpisodes: [activeEpisode],
    });
    assert.equal(Object.hasOwn(personal, 'postpartumContext'), false);
    assert.ok(personal.postpartumEpisodes || personal.logs);
  });

  it('W POSTPARTUM without an active episode fails closed', () => {
    const out = doctor('POSTPARTUM', { episode: null });
    assert.equal(out.postpartumContext, null);
  });

  it('X null reference does not invent zero elapsed', () => {
    const out = doctor('POSTPARTUM', {
      episode: {
        id: 'pp-none',
        referenceDate: null,
        status: POSTPARTUM_EPISODE_ACTIVE,
        startedAt: STARTED,
        endedAt: null,
      },
    });
    assert.equal(out.postpartumContext.elapsed, null);
    assert.equal(JSON.stringify(out.postpartumContext).includes('"week":0'), false);
  });

  it('Z exactly one special current-mode context', () => {
    assert.equal(doctor('TRACK_PERIOD').postpartumContext, null);
    assert.equal(doctor('TRACK_PERIOD').pregnancyContext, null);
    assert.equal(doctor('TRACK_PERIOD').perimenopauseContext, null);
    const pp = doctor('POSTPARTUM');
    assert.ok(pp.postpartumContext);
    assert.equal(pp.pregnancyContext, null);
    assert.equal(pp.perimenopauseContext, null);
  });
});

