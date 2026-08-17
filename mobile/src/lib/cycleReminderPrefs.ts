import { getPreference, setPreference } from '@/lib/storage';

export type CycleReminderPrefs = {
  enabled: boolean;
  periodDaysBefore: number;
  ovulation: boolean;
  dailyLog: boolean;
  pms: boolean;
};

export const CYCLE_REMINDER_KEYS = {
  enabled: 'medicard.cycle.reminders.enabled',
  periodDaysBefore: 'medicard.cycle.reminders.periodDaysBefore',
  ovulation: 'medicard.cycle.reminders.ovulation',
  dailyLog: 'medicard.cycle.reminders.dailyLog',
  pms: 'medicard.cycle.reminders.pms',
  privacyLock: 'medicard.cycle.privacy.lock',
} as const;

const DEFAULTS: CycleReminderPrefs = {
  enabled: false,
  periodDaysBefore: 2,
  ovulation: true,
  dailyLog: false,
  pms: true,
};

export async function getCycleReminderPrefs(): Promise<CycleReminderPrefs> {
  const [enabled, periodDaysBefore, ovulation, dailyLog, pms] = await Promise.all([
    getPreference(CYCLE_REMINDER_KEYS.enabled),
    getPreference(CYCLE_REMINDER_KEYS.periodDaysBefore),
    getPreference(CYCLE_REMINDER_KEYS.ovulation),
    getPreference(CYCLE_REMINDER_KEYS.dailyLog),
    getPreference(CYCLE_REMINDER_KEYS.pms),
  ]);

  return {
    enabled: enabled === '1',
    periodDaysBefore: Math.min(5, Math.max(0, Number(periodDaysBefore) || DEFAULTS.periodDaysBefore)),
    ovulation: ovulation !== '0',
    dailyLog: dailyLog === '1',
    pms: pms !== '0',
  };
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
  if (prefs.ovulation !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.ovulation, prefs.ovulation ? '1' : '0'));
  }
  if (prefs.dailyLog !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.dailyLog, prefs.dailyLog ? '1' : '0'));
  }
  if (prefs.pms !== undefined) {
    tasks.push(setPreference(CYCLE_REMINDER_KEYS.pms, prefs.pms ? '1' : '0'));
  }
  await Promise.all(tasks);
}

export async function isCyclePrivacyLockEnabled(): Promise<boolean> {
  const v = await getPreference(CYCLE_REMINDER_KEYS.privacyLock);
  return v === '1';
}

export async function setCyclePrivacyLockEnabled(enabled: boolean): Promise<void> {
  await setPreference(CYCLE_REMINDER_KEYS.privacyLock, enabled ? '1' : '0');
}
