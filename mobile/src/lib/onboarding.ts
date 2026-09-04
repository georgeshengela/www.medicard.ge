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

/** Next unfinished profile-setup screen — never rewind to avatar if it is already saved. */
export function nextProfileSetupHref(
  profile: HealthProfile | null | undefined,
  user?: User | null,
): string {
  const extra = extraOf(profile);
  if (!hasAvatar(extra)) return '/(auth)/profile-setup/avatar';

  const digits = phoneDigits(user);
  const phoneLinked = digits.length >= 9;
  const phoneVerified = extra.phoneVerified === true;
  if (!phoneLinked) return '/(auth)/profile-setup/phone';
  if (!phoneVerified) {
    const raw = typeof user?.phone === 'string' ? user.phone : '';
    return raw
      ? `/(auth)/profile-setup/verify?phone=${encodeURIComponent(raw)}`
      : '/(auth)/profile-setup/phone';
  }

  const faceIdDone = extra.faceIdPrompted === true || typeof extra.biometricEnabled === 'boolean';
  if (!faceIdDone) return '/(auth)/profile-setup/face-id';
  if (extra.privacyAccepted !== true) return '/(auth)/profile-setup/privacy';
  if (extra.notificationsEnabled === undefined) return '/(auth)/profile-setup/notifications';
  return '/(auth)/profile-setup/analyzing';
}
