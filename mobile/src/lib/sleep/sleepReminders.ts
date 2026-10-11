import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { tx } from '@/i18n/locale';
import { getScopedPreference, localAccountId, setScopedPreference } from '@/lib/localAccount';
import { cancelNotificationsByPrefix, getNotificationPermissionGranted, NOTIF_PREFIX, SLEEP_CHANNEL_ID } from '@/lib/notifications';
import { isReminderFamilyOn } from '@/lib/reminderPrefs';
import { expoWeekdayFromMonday } from '@/lib/notificationPlan';
import { hhmm, nextWake, wakeMinutesFor, ymd } from './sleepTime';
import { windDownSlots } from './sleepSchedule';

export { windDownSlots };
import type { SleepPlan } from './sleepTypes';

/**
 * MEDISLEEP reminders (family `sleep` — Profile → შეტყობინებები, on by default; reconcile in
 * reminderReconcile.ts):
 * - wind-down before the planned bedtime, repeating (one per weekday when weekend wake-ups differ);
 * - the morning check-in („როგორ გეძინა?“) for the next two mornings only, skipped for a night already rated,
 *   so it never keeps asking someone who stopped opening the app.
 * The wake-up alarm is not part of this family (sleepAlarm.ts): a switch here never silences an alarm she set.
 * Copy never carries sleep values — only the planned time.
 */
const PLAN_KEY = 'medicard.sleep.plan.v1';
const ACTIVE_KEY = 'medicard.sleep.bedtimeReminders.v1';
const CHECKED_KEY = 'medicard.sleep.checkedNights.v1';

/** The last plan this phone saw (reminders and the widget run without a network call). */
export async function rememberSleepPlan(plan: SleepPlan | null): Promise<void> {
  await setScopedPreference(PLAN_KEY, plan ? JSON.stringify(plan) : '').catch(() => undefined);
}

export async function rememberedSleepPlan(): Promise<SleepPlan | null> {
  try {
    const raw = await getScopedPreference(PLAN_KEY);
    return raw ? (JSON.parse(raw) as SleepPlan) : null;
  } catch {
    return null;
  }
}

/** Nights already rated on this phone (YYYY-MM-DD), so tomorrow's check-in reminder can be skipped. */
export async function markNightCheckedIn(night: string): Promise<void> {
  try {
    const raw = await getScopedPreference(CHECKED_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [...new Set([...list, night])].sort().slice(-14);
    await setScopedPreference(CHECKED_KEY, JSON.stringify(next));
  } catch {
    /* only a nicety */
  }
}

async function checkedNights(): Promise<Set<string>> {
  try {
    const raw = await getScopedPreference(CHECKED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function sleepBedtimeRemindersScheduled(): Promise<boolean> {
  return (await getScopedPreference(ACTIVE_KEY).catch(() => null)) === '1';
}

async function scheduleBedtime(plan: SleepPlan): Promise<number> {
  const slots = windDownSlots(plan);
  const same = slots.every((s) => s.minutes === slots[0].minutes);
  const bedFor = (s: { minutes: number }) => hhmm(s.minutes + plan.windDownMinutes);
  const content = (s: { minutes: number }) => ({
    title: tx('დამშვიდების დროა 🌙', 'Time to wind down 🌙'),
    body: plan.windDownMinutes > 0
      ? tx(`${bedFor(s)}-ზე დაწოლა გეგმაშია. ჩართე ძილის რეჟიმი ან მშვიდი ხმა.`, `Bedtime is ${bedFor(s)}. Start sleep mode or a calm sound.`)
      : tx('დაწოლის დროა. ჩართე ძილის რეჟიმი.', "It's bedtime. Start sleep mode."),
    sound: 'default' as const,
    data: { type: 'sleep_bedtime', route: '/sleep' },
  });
  const channel = Platform.OS === 'android' ? { channelId: SLEEP_CHANNEL_ID } : {};
  let count = 0;
  if (same) {
    const s = slots[0];
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIF_PREFIX.sleep}bedtime`,
      content: content(s),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(s.minutes / 60), minute: s.minutes % 60, ...channel },
    });
    return 1;
  }
  for (const s of slots) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIF_PREFIX.sleep}bedtime:${s.weekday}`,
      content: content(s),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekdayFromMonday(s.weekday),
        hour: Math.floor(s.minutes / 60),
        minute: s.minutes % 60,
        ...channel,
      },
    });
    count += 1;
  }
  return count;
}

async function scheduleCheckins(plan: SleepPlan, now: Date): Promise<number> {
  const done = await checkedNights();
  let count = 0;
  let wake = nextWake(plan, now);
  for (let i = 0; i < 2; i++) {
    const at = new Date(wake.getTime() + 45 * 60_000);
    const night = ymd(wake);
    if (at.getTime() > now.getTime() + 60_000 && !done.has(night)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIF_PREFIX.sleep}checkin:${night}`,
        content: {
          title: tx('დილა მშვიდობისა ☀️', 'Good morning ☀️'),
          body: tx('როგორ გეძინა? შეაფასე ღამე ერთი შეხებით.', 'How did you sleep? Rate the night with one tap.'),
          sound: 'default',
          data: { type: 'sleep_checkin', route: '/sleep/checkin' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, ...(Platform.OS === 'android' ? { channelId: SLEEP_CHANNEL_ID } : {}) },
      });
      count += 1;
    }
    const nextMorning = new Date(wake.getTime() + 20 * 3600_000);
    wake = new Date(nextMorning.getFullYear(), nextMorning.getMonth(), nextMorning.getDate(), 0, 0, 0, 0);
    wake = new Date(wake.getTime() + wakeMinutesFor(plan, wake) * 60_000);
  }
  return count;
}

/**
 * Rewrites every `sleep:` reminder from the plan. Safe to call often (reconcile, plan save, a check-in).
 * `featureOn` = the module is available (admin switch + native train).
 */
export async function syncSleepReminders(plan: SleepPlan | null, { featureOn = true, now = new Date(), expectedOwner = localAccountId() } = {}): Promise<number> {
  if (!expectedOwner || localAccountId() !== expectedOwner) return 0;
  await cancelNotificationsByPrefix(NOTIF_PREFIX.sleep);
  await setScopedPreference(ACTIVE_KEY, '0').catch(() => undefined);
  if (!plan || !featureOn || !(await isReminderFamilyOn('sleep'))) return 0;
  if (!(await getNotificationPermissionGranted()) || localAccountId() !== expectedOwner) return 0;
  let count = 0;
  try {
    if (plan.bedtimeReminder) {
      count += await scheduleBedtime(plan);
      await setScopedPreference(ACTIVE_KEY, '1').catch(() => undefined);
    }
    if (plan.checkinReminder) count += await scheduleCheckins(plan, now);
  } catch {
    // Native scheduler unavailable (web / Expo Go without the module).
  }
  return count;
}

/** Reconcile entry: the remembered plan, no network. */
export async function reconcileSleepReminders(featureOn: boolean): Promise<number> {
  return syncSleepReminders(await rememberedSleepPlan(), { featureOn });
}
