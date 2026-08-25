import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { CircleCheckBig } from 'lucide-react-native';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { useOnboardingDevPreview, onboardingNeedsPhoneVerified, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';

/** OTP verified — brief success before Face ID (Figma flow). */
export default function ProfileSetupSuccessScreen() {
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile } = useAuth();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  const blocked = onboardingScreenBlocked(preview, user, healthProfile);
  if (blocked === 'assessment') return <Redirect href="/(auth)/assessment" />;
  if (blocked === 'home') return <Redirect href="/(tabs)/home" />;
  if (onboardingNeedsPhoneVerified(preview, healthProfile)) return <Redirect href="/(auth)/profile-setup/verify" />;

  return (
    <ProfileSetupShell
      title={ka.profileSetup.successTitle}
      body={ka.profileSetup.successBody}
      primaryLabel={ka.profileSetup.successContinue}
      onPrimary={() => router.replace(onboardingStepHref('/(auth)/profile-setup/face-id', preview) as never)}
      showStepper={false}
      centerContent
    >
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: '#ECFDF5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircleCheckBig size={48} color="#14B8A6" strokeWidth={2} />
        </View>
        <Text
          style={{
            marginTop: 24,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 16,
            lineHeight: 26,
            color: '#4B5563',
            textAlign: 'center',
            paddingHorizontal: 16,
          }}
        >
          {ka.profileSetup.successBody}
        </Text>
      </View>
    </ProfileSetupShell>
  );
}
