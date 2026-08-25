import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { PasswordStrengthHint } from '@/components/auth/PasswordStrengthHint';
import { Input } from '@/components/ui/Input';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { isPasswordStrongEnough, scorePassword } from '@/lib/passwordStrength';

export default function ForgotPasswordReset() {
  const router = useRouter();
  const { email, code } = useLocalSearchParams<{ email: string; code: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const canSubmit =
    isPasswordStrongEnough(password) && password === confirmPassword && confirmPassword.length >= 8;

  const submit = async () => {
    const next: typeof errors = {};
    if (!isPasswordStrongEnough(password)) next.password = ka.auth.shortPassword;
    if (password !== confirmPassword) next.confirmPassword = ka.auth.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length > 0 || !email || !code) return;

    setBusy(true);
    try {
      await api.auth.passwordReset({ email, code, password, confirmPassword });
      Alert.alert(ka.auth.forgotPasswordResetSuccess, '', [
        { text: ka.auth.signIn, onPress: () => router.replace('/(auth)/sign-in') },
      ]);
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : ka.common.error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthBackHeader title={ka.auth.forgotPasswordNewPassword} subtitle={ka.auth.forgotPasswordReset} />

      <View style={{ gap: 16 }}>
        <View>
          <Input
            label={ka.auth.forgotPasswordNewPassword}
            placeholder={ka.auth.passwordPlaceholder}
            icon={Lock}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            figma
          />
          <PasswordStrengthHint level={strength.level} />
        </View>

        <Input
          label={ka.auth.confirmPassword}
          placeholder={ka.auth.confirmPasswordPlaceholder}
          icon={Lock}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          figma
        />
      </View>

      {errors.form ? (
        <View style={{ marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEE2E2', padding: 14 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: '#B91C1C' }}>{errors.form}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 24 }}>
        <AuthPrimaryButton
          label={ka.auth.forgotPasswordReset}
          loading={busy}
          disabled={!canSubmit}
          onPress={submit}
        />
      </View>
    </AuthShell>
  );
}
