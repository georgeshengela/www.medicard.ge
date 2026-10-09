import type * as ExpoNotificationTypes from 'expo-notifications';
import { Notifications } from '@/lib/expoNotifications';
export { isNotificationsNativeAvailable } from '@/lib/expoNotifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { AppState, Platform } from 'react-native';
import { ApiError, api } from './api';
import type { Medication, ScheduledDose } from './api';
import { localAccountId } from './localAccount';
import { isReminderFamilyOn } from './reminderPrefs';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import {
  cyclePushPayload,
  getEffectiveCycleMask,
  redactCyclePushLog,
} from '@/lib/cycleNotificationContract.js';
import { loadDoseLogs, parseMedicationConfig } from '@/lib/medications.shared';
import {
  movedDoseReminderId,
  planMedicationReminderSlots,
  planMovedDoseReminders,
  prefixForNotificationId,
  type MovedDoseReminder,
} from '@/lib/notificationPlan';
import { applyPushCopy, logPushEvent } from '@/lib/pushCopy';
import {
  notificationResponseIsGranted,
  notificationResponseStatus,
} from '@/lib/notificationPermission.js';
import { resolvePermissionsPageToggle } from '@/lib/pushOptIn';
import { getPreference, setPreference } from '@/lib/storage';
import { dateLocale, tx } from '../i18n/locale.js';

export const MED_CHANNEL_ID = 'medication-reminders';
// v2 (2026-10-02): recreated at HIGH importance so reminders show a banner; Android cannot raise an existing channel.
export const CYCLE_CHANNEL_ID = 'cycle-reminders-v2';
export const CYCLE_DISCREET_CHANNEL_ID = 'medicard-discreet';
export const PUSH_CHANNEL_ID = 'medicard-push';
export const STEPS_CHANNEL_ID = 'steps-reminders-v2';
export const WEIGHT_CHANNEL_ID = 'weight-reminders-v2';
export const VISIT_CHANNEL_ID = 'doctor-visit-reminders';
export const ENGAGE_CHANNEL_ID = 'medi-engage';
export const PET_CARE_CHANNEL_ID = 'pet-care-reminders';
export const NUTRITION_CHANNEL_ID = 'nutrition-reminders-v2';
export const QA_PREFIX = 'qa:';

export const NOTIF_PREFIX = {
  med: 'med:',
  cycle: 'cycle:',
  pregnancyCare: 'pregnancy_care:',
  visit: 'visit:',
  steps: 'steps:',
  weight: 'weight:',
  engage: 'engage:',
  quota: 'quota:',
  pets: 'pets:',
  nutrition: 'nutrition:',
  fasting: 'fasting:',
} as const;

function flagOn(value: unknown) {
  return value === true || value === 1 || value === 'true' || value === '1';
}

function isRemoteAdminPush(data: Record<string, unknown>) {
  return (
    flagOn(data.qa) ||
    data.type === 'admin_broadcast' ||
    data.source === 'broadcast' ||
    data.family === 'adminBroadcast'
  );
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
    try {
      // iOS APNs stringifies data booleans, so qa:"true" must still show a banner.
      if (isRemoteAdminPush(data)) {
        return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
      }
      if (data.type === 'quota_reset' || data.family === 'quotaReset') {
        const resetKey = typeof data.resetKey === 'string' ? data.resetKey : null;
        const { wasQuotaResetShown, markQuotaResetShown } = await import('@/lib/quotaResetNotification');
        const shown = await wasQuotaResetShown(resetKey);
        const hideBanner = shown || AppState.currentState === 'active';
        if (!shown && !hideBanner) void markQuotaResetShown(resetKey);
        return {
          shouldShowBanner: !hideBanner,
          shouldShowList: !shown,
          shouldPlaySound: !hideBanner,
          shouldSetBadge: false,
        };
      }
      const { shouldDeliverNotification } = await import('@/lib/mediNotificationBrain');
      const { patchEngageDecision } = await import('@/lib/mediEngagePrefs');
      const check = await shouldDeliverNotification(data);
      if (check.rewriteMasked && (data.type === 'cycle_reminder' || data.type === 'pregnancy_care_plan' || data.type === 'pet_care') && data.rewrite !== true) {
        const discreet =
          data.type === 'pregnancy_care_plan'
            ? applyPushCopy('pregnancy-care-masked')
            : data.type === 'pet_care'
              ? applyPushCopy('pet-care-masked')
              : applyPushCopy('cycle-masked');
        void Notifications.scheduleNotificationAsync({
          identifier: `${data.type === 'pregnancy_care_plan' ? 'pregnancy_care' : data.type === 'pet_care' ? 'pets' : 'cycle'}:mask-rewrite:${String(data.candidateId || Date.now())}`,
          content: {
            title: discreet.title,
            body: discreet.body,
            sound: true,
            data: {
              ...data,
              masked: true,
              rewrite: true,
              templateKey:
                data.type === 'pregnancy_care_plan'
                  ? 'pregnancy-care-masked'
                  : data.type === 'pet_care'
                    ? 'pet-care-masked'
                    : 'cycle-masked',
            },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
        });
        return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
      }
      if (!check.ok) {
        const id = typeof data.decisionId === 'string' ? data.decisionId : '';
        if (id && check.reason !== 'DELIVER_WITH_DISCREET_COPY') {
          void patchEngageDecision(id, {
            decision: 'BLOCKED',
            blocked: check.reason,
            reason: check.reason,
            revalidatedAt: new Date().toISOString(),
          });
          void import('@/lib/productObservability').then(({ syncNotificationOutcome }) =>
            syncNotificationOutcome({ decisionId: id, outcome: 'cancelled_by_revalidation' }),
          );
        }
        return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
      }
    } catch {
      /* deliver if revalidation cannot run */
    }
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
  },
});

