import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReminderOffsetsDays,
  normalizeReminderPatch,
  reminderPatchChangesCareRevision,
  sanitizeReminderTelemetry,
} from './petsReminders.js';

describe('pet reminder server contract', () => {
  it('does not bump care revision when reminder prefs change', () => {
    assert.equal(reminderPatchChangesCareRevision(), false);
    const patch = normalizeReminderPatch({ reminderEnabled: true, reminderOffsetsDays: [1, 0] });
    assert.equal(patch.reminderEnabled, true);
    assert.deepEqual(patch.reminderOffsetsDays, [1, 0]);
    assert.throws(() => normalizeReminderPatch({ reminderEnabled: true, startOn: '2026-09-20' }));
    assert.throws(() => normalizeReminderPatch({ reminderEnabled: true, timeMode: 'EXACT_TIME' }));
  });

  it('allowlists delivery telemetry and rejects notification copy', () => {
    const ok = sanitizeReminderTelemetry({
      occurrenceKey: 'r1|2026-09-20|date|0',
      alertKind: 'due',
      identity: 'pets:u:p:s:r1|2026-09-20|date|0:due',
      installId: 'inst_abc',
      status: 'SCHEDULED_LOCAL',
      fireAtMs: 1,
    });
    assert.equal(ok.status, 'SCHEDULED_LOCAL');
    assert.throws(() =>
      sanitizeReminderTelemetry({
        occurrenceKey: 'r1|2026-09-20|date|0',
        alertKind: 'due',
        identity: 'pets:u:p:s:r1|2026-09-20|date|0:due',
        installId: 'inst_abc',
        status: 'SCHEDULED_LOCAL',
        title: 'ნუკრი',
      }),
    );
    assert.throws(() =>
      sanitizeReminderTelemetry({
        occurrenceKey: 'r1|2026-09-20|date|0',
        alertKind: 'due',
        identity: 'pets:u:p:s:r1|2026-09-20|date|0:due',
        installId: 'inst_abc',
        status: 'SHOWN',
      }),
    );
  });

  it('keeps offset allowlist bounded', () => {
    assert.deepEqual(normalizeReminderOffsetsDays([3, 1, 0, 7]), [3, 1, 0]);
  });
});
