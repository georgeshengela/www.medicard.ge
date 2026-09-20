/**
 * Phase 5 — local pet care reminders.
 * Meaning: USER_SCHEDULED_CARE. Never Engage daily pool. Never SPECIES_DUE_ITEM.
 * OS can fire already-scheduled notifications while the app is closed.
 * JavaScript does not run continuously; horizon is finite and replenished on lifecycle events.
 */

export const PET_CARE_REMINDER_TYPE = 'pet_care';
export const PET_CARE_REMINDER_FAMILY = 'petCareReminder';
export const PET_CARE_REMINDER_MEANING = 'USER_SCHEDULED_CARE';
export const PET_CARE_REMINDER_PREFIX = 'pets:';
export const PET_CARE_REMINDER_TEMPLATE = 'pet-care';
export const PET_CARE_REMINDER_MASKED_TEMPLATE = 'pet-care-masked';
export const PET_CARE_REMINDER_HORIZON_DAYS = 14;
export const PET_CARE_MAX_PENDING = 24;
export const PET_CARE_OS_BUDGET = 64;
export const PET_CARE_MAX_FOLLOWUPS = 1;
export const PET_CARE_DEFAULT_HOUR = 9;
export const PET_CARE_DEFAULT_MINUTE = 0;
export const PET_CARE_SNOOZE_MINUTES = Object.freeze([10, 20, 60]);
export const PET_CARE_DEFAULT_SNOOZE_MINUTES = 20;
export const PET_CARE_REMINDER_OFFSETS = Object.freeze([0, 1, 3]);

export const PET_CARE_DELIVERY_STATE = Object.freeze({
  SCHEDULED_LOCAL: 'scheduled_local',
  SCHEDULE_FAILED: 'schedule_failed',
  CANCELLED: 'cancelled',
  RECEIVED_CALLBACK: 'received_callback',
  USER_RESPONSE: 'user_response',
  COMPLETION_CONFIRMED: 'completion_confirmed',
});

export const PET_CARE_REMINDER_SUPPRESSION = Object.freeze({
  USER_DISABLED: 'USER_DISABLED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_OPTED_IN: 'NOT_OPTED_IN',
  SCHEDULE_DISABLED: 'SCHEDULE_DISABLED',
  SCHEDULE_INACTIVE: 'SCHEDULE_INACTIVE',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  CANCELLED: 'CANCELLED',
  STALE_REVISION: 'STALE_REVISION',
  PAST_DATE: 'PAST_DATE',
  LATE_CATCH_UP: 'LATE_CATCH_UP',
  CROSS_USER: 'CROSS_USER',
  ARCHIVED: 'ARCHIVED',
  NONEXISTENT_LOCAL_TIME: 'NONEXISTENT_LOCAL_TIME',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  API_UNKNOWN: 'API_UNKNOWN',
  CAPACITY: 'CAPACITY',
});

export function isCivilDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function isClockTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

