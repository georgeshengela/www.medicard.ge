import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetInput } from '@/components/velvet/VelvetInput';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { VelvetStrength } from '@/components/velvet/VelvetStrength';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { isPasswordStrongEnough, scorePassword } from '@/lib/passwordStrength';
import { useVelvet } from '@/theme/velvet';

export default function ForgotPasswordReset() {
  const router = useRouter();
  const { email, code } = useLocalSearchParams<{ email: string; code: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const { palette: p } = useVelvet();

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
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      backgroundColor={p.surface}
      footer={<VelvetButton palette={p} label={ka.auth.forgotPasswordReset} busy={busy} disabled={!canSubmit} onPress={() => void submit()} />}
    >
      <AuthBackHeader palette={p} title={ka.auth.forgotPasswordNewPassword} subtitle={ka.auth.forgotPasswordReset} />

      <View style={{ gap: 18 }}>
        <View>
          <VelvetInput
            palette={p}
            label={ka.auth.forgotPasswordNewPassword}
            placeholder={ka.auth.passwordPlaceholder}
            icon={Lock}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <VelvetStrength level={strength.level} palette={p} />
        </View>

        <VelvetInput
          palette={p}
          label={ka.auth.confirmPassword}
          placeholder={ka.auth.confirmPasswordPlaceholder}
          icon={Lock}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
        />
      </View>

      {errors.form ? (
        <View style={{ marginTop: 18 }}>
          <VelvetNotice palette={p} text={errors.form} />
        </View>
      ) : null}
    </AuthShell>
  );
}
