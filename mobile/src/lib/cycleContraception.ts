import type { CycleBundle, CycleContraceptionContext } from '@/lib/api';
// Relative so node tests (cycleMediContext.test.ts) can load this module; Metro resolves it the same way.
import { supportsCycleCapability } from './cycleModes.js';
import { fertilityDisplayOn } from './cycleForecastEligibility.js';

/** Read-only view of server contraception interpretation. No method switches. */
export function contraceptionFromBundle(bundle: CycleBundle | null | undefined): CycleContraceptionContext | null {
  return bundle?.contraception ?? null;
}

export function showFertilityUi(bundle: CycleBundle | null | undefined): boolean {
  if (!supportsCycleCapability(bundle?.profile?.mode, 'showFertileEstimates')) return false;
  // „ნაყოფიერი დღეების ჩვენება“ off / Tracking (brief §9 wave 2 item 17) — also on a cached bundle.
  if (!fertilityDisplayOn(bundle)) return false;
  const p = bundle?.contraception?.presentation;
  if (!p) return true;
  return p.showFertilityMarkers !== false && p.showFertileWindow !== false;
}

export function showOvulationUi(bundle: CycleBundle | null | undefined): boolean {
  if (!supportsCycleCapability(bundle?.profile?.mode, 'showOvulationEstimate')) return false;
  if (!fertilityDisplayOn(bundle)) return false;
  return bundle?.contraception?.presentation?.showOvulationDate !== false;
}

export function showPhaseAsBiological(bundle: CycleBundle | null | undefined): boolean {
  return bundle?.contraception?.presentation?.showPhaseAsBiological !== false;
}

export function bleedingIsUncertain(bundle: CycleBundle | null | undefined): boolean {
  return bundle?.contraception?.bleedingLabel === 'bleeding';
}

export function showContraceptionContextCard(bundle: CycleBundle | null | undefined): boolean {
  return Boolean(bundle?.contraception?.presentation?.showContextCard);
}
