import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Redirect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { AssessmentCompleteContent } from '@/components/assessment/AssessmentCompleteContent';
import { AssessmentShell } from '@/components/assessment/AssessmentShell';
import {
  AssessmentStepContent,
  stepCanContinue,
} from '@/components/assessment/AssessmentStepContent';
import {
  ACTIVE_ASSESSMENT_STEPS,
  ONBOARDING_STEPS,
  ONBOARDING_TAIL_STEPS,
  onboardingVisibleIndices,
  visibleAssessmentIndices,
  type AssessmentStep,
} from '@/constants/assessmentSteps';
import { createWeightDraft, deadlineFromPace, draftToGoal, saveWeightGoal } from '@/lib/weightGoal';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import {
  extraAnswersPayload,
  formFromProfile,
  fullProfilePayload,
  lastPeriodYmd,
  patchPayloadForStep,
  type AssessmentFormState,
} from '@/lib/assessmentForm';
import { lastPeriodValid } from '@/components/assessment/AssessmentStepContent';
import { profileCompletion, suggestTargetWeight } from '@/lib/profileCompletion';
import { nextProfileSetupHref } from '@/lib/onboarding';
import {
  findAssessmentQaStepIndex,
  onboardingDevHref,
  useOnboardingDevPreview,
} from '@/lib/onboardingDevPreview';
import { needsProfileSetup, useAuth } from '@/store/AuthContext';

/** Product funnel: onboarding step keys only (no answers). Lazy so tests and startup never depend on it. */
function trackOnboardingStep(kind: 'viewed' | 'completed', key: string | undefined) {
  void import('@/lib/funnel').then((funnel) => funnel.trackOnboardingStep(kind, key)).catch(() => undefined);
}

/** Next/previous visible step in whichever list the flow runs (onboarding or full profile). */
function resolveNextIndex(from: number, visible: number[]): number {
  return visible.find((i) => i > from) ?? visible[visible.length - 1] ?? from;
}

function resolvePrevIndex(from: number, visible: number[]): number {
  const earlier = visible.filter((i) => i < from);
  return earlier.length ? earlier[earlier.length - 1] : from;
}

const PICKER_STEPS = new Set(['birthdate', 'weight', 'height', 'goal-weight', 'goal-cycle']);
const CENTER_STEPS = new Set([
  ...PICKER_STEPS,
  'checkup-frequency',
  'fitness-level',
  'sleep-level',
  'smoking',
  'diet-habits',
  'mood',
  'body-type',
]);
const FILL_STEPS = new Set(['medications-gate', 'conditions-gate']);

function stepNeedsScroll(step: AssessmentStep): boolean {
  if (['intro', 'complete'].includes(step.type)) return false;
  if (FILL_STEPS.has(step.type)) return false;
  if (CENTER_STEPS.has(step.type)) return false;
  return true;
}

function stepCenterContent(step: AssessmentStep): boolean {
  return CENTER_STEPS.has(step.type);
}

function stepFillBody(step: AssessmentStep): boolean {
  return FILL_STEPS.has(step.type);
}

function hidePrimaryCta(step: AssessmentStep): boolean {
  return step.type === 'medications-gate' || step.type === 'conditions-gate';
}

