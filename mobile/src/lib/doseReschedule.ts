import type { ScheduledDose } from '@/lib/api';
import { rescheduledDoseEntry } from '@/lib/doseAnswer';
import { saveDoseLog } from '@/lib/medications.shared';
import { scheduleMovedDoseReminder } from '@/lib/notifications';
import type { MedicationDoseLog } from '@/types/medications';

/**
 * „გადატანა“: move one open dose to another time that day. The dose stays open on its own slot —
 * nothing is marked taken, she has not taken it yet — and a one-off reminder fires at the new time
 * whose „მივიღე ✓“ marks this dose. Returns the saved row for the screen's cache.
 */
export async function moveDose(dose: ScheduledDose, date: string, to: string): Promise<MedicationDoseLog> {
  const entry = rescheduledDoseEntry({ medicationId: dose.medicationId, date, time: dose.time }, to, new Date().toISOString());
  // Saving a row without a moved time (moved back to its own slot) also clears an earlier moved reminder.
  await saveDoseLog(entry);
  if (entry.rescheduledTo) await scheduleMovedDoseReminder(dose, date, entry.rescheduledTo).catch(() => false);
  return entry;
}
