import { Platform } from 'react-native';
import { Notifications } from '@/lib/expoNotifications';
import { addHydrationLog, todayYmd } from '@/lib/hydration';
import { saveDoseLog } from '@/lib/medications.shared';
import { markEngageOpened } from '@/lib/mediEngagePrefs';
import { HYDRATION_DROP_ML } from '@/types/hydration';

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
      { identifier: NOTIF_ACTION.take, buttonTitle: 'მივიღე ✓', options: { opensAppToForeground: false } },
      { identifier: NOTIF_ACTION.snooze, buttonTitle: 'შემახსენე მოგვიანებით', options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.hydration, [
      { identifier: NOTIF_ACTION.drank, buttonTitle: 'დავლიე 💧', options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.checkin, [
      { identifier: NOTIF_ACTION.ok, buttonTitle: 'კარგად ვარ 💚', options: { opensAppToForeground: false } },
      { identifier: NOTIF_ACTION.chat, buttonTitle: 'Medi-სთან საუბარი', options: { opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.visit, [
      { identifier: NOTIF_ACTION.open, buttonTitle: 'გახსნა', options: { opensAppToForeground: true } },
      { identifier: NOTIF_ACTION.snooze, buttonTitle: 'შემახსენე მოგვიანებით', options: { opensAppToForeground: false } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.quota, [
      { identifier: NOTIF_ACTION.chat, buttonTitle: 'ჰკითხე Medi-ს', options: { opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIF_CATEGORY.petCare, [
      { identifier: NOTIF_ACTION.petDone, buttonTitle: 'დადასტურება', options: { opensAppToForeground: true } },
      { identifier: NOTIF_ACTION.snooze, buttonTitle: 'გადადება', options: { opensAppToForeground: false } },
      { identifier: NOTIF_ACTION.petSkip, buttonTitle: 'გამოტოვება', options: { opensAppToForeground: true } },
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

async function snooze(content: Notifications.NotificationContent, minutes = 20): Promise<void> {
  const data = (content.data ?? {}) as Record<string, unknown>;
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze:${Date.now()}`,
    content: {
      title: content.title ?? '',
      body: content.body ?? '',
      sound: 'default',
      data,
      categoryIdentifier: content.categoryIdentifier,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
    },
  });
}

export async function handleNotificationAction(
  response: Notifications.NotificationResponse,
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
    return { navigate: true };
  }

  if (data.type === 'medi_engage') void markEngageOpened(family, key, action);

  if (action === NOTIF_ACTION.take && typeof data.medicationId === 'string') {
    await saveDoseLog({
      medicationId: data.medicationId,
      date: todayYmd(),
      time: typeof data.time === 'string' ? data.time : '08:00',
      status: 'taken',
      updatedAt: new Date().toISOString(),
    }, 'notification');
    return { navigate: false };
  }

  if (action === NOTIF_ACTION.drank) {
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

  if (action === NOTIF_ACTION.ok) {
    return { navigate: false };
  }

  if (action === NOTIF_ACTION.chat) {
    return { navigate: true, route: '/chat/DOCTOR' };
  }

  if (action === NOTIF_ACTION.open) {
    return { navigate: true };
  }

  return { navigate: true };
}
