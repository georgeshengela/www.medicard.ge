import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCycleAiUserPrompt,
  buildDoctorSummary,
  buildPredictions,
} from './cycle.js';
import { buildPartnerPayload } from './cycleShare.js';
import {
  CYCLE_FERTILITY_AI_RULES,
  CYCLE_TEST_RESULTS,
  collectFertilityTests,
  formatCycleTestKa,
  isCycleTestResult,
  normalizeCycleTestResult,
} from './cycleFertility.js';

const BASE_PRED = {
  lastPeriodStart: '2026-08-01',
  avgCycleLength: 28,
  avgPeriodLength: 5,
  cycleCount: 4,
};

describe('cycle fertility test results', () => {
  it('accepts null, negative, positive, and unclear', () => {
    assert.equal(normalizeCycleTestResult(null), null);
    assert.equal(normalizeCycleTestResult(''), null);
    assert.deepEqual(CYCLE_TEST_RESULTS, ['negative', 'positive', 'unclear']);
    for (const value of CYCLE_TEST_RESULTS) {
      assert.equal(isCycleTestResult(value), true);
      assert.equal(normalizeCycleTestResult(value), value);
      assert.ok(formatCycleTestKa(value));
    }
  });

  it('rejects invalid enums', () => {
    assert.throws(() => normalizeCycleTestResult('peak'), /invalid_cycle_test_result/);
    assert.throws(() => normalizeCycleTestResult('confirmed'), /invalid_cycle_test_result/);
    assert.equal(isCycleTestResult('low'), false);
  });

  it('collects editable user-logged test history', () => {
    const { ovulationTests, pregnancyTests } = collectFertilityTests([
      { date: '2026-08-28', ovulationTest: 'negative' },
      { date: '2026-08-29', ovulationTest: 'positive', pregnancyTest: null },
      { date: '2026-08-30', ovulationTest: null, pregnancyTest: 'unclear' },
      { date: '2026-09-10', pregnancyTest: 'negative' },
    ]);
    assert.deepEqual(
      ovulationTests.map((t) => t.result),
      ['positive', 'negative'],
    );
    assert.equal(pregnancyTests[0].source, 'user_logged');
    assert.equal(pregnancyTests.find((t) => t.date === '2026-08-30').result, 'unclear');
  });
});

describe('medical honesty — observations do not change the engine', () => {
  it('positive OPK does not change ovulation date, fertile window, confidence, or phase', () => {
    const clean = buildPredictions(BASE_PRED);
    const withOpk = buildPredictions({
      ...BASE_PRED,
      logs: [{ date: '2026-08-14', ovulationTest: 'positive', flow: null }],
    });
    assert.equal(withOpk.ovulationDate, clean.ovulationDate);
    assert.deepEqual(withOpk.fertileWindow, clean.fertileWindow);
    assert.equal(withOpk.confidence, clean.confidence);
    assert.equal(withOpk.calendar['2026-08-15']?.ovulation, clean.calendar['2026-08-15']?.ovulation);
    assert.notEqual(withOpk.ovulationDate, '2026-08-14');
  });

  it('positive pregnancy test does not appear as a profile mode change in predictions', () => {
    const pred = buildPredictions({
      ...BASE_PRED,
      logs: [{ date: '2026-08-20', pregnancyTest: 'positive' }],
    });
    assert.equal(pred.ovulationDate, '2026-08-15');
    assert.equal(pred.nextPeriodStart, '2026-08-29');
  });
});

describe('AI context labels fertility tests as USER_LOGGED', () => {
  it('puts OPK and pregnancy-test results in USER_LOGGED and keeps honesty rules', () => {
    const predictions = buildPredictions(BASE_PRED);
    const prompt = buildCycleAiUserPrompt({
      profile: {
        mode: 'TRY_TO_CONCEIVE',
        lastPeriodStart: '2026-08-01',
        avgCycleLength: 28,
        avgPeriodLength: 5,
        isIrregular: false,
        conditions: [],
      },
      logs: [
        {
          date: '2026-08-14',
          flow: null,
          symptoms: [],
          moods: [],
          ovulationTest: 'positive',
          pregnancyTest: 'negative',
          bbt: 36.6,
          cervicalMucus: 'eggwhite',
        },
      ],
      predictions,
      pregnancy: null,
      user: { age: 29 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'inferred' },
      today: '2026-08-14',
    });
    const logged = prompt.slice(prompt.indexOf('USER_LOGGED:'), prompt.indexOf('ESTIMATED:'));
    const estimated = prompt.slice(prompt.indexOf('ESTIMATED:'), prompt.indexOf('CONDITIONS_SELF_REPORTED:'));
    assert.match(logged, /ოვულაციის ტესტი=დადებითი/);
    assert.match(logged, /ორსულობის ტესტი=უარყოფითი/);
    assert.match(logged, /BBT=36.6/);
    assert.doesNotMatch(logged, /sexualActivity|სექსი/);
    assert.doesNotMatch(estimated, /ოვულაციის ტესტი/);
    assert.match(prompt, /USER_LOGGED:/);
    for (const rule of CYCLE_FERTILITY_AI_RULES) {
      assert.match(prompt, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.doesNotMatch(prompt, /ოვულაცია დადასტურდა/);
  });
});

describe('doctor summary fertility tests', () => {
  it('lists user-reported tests and never says ovulation confirmed', () => {
    const predictions = buildPredictions(BASE_PRED);
    const summary = buildDoctorSummary({
      profile: { mode: 'TRY_TO_CONCEIVE', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false },
      logs: [
        { date: '2026-08-14', ovulationTest: 'positive', symptoms: [], moods: [] },
        { date: '2026-08-20', pregnancyTest: 'negative', symptoms: [], moods: [] },
      ],
      predictions,
    });
    assert.equal(summary.fertilityTests.label, 'user_logged');
    assert.equal(summary.fertilityTests.ovulationTests[0].result, 'positive');
    assert.equal(summary.fertilityTests.pregnancyTests[0].result, 'negative');
    assert.equal(JSON.stringify(summary).includes('Ovulation confirmed'), false);
  });
});

describe('partner privacy — fertility observations stay off the payload', () => {
  it('does not leak OPK, pregnancy test, BBT, mucus, or intercourse', () => {
    const payload = buildPartnerPayload({
      profile: {
        mode: 'TRY_TO_CONCEIVE',
        lastPeriodStart: '2026-08-01',
        avgCycleLength: 28,
        avgPeriodLength: 5,
        isIrregular: false,
      },
      logs: [
        {
          date: '2026-08-14',
          flow: 'none',
          symptoms: ['cramps'],
          ovulationTest: 'positive',
          pregnancyTest: 'negative',
          bbt: 36.7,
          cervicalMucus: 'eggwhite',
          sexualActivity: true,
          libido: 4,
          notes: 'secret',
        },
      ],
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      today: '2026-08-14',
    });
    const text = JSON.stringify(payload);
    assert.equal(text.includes('ovulationTest'), false);
    assert.equal(text.includes('pregnancyTest'), false);
    assert.equal(text.includes('"bbt"'), false);
    assert.equal(text.includes('cervicalMucus'), false);
    assert.equal(text.includes('sexualActivity'), false);
    assert.equal(text.includes('libido'), false);
    assert.equal(text.includes('eggwhite'), false);
    assert.equal(text.includes('36.7'), false);
  });
});
