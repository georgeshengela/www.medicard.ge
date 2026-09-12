import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AssessmentCompleteContent } from '@/components/assessment/AssessmentCompleteContent';
import { AssessmentShell } from '@/components/assessment/AssessmentShell';
import { AssessmentStepContent, stepCanContinue } from '@/components/assessment/AssessmentStepContent';
import {
  ACTIVE_ASSESSMENT_STEPS,
  assessmentProgressState,
  type AssessmentStep,
} from '@/constants/assessmentSteps';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import {
  extraAnswersPayload,
  formFromProfile,
  fullProfilePayload,
  patchPayloadForStep,
  type AssessmentFormState,
} from '@/lib/assessmentForm';
import { nextProfileSetupHref } from '@/lib/onboarding';
import { findAssessmentQaStepIndex, onboardingDevHref, useOnboardingDevPreview } from '@/lib/onboardingDevPreview';
import { needsProfileSetup, useAuth } from '@/store/AuthContext';

function resolveNextIndex(from: number, form: AssessmentFormState): number {
  let next = Math.min(from + 1, ACTIVE_ASSESSMENT_STEPS.length - 1);
  while (next < ACTIVE_ASSESSMENT_STEPS.length) {
    const type = ACTIVE_ASSESSMENT_STEPS[next]?.type;
    if (type === 'medications-list' && form.takesMedications === false) {
      next += 1;
      continue;
    }
    if (type === 'conditions-list' && form.hasConditions === false) {
      next += 1;
      continue;
    }
    break;
  }
  return Math.min(next, ACTIVE_ASSESSMENT_STEPS.length - 1);
}

function resolvePrevIndex(from: number, form: AssessmentFormState): number {
  let prev = Math.max(from - 1, 0);
  while (prev > 0) {
    const type = ACTIVE_ASSESSMENT_STEPS[prev]?.type;
    if (type === 'medications-list' && form.takesMedications === false) {
      prev -= 1;
      continue;
    }
    if (type === 'conditions-list' && form.hasConditions === false) {
      prev -= 1;
      continue;
    }
    break;
  }
  return Math.max(prev, 0);
}

