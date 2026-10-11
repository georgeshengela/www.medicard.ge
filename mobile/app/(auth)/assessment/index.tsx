import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ExistingAccountCheck } from '@/components/auth/ExistingAccountCheck';
import { OnboardingExitLinks } from '@/components/auth/OnboardingExit';
import { QuestionContent, questionCopy, questionReady } from '@/components/assessment/QuestionContent';
import { NameForm } from '@/components/onboarding/NameForm';
import { QuestionPage, StepHeader } from '@/components/onboarding/OnboardingKit';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { ONBOARDING_STEP_KEYS, ONBOARDING_TAIL_STEPS, onboardingResumeQuestion } from '@/constants/assessmentSteps';
import { tx } from '@/i18n/locale';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { birthDateFromForm, formFromProfile, fullNameFromForm, type AssessmentFormState } from '@/lib/assessmentForm';
import { hasFirstAndLastName } from '@/lib/displayName';
import { nextProfileSetupHref } from '@/lib/onboarding';
import { onboardingDevHref, useOnboardingDevPreview } from '@/lib/onboardingDevPreview';
import { getPreference, setPreference } from '@/lib/storage';
import { needsProfileSetup, useAuth } from '@/store/AuthContext';
import { useVelvet } from '@/theme/velvet';

type OnboardingQuestion = keyof typeof ONBOARDING_STEP_KEYS;

/** Product funnel: onboarding step keys only (no answers). Lazy so tests and startup never depend on it. */
function trackOnboardingStep(kind: 'viewed' | 'completed', key: string | undefined) {
  void import('@/lib/funnel').then((funnel) => funnel.trackOnboardingStep(kind, key)).catch(() => undefined);
}

