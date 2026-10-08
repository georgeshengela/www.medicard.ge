import type { HealthProfile, User } from '@/lib/api';

export function assessmentPhaseComplete(profile: HealthProfile | null | undefined): boolean {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  return extra.assessmentPhaseComplete === true;
}

export function needsHealthAssessment(profile: HealthProfile | null | undefined): boolean {
  if (profile?.completedAt) return false;
  return !assessmentPhaseComplete(profile);
}

export function needsProfileSetup(profile: HealthProfile | null | undefined): boolean {
  if (profile?.completedAt) return false;
  return assessmentPhaseComplete(profile);
}

function extraOf(profile: HealthProfile | null | undefined): Record<string, unknown> {
  return (profile?.extraAnswers ?? {}) as Record<string, unknown>;
}

/**
 * The profile with answers applied in memory only. Used when a setup step's own save failed but
 * the answer is safe to carry: the final onboarding save (finishOnboarding) re-sends extraAnswers.
 */
export function withExtraAnswers(profile: HealthProfile, patch: Record<string, unknown>): HealthProfile {
  return { ...profile, extraAnswers: { ...extraOf(profile), ...patch } };
}

/**
 * A profile the server just sent back (e.g. the onboarding AI analysis), keeping answers that so far
 * live only in memory (withExtraAnswers above), so the final save still sends them. Where both have
 * a value, the server's wins.
 */
export function keepLocalAnswers(server: HealthProfile, local: HealthProfile | null | undefined): HealthProfile {
  return { ...server, extraAnswers: { ...extraOf(local), ...extraOf(server) } };
}

/** Automatic retries of the last onboarding save (the „preparing your profile“ screen). */
export const FINISH_RETRY_DELAYS_MS = [1500, 4000] as const;

/**
 * Delay before automatic retry number `failures` of the last onboarding save, or null to stop and
 * show the error with a retry button. Only a dropped connection, rate limiting or a server error
 * can pass on its own; any other 4xx (session ended, validation) never will, and the count is
 * bounded, so this never loops. A timeout (408) is not retried on its own: the request already
 * waited its whole timeout (3 min for these saves), so the person sees the error at once.
 */
export function finishRetryDelay(error: unknown, failures: number): number | null {
  if (!Number.isInteger(failures) || failures < 1 || failures > FINISH_RETRY_DELAYS_MS.length) return null;
  const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined;
  if (typeof status !== 'number') return null;
  const transient = status === 0 || status === 429 || status >= 500;
  return transient ? FINISH_RETRY_DELAYS_MS[failures - 1] : null;
}

function hasAvatar(extra: Record<string, unknown>): boolean {
  return typeof extra.avatarId === 'string' && extra.avatarId.length > 0;
}

function phoneDigits(user: User | null | undefined): string {
  return typeof user?.phone === 'string' ? user.phone.replace(/\D/g, '') : '';
}

/**
 * Next unfinished setup screen after the 5 assessment steps (7-step onboarding, 2026-09-27):
 * step 6 = privacy acceptance (required, legal record) then the voluntary AI consent,
 * step 7 = notification permission (requested only from its button), step 8 = the Home layout
 * (women's / active / nutrition & weight / standard — changeable any time later). Avatar, phone
 * verification, Face ID and location are no longer onboarding steps: they are asked when a
 * feature actually needs them. Their screens stay routable for that.
 */
export function nextProfileSetupHref(
  profile: HealthProfile | null | undefined,
  _user?: User | null,
): string {
  const extra = extraOf(profile);
  if (extra.privacyAccepted !== true) return '/(auth)/profile-setup/privacy';
  if (extra.aiPrivacyPrompted !== true) return '/(auth)/profile-setup/ai-privacy';
  if (extra.notificationsEnabled === undefined) return '/(auth)/profile-setup/notifications';
  // Step 8 (owner 2026-10-02): pick the Home layout before landing on Home. The screen itself
  // skips ahead while the admin switch „homeLayouts“ is off.
  if (typeof extra.homeLayout !== 'string' && extra.homeLayoutOfferDone !== true) return '/(auth)/profile-setup/home-layout';
  return '/(auth)/profile-setup/analyzing';
}

/** Kept for features that later ask for them (e.g. phone verification before a gated space). */
export function hasProfileAvatar(profile: HealthProfile | null | undefined): boolean {
  return hasAvatar(extraOf(profile));
}

export function phoneVerified(profile: HealthProfile | null | undefined, user?: User | null): boolean {
  return phoneDigits(user).length >= 9 && extraOf(profile).phoneVerified === true;
}