export function addDaysCivil(key, days) {
  if (!isCivilDateKey(key) || !Number.isInteger(Number(days))) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function parseClockTime(clock) {
  if (!isClockTime(clock)) return null;
  const [hour, minute] = clock.split(':').map(Number);
  return { hour, minute };
}

export function phase5ReminderIdentity({ userId, petId, scheduleId, occurrenceKey, alertKind = 'due' }) {
  return `pets:${userId}:${petId}:${scheduleId}:${occurrenceKey}:${alertKind}`;
}

export function petCareNotificationIdentifier(identity) {
  return String(identity || '').startsWith(PET_CARE_REMINDER_PREFIX) ? String(identity) : `${PET_CARE_REMINDER_PREFIX}${identity}`;
}

export function parsePetCareIdentity(identity) {
  const raw = String(identity || '');
  const match = /^pets:([^:]+):([^:]+):([^:]+):(r\d+\|\d{4}-\d{2}-\d{2}\|[^|]+\|\d+):(.+)$/.exec(raw);
  if (!match) return null;
  return {
    userId: match[1],
    petId: match[2],
    scheduleId: match[3],
    occurrenceKey: match[4],
    alertKind: match[5],
  };
}

export function reminderPatchMustNotBumpRevision() {
  return true;
}

export function petsEnterEngageDailyPool() {
  return false;
}

export function closedAppJavascriptRunsContinuously() {
  return false;
}

export function scheduledOsNotificationsCanFireWhileClosed() {
  return true;
}

export function finiteOfflineHorizonDays() {
  return PET_CARE_REMINDER_HORIZON_DAYS;
}

export function normalizeSnoozeMinutes(value) {
  const n = Number(value);
  return PET_CARE_SNOOZE_MINUTES.includes(n) ? n : PET_CARE_DEFAULT_SNOOZE_MINUTES;
}

export function normalizeOffsets(value) {
  const raw = Array.isArray(value) ? value : [0];
  const unique = [...new Set(raw.map((row) => Number(row)))].filter((n) => PET_CARE_REMINDER_OFFSETS.includes(n));
  return unique.length ? unique.sort((a, b) => b - a) : [0];
}

export function dateBasedReminderClock(prefs) {
  const hour = Number(prefs?.dateBasedHour);
  const minute = Number(prefs?.dateBasedMinute);
  if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59) {
    return { hour, minute };
  }
  return { hour: PET_CARE_DEFAULT_HOUR, minute: PET_CARE_DEFAULT_MINUTE };
}

function wallParts(ms, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour) % 24,
    min: Number(map.minute),
  };
}

/**
 * Civil date + HH:mm as a local wall-clock instant.
 * Device path omits timeZone (runtime local Date).
 * DST gap: fail closed. DST overlap: first occurrence only — never two alerts for one intended fire.
 */
export function wallClockInstant(civilDate, clock, timeZone) {
  if (!isCivilDateKey(civilDate) || !isClockTime(clock)) {
    return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE };
  }
  const parsed = parseClockTime(clock);
  const [y, mo, d] = civilDate.split('-').map(Number);
  if (!timeZone) {
    const dt = new Date(y, mo - 1, d, parsed.hour, parsed.minute, 0, 0);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== d ||
      dt.getHours() !== parsed.hour ||
      dt.getMinutes() !== parsed.minute
    ) {
      return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NONEXISTENT_LOCAL_TIME };
    }
    return { ok: true, ms: dt.getTime(), date: dt };
  }
  const want = { y, m: mo, d, h: parsed.hour, min: parsed.minute };
  let instant = Date.UTC(y, mo - 1, d, parsed.hour, parsed.minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const got = wallParts(instant, timeZone);
    const gotUtc = Date.UTC(got.y, got.m - 1, got.d, got.h, got.min);
    const wantUtc = Date.UTC(want.y, want.m - 1, want.d, want.h, want.min);
    instant += wantUtc - gotUtc;
  }
  const got = wallParts(instant, timeZone);
  if (got.y !== want.y || got.m !== want.m || got.d !== want.d || got.h !== want.h || got.min !== want.min) {
    return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NONEXISTENT_LOCAL_TIME };
  }
  const earlier = instant - 60 * 60 * 1000;
  const earlierParts = wallParts(earlier, timeZone);
  if (
    earlierParts.y === want.y &&
    earlierParts.m === want.m &&
    earlierParts.d === want.d &&
    earlierParts.h === want.h &&
    earlierParts.min === want.min
  ) {
    return { ok: true, ms: earlier, date: new Date(earlier) };
  }
  return { ok: true, ms: instant, date: new Date(instant) };
}

export function travelMustNotShiftHistoricalCareDates() {
  return true;
}

export function snoozeChangesPlannedCare() {
  return false;
}

export function inferCatchUpRegimen() {
  return false;
}

export function quietHoursMayMovePrescribedDueTime() {
  return false;
}

export function notificationDeliveryCountsAsAdministration() {
  return false;
}

