import type { HealthProfile } from '@/lib/api';
import { api } from '@/lib/api';
import {
  completePayload,
  extraAnswersPayload,
  formFromProfile,
  fullProfilePayload,
} from '@/lib/assessmentForm';
import type { User } from '@/lib/api';
import { setPreference } from '@/lib/storage';

export const BIOMETRIC_PREF_KEY = 'medicard.biometric.enabled';

export async function patchProfileExtra(
  healthProfile: HealthProfile,
  user: User,
  patch: Record<string, unknown>,
): Promise<HealthProfile> {
  const form = formFromProfile(healthProfile, user);
  const extra = (healthProfile.extraAnswers ?? {}) as Record<string, unknown>;
  const result = await api.healthProfile.update({
    ...fullProfilePayload(form, healthProfile.currentStepIndex ?? 0),
    extraAnswers: {
      ...extraAnswersPayload(form),
      ...extra,
      assessmentPhaseComplete: true,
      ...patch,
    },
  });
  return result.profile;
}

export async function markPhoneVerified(healthProfile: HealthProfile, user: User) {
  return patchProfileExtra(healthProfile, user, { phoneVerified: true });
}

export async function setBiometricEnabled(enabled: boolean) {
  await setPreference(BIOMETRIC_PREF_KEY, enabled ? '1' : '0');
}

export async function finishOnboarding(healthProfile: HealthProfile, user: User) {
  const form = formFromProfile(healthProfile, user);
  const extra = (healthProfile.extraAnswers ?? {}) as Record<string, unknown>;
  await api.healthProfile.update({
    ...fullProfilePayload(form, healthProfile.currentStepIndex ?? 0),
    extraAnswers: {
      ...extraAnswersPayload(form),
      ...extra,
      assessmentPhaseComplete: true,
      phoneVerified: true,
      privacyAccepted: true,
      onboardingComplete: true,
    },
  });
  const result = await api.healthProfile.complete(completePayload(form));
  return result;
}
