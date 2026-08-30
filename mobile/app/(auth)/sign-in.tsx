import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { SignInSwitchLink } from '@/components/auth/AuthSwitchLink';
import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AuthErrorBanner } from '@/components/auth/AuthErrorBanner';
import { Input } from '@/components/ui/Input';
import { FIGMA_AUTH, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const auth = useFigmaAuth();
  const colors = useThemeColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = ka.auth.invalidEmail;
    if (password.length < 1) next.password = ka.common.required;

    setErrors(next);
    setBannerError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : ka.common.error;
      setBannerError(message.includes('არასწორი') ? ka.auth.loginError : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AuthShell hero heroSubtitle={ka.auth.signInHero}>
        <View style={{ gap: FIGMA_AUTH.sectionGap, paddingTop: 32 }}>
          <View style={{ gap: 16 }}>
            <View style={{ gap: FIGMA_AUTH.formFieldGap }}>
              <Input
                label={ka.auth.email}
                placeholder={ka.auth.emailPlaceholderSignIn}
                icon={Mail}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setBannerError(null);
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
                  setBannerError(null);
                }}
                error={errors.password}
                secure
                autoCapitalize="none"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={submit}
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

          <View style={{ gap: FIGMA_AUTH.actionsGap }}>
            <AuthPrimaryButton label={ka.auth.signIn} loading={busy} onPress={submit} />
          </View>

          <SignInSwitchLink />

          <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/phone')} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: auth.linkColor,
              }}
            >
              {ka.auth.continueWithPhone}
            </Text>
          </Pressable>
        </View>
      </AuthShell>

      {bannerError ? <AuthErrorBanner message={bannerError} onDismiss={() => setBannerError(null)} /> : null}
    </View>
  );
}