export function deliveryStateFromEvidence(kind) {
  if (kind === 'os_scheduled') return PET_CARE_DELIVERY_STATE.SCHEDULED_LOCAL;
  if (kind === 'schedule_error') return PET_CARE_DELIVERY_STATE.SCHEDULE_FAILED;
  if (kind === 'cancelled') return PET_CARE_DELIVERY_STATE.CANCELLED;
  if (kind === 'handler_received') return PET_CARE_DELIVERY_STATE.RECEIVED_CALLBACK;
  if (kind === 'user_action') return PET_CARE_DELIVERY_STATE.USER_RESPONSE;
  if (kind === 'server_complete') return PET_CARE_DELIVERY_STATE.COMPLETION_CONFIRMED;
  return null;
}

export function scheduledIsNotProofShown() {
  return true;
}

export function handlerReceivedIsNotProofShown() {
  return true;
}

export function dismissalIsReliablyObservable() {
  return false;
}

export function twoDevicesMayBothNotify() {
  return true;
}

export function oneDeviceCancelsAnotherWhileOffline() {
  return false;
}

function clockForOccurrence(occurrence, schedule, prefs) {
  const exact = schedule?.timeMode === 'EXACT_TIME' && (occurrence.plannedTime || schedule.dueTime);
  if (exact) return { clock: occurrence.plannedTime || schedule.dueTime, exact: true };
  const dateBased = dateBasedReminderClock(prefs);
  return {
    clock: `${String(dateBased.hour).padStart(2, '0')}:${String(dateBased.minute).padStart(2, '0')}`,
    exact: false,
  };
}

export function petCareReminderEligibility({
  occurrence,
  schedule,
  prefs,
  userId,
  permissionGranted,
  petArchived,
  nowMs,
  timeZone,
}) {
  if (!occurrence || !schedule) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE };
  if (prefs?.userId && userId && prefs.userId !== userId) {
    return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.CROSS_USER };
  }
  if (petArchived) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.ARCHIVED };
  if (prefs?.globalOptIn !== true) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NOT_OPTED_IN };
  if (permissionGranted === false) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.PERMISSION_DENIED };
  if (schedule.reminderEnabled !== true) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.SCHEDULE_DISABLED };
  if (schedule.status && schedule.status !== 'ACTIVE') return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.SCHEDULE_INACTIVE };
  if (occurrence.status === 'ADMINISTERED') return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.COMPLETED };
  if (occurrence.status === 'SKIPPED') return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.SKIPPED };
  if (occurrence.status === 'CANCELLED') return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.CANCELLED };
  if (schedule.revision != null && occurrence.revision != null && Number(schedule.revision) !== Number(occurrence.revision)) {
    return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.STALE_REVISION };
  }
  if (!isCivilDateKey(occurrence.plannedOn)) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE };
  return { ok: true, reason: null, nowMs, timeZone };
}

