import type { NotificationResponse } from 'expo-notifications';
import { settleBackgroundWork } from '@/lib/backgroundWork';
import { handleNotificationAction, type NotificationActionResult } from '@/lib/mediNotificationActions';
import { notificationResponseKey } from '@/lib/notificationPlan';
import { claimBackgroundAction, claimNotificationTap } from '@/lib/notificationTaps';
import { releaseNotificationWake } from '@/lib/notificationWake';

/**
 * A button answered without opening the app („მივიღე ✓“, „დავლიე 💧“, „შემახსენე მოგვიანებით“), from
 * AppShell's listener or Android's notification task (notificationActionTask.ts). Each tap is handled
 * once, also across runtimes of one process, and the work it starts (the dose event's outbox write and
 * send) is finished before this resolves: the runtime may end right after. Null for a repeat.
 */
export async function runBackgroundNotificationAction(response: NotificationResponse): Promise<NotificationActionResult | null> {
  const key = notificationResponseKey(response);
  if (!claimNotificationTap(key)) return null;
  try {
    if (!(await claimBackgroundAction(key))) return null;
    const result = await handleNotificationAction(response);
    await settleBackgroundWork();
    return result;
  } finally {
    releaseNotificationWake();
  }
}
