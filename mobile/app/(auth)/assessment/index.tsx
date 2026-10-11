import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { ExistingAccountCheck } from '@/components/auth/ExistingAccountCheck';
import { OnboardingExitLinks } from '@/components/auth/OnboardingExit';
import { VelvetAuthHeader } from '@/components/auth/VelvetAuthHeader';
import { QuestionContent, questionCopy, questionReady } from '@/components/assessment/QuestionContent';
import { QuestionPage, StepHeader } from '@/components/onboarding/OnboardingKit';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetInput } from '@/components/velvet/VelvetInput';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { ONBOARDING_STEP_KEYS, ONBOARDING_TAIL_STEPS, onboardingResumeQuestion } from '@/constants/assessmentSteps';
import { tx } from '@/i18n/locale';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { birthDateFromForm, formFromProfile, fullNameFromForm, type AssessmentFormState } from '@/lib/assessmentForm';
import { realFullName } from '@/lib/displayName';
import { nextProfileSetupHref } from '@/lib/onboarding';
import { onboardingDevHref, useOnboardingDevPreview } from '@/lib/onboardingDevPreview';
import { getPreference, setPreference } from '@/lib/storage';
import { useKeyboardMetrics } from '@/lib/useKeyboardHeight';
import { AUTH_KEYBOARD_OPEN_PX } from '@/lib/authChrome';
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

  // The pages are decided once: the name page only when the sign-in brought no real name.
  useEffect(() => {
    if (!user || loading || steps || sessionDead.current) return;
    const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
    const list: OnboardingQuestion[] = [...(realFullName(user, extra) ? [] : ['name' as const]), 'gender', 'birthdate', 'height', 'weight'];
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
    return <NameStep form={form} onChange={patch} onContinue={() => void goNext()} busy={busy} error={error} palette={p} dark={dark} />;
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
      center={question === 'birthdate' || question === 'height' || question === 'weight'}
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

/**
 * The standard sign-up page for a number that just got its account: the heartbeat disc of sign-in,
 * „როგორ გქვია?“, first and last name. Both are needed (2+ letters each).
 */
function NameStep({
  form,
  onChange,
  onContinue,
  busy,
  error,
  palette: p,
  dark,
}: {
  form: AssessmentFormState;
  onChange: (next: Partial<AssessmentFormState>) => void;
  onContinue: () => void;
  busy: boolean;
  error: string | null;
  palette: ReturnType<typeof useVelvet>['palette'];
  dark: boolean;
}) {
  const lastRef = useRef<TextInput>(null);
  const [touched, setTouched] = useState<{ first?: boolean; last?: boolean }>({});
  const { height: keyboardHeight } = useKeyboardMetrics();
  const keyboardOpen = keyboardHeight > AUTH_KEYBOARD_OPEN_PX;
  const copy = questionCopy('name', form);
  const firstOk = form.firstName.trim().length >= 2;
  const lastOk = form.lastName.trim().length >= 2;

  return (
    <AuthShell
      backgroundColor={p.surface}
      renderHeader={(compact, durationMs) => (
        <VelvetAuthHeader palette={p} dark={dark} title={copy.title} titleKind="heading" subtitle={copy.body} compact={compact} durationMs={durationMs} />
      )}
      footer={
        <View style={{ gap: 4 }}>
          <VelvetButton palette={p} label={tx('გაგრძელება', 'Continue')} busy={busy} disabled={!firstOk || !lastOk} onPress={onContinue} />
          {keyboardOpen ? null : <OnboardingExitLinks disabled={busy} color={p.ink2} />}
        </View>
      }
    >
      <View style={{ gap: 18 }}>
        <VelvetInput
          palette={p}
          label={tx('სახელი', 'First name')}
          placeholder={tx('მაგ. ნინო', 'e.g. Nino')}
          icon={User}
          value={form.firstName}
          onChangeText={(firstName) => onChange({ firstName })}
          onBlur={() => setTouched((t) => ({ ...t, first: true }))}
          error={touched.first && !firstOk ? tx('შეიყვანე სახელი', 'Enter your first name') : null}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => lastRef.current?.focus()}
          maxLength={60}
        />
        <VelvetInput
          ref={lastRef}
          palette={p}
          label={tx('გვარი', 'Last name')}
          placeholder={tx('მაგ. ბერიძე', 'e.g. Beridze')}
          icon={User}
          value={form.lastName}
          onChangeText={(lastName) => onChange({ lastName })}
          onBlur={() => setTouched((t) => ({ ...t, last: true }))}
          error={touched.last && !lastOk ? tx('შეიყვანე გვარი', 'Enter your last name') : null}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (firstOk && lastOk) onContinue();
          }}
          maxLength={60}
        />
        {error ? <VelvetNotice palette={p} text={error} /> : null}
        <Pressable accessible={false} onPress={Keyboard.dismiss}>
          <Text style={{ marginTop: 2, marginHorizontal: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: p.inkOff }}>
            {tx('სახელი და გვარი ჩანს შენს პროფილში და ჯანმრთელობის პასპორტში.', 'Your name shows on your profile and in your health passport.')}
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