export function buildPetCareReminderCandidates({
  userId,
  petId,
  petName,
  schedule,
  occurrence,
  prefs,
  nowMs,
  timeZone = undefined,
  quietStart,
  quietEnd,
  bumpOutOfQuiet,
}) {
  const check = petCareReminderEligibility({
    occurrence,
    schedule,
    prefs,
    userId,
    permissionGranted: prefs?.permissionGranted !== false,
    petArchived: prefs?.petArchived === true,
    nowMs,
    timeZone,
  });
  if (!check.ok) return [];
  const now = Number(nowMs) || Date.now();
  const todayHorizon = addDaysCivil(
    `${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, '0')}-${String(new Date(now).getDate()).padStart(2, '0')}`,
    PET_CARE_REMINDER_HORIZON_DAYS,
  );
  if (occurrence.plannedOn > todayHorizon) return [];

  const { clock, exact } = clockForOccurrence(occurrence, schedule, prefs);
  const offsets = normalizeOffsets(schedule.reminderOffsetsDays);
  const out = [];
  const snooze = (prefs?.snoozes || []).find(
    (row) => row.occurrenceKey === occurrence.occurrenceKey && row.scheduleId === schedule.id && Number(row.fireAtMs) > now,
  );
  if (snooze) {
    const identity = phase5ReminderIdentity({
      userId,
      petId,
      scheduleId: schedule.id,
      occurrenceKey: occurrence.occurrenceKey,
      alertKind: 'snooze',
    });
    out.push({
      identifier: petCareNotificationIdentifier(identity),
      identity,
      alertKind: 'snooze',
      fireAtMs: Number(snooze.fireAtMs),
      plannedOn: occurrence.plannedOn,
      plannedTime: occurrence.plannedTime || null,
      exact,
      offset: 0,
      userId,
      petId,
      petName: petName || '',
      scheduleId: schedule.id,
      revision: occurrence.revision,
      occurrenceKey: occurrence.occurrenceKey,
      kind: schedule.kind,
      title: schedule.title,
      type: PET_CARE_REMINDER_TYPE,
      family: PET_CARE_REMINDER_FAMILY,
      meaning: PET_CARE_REMINDER_MEANING,
    });
    return out;
  }

  for (const offset of offsets) {
    const eventDate = addDaysCivil(occurrence.plannedOn, -Number(offset));
    if (!eventDate) continue;
    const wall = wallClockInstant(eventDate, clock, timeZone);
    if (!wall.ok) continue;
    let fire = wall.date;
    if (!exact && typeof bumpOutOfQuiet === 'function' && quietStart && quietEnd) {
      fire = bumpOutOfQuiet(fire, quietStart, quietEnd);
    }
    if (fire.getTime() <= now) {
      if (offset === 0) continue;
      continue;
    }
    const alertKind = offset === 0 ? 'due' : `advance:${offset}`;
    const identity = phase5ReminderIdentity({
      userId,
      petId,
      scheduleId: schedule.id,
      occurrenceKey: occurrence.occurrenceKey,
      alertKind,
    });
    out.push({
      identifier: petCareNotificationIdentifier(identity),
      identity,
      alertKind,
      fireAtMs: fire.getTime(),
      plannedOn: occurrence.plannedOn,
      plannedTime: occurrence.plannedTime || null,
      exact,
      offset,
      userId,
      petId,
      petName: petName || '',
      scheduleId: schedule.id,
      revision: occurrence.revision,
      occurrenceKey: occurrence.occurrenceKey,
      kind: schedule.kind,
      title: schedule.title,
      type: PET_CARE_REMINDER_TYPE,
      family: PET_CARE_REMINDER_FAMILY,
      meaning: PET_CARE_REMINDER_MEANING,
    });
  }

  if (prefs?.overdueFollowUp === true && occurrence.plannedOn < `${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, '0')}-${String(new Date(now).getDate()).padStart(2, '0')}`) {
    const followDate = addDaysCivil(occurrence.plannedOn, 1);
    const wall = wallClockInstant(followDate, clock, timeZone);
    if (wall.ok) {
      let fire = wall.date;
      if (typeof bumpOutOfQuiet === 'function' && quietStart && quietEnd) {
        fire = bumpOutOfQuiet(fire, quietStart, quietEnd);
      }
      if (fire.getTime() > now) {
        const identity = phase5ReminderIdentity({
          userId,
          petId,
          scheduleId: schedule.id,
          occurrenceKey: occurrence.occurrenceKey,
          alertKind: 'followup:1',
        });
        out.push({
          identifier: petCareNotificationIdentifier(identity),
          identity,
          alertKind: 'followup:1',
          fireAtMs: fire.getTime(),
          plannedOn: occurrence.plannedOn,
          plannedTime: occurrence.plannedTime || null,
          exact,
          offset: -1,
          userId,
          petId,
          petName: petName || '',
          scheduleId: schedule.id,
          revision: occurrence.revision,
          occurrenceKey: occurrence.occurrenceKey,
          kind: schedule.kind,
          title: schedule.title,
          type: PET_CARE_REMINDER_TYPE,
          family: PET_CARE_REMINDER_FAMILY,
          meaning: PET_CARE_REMINDER_MEANING,
        });
      }
    }
  }

  return out;
}

