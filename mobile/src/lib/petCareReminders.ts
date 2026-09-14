import { Notifications } from '@/lib/expoNotifications';
import { Platform } from 'react-native';
import { ApiError, api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { bumpOutOfQuiet } from '@/lib/mediEngageModel';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import {
  PET_CARE_DELIVERY_STATE,
  PET_CARE_REMINDER_FAMILY,
  PET_CARE_REMINDER_MASKED_TEMPLATE,
  PET_CARE_REMINDER_PREFIX,
  PET_CARE_REMINDER_TEMPLATE,
  PET_CARE_REMINDER_TYPE,
  applyPetCareCapacity,
  authoritativeFetchResult,
  buildPetCareReminderCandidates,
  completeRoute,
  createReconcileGate,
  deviceDeliveryStatus,
  diffPetCareNotifications,
  neverEvictMedicationReminders,
  normalizeSnoozeMinutes,
  pendingConfirmsForAccount,
  petCareCopy,
  petCareReminderDeliveryDecision,
  queuedConfirmMayReplay,
} from '@/lib/petCareReminderContract.js';
import {
  currentDeviceTimeZone,
  loadPendingPetCareConfirms,
  loadPetCareDeliveryBook,
  loadPetCareReminderPrefs,
  petCareInstallId,
  savePendingPetCareConfirms,
  savePetCareDeliveryBook,
  savePetCareReminderPrefs,
  type PendingPetCareConfirm,
  type PetCareReminderPrefs,
} from '@/lib/petCareReminderPrefs';
import {
  cancelNotificationsByPrefix,
  getNotificationPermissionGranted,
  getScheduledReminderCounts,
  schedulePetCareDateNotification,
} from '@/lib/notifications';

const gate = createReconcileGate();
let chain: Promise<unknown> = Promise.resolve();

export function bumpPetCareSessionGeneration(): number {
  return gate.bump();
}

export async function cancelOwnerPetCareNotifications(userId?: string | null): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => {
          const id = item.identifier ?? '';
          if (!id.startsWith(PET_CARE_REMINDER_PREFIX)) return false;
          if (!userId) return true;
          const data = (item.content?.data ?? {}) as Record<string, unknown>;
          return data.userId === userId || id.includes(`:${userId}:`);
        })
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
  } catch {
    await cancelNotificationsByPrefix(PET_CARE_REMINDER_PREFIX);
  }
}

async function pendingPetIdentifiers(): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((item) => item.identifier ?? '').filter((id) => id.startsWith(PET_CARE_REMINDER_PREFIX));
  } catch {
    return [];
  }
}

async function nextScheduledAlertForSchedule(scheduleId: string): Promise<number | null> {
  if (Platform.OS === 'web') return null;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const matches = scheduled.filter((item) => {
      const data = (item.content?.data ?? {}) as Record<string, unknown>;
      return item.identifier?.startsWith(PET_CARE_REMINDER_PREFIX) && data.scheduleId === scheduleId;
    });
    const times = matches
      .map((item) => {
        const trigger = item.trigger as { date?: Date | string } | null;
        if (!trigger?.date) return null;
        const date = trigger.date instanceof Date ? trigger.date : new Date(String(trigger.date));
        return Number.isNaN(date.getTime()) ? null : date.getTime();
      })
      .filter((ms): ms is number => typeof ms === 'number');
    if (!times.length) return null;
    return Math.min(...times);
  } catch {
    return null;
  }
}

async function recordLocalDelivery(identifier: string, identity: string, status: string, fireAtMs?: number | null) {
  const book = await loadPetCareDeliveryBook();
  book[identifier] = { status, identity, updatedAt: Date.now(), fireAtMs: fireAtMs ?? null };
  await savePetCareDeliveryBook(book);
}

async function postTelemetry(row: {
  petId: string;
  scheduleId: string;
  occurrenceKey: string;
  alertKind: string;
  identity: string;
  status: string;
  fireAtMs?: number | null;
}): Promise<void> {
  try {
    await api.pets.reminders.delivery(row.petId, row.scheduleId, {
      occurrenceKey: row.occurrenceKey,
      alertKind: row.alertKind,
      identity: row.identity,
      installId: await petCareInstallId(),
      status: statusToServer(row.status),
      fireAtMs: row.fireAtMs ?? undefined,
    });
  } catch {
    /* telemetry is best-effort; missing Phase 5 table is not a care failure */
  }
}

