import type { SocialProvider } from '@/store/AuthContext';

/**
 * The pending Apple / Google sign-in that must be attached to an existing password account.
 * Kept in memory only (never in a route param or storage): the link token expires in 10 minutes
 * on the server anyway, and a restart simply means tapping the button again.
 */
export type PendingSocialLink = { provider: SocialProvider; email: string; linkToken: string };

let pending: PendingSocialLink | null = null;

export function setPendingSocialLink(value: PendingSocialLink | null): void {
  pending = value;
}

export function pendingSocialLink(): PendingSocialLink | null {
  return pending;
}
