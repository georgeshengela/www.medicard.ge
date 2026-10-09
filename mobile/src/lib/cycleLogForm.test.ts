import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleLogBodyFromForm, EMPTY_CYCLE_LOG, formFromCycleLog, sexualActivityForSave } from './cycleLogForm.ts';
import type { CycleLog } from './api.ts';

const day = (patch: Partial<CycleLog>): CycleLog =>
  ({ date: '2026-10-05', flow: null, symptoms: [], moods: [], sexualActivity: null, libido: null, bbt: null, cervicalMucus: null, notes: null, ...patch }) as CycleLog;

test('CYC-11: an explicit „არ მქონია“ survives the next save of the day', () => {
  // Stored false still shows as unanswered (old rows defaulted to false)…
  const form = formFromCycleLog(day({ sexualActivity: false }));
  assert.equal(form.sexual, null);
  // …a later mood save sends it back as false, never null.
  const body = cycleLogBodyFromForm({ ...form, moods: ['calm'] });
  assert.equal(body.sexualActivity, false);
  assert.deepEqual(body.moods, ['calm']);
});

test('CYC-11: the ♥ one-tap undo on a „no“ day puts the „no“ back', () => {
  const before = formFromCycleLog(day({ sexualActivity: false }));
  assert.equal(cycleLogBodyFromForm({ ...before, sexual: true }).sexualActivity, true);
  assert.equal(cycleLogBodyFromForm(before).sexualActivity, false);
});

test('CYC-11: answers she gives always win; clearing a „yes“ still clears it', () => {
  assert.equal(sexualActivityForSave({ sexual: true, sexualStored: false }), true);
  assert.equal(sexualActivityForSave({ sexual: false, sexualStored: null }), false);
  assert.equal(sexualActivityForSave({ sexual: false, sexualStored: true }), false);
  // Un-ticking every activity chip on a stored „yes“ day → unanswered.
  assert.equal(sexualActivityForSave({ sexual: null, sexualStored: true }), null);
  const yes = formFromCycleLog(day({ sexualActivity: true, symptoms: ['protected'] }));
  assert.equal(yes.sexual, true);
  const cleared = cycleLogBodyFromForm({ ...yes, sexual: null, sexTags: [] });
  assert.equal(cleared.sexualActivity, null);
  assert.deepEqual(cleared.symptoms, []);
});

test('CYC-11: unanswered days and new days stay unanswered', () => {
  assert.equal(cycleLogBodyFromForm(formFromCycleLog(day({ sexualActivity: null }))).sexualActivity, null);
  assert.equal(cycleLogBodyFromForm({ ...EMPTY_CYCLE_LOG }).sexualActivity, null);
  assert.equal(cycleLogBodyFromForm(formFromCycleLog(undefined)).sexualActivity, null);
  // Older forms built without the hydrate field behave as before.
  const { sexualStored: _drop, ...legacy } = EMPTY_CYCLE_LOG;
  assert.equal(cycleLogBodyFromForm(legacy).sexualActivity, null);
});

test('the whole-day body keeps the rest of the day as before', () => {
  const form = formFromCycleLog(
    day({ flow: 'medium', symptoms: ['cramps', 'protected', 'high_drive'], sexualActivity: true, bbt: 36.55, notes: '  x  ' }),
  );
  const body = cycleLogBodyFromForm(form);
  assert.equal(body.flow, 'medium');
  assert.equal(body.bbt, 36.55);
  assert.equal(body.notes, 'x');
  assert.deepEqual(body.symptoms, ['cramps', 'protected', 'high_drive']);
  // Activity tags go only with a „yes“; the sex-drive answer stays.
  const no = cycleLogBodyFromForm({ ...form, sexual: false });
  assert.deepEqual(no.symptoms, ['cramps', 'high_drive']);
  assert.equal(no.sexualActivity, false);
});
