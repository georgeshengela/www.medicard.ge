import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cycleMediContext } from './cycleMediContext.ts';
import { MEDI_HANDOFF_TTL_MS, clearMediHandoff, stageMediCycleContext, takeMediCycleContext } from './mediHandoff.ts';
import {
  AI_CONTEXT_PAIN_SEVERITIES,
  AI_CONTEXT_PAIN_TYPES,
  AI_CONTEXT_REGISTRY,
  isAiContextKey,
} from './cycleObservationRegistry.ts';
import { MOOD_OPTIONS, PHYSICAL_SYMPTOMS, SEXUAL_OPTIONS } from '../constants/cycle.ts';
import {
  OBSERVATION_REGISTRY,
  PAIN_SEVERITIES,
  PAIN_TYPES,
  SENSITIVITY,
} from '../../../server/src/lib/cycleObservationRegistry.js';

const TODAY = '2026-10-14';

/** A classic TRACK_PERIOD bundle on cycle day 12 (follicular), next period in 16 days, fertile in 1. */
function bundle(over: Record<string, any> = {}): any {
  const base: any = {
    profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-10-03', privacyEnabled: false, expectsBleeding: true, fertilityDisplay: 'auto' },
    meta: { today: TODAY },
    phase: 'follicular',
    phaseKa: 'ფოლიკულური ფაზა',
    cycleDay: 12,
    averages: { usedCycleLength: 28, cycleCount: 6 },
    forecastEligibility: { allowed: true, reason: 'STANDARD' },
    predictions: {
      nextPeriodStart: '2026-10-30',
      nextPeriodEnd: '2026-11-03',
      ovulationDate: '2026-10-16',
      fertileWindow: { start: '2026-10-15', end: '2026-10-17' },
      calendar: {},
      phases: [
        { periodStart: '2026-10-30', periodEnd: '2026-11-03', ovulation: '2026-10-16', fertileStart: '2026-10-15', fertileEnd: '2026-10-17' },
      ],
    },
    logs: [
      {
        date: TODAY,
        flow: 'none',
        // Everything she could have logged today — only pain + everyday moods may travel.
        symptoms: [...PHYSICAL_SYMPTOMS.map((o) => o.id), ...SEXUAL_OPTIONS.map((o) => o.id)],
        moods: ['calm', 'anxious', 'high_drive', 'not_a_mood'],
        painEntries: [
          { type: 'cramps', severity: 'moderate' },
          { type: 'lower_back', severity: 'mild' },
          { type: 'cramps', severity: 'severe' },
          { type: 'vulva', severity: 'mild' },
          { type: 'headache', severity: 'unbearable' },
        ],
        notes: 'private journal text',
        bbt: 36.71,
        cervicalMucus: 'eggwhite',
        ovulationTest: 'positive',
        pregnancyTest: 'negative',
        sexualActivity: true,
        libido: 5,
        observations: { energy: 'low', ovulationMarked: true },
      },
    ],
  };
  return { ...base, ...over, profile: { ...base.profile, ...(over.profile ?? {}) } };
}

const open = { today: TODAY, locked: false, privacy: false } as const;

/** Every label / value a sensitive field could surface as — none may appear in what is sent. */
const FORBIDDEN = [
  'private journal text', '36.71', '36,71', 'eggwhite', 'positive', 'negative', 'libido', 'BBT', 'ლორწო',
  'ტესტი', 'test', ...SEXUAL_OPTIONS.map((o) => o.label),
  ...PHYSICAL_SYMPTOMS.filter((o) => !['cramps', 'headache', 'back_pain', 'breast_tenderness', 'pelvic_pain', 'ovulation_pain'].includes(o.id)).map((o) => o.label),
];

