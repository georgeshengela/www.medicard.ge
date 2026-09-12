import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENERGY_LEVELS,
  OBSERVATION_CATEGORIES,
  OBSERVATION_SCHEMA_VERSION,
  SENSITIVITY,
  TREND_MIN_OCCURRENCES,
  TREND_MIN_POINTS,
  engineInputKeys,
  getObservationDef,
  mergeObservationBag,
  observationAiAllowed,
  observationPartnerAllowed,
  parseKeyedList,
  parseObservationBag,
  recentObservationKeys,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';
import { parseObservationWrite } from './cycleObservations.js';
import {
  addDays,
  buildPredictions,
  inferCycleStats,
  buildCycleAiUserPrompt,
} from './cycle.js';
import { serializeCycleLogForAi, partnerSafeSymptomKeys } from './cycleAiContext.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleExportPayload, wipeCycleHealthData } from './cycleLifecycle.js';
import { CYCLE_MODE_CAPABILITIES, PRODUCT_MODES, isLiveProductMode } from './cycleModes.js';
import { filterLogsForEngine } from './cycleHistoryQuery.js';

const LMP = '2026-08-01';

function bleedLogs() {
  return [
    { date: '2026-08-01', flow: 'medium' },
    { date: '2026-08-02', flow: 'medium' },
    { date: '2026-08-03', flow: 'light' },
  ];
}

describe('observation registry', () => {
  it('accepts known keys and rejects unknown / disabled writes', () => {
    assert.equal(getObservationDef('energy').category, OBSERVATION_CATEGORIES.ENERGY);
    assert.deepEqual(parseObservationBag({ energy: 'low' }, { strict: true }), { energy: 'low' });
    assert.throws(() => parseObservationBag({ mystery_chip: 'yes' }, { strict: true }));
    assert.throws(() => parseObservationBag({ missed_pill: true }, { strict: true }));
    assert.throws(() => parseKeyedList(['brand_new_sensitive_chip'], 'symptoms', { strict: true }));
    assert.deepEqual(parseKeyedList(['bloating', 'cramps', 'heartburn'], 'symptoms', { strict: true }), [
      'bloating',
      'cramps',
      'heartburn',
    ]);
  });

  it('rejects wrong enum and value type', () => {
    assert.throws(() => parseObservationBag({ energy: 'exhausted' }, { strict: true }));
    assert.throws(() => parseObservationBag({ energy: 3 }, { strict: true }));
    assert.ok(ENERGY_LEVELS.includes('very_low'));
    const written = parseObservationWrite({ energy: 'high' });
    assert.equal(written.observations.energy, 'high');
    assert.equal(written.observationSchemaVersion, OBSERVATION_SCHEMA_VERSION);
  });

  it('marks sensitive metadata and defaults AI/partner deny for new fields', () => {
    assert.equal(getObservationDef('energy').aiDefaultAllowed, false);
    assert.equal(getObservationDef('energy').partnerDefaultAllowed, false);
    assert.equal(observationAiAllowed('energy'), false);
    assert.equal(observationPartnerAllowed('energy'), false);
    assert.equal(getObservationDef('pain_sex').sensitivity, SENSITIVITY.HIGHLY_SENSITIVE);
    assert.equal(observationAiAllowed('pain_sex'), false);
    assert.equal(observationPartnerAllowed('cervicalMucus'), false);
    assert.equal(observationPartnerAllowed('pregnancyTest'), false);
    assert.equal(observationAiAllowed('notes'), false);
    assert.equal(getObservationDef('flow').engineRole, 'engine_input');
    assert.deepEqual(engineInputKeys(), ['flow']);
    assert.equal(TREND_MIN_OCCURRENCES, 2);
    assert.equal(TREND_MIN_POINTS, 3);
  });
});

describe('legacy compatibility and no double counting', () => {
  it('loads legacy symptoms and drops pain-managed chips when painEntries exist', () => {
    const symptoms = stripPainManagedSymptoms(
      ['cramps', 'bloating', 'headache'],
      [{ type: 'headache', severity: 'mild' }, { type: 'cramps', severity: 'severe' }],
    );
    assert.deepEqual(symptoms, ['bloating']);
  });

  it('keeps legacy headache chip when painEntries does not cover it', () => {
    assert.deepEqual(stripPainManagedSymptoms(['headache', 'bloating'], []), ['headache', 'bloating']);
  });
});

