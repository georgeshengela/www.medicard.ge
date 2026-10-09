/**
 * MEDIPILL's note when medication reminders cannot arrive because the phone's notifications are off.
 * Before it, `syncMedicationReminders` quietly scheduled nothing and no screen said so: she added a
 * medicine („დროზე შეგახსენებთ“) and simply never got a reminder.
 *
 * - `primer`: the OS question was never asked → the one-button „გაგრძელება“ primer whose press opens the
 *   system sheet (App Review 5.1.1(iv): no Not now / close before the sheet).
 * - `settings`: the OS already answered no → „პარამეტრების გახსნა“ (only the phone's Settings can change it).
 * - `none`: allowed, nothing active to remind about, her medication reminder switch is off (Profile →
 *   შეტყობინებები), not a phone, or the status is not read yet.
 *
 * Pure: no imports, so node tests load it directly. Reading the status is fine from an effect; asking is
 * only ever done from the primer's button.
 */
export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';
export type MedicationReminderNotice = 'none' | 'primer' | 'settings';

export function medicationReminderNotice(input: {
  permission: NotificationPermissionState | null;
  activeMedications: number;
  remindersOn: boolean;
  native: boolean;
}): MedicationReminderNotice {
  if (!input.native || input.permission == null || input.permission === 'granted') return 'none';
  if (!(input.activeMedications > 0) || !input.remindersOn) return 'none';
  return input.permission === 'denied' ? 'settings' : 'primer';
}
