import type * as ExpoNotificationTypes from 'expo-notifications';
import { Platform } from 'react-native';
import { Notifications } from '@/lib/expoNotifications';
import { addHydrationLog, todayYmd } from '@/lib/hydration';
import { ensureLocalAccountScope, saveDoseLog } from '@/lib/medications.shared';
import { medicationDoseRoute, notificationDoseEntry } from '@/lib/notificationDose';
import { markEngageOpened } from '@/lib/mediEngagePrefs';
import { HYDRATION_DROP_ML } from '@/types/hydration';
import { tx } from '../i18n/locale.js';

export const NOTIF_CATEGORY = {
  medication: 'medi-med',
  hydration: 'medi-hydration',
  checkin: 'medi-checkin',
  visit: 'medi-visit',
  quota: 'medi-quota',
  petCare: 'medi-pet-care',
} as const;

export const NOTIF_ACTION = {
  take: 'TAKE',
  snooze: 'SNOOZE',
  drank: 'DRANK',
  /** Legacy „კარგად ვარ“ on check-ins: no longer offered (it saved nothing); old taps are a no-op. */
  ok: 'OK',
  chat: 'CHAT',
  open: 'OPEN',
  petDone: 'PET_DONE',
  petSkip: 'PET_SKIP',
} as const;

export function categoryForNotification(type?: string, family?: string): string | undefined {
  if (type === 'medication') return NOTIF_CATEGORY.medication;
  if (type === 'visit_reminder' || family === 'visitFollowup') return NOTIF_CATEGORY.visit;
  if (family === 'hydration') return NOTIF_CATEGORY.hydration;
  if (family === 'checkin' || family === 'morning' || family === 'sleep') return NOTIF_CATEGORY.checkin;
  if (type === 'quota_reset' || family === 'quotaReset') return NOTIF_CATEGORY.quota;
  if (type === 'pet_care' || family === 'petCareReminder') return NOTIF_CATEGORY.petCare;
  return undefined;
}

