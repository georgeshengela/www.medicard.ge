import type { Medication, ScheduledDose } from '@/lib/api';
import { findDoseLog, parseMedicationConfig } from '@/lib/medications.shared';
import { medicationCourseIncludesDate } from '@/lib/notificationPlan';
import type { MedicationDoseLog } from '@/types/medications';

export type TodayDoses = {
  /** Doses scheduled for today, sorted by time, that have no log yet. */
  pending: ScheduledDose[];
  /** Per-medication taken/total for today. */
  progressByMed: Map<string, { taken: number; total: number }>;
  /** Totals across every medication scheduled today. */
  taken: number;
  total: number;
};

/** Pure "what is due today" view of the medications bundle — shared by the Home hero and the dose carousel. */
export function computeTodayDoses(
  medications: Medication[],
  schedule: ScheduledDose[],
  doseLogs: MedicationDoseLog[],
  today: string,
  now: Date = new Date(),
): TodayDoses {
  const dow = (now.getDay() + 6) % 7;
  const todayDoses = schedule
    .filter((dose) => {
      const med = medications.find((item) => item.id === dose.medicationId);
      if (!med?.active) return false;
      const cfg = parseMedicationConfig(med.config);
      if (!medicationCourseIncludesDate(cfg, today)) return false;
      if (!cfg.daysOfWeek?.length) return true;
      return cfg.daysOfWeek.includes(dow);
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const progressByMed = new Map<string, { taken: number; total: number }>();
  let taken = 0;
  for (const dose of todayDoses) {
    const prev = progressByMed.get(dose.medicationId) ?? { taken: 0, total: 0 };
    prev.total += 1;
    if (findDoseLog(doseLogs, dose.medicationId, today, dose.time)?.status === 'taken') {
      prev.taken += 1;
      taken += 1;
    }
    progressByMed.set(dose.medicationId, prev);
  }

  const pending = todayDoses.filter((dose) => !findDoseLog(doseLogs, dose.medicationId, today, dose.time));
  return { pending, progressByMed, taken, total: todayDoses.length };
}