describe('write / replace / clear', () => {
  it('replaces same-day energy and clears with null', () => {
    const created = parseObservationWrite({ energy: 'low' });
    assert.equal(created.observations.energy, 'low');
    const updated = parseObservationWrite({ observations: { energy: 'high' } }, created);
    assert.equal(updated.observations.energy, 'high');
    const cleared = mergeObservationBag({ energy: 'high' }, { energy: null }, { strict: true });
    assert.equal(Object.hasOwn(cleared, 'energy'), false);
  });

  it('rejects unknown symptom keys on write and accepts moods', () => {
    assert.throws(() => parseObservationWrite({ symptoms: ['future_chip_xyz'] }));
    const ok = parseObservationWrite({ moods: ['anxious'], symptoms: ['bloating'] });
    assert.deepEqual(ok.moods, ['anxious']);
    assert.deepEqual(ok.symptoms, ['bloating']);
  });
});

describe('privacy firewall', () => {
  it('does not put energy, sexual health, pregnancy test extras, mucus, BBT, or notes in partner payload', () => {
    const payload = buildPartnerPayload({
      today: '2026-08-14',
      permissions: { period: true, cyclePhase: true, fertileWindow: false, symptoms: true },
      profile: { lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: [
        {
          date: '2026-08-14',
          flow: 'none',
          symptoms: ['bloating', 'unprotected', 'pain_sex'],
          energy: 'low',
          observations: { energy: 'low' },
          pregnancyTest: 'positive',
          cervicalMucus: 'eggwhite',
          bbt: 36.7,
          notes: 'secret',
        },
      ],
      predictions: buildPredictions({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5 }),
    });
    assert.equal(partnerPayloadHasLeak(payload), false);
    const text = JSON.stringify(payload);
    assert.equal(text.includes('unprotected'), false);
    assert.equal(text.includes('energy'), false);
    assert.equal(text.includes('eggwhite'), false);
    assert.equal(partnerSafeSymptomKeys(['bloating', 'unprotected', 'energy']).includes('bloating'), true);
    assert.equal(partnerSafeSymptomKeys(['unprotected']).length, 0);
  });

  it('AI keeps existing allowlist and denies energy / sex / notes', () => {
    const { line, excluded } = serializeCycleLogForAi({
      date: '2026-08-14',
      flow: 'medium',
      symptoms: ['bloating', 'unprotected'],
      moods: ['anxious'],
      observations: { energy: 'very_low' },
      energy: 'very_low',
      notes: 'secret journal',
      painEntries: [{ type: 'headache', severity: 'mild' }],
    });
    assert.match(line, /შებერილობა|bloating/);
    assert.equal(line.includes('unprotected'), false);
    assert.equal(line.includes('very_low'), false);
    assert.equal(line.includes('secret journal'), false);
    assert.ok(excluded.includes('unknown') || excluded.includes('sexual_health'));
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [
        {
          date: '2026-08-14',
          flow: 'none',
          observations: { energy: 'high' },
          symptoms: ['unprotected'],
          notes: 'nope',
        },
      ],
      predictions: { nextPeriodStart: '2026-08-29', confidence: 'medium' },
      user: { age: 28 },
    });
    assert.equal(prompt.includes('energy'), false);
    assert.equal(prompt.includes('unprotected'), false);
    assert.equal(prompt.includes('nope'), false);
  });
});

describe('engine input boundary', () => {
  it('energy/sleep/skin/digestion do not change forecast', () => {
    const base = bleedLogs();
    const withObs = base.map((l, i) =>
      i === 0
        ? {
            ...l,
            observations: { energy: 'very_low' },
            sleepQuality: 'poor',
            symptoms: ['acne', 'bloating'],
          }
        : l,
    );
    const predA = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: base,
    });
    const predB = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: withObs,
    });
    assert.equal(predA.nextPeriodStart, predB.nextPeriodStart);
    assert.equal(predA.ovulationDate, predB.ovulationDate);
    assert.deepEqual(predA.fertileWindow, predB.fertileWindow);
    assert.equal(predA.confidence, predB.confidence);
    assert.deepEqual(inferCycleStats(base, 28, 5).periodRanges, inferCycleStats(withObs, 28, 5).periodRanges);
  });

  it('OPK, BBT, mucus, and private observations do not change forecast', () => {
    const base = bleedLogs();
    const withFertility = base.map((l, i) =>
      i === 0
        ? {
            ...l,
            ovulationTest: 'positive',
            bbt: 36.8,
            cervicalMucus: 'eggwhite',
            pregnancyTest: 'negative',
            sexualActivity: true,
            libido: 4,
            notes: 'private',
          }
        : l,
    );
    const predA = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: base,
    });
    const predB = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: withFertility,
    });
    assert.equal(predA.nextPeriodStart, predB.nextPeriodStart);
    assert.equal(predA.ovulationDate, predB.ovulationDate);
    assert.deepEqual(predA.fertileWindow, predB.fertileWindow);
    assert.equal(predA.confidence, predB.confidence);
    assert.deepEqual(inferCycleStats(base, 28, 5).periodRanges, inferCycleStats(withFertility, 28, 5).periodRanges);
  });
});

