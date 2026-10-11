/**
 * Android: a reminder button that does not open the app („მივიღე ✓“, „დავლიე 💧“, „შემახსენე
 * მოგვიანებით“) tapped while the app is killed reaches no JS listener — expo-notifications only runs a
 * registered notification task, in a headless runtime that loads the whole bundle without a screen. The
 * task is defined when the bundle loads (index.js imports this file), so a headless runtime has it before
 * the event arrives. While the app runs in the background the task and AppShell's listener both get the
 * tap; runBackgroundNotificationAction handles it once.
 *
 * Every push that arrives while the app is not on screen runs the task too (expo runs notification tasks
 * for received pushes and for buttons): a push returns at once, before anything else is loaded. iOS needs
 * no task — its taps reach the listener (no `registerTaskAsync` there).
 */
import { Platform } from 'react-native';
import { taskNotificationResponse } from '@/lib/notificationTaps';

export const NOTIFICATION_ACTION_TASK = 'medicard-notification-action';

type TaskManagerModule = typeof import('expo-task-manager');

let TaskManager: TaskManagerModule | null = null;
try {
  // A bundle must never crash a binary that lacks the native module.
  TaskManager = Platform.OS === 'android' ? (require('expo-task-manager') as TaskManagerModule) : null;
} catch {
  TaskManager = null;
}

if (TaskManager) {
  try {
    TaskManager.defineTask(NOTIFICATION_ACTION_TASK, async ({ data }) => {
      const response = taskNotificationResponse(data);
      if (!response) return;
      const { runBackgroundNotificationAction } = await import('@/lib/notificationActionRunner');
      await runBackgroundNotificationAction(response);
    });
  } catch {
    TaskManager = null;
  }
}

/** Registers the task once per install (the registration persists); a no-op off Android or without the module. */
export async function registerNotificationActionTask(): Promise<void> {
  if (!TaskManager) return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(NOTIFICATION_ACTION_TASK)) return;
    const Notifications = await import('expo-notifications');
    await Notifications.registerTaskAsync(NOTIFICATION_ACTION_TASK);
  } catch {
    /* Expo Go or an older binary: the listener still handles taps while the app runs */
  }
}
