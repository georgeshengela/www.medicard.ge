/**
 * MEDIBOOK local reminders: the evening before (same clock, −24 h) and two hours before every upcoming
 * booking. Scheduled on the phone like doctor visits, under the same Profile → შეტყობინებები „ვიზიტები“
 * switch (reminderPrefs family `visits`), prefix `book:`; the server only pushes changes (confirmed,
 * moved, cancelled). Re-synced from the bookings list on the hub, after sign-in and on every foreground
 * (reminderReconcile.ts).
 */
import { Platform } from 'react-native';
import { Notifications } from '@/lib/expoNotifications';
import { isReminderFamilyOn } from '@/lib/reminderPrefs';
import { NOTIF_PREFIX, VISIT_CHANNEL_ID, cancelNotificationsByPrefix, getNotificationPermissionGranted } from '@/lib/notifications';
import { tx } from '../../i18n/locale.js';
import type { BookAppointment } from './bookTypes';
import { clockOf, isUpcoming } from './bookFormat';

const HOUR = 3600_000;

/** Pure: the reminder instants of one booking that are still ahead. */
export function bookReminderDates(a: Pick<BookAppointment, 'startsAt'>, now = new Date()): Array<{ at: Date; kind: 'day' | 'soon' }> {
  const start = new Date(a.startsAt).getTime();
  const out: Array<{ at: Date; kind: 'day' | 'soon' }> = [];
  const day = start - 24 * HOUR;
  const soon = start - 2 * HOUR;
  if (day > now.getTime() + 60_000) out.push({ at: new Date(day), kind: 'day' });
  if (soon > now.getTime() + 60_000) out.push({ at: new Date(soon), kind: 'soon' });
  return out;
}

export async function syncBookReminders(appointments: BookAppointment[]): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const granted = await getNotificationPermissionGranted();
  if (!granted) return 0;
  await cancelNotificationsByPrefix(NOTIF_PREFIX.book);
  if (!(await isReminderFamilyOn('visits'))) return 0;
  const now = new Date();
  let scheduled = 0;
  for (const a of appointments.filter((x) => isUpcoming(x, now)).slice(0, 20)) {
    const place = a.business?.name ?? '';
    for (const r of bookReminderDates(a, now)) {
      const id = `${NOTIF_PREFIX.book}${a.id}:${r.kind}`;
      const title = r.kind === 'soon' ? tx(`${a.serviceName} 2 საათში`, `${a.serviceName} in 2 hours`) : tx('ხვალ ჯავშანი გაქვს', 'You have a booking tomorrow');
      const body = r.kind === 'soon'
        ? tx(`${place} · ${clockOf(a.startsAt)}${a.business?.address ? ` · ${a.business.address}` : ''}`, `${place} · ${clockOf(a.startsAt)}${a.business?.address ? ` · ${a.business.address}` : ''}`)
        : tx(`${place} · ${a.serviceName} · ${clockOf(a.startsAt)}. თუ ვერ მოხვალ, გააუქმე დროულად.`, `${place} · ${a.serviceName} · ${clockOf(a.startsAt)}. Cancel in time if you cannot make it.`);
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title,
            body,
            sound: 'default',
            data: { type: 'book_reminder', appointmentId: a.id, route: `/book/appointments/${a.id}` },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: r.at,
            ...(Platform.OS === 'android' ? { channelId: VISIT_CHANNEL_ID } : {}),
          },
        });
        scheduled += 1;
      } catch {
        /* one bad date must not cost the other bookings their reminders */
      }
    }
  }
  return scheduled;
}