export function applyPetCareCapacity({ desired, pendingCounts, maxPetsPending = PET_CARE_MAX_PENDING, osBudget = PET_CARE_OS_BUDGET }) {
  const list = Array.isArray(desired) ? [...desired] : [];
  const petsPending = Number(pendingCounts?.pets) || 0;
  const total = Number(pendingCounts?.total) || 0;
  const other = Math.max(0, total - petsPending);
  const remaining = Math.max(0, osBudget - other);
  const cap = Math.min(maxPetsPending, remaining);
  const rank = (row) => {
    if (String(row.alertKind || '').startsWith('followup')) return 2;
    if (String(row.alertKind || '').startsWith('advance')) return 1;
    return 0;
  };
  list.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return Number(a.fireAtMs) - Number(b.fireAtMs);
  });
  const kept = list.slice(0, cap);
  const dropped = list.slice(cap).map((row) => ({ ...row, reason: PET_CARE_REMINDER_SUPPRESSION.CAPACITY }));
  return { kept, dropped, cap, reservedOther: other };
}

export function neverEvictMedicationReminders(cancelIds) {
  return (cancelIds || []).every((id) => !String(id).startsWith('med:'));
}

export function diffPetCareNotifications({ desired, pendingIds, lastGoodIds, apiFailed, cancelAll = false }) {
  const pending = [...new Set(pendingIds || [])];
  const desiredIds = new Set((desired || []).map((row) => row.identifier));
  if (cancelAll) {
    return { schedule: [], cancel: pending, keep: [], syncStatus: 'cancelled' };
  }
  if (apiFailed) {
    const keepSet = new Set(lastGoodIds || []);
    return {
      schedule: [],
      cancel: [],
      keep: pending.filter((id) => keepSet.has(id) || !lastGoodIds?.length),
      syncStatus: 'failed',
    };
  }
  const schedule = (desired || []).filter((row) => !pending.includes(row.identifier));
  const cancel = pending.filter((id) => !desiredIds.has(id));
  const keep = pending.filter((id) => desiredIds.has(id));
  return { schedule, cancel, keep, syncStatus: 'ok' };
}

export function createReconcileGate() {
  let generation = 0;
  return {
    bump() {
      generation += 1;
      return generation;
    },
    current() {
      return generation;
    },
    shouldCommit(startedAt) {
      return startedAt === generation;
    },
  };
}

export function serializeReconcileCalls(runs) {
  const order = [];
  let running = false;
  let queued = 0;
  const results = [];
  const step = (label) => {
    if (running) {
      queued += 1;
      return;
    }
    running = true;
    order.push(label);
    running = false;
    if (queued) {
      queued -= 1;
      step(`${label}:retry`);
    }
    results.push(label);
  };
  for (const label of runs) step(label);
  return { order, results };
}

export function authoritativeFetchResult(response) {
  if (!response) return { type: 'unknown', items: null };
  if (response.kind === 'error' || response.kind === 'unavailable' || response.kind === 'network') {
    return { type: 'unknown', items: null };
  }
  if (response.kind === 'ok' && response.careSchemaReady === true) {
    return { type: 'authoritative', items: Array.isArray(response.items) ? response.items : [] };
  }
  return { type: 'unknown', items: null };
}

export function pendingConfirmsForAccount(queue, userId) {
  return (queue || []).filter((row) => row && row.userId === userId);
}

export function queuedConfirmMayReplay(row, currentUserId) {
  return Boolean(row && currentUserId && row.userId === currentUserId);
}

export function isStalePetCareResponse(data, live = {}) {
  if (!data) return PET_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE;
  if (live.userId && data.userId && live.userId !== data.userId) return PET_CARE_REMINDER_SUPPRESSION.CROSS_USER;
  if (live.petArchived) return PET_CARE_REMINDER_SUPPRESSION.ARCHIVED;
  if (live.scheduleStatus && live.scheduleStatus !== 'ACTIVE') return PET_CARE_REMINDER_SUPPRESSION.SCHEDULE_INACTIVE;
  if (live.occurrenceStatus === 'ADMINISTERED') return PET_CARE_REMINDER_SUPPRESSION.COMPLETED;
  if (live.occurrenceStatus === 'SKIPPED') return PET_CARE_REMINDER_SUPPRESSION.SKIPPED;
  if (live.occurrenceStatus === 'CANCELLED') return PET_CARE_REMINDER_SUPPRESSION.CANCELLED;
  if (live.revision != null && data.revision != null && Number(live.revision) !== Number(data.revision)) {
    return PET_CARE_REMINDER_SUPPRESSION.STALE_REVISION;
  }
  return null;
}