describe('cycle context for Medi — what may travel', () => {
  it('sends the day, the estimated phase, what is ahead and today\'s pain and moods', () => {
    const ctx = cycleMediContext({ bundle: bundle(), ...open });
    assert.ok(ctx);
    assert.equal(ctx.day, 12);
    assert.equal(ctx.phase, 'follicular');
    assert.equal(ctx.phaseLogged, false);
    assert.deepEqual(ctx.nextPeriod, { inDays: 16, untilDays: null, ongoing: false });
    assert.deepEqual(ctx.fertile, { inDays: 1, ongoing: false, wide: false });
    assert.deepEqual(ctx.pain, [{ type: 'cramps', severity: 'moderate' }, { type: 'lower_back', severity: 'mild' }]);
    assert.deepEqual(ctx.moods, ['calm', 'anxious']);
    assert.equal(ctx.chipLabel, 'ციკლის კონტექსტი · დღე 12, სავარაუდოდ ფოლიკულური');
    assert.match(ctx.text, /ციკლის დღე: 12/);
    assert.match(ctx.text, /ფაზა: სავარაუდოდ ფოლიკულური/);
    assert.match(ctx.text, /შემდეგი მენსტრუაცია: სავარაუდოდ 16 დღეში/);
    assert.match(ctx.text, /ნაყოფიერი დღეები: სავარაუდოდ ხვალ/);
    assert.match(ctx.text, /დღევანდელი ტკივილი: სპაზმები \(ზომიერი\), წელის ტკივილი \(მსუბუქი\)/);
    assert.match(ctx.text, /დღევანდელი განწყობა: მშვიდი, შფოთვა/);
    assert.match(ctx.text, /არა დიაგნოზი/);
    // The text is the readable lines and nothing more; no ISO dates.
    assert.equal(ctx.text.split('\n').length, ctx.lines.length + 1);
    assert.doesNotMatch(ctx.text, /\d{4}-\d{2}-\d{2}/);
  });

  it('never carries a sensitive key: sex, drive, intimate symptoms, discharge, mucus, tests, BBT, notes', () => {
    const ctx = cycleMediContext({ bundle: bundle(), ...open });
    assert.ok(ctx);
    for (const word of FORBIDDEN) assert.ok(!ctx.text.includes(word), `leaked: ${word}`);
    const sent = new Set<string>([...ctx.moods, ...(ctx.pain.length ? ['pain'] : [])]);
    for (const key of sent) {
      const def = (OBSERVATION_REGISTRY as Record<string, any>)[key];
      assert.ok(def, `unknown key sent: ${key}`);
      assert.equal(def.sensitivity, SENSITIVITY.HEALTH, `${key} is ${def.sensitivity}`);
      assert.equal(def.aiDefaultAllowed, true, `${key} is not AI-allowed on the server`);
    }
    // The returned object has no other data fields.
    assert.deepEqual(Object.keys(ctx).sort(), ['chipLabel', 'day', 'fertile', 'lines', 'moods', 'nextPeriod', 'pain', 'phase', 'phaseLogged', 'text']);
  });

  it('lock (or its state unknown), privacy mode and discreet notifications → no context at all', () => {
    assert.equal(cycleMediContext({ bundle: bundle(), today: TODAY, locked: true, privacy: false }), null);
    assert.equal(cycleMediContext({ bundle: bundle(), today: TODAY, locked: null, privacy: false }), null);
    assert.equal(cycleMediContext({ bundle: bundle(), today: TODAY, locked: false, privacy: true }), null);
    assert.equal(cycleMediContext({ bundle: null, ...open }), null);
  });

  it('Tracking („მენსტრუაციას არ ველი“): no day, phase or forecast — only today\'s pain and moods', () => {
    const ctx = cycleMediContext({ bundle: bundle({ profile: { expectsBleeding: false } }), ...open });
    assert.ok(ctx);
    assert.equal(ctx.day, null);
    assert.equal(ctx.phase, null);
    assert.equal(ctx.nextPeriod, null);
    assert.equal(ctx.fertile, null);
    assert.equal(ctx.pain.length, 2);
    assert.doesNotMatch(ctx.text, /ციკლის დღე|ფაზა|მენსტრუაცია|ნაყოფიერ|ოვულაცი/);
    assert.equal(ctx.chipLabel, 'ციკლის კონტექსტი · დღევანდელი ტკივილი, განწყობა');
  });

  it('a forecast that may not be shown (postpartum return, gated) drops phase and forecast', () => {
    const ctx = cycleMediContext({ bundle: bundle({ forecastEligibility: { allowed: false, reason: 'POSTPARTUM_HISTORY_INSUFFICIENT' } }), ...open });
    assert.ok(ctx);
    assert.equal(ctx.phase, null);
    assert.equal(ctx.nextPeriod, null);
    assert.equal(ctx.fertile, null);
    assert.equal(ctx.day, null);
  });

  it('fertile-days display off → no fertile or ovulation words, even when the server phase is fertile', () => {
    const off = bundle({ profile: { fertilityDisplay: 'off' }, phase: 'fertile', phaseKa: 'ნაყოფიერი ფანჯარა' });
    const ctx = cycleMediContext({ bundle: off, ...open });
    assert.ok(ctx);
    assert.equal(ctx.fertile, null);
    assert.equal(ctx.phase, null);
    assert.deepEqual(ctx.nextPeriod, { inDays: 16, untilDays: null, ongoing: false });
    assert.doesNotMatch(`${ctx.text} ${ctx.chipLabel}`, /ნაყოფიერ|ოვულაცი|fertile|ovulat/i);
    // „ცალმხრივი ტკივილი“ (ovulation_side) is a pain place, said without a fertility word.
    const side = bundle({ profile: { fertilityDisplay: 'off' } });
    side.logs[0].painEntries = [{ type: 'ovulation_side', severity: 'mild' }];
    assert.doesNotMatch(cycleMediContext({ bundle: side, ...open })!.text, /ნაყოფიერ|ოვულაცი/);
  });

  it('hormonal contraception hiding the biological phase sends no phase word', () => {
    const ctx = cycleMediContext({ bundle: bundle({ contraception: { presentation: { showPhaseAsBiological: false, showFertilityMarkers: false, showFertileWindow: false } } }), ...open });
    assert.ok(ctx);
    assert.equal(ctx.phase, null);
    assert.equal(ctx.fertile, null);
    assert.equal(ctx.day, 12);
  });

  it('logged bleeding today: the phase is a fact, said without „სავარაუდოდ“', () => {
    const b = bundle({ phase: 'period', phaseKa: 'მენსტრუაცია', cycleDay: 2 });
    b.logs[0].flow = 'medium';
    const ctx = cycleMediContext({ bundle: b, ...open });
    assert.ok(ctx);
    assert.equal(ctx.phaseLogged, true);
    assert.equal(ctx.chipLabel, 'ციკლის კონტექსტი · დღე 2, მენსტრუაცია');
    assert.doesNotMatch(ctx.text, /flow|medium|საშუალო/);
  });

  it('a variable cycle sends the period window, not one day', () => {
    const b = bundle();
    b.predictions.nextPeriodRange = { from: '2026-10-28', to: '2026-11-01' };
    const ctx = cycleMediContext({ bundle: b, ...open });
    assert.deepEqual(ctx!.nextPeriod, { inDays: 14, untilDays: 18, ongoing: false });
    assert.match(ctx!.text, /სავარაუდოდ 14–18 დღეში/);
  });

  it('nothing worth sending (no day, no pain, no mood) → null, so no chip', () => {
    const b = bundle({ profile: { expectsBleeding: false } });
    b.logs = [];
    assert.equal(cycleMediContext({ bundle: b, ...open }), null);
  });

  it('pregnancy mode: no cycle day or phase', () => {
    const ctx = cycleMediContext({ bundle: bundle({ profile: { mode: 'PREGNANCY' } }), ...open });
    assert.ok(ctx);
    assert.equal(ctx.day, null);
    assert.equal(ctx.phase, null);
    assert.equal(ctx.nextPeriod, null);
  });
});

