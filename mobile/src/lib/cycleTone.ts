/**
 * Mode-dependent tone rules (MEDICARD Cycle brief §9 item 16).
 *
 * Trying to conceive: a period starting is not a success to celebrate — the toast says neutrally
 * „ახალი ციკლი დაიწყო“ and the haptic is a plain selection tick instead of the Success notification.
 * Every other mode keeps the regular „მენსტრუაცია დაფიქსირდა“ toast and Success haptic.
 * Pure (no app imports): node tests load it; the screens resolve the language with `tx`.
 */

export type PeriodStartHaptic = 'selection' | 'success';

export type PeriodStartTone = {
  /** Toast title override (ka/en); null = the toast's default title. */
  title: { ka: string; en: string } | null;
  haptic: PeriodStartHaptic;
};

export const TTC_PERIOD_START_TITLE = { ka: 'ახალი ციკლი დაიწყო', en: 'A new cycle has started' } as const;

/**
 * Postpartum hero / explain line: fertility can return before the first bleed, so no period does not
 * mean no fertility. Plain fact, not a contraception recommendation.
 */
export const POSTPARTUM_OVULATION_NOTE = {
  ka: 'ოვულაცია შეიძლება პირველ სისხლდენამდე დაბრუნდეს — მენსტრუაციის არქონა ნაყოფიერების არქონას არ ნიშნავს.',
  en: 'Ovulation can return before the first bleed — no period does not mean no fertility.',
} as const;

export function isTtcTone(mode: string | null | undefined): boolean {
  return mode === 'TRY_TO_CONCEIVE';
}

/** How the one-tap „მენსტრუაცია დაიწყო“ confirms itself in this mode. */
export function periodStartTone(mode: string | null | undefined): PeriodStartTone {
  if (isTtcTone(mode)) return { title: TTC_PERIOD_START_TITLE, haptic: 'selection' };
  return { title: null, haptic: 'success' };
}
