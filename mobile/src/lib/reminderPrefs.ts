import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';

/**
 * One on/off switch per scheduled-reminder family, shown on Profile → შეტყობინებები (owner 2026-10-02:
 * every reminder is on by default and each one can be turned off there). Screens that have their own
 * switch (meal settings, pet schedules) write the same value, so there is a single source of truth.
 * Steps and weight keep their switch on the goal itself (it also holds days and time); cycle keeps its
 * own prefs (cycleReminderPrefs) because cycle settings expose more than on/off.
 */
export type ReminderFamily = 'meds' | 'visits' | 'pets' | 'pregnancy' | 'nutrition';

export const REMINDER_FAMILIES: ReminderFamily[] = ['meds', 'visits', 'pets', 'pregnancy', 'nutrition'];

const KEY = 'medicard.reminders.families.v1';

type Stored = Partial<Record<ReminderFamily, boolean>>;

async function readStored(): Promise<Stored> {
  try {
    const raw = await getScopedPreference(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

/** Missing = on. Only an explicit `false` saved from a switch turns a family off. */
export async function loadReminderFamilies(): Promise<Record<ReminderFamily, boolean>> {
  const stored = await readStored();
  return Object.fromEntries(REMINDER_FAMILIES.map((family) => [family, stored[family] !== false])) as Record<ReminderFamily, boolean>;
}

export async function isReminderFamilyOn(family: ReminderFamily): Promise<boolean> {
  return (await readStored())[family] !== false;
}

export async function setReminderFamily(family: ReminderFamily, on: boolean): Promise<void> {
  const stored = await readStored();
  await setScopedPreference(KEY, JSON.stringify({ ...stored, [family]: on }));
}
