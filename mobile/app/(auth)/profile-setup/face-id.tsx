import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { ScanFace } from 'lucide-react-native';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { patchProfileExtra, setBiometricEnabled } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';

/** Face ID setup — Figma 8845:312237 */
export default function ProfileSetupFaceIdScreen() {
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user || !healthProfile) return <Redirect href="/(auth)/sign-in" />;
  const blocked = onboardingScreenBlocked(preview, user, healthProfile);
  if (blocked === 'assessment') return <Redirect href="/(auth)/assessment" />;
  if (blocked === 'home') return <Redirect href="/(tabs)/home" />;

  const goNext = () => router.replace(onboardingStepHref('/(auth)/profile-setup/privacy', preview) as never);

  const enable = async () => {
    setBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && enrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: ka.profileSetup.faceIdEnable,
          cancelLabel: ka.common.cancel,
        });
        if (result.success) {
          await setBiometricEnabled(true);
          const updated = await patchProfileExtra(healthProfile, user, { biometricEnabled: true });
          setHealthProfile(updated);
        }
      }
    } finally {
      setBusy(false);
      goNext();
    }
  };

  return (
    <ProfileSetupShell
      title=""
      primaryLabel=""
      onPrimary={() => {}}
      showStepper={false}
      hidePrimary
      footerSlot={
        <View style={{ gap: 24, width: '100%' }}>
          <ProfileSetupPrimaryButton
            label={ka.profileSetup.faceIdEnable}
            onPress={() => void enable()}
            loading={busy}
            icon="check"
          />
          <ProfileSetupLinkButton label={ka.profileSetup.faceIdSkip} onPress={goNext} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 16, alignItems: 'center', gap: 24 }}>
        <Text style={{ textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, color: '#1F2937' }}>
          {ka.profileSetup.faceIdTitle}
          <Text style={{ color: '#14B8A6' }}>{ka.profileSetup.faceIdTitleAccent}</Text>
          {ka.profileSetup.faceIdTitleEnd}
        </Text>
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <ScanFace size={160} color="#D1D5DB" strokeWidth={1.2} />
        </View>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 16,
            lineHeight: 26,
            color: '#4B5563',
            textAlign: 'center',
          }}
        >
          {ka.profileSetup.faceIdBody}
        </Text>
      </View>
    </ProfileSetupShell>
  );
}
