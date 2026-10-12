/**
 * MEDIFAMILY local reminders (prefix `family:`, Android channel `family-reminders`). The server feed
 * (/api/family/reminders/feed) says what and when — vaccines 14 days before, on the day, +7 and +30 days if
 * still unmarked; month-birthdays to 24 months — and this file keeps the phone's schedule equal to it.
 * Never asks for permission (only schedules when already granted); the Profile switch „შვილები“ (reminder
 * family `family`) and the admin switch `family` turn everything off. One run at a time.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { localAccountId } from '@/lib/localAccount';
import { isFeatureOn } from '@/lib/featureFlags';
import { isReminderFamilyOn } from '@/lib/reminderPrefs';
import { familyApi, type ReminderPoint } from './familyApi';
import { familyShipped } from './familyAvailability';

export const FAMILY_PREFIX = 'family:';
export const FAMILY_CHANNEL_ID = 'family-reminders';
/** iOS keeps 64 pending notifications for the whole app; the family takes at most this many. */
export const FAMILY_MAX_PENDING = 16;

let running: Promise<void> | null = null;
let lastRunAt = 0;

/** When a point fires on this phone: its civil date at its hour, local time. */
export function fireDate(point: Pick<ReminderPoint, 'fireOn' | 'hour'>): Date {
  const [y, m, d] = point.fireOn.split('-').map(Number);
  return new Date(y, m - 1, d, point.hour, 0, 0, 0);
}

/** What should be pending now: future points only, nearest first, capped. */
export function plannedPoints(points: ReminderPoint[], now = Date.now()): ReminderPoint[] {
  return points
    .filter((p) => fireDate(p).getTime() > now + 60_000)
    .sort((a, b) => fireDate(a).getTime() - fireDate(b).getTime())
    .slice(0, FAMILY_MAX_PENDING);
}

export function pointSignature(p: ReminderPoint): string {
  return `${p.fireOn}|${p.hour}|${p.title}|${p.body}|${p.route}`;
}

async function cancelAll() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(scheduled.filter((n) => n.identifier?.startsWith(FAMILY_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)));
}

export function reconcileFamilyReminders(opts: { force?: boolean } = {}): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (running) return running;
  if (!opts.force && Date.now() - lastRunAt < 60_000) return Promise.resolve();
  lastRunAt = Date.now();
  running = (async () => {
    const owner = localAccountId();
    const enabled = Boolean(owner) && familyShipped() && isFeatureOn('family') && (await isReminderFamilyOn('family'));
    if (!enabled) { await cancelAll(); return; }
    const { getNotificationPermissionGranted } = await import('@/lib/notifications');
    if (!(await getNotificationPermissionGranted())) return;
    const { items } = await familyApi.reminderFeed();
    if (localAccountId() !== owner) return;
    const want = plannedPoints(items);
    const wantById = new Map(want.map((p) => [`${FAMILY_PREFIX}${p.id}`, p]));
    const scheduled = (await Notifications.getAllScheduledNotificationsAsync().catch(() => [])).filter((n) => n.identifier?.startsWith(FAMILY_PREFIX));
    const keep = new Set<string>();
    for (const n of scheduled) {
      const p = wantById.get(n.identifier);
      const data = (n.content?.data || {}) as Record<string, unknown>;
      if (p && data.sig === pointSignature(p) && data.owner === owner) keep.add(n.identifier);
      else await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined);
    }
    for (const [identifier, p] of wantById) {
      if (keep.has(identifier)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: p.title,
          body: p.body,
          sound: 'default',
          data: { type: 'family_reminder', family: 'familyReminder', kind: p.kind, route: p.route, owner, sig: pointSignature(p) },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate(p),
          ...(Platform.OS === 'android' ? { channelId: FAMILY_CHANNEL_ID } : {}),
        },
      }).catch(() => undefined);
    }
  })().catch(() => undefined).finally(() => { running = null; });
  return running;
}

/**
 * Fire-time check (Notification Brain): drop a reminder scheduled for another account, or after the
 * family switch or the module was turned off.
 */
export async function deliverFamilyReminder(data: Record<string, unknown>): Promise<{ ok: boolean; reason: string | null }> {
  if (data.owner && data.owner !== localAccountId()) return { ok: false, reason: 'other_account' };
  if (!isFeatureOn('family')) return { ok: false, reason: 'module_paused' };
  if (!(await isReminderFamilyOn('family'))) return { ok: false, reason: 'family_off' };
  return { ok: true, reason: null };
}
