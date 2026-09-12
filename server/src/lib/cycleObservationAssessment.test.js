import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateObservationExposure,
  applyAssessmentState,
  applyAssessmentWrite,
  applySymptomChipToggle,
  ASSESSMENT_STATES,
  explicitAbsentKeys,
  parseObservationAssessments,
  PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS,
  PREGNANCY_DAILY_ASSESSMENT_KEYS,
  resolveDailyAssessments,
  resolveObservationAssessment,
} from './cycleObservationAssessment.js';
import { getObservationDef, isAssessmentEligible } from './cycleObservationRegistry.js';
import { parseObservationWrite } from './cycleObservations.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { serializeCycleLogForAi } from './cycleAiContext.js';
import { addDays } from './cycle.js';

describe('assessment registry metadata', () => {
  it('defaults assessmentEligible false', () => {
    assert.equal(getObservationDef('heartburn').assessmentEligible, false);
    assert.equal(getObservationDef('swelling').assessmentEligible, false);
    assert.equal(getObservationDef('migraine').assessmentEligible, false);
    assert.equal(getObservationDef('energy').assessmentEligible, false);
    assert.equal(getObservationDef('sleepQuality').assessmentEligible, false);
    assert.equal(getObservationDef('notes').assessmentEligible, false);
    assert.equal(getObservationDef('bbt').assessmentEligible, false);
    assert.equal(getObservationDef('ovulationTest').assessmentEligible, false);
    assert.equal(getObservationDef('pregnancyTest').assessmentEligible, false);
    assert.equal(getObservationDef('cervicalMucus').assessmentEligible, false);
    assert.equal(isAssessmentEligible('pain_sex'), false);
  });

  it('enables only the conservative V1 sets', () => {
    for (const key of PREGNANCY_DAILY_ASSESSMENT_KEYS) {
      assert.equal(isAssessmentEligible(key), true, key);
    }
    for (const key of PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS) {
      assert.equal(isAssessmentEligible(key), true, key);
    }
  });
});