/**
 * Registration (owner 2026-10-11): right after the SMS code a new number gets the standard sign-up
 * page — first and last name — then sex, birth date (18+), height, weight, each on its own velvet
 * page like sign-in. Accounts that already have a real name (email, Google, Apple with a name) start
 * at sex. Every answer is saved as it is given; a killed app resumes at the stored step.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { palette: p, dark } = useVelvet();
  const { user, healthProfile, refreshHealthProfile, setHealthProfile, setUser, ready, signOut, discardNewAccount } = useAuth();

  const [steps, setSteps] = useState<OnboardingQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<AssessmentFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowUnauthedRedirect, setAllowUnauthedRedirect] = useState(false);
  const sessionDead = useRef(false);

  // „MEDICARD უკვე გამოგიყენებია?“ — once, on a just-created account that has not started onboarding.
  const [existingCheck, setExistingCheck] = useState<'unknown' | 'ask' | 'done'>('unknown');
  const existingKey = user ? `onboarding.existingAccountAsked.${user.id}` : null;
  useEffect(() => {
    if (!user || !existingKey) return;
    const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
    const fresh = Date.now() - new Date(user.createdAt ?? 0).getTime() < 24 * 60 * 60 * 1000;
    if (preview || !fresh || typeof extra.onboardingStepKey === 'string') {
      setExistingCheck('done');
      return;
    }
    let alive = true;
    void getPreference(existingKey)
      .catch(() => null)
      .then((value) => {
        if (alive) setExistingCheck(value ? 'done' : 'ask');
      });
    return () => {
      alive = false;
    };
    // Decided once per account; later profile reads must not bring the question back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, existingKey, preview]);

  // Sign-up navigates here in the same tick that setUser is scheduled. Wait one frame so a brand-new
  // session is not bounced back to sign-in.
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
        if (!preview) await api.auth.me();
        await refreshHealthProfile();
      } catch (e) {
        if (!cancelled && e instanceof ApiError && e.isUnauthorized) {
          sessionDead.current = true;
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

  // The pages are decided once: the name page only when the sign-in brought no first + last name
  // (phone, Apple without a name or with a given name only); a known first name is filled in.
  useEffect(() => {
    if (!user || loading || steps || sessionDead.current) return;
    const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
    const list: OnboardingQuestion[] = [...(hasFirstAndLastName(user, extra) ? [] : ['name' as const]), 'gender', 'birthdate', 'height', 'weight'];
    const resume = onboardingResumeQuestion(extra.onboardingStepKey);
    setSteps(list);
    setIndex(resume && list.includes(resume) ? list.indexOf(resume) : 0);
    setForm(formFromProfile(healthProfile, user));
  }, [user, healthProfile, loading, steps]);

  const question = steps?.[index];
  const funnelOn = !preview;
  useEffect(() => {
    if (funnelOn && question && form) trackOnboardingStep('viewed', ONBOARDING_STEP_KEYS[question]);
  }, [funnelOn, question, form]);

  const patch = useCallback((next: Partial<AssessmentFormState>) => {
    setForm((current) => (current ? { ...current, ...next } : current));
  }, []);

  const markSessionDead = (e: unknown) => {
    if (e instanceof ApiError && e.isUnauthorized) sessionDead.current = true;
  };

  /** Saves the answer of `q` and where to resume (`nextKey`; null = the questions are done). */
  const save = async (q: OnboardingQuestion, current: AssessmentFormState, nextKey: string | null) => {
    if (preview) return;
    if (q === 'name') {
      const fullName = fullNameFromForm(current);
      if (!fullName) return;
      const result = await api.auth.updateProfile({ fullName });
      setUser(result.user);
    }
    const confirmed = current.confirmedSteps;
    const result = await api.healthProfile.update({
      ...(q === 'gender' && current.gender ? { gender: current.gender } : {}),
      ...(confirmed.includes('birthdate') ? { birthDate: birthDateFromForm(current) } : {}),
      ...(confirmed.includes('height') ? { heightCm: current.heightCm } : {}),
      ...(confirmed.includes('weight') ? { weightKg: current.weightKg } : {}),
      extraAnswers: {
        confirmedSteps: confirmed,
        ...(q === 'name' ? { legalName: fullNameFromForm(current) } : {}),
        ...(q === 'gender' ? { genderOther: current.gender === 'OTHER' ? current.genderOther.trim() : '' } : {}),
        weightUnit: current.weightUnit,
        heightUnit: current.heightUnit,
        onboardingVersion: 2,
        onboardingStepKey: nextKey,
        ...(nextKey === null ? { assessmentPhaseComplete: true } : {}),
      },
    });
    setHealthProfile(result.profile);
    if (result.user) setUser(result.user);
  };

  const goNext = async () => {
    if (!form || !question || !steps || busy) return;
    Keyboard.dismiss();
    setError(null);
    const confirmed = Array.from(new Set([...form.confirmedSteps, question]));
    const current = { ...form, confirmedSteps: confirmed };
    setForm(current);
    const last = index === steps.length - 1;
    const nextKey = last ? null : ONBOARDING_STEP_KEYS[steps[index + 1]];
    setBusy(true);
    try {
      await save(question, current, nextKey);
      if (funnelOn) trackOnboardingStep('completed', ONBOARDING_STEP_KEYS[question]);
      if (last) {
        if (preview) router.replace(onboardingDevHref('/(auth)/profile-setup/privacy') as never);
        else router.replace(nextProfileSetupHref(healthProfile, user) as never);
        return;
      }
      setIndex(index + 1);
    } catch (e) {
      markSessionDead(e);
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (busy || index <= 0) return;
    setError(null);
    setIndex(index - 1);
  };

  if (!ready) return <Waiting background={p.surface} />;

  if (!loading && sessionDead.current) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, paddingHorizontal: 24, gap: 16 }}>
        <VelvetNotice palette={p} text={error ?? tx('სესია დასრულდა. შედი თავიდან.', 'Your session ended. Please sign in again.')} />
        <VelvetButton palette={p} label={tx('შესვლა', 'Sign in')} onPress={() => void signOut().then(() => router.replace('/(auth)/sign-in'))} />
      </View>
    );
  }

  if (!user) {
    if (!allowUnauthedRedirect) return <Waiting background={p.surface} />;
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!preview && needsProfileSetup(healthProfile)) {
    return <Redirect href={nextProfileSetupHref(healthProfile, user) as never} />;
  }

  if (existingCheck === 'ask') {
    return (
      <ExistingAccountCheck
        onNew={() => {
          if (existingKey) void setPreference(existingKey, '1').catch(() => undefined);
          setExistingCheck('done');
        }}
        onHaveAccount={async () => {
          await discardNewAccount();
          router.replace('/(auth)/sign-in');
        }}
      />
    );
  }

  if (loading || !form || !question || !steps || existingCheck === 'unknown') return <Waiting background={p.surface} />;

  if (question === 'name') {
    return (
      <NameForm
        palette={p}
        dark={dark}
        firstName={form.firstName}
        lastName={form.lastName}
        onChange={patch}
        onSubmit={() => void goNext()}
        busy={busy}
        error={error}
        subtitle={questionCopy('name', form).body ?? ''}
        submitLabel={tx('გაგრძელება', 'Continue')}
        below={<OnboardingExitLinks disabled={busy} color={p.ink2} />}
      />
    );
  }

  // Progress counts the questions after the name page plus the three setup pages that follow.
  const counted = steps.filter((s) => s !== 'name');
  const canContinue = questionReady(question, form);
  const copy = questionCopy(question, form);

  return (
    <QuestionPage
      palette={p}
      header={
        <StepHeader
          palette={p}
          step={counted.indexOf(question)}
          total={counted.length + ONBOARDING_TAIL_STEPS}
          onBack={index > 0 ? goBack : undefined}
        />
      }
      title={copy.title}
      body={copy.body}
      error={error}
      center={question === 'gender' || question === 'birthdate' || question === 'height' || question === 'weight'}
      primary={{ label: tx('გაგრძელება', 'Continue'), onPress: () => void goNext(), disabled: !canContinue, busy }}
      footerBelow={
        preview ? null : (
          // A way out on every page; under 18 the account can be deleted right here.
          <OnboardingExitLinks showDelete={question === 'birthdate' && !canContinue} disabled={busy} color={p.ink2} />
        )
      }
    >
      <QuestionContent palette={p} question={question} form={form} onChange={patch} onHabits={() => undefined} onAnswer={patch} />
    </QuestionPage>
  );
}

function Waiting({ background }: { background: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: background }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
