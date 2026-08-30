import type { CycleBundle, CyclePhaseKind } from '@/lib/api';

export type { CyclePhaseKind };

/** Display labels only — values come from the server bundle. */
export const CYCLE_PHASE_KA: Record<CyclePhaseKind, string> = {
  period: 'მენსტრუაცია',
  follicular: 'ფოლიკულური ფაზა',
  fertile: 'ნაყოფიერი ფანჯარა',
  ovulation: 'ოვულაცია',
  luteal: 'ლუთეალური ფაზა',
  unknown: 'უცნობი ფაზა',
};

export type CyclePhaseInfo = {
  day: number | null;
  phase: CyclePhaseKind;
  phaseKa: string;
};

/** Read server-stamped day/phase. Missing stamps stay unknown — no client LMP engine. */
export function phaseFromBundle(bundle: CycleBundle, date: string): CyclePhaseInfo {
  const allowBiological = bundle.contraception?.presentation?.showPhaseAsBiological !== false;
  const serverToday = bundle.meta?.today;
  if (serverToday && date === serverToday && bundle.phase && bundle.phase !== 'unknown') {
    return {
      day: bundle.cycleDay ?? null,
      phase: bundle.phase,
      phaseKa: bundle.phaseKa ?? CYCLE_PHASE_KA[bundle.phase],
    };
  }

  const mark = bundle.predictions?.calendar?.[date];
  if (mark?.phase && mark.phase !== 'unknown') {
    return {
      day: mark.cycleDay ?? null,
      phase: mark.phase,
      phaseKa: mark.phaseKa ?? CYCLE_PHASE_KA[mark.phase],
    };
  }

  if (bundle.phase && bundle.phase !== 'unknown' && (!serverToday || date === serverToday)) {
    return {
      day: bundle.cycleDay ?? null,
      phase: bundle.phase,
      phaseKa: bundle.phaseKa ?? CYCLE_PHASE_KA[bundle.phase],
    };
  }

  if (!allowBiological) {
    const override = bundle.contraception?.presentation?.phaseLabelOverride;
    return {
      day: mark?.cycleDay ?? (date === serverToday ? bundle.cycleDay ?? null : null),
      phase: 'unknown',
      phaseKa: override || CYCLE_PHASE_KA.unknown,
    };
  }

  return {
    day: mark?.cycleDay ?? (date === serverToday ? bundle.cycleDay ?? null : null),
    phase: 'unknown',
    phaseKa: CYCLE_PHASE_KA.unknown,
  };
}

export function usedCycleLength(bundle: CycleBundle): number {
  return bundle.averages?.usedCycleLength ?? bundle.profile?.avgCycleLength ?? 28;
}

export function cycleToday(bundle: CycleBundle | null | undefined, fallback: string): string {
  return bundle?.meta?.today || fallback;
}