describe('three-state resolver fixtures', () => {
  it('A — pregnancy empty is all UNKNOWN', () => {
    const log = { symptoms: [], observationAssessments: {} };
    assert.equal(resolveObservationAssessment(log, 'nausea').state, 'UNKNOWN');
    assert.equal(resolveObservationAssessment(log, 'vomiting').state, 'UNKNOWN');
    assert.equal(resolveObservationAssessment(log, 'fatigue').state, 'UNKNOWN');
  });

  it('B — nausea PRESENT, vomiting ABSENT, fatigue UNKNOWN', () => {
    const log = {
      symptoms: ['nausea'],
      observationAssessments: { vomiting: 'ABSENT' },
    };
    assert.equal(resolveObservationAssessment(log, 'nausea').state, 'PRESENT');
    assert.equal(resolveObservationAssessment(log, 'vomiting').state, 'ABSENT');
    assert.equal(resolveObservationAssessment(log, 'fatigue').state, 'UNKNOWN');
  });

  it('C — peri hot flashes PRESENT, night sweats ABSENT, fatigue UNKNOWN', () => {
    const log = {
      symptoms: ['hot_flashes'],
      observationAssessments: { night_sweats: 'ABSENT' },
    };
    assert.equal(resolveObservationAssessment(log, 'hot_flashes').state, 'PRESENT');
    assert.equal(resolveObservationAssessment(log, 'night_sweats').state, 'ABSENT');
    assert.equal(resolveObservationAssessment(log, 'fatigue').state, 'UNKNOWN');
  });

  it('D — historical positive is PRESENT', () => {
    const log = { symptoms: ['hot_flashes'] };
    const resolved = resolveObservationAssessment(log, 'hot_flashes');
    assert.equal(resolved.state, 'PRESENT');
    assert.equal(resolved.source, 'positive_log');
  });

  it('E — historical missing is UNKNOWN', () => {
    const log = { symptoms: ['bloating'] };
    const resolved = resolveObservationAssessment(log, 'hot_flashes');
    assert.equal(resolved.state, 'UNKNOWN');
    assert.equal(resolved.source, 'legacy_unknown');
  });

  it('F — historical boolean false remains UNKNOWN', () => {
    const log = { symptoms: [], observations: { hot_flashes: false } };
    const resolved = resolveObservationAssessment(log, 'hot_flashes');
    assert.equal(resolved.state, 'UNKNOWN');
    assert.equal(resolved.source, 'legacy_false');
  });

  it('G — explicit absent', () => {
    const log = { symptoms: [], observationAssessments: { nausea: 'ABSENT' } };
    assert.equal(resolveObservationAssessment(log, 'nausea').state, 'ABSENT');
    assert.equal(resolveObservationAssessment(log, 'nausea').source, 'explicit_assessment');
  });

  it('H — clear ABSENT → UNKNOWN', () => {
    const form = { symptoms: [], observationAssessments: { nausea: 'ABSENT' } };
    const next = applyAssessmentState(form, 'nausea', ASSESSMENT_STATES.UNKNOWN);
    assert.equal(resolveObservationAssessment(next, 'nausea').state, 'UNKNOWN');
    assert.equal(Object.hasOwn(next.observationAssessments, 'nausea'), false);
  });

  it('I — PRESENT to ABSENT removes the positive log atomically', () => {
    const form = { symptoms: ['nausea', 'bloating'], observationAssessments: {} };
    const next = applyAssessmentState(form, 'nausea', ASSESSMENT_STATES.ABSENT);
    assert.deepEqual(next.symptoms, ['bloating']);
    assert.equal(next.observationAssessments.nausea, 'ABSENT');
    assert.equal(resolveObservationAssessment(next, 'nausea').state, 'ABSENT');
  });

  it('J — ABSENT to PRESENT', () => {
    const form = { symptoms: [], observationAssessments: { nausea: 'ABSENT' } };
    const next = applyAssessmentState(form, 'nausea', ASSESSMENT_STATES.PRESENT);
    assert.deepEqual(next.symptoms, ['nausea']);
    assert.equal(Object.hasOwn(next.observationAssessments, 'nausea'), false);
    assert.equal(resolveObservationAssessment(next, 'nausea').state, 'PRESENT');
  });

  it('K — conflict: positive + absent metadata → PRESENT', () => {
    const log = {
      symptoms: ['hot_flashes'],
      observationAssessments: { hot_flashes: 'ABSENT' },
    };
    const resolved = resolveObservationAssessment(log, 'hot_flashes');
    assert.equal(resolved.state, 'PRESENT');
    assert.equal(resolved.conflict, true);
  });

  it('L — field-specific: hot flash assessed does not cover night sweats', () => {
    const log = {
      symptoms: [],
      observationAssessments: { hot_flashes: 'ABSENT' },
    };
    assert.equal(resolveObservationAssessment(log, 'hot_flashes').state, 'ABSENT');
    assert.equal(resolveObservationAssessment(log, 'night_sweats').state, 'UNKNOWN');
  });

  it('N — TRACK historical positive remains PRESENT after mode switch', () => {
    const log = { symptoms: ['hot_flashes'], observationAssessments: {} };
    assert.equal(resolveObservationAssessment(log, 'hot_flashes').state, 'PRESENT');
  });
});

describe('writes stay atomic on the CycleLog path', () => {
  it('rejects unknown and ineligible assessment keys', () => {
    assert.throws(() => parseObservationAssessments({ mystery: 'ABSENT' }, { strict: true }));
    assert.throws(() => parseObservationAssessments({ heartburn: 'ABSENT' }, { strict: true }));
    assert.throws(() => parseObservationAssessments({ nausea: 'PRESENT' }, { strict: true }));
  });

  it('strips ABSENT when the same write contains a positive symptom', () => {
    const written = parseObservationWrite({
      symptoms: ['nausea'],
      observationAssessments: { nausea: 'ABSENT', vomiting: 'ABSENT' },
    });
    assert.deepEqual(written.symptoms, ['nausea']);
    assert.equal(Object.hasOwn(written.observationAssessments, 'nausea'), false);
    assert.equal(written.observationAssessments.vomiting, 'ABSENT');
  });

  it('symptoms-only writes do not invent ABSENT when a chip is cleared', () => {
    const existing = { symptoms: ['nausea'], observationAssessments: {} };
    const written = parseObservationWrite({ symptoms: [] }, existing);
    assert.deepEqual(written.symptoms, []);
    assert.deepEqual(written.observationAssessments, {});
    assert.equal(resolveObservationAssessment({ ...existing, ...written }, 'nausea').state, 'UNKNOWN');
  });

  it('chip toggle never writes ABSENT', () => {
    const form = { symptoms: ['nausea'], observationAssessments: {} };
    const next = applySymptomChipToggle(form, 'nausea');
    assert.deepEqual(next.symptoms, []);
    assert.deepEqual(next.observationAssessments, {});
  });

  it('omitted assessment field keeps existing absences except conflicts', () => {
    const existing = {
      symptoms: [],
      observationAssessments: { night_sweats: 'ABSENT' },
    };
    const written = applyAssessmentWrite({ symptoms: ['hot_flashes'] }, existing, {
      symptoms: ['hot_flashes'],
    });
    assert.equal(written.observationAssessments.night_sweats, 'ABSENT');
  });
});