export async function getNotificationPermissionGranted(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted = notificationResponseIsGranted(existing);
    // Channels must exist before the first reminder is scheduled into them (once per app run).
    if (granted) await ensureAndroidChannelsOnce();
    return granted;
  } catch {
    return false;
  }
}

let channelsReady: Promise<void> | null = null;
function ensureAndroidChannelsOnce(): Promise<void> {
  if (!channelsReady) channelsReady = ensureAndroidChannels().catch(() => { channelsReady = null; });
  return channelsReady;
}

/** Pre-v2 channels were DEFAULT importance (no banner); remove them so Settings shows one entry each. */
const RETIRED_CHANNEL_IDS = ['cycle-reminders', 'steps-reminders', 'weight-reminders', 'nutrition-reminders'];

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const remove = (Notifications as unknown as { deleteNotificationChannelAsync?: (id: string) => Promise<void> }).deleteNotificationChannelAsync;
  if (remove) await Promise.all(RETIRED_CHANNEL_IDS.map((id) => remove(id).catch(() => undefined)));
  await Notifications.setNotificationChannelAsync(MED_CHANNEL_ID, {
    name: tx('მედიკამენტების შეხსენებები', 'Medication reminders'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CYCLE_CHANNEL_ID, {
    name: tx('ციკლის შეხსენებები', 'Cycle reminders'),
    importance: Notifications.AndroidImportance.HIGH,
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
    name: tx('Medicard შეტყობინებები', 'Medicard notifications'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(STEPS_CHANNEL_ID, {
    name: tx('ნაბიჯების შეხსენებები', 'Step reminders'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(NUTRITION_CHANNEL_ID, {
    name: tx('კვების შეხსენებები', 'Nutrition reminders'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(WEIGHT_CHANNEL_ID, {
    name: tx('წონის შეხსენებები', 'Weight reminders'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(VISIT_CHANNEL_ID, {
    name: tx('ექიმთან ვიზიტის შეხსენებები', 'Doctor visit reminders'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(ENGAGE_CHANNEL_ID, {
    name: 'Medi',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 160, 100, 160],
    lightColor: '#14B8A6',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(PET_CARE_CHANNEL_ID, {
    name: tx('ცხოველის მოვლის შეხსენებები', 'Pet care reminders'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#14B8A6',
    sound: 'default',
  });
}

/** Right after a grant: every reminder family that waited for permission is scheduled at once. */
function scheduleEverythingAfterGrant() {
  setTimeout(() => {
    void import('@/lib/reminderReconcile').then(({ reconcileAllLocalReminders }) => reconcileAllLocalReminders({ force: true })).catch(() => undefined);
    void import('@/lib/petCareReminders').then(({ reconcilePetCareReminders }) => reconcilePetCareReminders({ reason: 'permission' })).catch(() => undefined);
    void import('@/lib/queryClient').then(({ invalidate }) => invalidate('medications')).catch(() => undefined);
    const owner = localAccountId();
    if (owner) void import('@/lib/cycleReminders').then(({ reconcileCycleReminders }) => reconcileCycleReminders(owner, { force: true })).catch(() => undefined);
  }, 0);
}

export async function requestNotificationPermission(): Promise<boolean> {
  // iOS 26 only shows Allow if this is the first await on the tap.
  // Do not read current status or setState first — that poisons denied
  // with no sheet, so Settings never grows a Notifications row
  // (only Siri, Search, Mobile Data).
  try {
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    void ensureAndroidChannels();
    void import('@/lib/mediNotificationActions').then((mod) => mod.registerNotificationCategories());
    const granted = notificationResponseIsGranted(next);
    if (granted) {
      await rememberOsNotificationGrant();
      scheduleEverythingAfterGrant();
    }
    return granted;
  } catch {
    try {
      const next = await Notifications.requestPermissionsAsync();
      const granted = notificationResponseIsGranted(next);
      if (granted) await rememberOsNotificationGrant();
      return granted;
    } catch {
      return false;
    }
  }
}

export async function notificationCanAskAgain(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (notificationResponseIsGranted(existing)) return false;
    return existing.canAskAgain !== false;
  } catch {
    return true;
  }
}

export type PushRegisterReason = 'permission' | 'simulator' | 'expo_go' | 'token' | 'auth' | 'network';

export type PushRegisterResult = { ok: true } | { ok: false; reason: PushRegisterReason; detail?: string };

const PUSH_OPTED_IN_KEY = 'medicard.push.optedIn';
const PUSH_OS_GRANTED_KEY = 'medicard.push.osGranted';
const PUSH_LAST_TOKEN_KEY = 'medicard.push.lastToken';
const FALLBACK_EAS_PROJECT_ID = '7dd7dc9b-9e05-4e8c-a26e-8fc6800dc492';
const PUSH_TOKEN_WAIT_MS = 45_000;

function pushProjectId(): string {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    FALLBACK_EAS_PROJECT_ID
  );
}

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

export async function getPushOptedInStored(): Promise<string | null> {
  return getPreference(PUSH_OPTED_IN_KEY);
}

export async function getRememberedOsNotificationGrant(): Promise<boolean> {
  if ((await getPreference(PUSH_OS_GRANTED_KEY)) === '1') return true;
  // Allowed on an older build or later in the phone's Settings: the flag was never written, so push was
  // skipped forever. Read (never request) the live permission and remember a grant.
  try {
    if (notificationResponseIsGranted(await Notifications.getPermissionsAsync())) {
      await rememberOsNotificationGrant();
      return true;
    }
  } catch {
    /* native module unavailable (web) */
  }
  return false;
}

export async function rememberOsNotificationGrant(): Promise<void> {
  await setPreference(PUSH_OS_GRANTED_KEY, '1');
}

export async function isPushOptedIn(): Promise<boolean> {
  const stored = await getPushOptedInStored();
  if (stored === '0') return false;
  if (stored === '1') return true;
  return getRememberedOsNotificationGrant();
}

export async function setPushOptedIn(on: boolean): Promise<void> {
  await setPreference(PUSH_OPTED_IN_KEY, on ? '1' : '0');
}

export async function isNotificationsEnabled(): Promise<boolean> {
  const stored = await getPushOptedInStored();
  const remembered = await getRememberedOsNotificationGrant();
  return resolvePermissionsPageToggle(stored, remembered);
}

/** Registers only when the user has not opted out. Used on login / resume. */
export async function syncPushRegistration(): Promise<void> {
  if (!(await isPushOptedIn())) return;
  await registerPushTokenWithServer({ skipPermissionProbe: true });
}

async function saveLastPushToken(token: string): Promise<void> {
  await setPreference(PUSH_LAST_TOKEN_KEY, token);
}

async function readLastPushToken(): Promise<string | null> {
  return getPreference(PUSH_LAST_TOKEN_KEY);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function canAttemptRemotePush(): boolean {
  if (Platform.OS === 'web') return false;
  if (Device.isDevice) return true;
  // Android emulators with Google Play services receive FCM like a phone, so QA can test
  // push there; an image without Play services makes the token call throw, which is caught.
  if (Platform.OS === 'android') return true;
  // Some Expo Go iOS builds report isDevice=false on a real phone.
  return Platform.OS === 'ios' && isRunningInExpoGo();
}

function expoNotificationsNative() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return Notifications;
  }
}

let pushTokenListenerAttached = false;

function ensurePushTokenListener(native: {
  addPushTokenListener?: (listener: (token: unknown) => void) => { remove?: () => void };
}) {
  // SDK 53–57: the native device-token promise inside getExpoPushTokenAsync can
  // hang unless a JS listener exists. Keep it for the whole JS session — do not
  // add/remove around a timeout, or that native promise stays stuck.
  if (pushTokenListenerAttached) return;
  if (typeof native.addPushTokenListener !== 'function') return;
  native.addPushTokenListener(() => undefined);
  pushTokenListenerAttached = true;
}

async function fetchExpoPushToken(): Promise<string | null> {
  const native = expoNotificationsNative();
  const getToken = native.getExpoPushTokenAsync?.bind(native);
  if (typeof getToken !== 'function') {
    throw new Error('getExpoPushTokenAsync unavailable');
  }

  ensurePushTokenListener(native);
  const projectId = pushProjectId();
  // Do not force sandbox APNs. App Store Expo Go uses production;
  // a sandbox mint still returns a token, then admin send looks OK and Apple drops it.
  const tokenResult = await withTimeout(
    getToken({ projectId }),
    PUSH_TOKEN_WAIT_MS,
    'expo push token timeout',
  );
  const token = typeof tokenResult === 'string' ? tokenResult : tokenResult && typeof tokenResult === 'object' && 'data' in tokenResult ? tokenResult.data : null;
  return typeof token === 'string' && isExpoPushToken(token) ? token : null;
}

const PUSH_REREGISTER_MS = 6 * 60 * 60 * 1000;
let lastPushRegistration: { token: string; account: string | null; at: number } | null = null;

/** Registers the device for admin broadcast push via Expo Push Service. */
export async function registerPushTokenWithServer(
  opts: { skipPermissionProbe?: boolean } = {},
): Promise<PushRegisterResult> {
  if (!canAttemptRemotePush()) return { ok: false, reason: 'simulator', detail: 'simulator' };

  if (!opts.skipPermissionProbe) {
    const granted = await getNotificationPermissionGranted();
    if (!granted) return { ok: false, reason: 'permission' };
  }

  try {
    const token = await fetchExpoPushToken();
    if (!token) {
      console.warn('[medicard-push] unexpected token shape');
      return { ok: false, reason: 'token', detail: 'empty expo token' };
    }

    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const account = localAccountId();
    const fresh =
      lastPushRegistration &&
      lastPushRegistration.token === token &&
      lastPushRegistration.account === account &&
      Date.now() - lastPushRegistration.at < PUSH_REREGISTER_MS;
    // Same token, same account, registered recently: nothing to tell the server (was 2× per foreground).
    if (!fresh || opts.skipPermissionProbe) {
      await api.push.register({ token, platform });
      lastPushRegistration = { token, account, at: Date.now() };
    }
    await saveLastPushToken(token);

    // skipPermissionProbe means the user just opted in. Do not immediately
    // unregister if the opted-in pref read is still catching up.
    if (!opts.skipPermissionProbe && !(await isPushOptedIn())) {
      lastPushRegistration = null;
      await api.push.unregister(token).catch(() => undefined);
      return { ok: false, reason: 'permission' };
    }
    return { ok: true };
  } catch (error) {
    console.warn('[medicard-push] register failed', error);
    const message = error instanceof Error ? error.message : String(error);
    // Android Expo Go dropped remote tokens in SDK 53. iOS Expo Go still mints them —
    // do not treat every "Expo Go" string as a hard stop.
    if (Platform.OS === 'android' && /Expo Go/i.test(message)) {
      return { ok: false, reason: 'expo_go' };
    }
    if (error instanceof ApiError && error.isUnauthorized) return { ok: false, reason: 'auth', detail: 'auth' };
    if (error instanceof ApiError) return { ok: false, reason: 'network', detail: 'network' };
    return { ok: false, reason: 'token', detail: message.replace(/\s+/g, ' ').slice(0, 96) };
  }
}

function canScheduleNotifications(): boolean {
  return Platform.OS !== 'web';
}

export async function cancelNotificationsByPrefix(prefix: string): Promise<void> {
  if (!canScheduleNotifications()) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier?.startsWith(prefix))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Native scheduler is unavailable (web / Expo Go without the module).
  }
}

/**
 * A medication reminder's content. A dose moved with „გადატანა“ also names its day (`date`), so its
 * „მივიღე ✓“ and its tap reach that dose and not the day it happens to be delivered on. `owner` is the
 * account it was scheduled for: its „მივიღე ✓“ never marks a dose in another account (a delivered
 * reminder stays on screen after a sign-out).
 */
function medicationReminderContent(dose: ScheduledDose, owner: string, date?: string) {
  const copy = applyPushCopy('medication', {
    name: dose.medName,
    dosage: [dose.dosage, dose.notes].map((part) => String(part ?? '').trim()).filter(Boolean).join(' · '),
  });
  return {
    title: copy.title,
    body: copy.body,
    sound: 'default',
    categoryIdentifier: 'medi-med',
    data: {
      type: 'medication',
      templateKey: 'medication',
      medicationId: dose.medicationId,
      time: dose.time,
      ...(date ? { date } : {}),
      owner,
      // The reminded slot, so a tap opens this dose and not the first one of the day.
      route: `/medications/${dose.medicationId}?time=${dose.time}${date ? `&date=${date}` : ''}`,
    },
  };
}

function scheduleMovedDose(dose: ScheduledDose, moved: MovedDoseReminder, owner: string) {
  return Notifications.scheduleNotificationAsync({
    identifier: moved.identifier,
    content: medicationReminderContent(dose, owner, moved.date),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: moved.at,
      ...(Platform.OS === 'android' ? { channelId: MED_CHANNEL_ID } : {}),
    },
  });
}

/**
 * „გადატანა“ on a dose: its one-off reminder at the new time, scheduled right away so it exists even
 * when the refetch that re-syncs reminders fails offline. Replaces an earlier move of the same dose.
 */
export async function scheduleMovedDoseReminder(
  dose: ScheduledDose,
  date: string,
  to: string,
  expectedOwner = localAccountId(),
): Promise<boolean> {
  if (!canScheduleNotifications() || !expectedOwner || localAccountId() !== expectedOwner) return false;
  if (!(await getNotificationPermissionGranted()) || !(await isReminderFamilyOn('meds'))) return false;
  try {
    await Notifications.cancelScheduledNotificationAsync(movedDoseReminderId(dose.medicationId, date, dose.time));
  } catch {
    /* nothing scheduled yet */
  }
  // A time that already passed gets no reminder (it would fire at once); the dose is simply due.
  const [moved] = planMovedDoseReminders(
    [{ medicationId: dose.medicationId, date, time: dose.time, status: 'pending', rescheduledTo: to }],
    () => true,
  );
  if (!moved || localAccountId() !== expectedOwner) return false;
  try {
    await scheduleMovedDose(dose, moved, expectedOwner);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rewrites medication reminders without touching cycle:* notifications.
 * Honors daysOfWeek from the medication config (daily if every day / unset).
 * Doses moved with „გადატანა“ get their one-off reminder back from the dose logs.
 */
export async function syncMedicationReminders(
  schedule: ScheduledDose[],
  medications: Medication[] = [],
  expectedOwner = localAccountId(),
): Promise<number> {
  const granted = await getNotificationPermissionGranted();
  if (!granted || !expectedOwner || localAccountId() !== expectedOwner) return 0;

  await cancelNotificationsByPrefix(NOTIF_PREFIX.med);
  if (localAccountId() !== expectedOwner) return 0;
  // Profile → შეტყობინებები → წამლის მიღება (on unless the person turned it off).
  if (!(await isReminderFamilyOn('meds'))) return 0;

  const byId = new Map(medications.map((med) => [med.id, med]));
  let scheduled = 0;
  const otherCount = (await Notifications.getAllScheduledNotificationsAsync()).length;
  const budget = Math.max(0, Math.min(48, 60 - otherCount));

  // Moved doses first: each is today's (or this week's) one dose, more urgent than a dated slot weeks out.
  // The logs are read here, after the cancel above: a dose moved while a refetch was in flight is
  // either in them or scheduled by its screen after this cancel — never lost in between.
  let moved: MovedDoseReminder[] = [];
  try {
    moved = planMovedDoseReminders(await loadDoseLogs(), (medicationId, time) => {
      const med = byId.get(medicationId);
      return !(med && !med.active) && schedule.some((dose) => dose.medicationId === medicationId && dose.time === time);
    }).slice(0, budget);
  } catch {
    moved = [];
  }
  for (const item of moved) {
    if (localAccountId() !== expectedOwner) return scheduled;
    const dose = schedule.find((row) => row.medicationId === item.medicationId && row.time === item.time);
    if (!dose) continue;
    try {
      await scheduleMovedDose(dose, item, expectedOwner);
      scheduled += 1;
    } catch {
      /* skip this one */
    }
  }

  const queue = schedule.flatMap(dose => {
    const med = byId.get(dose.medicationId);
    if (med && !med.active) return [];
    const config = parseMedicationConfig(med?.config);
    return planMedicationReminderSlots(dose.medicationId, dose.time, config.daysOfWeek, config).map(slot => ({ dose, slot }));
  }).sort((a, b) => (a.slot.date?.getTime() || 0) - (b.slot.date?.getTime() || 0)).slice(0, Math.max(0, budget - scheduled));
  for (const { dose, slot } of queue) {
    if (localAccountId() !== expectedOwner) break;

    // One bad slot must not cost the remaining doses their reminders.
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIF_PREFIX.med}${slot.identifier}`,
        content: medicationReminderContent(dose, expectedOwner),
        trigger:
          slot.date
            ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.date, ...(Platform.OS === 'android' ? { channelId: MED_CHANNEL_ID } : {}) }
            : slot.weekday == null
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: slot.hour,
                minute: slot.minute,
                ...(Platform.OS === 'android' ? { channelId: MED_CHANNEL_ID } : {}),
              }
            : {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: slot.weekday,
                hour: slot.hour,
                minute: slot.minute,
                ...(Platform.OS === 'android' ? { channelId: MED_CHANNEL_ID } : {}),
              },
      });
      scheduled += 1;
    } catch {
      /* skip this slot */
    }
  }

  return scheduled;
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    return notificationResponseStatus(existing);
  } catch {
    return 'undetermined';
  }
}

export type ScheduledReminderCounts = {
  med: number;
  cycle: number;
  visit: number;
  steps: number;
  weight: number;
  engage: number;
  quota: number;
  qa: number;
  pets: number;
  nutrition: number;
  other: number;
  total: number;
};

/**
 * Meal reminders: three daily local notifications from the person's nutrition
 * preferences. Rewritten whole; never touches other prefixes. The reminder
 * only nudges — it never claims a meal was or was not logged.
 */
export async function syncNutritionReminders(
  reminders: { enabled: boolean; breakfast: string; lunch: string; dinner: string } | null,
  expectedOwner = localAccountId(),
): Promise<number> {
  if (!expectedOwner || localAccountId() !== expectedOwner) return 0;
  await cancelNotificationsByPrefix(NOTIF_PREFIX.nutrition);
  // The on/off switch lives in reminderPrefs (default on); the server row only supplies the times.
  if (!reminders || !(await isReminderFamilyOn('nutrition'))) return 0;
  const granted = await getNotificationPermissionGranted();
  if (!granted || localAccountId() !== expectedOwner) return 0;
  let scheduled = 0;
  const slots: Array<['breakfast' | 'lunch' | 'dinner', string]> = [
    ['breakfast', reminders.breakfast],
    ['lunch', reminders.lunch],
    ['dinner', reminders.dinner],
  ];
  for (const [meal, time] of slots) {
    const [hour, minute] = time.split(':').map(Number);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) continue;
    if (localAccountId() !== expectedOwner) break;
    const copy = applyPushCopy(`nutrition-${meal}`, { time });
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIF_PREFIX.nutrition}${meal}`,
        content: {
          title: copy.title,
          body: copy.body,
          sound: 'default',
          data: { type: 'nutrition_reminder', templateKey: `nutrition-${meal}`, meal, route: '/nutrition/diary' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          ...(Platform.OS === 'android' ? { channelId: NUTRITION_CHANNEL_ID } : {}),
        },
      });
      scheduled += 1;
    } catch {
      // Native scheduler unavailable (web / Expo Go without the module).
    }
  }
  return scheduled;
}

/**
 * One local notification when a running fast reaches its goal. Replaced on
 * every start, end or edit; never scheduled for another account or a past time.
 */
export async function syncFastingNotification(
  fast: { id: string; goalAt: string; targetMinutes: number; endedAt: string | null } | null,
  notify: boolean,
  expectedOwner = localAccountId(),
): Promise<boolean> {
  if (!expectedOwner || localAccountId() !== expectedOwner) return false;
  await cancelNotificationsByPrefix(NOTIF_PREFIX.fasting);
  if (!fast || fast.endedAt || !notify) return false;
  const at = new Date(fast.goalAt);
  if (!(at.getTime() > Date.now() + 30_000)) return false;
  if (!(await getNotificationPermissionGranted()) || localAccountId() !== expectedOwner) return false;
  const copy = applyPushCopy('fasting-goal', { hours: Math.round(fast.targetMinutes / 60) });
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIF_PREFIX.fasting}goal`,
      content: {
        title: copy.title,
        body: copy.body,
        sound: 'default',
        data: { type: 'fasting_goal', templateKey: 'fasting-goal', fastId: fast.id, route: '/nutrition/fasting' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        ...(Platform.OS === 'android' ? { channelId: NUTRITION_CHANNEL_ID } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getScheduledReminderCounts(): Promise<ScheduledReminderCounts> {
  const empty: ScheduledReminderCounts = {
    med: 0,
    cycle: 0,
    visit: 0,
    steps: 0,
    weight: 0,
    engage: 0,
    quota: 0,
    qa: 0,
    pets: 0,
    nutrition: 0,
    other: 0,
    total: 0,
  };
  if (!canScheduleNotifications()) return empty;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const counts = { ...empty };
    for (const item of scheduled) {
      const key = prefixForNotificationId(item.identifier ?? '');
      counts[key] += 1;
      counts.total += 1;
    }
    return counts;
  } catch {
    return empty;
  }
}

export type ScheduledReminderRow = {
  id: string;
  group: ReturnType<typeof prefixForNotificationId>;
  title: string;
  body: string;
  trigger: string;
};

function describeTrigger(trigger: ExpoNotificationTypes.NotificationTrigger | null): string {
  if (!trigger || typeof trigger !== 'object') return 'none';
  const row = trigger as Record<string, unknown>;
  if (row.type === 'daily' || row.hour != null && row.weekday == null && row.seconds == null && !row.date) {
    return `daily ${String(row.hour).padStart(2, '0')}:${String(row.minute ?? 0).toString().padStart(2, '0')}`;
  }
  if (row.weekday != null) {
    return `weekly d${row.weekday} ${String(row.hour ?? 0).toString().padStart(2, '0')}:${String(row.minute ?? 0).toString().padStart(2, '0')}`;
  }
  if (row.date) {
    const date = row.date instanceof Date ? row.date : new Date(String(row.date));
    return Number.isNaN(date.getTime()) ? 'date' : `date ${date.toLocaleString(dateLocale())}`;
  }
  if (row.seconds != null) return `in ${row.seconds}s`;
  return String(row.type ?? 'unknown');
}

export async function listScheduledReminders(): Promise<ScheduledReminderRow[]> {
  if (!canScheduleNotifications()) return [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((item) => ({
      id: item.identifier ?? '',
      group: prefixForNotificationId(item.identifier ?? ''),
      title: item.content.title ?? '',
      body: item.content.body ?? '',
      trigger: describeTrigger(item.trigger),
    }));
  } catch {
    return [];
  }
}

export async function getNotificationDebugStatus(): Promise<{
  permission: 'granted' | 'denied' | 'undetermined';
  optedIn: boolean;
  enabled: boolean;
  tokenPreview: string | null;
  counts: ScheduledReminderCounts;
}> {
  const [permission, optedIn, enabled, token, counts] = await Promise.all([
    getNotificationPermissionStatus(),
    isPushOptedIn(),
    isNotificationsEnabled(),
    readLastPushToken(),
    getScheduledReminderCounts(),
  ]);
  return {
    permission,
    optedIn,
    enabled,
    tokenPreview: token ? `${token.slice(0, 22)}…${token.slice(-4)}` : null,
    counts,
  };
}

/** One-shot local banner — used by the DEV tester, does not replace real schedules. */
export async function presentNotificationNow(opts: {
  identifier?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  secondsFromNow?: number;
  categoryIdentifier?: string;
}): Promise<boolean> {
  const granted = await getNotificationPermissionGranted();
  if (!granted || !canScheduleNotifications()) return false;

  const seconds = Math.max(1, opts.secondsFromNow ?? 2);
  const data = opts.data ?? {};
  await Notifications.scheduleNotificationAsync({
    identifier: opts.identifier ?? `${QA_PREFIX}${Date.now()}`,
    content: {
      title: opts.title,
      body: opts.body,
      sound: 'default',
      data,
      ...(opts.categoryIdentifier ? { categoryIdentifier: opts.categoryIdentifier } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(Platform.OS === 'android' && opts.channelId ? { channelId: opts.channelId } : {}),
    },
  });
  void logPushEvent({
    source: data.qa ? 'qa' : 'local',
    key: String(data.templateKey || data.type || 'qa'),
    title: opts.title,
    body: opts.body,
  });
  return true;
}

/**
 * Forgets this phone's last push registration without a request, so the next sign-in here registers
 * again. For a session the server already ended (its token is refused, so an unregister could only
 * answer 401; a password reset switched the account's push tokens off) or an account it deleted.
 */
export function forgetPushRegistration(): void {
  lastPushRegistration = null;
}

/** Removes this device from admin push broadcasts. */
export async function unregisterPushFromServer(): Promise<void> {
  forgetPushRegistration();
  let token = await readLastPushToken();
  if (!token && Device.isDevice) {
    try {
      token = await fetchExpoPushToken();
    } catch {
      token = null;
    }
  }
  if (!token) return;
  try {
    await api.push.unregister(token);
  } catch {
    // Auth or network should not block the local opt-out.
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!canScheduleNotifications()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Native scheduler is unavailable on web.
  }
}

export async function cancelCycleReminders(): Promise<void> {
  await cancelNotificationsByPrefix(NOTIF_PREFIX.cycle);
}

export async function cancelPregnancyCareReminders(): Promise<void> {
  await cancelNotificationsByPrefix(NOTIF_PREFIX.pregnancyCare);
}

type ScheduleCycleOpts = {
  identifier: string;
  title: string;
  body: string;
  date: Date;
  data?: Record<string, unknown>;
  privacyEnabled?: boolean;
};

async function resolveCycleNotificationContent(
  title: string,
  body: string,
  privacyEnabled = false,
) {
  const [prefs, engage] = await Promise.all([
    getCycleReminderPrefs(),
    loadEngagePrefs().catch(() => null),
  ]);
  const effective = getEffectiveCycleMask({
    privacyEnabled,
    maskNotifications: prefs.maskNotifications,
    discreet: Boolean(engage?.discreet),
  });
  if (effective.masked) {
    const discreet = applyPushCopy('cycle-masked');
    return {
      title: discreet.title,
      body: discreet.body,
      channelId: Platform.OS === 'android' ? CYCLE_DISCREET_CHANNEL_ID : undefined,
      masked: true,
    };
  }
  const channelId = Platform.OS === 'android' ? CYCLE_CHANNEL_ID : undefined;
  return { title, body, channelId, masked: false };
}

/** Schedule a one-time cycle notification at a specific local date/time. */
export async function scheduleCycleDateNotification(opts: ScheduleCycleOpts): Promise<boolean> {
  const granted = await getNotificationPermissionGranted();
  if (!granted) return false;

  const now = Date.now();
  if (opts.date.getTime() <= now) return false;

  const content = await resolveCycleNotificationContent(opts.title, opts.body, opts.privacyEnabled);
  const candidateType = String(opts.data?.candidateType || 'log_nudge');
  const eventDate = String(opts.data?.eventDate || '');
  const payload = cyclePushPayload(
    {
      candidateId: String(opts.data?.candidateId || opts.identifier),
      type: candidateType,
      eventDate,
      templateKey: String(opts.data?.templateKey || 'cycle-log'),
      route: String(opts.data?.route || '/cycle'),
      estimated: opts.data?.estimated !== false,
      predicted: Boolean(opts.data?.predicted),
      revalidationKey: opts.data?.revalidationKey,
    },
    { masked: content.masked },
  );

  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIF_PREFIX.cycle}${opts.identifier}`,
    content: {
      title: content.title,
      body: content.body,
      sound: 'default',
      data: payload,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: opts.date,
      ...(Platform.OS === 'android' && content.channelId ? { channelId: content.channelId } : {}),
    },
  });

  return true;
}

type SchedulePregnancyCareOpts = {
  identifier: string;
  title: string;
  body: string;
  date: Date;
  data?: Record<string, unknown>;
  privacyEnabled?: boolean;
};

/** Date-only user-planned prenatal reminder. Brain revalidates at fire time. No catch-up. */
export async function schedulePregnancyCareDateNotification(opts: SchedulePregnancyCareOpts): Promise<boolean> {
  const granted = await getNotificationPermissionGranted();
  if (!granted) return false;
  if (opts.date.getTime() <= Date.now()) return false;

  const content = await resolveCycleNotificationContent(opts.title, opts.body, opts.privacyEnabled);
  const masked = content.masked;
  const discreet = applyPushCopy('pregnancy-care-masked');
  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIF_PREFIX.pregnancyCare}${opts.identifier}`,
    content: {
      title: masked ? discreet.title : opts.title,
      body: masked ? discreet.body : opts.body,
      sound: 'default',
      data: {
        type: 'pregnancy_care_plan',
        family: 'pregnancyCareReminder',
        candidateId: String(opts.data?.candidateId || opts.identifier),
        candidateType: 'pregnancy_care_plan',
        careItemId: opts.data?.careItemId,
        episodeId: opts.data?.episodeId,
        userId: opts.data?.userId,
        plannedDate: opts.data?.plannedDate,
        plannedTime: opts.data?.plannedTime || null,
        offset: opts.data?.offset,
        reminderMode: opts.data?.reminderMode || 'DATE_BASED',
        eventDate: String(opts.data?.eventDate || ''),
        fireClock: opts.data?.fireClock || null,
        templateKey: masked ? 'pregnancy-care-masked' : 'pregnancy-care-plan',
        route: String(opts.data?.route || '/cycle/pregnancy/care-plan'),
        masked,
        rewrite: false,
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

type SchedulePetCareOpts = {
  identifier: string;
  title: string;
  body: string;
  date: Date;
  data?: Record<string, unknown>;
};

/** Date-only or exact-time pet care reminder. Brain revalidates at fire time. No catch-up. */
export async function schedulePetCareDateNotification(opts: SchedulePetCareOpts): Promise<boolean> {
  const granted = await getNotificationPermissionGranted();
  if (!granted) return false;
  if (opts.date.getTime() <= Date.now()) return false;
  if (!canScheduleNotifications()) return false;

  const masked = Boolean(opts.data?.masked);
  const discreet = applyPushCopy('pet-care-masked');
  const identifier = opts.identifier.startsWith(NOTIF_PREFIX.pets)
    ? opts.identifier
    : `${NOTIF_PREFIX.pets}${opts.identifier}`;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: masked ? discreet.title : opts.title,
        body: masked ? discreet.body : opts.body,
        sound: 'default',
        categoryIdentifier: 'medi-pet-care',
        data: {
          type: 'pet_care',
          family: 'petCareReminder',
          ...(opts.data || {}),
          masked,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: opts.date,
        ...(Platform.OS === 'android' ? { channelId: PET_CARE_CHANNEL_ID } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleCycleReminder(opts: {
  title: string;
  body: string;
  minutesFromNow: number;
}): Promise<boolean> {
  const granted = await getNotificationPermissionGranted();
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
      data: { type: 'cycle_tip', templateKey: 'cycle-tip', masked: content.masked, route: '/cycle', family: 'cycleReminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(Platform.OS === 'android' && content.channelId ? { channelId: content.channelId } : {}),
    },
  });

  return true;
}
