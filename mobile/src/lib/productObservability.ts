import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/lib/api';
import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';

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

export async function syncDoseEvent(entry: {
  medicationId: string;
  date: string;
  time: string;
  status: 'taken' | 'skipped';
  source?: 'app' | 'notification';
  occurredAt?: string;
}): Promise<void> {
  await api.push.syncDoseEvents({
    events: [{
      medicationId: entry.medicationId,
      date: entry.date,
      time: entry.time,
      status: entry.status,
      source: entry.source || 'app',
      occurredAt: entry.occurredAt || new Date().toISOString(),
    }],
  }).catch(() => undefined);
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
    | 'my_rewards_opened',
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
