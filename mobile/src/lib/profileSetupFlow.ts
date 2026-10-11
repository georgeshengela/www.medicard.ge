import type { HealthProfile } from '@/lib/api';
import { api } from '@/lib/api';
import { completePayload, formFromProfile, primaryGoalFromProfile } from '@/lib/assessmentForm';
import type { User } from '@/lib/api';
import { getPreference, setPreference } from '@/lib/storage';
import { trackOnboardingCompleted } from '@/lib/funnel';
import { omitHomeLayoutKeys } from '@/lib/home/homeLayout';

export const BIOMETRIC_PREF_KEY = 'medicard.biometric.enabled';

/**
 * One onboarding setup answer (privacy, AI consent, notifications…). The server merges extraAnswers, so
 * only the patch is sent; answers kept only in memory ride on the final save (finishOnboarding).
 */
export async function patchProfileExtra(
  _healthProfile: HealthProfile,
  _user: User,
  patch: Record<string, unknown>,
): Promise<HealthProfile> {
  const result = await api.healthProfile.update({
    extraAnswers: { assessmentPhaseComplete: true, ...patch },
  });
  return result.profile;
}

export async function markPhoneVerified(healthProfile: HealthProfile, user: User) {
  return patchProfileExtra(healthProfile, user, { phoneVerified: true });
}

export async function setBiometricEnabled(enabled: boolean) {
  await setPreference(BIOMETRIC_PREF_KEY, enabled ? '1' : '0');
}

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await getPreference(BIOMETRIC_PREF_KEY);
  return v === '1';
}

export async function finishOnboarding(healthProfile: HealthProfile, user: User) {
  const form = formFromProfile(healthProfile, user);
  const extra = (healthProfile.extraAnswers ?? {}) as Record<string, unknown>;
  await api.healthProfile.update({
    extraAnswers: {
      // Re-sends what the device holds (a setup answer whose own save failed is only here).
      // The Home layout has its own debounced writer; a stale copy here must not undo a newer choice.
      ...omitHomeLayoutKeys(extra),
      assessmentPhaseComplete: true,
      phoneVerified: true,
      privacyAccepted: true,
      onboardingComplete: true,
    },
  });
  const result = await api.healthProfile.complete(completePayload(form));
  trackOnboardingCompleted(primaryGoalFromProfile(healthProfile));
  return result;
}
