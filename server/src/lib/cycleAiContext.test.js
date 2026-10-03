import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_AI_MOOD_ALLOWLIST,
  CYCLE_AI_PROTECTED_LOG_FIELDS,
  CYCLE_AI_SYMPTOM_ALLOWLIST,
  CYCLE_FIELD_CATEGORIES,
  classifyCycleSymptomKey,
  inspectCycleAiCategories,
  partnerSafeSymptomKeys,
  serializeCycleLogForAi,
} from './cycleAiContext.js';
import { buildCycleAiUserPrompt, buildCycleWellnessContext, buildDoctorSummary } from './cycle.js';
import { historicalAnalyticsForAi } from './cycleHistoryAnalytics.js';
import {
  OBSERVATION_REGISTRY,
  SENSITIVITY,
  STORAGE,
  observationAiContextAllowed,
} from './cycleObservationRegistry.js';

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
    assert.match(line, /სპაზმები|cramps/);
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
    assert.match(prompt, /cramps|სპაზმები/);
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

// W3-5: fertility tracking and intimate data never reach an AI prompt — enforced by the registry.
const PRIVATE_CHIPS = Object.values(OBSERVATION_REGISTRY)
  .filter((def) => def.storage === STORAGE.SYMPTOMS && def.sensitivity !== SENSITIVITY.HEALTH)
  .map((def) => def.key);

/** A TTC day with every protected key and column filled in, next to ordinary everyday data. */
function everythingLog(date = '2026-08-14') {
  return {
    id: 'log_1',
    userId: 'user_1',
    date,
    flow: 'light',
    symptoms: ['cramps', 'bloating', ...PRIVATE_CHIPS],
    moods: ['calm'],
    painEntries: [{ type: 'cramps', severity: 'mild' }],
    sleepQuality: 'good',
    stressLevel: 'low',
    bbt: 36.73,
    bbtSource: 'apple_watch_wrist',
    wristTempDelta: 0.42,
    ovulationTest: 'positive',
    pregnancyTest: 'positive',
    cervicalMucus: 'eggwhite',
    sexualActivity: true,
    libido: 5,
    notes: 'zzdiaryzz',
    customTagIds: ['tag_zzsecretzz'],
    exerciseLevel: 'intense',
    observations: {
      ovulationMarked: true,
      pregnancyChecklist: ['prenatal_vitamin', 'doctor_appt'],
      energy: 'very_low',
    },
    observationAssessments: { nausea: 'ABSENT' },
  };
}

/** Values and labels that must never appear anywhere in what the AI receives. */
const FORBIDDEN = [
  /36\.73/,
  /0\.42/,
  /apple_watch|wrist/i,
  /eggwhite|კვერცხის ცილა/i,
  /\bbbt\b|BBT|ბაზალ|ტემპერატურ/i,
  /bbtSource|wristTemp/i,
  /ovulationTest|pregnancyTest|cervicalMucus|ovulationMarked|pregnancyChecklist/,
  /ოვულაციის ტესტ|ორსულობის ტესტ|ლორწო|OPK/,
  /positive|დადებით/i,
  /sexualActivity|libido|ლიბიდო|სექს/i,
  /prenatal_vitamin|doctor_appt|ვიტამინ/i,
  /very_low|intense|ABSENT/,
  /zzdiaryzz|zzsecretzz/,
  /ოვულაცია ამ დღეს/,
];

function assertClean(text, where) {
  for (const pattern of FORBIDDEN) assert.doesNotMatch(text, pattern, `${where}: ${pattern}`);
  for (const key of PRIVATE_CHIPS) {
    assert.equal(new RegExp(`(^|[^a-z_])${key}([^a-z_]|$)`).test(text), false, `${where}: ${key}`);
  }
}

const TTC_PROFILE = {
  mode: 'TRY_TO_CONCEIVE',
  lastPeriodStart: '2026-08-01',
  avgCycleLength: 28,
  avgPeriodLength: 5,
  isIrregular: false,
  conditions: [],
};
const TTC_PREDICTIONS = {
  confidence: 'medium',
  nextPeriodStart: '2026-08-29',
  ovulationDate: '2026-08-15',
  ovulationRange: { start: '2026-08-14', end: '2026-08-16' },
  fertileWindow: { start: '2026-08-10', end: '2026-08-16' },
};

