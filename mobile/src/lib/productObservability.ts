import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api, ApiError } from '@/lib/api';
import {
  dueDoseEvents,
  keepAfterFailure,
  parseDoseEvents,
  queueDoseEvent,
  settleDoseEvents,
  type DoseEvent,
  type DoseEventSource,
} from '@/lib/doseEventQueue';
import { deleteScopedPreference, getScopedPreference, localAccountId, setScopedPreference } from '@/lib/localAccount';

const PERM_SYNC_KEY = 'medicard.obs.permission.v1';

function actionKeyFromNotif(action?: string): string | undefined {
  const raw = String(action || '');
  if (raw === 'TAKE') return 'medication_taken';
  if (raw === 'DRANK') return 'hydration_logged';
  if (raw === 'SNOOZE') return 'snooze';
  if (raw === 'OK') return 'checkin_ok';
  if (raw === 'CHAT') return 'open_chat';
  if (raw === 'OPEN' || raw === 'open') return 'open';
  return undefined;
}

export function outcomeFromNotifAction(action?: string): { outcome: string; actionKey?: string } | null {
  const actionKey = actionKeyFromNotif(action);
  if (actionKey === 'snooze') return { outcome: 'snoozed', actionKey };
  if (actionKey === 'medication_taken' || actionKey === 'hydration_logged' || actionKey === 'checkin_ok') {
    return { outcome: 'actioned', actionKey };
  }
  if (actionKey === 'open' || actionKey === 'open_chat') return { outcome: 'opened', actionKey };
  if (!action || action === '' || action === 'expo.modules.notifications.actions.DEFAULT') {
    return { outcome: 'opened', actionKey: 'open' };
  }
  return null;
}

export async function syncNotificationOutcome(input: {
  decisionId?: string | null;
  outcome?: string;
  action?: string;
  occurredAt?: string;
}): Promise<void> {
  const decisionId = typeof input.decisionId === 'string' ? input.decisionId : '';
  if (!decisionId.startsWith('notif_dec_')) return;
  const mapped = input.outcome
    ? { outcome: input.outcome, actionKey: actionKeyFromNotif(input.action) }
    : outcomeFromNotifAction(input.action);
  if (!mapped) return;
  await api.push.syncOutcomes({
    outcomes: [{
      decisionId,
      outcome: mapped.outcome,
      actionKey: mapped.actionKey,
      action: input.action,
      occurredAt: input.occurredAt || new Date().toISOString(),
    }],
  }).catch(() => undefined);
}

export async function syncWeeklyReportOpened(weekKey: string, source: 'notification' | 'in_app' = 'in_app'): Promise<void> {
  if (!weekKey) return;
  await api.push.syncProductEvents({
    events: [
      { kind: 'weekly_report_opened', entityId: weekKey, source, occurredAt: new Date().toISOString() },
    ],
  }).catch(() => undefined);
}

/** Viewing /week is opened only. Generated is written from Brain SEND on the server. */
export async function syncWeeklyReportEvents(weekKey: string, source: 'notification' | 'in_app' = 'in_app'): Promise<void> {
  return syncWeeklyReportOpened(weekKey, source);
}

export async function syncInsightOutcome(
  kind: 'insight_opened' | 'insight_actioned' | 'insight_dismissed',
  insightId: string,
  category?: string,
): Promise<void> {
  if (!insightId) return;
  await api.push.syncProductEvents({
    events: [{ kind, entityId: insightId, category, occurredAt: new Date().toISOString() }],
  }).catch(() => undefined);
}

/** This account's dose answers not yet taken by the server (doseEventQueue.ts). */
const DOSE_EVENTS_KEY = 'medicard.meds.pendingDoseEvents';

/** Outbox reads and writes run one at a time, so an answer queued while a flush settles is kept. */
let doseOutbox: Promise<unknown> = Promise.resolve();
function withDoseOutbox<T>(work: () => Promise<T>): Promise<T> {
  const next = doseOutbox.then(work, work);
  doseOutbox = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * A dose answer for the server. It goes into this account's outbox before the request, so an answer from
 * a reminder's „მივიღე ✓“ (a background wake iOS ends at once, often on a locked phone without a readable
 * token) is sent on the next foreground or sign-in instead of being lost with its `notification` source.
 */
