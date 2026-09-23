import React, { useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { SignInSwitchLink } from '@/components/auth/AuthSwitchLink';
import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { Input } from '@/components/ui/Input';
import { FIGMA_AUTH, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { AUTH_KEYBOARD_OPEN_PX } from '@/lib/authChrome';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { useKeyboardMetrics } from '@/lib/useKeyboardHeight';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

function cleanEmail(value: string) {
  return value.replace(/\u00a0/g, ' ').trim().toLowerCase();
}

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const auth = useFigmaAuth();
  const colors = useThemeColors();
  const { height: keyboardHeight } = useKeyboardMetrics();
  const keyboardOpen = keyboardHeight > AUTH_KEYBOARD_OPEN_PX;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const submittingRef = React.useRef(false);

  const submit = async () => {
    if (busy || submittingRef.current) return;
    Keyboard.dismiss();
    const next: typeof errors = {};
    const emailValue = cleanEmail(email);
    // Registration preserves these characters; changing them here rejects valid passwords.
    const passwordValue = password;
    if (!/^\S+@\S+\.\S+$/.test(emailValue)) next.email = ka.auth.invalidEmail;
    if (passwordValue.length < 1) next.password = ka.common.required;

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    submittingRef.current = true;
    setBusy(true);
    try {
      await signIn(emailValue, passwordValue);
      // AuthGate owns the destination (onboarding, saved Home, or a pending share).
    } catch (error) {
      setErrors({ form: authErrorMessage(error) });
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AuthShell
        hero
        heroSubtitle={ka.auth.signInHero}
        footer={<AuthPrimaryButton label={ka.auth.signIn} loading={busy} onPress={() => void submit()} />}
      >
        <View style={{ gap: keyboardOpen ? 16 : FIGMA_AUTH.sectionGap, paddingTop: keyboardOpen ? 8 : 32 }}>
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
                onSubmitEditing={() => void submit()}
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

          {errors.form ? (
            <View
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

          {keyboardOpen ? null : <SignInSwitchLink />}
        </View>
      </AuthShell>
    </View>
  );
}