describe('deletion', () => {
  it('cycle wipe deletes CycleLog rows that hold observations', async () => {
    const prisma = {
      cyclePartnerShare: {
        updateMany: async () => ({ count: 0 }),
        deleteMany: async () => ({ count: 0 }),
      },
      cycleProfile: {
        updateMany: async () => ({ count: 1 }),
        deleteMany: async () => ({ count: 1 }),
      },
      cycleLog: { deleteMany: async () => ({ count: 12 }) },
      cycleCustomTag: { deleteMany: async () => ({ count: 0 }) },
      pregnancyLog: { deleteMany: async () => ({ count: 0 }) },
      cyclePredictionSnapshot: { deleteMany: async () => ({ count: 0 }) },
      cyclePregnancyEpisode: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (ops) => Promise.all(ops),
    };
    const deleted = await wipeCycleHealthData(prisma, 'user-1');
    assert.equal(deleted.logs, 12);
  });

  it('personal export includes observations and export is not ProductEvent', () => {
    const payload = buildCycleExportPayload({
      profile: { mode: 'TRACK_PERIOD' },
      logs: [{ date: '2026-08-10', observations: { energy: 'low' }, notes: 'private' }],
    });
    assert.equal(payload.logs[0].observations.energy, 'low');
    assert.equal(payload.logs[0].notes, 'private');
    assert.equal(Object.hasOwn(payload, 'analytics'), false);
  });
});

describe('performance windows', () => {
  it('30 / 365 / 5 year synthetic logs keep engine on flow-only rows', () => {
    for (const days of [30, 365, 365 * 5]) {
      const logs = [];
      let d = '2021-01-01';
      for (let i = 0; i < days; i += 1) {
        logs.push({
          date: d,
          flow: i % 28 < 5 ? 'medium' : 'none',
          observations: { energy: i % 3 === 0 ? 'low' : 'normal' },
          symptoms: ['bloating'],
        });
        d = addDays(d, 1);
      }
      const today = logs[logs.length - 1].date;
      const t0 = Date.now();
      const inferred = inferCycleStats(filterLogsForEngine(logs.map((l) => ({ date: l.date, flow: l.flow })), today));
      const ms = Date.now() - t0;
      assert.ok(inferred.lastPeriodStart);
      assert.ok(ms < 400, `${days}d infer ${ms}ms`);
    }
  });
});

describe('mode architecture', () => {
  it('cycle tracking, TTC, pregnancy, and perimenopause are live product modes', () => {
    assert.equal(isLiveProductMode(PRODUCT_MODES.CYCLE_TRACKING), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.TRYING_TO_CONCEIVE), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.PREGNANCY), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.PERIMENOPAUSE), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.POSTPARTUM), true);
    assert.ok(CYCLE_MODE_CAPABILITIES[PRODUCT_MODES.TRYING_TO_CONCEIVE].futureOnly.includes('conceptionProbability'));
    assert.ok(CYCLE_MODE_CAPABILITIES[PRODUCT_MODES.PREGNANCY].futureOnly.includes('pregnancyLikelihood'));
    assert.ok(CYCLE_MODE_CAPABILITIES[PRODUCT_MODES.PERIMENOPAUSE].futureOnly.includes('perimenopauseDiagnosis'));
    assert.ok(CYCLE_MODE_CAPABILITIES[PRODUCT_MODES.POSTPARTUM].futureOnly.includes('postpartumRecoveryScore'));
  });
});

describe('recent observation ordering', () => {
  it('requires two days and excludes sensitive shortcuts', () => {
    const keys = recentObservationKeys(
      [
        { date: '2026-08-10', symptoms: ['bloating', 'unprotected'], moods: ['anxious'] },
        { date: '2026-08-11', symptoms: ['bloating'], moods: ['anxious'] },
        { date: '2026-08-12', symptoms: ['acne'] },
      ],
      { limit: 4, minDays: 2, excludeSensitive: true },
    );
    assert.deepEqual(keys, ['bloating', 'anxious']);
  });
});
