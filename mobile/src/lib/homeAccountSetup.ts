import type { HealthProfile, User } from '@/lib/api';
import { assessmentPhaseComplete } from '@/lib/onboarding';
import { ka } from '@/i18n/ka';
import { analysisFromProfile } from '@/types/onboardingAnalysis';

export type AccountSetupStepKey =
  | 'assessment'
  | 'profileSetup'
  | 'verifyAccount'
  | 'firstMetric';

export type AccountSetupStep = {
  key: AccountSetupStepKey;
  index: number;
  label: string;
  done: boolean;
  href: string;
};

export type AccountSetupProgress = {
  steps: AccountSetupStep[];
  completedCount: number;
  total: number;
  currentStep: number;
  visible: boolean;
};

type SetupStats = { records: number; chats: number; activeMedications: number } | null | undefined;

function profileExtra(profile: HealthProfile | null | undefined): Record<string, unknown> {
  return (profile?.extraAnswers ?? {}) as Record<string, unknown>;
}

function isPhoneVerified(user: User | null | undefined, extra: Record<string, unknown>): boolean {
  const linked = typeof user?.phone === 'string' && user.phone.replace(/\D/g, '').length >= 9;
  return linked && extra.phoneVerified === true;
}

function isProfileSetupComplete(extra: Record<string, unknown>): boolean {
  const hasAvatar = typeof extra.avatarId === 'string' && extra.avatarId.length > 0;
  const acceptedPrivacy = extra.privacyAccepted === true;
  const hasAnalysis = analysisFromProfile(extra) != null;
  return hasAvatar && acceptedPrivacy && hasAnalysis;
}

function hasLoggedHealthMetric(
  profile: HealthProfile,
  extra: Record<string, unknown>,
  stats: SetupStats,
): boolean {
  if (extra.firstHealthMetricLogged === true) return true;
  if ((stats?.records ?? 0) > 0) return true;
  return false;
}

function profileSetupHref(extra: Record<string, unknown>): string {
  if (typeof extra.avatarId !== 'string') return '/(auth)/profile-setup/avatar';
  if (extra.privacyAccepted !== true) return '/(auth)/profile-setup/privacy';
  if (extra.notificationsEnabled === undefined) return '/(auth)/profile-setup/notifications';
  if (!analysisFromProfile(extra)) return '/(auth)/profile-setup/analyzing';
  return '/(auth)/profile-setup/avatar';
}

function verifyHref(user: User | null | undefined): string {
  if (typeof user?.phone === 'string' && user.phone.length > 0) {
    return `/(auth)/profile-setup/verify?phone=${encodeURIComponent(user.phone)}`;
  }
  return '/(auth)/profile-setup/phone';
}

export function getAccountSetupProgress(
  profile: HealthProfile | null | undefined,
  user: User | null | undefined,
  stats?: SetupStats,
): AccountSetupProgress {
  const extra = profileExtra(profile);
  const assessmentDone = assessmentPhaseComplete(profile);
  const profileDone = isProfileSetupComplete(extra);
  const verifyDone = isPhoneVerified(user, extra);
  const metricDone = profile ? hasLoggedHealthMetric(profile, extra, stats) : false;

  const steps: AccountSetupStep[] = [
    {
      key: 'assessment',
      index: 1,
      label: ka.home.setupStepAssessment,
      done: assessmentDone,
      href: '/(auth)/assessment',
    },
    {
      key: 'profileSetup',
      index: 2,
      label: ka.home.setupStepProfile,
      done: profileDone,
      href: profileSetupHref(extra),
    },
    {
      key: 'verifyAccount',
      index: 3,
      label: ka.home.setupStepVerify,
      done: verifyDone,
      href: verifyHref(user),
    },
    {
      key: 'firstMetric',
      index: 4,
      label: ka.home.setupStepFirstMetric,
      done: metricDone,
      href: '/health-metrics',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const firstIncomplete = steps.find((s) => !s.done);
  const currentStep = firstIncomplete?.index ?? steps.length;

  return {
    steps,
    completedCount,
    total: steps.length,
    currentStep,
    visible: completedCount < steps.length,
  };
}
