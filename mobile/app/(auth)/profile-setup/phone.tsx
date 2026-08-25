import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ProfilePhoneField } from '@/components/profile/ProfilePhoneField';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { FIGMA_PROFILE_SETUP } from '@/constants/figmaProfileSetupLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { needsHealthAssessment, needsProfileSetup, useAuth } from '@/store/AuthContext';

/** Profile setup — phone entry (Figma 8845:310502). */
export default function ProfileSetupPhoneScreen() {
  const router = useRouter();
  const { user, ready, healthProfile } = useAuth();
  const [local, setLocal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = useMemo(() => {
    const digits = local.replace(/\D/g, '').replace(/^995/, '').slice(0, 9);
    return digits.length === 9 ? `+995${digits}` : null;
  }, [local]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (needsHealthAssessment(healthProfile)) return <Redirect href="/(auth)/assessment" />;
  if (!needsProfileSetup(healthProfile)) return <Redirect href="/(tabs)/home" />;

  const continuePhone = async () => {
    if (!normalised || !/^\+9955\d{8}$/.test(normalised)) {
      setError(ka.auth.invalidPhone);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.auth.phoneLinkStart(normalised);
      router.push({ pathname: '/(auth)/profile-setup/verify', params: { phone: normalised } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileSetupShell
      title={ka.profileSetup.phoneTitle}
      body={ka.profileSetup.phoneBody}
      primaryLabel={ka.assessment.continue}
      canBack
      onBack={() => router.back()}
      loading={busy}
      primaryDisabled={!normalised}
      onPrimary={() => void continuePhone()}
      showStepper={false}
      footerSlot={
        <ProfilePhoneField value={local} onChange={setLocal} error={error} />
      }
    >
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Image
          source={require('../../../assets/figma/profile-setup/phone-otp-illustration.png')}
          style={{
            width: FIGMA_PROFILE_SETUP.phoneIllustrationSize * 0.72,
            height: FIGMA_PROFILE_SETUP.phoneIllustrationSize * 0.72,
          }}
          resizeMode="contain"
        />
      </View>
    </ProfileSetupShell>
  );
}
