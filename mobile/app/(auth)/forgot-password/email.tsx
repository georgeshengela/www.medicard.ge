import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { Input } from '@/components/ui/Input';
import { EmailTypoHint } from '@/components/auth/EmailTypoHint';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { useThemeColors } from '@/theme/colors';
import { openEmail } from '@/lib/openEmail';
import { tx } from '@/i18n/locale';

export default function ForgotPasswordEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const colors = useThemeColors();

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(ka.auth.invalidEmail);
      return;
    }

    setBusy(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await api.auth.passwordForgot(email.trim().toLowerCase());
      router.push({
        pathname: '/(auth)/forgot-password/sent',
        params: { email: email.trim().toLowerCase(), devCode: result.devCode ?? '' },
      });
    } catch (err) {
      // No account uses this address: say so, and offer the typo fix / sign-up below.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_FOUND') setNotFound(true);
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      footer={<AuthPrimaryButton label={ka.auth.forgotPasswordSend} loading={busy} onPress={submit} />}
    >
      <AuthBackHeader title={ka.auth.forgotPasswordTitle} subtitle={ka.auth.forgotPasswordEmailHint} />

      <Input
        label={ka.auth.email}
        placeholder={ka.auth.emailPlaceholderSignIn}
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        error={error ?? undefined}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
        figma
      />
      <EmailTypoHint
        email={email}
        onApply={(fixed) => {
          setEmail(fixed);
          setError(null);
          setNotFound(false);
        }}
      />
      {notFound ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/sign-up')}
          style={{ marginTop: 4, paddingVertical: 8, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>
            {tx('ახალი ანგარიშის შექმნა', 'Create a new account')}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => void openEmail('support@medicard.ge')}
        style={{ marginTop: 28, alignItems: 'center' }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300, textAlign: 'center' }}>
          {ka.auth.forgotPasswordHelp}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.primary200, marginTop: 4 }}>
          {ka.auth.forgotPasswordHelpContact}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
