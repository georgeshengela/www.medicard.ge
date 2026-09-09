import { Notifications } from '@/lib/expoNotifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { ApiError, api } from './api';
import type { Medication, ScheduledDose } from './api';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import {
  cyclePushPayload,
  getEffectiveCycleMask,
  redactCyclePushLog,
} from '@/lib/cycleNotificationContract.js';
import { parseMedicationConfig } from '@/lib/medications.shared';
import {
  planMedicationReminderSlots,
  prefixForNotificationId,
} from '@/lib/notificationPlan';
import { applyPushCopy, logPushEvent } from '@/lib/pushCopy';
import { resolvePushOptedIn, resolvePushToggleOn } from '@/lib/pushOptIn';
import { getPreference, setPreference } from '@/lib/storage';

export const MED_CHANNEL_ID = 'medication-reminders';
export const CYCLE_CHANNEL_ID = 'cycle-reminders';
export const CYCLE_DISCREET_CHANNEL_ID = 'medicard-discreet';
export const PUSH_CHANNEL_ID = 'medicard-push';
export const STEPS_CHANNEL_ID = 'steps-reminders';
export const WEIGHT_CHANNEL_ID = 'weight-reminders';
export const VISIT_CHANNEL_ID = 'doctor-visit-reminders';
export const ENGAGE_CHANNEL_ID = 'medi-engage';
export const QA_PREFIX = 'qa:';

export const NOTIF_PREFIX = {
  med: 'med:',
  cycle: 'cycle:',
  visit: 'visit:',
  steps: 'steps:',
  weight: 'weight:',
  engage: 'engage:',
  quota: 'quota:',
} as const;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
    try {
      if (data.type === 'quota_reset' || data.family === 'quotaReset') {
        const resetKey = typeof data.resetKey === 'string' ? data.resetKey : null;
        const { wasQuotaResetShown, markQuotaResetShown } = await import('@/lib/quotaResetNotification');
        const shown = await wasQuotaResetShown(resetKey);
        const hideBanner = shown || AppState.currentState === 'active';
        if (!shown && !hideBanner) void markQuotaResetShown(resetKey);
        return {
          shouldShowBanner: !hideBanner,
          shouldShowList: !shown,
          shouldPlaySound: !hideBanner,
          shouldSetBadge: false,
        };
      }
      const { shouldDeliverNotification } = await import('@/lib/mediNotificationBrain');
      const { patchEngageDecision } = await import('@/lib/mediEngagePrefs');
      const check = await shouldDeliverNotification(data);
      if (check.rewriteMasked && data.type === 'cycle_reminder' && data.rewrite !== true) {
        const discreet = applyPushCopy('cycle-masked');
        void Notifications.scheduleNotificationAsync({
          identifier: `cycle:mask-rewrite:${String(data.candidateId || Date.now())}`,
          content: {
            title: discreet.title,
            body: discreet.body,
            sound: 'default',
            data: { ...data, masked: true, rewrite: true, templateKey: 'cycle-masked' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
        });
        return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
      }
      if (!check.ok) {
        const id = typeof data.decisionId === 'string' ? data.decisionId : '';
        if (id && check.reason !== 'DELIVER_WITH_DISCREET_COPY') {
          void patchEngageDecision(id, {
            decision: 'BLOCKED',
            blocked: check.reason,
            reason: check.reason,
            revalidatedAt: new Date().toISOString(),
          });
          void import('@/lib/productObservability').then(({ syncNotificationOutcome }) =>
            syncNotificationOutcome({ decisionId: id, outcome: 'cancelled_by_revalidation' }),
          );
        }
        return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
      }
    } catch {
      /* deliver if revalidation cannot run */
    }
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
  },
});