describe('registry parity — the AI context allowlist mirrors the server registry', () => {
  it('every allowed key is HEALTH + aiDefaultAllowed on the server; every denied mood is not', () => {
    for (const [key, row] of Object.entries(AI_CONTEXT_REGISTRY)) {
      const def = (OBSERVATION_REGISTRY as Record<string, any>)[key];
      assert.ok(def, `${key} missing on the server`);
      assert.equal(row.sensitivity, def.sensitivity, `${key} sensitivity`);
      assert.equal(row.ai, def.aiDefaultAllowed, `${key} ai flag`);
      assert.equal(row.storage, def.storage, `${key} storage`);
    }
    for (const mood of MOOD_OPTIONS) assert.ok(mood.id in AI_CONTEXT_REGISTRY, `${mood.id} not mirrored`);
    assert.deepEqual([...AI_CONTEXT_PAIN_TYPES], [...PAIN_TYPES]);
    assert.deepEqual([...AI_CONTEXT_PAIN_SEVERITIES], [...PAIN_SEVERITIES]);
  });

  it('no SENSITIVE / HIGHLY_SENSITIVE server key is ever an AI context key', () => {
    for (const def of Object.values(OBSERVATION_REGISTRY as Record<string, any>)) {
      if (def.sensitivity !== SENSITIVITY.HEALTH || !def.aiDefaultAllowed) assert.equal(isAiContextKey(def.key), false, def.key);
    }
    for (const id of ['bbt', 'cervicalMucus', 'ovulationTest', 'pregnancyTest', 'notes', 'libido', 'sexualActivity', 'flow', 'energy']) {
      assert.equal(isAiContextKey(id), false, id);
    }
  });
});

describe('Medi hand-off — in memory, consume once', () => {
  const ctx = () => cycleMediContext({ bundle: bundle(), ...open })!;
  const Q = 'რა ხდება ჩემს ციკლში ახლა?';

  it('is taken once by the same account for the same question', () => {
    clearMediHandoff();
    assert.equal(stageMediCycleContext('u1', Q, ctx(), 1000), true);
    assert.deepEqual(takeMediCycleContext('u1', Q, 1000 + 500)?.day, 12);
    assert.equal(takeMediCycleContext('u1', Q, 1000 + 600), null);
  });

  it('another account, another question or a late open finds nothing (and clears it)', () => {
    stageMediCycleContext('u1', Q, ctx(), 0);
    assert.equal(takeMediCycleContext('u2', Q, 10), null);
    assert.equal(takeMediCycleContext('u1', Q, 20), null);
    stageMediCycleContext('u1', Q, ctx(), 0);
    assert.equal(takeMediCycleContext('u1', 'სხვა შეკითხვა', 10), null);
    stageMediCycleContext('u1', Q, ctx(), 0);
    assert.equal(takeMediCycleContext('u1', Q, MEDI_HANDOFF_TTL_MS + 1), null);
  });

  it('staging null (lock / privacy) clears an older context', () => {
    stageMediCycleContext('u1', Q, ctx(), 0);
    assert.equal(stageMediCycleContext('u1', Q, null, 1), false);
    assert.equal(takeMediCycleContext('u1', Q, 2), null);
  });
});
