import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ka } from '@/i18n/ka';
import type { DoctorVisit } from '@/lib/api';
import { buildVisitReminderDates, doctorDisplayName } from '@/lib/visitReminders';
import { doctorTypeLabel, normalizeReminderConfig } from '@/constants/visits';
import { NOTIF_PREFIX, requestNotificationPermission } from '@/lib/notifications';

export const VISIT_CHANNEL_ID = 'doctor-visit-reminders';

async function ensureVisitChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(VISIT_CHANNEL_ID, {
    name: 'ექიმთან ვიზიტის შეხსენებები',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#14B8A6',
    sound: 'default',
  });
}

export async function syncVisitReminders(visits: DoctorVisit[]): Promise<number> {
  const granted = await requestNotificationPermission();
  if (!granted) return 0;

  await ensureVisitChannel();
  await cancelVisitReminders();

  let scheduled = 0;
  const active = visits.filter((v) => v.active);

  for (const visit of active) {
    const config = normalizeReminderConfig(visit.reminderConfig);
    const dates = buildVisitReminderDates(visit.visitDate, visit.visitTime, config);
    const typeLabel = doctorTypeLabel(visit.doctorType);
    const doctor = doctorDisplayName(visit, typeLabel);
    const place = visit.addressLabel || visit.address;

    for (let index = 0; index < dates.length; index += 1) {
      const date = dates[index];
      const id = `${NOTIF_PREFIX.visit}${visit.id}:${index}`;
      const body = place
        ? `${visit.visitTime} · ${place}`
        : `${visit.visitDate} ${visit.visitTime}`;

      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: `${ka.visits.reminderTitle}: ${doctor}`,
          body,
          sound: 'default',
          data: {
            type: 'visit_reminder',
            visitId: visit.id,
            route: '/visits',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          ...(Platform.OS === 'android' ? { channelId: VISIT_CHANNEL_ID } : {}),
        },
      });
      scheduled += 1;
    }
  }

  return scheduled;
}

export async function cancelVisitReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier?.startsWith(NOTIF_PREFIX.visit))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Native scheduler is unavailable on web.
  }
}
