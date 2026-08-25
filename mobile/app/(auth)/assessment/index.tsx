import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
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
import {
  extraAnswersPayload,
  formFromProfile,
  fullProfilePayload,
  patchPayloadForStep,
  type AssessmentFormState,
} from '@/lib/assessmentForm';
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

const PICKER_STEPS = new Set(['birthdate', 'weight', 'height', 'checkup-frequency']);
const CENTER_STEPS = new Set([
  ...PICKER_STEPS,
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
  const { user, healthProfile, refreshHealthProfile, setHealthProfile, setUser, ready } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<AssessmentFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowUnauthedRedirect, setAllowUnauthedRedirect] = useState(false);
  const initialized = useRef(false);

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
        await refreshHealthProfile();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshHealthProfile]);

  useEffect(() => {
    if (!user || loading || initialized.current) return;
    const resume = healthProfile?.currentStepIndex ?? 0;
    const clamped = Math.min(Math.max(0, resume), ACTIVE_ASSESSMENT_STEPS.length - 1);
    setStepIndex(clamped);
    setForm(formFromProfile(healthProfile, user));
    initialized.current = true;
  }, [user, healthProfile, loading]);

  const step = ACTIVE_ASSESSMENT_STEPS[stepIndex];
  const progress = useMemo(() => assessmentProgressState(stepIndex), [stepIndex]);

  const title = step ? (ka.assessment.steps as Record<string, string>)[step.titleKey] : '';
  const body = step?.bodyKey ? (ka.assessment.steps as Record<string, string>)[step.bodyKey] : undefined;

  const patchForm = useCallback((patch: Partial<AssessmentFormState>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const persistStep = useCallback(
    async (nextIndex: number, currentForm: AssessmentFormState) => {
      const payload = patchPayloadForStep(currentForm, nextIndex);
      const result = await api.healthProfile.update(payload);
      setHealthProfile(result.profile);
      if (result.user) setUser(result.user);
    },
    [setHealthProfile, setUser],
  );

  const finishAssessmentPhase = useCallback(
    async (currentForm: AssessmentFormState) => {
      const result = await api.healthProfile.update({
        ...fullProfilePayload(currentForm, stepIndex),
        extraAnswers: {
          ...extraAnswersPayload(currentForm),
          assessmentPhaseComplete: true,
        },
      });
      setHealthProfile(result.profile);
      if (result.user) setUser(result.user);
      router.replace('/(auth)/profile-setup');
    },
    [router, setHealthProfile, setUser, stepIndex],
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
      setStepIndex(prevIndex);
      setForm(form);
      setError(e instanceof ApiError ? e.message : ka.common.error);
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
        setError(e instanceof ApiError ? e.message : ka.common.error);
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
      setStepIndex(prevIndex);
      setError(e instanceof ApiError ? e.message : ka.common.error);
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
      setStepIndex(prevIndex);
      setError(e instanceof ApiError ? e.message : ka.common.error);
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

  if (needsProfileSetup(healthProfile)) {
    return <Redirect href="/(auth)/profile-setup" />;
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
        step.type === 'allergies'
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
