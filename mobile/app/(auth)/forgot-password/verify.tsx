import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';

export default function ForgotPasswordVerify() {
  const router = useRouter();
  const { email, devCode } = useLocalSearchParams<{ email: string; devCode?: string }>();
  const [code, setCode] = useState(devCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const submit = () => {
    if (!/^\d{6}$/.test(code)) {
      setError(ka.auth.invalidCodeLength(6));
      return;
    }

    router.push({
      pathname: '/(auth)/forgot-password/reset',
      params: { email: email ?? '', code },
    });
  };

  const resend = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    try {
      const result = await api.auth.passwordForgot(email);
      if (result.devCode) setCode(result.devCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <AuthBackHeader
        title={ka.auth.forgotPasswordEnterCode}
        subtitle={email ? ka.auth.forgotPasswordCodeHint(email) : undefined}
      />

      <View style={{ marginTop: 8, marginBottom: 28 }}>
        <OtpCodeInput value={code} onChange={(next) => { setCode(next); setError(null); }} error={error} length={6} />
      </View>

      <AuthPrimaryButton
        label={ka.auth.forgotPasswordContinue}
        disabled={code.length !== 6}
        onPress={submit}
      />

      <Pressable accessibilityRole="button" onPress={() => void resend()} disabled={resending} style={{ marginTop: 20, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#14B8A6' }}>
          {ka.auth.forgotPasswordResend}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
