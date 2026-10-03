import { useSyncExternalStore } from 'react';
import { getPreference, setPreference } from '@/lib/storage';
import { signalCycleWidget } from '@/lib/cycleWidgetPrefs';

import {
  CYCLE_REMINDER_DEFAULTS,
  resolveCycleReminderPrefs,
  type CycleReminderPrefsShape,
} from './cycleReminderDefaults';

export type CycleReminderPrefs = CycleReminderPrefsShape;

export const CYCLE_REMINDER_KEYS = {
  enabled: 'medicard.cycle.reminders.enabled',
  periodDaysBefore: 'medicard.cycle.reminders.periodDaysBefore',
  periodLate: 'medicard.cycle.reminders.periodLate',
  ovulation: 'medicard.cycle.reminders.ovulation',
  dailyLog: 'medicard.cycle.reminders.dailyLog',
  pms: 'medicard.cycle.reminders.pms',
  opk: 'medicard.cycle.reminders.opk',
  bbt: 'medicard.cycle.reminders.bbt',
  maskNotifications: 'medicard.cycle.notifications.masked',
  maskStyle: 'medicard.cycle.notifications.maskStyle',
  privacyLock: 'medicard.cycle.privacy.lock',
} as const;

/**
 * Reminders are on by default (owner 2026-09-29: women received none while this started off). Which
 * reminders: only the period family (soon / today / late) — brief §9 item 5, so a lock screen never
 * talks about ovulation or libido unless the person asked for it. Defaults live in cycleReminderDefaults.
 */
export const DEFAULT_CYCLE_REMINDER_PREFS: CycleReminderPrefs = CYCLE_REMINDER_DEFAULTS;

/**
 * `mode` = the cycle profile mode when known: a TRY_TO_CONCEIVE profile defaults ovulation + fertile
 * reminders ON. A value the person saved always wins over the default.
 */
export async function getCycleReminderPrefs(opts: { mode?: string | null } = {}): Promise<CycleReminderPrefs> {
  const [enabled, periodDaysBefore, periodLate, ovulation, dailyLog, pms, opk, bbt, maskNotifications, maskStyle] =
    await Promise.all([
      getPreference(CYCLE_REMINDER_KEYS.enabled),
      getPreference(CYCLE_REMINDER_KEYS.periodDaysBefore),
      getPreference(CYCLE_REMINDER_KEYS.periodLate),
      getPreference(CYCLE_REMINDER_KEYS.ovulation),
      getPreference(CYCLE_REMINDER_KEYS.dailyLog),
      getPreference(CYCLE_REMINDER_KEYS.pms),
      getPreference(CYCLE_REMINDER_KEYS.opk),
      getPreference(CYCLE_REMINDER_KEYS.bbt),
      getPreference(CYCLE_REMINDER_KEYS.maskNotifications),
      getPreference(CYCLE_REMINDER_KEYS.maskStyle),
    ]);

  return resolveCycleReminderPrefs(
    { enabled, periodDaysBefore, periodLate, ovulation, dailyLog, pms, opk, bbt, maskNotifications, maskStyle },
    opts.mode ?? null,
  );
}

export async function setCycleReminderPrefs(prefs: Partial<CycleReminderPrefs>): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (prefs.enabled !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.enabled, prefs.enabled ? '1' : '0'));
  }
  if (prefs.periodDaysBefore !== undefined) {
    tasks.push(
      setPreference(
        CYCLE_REMINDER_KEYS.periodDaysBefore,
        String(Math.min(5, Math.max(0, prefs.periodDaysBefore))),
      ),
    );
  }
  if (prefs.periodLate !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.periodLate, prefs.periodLate ? '1' : '0'));
  }
  if (prefs.ovulation !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.ovulation, prefs.ovulation ? '1' : '0'));
  }
  if (prefs.dailyLog !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.dailyLog, prefs.dailyLog ? '1' : '0'));
  }
  if (prefs.pms !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.pms, prefs.pms ? '1' : '0'));
  }
  if (prefs.opk !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.opk, prefs.opk ? '1' : '0'));
  }
  if (prefs.bbt !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.bbt, prefs.bbt ? '1' : '0'));
  }
  if (prefs.maskNotifications !== undefined) {
    tasks.push(
      setPreference(CYCLE_REMINDER_KEYS.maskNotifications, prefs.maskNotifications ? '1' : '0'),
    );
  }
  if (prefs.maskStyle !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.maskStyle, prefs.maskStyle));
  }
  await Promise.all(tasks);
  // Masked cycle notifications also make the Home-screen widget neutral (train 1.0.0.20).
  if (prefs.maskNotifications !== undefined) signalCycleWidget();
}

// Synchronous copy of the Face ID / PIN cycle lock for Home: primed at sign-in so the women's
// Home never paints cycle data (or a skeleton flash) before the lock is known. `null` = not read yet.
let privacyLockCache: boolean | null = null;
const privacyLockListeners = new Set<() => void>();
function rememberPrivacyLock(enabled: boolean) {
  if (privacyLockCache === enabled) return;
  privacyLockCache = enabled;
  privacyLockListeners.forEach((listener) => listener());
}

export async function isCyclePrivacyLockEnabled(): Promise<boolean> {
  const v = await getPreference(CYCLE_REMINDER_KEYS.privacyLock);
  rememberPrivacyLock(v === '1');
  return v === '1';
}

export async function setCyclePrivacyLockEnabled(enabled: boolean): Promise<void> {
  await setPreference(CYCLE_REMINDER_KEYS.privacyLock, enabled ? '1' : '0');
  rememberPrivacyLock(enabled);
}

/** Last known lock state without waiting; `null` until the first read. */
export function peekCyclePrivacyLock(): boolean | null {
  return privacyLockCache;
}

/** Outside React (the cycle widget controller): called when the Face ID / PIN cycle lock changes. */
export function subscribeCyclePrivacyLock(listener: () => void): () => void {
  privacyLockListeners.add(listener);
  return () => {
    privacyLockListeners.delete(listener);
  };
}

/** Live lock state for Home (re-renders when the cycle settings change it). Starts a read if unknown. */
export function useCyclePrivacyLock(): boolean | null {
  const value = useSyncExternalStore(
    (listener) => {
      privacyLockListeners.add(listener);
      if (privacyLockCache === null) void isCyclePrivacyLockEnabled().catch(() => rememberPrivacyLock(false));
      return () => {
        privacyLockListeners.delete(listener);
      };
    },
    peekCyclePrivacyLock,
    peekCyclePrivacyLock,
  );
  return value;
}