export function conflictExplanation(code) {
  if (code === 'PET_CARE_OCCURRENCE_COMPLETED') return 'other_device';
  if (code === 'PET_CARE_IDEMPOTENCY_CONFLICT') return 'payload_conflict';
  if (code === 'PET_CARE_REVISION_STALE' || code === 'PET_CARE_SCHEDULE_CANCELLED') return 'schedule_changed';
  return 'refresh';
}

export function mintNewIdempotencyKeyOn409() {
  return false;
}

export function skipCreatesAdministrationEvent() {
  return false;
}

export function reminderPreferenceSavedMeansScheduled() {
  return false;
}

export function permissionDeniedMeansActiveReminders() {
  return false;
}

export function petCareMaskedCopy() {
  return {
    title: 'Medi-სგან შეხსენება',
    body: 'შენი დაგეგმილი მოვლის შეხსენება',
  };
}

export function petCareCopy({ petName, title, kind, masked }) {
  if (masked) return petCareMaskedCopy();
  const name = String(petName || '').trim() || 'ცხოველი';
  const care = String(title || '').trim() || 'მოვლა';
  if (kind === 'MEDICATION' || kind === 'FLEA_TICK' || kind === 'DEWORMING') {
    return { title: `${name} · ${care}`, body: 'მიღების დროა. გახსენი და დაადასტურე, თუ მიეცი.' };
  }
  if (kind === 'VACCINATION') {
    return { title: `${name} · ${care}`, body: 'დაგეგმილი აცრის დღეა. გახსენი და დაადასტურე, თუ გაკეთდა.' };
  }
  return { title: `${name} · ${care}`, body: 'დაგეგმილი მოვლის დღეა. გახსენი და დაადასტურე.' };
}

export function revalidatePetCareReminder(candidate, live = {}) {
  if (!candidate || candidate.type !== PET_CARE_REMINDER_TYPE) {
    return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE };
  }
  const stale = isStalePetCareResponse(candidate, live);
  if (stale) return { ok: false, reason: stale };
  if (live.permissionGranted === false) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.PERMISSION_DENIED };
  if (live.globalOptIn === false) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.NOT_OPTED_IN };
  if (live.reminderEnabled === false) return { ok: false, reason: PET_CARE_REMINDER_SUPPRESSION.SCHEDULE_DISABLED };
  return { ok: true, reason: null };
}

export function petCareReminderDeliveryDecision(candidate, live, discreet) {
  const reval = revalidatePetCareReminder(candidate, live);
  if (!reval.ok) return { ...reval, deliver: false, rewriteMasked: false };
  if (discreet && !candidate.masked) {
    return { ok: true, reason: 'DELIVER_WITH_DISCREET_COPY', deliver: true, rewriteMasked: true };
  }
  return { ok: true, reason: discreet ? 'PRIVACY_MASKED' : null, deliver: true, rewriteMasked: false };
}

export function completeRoute({ petId, scheduleId, occurrenceKey, revision, action = 'complete' }) {
  const qs = new URLSearchParams({
    scheduleId: String(scheduleId || ''),
    occurrenceKey: String(occurrenceKey || ''),
    revision: String(revision || ''),
    action: action === 'skip' ? 'skip' : 'complete',
  });
  return `/pets/${petId}/care/complete?${qs.toString()}`;
}

export function deviceDeliveryStatus({ preferenceSaved, permissionGranted, scheduledOnDevice, syncFailed }) {
  if (syncFailed) return 'sync_failed';
  if (preferenceSaved && permissionGranted === false) return 'permission_denied';
  if (preferenceSaved && scheduledOnDevice) return 'scheduled_on_device';
  if (preferenceSaved) return 'preference_saved';
  return 'off';
}
