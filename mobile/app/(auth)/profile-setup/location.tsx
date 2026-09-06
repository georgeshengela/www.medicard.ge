import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info, MapPin } from 'lucide-react-native';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';
import { ka } from '@/i18n/ka';
import { applyLocationToProfile, grantUserLocation, skipUserLocation } from '@/lib/userLocation';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';

/** Location permission — after notifications, before analyzing. */
export default function ProfileSetupLocationScreen() {
  const FIGMA = useFigmaProfileSetup();
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

  const goAnalyzing = () => router.replace(onboardingStepHref('/(auth)/profile-setup/analyzing', preview) as never);

  const enable = async () => {
    setBusy(true);
    try {
      const result = await grantUserLocation();
      setHealthProfile(result.profile ?? applyLocationToProfile(healthProfile, result.snapshot));
    } finally {
      setBusy(false);
      goAnalyzing();
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      const snapshot = await skipUserLocation();
      setHealthProfile(applyLocationToProfile(healthProfile, snapshot));
    } finally {
      setBusy(false);
      goAnalyzing();
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Info size={20} color="#6B7280" />
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: FIGMA.bodyColor }}>
              {ka.profileSetup.locationHint}
            </Text>
          </View>
          <ProfileSetupPrimaryButton
            label={ka.profileSetup.locationEnable}
            onPress={() => void enable()}
            loading={busy}
            icon="check"
          />
          <ProfileSetupLinkButton label={ka.profileSetup.locationSkip} onPress={() => void skip()} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 16, alignItems: 'center', gap: 24 }}>
        <Text
          style={{
            textAlign: 'center',
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 30,
            lineHeight: 38,
            color: FIGMA.titleColor,
          }}
        >
          {ka.profileSetup.locationTitle}
          <Text style={{ color: FIGMA.brand }}>{ka.profileSetup.locationTitleAccent}</Text>
          {ka.profileSetup.locationTitleEnd}
        </Text>

        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 148,
              height: 148,
              borderRadius: 74,
              backgroundColor: `${FIGMA.brand}14`,
              borderWidth: 1,
              borderColor: `${FIGMA.brand}33`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: `${FIGMA.brand}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MapPin size={52} color={FIGMA.brand} strokeWidth={1.6} />
            </View>
          </View>
        </View>

        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 16,
            lineHeight: 26,
            color: FIGMA.bodyColor,
            textAlign: 'center',
          }}
        >
          {ka.profileSetup.locationBody}
        </Text>
      </View>
    </ProfileSetupShell>
  );
}
