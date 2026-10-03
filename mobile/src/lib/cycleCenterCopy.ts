/**
 * The words in the hero centre — one grammar for the Home glow (`HomeCycleHero`) and the cycle
 * screen's dial (`CycleHero`), driven by the pure `cycleCenter` model. Every estimate carries
 * „სავარაუდოდ“; a variable cycle (`countdownRange` / `windowOpen`) never shows a single date.
 */
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleCenter } from '@/lib/home/homeCycle';

export type CycleCenterText = { top: string | null; value: string; bottom: string | null; tone?: 'period' | 'ink' };

/** The en dash between two day counts or two dates — never a hyphen, so „3–7“ reads as a range. */
export const RANGE_DASH = '–';

export function cycleCenterText(center: CycleCenter, uncertainBleed: boolean): CycleCenterText {
  switch (center.kind) {
    case 'periodDay':
      return {
        top: uncertainBleed ? ka.cycle.heroBleedingDay : ka.cycle.heroPeriodDay,
        value: center.day != null ? String(center.day) : '—',
        bottom: null,
        tone: 'period',
      };
    case 'periodToday':
      return { top: ka.cycle.heroLikely, value: ka.cycle.heroToday, bottom: ka.cycle.legendPeriodPredicted, tone: 'period' };
    case 'countdown':
      // The same words as the cycle screen's dial: „მენსტრუაციამდე · 3 · დღე · სავარაუდოდ“.
      return {
        top: uncertainBleed ? ka.cycle.heroUntilBleeding : ka.cycle.heroUntilPeriod,
        value: String(center.days),
        bottom: ka.cycle.heroDaysEstimated,
      };
    case 'countdownRange':
      // Variable cycles (brief §9 item 12): „მენსტრუაციამდე · 3–7 · დღე · სავარაუდოდ“.
      return {
        top: uncertainBleed ? ka.cycle.heroUntilBleeding : ka.cycle.heroUntilPeriod,
        value: `${center.from}${RANGE_DASH}${center.to}`,
        bottom: ka.cycle.heroDaysEstimated,
      };
    case 'windowOpen':
      return {
        top: ka.cycle.heroLikely,
        value: ka.cycle.heroToday,
        bottom: center.to > 0 ? windowOpenTail(center.to) : ka.cycle.legendPeriodPredicted,
        tone: 'period',
      };
    case 'late':
      return { top: ka.cycle.cycleDay, value: String(center.day), bottom: ka.cycle.heroLateBy(center.lateBy) };
    case 'cycleDay':
      return {
        top: ka.cycle.cycleDay,
        value: center.day != null ? String(center.day) : '—',
        bottom: center.day != null && center.length ? ka.cycle.outOf(center.length) : null,
      };
    default:
      return { top: null, value: '—', bottom: null };
  }
}

/** „ან მომდევნო N დღეში“ — the open window's remaining days. */
export function windowOpenTail(days: number): string {
  return tx(`ან მომდევნო ${days} დღეში`, days === 1 ? 'or tomorrow' : `or within the next ${days} days`);
}

/** The one-line reason under a window: her cycles vary, so the date is a range. */
export const CYCLES_VARY_NOTE = () => tx('ციკლები ცვალებადია', 'cycles vary');