export default function AssessmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ preview?: string; step?: string }>();
  // /profile/complete reuses this screen for "დაასრულე პროფილი" (the full question list).
  const profileMode = (usePathname() ?? '').startsWith('/profile');
  const STEPS = profileMode ? ACTIVE_ASSESSMENT_STEPS : ONBOARDING_STEPS;
  const visibleFor = useCallback(
    (f: Partial<AssessmentFormState>) => (profileMode ? visibleAssessmentIndices(f) : onboardingVisibleIndices(f)),
    [profileMode],
  );
  const preview = useOnboardingDevPreview();
  const {
    user,
    healthProfile,
    refreshHealthProfile,
    setHealthProfile,
    setUser,
    ready,
    signOut,
  } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<AssessmentFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowUnauthedRedirect, setAllowUnauthedRedirect] = useState(false);
  const initialized = useRef(false);
  const sessionDead = useRef(false);

  // Sign-up navigates here in the same tick that setUser is scheduled. Wait one
  // frame so we do not bounce a brand-new session back to sign-in.
  useEffect(() => {
    if (user) {
      setAllowUnauthedRedirect(false);
      return;
    }
    const t = setTimeout(() => setAllowUnauthedRedirect(true), 400);
    return () => clearTimeout(t);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!preview) {
          await api.auth.me();
        }
        await refreshHealthProfile();
      } catch (e) {
        if (!cancelled && e instanceof ApiError && e.isUnauthorized) {
          sessionDead.current = true;
          initialized.current = false;
          setError(authErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview, refreshHealthProfile]);

  useEffect(() => {
    if (!user || loading || initialized.current || sessionDead.current) return;
    const restored = formFromProfile(healthProfile, user);
    const visible = visibleFor(restored);
    const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
    let resume = 0;
    if (profileMode) {
      // Start at the first question the completion card counts as missing.
      const missing = new Set(profileCompletion(healthProfile, user).missing);
      resume = visible.find((i) => missing.has(STEPS[i].type)) ?? 0;
    } else if (extra.onboardingVersion === 2 && typeof extra.onboardingStepKey === 'string') {
      resume = Math.max(0, STEPS.findIndex((st) => st.key === extra.onboardingStepKey));
    }
    if (preview && profileMode) {
      const qa = findAssessmentQaStepIndex(params.step);
      if (qa >= 0) resume = qa;
    }
    setStepIndex(visible.find((index) => index >= resume) ?? visible[visible.length - 1]);
    setForm(restored);
    initialized.current = true;
  }, [user, healthProfile, loading, preview, params.step, profileMode, visibleFor, STEPS]);

  useEffect(() => {
    if (!preview || !initialized.current) return;
    const qa = findAssessmentQaStepIndex(params.step);
    if (qa >= 0 && profileMode) setStepIndex(qa);
  }, [preview, params.step, profileMode]);

  const step = STEPS[stepIndex];
  // Funnel: onboarding step keys only (no answers). Not in profile mode or dev preview.
  const funnelOnboarding = !profileMode && !preview;
  const viewedStepKey = form ? step?.key : undefined;
  useEffect(() => {
    if (funnelOnboarding) trackOnboardingStep('viewed', viewedStepKey);
  }, [funnelOnboarding, viewedStepKey]);
  const visibleIndices = useMemo(
    () => visibleFor(form ?? {}),
    [visibleFor, form?.takesMedications, form?.hasConditions, form?.primaryGoal, form?.gender],
  );
  const isLastVisible = visibleIndices[visibleIndices.length - 1] === stepIndex;
  const visiblePosition = Math.max(0, visibleIndices.indexOf(stepIndex));
  const progress = {
    visible: true,
    fraction: visiblePosition / Math.max(1, visibleIndices.length - 1),
  };

  const title = step
    ? (ka.assessment.steps as Record<string, string>)[step.titleKey]
    : '';
  const body = step?.bodyKey
    ? (ka.assessment.steps as Record<string, string>)[step.bodyKey]
    : undefined;

  const patchForm = useCallback((patch: Partial<AssessmentFormState>) => {
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      return next;
    });
  }, []);

  const markSessionDead = (e: unknown) => {
    if (e instanceof ApiError && e.isUnauthorized) {
      sessionDead.current = true;
    }
  };

  const persistStep = useCallback(
    async (nextIndex: number, currentForm: AssessmentFormState) => {
      if (preview) return;
      const payload = patchPayloadForStep(currentForm, nextIndex);
      if (!profileMode) {
        payload.extraAnswers = {
          ...(payload.extraAnswers as Record<string, unknown>),
          onboardingVersion: 2,
          onboardingStepKey: STEPS[nextIndex]?.key,
        };
      }
      const result = await api.healthProfile.update(payload);
      setHealthProfile(result.profile);
      if (result.user) setUser(result.user);
    },
    [preview, setHealthProfile, setUser, profileMode, STEPS],
  );

  const finishAssessmentPhase = useCallback(
    async (currentForm: AssessmentFormState) => {
      if (preview) {
        router.replace(
          onboardingDevHref('/(auth)/profile-setup/privacy') as never,
        );
        return;
      }
      if (profileMode) {
        const result = await api.healthProfile.update(fullProfilePayload(currentForm, stepIndex));
        setHealthProfile(result.profile);
        if (result.user) setUser(result.user);
        router.replace('/(tabs)/profile' as never);
        return;
      }
      const confirmed = new Set(currentForm.confirmedSteps ?? []);
      // Goal-specific first step: saved where the feature already reads it (one source of truth).
      if (currentForm.primaryGoal === 'nutrition' && confirmed.has('goal-weight')) {
        const draft = createWeightDraft(currentForm.weightKg);
        draft.targetKg = currentForm.targetWeightKg;
        draft.deadlineYmd = deadlineFromPace(currentForm.weightKg, currentForm.targetWeightKg, 'moderate');
        // Reminders stay off until the person grants notifications in step 7.
        draft.reminderEnabled = false;
        const goal = draftToGoal(draft);
        if (goal) await saveWeightGoal({ ...goal, updatedAt: new Date().toISOString() });
      }
      if (currentForm.primaryGoal === 'cycle' && confirmed.has('goal-cycle') && lastPeriodValid(currentForm)) {
        await api.cycle.setLastPeriod(lastPeriodYmd(currentForm)).catch(() => undefined);
      }
      const result = await api.healthProfile.update({
        ...fullProfilePayload(currentForm, stepIndex),
        extraAnswers: {
          ...extraAnswersPayload(currentForm),
          assessmentPhaseComplete: true,
          onboardingVersion: 2,
          onboardingStepKey: null,
        },
      });
      setHealthProfile(result.profile);
      if (result.user) setUser(result.user);
      trackOnboardingStep('completed', STEPS[stepIndex]?.key);
      router.replace(nextProfileSetupHref(result.profile, result.user ?? user) as never);
    },
    [preview, router, setHealthProfile, setUser, stepIndex, profileMode, user],
  );

  const advanceWithPatch = async (patch: Partial<AssessmentFormState>) => {
    if (!form || !step || busy) return;
    Keyboard.dismiss();
    const nextForm = {
      ...form,
      ...patch,
      confirmedSteps: Array.from(
        new Set([...(form.confirmedSteps ?? []), step.type, ...(step.type === 'body' ? ['height', 'weight'] : [])]),
      ),
    };
    setForm(nextForm);
    setError(null);

    const prevIndex = stepIndex;
    const nextIndex = resolveNextIndex(stepIndex, visibleFor(nextForm));
    setStepIndex(nextIndex);

    setBusy(true);
    try {
      await persistStep(nextIndex, nextForm);
      if (funnelOnboarding) trackOnboardingStep('completed', step.key);
    } catch (e) {
      markSessionDead(e);
      setStepIndex(prevIndex);
      setForm(form);
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (!form || !step || busy) return;
    setError(null);

    if (step.type === 'complete' || (!profileMode && isLastVisible)) {
      const finalForm = step.type === 'complete' ? form : {
        ...form,
        confirmedSteps: Array.from(new Set([...(form.confirmedSteps ?? []), step.type, ...(step.type === 'body' ? ['height', 'weight'] : [])])),
      };
      setBusy(true);
      try {
        await finishAssessmentPhase(finalForm);
      } catch (e) {
        markSessionDead(e);
        setError(authErrorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }

    Keyboard.dismiss();
    const confirmedForm = {
      ...form,
      // Leaving the body step: seed the weight goal from the real weight unless already chosen.
      ...(step.type === 'body' && !form.confirmedSteps?.includes('goal-weight')
        ? { targetWeightKg: suggestTargetWeight(form.heightCm, form.weightKg) }
        : {}),
      confirmedSteps: Array.from(
        new Set([...(form.confirmedSteps ?? []), step.type, ...(step.type === 'body' ? ['height', 'weight'] : [])]),
      ),
    };
    setForm(confirmedForm);
    const prevIndex = stepIndex;
    const nextIndex = resolveNextIndex(stepIndex, visibleFor(confirmedForm));
    setStepIndex(nextIndex);

    setBusy(true);
    try {
      await persistStep(nextIndex, confirmedForm);
      if (funnelOnboarding) trackOnboardingStep('completed', step.key);
    } catch (e) {
      markSessionDead(e);
      setStepIndex(prevIndex);
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (!form || stepIndex <= 0 || busy) return;
    setError(null);
    setStepIndex(resolvePrevIndex(stepIndex, visibleFor(form)));
  };

  const goSkip = async (remaining = false) => {
    if (!form || !step || busy) return;
    Keyboard.dismiss();
    setError(null);
    if (!profileMode && isLastVisible) {
      // Skipping the optional goal step still finishes onboarding (nothing extra is saved).
      setBusy(true);
      try {
        await finishAssessmentPhase(form);
      } catch (e) {
        markSessionDead(e);
        setError(authErrorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    const prevIndex = stepIndex;
    const nextIndex = remaining
      ? STEPS.length - 1
      : resolveNextIndex(stepIndex, visibleFor(form));
    setStepIndex(nextIndex);
    setBusy(true);
    try {
      await persistStep(nextIndex, form);
    } catch (e) {
      markSessionDead(e);
      setStepIndex(prevIndex);
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!loading && sessionDead.current) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100 px-6">
        <Text className="text-center font-sans text-base text-state-danger">
          {error ?? ka.auth.registerNotConfirmed}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void signOut().then(() => router.replace('/(auth)/sign-in'));
          }}
          style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 20 }}
        >
          <Text className="font-sans-semibold text-base text-primary-200">
            {ka.auth.signIn}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!user) {
    if (!allowUnauthedRedirect) {
      return (
        <View className="flex-1 items-center justify-center bg-bg-100">
          <ActivityIndicator size="large" />
        </View>
      );
    }
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!preview && !profileMode && needsProfileSetup(healthProfile)) {
    return (
      <Redirect href={nextProfileSetupHref(healthProfile, user) as never} />
    );
  }

  if (loading || !form || !step) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isIntro = step.type === 'intro';
  const isComplete = step.type === 'complete';
  const primaryLabel = isIntro
    ? ka.assessment.ready
    : isComplete
      ? ka.assessment.goToPersonalInfo
      : !profileMode && isLastVisible
        ? ka.assessment.finishLabel
        : ka.assessment.continue;
  const canContinue = stepCanContinue(step, form);

  return (
    <AssessmentShell
      variant={isIntro ? 'intro' : isComplete ? 'phase-complete' : 'step'}
      title={title}
      body={isComplete ? undefined : body || undefined}
      progress={progress}
      primaryLabel={primaryLabel}
      stepLabel={
        !isIntro && !isComplete
          ? profileMode
            ? `კითხვა ${visiblePosition} / ${visibleIndices.length - 2}${step.skippable ? ' · არჩევითი' : ' · აუცილებელი'}`
            : `${ka.assessment.onboardingStep(visiblePosition + 1, visibleIndices.length + (form.primaryGoal ? 0 : 1) + ONBOARDING_TAIL_STEPS)}${step.skippable ? ' · ' + ka.assessment.optional : ''}`
          : undefined
      }
      onPrimary={goNext}
      onBack={goBack}
      onSkip={step.skippable ? () => void goSkip() : undefined}
      canBack={stepIndex > 0}
      skippable={!!step.skippable}
      loading={busy}
      primaryDisabled={!canContinue}
      scrollContent={stepNeedsScroll(step)}
      centerContent={stepCenterContent(step)}
      fillBody={stepFillBody(step)}
      ctaInline={false}
      largeTitle={
        step.type === 'health-goals' ||
        step.type === 'birthdate' ||
        step.type === 'body-type' ||
        step.type === 'weight' ||
        step.type === 'height' ||
        step.type === 'blood-type' ||
        step.type === 'fitness-level' ||
        step.type === 'sleep-level' ||
        step.type === 'mood' ||
        step.type === 'smoking' ||
        step.type === 'diet-habits' ||
        step.type === 'medications-list' ||
        step.type === 'allergies' ||
        step.type === 'checkup-frequency' ||
        step.type === 'primary-goal' ||
        step.type === 'body' ||
        step.type.startsWith('goal-')
      }
      footerBelow={
        step.type === 'weight' && profileMode ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void goSkip(true)}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text className="font-sans text-sm text-text-200">
              დანარჩენ კითხვებს მოგვიანებით შევავსებ
            </Text>
          </Pressable>
        ) : step.type === 'allergies' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void advanceWithPatch({ allergies: [] })}
            style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 15,
                lineHeight: 22,
                color: '#14B8A6',
              }}
            >
              {ka.assessment.noAllergies}
            </Text>
          </Pressable>
        ) : step.type === 'checkup-frequency' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void advanceWithPatch({ checkupFrequency: 'NEVER' })}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              height: 22,
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: '#14B8A6',
              }}
            >
              {ka.assessment.neverCheckup}
            </Text>
          </Pressable>
        ) : null
      }
      primaryVariant="primary"
      showPrimary={!hidePrimaryCta(step)}
    >
      {isComplete ? (
        <AssessmentCompleteContent
          form={form}
          onEdit={(index) => {
            if (!busy) {
              setError(null);
              setStepIndex(index);
            }
          }}
        />
      ) : null}
      {!isComplete ? (
        <AssessmentStepContent
          step={step}
          form={form}
          onChange={patchForm}
          onAutoAdvance={advanceWithPatch}
        />
      ) : null}
      {error ? (
        <View className="mt-3 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3">
          <Text className="font-sans text-sm text-state-danger">{error}</Text>
        </View>
      ) : null}
    </AssessmentShell>
  );
}