export async function syncDoseEvent(entry: {
  medicationId: string;
  date: string;
  time: string;
  status: 'taken' | 'skipped';
  source?: DoseEventSource;
  occurredAt?: string;
}): Promise<void> {
  const owner = localAccountId();
  if (!owner) return;
  const event: DoseEvent = {
    medicationId: entry.medicationId,
    date: entry.date,
    time: entry.time,
    status: entry.status,
    source: entry.source || 'app',
    occurredAt: entry.occurredAt || new Date().toISOString(),
  };
  await withDoseOutbox(async () => {
    const queue = parseDoseEvents(await getScopedPreference(DOSE_EVENTS_KEY));
    // The scoped key follows the account at call time: never put her answer into the next account's outbox.
    if (localAccountId() !== owner) return;
    await setScopedPreference(DOSE_EVENTS_KEY, JSON.stringify(queueDoseEvent(queue, event)));
  }).catch(() => undefined);
  await flushDoseEvents();
}

type DoseFlushResult = 'idle' | 'sent' | 'kept';

async function flushDoseEventsOnce(): Promise<DoseFlushResult> {
  const owner = localAccountId();
  if (!owner) return 'idle';
  const due = dueDoseEvents(parseDoseEvents(await getScopedPreference(DOSE_EVENTS_KEY)), Date.now());
  let settled: DoseEvent[] = due;
  let result: DoseFlushResult = due.length ? 'sent' : 'idle';
  if (due.length) {
    // Her rows go with her session only (the request reads the current token).
    if (localAccountId() !== owner) return 'idle';
    try {
      await api.push.syncDoseEvents({ events: due });
    } catch (error) {
      if (keepAfterFailure(error instanceof ApiError ? error.status : 0)) {
        settled = [];
        result = 'kept';
      }
    }
  }
  // Re-read: an answer queued while the request was out must stay.
  await withDoseOutbox(async () => {
    const raw = await getScopedPreference(DOSE_EVENTS_KEY);
    if (raw === null || localAccountId() !== owner) return;
    const next = settleDoseEvents(parseDoseEvents(raw), settled, Date.now());
    const value = JSON.stringify(next);
    if (value === raw) return;
    if (next.length) await setScopedPreference(DOSE_EVENTS_KEY, value);
    else await deleteScopedPreference(DOSE_EVENTS_KEY);
  });
  return result;
}

let doseFlush: Promise<void> | null = null;
let doseFlushAgain = false;

/**
 * Sends this account's queued dose answers: after each new answer, on return to the foreground and after
 * sign-in. One flush at a time; an answer queued during a flush is sent right after it (unless the
 * server could not be reached — then the next foreground tries again, never a loop).
 */
export function flushDoseEvents(): Promise<void> {
  if (doseFlush) {
    doseFlushAgain = true;
    return doseFlush;
  }
  doseFlush = (async () => {
    let result: DoseFlushResult;
    do {
      doseFlushAgain = false;
      result = await flushDoseEventsOnce();
    } while (doseFlushAgain && result !== 'kept');
  })()
    .catch(() => undefined)
    .finally(() => {
      doseFlush = null;
    });
  return doseFlush;
}

export async function syncNotificationPermission(status: 'enabled' | 'disabled' | 'provisional' | 'unknown'): Promise<void> {
  const prev = await getScopedPreference(PERM_SYNC_KEY);
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const stamp = `${status}:${platform}:${Constants.expoConfig?.version || ''}`;
  if (prev === stamp) return;
  const result = await api.push.syncPermission({ status, platform }).catch(() => null);
  if (result?.ok) await setScopedPreference(PERM_SYNC_KEY, stamp);
}

export async function pingAppActivity(activityType?: string): Promise<void> {
  await api.activity.ping(activityType).catch(() => undefined);
}

export async function trackQuestEvent(
  kind:
    | 'quest_hub_opened'
    | 'quest_claim_tapped'
    | 'quest_history_opened'
    | 'quest_wallet_opened'
    | 'step_setup_opened'
    | 'hydration_setup_opened'
    | 'achievements_opened'
    | 'achievements_opened_from_hub'
    | 'achievement_claim_tapped'
    | 'quest_why_target_opened'
    | 'rewards_store_opened'
    | 'reward_viewed'
    | 'reward_redeem_started'
    | 'reward_redeemed'
    | 'reward_redeem_failed'
    | 'my_rewards_opened'
    | 'medi_companion_opened'
    | 'medi_journey_opened'
    | 'medi_journey_milestone_viewed'
    | 'medi_cosmetic_equipped'
    | 'medi_talk_tapped',
  entityId?: string,
): Promise<void> {
  await api.push.syncProductEvents({
    events: [
      {
        kind,
        entityId: entityId || kind,
        source: 'app',
        occurredAt: new Date().toISOString(),
      },
    ],
  }).catch(() => undefined);
}
