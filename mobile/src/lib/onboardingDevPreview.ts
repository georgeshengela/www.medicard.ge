import { useLocalSearchParams } from 'expo-router';
import { ACTIVE_ASSESSMENT_STEPS } from '@/constants/assessmentSteps';
import { ka } from '@/i18n/ka';
import type { HealthProfile } from '@/lib/api';
import { needsHealthAssessment, needsProfileSetup } from '@/store/AuthContext';

/** Dev-only: skip onboarding guard redirects when preview=1. */
export function useOnboardingDevPreview(): boolean {
  const params = useLocalSearchParams<{ preview?: string }>();
  return typeof __DEV__ !== 'undefined' && __DEV__ && params.preview === '1';
}

export type OnboardingQaGroup = 'auth' | 'assessment' | 'setup';

export type OnboardingQaStep = {
  key: string;
  label: string;
  href: string;
  group: OnboardingQaGroup;
  needsUser?: boolean;
};

export const ONBOARDING_QA_GROUP_LABELS: Record<OnboardingQaGroup, string> = {
  auth: 'შესვლა',
  assessment: 'შეფასება',
  setup: 'პროფილი OTP-ის შემდეგ',
};

const AUTH_QA_STEPS: OnboardingQaStep[] = [
  { key: 'welcome', label: 'Welcome', href: '/(auth)/welcome', group: 'auth', needsUser: false },
  { key: 'sign-in', label: 'შესვლა', href: '/(auth)/sign-in', group: 'auth', needsUser: false },
  { key: 'sign-up', label: 'რეგისტრაცია', href: '/(auth)/sign-up', group: 'auth', needsUser: false },
  { key: 'phone-login', label: 'ტელეფონი', href: '/(auth)/phone', group: 'auth', needsUser: false },
  { key: 'forgot', label: 'პაროლის აღდგენა', href: '/(auth)/forgot-password', group: 'auth', needsUser: false },
  { key: 'forgot-email', label: 'პაროლი — ელფოსტა', href: '/(auth)/forgot-password/email', group: 'auth', needsUser: false },
  { key: 'forgot-sent', label: 'პაროლი — გაიგზავნა', href: '/(auth)/forgot-password/sent?email=qa%40medicard.ge', group: 'auth', needsUser: false },
  { key: 'forgot-verify', label: 'პაროლი — კოდი', href: '/(auth)/forgot-password/verify?email=qa%40medicard.ge', group: 'auth', needsUser: false },
  { key: 'forgot-reset', label: 'პაროლი — ახალი', href: '/(auth)/forgot-password/reset?email=qa%40medicard.ge&code=000000', group: 'auth', needsUser: false },
];

const ASSESSMENT_QA_STEPS: OnboardingQaStep[] = ACTIVE_ASSESSMENT_STEPS.map((step, index) => {
  const titles = ka.assessment.steps as Record<string, string>;
  return {
    key: `assess-${step.key}`,
    label: `${String(index + 1).padStart(2, '0')}. ${titles[step.titleKey] || step.type}`,
    href: `/(auth)/assessment?step=${encodeURIComponent(step.key)}`,
    group: 'assessment',
  };
});

const SETUP_QA_STEPS: OnboardingQaStep[] = [
  { key: 'setup-intro', label: 'პროფილის შესავალი', href: '/(auth)/profile-setup', group: 'setup' },
  { key: 'avatar', label: 'ავატარი', href: '/(auth)/profile-setup/avatar', group: 'setup' },
  { key: 'setup-phone', label: 'ტელეფონის მიბმა', href: '/(auth)/profile-setup/phone', group: 'setup' },
  { key: 'verify', label: 'OTP verify', href: '/(auth)/profile-setup/verify?phone=%2B995555000000', group: 'setup' },
  { key: 'success', label: 'OTP success', href: '/(auth)/profile-setup/success', group: 'setup' },
  { key: 'face-id', label: 'Face ID', href: '/(auth)/profile-setup/face-id', group: 'setup' },
  { key: 'privacy', label: 'Privacy', href: '/(auth)/profile-setup/privacy', group: 'setup' },
  { key: 'notifications', label: 'Notifications', href: '/(auth)/profile-setup/notifications', group: 'setup' },
  { key: 'location', label: 'Location', href: '/(auth)/profile-setup/location', group: 'setup' },
  { key: 'analyzing', label: 'Analyzing', href: '/(auth)/profile-setup/analyzing', group: 'setup' },
  { key: 'results', label: 'Results', href: '/(auth)/profile-setup/results', group: 'setup' },
];

export const ONBOARDING_QA_GROUPS: OnboardingQaGroup[] = ['auth', 'assessment', 'setup'];

export const ONBOARDING_DEV_STEPS: OnboardingQaStep[] = [
  ...AUTH_QA_STEPS,
  ...ASSESSMENT_QA_STEPS,
  ...SETUP_QA_STEPS,
];

export function onboardingDevHref(path: string) {
  if (path.includes('preview=')) return path;
  return path.includes('?') ? `${path}&preview=1` : `${path}?preview=1`;
}

export function onboardingStepHref(path: string, preview: boolean) {
  return preview ? onboardingDevHref(path) : path;
}

export function findAssessmentQaStepIndex(raw?: string | string[]): number {
  const q = Array.isArray(raw) ? raw[0] : raw;
  if (!q) return -1;
  const value = decodeURIComponent(q);
  return ACTIVE_ASSESSMENT_STEPS.findIndex((step) => step.key === value || step.type === value);
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
