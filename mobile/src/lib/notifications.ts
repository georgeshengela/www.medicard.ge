import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ka } from '@/i18n/ka';
import { api } from './api';
import type { ScheduledDose } from './api';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { maskCycleNotificationContent } from '@/lib/cycleNotificationMask';

export const MED_CHANNEL_ID = 'medication-reminders';
export const CYCLE_CHANNEL_ID = 'cycle-reminders';
export const CYCLE_DISCREET_CHANNEL_ID = 'medicard-discreet';
export const PUSH_CHANNEL_ID = 'medicard-push';

export const NOTIF_PREFIX = {
  med: 'med:',
  cycle: 'cycle:',
  visit: 'visit:',
} as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  const status =
    existing.status === 'granted' ? existing.status : (await Notifications.requestPermissionsAsync()).status;

  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
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
  }

  return true;
}

/** Registers the device for admin broadcast push via Expo Push Service. */
export async function registerPushTokenWithServer(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted || !Device.isDevice) return false;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (!token?.startsWith('ExponentPushToken')) return false;

    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    await api.push.register({ token, platform });
    return true;
  } catch {
    return false;
  }
}

export async function cancelNotificationsByPrefix(prefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier?.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Rewrites medication daily reminders without touching cycle:* notifications.
 */
export async function syncMedicationReminders(schedule: ScheduledDose[]): Promise<number> {
  const granted = await requestNotificationPermission();
  if (!granted) return 0;

  await cancelNotificationsByPrefix(NOTIF_PREFIX.med);

  let scheduled = 0;
  for (const dose of schedule) {
    const [hour, minute] = dose.time.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

    const identifier = `${NOTIF_PREFIX.med}${dose.medicationId}:${dose.time}`;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: `${ka.meds.reminderTitle}: ${dose.medName}`,
        body: dose.notes ? `${dose.dosage} · ${dose.notes}` : dose.dosage,
        sound: 'default',
        data: { type: 'medication', medicationId: dose.medicationId, time: dose.time },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: MED_CHANNEL_ID } : {}),
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getScheduledReminderCounts(): Promise<{
  med: number;
  cycle: number;
  visit: number;
  total: number;
}> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  let med = 0;
  let cycle = 0;
  let visit = 0;

  for (const item of scheduled) {
    const id = item.identifier ?? '';
    if (id.startsWith(NOTIF_PREFIX.med)) med += 1;
    else if (id.startsWith(NOTIF_PREFIX.cycle)) cycle += 1;
    else if (id.startsWith(NOTIF_PREFIX.visit)) visit += 1;
  }

  return { med, cycle, visit, total: med + cycle + visit };
}

/** Removes this device from admin push broadcasts. */
export async function unregisterPushFromServer(): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    if (token?.startsWith('ExponentPushToken')) {
      await api.push.unregister(token);
    }
  } catch {
    // Token may be unavailable if permission was revoked.
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
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
};

async function resolveCycleNotificationContent(title: string, body: string) {
  const prefs = await getCycleReminderPrefs();
  const masked = maskCycleNotificationContent(
    { title, body },
    prefs.maskNotifications,
    prefs.maskStyle,
  );
  const channelId =
    Platform.OS === 'android'
      ? masked.masked
        ? CYCLE_DISCREET_CHANNEL_ID
        : CYCLE_CHANNEL_ID
      : undefined;
  return { title: masked.title, body: masked.body, channelId, masked: masked.masked };
}

/** Schedule a one-time cycle notification at a specific local date/time. */
export async function scheduleCycleDateNotification(opts: ScheduleCycleOpts): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const now = Date.now();
  if (opts.date.getTime() <= now) return false;

  const content = await resolveCycleNotificationContent(opts.title, opts.body);

  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIF_PREFIX.cycle}${opts.identifier}`,
    content: {
      title: content.title,
      body: content.body,
      sound: 'default',
      data: {
        type: 'cycle_reminder',
        masked: content.masked,
        ...(opts.data ?? {}),
      },
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
      data: { type: 'cycle_tip', masked: content.masked },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(Platform.OS === 'android' && content.channelId ? { channelId: content.channelId } : {}),
    },
  });

  return true;
}
