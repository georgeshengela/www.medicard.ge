const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const loader = require('./helpers/loadTs.cjs');

// Offline or on a 5xx, „წაშლა განრიგიდან“ swallowed the error (`.catch(() => undefined)`), went back
// to the list where the medication was still there, with no message — and its reminders kept firing.
const root = join(__dirname, '..');
const load = loader();
const { deleteMedication } = load('src/lib/medicationDelete.ts');
const plan = load('src/lib/notificationPlan.ts');

function effects(removeError) {
  const removed = [];
  const cancelled = [];
  return {
    removed,
    cancelled,
    deps: {
      remove: async (id) => {
        removed.push(id);
        if (removeError) throw removeError;
        return { deleted: true };
      },
      cancelReminders: async (prefix) => {
        cancelled.push(prefix);
      },
      fallbackMessage: 'სცადე ხელახლა.',
    },
  };
}

const apiError = (message, status) => Object.assign(new Error(message), { status });

test('a failed delete is reported and keeps every reminder', async () => {
  for (const error of [apiError('სერვერთან დაკავშირება ვერ მოხერხდა.', 0), apiError('', 503), apiError('ანგარიში შეიცვალა.', 401)]) {
    const fx = effects(error);
    const result = await deleteMedication('med-1', fx.deps);
    assert.equal(result.ok, false);
    assert.equal(result.message, error.message || 'სცადე ხელახლა.');
    assert.deepEqual(fx.cancelled, [], 'a medication that still exists keeps its reminders');
  }
});

test('a done delete removes that medication’s reminders at once, and only those', async () => {
  const fx = effects(null);
  const result = await deleteMedication('med-1', fx.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(fx.removed, ['med-1']);
  assert.deepEqual(fx.cancelled, ['med:med-1:']);

  const prefix = fx.cancelled[0];
  const own = [
    ...plan.planMedicationReminderSlots('med-1', '08:00'),
    ...plan.planMedicationReminderSlots('med-1', '20:00', [0, 3]),
  ].map((slot) => 'med:' + slot.identifier);
  assert.ok(own.length > 0 && own.every((id) => id.startsWith(prefix)), 'every reminder of the medication matches');
  const other = plan.planMedicationReminderSlots('med-10', '08:00').map((slot) => 'med:' + slot.identifier);
  assert.ok(other.every((id) => !id.startsWith(prefix)), 'another medication with a longer id is not touched');
});

test('a medication the server no longer has (404) counts as deleted', async () => {
  const fx = effects(apiError('მედიკამენტი ვერ მოიძებნა.', 404));
  const result = await deleteMedication('med-1', fx.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(fx.cancelled, ['med:med-1:']);
});

test('the dose screen shows the error and stays; it never swallows the delete', () => {
  const screen = readFileSync(join(root, 'src/components/medications/MedicationDoseScreen.tsx'), 'utf8');
  assert.doesNotMatch(screen, /medications\.remove\([^)]*\)\.catch\(/);
  assert.match(screen, /if \(!result\.ok\) \{\s*Alert\.alert\([^;]+result\.message\);\s*return;\s*\}/);
});
