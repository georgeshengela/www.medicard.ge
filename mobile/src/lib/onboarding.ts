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