export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.medication, [
      { identifier: NOTIF_ACTION.take, buttonTitle: tx('მივიღე ✓', 'Taken ✓'), options: { opensAppToForeground: false } },
      { identifier: NOTIF_ACTION.snooze, buttonTitle: tx('შემახსენე მოგვიანებით', 'Remind me later'), options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.hydration, [
      { identifier: NOTIF_ACTION.drank, buttonTitle: tx('დავლიე 💧', 'Drank it 💧'), options: { opensAppToForeground: false } },
    ]);
    // No „კარგად ვარ“ button: there is no check-in record to save it to, and a button that
    // saves nothing is misleading. Re-registering replaces the old category on the device.
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.checkin, [
      { identifier: NOTIF_ACTION.chat, buttonTitle: tx('Medi-სთან საუბარი', 'Talk to Medi'), options: { opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.visit, [
      { identifier: NOTIF_ACTION.open, buttonTitle: tx('გახსნა', 'Open'), options: { opensAppToForeground: true } },
      { identifier: NOTIF_ACTION.snooze, buttonTitle: tx('შემახსენე მოგვიანებით', 'Remind me later'), options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.quota, [
      { identifier: NOTIF_ACTION.chat, buttonTitle: tx('ჰკითხე Medi-ს', 'Ask Medi'), options: { opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.petCare, [
      { identifier: NOTIF_ACTION.petDone, buttonTitle: tx('დადასტურება', 'Confirm'), options: { opensAppToForeground: true } },
      { identifier: NOTIF_ACTION.snooze, buttonTitle: tx('გადადება', 'Snooze'), options: { opensAppToForeground: false } },
      { identifier: NOTIF_ACTION.petSkip, buttonTitle: tx('გამოტოვება', 'Skip'), options: { opensAppToForeground: true } },
    ]);
  } catch {
    /* categories are best-effort on Expo Go */
  }
}

export type NotificationActionResult = {
  navigate: boolean;
  route?: string;
};

function isDefaultAction(id: string): boolean {
  return (
    id === Notifications.DEFAULT_ACTION_IDENTIFIER ||
    id === 'expo.modules.notifications.actions.DEFAULT' ||
    id === ''
  );
}

async function snooze(content: ExpoNotificationTypes.NotificationContent, minutes = 20): Promise<void> {
  const data = (content.data ?? {}) as Record<string, unknown>;
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze:${Date.now()}`,
    content: {
      title: content.title ?? '',
      body: content.body ?? '',
      sound: 'default',
      data,
      categoryIdentifier: content.categoryIdentifier ?? undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
    },
  });
}

export async function handleNotificationAction(
  response: ExpoNotificationTypes.NotificationResponse,
): Promise<NotificationActionResult> {
  const content = response.notification.request.content;
  const data = (content.data ?? {}) as Record<string, unknown>;
  const action = response.actionIdentifier;
  const family = String(data.family || data.type || '');
  const key = String(data.templateKey || data.type || 'unknown');

  const decisionId = typeof data.decisionId === 'string' ? data.decisionId : '';
  if (decisionId.startsWith('notif_dec_')) {
    void import('@/lib/productObservability').then(({ syncNotificationOutcome }) =>
      syncNotificationOutcome({ decisionId, action: isDefaultAction(action) ? 'open' : action }),
    );
  }
  if (family === 'insight' || key.startsWith('engage-insight')) {
    void import('@/lib/productObservability').then(({ syncInsightOutcome }) =>
      syncInsightOutcome(isDefaultAction(action) ? 'insight_opened' : 'insight_actioned', decisionId || key, family),
    );
  }

  if (isDefaultAction(action)) {
    if (data.type === 'medi_engage') void markEngageOpened(family, key, 'open');
    // A medication reminder opens the reminded dose (its slot and day), also for reminders scheduled
    // by older versions whose route named only the medication.
    if (data.type === 'medication') {
      const route = medicationDoseRoute(data, response.notification.date, Date.now());
      if (route) return { navigate: true, route };
    }
    return { navigate: true };
  }

  if (data.type === 'medi_engage') void markEngageOpened(family, key, action);

  // „მივიღე ✓“ marks the dose the reminder was for: dated by when it was delivered (a 23:30 dose
  // answered after midnight is still that evening's), saved even when the tap launched the app before
  // sign-in finished (saveDoseLog resolves the account or queues the mark), and shown at once.
  const dose = action === NOTIF_ACTION.take ? notificationDoseEntry(data, response.notification.date, Date.now()) : null;
  if (dose) {
    await saveDoseLog(dose, 'notification');
    void import('@/lib/queryClient').then(({ invalidate }) => invalidate('medications'));
    return { navigate: false };
  }

  if (action === NOTIF_ACTION.drank) {
    // Water is stored per account too; on a cold start the account is not set yet.
    await ensureLocalAccountScope();
    await addHydrationLog({
      date: todayYmd(),
      ml: HYDRATION_DROP_ML,
      container: 'small',
      drink: 'water',
      color: '#14B8A6',
    });
    return { navigate: false };
  }

  if (action === NOTIF_ACTION.snooze) {
    if (data.type === 'pet_care' || data.family === 'petCareReminder') {
      void import('@/lib/petCareReminders').then(({ snoozePetCareCandidate, recordPetCareUserResponse }) => {
        void recordPetCareUserResponse(data);
        void snoozePetCareCandidate(data);
      });
      return { navigate: false };
    }
    await snooze(content);
    return { navigate: false };
  }

  if (action === NOTIF_ACTION.petDone || action === NOTIF_ACTION.petSkip) {
    void import('@/lib/petCareReminders').then(({ recordPetCareUserResponse }) => recordPetCareUserResponse(data));
    const petId = typeof data.petId === 'string' ? data.petId : '';
    const scheduleId = typeof data.scheduleId === 'string' ? data.scheduleId : '';
    const occurrenceKey = typeof data.occurrenceKey === 'string' ? data.occurrenceKey : '';
    const revision = data.revision;
    if (petId && scheduleId && occurrenceKey) {
      const qs = new URLSearchParams({
        scheduleId,
        occurrenceKey,
        revision: String(revision ?? ''),
        action: action === NOTIF_ACTION.petSkip ? 'skip' : 'complete',
      });
      return { navigate: true, route: `/pets/${petId}/care/complete?${qs.toString()}` };
    }
    return { navigate: true };
  }

  // A notification delivered before the button was removed can still carry it.
  if (action === NOTIF_ACTION.ok) {
    return { navigate: false };
  }

  if (action === NOTIF_ACTION.chat) {
    return { navigate: true, route: '/assistant?mode=doctor' };
  }

  if (action === NOTIF_ACTION.open) {
    return { navigate: true };
  }

  return { navigate: true };
}
