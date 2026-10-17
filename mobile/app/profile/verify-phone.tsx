import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, CircleAlert, MessageSquareText, ShieldCheck } from 'lucide-react-native';
import { AccountConflictSheet } from '@/components/auth/AccountConflictSheet';
import { AuthPhoneField } from '@/components/auth/AuthPhoneField';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useResendCountdown } from '@/hooks/useResendCountdown';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError, accountConflictOf, api, type AccountConflict } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { localAccountId } from '@/lib/localAccount';
import { displayGeorgianMobile, isGeorgianMobile, toE164Georgian } from '@/lib/phoneFormat';
import { useAuth } from '@/store/AuthContext';
import { useVelvet, velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

const RESEND_SECONDS = 60;
const STEPS = ['phone', 'code'] as const;
type Step = (typeof STEPS)[number];

/**
 * Confirm a phone number when a feature needs it (influencer codes, the women's space, rewards, bookings,
 * a trainer profile) or from Profile → „შესვლის გზები“. Owner 2026-10-17: the old two-shell page and the native
 * alert in front of it looked terrible — now it is the SMS sign-in pattern in velvet: why it is asked (the
 * caller's reason, `?reason=`), the number, then the 4-digit code (checked as soon as it is complete, resend on
 * a timer), then straight back to where the person was. A number that is on another of the person's accounts
 * opens the account-conflict sheet (bring it here / switch) instead of a dead end.
 */
export default function VerifyPhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette: p } = useVelvet();
  const reduceMotion = usePrefersReducedMotion();
  const { user, setUser } = useAuth();
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason = typeof params.reason === 'string' && params.reason.trim() ? params.reason.trim() : ka.phoneVerify.gateBody;

  const [step, setStep] = useState<Step>('phone');
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [codeKey, setCodeKey] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<AccountConflict | null>(null);
  const [resendIn, startResend] = useResendCountdown();
  const lock = useRef(false);
  const owner = useRef(localAccountId());

  const phoneValid = isGeorgianMobile(local);
  const pretty = displayGeorgianMobile(local);
  const leave = () => (router.canGoBack() ? router.back() : router.dismissTo('/profile' as never));

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

  const failure = (e: unknown) => {
    const found = accountConflictOf(e);
    if (found) {
      setConflict(found);
      return null;
    }
    const taken = e instanceof ApiError && (e.code === 'PHONE_TAKEN' || e.status === 409);
    return taken ? ka.auth.phoneTakenBody : authErrorMessage(e);
  };

  const sendCode = (again = false) =>
    guarded(async () => {
      setProblem(null);
      try {
        const result = await api.auth.phoneLinkStart(toE164Georgian(local));
        setDevCode(result.devCode ?? null);
        startResend(result.cooldownSec && result.cooldownSec > 0 ? result.cooldownSec : RESEND_SECONDS);
        if (!again) {
          setCode('');
          setCodeError(null);
          setStep('code');
        }
      } catch (e) {
        const message = failure(e);
        if (!message) return;
        if (again) setCodeError(message);
        else setProblem(message);
      }
    });

  const confirm = (value = code) =>
    guarded(async () => {
      if (value.length !== 4) return;
      setCodeError(null);
      try {
        const linked = await api.auth.phoneLinkVerify(toE164Georgian(local), value);
        if (owner.current !== localAccountId()) return; // account switched while waiting
        setUser(linked.user);
        leave();
      } catch (e) {
        const message = failure(e);
        if (!message) return;
        setCode('');
        setCodeKey((k) => k + 1);
        setCodeError(message);
      }
    });

  const onCode = (next: string) => {
    setCode(next);
    setCodeError(null);
    if (next.length === 4) void confirm(next);
  };

  if (!user) return null;

  const enter = reduceMotion ? undefined : FadeInDown.duration(260);
  const stepIndex = STEPS.indexOf(step);
  const back = () => {
    if (step === 'code') {
      setStep('phone');
      setCodeError(null);
    } else leave();
  };

  const header = (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('უკან', 'Back')}
        onPress={back}
        hitSlop={10}
        style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: p.raised, boxShadow: velvetLift(p) }}
      >
        <ChevronLeft size={22} color={p.ink} strokeWidth={2.2} />
      </Pressable>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={tx(`ნაბიჯი ${stepIndex + 1} / ${STEPS.length}`, `Step ${stepIndex + 1} / ${STEPS.length}`)}
        style={{ flex: 1, flexDirection: 'row', gap: 8 }}
      >
        {STEPS.map((key, index) => (
          <View key={key} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: p.surface, boxShadow: velvetField(p), overflow: 'hidden' }}>
            {index <= stepIndex ? <View style={{ flex: 1, borderRadius: 3, backgroundColor: p.pulse }} /> : null}
          </View>
        ))}
      </View>
    </View>
  );

  const footer = (
    <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
      {step === 'phone' ? (
        <VelvetButton palette={p} label={ka.phoneVerify.sendCta} busy={busy} disabled={!phoneValid} onPress={() => void sendCode()} />
      ) : (
        <VelvetButton palette={p} label={ka.phoneVerify.confirmCta} busy={busy} disabled={code.length !== 4} onPress={() => void confirm()} />
      )}
    </View>
  );

  return (
    <KeyboardFormShell background={p.surface} header={header} footer={footer} contentStyle={{ paddingHorizontal: 20, paddingTop: 14, gap: 22 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, lineHeight: 37, color: p.text }}>
          {step === 'phone' ? tx('დაადასტურე ნომერი', 'Confirm your number') : tx('შეიყვანე კოდი', 'Enter the code')}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 23, color: p.ink2 }}>
          {step === 'phone'
            ? tx('საჭიროა მხოლოდ ერთხელ — 4-ციფრიან კოდს SMS-ით გამოგიგზავნით.', 'Only needed once — we’ll text you a 4-digit code.')
            : tx('SMS-ით მოსული 4 ციფრი ჩაწერე — შეყვანისთანავე შევამოწმებთ.', 'Type the 4 digits from the SMS — we check them right away.')}
        </Text>
      </View>

      {step === 'phone' ? (
        <Animated.View key="phone" entering={enter} style={{ gap: 22 }}>
          <WhyCard palette={p} reason={reason} />
          <AuthPhoneField
            palette={p}
            label={ka.auth.phone}
            value={local}
            onChange={(next) => {
              setLocal(next);
              setProblem(null);
            }}
            error={!problem && local.length === 9 && !phoneValid ? ka.auth.invalidPhone : null}
            hint={problem ? undefined : tx('მხოლოდ საქართველოს მობილური ნომერი', 'Georgian mobile numbers only')}
            returnKeyType="send"
            onSubmitEditing={() => phoneValid && void sendCode()}
          />
          {problem ? <ProblemCard palette={p} message={problem} /> : null}
        </Animated.View>
      ) : (
        <Animated.View key="code" entering={enter}>
          <SentToCard palette={p} pretty={pretty} onChange={back} />
          <View style={{ marginTop: 28, alignItems: 'center' }}>
            <OtpCodeInput key={codeKey} value={code} onChange={onCode} error={codeError} length={4} resetKey={codeKey} palette={p} autoFocus />
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
      )}

      <AccountConflictSheet
        conflict={conflict}
        onClose={() => setConflict(null)}
        onDone={(outcome) => {
          setConflict(null);
          if (outcome.action === 'switch') router.replace('/(tabs)/home' as never);
          else leave();
        }}
      />
    </KeyboardFormShell>
  );
}

/** Why the number is asked, in the caller's words — the page's one raised card. */
function WhyCard({ reason, palette: p }: { reason: string; palette: VelvetPalette }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: 22, backgroundColor: p.raised, boxShadow: velvetLift(p) }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: p.field, boxShadow: velvetField(p) }}>
        <ShieldCheck size={20} color={p.pulse} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: p.text }}>{tx('რატომ ვითხოვთ', 'Why we ask')}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: p.ink2 }}>{reason}</Text>
      </View>
    </View>
  );
}

/** "We sent it to +995 555 12 34 56 · change" */
function SentToCard({ pretty, onChange, palette: p }: { pretty: string; onChange: () => void; palette: VelvetPalette }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: p.raised, boxShadow: velvetLift(p) }}>
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

function ProblemCard({ message, palette: p }: { message: string; palette: VelvetPalette }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, padding: 16, borderRadius: 18, backgroundColor: p.surface, boxShadow: velvetField(p) }}>
      <CircleAlert size={20} color={p.danger} strokeWidth={2.1} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: p.text }}>{message}</Text>
    </View>
  );
}
