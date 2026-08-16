import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { ka } from '@/i18n/ka';
import type { ScheduledDose } from './api';

const CHANNEL_ID = 'medication-reminders';

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
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'მედიკამენტების შეხსენებები',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#26A69A',
      sound: 'default',
    });
  }

  return true;
}

/**
 * Rewrites the full set of daily repeating reminders.
 *
 * We cancel and re-create rather than diffing: the schedule is small (at most a few
 * dozen doses) and a full rewrite is the only way to stay consistent with the server
 * after an edit, a pause or a delete.
 */
export async function syncMedicationReminders(schedule: ScheduledDose[]): Promise<number> {
  const granted = await requestNotificationPermission();
  if (!granted) return 0;

  await Notifications.cancelAllScheduledNotificationsAsync();

  let scheduled = 0;
  for (const dose of schedule) {
    const [hour, minute] = dose.time.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${ka.meds.reminderTitle}: ${dose.medName}`,
        body: dose.notes ? `${dose.dosage} · ${dose.notes}` : dose.dosage,
        sound: 'default',
        data: { medicationId: dose.medicationId, time: dose.time },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
