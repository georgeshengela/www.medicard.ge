/**
 * Phone sign-ups get a `<number>@phone.medicard.ge` login and Sign in with Apple without a shared
 * address gets `apple.<hash>@apple.medicard.ge` (server `src/lib/email/address.js`). Neither is a
 * mailbox, so they are never shown to the person as their email.
 */
const SYNTHETIC_EMAIL_DOMAINS = ['phone.medicard.ge', 'apple.medicard.ge'];

export function isSyntheticEmail(email: string | null | undefined): boolean {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return SYNTHETIC_EMAIL_DOMAINS.includes(domain);
}

/** The address worth showing, or null for synthetic logins and empty values. */
export function displayEmail(email: string | null | undefined): string | null {
  const value = String(email || '').trim();
  return value && !isSyntheticEmail(value) ? value : null;
}
