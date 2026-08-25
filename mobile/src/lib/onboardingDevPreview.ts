import { useLocalSearchParams } from 'expo-router';
import type { HealthProfile } from '@/lib/api';
import { needsHealthAssessment, needsProfileSetup } from '@/store/AuthContext';

/** Dev-only: skip onboarding guard redirects when preview=1. */
export function useOnboardingDevPreview(): boolean {
  const params = useLocalSearchParams<{ preview?: string }>();
  return typeof __DEV__ !== 'undefined' && __DEV__ && params.preview === '1';
}

export const ONBOARDING_DEV_STEPS = [
  { key: 'success', label: 'OTP success', href: '/(auth)/profile-setup/success' },
  { key: 'face-id', label: 'Face ID', href: '/(auth)/profile-setup/face-id' },
  { key: 'privacy', label: 'Privacy', href: '/(auth)/profile-setup/privacy' },
  { key: 'notifications', label: 'Notifications', href: '/(auth)/profile-setup/notifications' },
  { key: 'analyzing', label: 'Analyzing', href: '/(auth)/profile-setup/analyzing' },
  { key: 'results', label: 'Results', href: '/(auth)/profile-setup/results' },
  { key: 'recommendations', label: 'Recommendations', href: '/(auth)/profile-setup/recommendations' },
] as const;

export function onboardingDevHref(path: string) {
  return `${path}?preview=1`;
}

export function onboardingStepHref(path: string, preview: boolean) {
  return preview ? onboardingDevHref(path) : path;
}

/** Shared guard checks for profile-setup screens; preview mode bypasses completion gates. */
export function onboardingScreenBlocked(
  preview: boolean,
  user: unknown,
  healthProfile: HealthProfile | null,
): 'loading' | 'sign-in' | 'assessment' | 'home' | 'verify' | null {
  if (!user) return 'sign-in';
  if (preview) return null;
  if (needsHealthAssessment(healthProfile)) return 'assessment';
  if (!needsProfileSetup(healthProfile)) return 'home';
  return null;
}

export function onboardingNeedsPhoneVerified(
  preview: boolean,
  healthProfile: HealthProfile | null,
): boolean {
  if (preview) return false;
  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  return !extra.phoneVerified;
}
