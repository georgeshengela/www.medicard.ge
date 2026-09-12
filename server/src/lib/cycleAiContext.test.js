import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_FIELD_CATEGORIES,
  classifyCycleSymptomKey,
  inspectCycleAiCategories,
  partnerSafeSymptomKeys,
  serializeCycleLogForAi,
} from './cycleAiContext.js';
import { buildCycleAiUserPrompt, buildCycleWellnessContext, buildDoctorSummary } from './cycle.js';

const profile = {
  mode: 'TRACK_PERIOD',
  lastPeriodStart: '2025-03-01',
  avgCycleLength: 28,
  avgPeriodLength: 5,
  isIrregular: false,
  conditions: [],
};

function promptFor(logs) {
  return buildCycleAiUserPrompt({
    profile,
    logs,
    predictions: {
      confidence: 'low',
      nextPeriodStart: '2025-03-29',
      ovulationDate: '2025-03-15',
      fertileWindow: { start: '2025-03-10', end: '2025-03-16' },
    },
    pregnancy: null,
    user: { age: 30 },
    averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
    today: '2025-03-02',
  });
}

describe('cycle AI allowlist', () => {
  it('keeps cramps, headache, mood, and flow; drops sex chips, notes, and unknown keys', () => {
    const log = {
      date: '2025-03-02',
      flow: 'medium',
      symptoms: ['cramps', 'headache', 'unprotected', 'protected', 'sex', 'pain_sex', 'future_chip_xyz'],
      moods: ['anxious'],
      notes: 'secret journal',
      sexualActivity: true,
      libido: 4,
      customTagIds: ['tag_secret'],
      futureSecret: 'should-not-leak',
    };
    const { line, included, excluded } = serializeCycleLogForAi(log);
    assert.match(line, /flow=medium/);
    assert.match(line, /კრუნჩხვები|cramps/);
    assert.match(line, /თავის ტკივილი|headache/);
    assert.match(line, /შფოთვა|anxious/);
    assert.equal(line.includes('unprotected'), false);
    assert.equal(line.includes('protected'), false);
    assert.equal(line.includes('pain_sex'), false);
    assert.equal(line.includes('future_chip_xyz'), false);
    assert.equal(line.includes('secret journal'), false);
    assert.equal(line.includes('should-not-leak'), false);
    assert.equal(line.includes('libido'), false);
    assert.ok(included.includes(CYCLE_FIELD_CATEGORIES.BLEEDING));
    assert.ok(included.includes(CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS));
    assert.ok(included.includes(CYCLE_FIELD_CATEGORIES.MOOD));
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH));
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.PRIVATE_NOTES));
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.UNKNOWN));

    const prompt = promptFor([log]);
    assert.equal(prompt.includes('unprotected'), false);
    assert.equal(prompt.includes('secret journal'), false);
    assert.match(prompt, /cramps|კრუნჩხვები/);
    assert.match(prompt, /anxious|შფოთვა/);
  });

  it('inspects categories without logging raw sensitive values', () => {
    const inspect = inspectCycleAiCategories({
      logs: [
        {
          date: '2025-03-02',
          flow: 'light',
          symptoms: ['cramps', 'unprotected'],
          notes: 'secret journal',
        },
      ],
    });
    assert.ok(inspect.includedCategories.includes(CYCLE_FIELD_CATEGORIES.BLEEDING));
    assert.ok(inspect.includedCategories.includes(CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS));
    assert.ok(inspect.excludedCategories.includes(CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH));
    assert.ok(inspect.excludedCategories.includes(CYCLE_FIELD_CATEGORIES.PRIVATE_NOTES));
    assert.equal(JSON.stringify(inspect).includes('unprotected'), false);
    assert.equal(JSON.stringify(inspect).includes('secret journal'), false);
  });

  it('excludes unknown future symptom keys from AI and partner helpers', () => {
    assert.equal(classifyCycleSymptomKey('brand_new_sensitive_chip'), CYCLE_FIELD_CATEGORIES.UNKNOWN);
    assert.deepEqual(partnerSafeSymptomKeys(['cramps', 'brand_new_sensitive_chip', 'unprotected']), ['cramps']);
    const { line } = serializeCycleLogForAi({
      date: '2025-03-02',
      flow: 'none',
      symptoms: ['brand_new_sensitive_chip'],
    });
    assert.equal(line.includes('brand_new_sensitive_chip'), false);
  });

  it('does not put sexual chips into doctor-summary topSymptoms', () => {
    const summary = buildDoctorSummary({
      profile,
      logs: [
        {
          date: '2025-03-02',
          flow: 'medium',
          symptoms: ['cramps', 'unprotected'],
          moods: ['anxious'],
        },
      ],
      predictions: { nextPeriodStart: '2025-03-29', ovulationDate: '2025-03-15', fertileWindow: null },
    });
    assert.ok(summary.pain.aggregates.some((row) => row.type === 'cramps'));
    assert.equal(JSON.stringify(summary).includes('unprotected'), false);
    assert.equal(summary.topMoods.length, 0);
  });

  it('buildCycleWellnessContext returns only the allowlisted prompt plus category inspect', () => {
    const ctx = buildCycleWellnessContext({
      profile,
      logs: [
        {
          date: '2025-03-02',
          flow: 'medium',
          symptoms: ['cramps', 'unprotected'],
          notes: 'journal',
        },
      ],
      predictions: { confidence: 'low', nextPeriodStart: '2025-03-29', ovulationDate: '2025-03-15' },
      pregnancy: null,
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2025-03-02',
    });
    assert.equal(ctx.prompt.includes('unprotected'), false);
    assert.equal(ctx.prompt.includes('journal'), false);
    assert.ok(ctx.includedCategories.includes(CYCLE_FIELD_CATEGORIES.BLEEDING));
    assert.ok(ctx.excludedCategories.includes(CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH));
  });
});
