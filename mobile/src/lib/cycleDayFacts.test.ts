import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayFactSections, dayHasFacts, privateFactCount, publicSymptomIds, sameLogForm } from './cycleDayFacts.ts';
import type { CycleLog } from './api.ts';

const base: CycleLog = {
  id: 'l1',
  userId: 'u1',
  date: '2026-10-01',
  flow: 'medium',
  symptoms: ['bloating', 'cramps', 'vaginal_dryness', 'pain_sex', 'discharge'],
  moods: ['calm', 'irritable'],
  sexualActivity: true,
  libido: 2,
  bbt: 36.7,
  cervicalMucus: 'creamy',
  ovulationTest: 'positive',
  pregnancyTest: null,
  notes: 'secret',
  painEntries: [{ type: 'cramps', severity: 'severe' }, { type: 'headache', severity: 'mild' }],
  sleepQuality: 'okay',
  stressLevel: 'high',
  exerciseLevel: null,
  caffeine: null,
  alcohol: null,
  customTagIds: ['t1'],
  observations: { energy: 'low' },
};

test('facts become tiles in the quick-log order and private things never do', () => {
  const sections = dayFactSections(base);
  assert.deepEqual(
    sections.map((s) => s.id),
    ['bleeding', 'pain', 'mood', 'symptoms', 'lifestyle'],
  );
  const ids = sections.flatMap((s) => s.tiles.map((t) => t.id));
  for (const forbidden of ['vaginal_dryness', 'pain_sex', 'protected', 'unprotected', 'ovulationTest', 'bbt', 'creamy']) {
    assert.ok(!ids.includes(forbidden), `${forbidden} must not be a tile`);
  }
  // cramps is pain-managed: shown once as pain (with strength), not again as a symptom
  assert.deepEqual(sections.find((s) => s.id === 'symptoms')?.tiles.map((t) => t.id), ['bloating', 'discharge']);
  const pain = sections.find((s) => s.id === 'pain')!;
  assert.deepEqual(pain.tiles.map((t) => [t.id, t.level]), [['cramps', 3], ['headache', 1]]);
  assert.equal(pain.tiles[0].label, 'სპაზმები');
  const bleeding = sections.find((s) => s.id === 'bleeding')!;
  assert.equal(bleeding.tiles[0].group, 'bleeding');
  assert.equal(bleeding.tiles[0].glyph, 'drop');
});

test('fertility signs are tiles only where the mode shows fertility; otherwise they join the private line', () => {
  const hidden = dayFactSections(base);
  assert.ok(!hidden.some((s) => s.id === 'fertility'));
  const shown = dayFactSections(base, { showFertility: true });
  const fert = shown.find((s) => s.id === 'fertility')!;
  assert.deepEqual(fert.tiles.map((t) => t.id), ['creamy', 'ovulationTest', 'bbt']);
  assert.ok(fert.tiles.every((t) => t.group === 'fertility'));
  // sex (pain_sex is a sex tag) + libido + vaginal_dryness + notes + tags (+ mucus, OPK, BBT when fertility is hidden)
  assert.equal(privateFactCount(base, { showFertility: true }), 5);
  assert.equal(privateFactCount(base), 8);
});

test('lifestyle tiles carry the level as dots out of the field\'s own scale', () => {
  const life = dayFactSections(base).find((s) => s.id === 'lifestyle')!;
  const byId = Object.fromEntries(life.tiles.map((t) => [t.id, t]));
  assert.equal(byId.energy.level, 2);
  assert.equal(byId.energy.levelMax, 5);
  assert.equal(byId.sleepQuality.level, 2);
  assert.equal(byId.sleepQuality.levelMax, 3);
  assert.equal(byId.stressLevel.level, 3);
  assert.ok(byId.energy.label.includes('ენერგია'));
});

test('an empty day has nothing to show; a sex-only day shows only the private line', () => {
  assert.equal(dayHasFacts(null), false);
  assert.equal(dayHasFacts({ ...base, flow: null, symptoms: [], moods: [], sexualActivity: null, libido: null, bbt: null, cervicalMucus: null, ovulationTest: null, notes: null, painEntries: [], sleepQuality: null, stressLevel: null, customTagIds: [], observations: null }), false);
  const sexOnly: CycleLog = { ...base, flow: null, symptoms: ['protected'], moods: [], libido: null, bbt: null, cervicalMucus: null, ovulationTest: null, notes: null, painEntries: [], sleepQuality: null, stressLevel: null, customTagIds: [], observations: null };
  assert.deepEqual(dayFactSections(sexOnly), []);
  assert.equal(privateFactCount(sexOnly), 1);
  assert.equal(dayHasFacts(sexOnly), true);
  assert.deepEqual(publicSymptomIds(sexOnly), []);
});

test('sameLogForm ignores key order and treats missing as null', () => {
  assert.ok(sameLogForm({ a: [1, 2], b: null }, { b: null, a: [1, 2] }));
  assert.ok(!sameLogForm({ a: [1, 2] }, { a: [2, 1] }));
  assert.ok(!sameLogForm({ flow: 'light' }, { flow: null }));
});
