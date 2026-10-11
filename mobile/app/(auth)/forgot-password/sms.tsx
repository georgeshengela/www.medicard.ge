import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CircleAlert, Lock, Mail, MessageSquareText, Smartphone } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthPhoneField } from '@/components/auth/AuthPhoneField';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetInput } from '@/components/velvet/VelvetInput';
import { VelvetStrength } from '@/components/velvet/VelvetStrength';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { isPasswordStrongEnough, scorePassword } from '@/lib/passwordStrength';
import { displayGeorgianMobile, isGeorgianMobile, toE164Georgian } from '@/lib/phoneFormat';
import { useAuth } from '@/store/AuthContext';
import { useVelvet, velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';
import { tx } from '@/i18n/locale';

type Step = 'phone' | 'code' | 'password';
type Problem = { kind: 'not-found' | 'phone-login' | 'other'; message: string } | null;

const RESEND_SECONDS = 60;
const STEPS: Step[] = ['phone', 'code', 'password'];

/**
 * Password reset by SMS, three calm steps: number → 4-digit code → new password, then the
 * person is signed in. Accounts without a linked number are pointed to email reset; phone-only
 * accounts (no password) to SMS sign-in.
 */
export default function ForgotPasswordSms() {
  const router = useRouter();
  const { palette: p } = useVelvet();
  const reduceMotion = usePrefersReducedMotion();
  const { resetPasswordWithSms } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [codeKey, setCodeKey] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const lock = useRef(false);

  const phoneValid = isGeorgianMobile(local);
  const pretty = displayGeorgianMobile(local);
  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canReset = isPasswordStrongEnough(password) && passwordsMatch;

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const guarded = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const sendCode = (again = false) =>
    guarded(async () => {
      setProblem(null);
      try {
        const result = await api.auth.passwordSmsStart(toE164Georgian(local));
        setDevCode(result.devCode ?? null);
        setResendIn(result.cooldownSec && result.cooldownSec > 0 ? result.cooldownSec : RESEND_SECONDS);
        if (!again) {
          setCode('');
          setCodeError(null);
          setStep('code');
        }
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        setProblem({
          kind: code === 'PHONE_NOT_FOUND' ? 'not-found' : code === 'PHONE_LOGIN_ACCOUNT' ? 'phone-login' : 'other',
          message: authErrorMessage(err),
        });
        if (again) setCodeError(authErrorMessage(err));
      }
    });

  const onCode = (next: string) => {
    setCode(next);
    setCodeError(null);
    // The code is checked together with the new password; move on as soon as it is complete.
    if (next.length === 4) setTimeout(() => setStep('password'), 180);
  };

  const reset = () =>
    guarded(async () => {
      if (!canReset) return;
      setPasswordError(null);
      try {
        await resetPasswordWithSms({ phone: toE164Georgian(local), code, password, confirmPassword });
        router.replace('/(tabs)/home');
      } catch (err) {
        const message = authErrorMessage(err);
        // A wrong or expired code (or too many tries) sends the person back to the code step,
        // password kept. Decided on the server's own text, not on the displayed one.
        const serverText = err instanceof ApiError ? err.message : '';
        if (/კოდი|code/i.test(serverText)) {
          setCode('');
          setCodeKey((k) => k + 1);
          setCodeError(message);
          setStep('code');
        } else {
          setPasswordError(message);
        }
      }
    });

  const enter = reduceMotion ? undefined : FadeInDown.duration(260);
  const stepIndex = STEPS.indexOf(step);

  const back = () => {
    if (step === 'password') setStep('code');
    else if (step === 'code') setStep('phone');
    else router.back();
  };

  const footer =
    step === 'phone' ? (
      <VelvetButton palette={p} label={tx('კოდის გაგზავნა', 'Send code')} busy={busy} disabled={!phoneValid} onPress={() => void sendCode()} />
    ) : step === 'code' ? (
      <VelvetButton palette={p} label={tx('გაგრძელება', 'Continue')} disabled={code.length !== 4} onPress={() => setStep('password')} />
    ) : (
      <VelvetButton palette={p} label={tx('პაროლის შეცვლა და შესვლა', 'Change password and sign in')} busy={busy} disabled={!canReset} onPress={() => void reset()} />
    );

  return (
    <AuthShell backgroundColor={p.surface} footer={footer}>
      <StepHeader
        palette={p}
        step={stepIndex}
        onBack={back}
        title={step === 'phone' ? tx('აღდგენა SMS-ით', 'Reset by SMS') : step === 'code' ? tx('შეიყვანე კოდი', 'Enter the code') : tx('ახალი პაროლი', 'New password')}
        subtitle={
          step === 'phone'
            ? tx('ჩაწერე ანგარიშზე მიბმული ნომერი — 4-ციფრიან კოდს SMS-ით გამოგიგზავნით.', "Enter the number linked to your account — we'll text you a 4-digit code.")
            : step === 'code'
              ? undefined
              : tx('მოიფიქრე ახალი პაროლი. შეცვლის შემდეგ პირდაპირ შეხვალ ანგარიშში.', "Choose a new password. Once it's changed, you'll be signed in right away.")
        }
      />

      {step === 'phone' ? (
        <Animated.View key="phone" entering={enter}>
          <AuthPhoneField
            palette={p}
            label={ka.auth.phone}
            value={local}
            onChange={(next) => {
              setLocal(next);
              setProblem(null);
            }}
            hint={problem ? undefined : tx('მხოლოდ საქართველოს მობილური ნომერი', 'Georgian mobile numbers only')}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={() => phoneValid && void sendCode()}
          />
          {problem ? <ProblemCard palette={p} problem={problem} onEmail={() => router.replace('/(auth)/forgot-password/email')} onPhoneLogin={() => router.replace('/(auth)/phone')} /> : null}
        </Animated.View>
      ) : null}

      {step === 'code' ? (
        <Animated.View key="code" entering={enter}>
          <SentToCard palette={p} pretty={pretty} onChange={() => setStep('phone')} />
          <View style={{ marginTop: 28, alignItems: 'center' }}>
            <OtpCodeInput key={codeKey} value={code} onChange={onCode} error={codeError} length={4} resetKey={codeKey} palette={p} />
          </View>
          {devCode ? (
            <Text style={{ marginTop: 12, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: p.inkOff }}>
              {tx('სატესტო კოდი: ', 'Test code: ')}{devCode}
            </Text>
          ) : null}
          <View style={{ marginTop: 28, alignItems: 'center' }}>
            {resendIn > 0 ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: p.inkOff }}>
                {tx('ხელახლა გაგზავნა შეგიძლია ', 'You can resend in ')}{Math.floor(resendIn / 60)}:{String(resendIn % 60).padStart(2, '0')}{tx('-ში', '')}
              </Text>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => void sendCode(true)} disabled={busy} hitSlop={8} style={{ paddingVertical: 6 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: p.ink2 }}>
                  {tx('კოდი არ მოვიდა?', "Didn't get a code?")}{' '}
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: p.ink }}>{tx('ხელახლა გაგზავნა', 'Resend')}</Text>
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      ) : null}

      {step === 'password' ? (
        <Animated.View key="password" entering={enter} style={{ gap: 18 }}>
          <View>
            <VelvetInput
              palette={p}
              label={ka.auth.forgotPasswordNewPassword}
              placeholder={ka.auth.passwordPlaceholder}
              icon={Lock}
              value={password}
              onChangeText={(next) => {
                setPassword(next);
                setPasswordError(null);
              }}
              secure
              autoFocus
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {password ? <VelvetStrength level={strength.level} palette={p} /> : null}
          </View>
          <VelvetInput
            palette={p}
            label={ka.auth.confirmPassword}
            placeholder={ka.auth.confirmPasswordPlaceholder}
            icon={Lock}
            value={confirmPassword}
            onChangeText={(next) => {
              setConfirmPassword(next);
              setPasswordError(null);
            }}
            error={confirmPassword.length >= password.length && confirmPassword.length > 0 && !passwordsMatch ? ka.auth.passwordMismatch : undefined}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => canReset && void reset()}
          />
          {passwordError ? <ProblemCard palette={p} problem={{ kind: 'other', message: passwordError }} /> : null}
        </Animated.View>
      ) : null}
    </AuthShell>
  );
}

