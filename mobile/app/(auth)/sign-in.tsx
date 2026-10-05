import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail, Lock } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { SignInSwitchLink } from '@/components/auth/AuthSwitchLink';
import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { ProfilePhoneField } from '@/components/profile/ProfilePhoneField';
import { Input } from '@/components/ui/Input';
import { FIGMA_AUTH, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { appLang, tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { AUTH_KEYBOARD_OPEN_PX } from '@/lib/authChrome';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { defaultSignInMethod, readLastSignInMethod, rememberSignInMethod, type SignInMethod } from '@/lib/signInMethod';
import { useKeyboardMetrics } from '@/lib/useKeyboardHeight';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';

function cleanEmail(value: string) {
  return value.replace(/ /g, ' ').trim().toLowerCase();
}

function phoneFromDigits(local: string): string | null {
  const digits = local.replace(/\D/g, '').replace(/^995/, '').slice(0, 9);
  return /^5\d{8}$/.test(digits) ? `+995${digits}` : null;
}

/**
 * Sign in — the same choices as the web (/app): Apple / Google, then phone (SMS code) or email +
 * password. Phone sign-in creates an account for a new number, exactly like the web. The method last
 * used on this device opens first (owner 2026-10-05: a person who started on the web with a phone
 * signed up again in the app with an email, because the app offered only email).
 */
export default function SignIn() {
  const { signIn, signInWithPhone } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ method?: string }>();
  const auth = useFigmaAuth();
  const colors = useThemeColors();
  const { height: keyboardHeight } = useKeyboardMetrics();
  const keyboardOpen = keyboardHeight > AUTH_KEYBOARD_OPEN_PX;

  const asked = params.method === 'phone' || params.method === 'email' ? params.method : null;
  const [method, setMethod] = useState<SignInMethod>(asked ?? defaultSignInMethod(appLang()));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const submittingRef = React.useRef(false);

  // Phone: number, then the 4-digit code.
  const [local, setLocal] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [codeKey, setCodeKey] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (asked) return;
    void readLastSignInMethod().then((last) => {
      if (last && !touched.current) setMethod(last);
    });
  }, [asked]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const pick = (next: SignInMethod) => {
    touched.current = true;
    setMethod(next);
    setErrors({});
  };

  const guard = async (work: () => Promise<void>) => {
    if (busy || submittingRef.current) return;
    Keyboard.dismiss();
    submittingRef.current = true;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setErrors({ form: authErrorMessage(error) });
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const submitEmail = async () => {
    if (busy || submittingRef.current) return;
    const next: typeof errors = {};
    const emailValue = cleanEmail(email);
    // Registration preserves these characters; changing them here rejects valid passwords.
    const passwordValue = password;
    if (!/^\S+@\S+\.\S+$/.test(emailValue)) next.email = ka.auth.invalidEmail;
    if (passwordValue.length < 1) next.password = ka.common.required;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      Keyboard.dismiss();
      return;
    }
    await guard(async () => {
      await signIn(emailValue, passwordValue);
      await rememberSignInMethod('email');
      // AuthGate owns the destination (onboarding, saved Home, or a pending share).
    });
  };

  const sendCode = async (to: string | null = phoneFromDigits(local)) => {
    if (!to) {
      setErrors({ form: ka.auth.invalidPhone });
      return;
    }
    setErrors({});
    await guard(async () => {
      const response = await api.auth.phoneStart(to);
      setDevCode(response.devCode ?? null);
      setCooldown(Number(response.cooldownSec) || 60);
      setSentTo(to);
      setCode('');
      setCodeKey((value) => value + 1);
    });
  };

  const verifyCode = async (value = code) => {
    if (!sentTo || value.trim().length !== 4) return;
    setErrors({});
    await guard(async () => {
      try {
        await signInWithPhone(sentTo, value.trim());
        await rememberSignInMethod('phone');
      } catch (error) {
        setCode('');
        setCodeKey((key) => key + 1);
        throw error;
      }
    });
  };

  const primary =
    method === 'email'
      ? { label: ka.auth.signIn, onPress: () => void submitEmail(), disabled: false }
      : sentTo
        ? { label: ka.auth.signIn, onPress: () => void verifyCode(), disabled: code.trim().length !== 4 }
        : { label: tx('კოდის მიღება', 'Get code'), onPress: () => void sendCode(), disabled: !phoneFromDigits(local) };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AuthShell
        hero
        heroSubtitle={ka.auth.signInHero}
        footer={
          <View style={{ gap: 12 }}>
            <AuthPrimaryButton label={primary.label} loading={busy} disabled={primary.disabled} onPress={primary.onPress} />
            {keyboardOpen ? null : <SignInSwitchLink />}
          </View>
        }
      >
        <View style={{ gap: keyboardOpen ? 16 : 24, paddingTop: keyboardOpen ? 8 : 0 }}>
          {keyboardOpen || sentTo ? null : <SocialAuthButtons dividerLabel={tx('ან', 'or')} />}
          {sentTo ? null : <MethodSwitch value={method} onChange={pick} />}

          {method === 'phone' ? (
            sentTo ? (
              <View style={{ gap: 14 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: colors.text200 }}>
                  {tx(
                    `4-ნიშნა კოდი გავაგზავნეთ ნომერზე ${sentTo.replace(/(\+995)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}.`,
                    `We sent a 4-digit code to ${sentTo.replace(/(\+995)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}.`,
                  )}
                </Text>
                <View style={{ alignItems: 'center' }}>
                  <OtpCodeInput
                    value={code}
                    onChange={(next) => {
                      setCode(next);
                      setErrors({});
                      if (next.trim().length === 4) void verifyCode(next);
                    }}
                    length={4}
                    variant="hero"
                    resetKey={codeKey}
                  />
                </View>
                {devCode ? (
                  <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text300 }}>
                    {tx(`სატესტო კოდი: ${devCode}`, `Test code: ${devCode}`)}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <TextLink
                    label={ka.auth.changeNumber}
                    onPress={() => {
                      setSentTo(null);
                      setCode('');
                      setErrors({});
                    }}
                  />
                  <TextLink
                    label={cooldown > 0 ? tx(`ხელახლა ${cooldown} წმ-ში`, `Resend in ${cooldown} s`) : tx('ხელახლა გაგზავნა', 'Resend code')}
                    disabled={cooldown > 0 || busy}
                    onPress={() => void sendCode(sentTo)}
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <ProfilePhoneField value={local} onChange={(next) => { setLocal(next); setErrors({}); }} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 19, color: colors.text300 }}>
                  {tx(
                    'SMS-ით მიიღებ 4-ნიშნა კოდს. ახალ ნომერზე ანგარიში ავტომატურად შეიქმნება.',
                    'You will get a 4-digit code by SMS. A new number gets an account automatically.',
                  )}
                </Text>
              </View>
            )
          ) : (
            <View style={{ gap: 16 }}>
              <View style={{ gap: FIGMA_AUTH.formFieldGap }}>
                <Input
                  label={ka.auth.email}
                  placeholder={ka.auth.emailPlaceholderSignIn}
                  icon={Mail}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setErrors((prev) => ({ ...prev, email: undefined, form: undefined }));
                  }}
                  error={errors.email}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                  figma
                />

                <Input
                  label={ka.auth.password}
                  placeholder={ka.auth.passwordPlaceholderSignIn}
                  icon={Lock}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setErrors((prev) => ({ ...prev, password: undefined, form: undefined }));
                  }}
                  error={errors.password}
                  secure
                  autoCapitalize="none"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={() => void submitEmail()}
                  figma
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <AuthCheckbox label={ka.auth.keepSignedIn} checked={keepSignedIn} onToggle={() => setKeepSignedIn((v) => !v)} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push('/(auth)/forgot-password')}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      lineHeight: 20,
                      color: auth.linkColor,
                    }}
                  >
                    {ka.auth.forgotPassword}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {errors.form ? (
            <View
              accessibilityLiveRegion="polite"
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.danger,
                backgroundColor: colors.dangerBg,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.danger }}>
                {errors.form}
              </Text>
            </View>
          ) : null}
        </View>
      </AuthShell>
    </View>
  );
}

/** Phone | Email — two equal pills, the same switch as the web sign-in. */
function MethodSwitch({ value, onChange }: { value: SignInMethod; onChange: (next: SignInMethod) => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const options: { id: SignInMethod; label: string }[] = [
    { id: 'phone', label: tx('ტელეფონი', 'Phone') },
    { id: 'email', label: tx('ელ-ფოსტა', 'Email') },
  ];
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: dark ? colors.bg200 : '#EEF2F2' }}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.id)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.surface : 'transparent',
            }}
          >
            <Text style={{ fontFamily: active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: active ? colors.text100 : colors.text200 }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TextLink({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const auth = useFigmaAuth();
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" hitSlop={8} disabled={disabled} onPress={onPress}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: disabled ? colors.text300 : auth.linkColor }}>
        {label}
      </Text>
    </Pressable>
  );
}
