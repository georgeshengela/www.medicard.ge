/**
 * Onboarding used to end with a hidden AI „health analysis“: a paid model call that produced a 0–100
 * score no screen showed (removed 2026-10-08). App builds that still call
 * POST /api/health-profile/onboarding-analysis after the AI-consent step read only `profile` from the
 * answer, so the route keeps that shape: no model call, no score, nothing stored.
 */
export function legacyOnboardingAnalysisResponse(profile) {
  return { analysis: null, profile, cached: false };
}