const PICKER_STEPS = new Set(['birthdate', 'weight', 'height']);
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
  const preview = useOnboardingDevPreview();
  const { user, healthProfile, refreshHealthProfile, setHealthProfile, setUser, ready, signOut } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<AssessmentFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowUnauthedRedirect, setAllowUnauthedRedirect] = useState(false);
  const initialized = useRef(false);
  const sessionDead = useRef(false);
  const formRef = useRef<AssessmentFormState | null>(null);
  const stepIndexRef = useRef(0);

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
    let resume = healthProfile?.currentStepIndex ?? 0;
    if (preview) {
      const qa = findAssessmentQaStepIndex(params.step);
      resume = qa >= 0 ? qa : 0;
    }
    const clamped = Math.min(Math.max(0, resume), ACTIVE_ASSESSMENT_STEPS.length - 1);
    setStepIndex(clamped);
    setForm(formFromProfile(healthProfile, user));
    initialized.current = true;
  }, [user, healthProfile, loading, preview, params.step]);

  useEffect(() => {
    if (!preview || !initialized.current) return;
    const qa = findAssessmentQaStepIndex(params.step);
    if (qa >= 0) setStepIndex(qa);
  }, [preview, params.step]);

  formRef.current = form;
  stepIndexRef.current = stepIndex;

  const persistDraft = useCallback(
    async (currentForm: AssessmentFormState, index: number) => {
      if (preview) return;
      try {
        const result = await api.healthProfile.update(patchPayloadForStep(currentForm, index));
        setHealthProfile(result.profile);
        if (result.user) setUser(result.user);
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) {
          sessionDead.current = true;
          setError(authErrorMessage(error));
        }
      }
    },
    [preview, setHealthProfile, setUser, setError],
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        const current = formRef.current;
        if (current && initialized.current) {
          void persistDraft(current, stepIndexRef.current);
        }
      };
    }, [persistDraft]),
  );

  const step = ACTIVE_ASSESSMENT_STEPS[stepIndex];
  const progress = useMemo(() => assessmentProgressState(stepIndex), [stepIndex]);

  const title = step ? (ka.assessment.steps as Record<string, string>)[step.titleKey] : '';
  const body = step?.bodyKey ? (ka.assessment.steps as Record<string, string>)[step.bodyKey] : undefined;

  const patchForm = useCallback((patch: Partial<AssessmentFormState>) => {
    setForm((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      formRef.current = next;
      const shouldPersist =
        'gender' in patch ||
        'genderOther' in patch ||
        'weightUnit' in patch ||
        'heightUnit' in patch;
      if (shouldPersist) {
        void persistDraft(next, stepIndexRef.current);
      }
      return next;
    });
  }, [persistDraft]);

  const markSessionDead = (e: unknown) => {
    if (e instanceof ApiError && e.isUnauthorized) {
      sessionDead.current = true;
    }
  };

  const persistStep = useCallback(
    async (nextIndex: number, currentForm: AssessmentFormState) => {
      if (preview) return;
      const payload = patchPayloadForStep(currentForm, nextIndex);
      const result = await api.healthProfile.update(payload);
      setHealthProfile(result.profile);
      if (result.user) setUser(result.user);
    },
    [preview, setHealthProfile, setUser],
  );

  const finishAssessmentPhase = useCallback(
    async (currentForm: AssessmentFormState) => {
      if (preview) {
        router.replace(onboardingDevHref('/(auth)/profile-setup/avatar') as never);
        return;
      }
      const result = await api.healthProfile.update({
        ...fullProfilePayload(currentForm, stepIndex),
        extraAnswers: {
          ...extraAnswersPayload(currentForm),
          assessmentPhaseComplete: true,
        },
      });
      setHealthProfile(result.profile);
      if (result.user) setUser(result.user);
      router.replace('/(auth)/profile-setup/avatar');
    },
    [preview, router, setHealthProfile, setUser, stepIndex],
  );

  const advanceWithPatch = async (patch: Partial<AssessmentFormState>) => {
    if (!form || !step || busy) return;
    const nextForm = { ...form, ...patch };
    setForm(nextForm);
    setError(null);

    const prevIndex = stepIndex;
    const nextIndex = resolveNextIndex(stepIndex, nextForm);
    setStepIndex(nextIndex);

    setBusy(true);
    try {
      await persistStep(nextIndex, nextForm);
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

    if (step.type === 'complete') {
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
    const nextIndex = resolveNextIndex(stepIndex, form);
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

  const goBack = () => {
    if (!form || stepIndex <= 0 || busy) return;
    setError(null);
    setStepIndex(resolvePrevIndex(stepIndex, form));
  };

  const goSkip = async () => {
    if (!form || !step || busy) return;
    setError(null);
    const prevIndex = stepIndex;
    const nextIndex = resolveNextIndex(stepIndex, form);
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
          <Text className="font-sans-semibold text-base text-primary-200">{ka.auth.signIn}</Text>
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

  if (!preview && needsProfileSetup(healthProfile)) {
    return <Redirect href={nextProfileSetupHref(healthProfile, user) as never} />;
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
      : ka.assessment.continue;
  const canContinue = stepCanContinue(step, form);
  const showCta = !hidePrimaryCta(step);

  return (
    <AssessmentShell
      variant={isIntro ? 'intro' : isComplete ? 'phase-complete' : 'step'}
      title={title}
      body={isComplete ? undefined : body || undefined}
      progress={progress}
      primaryLabel={primaryLabel}
      onPrimary={goNext}
      onBack={goBack}
      onSkip={step.skippable ? goSkip : undefined}
      canBack={stepIndex > 0 && !isComplete}
      skippable={!!step.skippable}
      loading={busy}
      primaryDisabled={!canContinue}
      scrollContent={stepNeedsScroll(step)}
      centerContent={stepCenterContent(step)}
      fillBody={stepFillBody(step)}
      ctaInline={step.type === 'checkup-frequency'}
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
        step.type === 'checkup-frequency'
      }
      footerBelow={
        step.type === 'allergies' ? (
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
            style={{ alignItems: 'center', justifyContent: 'center', height: 22 }}
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
      {isComplete ? <AssessmentCompleteContent /> : null}
      {!isComplete ? (
        <AssessmentStepContent step={step} form={form} onChange={patchForm} onAutoAdvance={advanceWithPatch} />
      ) : null}
      {error ? (
        <View className="mt-3 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3">
          <Text className="font-sans text-sm text-state-danger">{error}</Text>
        </View>
      ) : null}
    </AssessmentShell>
  );
}
