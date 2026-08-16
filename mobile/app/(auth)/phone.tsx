import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, KeyRound, Smartphone } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

/**
 * Georgian phone sign-in. The backend currently returns a fixed development code —
 * once an SMS gateway is wired up this screen needs no changes.
 */
export default function PhoneAuth() {
  const { signInWithPhone } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalised = `+995${phone.replace(/\D/g, '').replace(/^995/, '')}`;

  const sendCode = async () => {
    if (!/^\+9955\d{8}$/.test(normalised)) {
      setError(ka.auth.invalidPhone);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await api.auth.phoneStart(normalised);
      setDevCode(response.devCode ?? null);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length !== 6) {
      setError(ka.auth.invalidCode);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signInWithPhone(normalised, code.trim());
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={ka.auth.continueWithPhone}
      subtitle={step === 'phone' ? ka.auth.signInSubtitle : `${ka.auth.codeSentTo} ${normalised}`}
      footer={
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          className="flex-row items-center justify-center"
          onPress={() => (step === 'code' ? setStep('phone') : router.back())}
        >
          <ArrowLeft size={16} color={colors.primary200} strokeWidth={2.2} />
          <Text className="ml-1.5 text-base font-bold text-primary-200">
            {step === 'code' ? ka.auth.changeNumber : ka.auth.continueWithEmail}
          </Text>
        </Pressable>
      }
    >
      {step === 'phone' ? (
        <>
          <Input
            label={ka.auth.phone}
            placeholder={ka.auth.phonePlaceholder}
            icon={Smartphone}
            value={phone}
            onChangeText={setPhone}
            error={error}
            hint="+995"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={14}
          />
          <View className="mt-6">
            <Button label={ka.auth.sendCode} size="lg" loading={busy} onPress={sendCode} />
          </View>
        </>
      ) : (
        <>
          <Input
            label={ka.auth.smsCode}
            placeholder={ka.auth.smsCodePlaceholder}
            icon={KeyRound}
            value={code}
            onChangeText={setCode}
            error={error}
            hint={devCode ? `სატესტო კოდი: ${devCode}` : undefined}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            maxLength={6}
          />
          <View className="mt-6">
            <Button label={ka.auth.verifyCode} size="lg" loading={busy} onPress={verify} />
          </View>
        </>
      )}
    </AuthShell>
  );
}
