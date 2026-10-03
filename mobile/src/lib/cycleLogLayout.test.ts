import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOG_LAYOUT,
  LAYOUT_GROUPS,
  canMoveLogGroup,
  fullLogSections,
  groupHasContent,
  isGroupVisible,
  logLayoutKey,
  minimalLogLayout,
  moveLogGroup,
  normalizeLogLayout,
  quickLogGroups,
  sameLayout,
  sectionGroups,
  setGroupVisible,
  type LogLayoutForm,
} from './cycleLogLayout.ts';

const EMPTY: LogLayoutForm = {
  flow: null,
  symptoms: [],
  moods: [],
  painEntries: [],
  sexual: null,
  sexTags: [],
  notes: '',
  bbt: '',
  mucus: null,
  ovulationTest: null,
  pregnancyTest: null,
  sleepQuality: null,
  stressLevel: null,
  exerciseLevel: null,
  caffeine: null,
  alcohol: null,
  energy: null,
  customTagIds: [],
};

test('bleeding is never part of the layout; the default shows everything in the full-log order', () => {
  assert.ok(!(LAYOUT_GROUPS as readonly string[]).includes('flow'));
  const sections = fullLogSections(DEFAULT_LOG_LAYOUT, EMPTY);
  assert.deepEqual(sections.flow, ['flow']);
  assert.deepEqual(sections.feel, ['pain', 'mood', 'physical', 'digestion', 'skin', 'energy']);
  assert.deepEqual(sections.more, ['fertility', 'private', 'lifestyle', 'tags', 'journal']);
  assert.deepEqual(quickLogGroups(DEFAULT_LOG_LAYOUT, EMPTY, { fertility: true }), ['private', 'pain', 'mood', 'symptoms', 'fertility']);
  assert.deepEqual(quickLogGroups(DEFAULT_LOG_LAYOUT, EMPTY, { fertility: false }), ['private', 'pain', 'mood', 'symptoms']);
});

test('minimal preset = bleeding, pain, mood', () => {
  const minimal = minimalLogLayout();
  const sections = fullLogSections(minimal, EMPTY);
  assert.deepEqual([...sections.flow, ...sections.feel, ...sections.more], ['flow', 'pain', 'mood']);
  assert.deepEqual(quickLogGroups(minimal, EMPTY, { fertility: true }), ['pain', 'mood']);
});

test('a hidden group with something logged today still shows, in its place', () => {
  const minimal = minimalLogLayout();
  const day = { ...EMPTY, notes: 'x', bbt: '36.50', symptoms: ['acne'], sexual: true };
  const sections = fullLogSections(minimal, day);
  assert.deepEqual(sections.feel, ['pain', 'mood', 'skin']);
  assert.deepEqual(sections.more, ['fertility', 'private', 'journal']);
  assert.deepEqual(quickLogGroups(minimal, day, { fertility: true }), ['private', 'pain', 'mood', 'symptoms', 'fertility']);
  assert.deepEqual(quickLogGroups(minimal, day, { fertility: false }), ['private', 'pain', 'mood', 'symptoms']);
});

test('the mode decides what exists: fertility signs only where the mode logs them', () => {
  const sections = fullLogSections(DEFAULT_LOG_LAYOUT, EMPTY, (g) => g !== 'fertility');
  assert.ok(!sections.more.includes('fertility'));
});

test('move stays inside its section; edges do nothing', () => {
  let layout = DEFAULT_LOG_LAYOUT;
  assert.equal(canMoveLogGroup(layout, 'pain', -1), false, 'pain is first in its section');
  assert.equal(canMoveLogGroup(layout, 'energy', 1), false, 'energy is last in შეგრძნება — never jumps to დეტალები');
  assert.equal(canMoveLogGroup(layout, 'fertility', -1), false);
  layout = moveLogGroup(layout, 'mood', -1);
  assert.deepEqual(sectionGroups(layout, 'feel').slice(0, 2), ['mood', 'pain']);
  layout = moveLogGroup(layout, 'journal', -1);
  assert.deepEqual(sectionGroups(layout, 'more'), ['fertility', 'private', 'lifestyle', 'journal', 'tags']);
  assert.equal(moveLogGroup(layout, 'energy', 1), layout);
  // The quick log follows the order: mood before pain now.
  assert.deepEqual(quickLogGroups(layout, EMPTY, { fertility: true }), ['private', 'mood', 'pain', 'symptoms', 'fertility']);
});