describe('internal exposure aggregation', () => {
  it('30-day fixture: 4 present, 6 absent, 20 unknown → assessedDays 10', () => {
    const start = '2026-08-01';
    const dates = [];
    const logs = [];
    for (let i = 0; i < 30; i += 1) {
      const date = addDays(start, i);
      dates.push(date);
      if (i < 4) logs.push({ date, symptoms: ['hot_flashes'], observationAssessments: {} });
      else if (i < 10) {
        logs.push({ date, symptoms: [], observationAssessments: { hot_flashes: 'ABSENT' } });
      }
    }
    const agg = aggregateObservationExposure(logs, 'hot_flashes', { dates });
    assert.equal(agg.presentDays, 4);
    assert.equal(agg.absentDays, 6);
    assert.equal(agg.assessedDays, 10);
    assert.equal(agg.unknownDays, 20);
  });

  it('does not share a generic day denominator across keys', () => {
    const logs = [
      { date: '2026-08-01', symptoms: ['hot_flashes'], observationAssessments: { night_sweats: 'ABSENT' } },
      { date: '2026-08-02', symptoms: ['hot_flashes'], observationAssessments: {} },
    ];
    const hot = aggregateObservationExposure(logs, 'hot_flashes', {
      dates: ['2026-08-01', '2026-08-02', '2026-08-03'],
    });
    const night = aggregateObservationExposure(logs, 'night_sweats', {
      dates: ['2026-08-01', '2026-08-02', '2026-08-03'],
    });
    assert.equal(hot.assessedDays, 2);
    assert.equal(night.assessedDays, 1);
    assert.equal(night.unknownDays, 2);
  });
});

describe('privacy firewalls', () => {
  it('partner payload does not include assessments', () => {
    const payload = buildPartnerPayload({
      today: '2026-08-14',
      permissions: { period: true, cyclePhase: true, fertileWindow: false, symptoms: true },
      profile: { lastPeriodStart: '2026-08-01', avgCycleLength: 28, avgPeriodLength: 5, mode: 'PERIMENOPAUSE' },
      logs: [
        {
          date: '2026-08-14',
          flow: 'none',
          symptoms: ['hot_flashes'],
          observationAssessments: { night_sweats: 'ABSENT' },
          dailyAssessments: { hot_flashes: 'PRESENT', night_sweats: 'ABSENT' },
        },
      ],
    });
    assert.equal(partnerPayloadHasLeak(payload), false);
    const text = JSON.stringify(payload);
    assert.equal(text.includes('observationAssessments'), false);
    assert.equal(text.includes('dailyAssessments'), false);
    assert.equal(text.includes('ABSENT'), false);
  });

  it('AI serializer does not include assessment coverage', () => {
    const { line } = serializeCycleLogForAi({
      date: '2026-08-14',
      flow: 'none',
      symptoms: ['hot_flashes'],
      observationAssessments: { night_sweats: 'ABSENT' },
      dailyAssessments: { hot_flashes: 'PRESENT' },
    });
    assert.equal(line.includes('ABSENT'), false);
    assert.equal(line.includes('observationAssessments'), false);
  });

  it('personal export includes owner assessment data', () => {
    const payload = buildCycleExportPayload({
      profile: { mode: 'PERIMENOPAUSE' },
      logs: [
        {
          date: '2026-08-10',
          symptoms: ['hot_flashes'],
          observationAssessments: { night_sweats: 'ABSENT' },
        },
      ],
    });
    assert.equal(payload.logs[0].observationAssessments.night_sweats, 'ABSENT');
  });

  it('explicit absent keys skip the logged-symptom list', () => {
    const log = { symptoms: ['bloating'], observationAssessments: { nausea: 'ABSENT' } };
    assert.deepEqual(explicitAbsentKeys(log), ['nausea']);
    assert.equal(resolveDailyAssessments(log).nausea, 'ABSENT');
    assert.equal(Object.hasOwn(resolveDailyAssessments(log), 'fatigue'), false);
  });
});
