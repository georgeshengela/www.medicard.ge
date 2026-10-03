import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_LOG_ORDER,
  FULL_LOG_TAB_OF,
  FULL_LOG_VISIBLE,
  SYMPTOM_GROUPS,
  activeTabForOffset,
  flowTiles,
  foldTiles,
  hasPrivateContent,
  moodTiles,
  mucusTiles,
  symptomTiles,
  tabHasContent,
} from './cycleFullLog.ts';
import { KNOWN_GLYPH_IDS, tileLabelFit } from './cycleIconMap.ts';
import { MOOD_OPTIONS, PHYSICAL_SYMPTOMS, SEXUAL_OPTIONS } from '../constants/cycle.ts';
import { PAIN_MANAGED_SYMPTOM_IDS } from './cycleObservationRegistry.ts';

test('group order follows the brief: bleeding, pain, mood, body, digestion, skin, energy, fertility, private, then the rest', () => {
  assert.deepEqual(
    [...FULL_LOG_ORDER],
    ['flow', 'pain', 'mood', 'physical', 'digestion', 'skin', 'energy', 'fertility', 'private', 'lifestyle', 'tags', 'journal'],
  );
  // Tabs are contiguous anchors into that order.
  const tabs = FULL_LOG_ORDER.map((g) => FULL_LOG_TAB_OF[g]);
  assert.deepEqual([...new Set(tabs)], ['flow', 'feel', 'more']);
  assert.deepEqual(tabs, [...tabs].sort((a, b) => ['flow', 'feel', 'more'].indexOf(a) - ['flow', 'feel', 'more'].indexOf(b)));
});

test('symptom groups are disjoint and together cover every symptom that is not a pain place', () => {
  const seen = new Map<string, string>();
  for (const group of SYMPTOM_GROUPS) {
    for (const tile of symptomTiles(group)) {
      assert.equal(seen.has(tile.id), false, `${tile.id} appears in ${seen.get(tile.id)} and ${group}`);
      seen.set(tile.id, group);
    }
  }
  const expected = PHYSICAL_SYMPTOMS.map((o) => o.id).filter((id) => !PAIN_MANAGED_SYMPTOM_IDS.has(id));
  assert.deepEqual([...seen.keys()].sort(), expected.sort());
  for (const id of PAIN_MANAGED_SYMPTOM_IDS) assert.equal(seen.has(id), false, `${id} is a pain place, not a tile`);
});

test('the brief’s counts: body 21, digestion 10, skin 5, energy 3, private 2; mood 18, bleeding 5, mucus 5', () => {
  assert.equal(symptomTiles('physical').length, 21);
  assert.equal(symptomTiles('digestion').length, 10);
  assert.equal(symptomTiles('skin').length, 5);
  assert.deepEqual(symptomTiles('energy').map((o) => o.id), ['fatigue', 'insomnia', 'oversleep']);
  assert.deepEqual(symptomTiles('private').map((o) => o.id), ['vaginal_dryness', 'itching_vulva']);
  assert.equal(moodTiles().length, 18);
  assert.equal(flowTiles().length, 5);
  assert.equal(mucusTiles().length, 5);
});

test('sex and sex drive are never tiles', () => {
  const sexIds = new Set(SEXUAL_OPTIONS.map((o) => o.id));
  for (const group of SYMPTOM_GROUPS) for (const tile of symptomTiles(group)) assert.equal(sexIds.has(tile.id), false, tile.id);
  for (const tile of moodTiles()) assert.equal(sexIds.has(tile.id), false, tile.id);
});

test('every tile has its own glyph', () => {
  for (const group of SYMPTOM_GROUPS) for (const tile of symptomTiles(group)) assert.ok(KNOWN_GLYPH_IDS.SYMPTOM[tile.id], `${tile.id} has no glyph`);
  for (const tile of moodTiles()) assert.ok(KNOWN_GLYPH_IDS.MOOD[tile.id], `${tile.id} has no glyph`);
  for (const tile of flowTiles()) assert.ok(KNOWN_GLYPH_IDS.FLOW[tile.id], `${tile.id} has no glyph`);
  for (const tile of mucusTiles()) assert.ok(KNOWN_GLYPH_IDS.MUCUS[tile.id], `${tile.id} has no glyph`);
  for (const id of ['cramps', 'pelvic', 'lower_back', 'headache', 'breast', 'ovulation_side', 'other']) assert.ok(KNOWN_GLYPH_IDS.PAIN[id], id);
});

