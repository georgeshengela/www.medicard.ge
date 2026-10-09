import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { medicationSetupRoute, medicationToSetUp } from './medicationSetup.ts';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (file: string) => readFileSync(join(mobile, file), 'utf8');

test('the medicine named in the onboarding medication goal waits on Home until it is set up', () => {
  const base = { primaryGoal: 'medications', typed: ['Metformin'], tracked: [] };
  assert.equal(medicationToSetUp(base), 'Metformin');
  // Set up in MEDIPILL (same name, any case, with a strength, or paused): nothing left to lead to.
  assert.equal(medicationToSetUp({ ...base, tracked: [{ medName: 'metformin' }] }), null);
  assert.equal(medicationToSetUp({ ...base, tracked: [{ medName: 'Metformin 500 მგ' }] }), null);
  // Added from the catalogue under its brand: the generic name matches.
  assert.equal(medicationToSetUp({ ...base, tracked: [{ medName: 'Glucophage', config: { genericName: 'Metformin' } }] }), null);
  assert.equal(medicationToSetUp({ ...base, tracked: [{ medName: 'Glucophage', config: { genericName: 42 } }] }), 'Metformin');
  // Two typed: the second one is next once the first is tracked.
  assert.equal(medicationToSetUp({ ...base, typed: ['Metformin', 'ასპირინი'], tracked: [{ medName: 'Metformin' }] }), 'ასპირინი');
  assert.equal(medicationToSetUp({ ...base, typed: ['  Metformin  '] }), 'Metformin');
});

test('only for the medication goal, and never from an empty answer', () => {
  for (const primaryGoal of ['general', 'nutrition', 'cycle', null, undefined]) {
    assert.equal(medicationToSetUp({ primaryGoal, typed: ['Metformin'], tracked: [] }), null);
  }
  assert.equal(medicationToSetUp({ primaryGoal: 'medications', typed: [], tracked: [] }), null);
  assert.equal(medicationToSetUp({ primaryGoal: 'medications', typed: null, tracked: [] }), null);
  assert.equal(medicationToSetUp({ primaryGoal: 'medications', typed: [' ', 'a'], tracked: [] }), null);
});

test('the card opens the normal MEDIPILL setup with the name filled in — no dose or time is made up', () => {
  assert.deepEqual(medicationSetupRoute('Metformin'), { pathname: '/medications/add/setup', params: { name: 'Metformin' } });
  const section = read('src/components/home/HomeNextDoseSection.tsx');
  assert.doesNotMatch(section, /if \(cards\.length === 0\) return null;/);
  assert.match(section, /if \(cards\.length === 0 && !setupName\) return null;/);
  assert.match(section, /router\.push\(medicationSetupRoute\(name\)\)/);
  const home = read('app/(tabs)/home.tsx');
  // Only once the list really loaded (an empty list while loading or after a failed read is not „none“).
  assert.match(home, /const setupName = meds\.loaded\s*\?\s*medicationToSetUp\(/);
  assert.match(home, /<HomeNextDoseSection meds=\{meds\} setupName=\{setupName\} \/>/);
  // Onboarding itself creates no medication (no invented dose or time) and schedules nothing.
  assert.doesNotMatch(read('src/lib/onboardingGoals.ts'), /medications\.create|syncMedicationReminders/);
});