function statusToServer(status: string): string {
  if (status === PET_CARE_DELIVERY_STATE.SCHEDULED_LOCAL) return 'SCHEDULED_LOCAL';
  if (status === PET_CARE_DELIVERY_STATE.SCHEDULE_FAILED) return 'SCHEDULE_FAILED';
  if (status === PET_CARE_DELIVERY_STATE.CANCELLED) return 'CANCELLED';
  if (status === PET_CARE_DELIVERY_STATE.RECEIVED_CALLBACK) return 'RECEIVED_CALLBACK';
  if (status === PET_CARE_DELIVERY_STATE.USER_RESPONSE) return 'USER_RESPONSE';
  if (status === PET_CARE_DELIVERY_STATE.COMPLETION_CONFIRMED) return 'COMPLETION_CONFIRMED';
  return 'SCHEDULED_LOCAL';
}

async function fetchReminderFeed() {
  try {
    const res = await api.pets.reminders.feed();
    return {
      kind: 'ok' as const,
      careSchemaReady: res.careSchemaReady !== false,
      items: res.items ?? [],
    };
  } catch (error) {
    if (error instanceof ApiError && error.isCareSchemaUnavailable) {
      return { kind: 'unavailable' as const, careSchemaReady: false, items: null };
    }
    return { kind: 'network' as const, careSchemaReady: undefined, items: null };
  }
}

