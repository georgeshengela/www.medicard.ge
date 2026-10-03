import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE_ICON_SVG } from '../constants/cycleIconSvg.ts';
import { FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOMS, PREGNANCY_CHECKLIST } from '../constants/cycle.ts';
import { cycleGlyphFor, KNOWN_GLYPH_IDS, LEVEL_FIELD_GLYPH, LIFESTYLE_FIELDS, levelGlyphOpacity, levelOf, levelOnScale, type CycleIconKind } from './cycleIconMap.ts';
import {
  PERI_BODY_MORE,
  PERI_HEADACHE_SYMPTOMS,
  PERI_MOODS,
  PERI_PAIN,
  POSTPARTUM_BODY_KEYS,
  POSTPARTUM_DIGEST_KEYS,
  POSTPARTUM_MOOD_KEYS,
  POSTPARTUM_PAIN_TYPES,
  PREGNANCY_FLOW_OPTIONS,
  PREGNANCY_PAIN_TYPES,
  PREGNANCY_QUICK_BODY,
  PREGNANCY_QUICK_DIGESTION,
} from './cycleModeQuickLogOptions.ts';

// Mirrors `cycleObservations.ts` (which pulls the dictionary and cannot load in node).
const ENERGY_LEVELS = ['very_low', 'low', 'normal', 'high', 'very_high'];
const SLEEP_QUALITIES = ['poor', 'okay', 'good'];
const STRESS_LEVELS = ['low', 'medium', 'high'];

const glyphs = new Set(Object.keys(CYCLE_ICON_SVG));

/** A mapped glyph, never the `pain` fallback (which only means „no glyph was chosen“). */
function mapped(kind: CycleIconKind, id: string) {
  const table = (KNOWN_GLYPH_IDS as Record<string, Record<string, string>>)[
    kind === 'flow' ? 'FLOW' : kind === 'pain' ? 'PAIN' : kind === 'mood' ? 'MOOD' : kind === 'symptom' ? 'SYMPTOM' : kind === 'mucus' ? 'MUCUS' : kind === 'lifestyle' ? 'LIFESTYLE' : kind === 'checklist' ? 'CHECKLIST' : 'TESTS'
  ];
  assert.ok(table[id], `${kind}/${id} has no glyph mapped`);
  assert.ok(glyphs.has(cycleGlyphFor(kind, id)), `${kind}/${id} → ${cycleGlyphFor(kind, id)} is not in cycleIconSvg`);
}

test('every pregnancy checklist item has its own glyph in the built SVG set', () => {
  for (const item of PREGNANCY_CHECKLIST) mapped('checklist', item.id);
  assert.equal(cycleGlyphFor('checklist', 'ultrasound'), 'sonogram');
  assert.equal(cycleGlyphFor('checklist', 'doctor_appt'), 'stethoscope');
  assert.equal(cycleGlyphFor('checklist', 'no_smoking'), 'noSmoking');
});

test('every option the pregnancy, postpartum and perimenopause quick logs offer is a catalog id with a glyph', () => {
  const symptomIds = new Set(PHYSICAL_SYMPTOMS.map((o) => o.id));
  const moodIds = new Set(MOOD_OPTIONS.map((o) => o.id));
  for (const id of [...PREGNANCY_QUICK_DIGESTION, ...PREGNANCY_QUICK_BODY, ...POSTPARTUM_BODY_KEYS, ...POSTPARTUM_DIGEST_KEYS, ...PERI_HEADACHE_SYMPTOMS, ...PERI_BODY_MORE]) {
    assert.ok(symptomIds.has(id), `${id} is not a PHYSICAL_SYMPTOMS id`);
    mapped('symptom', id);
  }
  for (const id of [...POSTPARTUM_MOOD_KEYS, ...PERI_MOODS]) {
    assert.ok(moodIds.has(id), `${id} is not a MOOD_OPTIONS id`);
    mapped('mood', id);
  }
  for (const id of [...PREGNANCY_PAIN_TYPES, ...POSTPARTUM_PAIN_TYPES, ...PERI_PAIN]) mapped('pain', id);
  for (const opt of [...FLOW_OPTIONS, ...PREGNANCY_FLOW_OPTIONS]) mapped('flow', opt.id);
});

test('level tiles: 1-based position, one glyph per field, a readable opacity ramp', () => {
  assert.equal(levelOf(ENERGY_LEVELS, 'very_low'), 1);
  assert.equal(levelOf(ENERGY_LEVELS, 'normal'), 3);
  assert.equal(levelOf(ENERGY_LEVELS, 'very_high'), 5);
  assert.equal(levelOf(SLEEP_QUALITIES, 'good'), 3);
  assert.equal(levelOf(STRESS_LEVELS, 'low'), 1);
  assert.equal(levelOf(STRESS_LEVELS, 'nope'), null);
  assert.equal(levelOf(STRESS_LEVELS, null), null);
  for (const glyph of Object.values(LEVEL_FIELD_GLYPH)) assert.ok(glyphs.has(glyph));
  assert.equal(levelGlyphOpacity(1, 5), 0.45);
  assert.equal(levelGlyphOpacity(5, 5), 1);
  assert.equal(levelGlyphOpacity(2, 3), 0.73);
  assert.equal(levelGlyphOpacity(1, 1), 1);
});

test('lifestyle: six fields, one glyph each, „none“ counts from zero', () => {
  const EXERCISE = ['none', 'light', 'moderate', 'intense'];
  assert.deepEqual([...LIFESTYLE_FIELDS], ['energy', 'sleepQuality', 'stressLevel', 'exerciseLevel', 'caffeine', 'alcohol']);
  for (const field of LIFESTYLE_FIELDS) {
    assert.ok(glyphs.has(LEVEL_FIELD_GLYPH[field]), field);
    assert.equal(LEVEL_FIELD_GLYPH[field], cycleGlyphFor('lifestyle', field), `${field}: tile and day sheet share one glyph`);
  }
  assert.equal(new Set(LIFESTYLE_FIELDS.map((f) => LEVEL_FIELD_GLYPH[f])).size, 6, 'six different objects');
  assert.deepEqual(levelOnScale(EXERCISE, 'none'), { level: 0, max: 3 });
  assert.deepEqual(levelOnScale(EXERCISE, 'intense'), { level: 3, max: 3 });
  assert.deepEqual(levelOnScale(ENERGY_LEVELS, 'very_low'), { level: 1, max: 5 });
  assert.deepEqual(levelOnScale(SLEEP_QUALITIES, 'good'), { level: 3, max: 3 });
  assert.equal(levelOnScale(SLEEP_QUALITIES, 'nope'), null);
  assert.equal(levelOnScale(SLEEP_QUALITIES, null), null);
});
