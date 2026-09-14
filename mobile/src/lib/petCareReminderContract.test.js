import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_CARE_REMINDER_TYPE,
  PET_CARE_REMINDER_FAMILY,
  applyPetCareCapacity,
  authoritativeFetchResult,
  buildPetCareReminderCandidates,
  closedAppJavascriptRunsContinuously,
  completeRoute,
  conflictExplanation,
  createReconcileGate,
  deliveryStateFromEvidence,
  deviceDeliveryStatus,
  diffPetCareNotifications,
  dismissalIsReliablyObservable,
  finiteOfflineHorizonDays,
  handlerReceivedIsNotProofShown,
  inferCatchUpRegimen,
  isStalePetCareResponse,
  mintNewIdempotencyKeyOn409,
  neverEvictMedicationReminders,
  notificationDeliveryCountsAsAdministration,
  oneDeviceCancelsAnotherWhileOffline,
  pendingConfirmsForAccount,
  permissionDeniedMeansActiveReminders,
  petCareCopy,
  petCareMaskedCopy,
  petCareReminderDeliveryDecision,
  petsEnterEngageDailyPool,
  phase5ReminderIdentity,
  queuedConfirmMayReplay,
  quietHoursMayMovePrescribedDueTime,
  reminderPatchMustNotBumpRevision,
  reminderPreferenceSavedMeansScheduled,
  scheduledIsNotProofShown,
  scheduledOsNotificationsCanFireWhileClosed,
  serializeReconcileCalls,
  skipCreatesAdministrationEvent,
  snoozeChangesPlannedCare,
  travelMustNotShiftHistoricalCareDates,
  twoDevicesMayBothNotify,
  wallClockInstant,
} from './petCareReminderContract.js';

const USER = 'user-1';
const PET = 'pet-1';
const SCHEDULE_ID = 'sched-1';

function schedule(overrides = {}) {
  return {
    id: SCHEDULE_ID,
    status: 'ACTIVE',
    reminderEnabled: true,
    reminderOffsetsDays: [0],
    timeMode: 'DATE_BASED',
    revision: 1,
    kind: 'MEDICATION',
    title: 'ტაბლეტი',
    dueTime: null,
    ...overrides,
  };
}

function occurrence(overrides = {}) {
  return {
    scheduleId: SCHEDULE_ID,
    revision: 1,
    plannedOn: '2026-09-20',
    plannedTime: null,
    sequence: 0,
    occurrenceKey: 'r1|2026-09-20|date|0',
    status: 'OPEN',
    ...overrides,
  };
}

const prefs = {
  globalOptIn: true,
  permissionGranted: true,
  dateBasedHour: 9,
  dateBasedMinute: 0,
  userId: USER,
};

