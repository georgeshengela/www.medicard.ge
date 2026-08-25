import type { HealthProfile } from '@/lib/api';

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