/** Back chevron with three progress grooves beside it (the done ones lit), then the title. */
function StepHeader({ step, title, subtitle, onBack, palette: p }: { step: number; title: string; subtitle?: string; onBack: () => void; palette: VelvetPalette }) {
  return (
    <AuthBackHeader
      palette={p}
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      aside={
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={tx(`ნაბიჯი ${step + 1} / ${STEPS.length}`, `Step ${step + 1} / ${STEPS.length}`)}
          style={{ flexDirection: 'row', gap: 8 }}
        >
          {STEPS.map((_, index) => (
            <View key={index} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: p.surface, boxShadow: velvetField(p), overflow: 'hidden' }}>
              {index <= step ? <View style={{ flex: 1, borderRadius: 3, backgroundColor: p.pulse }} /> : null}
            </View>
          ))}
        </View>
      }
    />
  );
}

/** "We sent it to +995 555 12 34 56 · change" */
function SentToCard({ pretty, onChange, palette: p }: { pretty: string; onChange: () => void; palette: VelvetPalette }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 20,
        backgroundColor: p.surface,
        boxShadow: velvetLift(p),
      }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: p.field, boxShadow: velvetField(p) }}>
        <MessageSquareText size={20} color={p.pulse} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p.ink2 }}>{tx('კოდი გამოვაგზავნეთ ნომერზე', 'We sent a code to')}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 22, color: p.text, letterSpacing: 0.3 }}>{pretty}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onChange} hitSlop={8} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: p.ink }}>{tx('შეცვლა', 'Change')}</Text>
      </Pressable>
    </View>
  );
}

/** Soft card for "no account with this number" (with the way forward) and other failures. */
function ProblemCard({
  problem,
  onEmail,
  onPhoneLogin,
  palette: p,
}: {
  problem: NonNullable<Problem>;
  onEmail?: () => void;
  onPhoneLogin?: () => void;
  palette: VelvetPalette;
}) {
  const action =
    problem.kind === 'not-found' && onEmail
      ? { label: tx('აღდგენა ელ-ფოსტით', 'Reset by email'), icon: Mail, onPress: onEmail }
      : problem.kind === 'phone-login' && onPhoneLogin
        ? { label: tx('შესვლა SMS კოდით', 'Sign in with an SMS code'), icon: Smartphone, onPress: onPhoneLogin }
        : null;
  return (
    <View
      style={{
        marginTop: 18,
        padding: 16,
        borderRadius: 18,
        backgroundColor: p.surface,
        boxShadow: velvetField(p),
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <CircleAlert size={20} color={p.danger} strokeWidth={2.1} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: p.text }}>
          {problem.message}
        </Text>
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 46,
            borderRadius: 23,
            backgroundColor: p.surface,
            boxShadow: velvetLift(p),
          }}
        >
          <action.icon size={18} color={p.ink} strokeWidth={2.1} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: p.ink }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