describe('W3-5: the AI never receives fertility-tracking or intimate data', () => {
  it('a day with every protected key and column serializes to everyday data only', () => {
    const { line, included, excluded } = serializeCycleLogForAi(everythingLog());
    assertClean(line, 'line');
    assert.match(line, /flow=light/);
    assert.match(line, /შებერილობა/);
    assert.match(line, /cramps:mild/);
    assert.match(line, /ძილი=good/);
    assert.equal(included.includes(CYCLE_FIELD_CATEGORIES.FERTILITY), false);
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.FERTILITY));
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH));
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.PRIVATE_NOTES));
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.PREGNANCY));
  });

  it('the TTC insights prompt keeps the forecast as a date range and carries no logged fertility value', () => {
    const args = {
      profile: TTC_PROFILE,
      logs: [everythingLog('2026-08-14'), everythingLog('2026-08-13')],
      predictions: TTC_PREDICTIONS,
      pregnancy: null,
      user: { age: 31 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'inferred' },
      today: '2026-08-14',
    };
    const prompt = buildCycleAiUserPrompt(args);
    assertClean(prompt, 'prompt');
    assert.match(prompt, /ციკლის დღე: 14/);
    assert.match(prompt, /სავარაუდო ნაყოფიერი ფანჯარა: /);
    assert.match(prompt, /სავარაუდო ოვულაცია: /);
    const ctx = buildCycleWellnessContext(args);
    assertClean(JSON.stringify(ctx), 'wellness context');
    assert.equal(ctx.includedCategories.includes(CYCLE_FIELD_CATEGORIES.FERTILITY), false);
    assert.ok(ctx.excludedCategories.includes(CYCLE_FIELD_CATEGORIES.FERTILITY));
  });

  it('inspection never reports fertility as included, even for an empty log list', () => {
    const inspect = inspectCycleAiCategories({ logs: [] });
    assert.equal(inspect.includedCategories.includes(CYCLE_FIELD_CATEGORIES.FERTILITY), false);
    assert.ok(inspect.excludedCategories.includes(CYCLE_FIELD_CATEGORIES.FERTILITY));
  });

  it('history patterns for AI drop any key the registry keeps private', () => {
    const lines = historicalAnalyticsForAi({
      completedCycleCount: 4,
      loggingCoverage: 'HIGH',
      insightDataQuality: 'HIGH',
      cycleLengthStats: null,
      painPatterns: [],
      symptomPatterns: [
        { key: 'bloating', cyclesWithObservation: 3, eligibleCycles: 4 },
        { key: 'unprotected', cyclesWithObservation: 3, eligibleCycles: 4 },
        { key: 'discharge', cyclesWithObservation: 3, eligibleCycles: 4 },
        { key: 'future_key', cyclesWithObservation: 3, eligibleCycles: 4 },
      ],
    });
    const text = lines.join('\n');
    assert.match(text, /symptom bloating/);
    assert.doesNotMatch(text, /unprotected|discharge|future_key/);
  });
});

describe('W3-5: exclusion is driven by the registry, not a hand list', () => {
  it('no SENSITIVE / HIGHLY_SENSITIVE row is AI-allowed, and every AI-allowed row is HEALTH', () => {
    for (const def of Object.values(OBSERVATION_REGISTRY)) {
      if (def.sensitivity !== SENSITIVITY.HEALTH) {
        assert.equal(def.aiDefaultAllowed, false, `${def.key} is ${def.sensitivity} but aiDefaultAllowed`);
        assert.equal(observationAiContextAllowed(def.key), false, def.key);
      }
      if (observationAiContextAllowed(def.key)) assert.equal(def.sensitivity, SENSITIVITY.HEALTH, def.key);
    }
  });

  it('BBT, OPK, mucus, pregnancy test, the ovulation mark and the pregnancy checklist are not AI context', () => {
    for (const key of [
      'bbt',
      'ovulationTest',
      'cervicalMucus',
      'pregnancyTest',
      'ovulationMarked',
      'pregnancyChecklist',
      'sexualActivity',
      'libido',
      'notes',
      'customTagIds',
    ]) {
      assert.equal(observationAiContextAllowed(key), false, key);
    }
  });

  it('every protected CycleLog column fails the registry rule (unregistered ones too)', () => {
    for (const field of CYCLE_AI_PROTECTED_LOG_FIELDS) {
      assert.equal(observationAiContextAllowed(field), false, field);
    }
    assert.ok(CYCLE_AI_PROTECTED_LOG_FIELDS.includes('bbtSource'));
    assert.ok(CYCLE_AI_PROTECTED_LOG_FIELDS.includes('wristTempDelta'));
  });

  it('the symptom / mood allowlists hold only HEALTH rows the registry lets AI read', () => {
    for (const key of [...CYCLE_AI_SYMPTOM_ALLOWLIST, ...CYCLE_AI_MOOD_ALLOWLIST]) {
      assert.equal(observationAiContextAllowed(key), true, key);
    }
  });

  it('every registry row that fails the rule stays out of the line, whatever its storage', () => {
    const denied = Object.values(OBSERVATION_REGISTRY).filter((def) => !observationAiContextAllowed(def.key));
    assert.ok(denied.length > 10);
    const EMPTY_LINE = '2026-08-14: flow=none; სიმპტომები=—; განწყობა=—';
    for (const def of denied) {
      const fallback = def.valueType === 'BOOLEAN' ? true : def.valueType === 'TEXT' ? 'zzvaluezz' : 39.91;
      const value = def.allowedValues?.at(-1) ?? fallback;
      const log = { date: '2026-08-14', flow: 'none' };
      if (def.storage === STORAGE.SYMPTOMS) log.symptoms = [def.key];
      else if (def.storage === STORAGE.MOODS) log.moods = [def.key];
      else if (def.storage === STORAGE.OBSERVATIONS) {
        log.observations = { [def.key]: def.cardinality === 'set' ? [value] : value };
      } else if (def.storage === STORAGE.COLUMN) log[def.column] = value;
      else if (def.storage === STORAGE.TAGS) log.customTagIds = ['zzvaluezz'];
      else continue; // profile rows (contraception) never live on a log
      const { line } = serializeCycleLogForAi(log);
      assert.equal(line, EMPTY_LINE, `${def.key} leaked into the AI line`);
    }
  });

  it('an unknown future column or bag key never reaches the line', () => {
    const { line, excluded } = serializeCycleLogForAi({
      date: '2026-08-14',
      flow: 'none',
      futureFertilityColumn: 'zzfuturezz',
      observations: { futureBagKey: 'zzbagzz' },
    });
    assert.equal(line, '2026-08-14: flow=none; სიმპტომები=—; განწყობა=—');
    assert.ok(excluded.includes(CYCLE_FIELD_CATEGORIES.UNKNOWN));
  });
});
