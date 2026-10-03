/**
 * Cycle reminder defaults (brief §9 item 5, complaint #6: lock screens that talk about discharge and libido).
 *
 * Default-on family = period soon / period today / period late. Ovulation, PMS and the daily-log nudge
 * default OFF; a TRY_TO_CONCEIVE profile gets ovulation + fertile window ON. Anyone who already saved a
 * value keeps it — only a missing value takes the default. Pure: node tests load it.
 */

export type CycleReminderMaskStyle = 'neutral' | 'wellness' | 'calendar' | 'notes';

export type CycleReminderPrefsShape = {
  enabled: boolean;
  periodDaysBefore: number;
  periodLate: boolean;
  ovulation: boolean;
  dailyLog: boolean;
  pms: boolean;
  opk: boolean;
  bbt: boolean;
  maskNotifications: boolean;
  maskStyle: CycleReminderMaskStyle;
};

/** Raw stored strings ('1' / '0' / number text) or null when the person never touched the switch. */
export type StoredCycleReminderPrefs = Partial<Record<keyof CycleReminderPrefsShape, string | null | undefined>>;

export const CYCLE_REMINDER_DEFAULTS: CycleReminderPrefsShape = {
  enabled: true,
  periodDaysBefore: 2,
  periodLate: true,
  ovulation: false,
  dailyLog: false,
  pms: false,
  opk: false,
  bbt: false,
  // Real text by default (like Flo / Apple Health) — a masked "Medi reminder" read as "no cycle notifications".
  maskNotifications: false,
  maskStyle: 'neutral',
};

export const CYCLE_MASK_STYLE_IDS: readonly CycleReminderMaskStyle[] = ['neutral', 'wellness', 'calendar', 'notes'];

/** Reminders that are on for everyone unless switched off; never fertility or intimacy words. */
export const CYCLE_DEFAULT_ON_TYPES = Object.freeze(['period_soon', 'period_start', 'period_late'] as const);

/** Optional reminders — off until the person switches them on (TTC: ovulation/fertile on). */
export const CYCLE_OPTIONAL_TYPES = Object.freeze(['ovulation', 'fertile', 'pms', 'opk', 'bbt', 'log_nudge'] as const);

function flag(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return fallback;
}

function daysBefore(raw: string | null | undefined, fallback: number): number {
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(0, Math.round(n)));
}

/** Days after the estimated start when the "date has passed — all good?" check-in fires. */
export const PERIOD_LATE_AFTER_DAYS = 2;

export function defaultOvulationReminder(mode: string | null | undefined): boolean {
  return mode === 'TRY_TO_CONCEIVE';
}

export function resolveCycleReminderPrefs(
  stored: StoredCycleReminderPrefs,
  mode: string | null | undefined = null,
): CycleReminderPrefsShape {
  const d = CYCLE_REMINDER_DEFAULTS;
  const style = stored.maskStyle as CycleReminderMaskStyle | null | undefined;
  return {
    enabled: flag(stored.enabled, d.enabled),
    periodDaysBefore: daysBefore(stored.periodDaysBefore, d.periodDaysBefore),
    periodLate: flag(stored.periodLate, d.periodLate),
    ovulation: flag(stored.ovulation, defaultOvulationReminder(mode)),
    dailyLog: flag(stored.dailyLog, d.dailyLog),
    pms: flag(stored.pms, d.pms),
    opk: flag(stored.opk, d.opk),
    bbt: flag(stored.bbt, d.bbt),
    maskNotifications: flag(stored.maskNotifications, d.maskNotifications),
    maskStyle: style && CYCLE_MASK_STYLE_IDS.includes(style) ? style : d.maskStyle,
  };
}
