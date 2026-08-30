import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPredictions,
  detectCyclePhase,
  inferCycleStats,
  buildCycleAiUserPrompt,
  buildDoctorSummary,
} from './cycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { CYCLE_OBSERVATION_AI_RULES } from './cycleHonesty.js';
import { logHasExtras } from './cyclePeriod.js';
import {
  PAIN_TYPES,
  PAIN_SEVERITIES,
  parsePainEntries,
  parseCustomTagIds,
  parseCycleNote,
  parseObservationWrite,
  normalizeTagName,
  foreignTagIds,
  observationAiBits,
  buildObservationInsights,
  collectPainObservations,
  CYCLE_NOTE_MAX,
  CYCLE_TAG_NAME_MAX,
  CYCLE_TAG_ACTIVE_MAX,
  OBSERVATION_PATTERN_MIN,
} from './cycleObservations.js';

const LMP = '2026-08-01';

function bleedLogs() {
  return [
    { date: '2026-08-01', flow: 'medium' },
    { date: '2026-08-02', flow: 'medium' },
    { date: '2026-08-03', flow: 'light' },
  ];
}

function extraObservations() {
  return {
    painEntries: [{ type: 'pelvic', severity: 'severe' }],
    sleepQuality: 'poor',
    stressLevel: 'high',
    exerciseLevel: 'light',
    caffeine: 'moderate',
    alcohol: 'none',
    customTagIds: ['11111111-1111-4111-8111-111111111111'],
    notes: 'private journal — travel and cramps',
  };
}

describe('pain model', () => {
  it('accepts multiple locations with severity', () => {
    const parsed = parsePainEntries(
      [
        { type: 'pelvic', severity: 'severe' },
        { type: 'headache', severity: 'mild' },
      ],
      { strict: true },
    );
    assert.deepEqual(parsed, [
      { type: 'pelvic', severity: 'severe' },
      { type: 'headache', severity: 'mild' },
    ]);
  });

  it('dedupes type and keeps first severity', () => {
    const parsed = parsePainEntries([
      { type: 'cramps', severity: 'mild' },
      { type: 'cramps', severity: 'severe' },
    ]);
    assert.deepEqual(parsed, [{ type: 'cramps', severity: 'mild' }]);
  });

  it('rejects invalid type and severity in strict mode', () => {
    assert.throws(() => parsePainEntries([{ type: 'uterus', severity: 'mild' }], { strict: true }));
    assert.throws(() => parsePainEntries([{ type: 'pelvic', severity: '8' }], { strict: true }));
    assert.throws(() => parsePainEntries([{ type: 'pelvic', severity: 'moderate' }, 'x'], { strict: true }));
  });

  it('covers the compact enum set', () => {
    assert.ok(PAIN_TYPES.includes('cramps'));
    assert.ok(PAIN_TYPES.includes('ovulation_side'));
    assert.deepEqual(PAIN_SEVERITIES, ['mild', 'moderate', 'severe']);
  });
});

describe('lifestyle validation', () => {
  it('accepts valid values and null clear', () => {
    const written = parseObservationWrite({
      sleepQuality: 'good',
      stressLevel: 'low',
      exerciseLevel: 'intense',
      caffeine: 'none',
      alcohol: 'light',
    });
    assert.equal(written.sleepQuality, 'good');
    assert.equal(written.alcohol, 'light');
    const cleared = parseObservationWrite({
      sleepQuality: null,
      stressLevel: null,
      exerciseLevel: null,
      caffeine: null,
      alcohol: null,
    });
    assert.equal(cleared.sleepQuality, null);
    assert.equal(cleared.stressLevel, null);
  });

  it('rejects invalid enums', () => {
    assert.throws(() => parseObservationWrite({ sleepQuality: 'insomnia' }));
    assert.throws(() => parseObservationWrite({ stressLevel: 'cortisol' }));
    assert.throws(() => parseObservationWrite({ exerciseLevel: 'hiit' }));
    assert.throws(() => parseObservationWrite({ caffeine: '3cups' }));
    assert.throws(() => parseObservationWrite({ alcohol: 'drunk' }));
  });
});

