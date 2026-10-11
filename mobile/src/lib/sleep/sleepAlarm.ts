import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import { tx } from '@/i18n/locale';
import { SLEEP_ALARM_CHANNEL_ID, SLEEP_ALARM_PREFIX, getNotificationPermissionGranted } from '@/lib/notifications';

/**
 * The MEDISLEEP wake-up. iOS 26+: a real system alarm through AlarmKit (mobile/modules/sleep-alarm,
 * MedicardSleepAlarm) — it rings through silent mode and Focus and shows on the lock screen, even if the app
 * was closed. Elsewhere (Android, older iOS, a denied AlarmKit): a time-sensitive local notification with the
 * gentle MEDISLEEP sound — honest copy says it follows the phone's sound settings.
 */
type AlarmModule = {
  isAvailable(): boolean;
  authorizationState(): Promise<'authorized' | 'denied' | 'notDetermined' | 'unavailable'>;
  requestAuthorization(): Promise<boolean>;
  schedule(timestamp: number, title: string, stopLabel: string, tint: string, sound: string | null): Promise<string>;
  cancel(id: string): Promise<boolean>;
};

export const SLEEP_ALARM_SOUND = 'medisleep_dawn.wav';

function nativeAlarm(): AlarmModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const mod = requireOptionalNativeModule<AlarmModule>('MedicardSleepAlarm');
    return mod && mod.isAvailable() ? mod : null;
  } catch {
    return null;
  }
}

export type AlarmKind = 'alarmkit' | 'notification';
export type AlarmAccess = 'ready' | 'ask' | 'denied' | 'notification';

/** What turning the alarm on needs: nothing, a one-button primer (AlarmKit not asked yet), or notifications. */
export async function sleepAlarmAccess(): Promise<AlarmAccess> {
  const mod = nativeAlarm();
  if (mod) {
    const state = await mod.authorizationState().catch(() => 'unavailable' as const);
    if (state === 'authorized') return 'ready';
    if (state === 'notDetermined') return 'ask';
    if (state === 'denied') return 'denied';
  }
  return (await getNotificationPermissionGranted()) ? 'notification' : 'denied';
}

/** Only from a button press (OS permission rule): the AlarmKit system sheet. */
export async function requestSleepAlarmAccess(): Promise<boolean> {
  const mod = nativeAlarm();
  if (!mod) return false;
  return mod.requestAuthorization().catch(() => false);
}

export function sleepAlarmIsSystemAlarm(): boolean {
  return nativeAlarm() !== null;
}

/** Schedules the wake-up; returns what was set so it can be cancelled. */
export async function scheduleSleepAlarm(at: Date): Promise<{ kind: AlarmKind; id: string } | null> {
  if (at.getTime() <= Date.now() + 60_000) return null;
  const mod = nativeAlarm();
  if (mod && (await mod.authorizationState().catch(() => 'unavailable')) === 'authorized') {
    try {
      const id = await mod.schedule(at.getTime() / 1000, tx('დილა მშვიდობისა', 'Good morning'), tx('გავიღვიძე', "I'm up"), '#9A4FD6', SLEEP_ALARM_SOUND);
      if (id) return { kind: 'alarmkit', id };
    } catch {
      /* fall back to a notification */
    }
  }
  if (!(await getNotificationPermissionGranted())) return null;
  const id = `${SLEEP_ALARM_PREFIX}${at.getTime()}`;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: tx('დილა მშვიდობისა ☀️', 'Good morning ☀️'),
        body: tx('გაღვიძების დროა. შეეხე და დაასრულე ძილის რეჟიმი.', "Time to wake up. Tap to end sleep mode."),
        sound: Platform.OS === 'ios' ? SLEEP_ALARM_SOUND : 'medisleep_dawn.wav',
        interruptionLevel: 'timeSensitive',
        data: { type: 'sleep_alarm', route: '/sleep/night' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        ...(Platform.OS === 'android' ? { channelId: SLEEP_ALARM_CHANNEL_ID } : {}),
      },
    });
    return { kind: 'notification', id };
  } catch {
    return null;
  }
}

export async function cancelSleepAlarm(alarm: { kind: AlarmKind; id: string } | null | undefined): Promise<void> {
  if (!alarm) return;
  if (alarm.kind === 'alarmkit') {
    await nativeAlarm()?.cancel(alarm.id).catch(() => false);
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(alarm.id).catch(() => undefined);
}