test('tile labels never break mid-word: the font shrinks with the longest Georgian word, never below 7.5', () => {
  const short = tileLabelFit('აკნე', 70);
  assert.deepEqual(short, { fontSize: 10.5, lineHeight: 13, width: 76, maxWidth: 76, marginHorizontal: -3 });
  for (const opt of [...PHYSICAL_SYMPTOMS, ...MOOD_OPTIONS]) {
    const fit = tileLabelFit(opt.label, 70);
    const longest = Math.max(...opt.label.split(/\s+/).map((w) => w.length));
    // The widest measured Georgian word („დაღლილობა“) is 0.784 em per glyph.
    const perGlyph = 0.784 * fit.fontSize + (fit.letterSpacing ?? 0);
    assert.ok(fit.fontSize >= 7.5 && fit.fontSize <= 10.5, opt.label);
    assert.ok(fit.width <= 88 && fit.maxWidth === fit.width && Math.abs(fit.marginHorizontal * 2) === fit.width - 70, opt.label);
    assert.ok(longest * perGlyph <= fit.width + 0.5, `${opt.label} (${longest}) does not fit at ${fit.fontSize}`);
  }
  assert.equal(tileLabelFit('თავბრუსხვევა', 70).fontSize, 8.5);
  assert.equal(tileLabelFit('კონცენტრირებული', 70).fontSize, 7.5);
});

test('folding keeps the first four and every selected tile, and never folds a single tile away', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }));
  const none = foldTiles(items, FULL_LOG_VISIBLE, () => false);
  assert.deepEqual(none.shown.map((i) => i.id), ['s0', 's1', 's2', 's3']);
  assert.equal(none.hidden, 6);
  const picked = foldTiles(items, FULL_LOG_VISIBLE, (i) => i.id === 's7');
  assert.deepEqual(picked.shown.map((i) => i.id), ['s0', 's1', 's2', 's3', 's7']);
  assert.equal(picked.hidden, 5);
  const five = foldTiles(items.slice(0, 5), FULL_LOG_VISIBLE, () => false);
  assert.equal(five.hidden, 0);
  assert.equal(five.shown.length, 5);
  assert.equal(foldTiles(items.slice(0, 3), FULL_LOG_VISIBLE, () => false).hidden, 0);
});

test('the active jump tab is the last anchor scrolled past; the end of the list lights the last tab', () => {
  const anchors = { flow: 0, feel: 420, more: 1600 };
  assert.equal(activeTabForOffset(anchors, 0), 'flow');
  assert.equal(activeTabForOffset(anchors, 390), 'flow');
  assert.equal(activeTabForOffset(anchors, 400), 'feel');
  assert.equal(activeTabForOffset(anchors, 1590), 'more');
  assert.equal(activeTabForOffset({ flow: 0, feel: 420 }, 50, { endReached: true }), 'feel');
  assert.equal(activeTabForOffset({}, 999), 'flow');
});

test('tab dots: private symptoms count for „დეტალები“, not „შეგრძნება“; the lock row knows about stored private data', () => {
  const empty = {
    flow: null, symptoms: [], moods: [], painEntries: [], observationAssessments: {}, sexual: null, sexTags: [], notes: '', bbt: '', mucus: null,
    ovulationTest: null, pregnancyTest: null, sleepQuality: null, stressLevel: null, exerciseLevel: null, caffeine: null, alcohol: null, energy: null, customTagIds: [],
  };
  assert.equal(tabHasContent('flow', empty), false);
  assert.equal(tabHasContent('feel', empty), false);
  assert.equal(tabHasContent('more', empty), false);
  assert.equal(tabHasContent('flow', { ...empty, flow: 'light' }), true);
  assert.equal(tabHasContent('feel', { ...empty, symptoms: ['itching_vulva'] }), false);
  assert.equal(tabHasContent('more', { ...empty, symptoms: ['itching_vulva'] }), true);
  assert.equal(tabHasContent('feel', { ...empty, symptoms: ['bloating'] }), true);
  assert.equal(tabHasContent('more', { ...empty, sexual: false }), true);
  assert.equal(hasPrivateContent(empty), false);
  assert.equal(hasPrivateContent({ ...empty, sexual: false }), true);
  assert.equal(hasPrivateContent({ ...empty, symptoms: ['vaginal_dryness'] }), true);
  assert.equal(hasPrivateContent({ ...empty, symptoms: ['bloating'] }), false);
});
