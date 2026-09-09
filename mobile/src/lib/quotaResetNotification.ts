import { Platform } from 'react-native';
import { Notifications } from '@/lib/expoNotifications';
import { bumpOutOfQuiet, DEFAULT_ENGAGE_PREFS } from '@/lib/mediEngageModel';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import { applyPushCopy } from '@/lib/pushCopy';
import { quotaResetKey, QUOTA_RESET_PREF, QUOTA_RESET_ROUTE, appendShownKey, parseShownKeys } from '@/lib/quotaReset';
import { getPreference, setPreference } from '@/lib/storage';
import type { Usage } from '@/lib/api';

export const QUOTA_RESET_ID = 'quota:reset';
export const QUOTA_NOTIF_CATEGORY = 'medi-quota';

export async function wasQuotaResetShown(resetKey: string | null | undefined): Promise<boolean> {
  if (!resetKey) return false;
  const list = parseShownKeys(await getPreference(QUOTA_RESET_PREF));
  return list.includes(resetKey);
}

export async function markQuotaResetShown(resetKey: string | null | undefined): Promise<void> {
  if (!resetKey) return;
  const raw = await getPreference(QUOTA_RESET_PREF);
  await setPreference(QUOTA_RESET_PREF, appendShownKey(raw, resetKey));
}

export async function cancelQuotaResetNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(QUOTA_RESET_ID);
  } catch {
    /* scheduler missing */
  }
}

async function resolveFireAt(resetAt: Date): Promise<Date> {
  const prefs = await loadEngagePrefs().catch(() => DEFAULT_ENGAGE_PREFS);
  return bumpOutOfQuiet(resetAt, prefs.quietStart, prefs.quietEnd);
}

/** Schedule a one-shot ping at the next refill. Keeps an already-queued morning ping if usage is already full. */
export async function syncQuotaResetNotification(usage: Usage | null | undefined): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!usage || usage.unlimited || usage.limit <= 0) {
    await cancelQuotaResetNotification();
    return false;
  }
  if (usage.used === 0 && !usage.exceeded) return false;
  if (!usage.resetAt) {
    await cancelQuotaResetNotification();
    return false;
  }

  const resetAt = new Date(usage.resetAt);
  if (Number.isNaN(resetAt.getTime())) return false;
  const fireAt = await resolveFireAt(resetAt);
  if (fireAt.getTime() <= Date.now() + 1500) return false;

  const resetKey = quotaResetKey(usage);
  if (await wasQuotaResetShown(resetKey)) {
    await cancelQuotaResetNotification();
    return false;
  }

  const copy = applyPushCopy(usage.exceeded ? 'quota-reset-lock' : 'quota-reset', {
    limit: usage.limit,
  });

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: QUOTA_RESET_ID,
      content: {
        title: copy.title,
        body: copy.body,
        sound: 'default',
        categoryIdentifier: QUOTA_NOTIF_CATEGORY,
        data: {
          type: 'quota_reset',
          family: 'quotaReset',
          templateKey: usage.exceeded ? 'quota-reset-lock' : 'quota-reset',
          route: QUOTA_RESET_ROUTE,
          resetKey,
          limit: usage.limit,
          remaining: usage.limit,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(Platform.OS === 'android' ? { channelId: 'medicard-push' } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}
