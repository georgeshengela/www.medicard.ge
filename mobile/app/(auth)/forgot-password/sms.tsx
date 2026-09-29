import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound, Lock, Smartphone } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { PasswordStrengthHint } from '@/components/auth/PasswordStrengthHint';
import { Input } from '@/components/ui/Input';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { isPasswordStrongEnough, scorePassword } from '@/lib/passwordStrength';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

/**
 * Password reset by SMS: number → 4-digit code + new password → signed in.
 * Works for accounts with a verified phone; phone-only accounts are sent to SMS sign-in.
 */
export default function ForgotPasswordSms() {
  const router = useRouter();
  const colors = useThemeColors();
  const { resetPasswordWithSms } = useAuth();

  const [step, setStep] = useState<'phone' | 'reset'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ phone?: string; code?: string; password?: string; confirmPassword?: string; form?: string }>({});
  const [phoneLogin, setPhoneLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  const normalised = `+995${phone.replace(/\D/g, '').replace(/^995/, '')}`;
  const strength = useMemo(() => scorePassword(password), [password]);

  const sendCode = async () => {
    if (!/^\+9955\d{8}$/.test(normalised)) {
      setErrors({ phone: ka.auth.invalidPhone });
      return;
    }
    setBusy(true);
    setErrors({});
    setPhoneLogin(false);
    try {
      const result = await api.auth.passwordSmsStart(normalised);
      setDevCode(result.devCode ?? null);
      setStep('reset');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PHONE_LOGIN_ACCOUNT') setPhoneLogin(true);
      setErrors({ phone: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const next: typeof errors = {};
    if (!/^\d{4}$/.test(code.trim())) next.code = ka.auth.invalidCodeLength(4);
    if (!isPasswordStrongEnough(password)) next.password = ka.auth.shortPassword;
    if (password !== confirmPassword) next.confirmPassword = ka.auth.passwordMismatch;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await resetPasswordWithSms({ phone: normalised, code: code.trim(), password, confirmPassword });
      router.replace('/(tabs)/home');
    } catch (err) {
      setErrors({ form: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (step === 'phone') {
    return (
      <AuthShell footer={<AuthPrimaryButton label={ka.auth.sendCode} loading={busy} onPress={sendCode} />}>
        <AuthBackHeader title={ka.auth.forgotPasswordTitle} subtitle="ჩაწერე ანგარიშზე მიბმული ნომერი. SMS-ით კოდს გამოგიგზავნით." />
        <Input
          label={ka.auth.phone}
          placeholder={ka.auth.phonePlaceholder}
          icon={Smartphone}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setErrors({});
            setPhoneLogin(false);
          }}
          error={errors.phone}
          hint="+995"
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={14}
          returnKeyType="send"
          onSubmitEditing={() => void sendCode()}
          figma
        />
        {phoneLogin ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(auth)/phone')}
            style={{ marginTop: 8, paddingVertical: 8, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>
              SMS კოდით შესვლა
            </Text>
          </Pressable>
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      footer={<AuthPrimaryButton label={ka.auth.forgotPasswordReset} loading={busy} onPress={reset} />}
    >
      <AuthBackHeader title={ka.auth.forgotPasswordNewPassword} subtitle={`${ka.auth.codeSentTo} ${normalised}`} />
      <View style={{ gap: 16 }}>
        <Input
          label={ka.auth.smsCode}
          placeholder={ka.auth.smsCodePlaceholder}
          icon={KeyRound}
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setErrors((current) => ({ ...current, code: undefined, form: undefined }));
          }}
          error={errors.code}
          hint={devCode ? `სატესტო კოდი: ${devCode}` : undefined}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={4}
          figma
        />
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

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setStep('phone');
          setCode('');
          setErrors({});
        }}
        style={{ marginTop: 20, paddingVertical: 8, alignItems: 'center' }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>{ka.auth.changeNumber}</Text>
      </Pressable>
    </AuthShell>
  );
}
