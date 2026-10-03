import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREGNANCY_CHECKLIST } from '../constants/cycle.ts';
import {
  canonicalPregnancyChecklist,
  OBSERVATION_BAG_KEYS,
  PREGNANCY_CHECKLIST_IDS,
  pregnancyChecklistFrom,
  pregnancyChecklistPatch,
  togglePregnancyChecklist,
} from './cycleObservationRegistry.ts';
import { dayFactSections, privateFactCount } from './cycleDayFacts.ts';
import { cycleGlyphFor } from './cycleIconMap.ts';
import type { CycleLog } from './api.ts';
import { getObservationDef, parseObservationBag, PREGNANCY_CHECKLIST_IDS as SERVER_IDS } from '../../../server/src/lib/cycleObservationRegistry.js';
import { parseObservationWrite } from '../../../server/src/lib/cycleObservations.js';

/**
 * W2-12b — pregnancy checklist ticks are stored on the server in the day's `observations` bag
 * (`pregnancyChecklist`, a set of PREGNANCY_CHECKLIST ids). These pin the app side: the same ids as
 * the server, the form round trip (hydrate → toggle → save patch → server merge → hydrate), and the
 * day sheet facts.
 */

test('the app sends exactly the ids the server accepts, in the same order', () => {
  assert.deepEqual([...PREGNANCY_CHECKLIST_IDS], [...SERVER_IDS]);
  assert.deepEqual([...PREGNANCY_CHECKLIST_IDS], PREGNANCY_CHECKLIST.map((item) => item.id));
  const def = getObservationDef('pregnancyChecklist');
  assert.equal(OBSERVATION_BAG_KEYS.pregnancyChecklist.sensitivity, def.sensitivity);
  assert.equal(OBSERVATION_BAG_KEYS.pregnancyChecklist.ai, false);
  assert.equal(OBSERVATION_BAG_KEYS.pregnancyChecklist.partner, false);
  assert.equal(OBSERVATION_BAG_KEYS.pregnancyChecklist.analytics, false);
});

test('every checklist item has a label in both languages and a glyph', () => {
  for (const item of PREGNANCY_CHECKLIST) {
    assert.ok(item.label && item.label.trim(), item.id);
    assert.notEqual(cycleGlyphFor('checklist', item.id), 'pain', `${item.id} falls back to the pain glyph`);
  }
});

test('hydrate: nothing stored = untouched (null); stored ids come back canonical, unknown ids dropped', () => {
  assert.equal(pregnancyChecklistFrom(null), null);
  assert.equal(pregnancyChecklistFrom({}), null);
  assert.equal(pregnancyChecklistFrom({ pregnancyChecklist: [] }), null);
  assert.deepEqual(pregnancyChecklistFrom({ pregnancyChecklist: ['rest', 'nope', 'walk', 'rest'] }), ['walk', 'rest']);
  assert.deepEqual(canonicalPregnancyChecklist(['no_smoking', 7, 'prenatal_vitamin'] as unknown[]), ['prenatal_vitamin', 'no_smoking']);
});

test('toggle ticks and unticks in checklist order', () => {
  let ticks = togglePregnancyChecklist(null, 'walk');
  assert.deepEqual(ticks, ['walk']);
  ticks = togglePregnancyChecklist(ticks, 'prenatal_vitamin');
  assert.deepEqual(ticks, ['prenatal_vitamin', 'walk']);
  ticks = togglePregnancyChecklist(ticks, 'walk');
  assert.deepEqual(ticks, ['prenatal_vitamin']);
  assert.deepEqual(togglePregnancyChecklist(ticks, 'prenatal_vitamin'), []);
});

test('save patch: untouched sends nothing, emptied clears, ticks travel', () => {
  assert.deepEqual(pregnancyChecklistPatch(null), {});
  assert.deepEqual(pregnancyChecklistPatch(undefined), {});
  assert.deepEqual(pregnancyChecklistPatch([]), { pregnancyChecklist: null });
  assert.deepEqual(pregnancyChecklistPatch(['walk', 'folic_acid']), { pregnancyChecklist: ['folic_acid', 'walk'] });
});

test('round trip through the server merge: tick → save → reopen → untick all → save → reopen', () => {
  // Day already has energy; she ticks two items.
  let stored: Record<string, unknown> = { energy: 'low' };
  let form = pregnancyChecklistFrom(stored);
  assert.equal(form, null);
  form = togglePregnancyChecklist(togglePregnancyChecklist(form, 'water_2l'), 'doctor_appt');
  stored = parseObservationWrite({ observations: { energy: 'low', ...pregnancyChecklistPatch(form) } }, { observations: stored }).observations;
  assert.deepEqual(stored, { energy: 'low', pregnancyChecklist: ['water_2l', 'doctor_appt'] });
  assert.deepEqual(parseObservationBag(stored, { strict: true }), stored);

  // Reopen: the ticks are back. A save from a screen that did not touch them sends them unchanged.
  form = pregnancyChecklistFrom(stored);
  assert.deepEqual(form, ['water_2l', 'doctor_appt']);

  // A non-pregnancy save (nothing stored → null form) never names the key.
  assert.deepEqual(pregnancyChecklistPatch(pregnancyChecklistFrom({ energy: 'low' })), {});

  // Untick everything → cleared on the server → reopen shows nothing.
  form = togglePregnancyChecklist(togglePregnancyChecklist(form, 'water_2l'), 'doctor_appt');
  stored = parseObservationWrite({ observations: { energy: 'low', ...pregnancyChecklistPatch(form) } }, { observations: stored }).observations;
  assert.deepEqual(stored, { energy: 'low' });
  assert.equal(pregnancyChecklistFrom(stored), null);
});

const log: CycleLog = {
  id: 'l1',
  userId: 'u1',
  date: '2026-10-01',
  flow: null,
  symptoms: ['nausea'],
  moods: [],
  sexualActivity: null,
  libido: null,
  bbt: null,
  cervicalMucus: null,
  ovulationTest: null,
  pregnancyTest: null,
  notes: null,
  painEntries: [],
  sleepQuality: null,
  stressLevel: null,
  exerciseLevel: null,
  caffeine: null,
  alcohol: null,
  customTagIds: [],
  observations: { pregnancyChecklist: ['walk', 'prenatal_vitamin', 'mystery'] },
};

test('day sheet: ticks are fact tiles in their own section, last, never private', () => {
  const sections = dayFactSections(log);
  assert.deepEqual(sections.map((s) => s.id), ['symptoms', 'checklist']);
  const checklist = sections.find((s) => s.id === 'checklist')!;
  assert.deepEqual(checklist.tiles.map((t) => t.id), ['prenatal_vitamin', 'walk']);
  assert.ok(checklist.tiles.every((t) => t.kind === 'checklist' && t.group === 'neutral'));
  assert.equal(checklist.tiles[0].glyph, cycleGlyphFor('checklist', 'prenatal_vitamin'));
  assert.equal(privateFactCount(log), 0);
  assert.equal(dayFactSections({ ...log, observations: {} }).some((s) => s.id === 'checklist'), false);
});
