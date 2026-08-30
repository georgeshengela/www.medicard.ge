import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { Input } from '@/components/ui/Input';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

export default function ForgotPasswordEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const colors = useThemeColors();

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(ka.auth.invalidEmail);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.passwordForgot(email.trim().toLowerCase());
      router.push({
        pathname: '/(auth)/forgot-password/sent',
        params: { email: email.trim().toLowerCase(), devCode: result.devCode ?? '' },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
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

      <View style={{ marginTop: 24 }}>
        <AuthPrimaryButton label={ka.auth.forgotPasswordSend} loading={busy} onPress={submit} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL('mailto:support@medicard.ge')}
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