export async function getNotificationPermissionGranted(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    return existing.status === 'granted';
  } catch {
    return false;
  }
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(MED_CHANNEL_ID, {
    name: 'მედიკამენტების შეხსენებები',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CYCLE_CHANNEL_ID, {
    name: 'ციკლის შეხსენებები',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#E91E63',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CYCLE_DISCREET_CHANNEL_ID, {
    name: 'Medicard',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 160, 100, 160],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
    name: 'Medicard შეტყობინებები',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(STEPS_CHANNEL_ID, {
    name: 'ნაბიჯების შეხსენებები',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(WEIGHT_CHANNEL_ID, {
    name: 'წონის შეხსენებები',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(VISIT_CHANNEL_ID, {
    name: 'ექიმთან ვიზიტის შეხსენებები',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(ENGAGE_CHANNEL_ID, {
    name: 'Medi',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 160, 100, 160],
    lightColor: '#14B8A6',
    sound: 'default',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannels();
  void import('@/lib/mediNotificationActions').then((mod) => mod.registerNotificationCategories());
  const existing = await Notifications.getPermissionsAsync();
  const status =
    existing.status === 'granted' ? existing.status : (await Notifications.requestPermissionsAsync()).status;

  return status === 'granted';
}

export type PushRegisterReason = 'permission' | 'simulator' | 'expo_go' | 'token' | 'auth' | 'network';

export type PushRegisterResult = { ok: true } | { ok: false; reason: PushRegisterReason };

const PUSH_OPTED_IN_KEY = 'medicard.push.optedIn';
const PUSH_LAST_TOKEN_KEY = 'medicard.push.lastToken';

function pushProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    undefined
  );
}

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

export async function isPushOptedIn(): Promise<boolean> {
  const stored = await getPreference(PUSH_OPTED_IN_KEY);
  return resolvePushOptedIn(stored, await getNotificationPermissionGranted());
}

export async function setPushOptedIn(on: boolean): Promise<void> {
  await setPreference(PUSH_OPTED_IN_KEY, on ? '1' : '0');
}

export async function isNotificationsEnabled(): Promise<boolean> {
  const granted = await getNotificationPermissionGranted();
  return resolvePushToggleOn(granted, await isPushOptedIn());
}

/** Registers only when the user has not opted out. Used on login / resume. */
export async function syncPushRegistration(): Promise<void> {
  if (!(await isPushOptedIn())) return;
  await registerPushTokenWithServer();
}

async function saveLastPushToken(token: string): Promise<void> {
  await setPreference(PUSH_LAST_TOKEN_KEY, token);
}

async function readLastPushToken(): Promise<string | null> {
  return getPreference(PUSH_LAST_TOKEN_KEY);
}

async function fetchExpoPushToken(): Promise<string | null> {
  const projectId = pushProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResult.data;
  return isExpoPushToken(token) ? token : null;
}

/** Registers the device for admin broadcast push via Expo Push Service. */
export async function registerPushTokenWithServer(): Promise<PushRegisterResult> {
  if (!Device.isDevice) return { ok: false, reason: 'simulator' };

  const granted = await requestNotificationPermission();
  if (!granted) return { ok: false, reason: 'permission' };

  try {
    const token = await fetchExpoPushToken();
    if (!token) {
      console.warn('[medicard-push] unexpected token shape');
      return { ok: false, reason: 'token' };
    }

    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    await api.push.register({ token, platform });
    await saveLastPushToken(token);

    if (!(await isPushOptedIn())) {
      await api.push.unregister(token).catch(() => undefined);
      return { ok: false, reason: 'permission' };
    }
    return { ok: true };
  } catch (error) {
    console.warn('[medicard-push] register failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (/Expo Go/i.test(message)) return { ok: false, reason: 'expo_go' };
    if (error instanceof ApiError && error.isUnauthorized) return { ok: false, reason: 'auth' };
    if (error instanceof ApiError) return { ok: false, reason: 'network' };
    return { ok: false, reason: 'token' };
  }
}

function canScheduleNotifications(): boolean {
  return Platform.OS !== 'web';
}

export async function cancelNotificationsByPrefix(prefix: string): Promise<void> {
  if (!canScheduleNotifications()) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier?.startsWith(prefix))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Native scheduler is unavailable (web / Expo Go without the module).
  }
}

/**
 * Rewrites medication reminders without touching cycle:* notifications.
 * Honors daysOfWeek from the medication config (daily if every day / unset).
 */
export async function syncMedicationReminders(
  schedule: ScheduledDose[],
  medications: Medication[] = [],
): Promise<number> {
  const granted = await requestNotificationPermission();
  if (!granted) return 0;

  await cancelNotificationsByPrefix(NOTIF_PREFIX.med);

  const byId = new Map(medications.map((med) => [med.id, med]));
  let scheduled = 0;

  for (const dose of schedule) {
    const med = byId.get(dose.medicationId);
    const days = parseMedicationConfig(med?.config).daysOfWeek;
    const slots = planMedicationReminderSlots(dose.medicationId, dose.time, days);
    const copy = applyPushCopy('medication', {
      name: dose.medName,
      dosage: [dose.dosage, dose.notes].map((part) => String(part ?? '').trim()).filter(Boolean).join(' · '),
    });
    const title = copy.title;
    const body = copy.body;

    for (const slot of slots) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIF_PREFIX.med}${slot.identifier}`,
        content: {
          title,
          body,
          sound: 'default',
          categoryIdentifier: 'medi-med',
          data: {
            type: 'medication',
            templateKey: 'medication',
            medicationId: dose.medicationId,
            time: dose.time,
            route: `/medications/${dose.medicationId}`,
          },
        },
        trigger:
          slot.weekday == null
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: slot.hour,
                minute: slot.minute,
                ...(Platform.OS === 'android' ? { channelId: MED_CHANNEL_ID } : {}),
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: slot.weekday,
                hour: slot.hour,
                minute: slot.minute,
                ...(Platform.OS === 'android' ? { channelId: MED_CHANNEL_ID } : {}),
              },
      });
      scheduled += 1;
    }
  }

  return scheduled;
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export type ScheduledReminderCounts = {
  med: number;
  cycle: number;
  visit: number;
  steps: number;
  weight: number;
  engage: number;
  quota: number;
  qa: number;
  other: number;
  total: number;
};

export async function getScheduledReminderCounts(): Promise<ScheduledReminderCounts> {
  const empty: ScheduledReminderCounts = {
    med: 0,
    cycle: 0,
    visit: 0,
    steps: 0,
    weight: 0,
    engage: 0,
    quota: 0,
    qa: 0,
    other: 0,
    total: 0,
  };
  if (!canScheduleNotifications()) return empty;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const counts = { ...empty };
    for (const item of scheduled) {
      const key = prefixForNotificationId(item.identifier ?? '');
      counts[key] += 1;
      counts.total += 1;
    }
    return counts;
  } catch {
    return empty;
  }
}

export type ScheduledReminderRow = {
  id: string;
  group: ReturnType<typeof prefixForNotificationId>;
  title: string;
  body: string;
  trigger: string;
};

function describeTrigger(trigger: Notifications.NotificationTrigger | null): string {
  if (!trigger || typeof trigger !== 'object') return 'none';
  const row = trigger as Record<string, unknown>;
  if (row.type === 'daily' || row.hour != null && row.weekday == null && row.seconds == null && !row.date) {
    return `daily ${String(row.hour).padStart(2, '0')}:${String(row.minute ?? 0).toString().padStart(2, '0')}`;
  }
  if (row.weekday != null) {
    return `weekly d${row.weekday} ${String(row.hour ?? 0).toString().padStart(2, '0')}:${String(row.minute ?? 0).toString().padStart(2, '0')}`;
  }
  if (row.date) {
    const date = row.date instanceof Date ? row.date : new Date(String(row.date));
    return Number.isNaN(date.getTime()) ? 'date' : `date ${date.toLocaleString('ka-GE')}`;
  }
  if (row.seconds != null) return `in ${row.seconds}s`;
  return String(row.type ?? 'unknown');
}

export async function listScheduledReminders(): Promise<ScheduledReminderRow[]> {
  if (!canScheduleNotifications()) return [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((item) => ({
      id: item.identifier ?? '',
      group: prefixForNotificationId(item.identifier ?? ''),
      title: item.content.title ?? '',
      body: item.content.body ?? '',
      trigger: describeTrigger(item.trigger),
    }));
  } catch {
    return [];
  }
}

export async function getNotificationDebugStatus(): Promise<{
  permission: 'granted' | 'denied' | 'undetermined';
  optedIn: boolean;
  enabled: boolean;
  tokenPreview: string | null;
  counts: ScheduledReminderCounts;
}> {
  const [permission, optedIn, enabled, token, counts] = await Promise.all([
    getNotificationPermissionStatus(),
    isPushOptedIn(),
    isNotificationsEnabled(),
    readLastPushToken(),
    getScheduledReminderCounts(),
  ]);
  return {
    permission,
    optedIn,
    enabled,
    tokenPreview: token ? `${token.slice(0, 22)}…${token.slice(-4)}` : null,
    counts,
  };
}

/** One-shot local banner — used by the DEV tester, does not replace real schedules. */
export async function presentNotificationNow(opts: {
  identifier?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  secondsFromNow?: number;
  categoryIdentifier?: string;
}): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted || !canScheduleNotifications()) return false;

  const seconds = Math.max(1, opts.secondsFromNow ?? 2);
  const data = opts.data ?? {};
  await Notifications.scheduleNotificationAsync({
    identifier: opts.identifier ?? `${QA_PREFIX}${Date.now()}`,
    content: {
      title: opts.title,
      body: opts.body,
      sound: 'default',
      data,
      ...(opts.categoryIdentifier ? { categoryIdentifier: opts.categoryIdentifier } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(Platform.OS === 'android' && opts.channelId ? { channelId: opts.channelId } : {}),
    },
  });
  void logPushEvent({
    source: data.qa ? 'qa' : 'local',
    key: String(data.templateKey || data.type || 'qa'),
    title: opts.title,
    body: opts.body,
  });
  return true;
}

/** Removes this device from admin push broadcasts. */
export async function unregisterPushFromServer(): Promise<void> {
  let token = await readLastPushToken();
  if (!token && Device.isDevice) {
    try {
      token = await fetchExpoPushToken();
    } catch {
      token = null;
    }
  }
  if (!token) return;
  try {
    await api.push.unregister(token);
  } catch {
    // Auth or network should not block the local opt-out.
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!canScheduleNotifications()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Native scheduler is unavailable on web.
  }
}

export async function cancelCycleReminders(): Promise<void> {
  await cancelNotificationsByPrefix(NOTIF_PREFIX.cycle);
}

type ScheduleCycleOpts = {
  identifier: string;
  title: string;
  body: string;
  date: Date;
  data?: Record<string, unknown>;
  privacyEnabled?: boolean;
};

async function resolveCycleNotificationContent(
  title: string,
  body: string,
  privacyEnabled = false,
) {
  const [prefs, engage] = await Promise.all([
    getCycleReminderPrefs(),
    loadEngagePrefs().catch(() => null),
  ]);
  const effective = getEffectiveCycleMask({
    privacyEnabled,
    maskNotifications: prefs.maskNotifications,
    discreet: Boolean(engage?.discreet),
  });
  if (effective.masked) {
    const discreet = applyPushCopy('cycle-masked');
    return {
      title: discreet.title,
      body: discreet.body,
      channelId: Platform.OS === 'android' ? CYCLE_DISCREET_CHANNEL_ID : undefined,
      masked: true,
    };
  }
  const channelId = Platform.OS === 'android' ? CYCLE_CHANNEL_ID : undefined;
  return { title, body, channelId, masked: false };
}

/** Schedule a one-time cycle notification at a specific local date/time. */
export async function scheduleCycleDateNotification(opts: ScheduleCycleOpts): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const now = Date.now();
  if (opts.date.getTime() <= now) return false;

  const content = await resolveCycleNotificationContent(opts.title, opts.body, opts.privacyEnabled);
  const candidateType = String(opts.data?.candidateType || 'log_nudge');
  const eventDate = String(opts.data?.eventDate || '');
  const payload = cyclePushPayload(
    {
      candidateId: String(opts.data?.candidateId || opts.identifier),
      type: candidateType,
      eventDate,
      templateKey: String(opts.data?.templateKey || 'cycle-log'),
      route: String(opts.data?.route || '/cycle'),
      estimated: opts.data?.estimated !== false,
      predicted: Boolean(opts.data?.predicted),
      revalidationKey: opts.data?.revalidationKey,
    },
    { masked: content.masked },
  );

  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIF_PREFIX.cycle}${opts.identifier}`,
    content: {
      title: content.title,
      body: content.body,
      sound: 'default',
      data: payload,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: opts.date,
      ...(Platform.OS === 'android' && content.channelId ? { channelId: content.channelId } : {}),
    },
  });

  return true;
}

/** One-off cycle wellness reminder (water, breathing, walk, etc.). */
export async function scheduleCycleReminder(opts: {
  title: string;
  body: string;
  minutesFromNow: number;
}): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const seconds = Math.max(60, Math.round(opts.minutesFromNow * 60));
  const identifier = `${NOTIF_PREFIX.cycle}tip:${Date.now()}`;
  const content = await resolveCycleNotificationContent(opts.title, opts.body);

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: content.title,
      body: content.body,
      sound: 'default',
      data: { type: 'cycle_tip', templateKey: 'cycle-tip', masked: content.masked, route: '/cycle', family: 'cycleReminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(Platform.OS === 'android' && content.channelId ? { channelId: content.channelId } : {}),
    },
  });

  return true;
}