export async function flushPendingPetCareConfirms(): Promise<void> {
  const userId = localAccountId();
  if (!userId) return;
  const queue = pendingConfirmsForAccount(await loadPendingPetCareConfirms(), userId);
  const remaining: PendingPetCareConfirm[] = (await loadPendingPetCareConfirms()).filter((row) => row.userId !== userId);
  for (const row of queue) {
    if (!queuedConfirmMayReplay(row, userId) || localAccountId() !== userId) continue;
    try {
      if (row.kind === 'skip') {
        await api.pets.schedules.skip(row.petId, row.scheduleId, {
          occurrenceKey: row.occurrenceKey,
          revision: row.revision,
          clientRequestId: row.clientRequestId,
        });
      } else {
        await api.pets.schedules.complete(row.petId, row.scheduleId, {
          occurrenceKey: row.occurrenceKey,
          revision: row.revision,
          administeredOn: row.administeredOn,
          clientRequestId: row.clientRequestId,
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) continue;
      remaining.push(row);
    }
  }
  if (localAccountId() === userId) await savePendingPetCareConfirms(remaining);
}

async function reconcileOnce(reason: string): Promise<{ scheduled: number; cancelled: number; status: string }> {
  const started = gate.current();
  const userId = localAccountId();
  if (!userId) return { scheduled: 0, cancelled: 0, status: 'no_session' };

  const prefs = await loadPetCareReminderPrefs();
  const permissionGranted = await getNotificationPermissionGranted();
  const tz = currentDeviceTimeZone();
  const tzChanged = Boolean(prefs.lastTimeZone && prefs.lastTimeZone !== tz);

  if (!gate.shouldCommit(started) || localAccountId() !== userId) {
    return { scheduled: 0, cancelled: 0, status: 'aborted' };
  }

  if (!prefs.globalOptIn) {
    const pending = await pendingPetIdentifiers();
    await cancelOwnerPetCareNotifications(userId);
    const next: PetCareReminderPrefs = { ...prefs, lastSyncStatus: 'cancelled', lastGoodIds: [], lastTimeZone: tz };
    await savePetCareReminderPrefs(next);
    return { scheduled: 0, cancelled: pending.length, status: 'opted_out' };
  }

  if (!permissionGranted) {
    const next: PetCareReminderPrefs = { ...prefs, lastSyncStatus: 'permission_denied', lastTimeZone: tz };
    await savePetCareReminderPrefs(next);
    return { scheduled: 0, cancelled: 0, status: 'permission_denied' };
  }

  const feed = await fetchReminderFeed();
  if (!gate.shouldCommit(started) || localAccountId() !== userId) {
    return { scheduled: 0, cancelled: 0, status: 'aborted' };
  }

  const authoritative = authoritativeFetchResult(feed);
  const pendingIds = await pendingPetIdentifiers();
  const engage = await loadEngagePrefs().catch(() => null);
  const nowMs = Date.now();

  if (authoritative.type === 'unknown') {
    const diff = diffPetCareNotifications({
      desired: [],
      pendingIds,
      lastGoodIds: prefs.lastGoodIds,
      apiFailed: true,
    });
    const next: PetCareReminderPrefs = {
      ...prefs,
      lastSyncStatus: 'failed',
      lastSyncedAt: Date.now(),
      lastTimeZone: tz,
    };
    await savePetCareReminderPrefs(next);
    return { scheduled: 0, cancelled: 0, status: 'failed' };
  }

  const desiredRaw: ReturnType<typeof buildPetCareReminderCandidates> = [];
  for (const item of authoritative.items) {
    desiredRaw.push(
      ...buildPetCareReminderCandidates({
        userId,
        petId: item.petId,
        petName: item.petName,
        schedule: item.schedule,
        occurrence: item.occurrence,
        prefs: {
          ...prefs,
          permissionGranted,
          userId,
          petArchived: item.petArchived === true,
        },
        nowMs,
        quietStart: engage?.quietStart,
        quietEnd: engage?.quietEnd,
        bumpOutOfQuiet,
      }),
    );
  }

  const counts = await getScheduledReminderCounts();
  const { kept } = applyPetCareCapacity({ desired: desiredRaw, pendingCounts: counts });
  const diff = diffPetCareNotifications({
    desired: kept,
    pendingIds,
    lastGoodIds: prefs.lastGoodIds,
    apiFailed: false,
  });
  if (!neverEvictMedicationReminders(diff.cancel)) {
    return { scheduled: 0, cancelled: 0, status: 'guard_med' };
  }
  if (!gate.shouldCommit(started) || localAccountId() !== userId) {
    return { scheduled: 0, cancelled: 0, status: 'aborted' };
  }

  const discreet = Boolean(engage?.discreet);
  let scheduled = 0;
  for (const id of diff.cancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      await recordLocalDelivery(id, id, PET_CARE_DELIVERY_STATE.CANCELLED);
    } catch {
      /* native cancel is best-effort */
    }
  }
  for (const candidate of diff.schedule) {
    if (!gate.shouldCommit(started) || localAccountId() !== userId) break;
    const copy = petCareCopy({
      petName: candidate.petName,
      title: candidate.title,
      kind: candidate.kind,
      masked: discreet,
    });
    const ok = await schedulePetCareDateNotification({
      identifier: candidate.identifier,
      title: copy.title,
      body: copy.body,
      date: new Date(candidate.fireAtMs),
      data: {
        type: PET_CARE_REMINDER_TYPE,
        family: PET_CARE_REMINDER_FAMILY,
        candidateId: candidate.identity,
        userId,
        petId: candidate.petId,
        scheduleId: candidate.scheduleId,
        occurrenceKey: candidate.occurrenceKey,
        revision: candidate.revision,
        plannedOn: candidate.plannedOn,
        plannedTime: candidate.plannedTime,
        alertKind: candidate.alertKind,
        kind: candidate.kind,
        templateKey: discreet ? PET_CARE_REMINDER_MASKED_TEMPLATE : PET_CARE_REMINDER_TEMPLATE,
        route: completeRoute({
          petId: candidate.petId,
          scheduleId: candidate.scheduleId,
          occurrenceKey: candidate.occurrenceKey,
          revision: candidate.revision,
        }),
        masked: discreet,
      },
    });
    await recordLocalDelivery(
      candidate.identifier,
      candidate.identity,
      ok ? PET_CARE_DELIVERY_STATE.SCHEDULED_LOCAL : PET_CARE_DELIVERY_STATE.SCHEDULE_FAILED,
      candidate.fireAtMs,
    );
    if (ok) {
      scheduled += 1;
      void postTelemetry({
        petId: candidate.petId,
        scheduleId: candidate.scheduleId,
        occurrenceKey: candidate.occurrenceKey,
        alertKind: candidate.alertKind,
        identity: candidate.identity,
        status: PET_CARE_DELIVERY_STATE.SCHEDULED_LOCAL,
        fireAtMs: candidate.fireAtMs,
      });
    }
  }

  const next: PetCareReminderPrefs = {
    ...prefs,
    lastSyncStatus: 'ok',
    lastSyncedAt: Date.now(),
    lastGoodIds: kept.map((row) => row.identifier),
    lastTimeZone: tz,
  };
  await savePetCareReminderPrefs(next);
  void reason;
  void tzChanged;
  return { scheduled, cancelled: diff.cancel.length, status: 'ok' };
}

export function reconcilePetCareReminders(opts?: { reason?: string }): Promise<{ scheduled: number; cancelled: number; status: string }> {
  const run = () => reconcileOnce(opts?.reason || 'unknown');
  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next as Promise<{ scheduled: number; cancelled: number; status: string }>;
}

export async function onPetCareLogout(userId?: string | null): Promise<void> {
  bumpPetCareSessionGeneration();
  await cancelOwnerPetCareNotifications(userId);
  if (userId) {
    const prefs = await loadPetCareReminderPrefs();
    await savePetCareReminderPrefs({ ...prefs, lastGoodIds: [], lastSyncStatus: 'cancelled' });
  }
}

export async function recordPetCareUserResponse(data: Record<string, unknown>): Promise<void> {
  const identifier = String(data.candidateId || data.identity || '');
  if (!identifier) return;
  await recordLocalDelivery(identifier, identifier, PET_CARE_DELIVERY_STATE.USER_RESPONSE);
}

export async function recordPetCareReceivedCallback(data: Record<string, unknown>): Promise<void> {
  const identifier = String(data.candidateId || '');
  if (!identifier || data.type !== PET_CARE_REMINDER_TYPE) return;
  await recordLocalDelivery(identifier, identifier, PET_CARE_DELIVERY_STATE.RECEIVED_CALLBACK);
}

export async function snoozePetCareCandidate(data: Record<string, unknown>, minutes?: number): Promise<void> {
  const prefs = await loadPetCareReminderPrefs();
  const snoozeMinutes = normalizeSnoozeMinutes(minutes ?? prefs.snoozeMinutes);
  const occurrenceKey = String(data.occurrenceKey || '');
  const scheduleId = String(data.scheduleId || '');
  if (!occurrenceKey || !scheduleId) return;
  const fireAtMs = Date.now() + snoozeMinutes * 60_000;
  const snoozes = [
    ...prefs.snoozes.filter((row) => !(row.occurrenceKey === occurrenceKey && row.scheduleId === scheduleId)),
    { scheduleId, occurrenceKey, fireAtMs },
  ];
  await savePetCareReminderPrefs({ ...prefs, snoozes });
  await reconcilePetCareReminders({ reason: 'snooze' });
}

export async function queuePetCareConfirm(row: PendingPetCareConfirm): Promise<void> {
  const existing = await loadPendingPetCareConfirms();
  const next = existing.filter((item) => item.clientRequestId !== row.clientRequestId);
  remainingSafePush(next, row);
  await savePendingPetCareConfirms(next);
}

function remainingSafePush(next: PendingPetCareConfirm[], row: PendingPetCareConfirm) {
  next.push(row);
}

export async function petCareUiStatus(schedule: { id: string; reminderEnabled: boolean }): Promise<{
  preferenceSaved: boolean;
  status: string;
  nextAlertAt: number | null;
  permissionGranted: boolean;
}> {
  const prefs = await loadPetCareReminderPrefs();
  const permissionGranted = await getNotificationPermissionGranted();
  const nextAlertAt = schedule.reminderEnabled ? await nextScheduledAlertForSchedule(schedule.id) : null;
  const preferenceSaved = schedule.reminderEnabled === true;
  return {
    preferenceSaved,
    permissionGranted,
    nextAlertAt,
    status: deviceDeliveryStatus({
      preferenceSaved,
      permissionGranted,
      scheduledOnDevice: Boolean(nextAlertAt),
      syncFailed: prefs.lastSyncStatus === 'failed',
    }),
  };
}

export { petCareReminderDeliveryDecision };