test('symptoms in the quick log follow the first visible symptom group', () => {
  let layout = DEFAULT_LOG_LAYOUT;
  layout = moveLogGroup(layout, 'physical', -1);
  layout = moveLogGroup(layout, 'physical', -1);
  assert.deepEqual(sectionGroups(layout, 'feel').slice(0, 3), ['physical', 'pain', 'mood']);
  assert.deepEqual(quickLogGroups(layout, EMPTY, { fertility: false }), ['private', 'symptoms', 'pain', 'mood']);
  for (const g of ['physical', 'digestion', 'skin', 'energy'] as const) layout = setGroupVisible(layout, g, false);
  assert.deepEqual(quickLogGroups(layout, EMPTY, { fertility: false }), ['private', 'pain', 'mood']);
});

test('switches', () => {
  let layout = setGroupVisible(DEFAULT_LOG_LAYOUT, 'private', false);
  assert.equal(isGroupVisible(layout, 'private'), false);
  assert.deepEqual(quickLogGroups(layout, EMPTY, { fertility: false }), ['pain', 'mood', 'symptoms']);
  layout = setGroupVisible(layout, 'private', true);
  assert.ok(sameLayout(layout, DEFAULT_LOG_LAYOUT));
});

test('normalize: junk, duplicates, unknown ids, missing groups and cross-section orders are repaired', () => {
  assert.deepEqual(normalizeLogLayout(null), DEFAULT_LOG_LAYOUT);
  assert.deepEqual(normalizeLogLayout('x'), DEFAULT_LOG_LAYOUT);
  const fixed = normalizeLogLayout({ order: ['journal', 'flow', 'mood', 'mood', 'zzz', 'pain'], hidden: ['flow', 'skin', 'skin', 7] });
  // journal (დეტალები) can never sit above შეგრძნება; missing groups slot in right after their default predecessor.
  assert.deepEqual(sectionGroups(fixed, 'feel'), ['mood', 'physical', 'digestion', 'skin', 'energy', 'pain']);
  assert.deepEqual(sectionGroups(fixed, 'more'), ['journal', 'fertility', 'private', 'lifestyle', 'tags']);
  assert.deepEqual(fixed.hidden, ['skin']);
  assert.equal(fixed.order.length, LAYOUT_GROUPS.length);
});

test('content detection per group', () => {
  assert.equal(groupHasContent('pain', { ...EMPTY, painEntries: [{}] }), true);
  assert.equal(groupHasContent('digestion', { ...EMPTY, symptoms: ['acne'] }), false);
  assert.equal(groupHasContent('skin', { ...EMPTY, symptoms: ['acne'] }), true);
  assert.equal(groupHasContent('private', { ...EMPTY, symptoms: ['vaginal_dryness'] }), true);
  assert.equal(groupHasContent('lifestyle', { ...EMPTY, caffeine: 'none' }), true);
  assert.equal(groupHasContent('fertility', { ...EMPTY, bbt: ' ' }), false);
  assert.equal(groupHasContent('tags', { ...EMPTY, customTagIds: ['t'] }), true);
  assert.equal(groupHasContent('journal', { ...EMPTY, notes: '  ' }), false);
});

test('storage key is per account', () => {
  assert.equal(logLayoutKey('u1'), 'medicard.cycle.logLayout.v1:u1');
  assert.notEqual(logLayoutKey('u1'), logLayoutKey('u2'));
  assert.equal(logLayoutKey(null), 'medicard.cycle.logLayout.v1:anon');
});