describe('custom tags', () => {
  it('normalizes name and rejects empty or oversized', () => {
    const ok = normalizeTagName('  Travel  ');
    assert.equal(ok.ok, true);
    assert.equal(ok.name, 'Travel');
    assert.equal(ok.nameNormalized, 'travel');
    assert.equal(normalizeTagName('   ').ok, false);
    assert.equal(normalizeTagName('x'.repeat(CYCLE_TAG_NAME_MAX + 1)).ok, false);
    assert.equal(normalizeTagName('მოგზაურობა').ok, true);
  });

  it('treats Georgian case-normalized duplicates as the same key', () => {
    const a = normalizeTagName('მოგზაურობა');
    const b = normalizeTagName('  მოგზაურობა  ');
    assert.equal(a.nameNormalized, b.nameNormalized);
  });

  it('rejects foreign tag ids', () => {
    const mine = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'];
    const foreign = foreignTagIds(
      ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      mine,
    );
    assert.deepEqual(foreign, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
  });

  it('rejects invalid tag ids in strict mode', () => {
    assert.throws(() => parseCustomTagIds(['not-a-uuid'], { strict: true }));
    assert.equal(CYCLE_TAG_ACTIVE_MAX, 30);
  });
});

describe('journal notes', () => {
  it('saves, trims, and clears', () => {
    assert.equal(parseCycleNote('  hello  ', { strict: true }), 'hello');
    assert.equal(parseCycleNote('   '), null);
    assert.equal(parseCycleNote(null), null);
  });

  it('rejects oversize notes in strict mode', () => {
    assert.throws(() => parseCycleNote('n'.repeat(CYCLE_NOTE_MAX + 1), { strict: true }));
  });
});

describe('insights sample rules', () => {
  it('does not invent a pattern from two days', () => {
    const insights = buildObservationInsights([
      { date: '2026-08-01', stressLevel: 'high', painEntries: [{ type: 'headache', severity: 'mild' }] },
      { date: '2026-08-02', stressLevel: 'high', painEntries: [{ type: 'headache', severity: 'mild' }] },
    ]);
    assert.equal(insights.lifestyle.patterns.length, 0);
    assert.equal(OBSERVATION_PATTERN_MIN, 5);
  });

  it('emits a count-based stress/headache line when n>=5', () => {
    const logs = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      stressLevel: 'high',
      painEntries: i < 5 ? [{ type: 'headache', severity: 'mild' }] : [],
    }));
    const insights = buildObservationInsights(logs);
    const hit = insights.lifestyle.patterns.find((p) => p.id === 'stress_headache');
    assert.ok(hit);
    assert.equal(hit.numerator, 5);
    assert.equal(hit.denominator, 8);
    assert.match(hit.textKa, /5 დღეს 8-დან/);
    assert.doesNotMatch(hit.textKa, /იწვევს|100%/);
  });

  it('does not emit estimated-phase pain patterns', () => {
    const logs = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-08-2${i}`,
      painEntries: [{ type: 'pelvic', severity: 'moderate' }],
    }));
    const phasesByDate = Object.fromEntries(logs.map((l) => [l.date, 'luteal']));
    const open = buildObservationInsights(logs, {
      predictionAvailability: 'NORMAL',
      phasesByDate,
    });
    assert.equal(open.lifestyle.patterns.some((p) => p.id === 'pelvic_luteal'), false);
  });
});

describe('engine regression', () => {
  it('pain/lifestyle/tags/journal do not change derived cycle values', () => {
    const base = bleedLogs();
    const withObs = base.map((l, i) => (i === 0 ? { ...l, ...extraObservations() } : l));
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
    const inferredA = inferCycleStats(base, 28, 5);
    const inferredB = inferCycleStats(withObs, 28, 5);
    assert.deepEqual(inferredA.periodRanges, inferredB.periodRanges);
    assert.equal(inferredA.avgCycleLength, inferredB.avgCycleLength);
    const phaseA = detectCyclePhase({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, today: '2026-08-20' });
    const phaseB = detectCyclePhase({ lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, today: '2026-08-20' });
    assert.equal(phaseA.phase, phaseB.phase);
    assert.equal(phaseA.day, phaseB.day);
  });

  it('treats new observations as extras so bleed clear does not drop the row', () => {
    assert.equal(logHasExtras({ flow: 'none', painEntries: [{ type: 'headache', severity: 'mild' }] }), true);
    assert.equal(logHasExtras({ flow: 'none', sleepQuality: 'poor' }), true);
    assert.equal(logHasExtras({ flow: 'none', customTagIds: ['11111111-1111-4111-8111-111111111111'] }), true);
  });
});

describe('partner and AI privacy', () => {
  it('partner payload excludes pain, lifestyle, tags, and journal', () => {
    const payload = buildPartnerPayload({
      today: '2026-08-20',
      permissions: { period: true, cyclePhase: true, fertileWindow: false, symptoms: true },
      profile: { lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: [{ date: LMP, flow: 'medium', ...extraObservations(), symptoms: ['bloating'] }],
      predictions: buildPredictions({
        lastPeriodStart: LMP,
        avgCycleLength: 28,
        avgPeriodLength: 5,
        logs: [{ date: LMP, flow: 'medium' }],
      }),
    });
    assert.equal(partnerPayloadHasLeak(payload), false);
    const text = JSON.stringify(payload);
    for (const key of [
      'painEntries',
      'sleepQuality',
      'stressLevel',
      'exerciseLevel',
      'caffeine',
      'alcohol',
      'customTagIds',
      'customTags',
      'notes',
      'observationInsights',
    ]) {
      assert.equal(Object.hasOwn(payload, key), false);
      assert.doesNotMatch(text, new RegExp(`"${key}"`));
    }
    assert.equal(partnerPayloadHasLeak({ ...payload, painEntries: [] }), true);
    assert.equal(partnerPayloadHasLeak({ ...payload, sleepQuality: 'poor' }), true);
    assert.equal(partnerPayloadHasLeak({ ...payload, customTags: [] }), true);
  });

  it('AI prompt includes structured pain under USER_LOGGED and omits notes/tags', () => {
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [{ date: '2026-08-10', flow: 'none', ...extraObservations(), symptoms: ['bloating'] }],
      predictions: { nextPeriodStart: '2026-08-29', confidence: 'medium' },
      user: { age: 28 },
    });
    assert.match(prompt, /USER_LOGGED/);
    assert.match(prompt, /ტკივილი=pelvic:severe/);
    assert.match(prompt, /ძილი=poor/);
    assert.match(prompt, /სტრესი=high/);
    assert.doesNotMatch(prompt, /private journal/);
    assert.doesNotMatch(prompt, /11111111-1111-4111-8111-111111111111/);
    assert.doesNotMatch(prompt, /Travel|მოგზაურობა/);
    for (const rule of CYCLE_OBSERVATION_AI_RULES) {
      assert.match(prompt, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('doctor summary lists pain and omits journal text and tags', () => {
    const summary = buildDoctorSummary({
      profile: { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false },
      logs: [{ date: '2026-08-10', flow: 'none', ...extraObservations() }],
      predictions: { nextPeriodStart: '2026-08-29', ovulationDate: null, fertileWindow: null, confidence: 'low' },
    });
    assert.ok(summary.painObservations.some((p) => p.type === 'pelvic' && p.severity === 'severe'));
    assert.equal(summary.lifestyleSummary.stress.high, 1);
    const text = JSON.stringify(summary);
    assert.doesNotMatch(text, /private journal/);
    assert.doesNotMatch(text, /11111111-1111-4111-8111-111111111111/);
    assert.equal(summary.journalNotes, undefined);
    assert.equal(summary.customTags, undefined);
  });
});

describe('AI bits helper', () => {
  it('does not include alcohol, caffeine, tags, or notes', () => {
    const bits = observationAiBits(extraObservations()).join(';');
    assert.match(bits, /pelvic:severe/);
    assert.doesNotMatch(bits, /alcohol|caffeine|customTag|journal|travel/i);
  });
});

describe('pain history collection', () => {
  it('returns discrete dated rows', () => {
    const rows = collectPainObservations([
      { date: '2026-08-05', painEntries: [{ type: 'pelvic', severity: 'severe' }] },
      { date: '2026-08-01', painEntries: [{ type: 'headache', severity: 'mild' }] },
    ]);
    assert.equal(rows[0].date, '2026-08-05');
    assert.equal(rows[1].type, 'headache');
  });
});
