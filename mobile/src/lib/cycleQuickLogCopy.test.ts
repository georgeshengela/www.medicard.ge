import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFromYesterday, formIsEmpty, hasCopyableContent, nextPainSeverity, painLevel } from './cycleQuickLogCopy.ts';

const yesterday = {
  flow: 'medium',
  symptoms: ['bloating', 'discharge', 'vaginal_dryness', 'fatigue', 'pain_sex'],
  moods: ['calm', 'tired_mood'],
  painEntries: [{ type: 'cramps', severity: 'moderate' } as const, { type: 'lower_back', severity: 'mild' } as const],
  sleepQuality: 'okay',
  stressLevel: 'high',
  exerciseLevel: null,
  caffeine: 'low',
  alcohol: null,
  energy: 'low',
};

test('same as yesterday copies the everyday fields and never the private ones', () => {
  const patch = copyFromYesterday(yesterday);
  assert.equal(patch.flow, 'medium');
  assert.deepEqual(patch.symptoms, ['bloating', 'fatigue']);
  assert.deepEqual(patch.moods, ['calm', 'tired_mood']);
  assert.deepEqual(patch.painEntries, [{ type: 'cramps', severity: 'moderate' }, { type: 'lower_back', severity: 'mild' }]);
  assert.equal(patch.sleepQuality, 'okay');
  assert.equal(patch.energy, 'low');
  assert.ok(!('sexual' in patch) && !('bbt' in patch) && !('mucus' in patch) && !('ovulationTest' in patch) && !('notes' in patch));
});

test('a logged „არა“ bleeding is not copied; empty days have nothing to offer', () => {
  assert.equal(copyFromYesterday({ ...yesterday, flow: 'none' }).flow, null);
  assert.equal(hasCopyableContent(yesterday), true);
  assert.equal(hasCopyableContent({ ...yesterday, flow: 'none', symptoms: ['discharge'], moods: [], painEntries: [] }), false);
});

test('the chip only fills an empty form', () => {
  const empty = { flow: null, symptoms: [], moods: [], painEntries: [], sleepQuality: null, stressLevel: null, exerciseLevel: null, caffeine: null, alcohol: null, energy: null, sexual: null, notes: '' };
  assert.equal(formIsEmpty(empty), true);
  assert.equal(formIsEmpty({ ...empty, moods: ['calm'] }), false);
  assert.equal(formIsEmpty({ ...empty, sexual: true }), false);
  assert.equal(formIsEmpty({ ...empty, notes: ' x ' }), false);
});

test('pain strength cycles moderate → severe → mild → off', () => {
  assert.equal(nextPainSeverity(null), 'moderate');
  assert.equal(nextPainSeverity('moderate'), 'severe');
  assert.equal(nextPainSeverity('severe'), 'mild');
  assert.equal(nextPainSeverity('mild'), null);
  assert.equal(painLevel('mild'), 1);
  assert.equal(painLevel('severe'), 3);
  assert.equal(painLevel(null), null);
});
