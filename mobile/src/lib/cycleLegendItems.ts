import { ka } from '../i18n/ka.ts';
import { tx } from '../i18n/locale.js';

/**
 * One legend for every cycle surface (brief §8.2 item 3, §8.4): the ring draws four phases, the
 * calendar and the Home week tray draw only facts and estimates. The texts come from the same
 * `ka.cycle` keys the cells use for accessibility, so no surface can drift. Pure — the component
 * `CyclePhaseLegend` only paints what this returns.
 *
 * Imports stay relative so `node --test` can load this module (same as the other cycle libs).
 */

/** Ring phases, in cycle order. */
export type CyclePhaseLegendKey = 'periodPhase' | 'follicular' | 'fertilePhase' | 'luteal';

/** Calendar / week-tray marks, in the order the calendar paints them. */
export type CycleMarkLegendKey =
  | 'logged'
  | 'classified'
  | 'predicted'
  | 'fertile'
  | 'ovulation'
  | 'symptom'
  | 'spotting'
  | 'sex';

export type CycleLegendKey = CyclePhaseLegendKey | CycleMarkLegendKey;

export type CycleLegendItem = {
  key: CycleLegendKey;
  kind: 'phase' | 'mark';
  label: string;
};

export type CycleLegendOptions = {
  /** The four ring phases (only where the ring is shown). */
  phases?: boolean;
  /** Calendar marks (default on). */
  marks?: boolean;
  /** Contraception presentation — no fertility anywhere. */
  showFertility?: boolean;
  /**
   * The ring's luteal arc without a fertile one (the 3-cycle gate: phases are still estimated, fertile
   * days are not). Defaults to `showFertility`.
   */
  showLuteal?: boolean;
  /** The ovulation ring row (off while trying to conceive before 3 cycles: a wide window, no ovulation day). */
  showOvulation?: boolean;
  /** Low confidence — no estimated marks. Logged facts stay. */
  showPredicted?: boolean;
  /** Postpartum: a logged bleed the owner classified as a period (white inner ring). */
  showOwnerClassified?: boolean;
  /** Postpartum uses neutral „სისხლდენა“ for the logged bleed instead of „მენსტრუაცია“. */
  loggedBleedLabel?: string;
  /** Keep only these keys (the Home tray lists exactly the marks its week shows). */
  only?: readonly CycleLegendKey[] | null;
};

export const PHASE_LEGEND_KEYS: readonly CyclePhaseLegendKey[] = ['periodPhase', 'follicular', 'fertilePhase', 'luteal'];

/** Closing line under the ring and in its explain sheet — the calendar never draws these two phases. */
export function cycleLegendClosingLine(): string {
  return tx('ფოლიკულური და ლუთეალური ფაზები მხოლოდ რგოლზე იხატება', 'Follicular and luteal phases are drawn on the ring only');
}

export function cycleLegendLabel(key: CycleLegendKey, loggedBleedLabel?: string): string {
  switch (key) {
    case 'periodPhase':
      return ka.cycle.legendPeriod;
    case 'follicular':
      return ka.cycle.dialFollicular;
    case 'fertilePhase':
      return ka.cycle.dialFertile;
    case 'luteal':
      return ka.cycle.dialLuteal;
    case 'logged':
      return loggedBleedLabel || ka.cycle.legendPeriod;
    case 'classified':
      return ka.cycle.postpartumLegendClassified;
    case 'predicted':
      return ka.cycle.legendPeriodPredicted;
    case 'fertile':
      return ka.cycle.legendFertile;
    case 'ovulation':
      return ka.cycle.legendOvulation;
    case 'symptom':
      return ka.cycle.legendLogged;
    case 'spotting':
      return ka.cycle.legendSpotting;
    case 'sex':
      return tx('სექსი', 'Sex');
  }
}

export function cycleLegendItems(opts: CycleLegendOptions = {}): CycleLegendItem[] {
  const showFertility = opts.showFertility !== false;
  const showPredicted = opts.showPredicted !== false;
  const keys: CycleLegendKey[] = [];
  if (opts.phases) {
    keys.push('periodPhase', 'follicular');
    // The ring hides its fertile and luteal arcs together with the fertile window (contraception);
    // before 3 cycles only the fertile arc is missing (`showLuteal`).
    if (showFertility) keys.push('fertilePhase');
    if (opts.showLuteal ?? showFertility) keys.push('luteal');
  }
  if (opts.marks !== false) {
    keys.push('logged');
    if (opts.showOwnerClassified) keys.push('classified');
    if (showPredicted) keys.push('predicted');
    if (showPredicted && showFertility) keys.push('fertile');
    if (showPredicted && showFertility && opts.showOvulation !== false) keys.push('ovulation');
    keys.push('symptom', 'spotting', 'sex');
  }
  const only = opts.only ? new Set(opts.only) : null;
  return keys
    .filter((key) => !only || only.has(key))
    .map((key) => ({
      key,
      kind: (PHASE_LEGEND_KEYS as readonly string[]).includes(key) ? 'phase' : 'mark',
      label: cycleLegendLabel(key, opts.loggedBleedLabel),
    }));
}
