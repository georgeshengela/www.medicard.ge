import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { needsHealthAssessment, needsProfileSetup, useAuth } from '@/store/AuthContext';

export default function ProfileSetupIntroScreen() {
  const router = useRouter();
  const { user, ready, healthProfile } = useAuth();
  const [busy, setBusy] = useState(false);

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

  return (
    <ProfileSetupShell
      title={ka.profileSetup.introTitle}
      body={ka.profileSetup.introBody}
      primaryLabel={ka.assessment.continue}
      showLogo
      centerContent
      loading={busy}
      onPrimary={() => {
        setBusy(true);
        router.push('/(auth)/profile-setup/avatar');
        setBusy(false);
      }}
    />
  );
}
