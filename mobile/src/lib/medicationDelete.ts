/**
 * „წაშლა განრიგიდან“ on the dose screen. The effects are passed in so the rules are unit-tested
 * (tests/medication-delete.test.cjs):
 * - a failed delete (offline, 5xx, signed out) is reported and changes nothing: the medication and
 *   every one of its reminders stay, because a missed dose is worse than a stale screen;
 * - a done delete — or one the server no longer has (404, e.g. deleted on the web) — removes this
 *   medication's local reminders at once, before any refetch, so they never fire for a medication she
 *   believes is gone. Other medications' reminders are not touched.
 */
import { medicationReminderPrefix } from '@/lib/notificationPlan';

export type DeleteMedicationResult = { ok: true } | { ok: false; message: string };

export async function deleteMedication(
  id: string,
  deps: {
    remove: (id: string) => Promise<unknown>;
    cancelReminders: (prefix: string) => Promise<void>;
    /** Shown when the error carries no message of its own. */
    fallbackMessage: string;
  },
): Promise<DeleteMedicationResult> {
  try {
    await deps.remove(id);
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status;
    if (status !== 404) {
      const message = (error as { message?: unknown } | null)?.message;
      return { ok: false, message: typeof message === 'string' && message.trim() ? message : deps.fallbackMessage };
    }
  }
  try {
    await deps.cancelReminders(medicationReminderPrefix(id));
  } catch {
    /* the reminder sync after the refetch rewrites them from the server list */
  }
  return { ok: true };
}
