/**
 * The onboarding medication goal (step 5) asks only for a medicine's name — „განრიგსა და შეხსენებებს
 * მერე მოვარგებთ“. A tracked MEDIPILL medication needs a dose and at least one time (server
 * `createSchema`), and we never invent either, so nothing is created there. Instead Home's „შემდეგი
 * მიღება“ leads her to finish it: the first name she typed that no tracked medication carries yet opens
 * the normal MEDIPILL setup with that name filled in. Reminders follow the usual rule (scheduled only
 * once notifications are granted). „არა ახლა“ under the card hides it for that name on this account
 * (an as-needed medicine, a name that differs from the catalogue brand, one she deleted later), stored
 * as `medicationSetupKey(name)`. Pure: no imports, so node tests load it directly.
 */

type TrackedMedication = { medName?: string | null; config?: Record<string, unknown> | null };

function norm(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toLocaleLowerCase() : '';
}

/** „Metformin“ is set up by „Metformin“, „metformin 500 მგ“ or „Teva Metformin“ (and the other way round). */
function sameMedicine(typed: string, tracked: string): boolean {
  if (!typed || !tracked) return false;
  if (typed === tracked) return true;
  return (typed.length >= 3 && tracked.includes(typed)) || (tracked.length >= 3 && typed.includes(tracked));
}

/** The key a „არა ახლა“ is kept under: the name as it is compared („ Metformin “ = „metformin“). */
export function medicationSetupKey(name: unknown): string {
  return norm(name);
}

/** Dismissed names are few; a bound keeps a damaged or endless list from growing the stored value. */
export const MAX_DISMISSED_SETUPS = 50;

/** The stored dismissals (a JSON list of keys); anything unreadable counts as none. */
export function parseDismissedSetups(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const keys = parsed.map(medicationSetupKey).filter(Boolean);
    return [...new Set(keys)].slice(-MAX_DISMISSED_SETUPS);
  } catch {
    return [];
  }
}

/** The list after „არა ახლა“ on `name` (no duplicates, newest last, bounded). */
export function withDismissedSetup(list: readonly string[], name: string): string[] {
  const key = medicationSetupKey(name);
  const kept = list.map(medicationSetupKey).filter((item) => item && item !== key);
  return (key ? [...kept, key] : kept).slice(-MAX_DISMISSED_SETUPS);
}

/**
 * The medicine to finish setting up, or null. Only for people whose main goal is medications (others
 * may list what they take in their health profile without wanting reminders). `typed` =
 * `HealthProfile.medications`; `tracked` = every MEDIPILL medication, paused ones included (name or
 * generic name); `dismissed` = names she answered „არა ახლა“ for (the next typed name still shows).
 * Call it only once the medication list has loaded — an empty list while loading would look like
 * „none yet“.
 */
export function medicationToSetUp(input: {
  primaryGoal: string | null | undefined;
  typed: readonly string[] | null | undefined;
  tracked: readonly TrackedMedication[];
  dismissed?: readonly string[] | null;
}): string | null {
  if (input.primaryGoal !== 'medications') return null;
  const hidden = new Set((input.dismissed ?? []).map(medicationSetupKey).filter(Boolean));
  // The brand she added from the catalogue also counts by its generic name („Glucophage“ = „Metformin“).
  const tracked = input.tracked.flatMap((med) => [norm(med.medName), norm(med.config?.genericName)]).filter(Boolean);
  for (const raw of input.typed ?? []) {
    const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
    if (name.length < 2) continue;
    const key = norm(name);
    if (hidden.has(key)) continue;
    if (!tracked.some((med) => sameMedicine(key, med))) return name;
  }
  return null;
}

/** The MEDIPILL setup screen with the name filled in — opened exactly like the catalogue opens it. */
export function medicationSetupRoute(name: string): { pathname: '/medications/add/setup'; params: { name: string } } {
  return { pathname: '/medications/add/setup', params: { name } };
}
