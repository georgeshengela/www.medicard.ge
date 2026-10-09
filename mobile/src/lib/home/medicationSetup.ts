/**
 * The onboarding medication goal (step 5) asks only for a medicine's name — „განრიგსა და შეხსენებებს
 * მერე მოვარგებთ“. A tracked MEDIPILL medication needs a dose and at least one time (server
 * `createSchema`), and we never invent either, so nothing is created there. Instead Home's „შემდეგი
 * მიღება“ leads her to finish it: the first name she typed that no tracked medication carries yet opens
 * the normal MEDIPILL setup with that name filled in. Reminders follow the usual rule (scheduled only
 * once notifications are granted). Pure: no imports, so node tests load it directly.
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

/**
 * The medicine to finish setting up, or null. Only for people whose main goal is medications (others
 * may list what they take in their health profile without wanting reminders). `typed` =
 * `HealthProfile.medications`; `tracked` = every MEDIPILL medication, paused ones included (name or
 * generic name). Call it only once the medication list has loaded — an empty list while loading
 * would look like „none yet“.
 */
export function medicationToSetUp(input: {
  primaryGoal: string | null | undefined;
  typed: readonly string[] | null | undefined;
  tracked: readonly TrackedMedication[];
}): string | null {
  if (input.primaryGoal !== 'medications') return null;
  // The brand she added from the catalogue also counts by its generic name („Glucophage“ = „Metformin“).
  const tracked = input.tracked.flatMap((med) => [norm(med.medName), norm(med.config?.genericName)]).filter(Boolean);
  for (const raw of input.typed ?? []) {
    const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
    if (name.length < 2) continue;
    const key = norm(name);
    if (!tracked.some((med) => sameMedicine(key, med))) return name;
  }
  return null;
}

/** The MEDIPILL setup screen with the name filled in — opened exactly like the catalogue opens it. */
export function medicationSetupRoute(name: string): { pathname: '/medications/add/setup'; params: { name: string } } {
  return { pathname: '/medications/add/setup', params: { name } };
}
