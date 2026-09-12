import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateObservationExposure,
  applyAssessmentState,
  applySymptomChipToggle,
  ASSESSMENT_ELIGIBLE_KEYS,
  ASSESSMENT_STATES,
  PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS,
  PREGNANCY_DAILY_ASSESSMENT_KEYS,
  resolveObservationAssessment,
} from './cycleObservationAssessment.js';

describe('mobile assessment editor helpers', () => {
  it('restores three states from symptoms + absence map', () => {
    const log = {
      symptoms: ['nausea'],
      observationAssessments: { vomiting: 'ABSENT' },
    };
    assert.equal(resolveObservationAssessment(log, 'nausea').state, 'PRESENT');
    assert.equal(resolveObservationAssessment(log, 'vomiting').state, 'ABSENT');
    assert.equal(resolveObservationAssessment(log, 'fatigue').state, 'UNKNOWN');
  });

  it('clear and chip-off return UNKNOWN, never silent ABSENT', () => {
    const absent = applyAssessmentState(
      { symptoms: [], observationAssessments: { fatigue: 'ABSENT' } },
      'fatigue',
      ASSESSMENT_STATES.UNKNOWN,
    );
    assert.equal(resolveObservationAssessment(absent, 'fatigue').state, 'UNKNOWN');
    const clearedChip = applySymptomChipToggle(
      { symptoms: ['hot_flashes'], observationAssessments: {} },
      'hot_flashes',
    );
    assert.equal(resolveObservationAssessment(clearedChip, 'hot_flashes').state, 'UNKNOWN');
  });

  it('keeps pregnancy and peri shortlists small and inside the eligible set', () => {
    assert.equal(PREGNANCY_DAILY_ASSESSMENT_KEYS.length <= 4, true);
    assert.equal(PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS.length <= 4, true);
    for (const key of [...PREGNANCY_DAILY_ASSESSMENT_KEYS, ...PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS]) {
      assert.equal(ASSESSMENT_ELIGIBLE_KEYS.includes(key), true);
    }
  });

  it('aggregates field-specific exposure without a generic day denominator', () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const logs = [
      ...dates.slice(0, 4).map((date) => ({ date, symptoms: ['hot_flashes'], observationAssessments: {} })),
      ...dates.slice(4, 10).map((date) => ({
        date,
        symptoms: [],
        observationAssessments: { hot_flashes: 'ABSENT' },
      })),
    ];
    const agg = aggregateObservationExposure(logs, 'hot_flashes', { dates });
    assert.equal(agg.presentDays, 4);
    assert.equal(agg.absentDays, 6);
    assert.equal(agg.assessedDays, 10);
    assert.equal(agg.unknownDays, 20);
  });
});
