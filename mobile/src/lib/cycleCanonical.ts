import type { CycleBundle, CyclePhaseKind } from '@/lib/api';

function daysBetween(fromKey: string, toKey: string) {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / 86_400_000);
}

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

const UNKNOWN: CyclePhaseInfo = { day: null, phase: 'unknown', phaseKa: CYCLE_PHASE_KA.unknown };

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/**
 * Same rules as server `detectCyclePhase` — used only when the API
 * has LMP but has not stamped phase (undeployed / older bundle).
 */
export function phaseFromLmp(
  lastPeriodStart: string | null | undefined,
  date: string,
  avgCycleLength = 28,
  avgPeriodLength = 5,
): CyclePhaseInfo {
  const start = dateKey(lastPeriodStart);
  const on = dateKey(date);
  if (!start || !on) return UNKNOWN;
  const length = Math.max(21, Math.min(45, Math.round(avgCycleLength) || 28));
  const period = Math.max(2, Math.min(10, Math.round(avgPeriodLength) || 5));
  const day = daysBetween(start, on) + 1;
  if (day < 1) return UNKNOWN;
  const cycleDay = ((day - 1) % length) + 1;
  const ovulationCycleDay = length - 13;
  if (cycleDay <= period) {
    return { day: cycleDay, phase: 'period', phaseKa: CYCLE_PHASE_KA.period };
  }
  if (cycleDay >= ovulationCycleDay - 5 && cycleDay <= ovulationCycleDay + 1) {
    const ovulation = cycleDay === ovulationCycleDay;
    return {
      day: cycleDay,
      phase: ovulation ? 'ovulation' : 'fertile',
      phaseKa: ovulation ? CYCLE_PHASE_KA.ovulation : CYCLE_PHASE_KA.fertile,
    };
  }
  if (cycleDay > ovulationCycleDay + 1) {
    return { day: cycleDay, phase: 'luteal', phaseKa: CYCLE_PHASE_KA.luteal };
  }
  return { day: cycleDay, phase: 'follicular', phaseKa: CYCLE_PHASE_KA.follicular };
}

/** Read server-stamped day/phase. Falls back to LMP math if stamps are missing. */
export function phaseFromBundle(bundle: CycleBundle, date: string): CyclePhaseInfo {
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

  const lmp = dateKey(bundle.profile?.lastPeriodStart) || dateKey(bundle.inferred?.lastPeriodStart);
  return phaseFromLmp(
    lmp,
    date,
    usedCycleLength(bundle),
    bundle.averages?.usedPeriodLength ?? bundle.profile?.avgPeriodLength ?? 5,
  );
}

export function usedCycleLength(bundle: CycleBundle): number {
  return bundle.averages?.usedCycleLength ?? bundle.profile?.avgCycleLength ?? 28;
}

export function cycleToday(bundle: CycleBundle | null | undefined, fallback: string): string {
  return bundle?.meta?.today || fallback;
}
