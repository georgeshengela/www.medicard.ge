/**
 * Older accounts without a first + last name (made before registration asked it, 2026-10-11) are asked
 * once on Home. Pure: no I/O, so node tests load it directly.
 */
import { hasFirstAndLastName } from './displayName.ts';

type UserLike = { fullName?: string | null } | null | undefined;
type ProfileLike = { completedAt?: string | null; extraAnswers?: Record<string, unknown> | null } | null | undefined;

export function namePromptDue(user: UserLike, profile: ProfileLike): boolean {
  if (!user || !profile?.completedAt) return false;
  const extra = (profile.extraAnswers ?? {}) as Record<string, unknown>;
  if (typeof extra.namePromptAt === 'string') return false;
  return !hasFirstAndLastName(user, extra);
}