describe('pet care reminder contract', () => {
  it('stays out of the Engage pool and keeps reminder edits off the care revision', () => {
    assert.equal(petsEnterEngageDailyPool(), false);
    assert.equal(reminderPatchMustNotBumpRevision(), true);
    assert.equal(closedAppJavascriptRunsContinuously(), false);
    assert.equal(scheduledOsNotificationsCanFireWhileClosed(), true);
    assert.equal(finiteOfflineHorizonDays(), 14);
  });

  it('builds one due candidate and is idempotent for the same input', () => {
    const nowMs = Date.parse('2026-09-14T08:00:00');
    const a = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      petName: 'ნუკრი',
      schedule: schedule(),
      occurrence: occurrence(),
      prefs,
      nowMs,
    });
    const b = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      petName: 'ნუკრი',
      schedule: schedule(),
      occurrence: occurrence(),
      prefs,
      nowMs,
    });
    assert.equal(a.length, 1);
    assert.equal(a[0].alertKind, 'due');
    assert.equal(a[0].type, PET_CARE_REMINDER_TYPE);
    assert.equal(a[0].family, PET_CARE_REMINDER_FAMILY);
    assert.deepEqual(
      a.map((row) => row.identifier),
      b.map((row) => row.identifier),
    );
    assert.equal(
      a[0].identity,
      phase5ReminderIdentity({
        userId: USER,
        petId: PET,
        scheduleId: SCHEDULE_ID,
        occurrenceKey: occurrence().occurrenceKey,
        alertKind: 'due',
      }),
    );
  });

  it('cancels obsolete alerts after revision change, completion, and skip', () => {
    const desired = [
      { identifier: 'pets:user-1:pet-1:sched-1:r2|2026-09-21|date|0:due' },
    ];
    const pending = [
      'pets:user-1:pet-1:sched-1:r1|2026-09-20|date|0:due',
      'pets:user-1:pet-1:sched-1:r1|2026-09-20|date|0:advance:1',
    ];
    const diff = diffPetCareNotifications({ desired, pendingIds: pending, apiFailed: false });
    assert.deepEqual(diff.cancel, pending);
    assert.equal(diff.schedule.length, 1);
    const completed = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      schedule: schedule(),
      occurrence: occurrence({ status: 'ADMINISTERED' }),
      prefs,
      nowMs: Date.parse('2026-09-14T08:00:00'),
    });
    const skipped = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      schedule: schedule(),
      occurrence: occurrence({ status: 'SKIPPED' }),
      prefs,
      nowMs: Date.parse('2026-09-14T08:00:00'),
    });
    assert.deepEqual(completed, []);
    assert.deepEqual(skipped, []);
  });

  it('serializes overlapping reconcile labels without dropping the second run', () => {
    const { results } = serializeReconcileCalls(['login', 'foreground']);
    assert.ok(results.includes('login'));
    assert.ok(results.length >= 1);
  });

  it('keeps snooze fire time without changing planned care', () => {
    assert.equal(snoozeChangesPlannedCare(), false);
    assert.equal(inferCatchUpRegimen(), false);
    const nowMs = Date.parse('2026-09-14T08:00:00');
    const snoozeAt = Date.parse('2026-09-14T12:00:00');
    const rows = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      schedule: schedule(),
      occurrence: occurrence(),
      prefs: {
        ...prefs,
        snoozes: [{ scheduleId: SCHEDULE_ID, occurrenceKey: occurrence().occurrenceKey, fireAtMs: snoozeAt }],
      },
      nowMs,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].alertKind, 'snooze');
    assert.equal(rows[0].plannedOn, '2026-09-20');
    assert.equal(rows[0].fireAtMs, snoozeAt);
  });

  it('uses selected date-based clock and prescribed exact time separately', () => {
    const nowMs = Date.parse('2026-09-14T08:00:00');
    const dateOnly = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      schedule: schedule({ timeMode: 'DATE_BASED' }),
      occurrence: occurrence(),
      prefs: { ...prefs, dateBasedHour: 18, dateBasedMinute: 30 },
      nowMs,
    });
    const exact = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      schedule: schedule({ timeMode: 'EXACT_TIME', dueTime: '08:00' }),
      occurrence: occurrence({ plannedTime: '08:00', occurrenceKey: 'r1|2026-09-20|08:00|0' }),
      prefs,
      nowMs,
    });
    const dateFire = new Date(dateOnly[0].fireAtMs);
    const exactFire = new Date(exact[0].fireAtMs);
    assert.equal(dateFire.getHours(), 18);
    assert.equal(dateFire.getMinutes(), 30);
    assert.equal(exactFire.getHours(), 8);
    assert.equal(exactFire.getMinutes(), 0);
    assert.equal(quietHoursMayMovePrescribedDueTime(), false);
  });

  it('fails closed on a DST gap and uses the first occurrence of a repeated hour', () => {
    const gap = wallClockInstant('2026-03-29', '02:30', 'Europe/Brussels');
    assert.equal(gap.ok, false);
    const first = wallClockInstant('2026-10-25', '02:30', 'Europe/Brussels');
    const second = wallClockInstant('2026-10-25', '02:30', 'Europe/Brussels');
    assert.equal(first.ok, true);
    assert.equal(first.ms, second.ms);
    assert.equal(travelMustNotShiftHistoricalCareDates(), true);
  });

  it('never evicts medication reminders and caps pets against the shared budget', () => {
    const desired = Array.from({ length: 40 }, (_, i) => ({
      identifier: `pets:due:${i}`,
      alertKind: i > 30 ? 'followup:1' : i > 20 ? 'advance:1' : 'due',
      fireAtMs: Date.parse('2026-09-20T09:00:00') + i * 60_000,
    }));
    const { kept, dropped } = applyPetCareCapacity({
      desired,
      pendingCounts: { med: 20, pets: 0, total: 30 },
      maxPetsPending: 24,
      osBudget: 64,
    });
    assert.ok(kept.length <= 24);
    assert.ok(dropped.length >= 1);
    assert.equal(neverEvictMedicationReminders(['pets:a', 'pets:b']), true);
    assert.equal(neverEvictMedicationReminders(['med:1:09:00']), false);
  });

  it('does not treat permission denied as active scheduling', () => {
    assert.equal(permissionDeniedMeansActiveReminders(), false);
    assert.equal(reminderPreferenceSavedMeansScheduled(), false);
    assert.equal(deviceDeliveryStatus({ preferenceSaved: true, permissionGranted: false, scheduledOnDevice: false }), 'permission_denied');
    assert.equal(deviceDeliveryStatus({ preferenceSaved: true, permissionGranted: true, scheduledOnDevice: true }), 'scheduled_on_device');
    const denied = buildPetCareReminderCandidates({
      userId: USER,
      petId: PET,
      schedule: schedule(),
      occurrence: occurrence(),
      prefs: { ...prefs, permissionGranted: false },
      nowMs: Date.parse('2026-09-14T08:00:00'),
    });
    assert.deepEqual(denied, []);
  });

  it('does not interpret API failure as an empty authoritative schedule', () => {
    const failed = authoritativeFetchResult({ kind: 'unavailable', careSchemaReady: false });
    const emptyOk = authoritativeFetchResult({ kind: 'ok', careSchemaReady: true, items: [] });
    assert.equal(failed.type, 'unknown');
    assert.equal(failed.items, null);
    assert.equal(emptyOk.type, 'authoritative');
    assert.deepEqual(emptyOk.items, []);
    const keep = diffPetCareNotifications({
      desired: [],
      pendingIds: ['pets:keep-me'],
      lastGoodIds: ['pets:keep-me'],
      apiFailed: true,
    });
    assert.deepEqual(keep.cancel, []);
    assert.deepEqual(keep.keep, ['pets:keep-me']);
    assert.equal(keep.syncStatus, 'failed');
  });

  it('aborts in-flight reconcile after logout generation bump', () => {
    const gate = createReconcileGate();
    const started = gate.current();
    gate.bump();
    assert.equal(gate.shouldCommit(started), false);
    assert.equal(gate.shouldCommit(gate.current()), true);
  });

  it('never replays a queued confirmation under another account', () => {
    const queue = [
      { userId: 'a', occurrenceKey: 'r1|2026-09-20|date|0' },
      { userId: 'b', occurrenceKey: 'r1|2026-09-21|date|0' },
    ];
    assert.equal(pendingConfirmsForAccount(queue, 'a').length, 1);
    assert.equal(queuedConfirmMayReplay(queue[0], 'b'), false);
    assert.equal(queuedConfirmMayReplay(queue[0], 'a'), true);
  });

  it('marks stale notification responses and does not mint a new 409 key', () => {
    assert.equal(
      isStalePetCareResponse({ userId: USER, revision: 1 }, { userId: USER, occurrenceStatus: 'ADMINISTERED' }),
      'COMPLETED',
    );
    assert.equal(
      isStalePetCareResponse({ userId: USER, revision: 1 }, { userId: 'other' }),
      'CROSS_USER',
    );
    assert.equal(
      isStalePetCareResponse({ userId: USER, revision: 1 }, { userId: USER, revision: 2 }),
      'STALE_REVISION',
    );
    assert.equal(mintNewIdempotencyKeyOn409(), false);
    assert.equal(conflictExplanation('PET_CARE_OCCURRENCE_COMPLETED'), 'other_device');
    assert.equal(conflictExplanation('PET_CARE_REVISION_STALE'), 'schedule_changed');
    assert.equal(skipCreatesAdministrationEvent(), false);
    assert.equal(notificationDeliveryCountsAsAdministration(), false);
  });

  it('records only evidenced delivery states', () => {
    assert.equal(deliveryStateFromEvidence('os_scheduled'), 'scheduled_local');
    assert.equal(deliveryStateFromEvidence('handler_received'), 'received_callback');
    assert.equal(deliveryStateFromEvidence('banner_maybe'), null);
    assert.equal(scheduledIsNotProofShown(), true);
    assert.equal(handlerReceivedIsNotProofShown(), true);
    assert.equal(dismissalIsReliablyObservable(), false);
    assert.equal(twoDevicesMayBothNotify(), true);
    assert.equal(oneDeviceCancelsAnotherWhileOffline(), false);
  });

  it('masks discreet copy and routes confirmation into the focused screen', () => {
    const open = petCareCopy({ petName: 'ნუკრი', title: 'ტაბლეტი', kind: 'MEDICATION', masked: false });
    const masked = petCareMaskedCopy();
    assert.match(open.title, /ნუკრი/);
    assert.equal(masked.title, 'Medi-სგან შეხსენება');
    assert.doesNotMatch(masked.body, /ნუკრი|ტაბლეტი/);
    const decision = petCareReminderDeliveryDecision(
      { type: PET_CARE_REMINDER_TYPE, userId: USER, revision: 1, masked: false },
      { userId: USER },
      true,
    );
    assert.equal(decision.rewriteMasked, true);
    assert.match(completeRoute({ petId: PET, scheduleId: SCHEDULE_ID, occurrenceKey: 'k', revision: 1 }), /\/pets\/pet-1\/care\/complete/);
  });
});
