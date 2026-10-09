/**
 * The person's own name for greetings and the profile header. Phone and Apple sign-ups that never
 * typed a name get a placeholder from the server (`DEFAULT_SOCIAL_NAME` in server/src/lib/socialAuth.js,
 * also matched by the web `/app` session.js); it is never shown as their name.
 * Pure: no imports, so node tests load it directly.
 */
export const PLACEHOLDER_FULL_NAME = 'Medicard მომხმარებელი';

type NamedUser = { fullName?: string | null } | null | undefined;
type ExtraAnswers = Record<string, unknown> | null | undefined;

function tidy(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function isPlaceholderName(value: unknown): boolean {
  return tidy(value).toLowerCase() === PLACEHOLDER_FULL_NAME.toLowerCase();
}

/**
 * The legal name typed in „დაასრულე პროფილი“, else the account name — never the placeholder
 * (earlier onboarding saves also copied it into `extraAnswers.legalName`). '' = no real name.
 */
export function realFullName(user: NamedUser, extra?: ExtraAnswers): string {
  for (const candidate of [extra?.legalName, user?.fullName]) {
    const name = tidy(candidate);
    if (name && !isPlaceholderName(name)) return name;
  }
  return '';
}

/** First name for „დილა მშვიდობისა, ნინო“; '' when there is none, so the greeting stands alone. */
export function displayFirstName(user: NamedUser, extra?: ExtraAnswers): string {
  return realFullName(user, extra).split(' ')[0] ?? '';
}

/** Up to two initials for an avatar without a picture; '' when there is no real name. */
export function nameInitials(user: NamedUser, extra?: ExtraAnswers): string {
  return realFullName(user, extra)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toUpperCase();
}
