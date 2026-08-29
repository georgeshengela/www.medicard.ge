import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { markPhoneVerified } from '@/lib/profileSetupFlow';
import { needsHealthAssessment, needsProfileSetup, useAuth } from '@/store/AuthContext';

const RESEND_SEC = 60;

function maskPhoneLast4(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length < 4) return '••••';
  return `••${d.slice(-4)}`;
}

/** Profile setup — 4-digit OTP verify (Figma 8845:310664). */
export default function ProfileSetupVerifyScreen() {
  const FIGMA_PROFILE_SETUP = useFigmaProfileSetup();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const { user, ready, healthProfile, setHealthProfile, setUser } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SEC);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const finishPhoneVerify = useCallback(async () => {
    if (!healthProfile || !user) return;
    const updated = await markPhoneVerified(healthProfile, user);
    setHealthProfile(updated);
    router.replace('/(auth)/profile-setup/success');
  }, [healthProfile, user, setHealthProfile, router]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (!phone || !/^\+9955\d{8}$/.test(phone)) return <Redirect href="/(auth)/profile-setup/phone" />;
  if (needsHealthAssessment(healthProfile)) return <Redirect href="/(auth)/assessment" />;
  if (!needsProfileSetup(healthProfile)) return <Redirect href="/(tabs)/home" />;

  const verify = async () => {
    if (code.length !== 4) {
      setError(ka.auth.invalidCodeLength(4));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const linked = await api.auth.phoneLinkVerify(phone, code.trim());
      setUser(linked.user);
      await finishPhoneVerify();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : ka.common.error;
      setError(msg);
      setToast(msg);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    Keyboard.dismiss();
    setError(null);
    try {
      const res = await api.auth.phoneLinkStart(phone);
      setDevCode(res.devCode ?? null);
      setCooldown(res.cooldownSec ?? RESEND_SEC);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ka.common.error);
    }
  };

  return (
    <ProfileSetupShell
      title={ka.profileSetup.verifyTitle}
      primaryLabel={ka.profileSetup.verifyContinue}
      canBack
      onBack={() => router.back()}
      loading={busy}
      primaryDisabled={code.length !== 4}
      onPrimary={() => void verify()}
      showStepper={false}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16, gap: 24, alignItems: 'center' }}>
        <OtpCodeInput value={code} onChange={setCode} error={error} variant="hero" length={4} />

        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: FIGMA_PROFILE_SETUP.bodySize,
            lineHeight: FIGMA_PROFILE_SETUP.bodyLineHeight,
            color: FIGMA_PROFILE_SETUP.bodyColor,
            textAlign: 'center',
          }}
        >
          {ka.profileSetup.verifyBody(maskPhoneLast4(phone))}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => void resend()}
          disabled={cooldown > 0}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 16,
              lineHeight: 22,
              color: cooldown > 0 ? '#9CA3AF' : FIGMA_PROFILE_SETUP.brand,
            }}
          >
            {cooldown > 0 ? ka.profileSetup.resendIn(cooldown) : ka.profileSetup.resendCode}
          </Text>
        </Pressable>

        {devCode ? (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 13,
              color: '#64748B',
            }}
          >
            Dev: {devCode}
          </Text>
        ) : null}
      </View>

      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 120,
            backgroundColor: '#FEE2E2',
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: '#FECACA',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              color: '#B91C1C',
            }}
          >
            {toast}
          </Text>
        </View>
      ) : null}
    </ProfileSetupShell>
  );
}
