import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { registerPushTokenWithServer } from '@/lib/notifications';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';

/** Enable notifications — Figma 8845:312878 */
export default function ProfileSetupNotificationsScreen() {
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

  const continueFlow = async (granted: boolean) => {
    setBusy(true);
    try {
      if (granted) await registerPushTokenWithServer();
      const updated = await patchProfileExtra(healthProfile, user, {
        notificationsEnabled: granted,
      });
      setHealthProfile(updated);
      goAnalyzing();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileSetupShell
      title={ka.profileSetup.notificationsTitle}
      body={ka.profileSetup.notificationsBody}
      primaryLabel=""
      onPrimary={() => {}}
      showStepper={false}
      hidePrimary
      footerSlot={
        <View style={{ gap: 24, width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Info size={20} color="#6B7280" />
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: '#4B5563' }}>
              {ka.profileSetup.notificationsHint}
            </Text>
          </View>
          <ProfileSetupPrimaryButton
            label={ka.profileSetup.notificationsContinue}
            onPress={() => void continueFlow(true)}
            loading={busy}
            icon="arrow"
          />
          <ProfileSetupLinkButton label={ka.profileSetup.notificationsSkip} onPress={() => void continueFlow(false)} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View
          style={{
            height: 240,
            borderBottomWidth: 1,
            borderBottomColor: '#D1D5DB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              padding: 16,
              flexDirection: 'row',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 4,
            }}
          >
            <MedicardLogoMark size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#1F2937' }}>
                {ka.profileSetup.notificationsPreviewTitle}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#4B5563' }}>
                {ka.profileSetup.notificationsPreviewBody}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#14B8A6', marginTop: 4 }}>
                {ka.profileSetup.notificationsPreviewAction}
              </Text>
            </View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 10, color: '#6B7280' }}>30წთ</Text>
          </View>
        </View>
      </View>
    </ProfileSetupShell>
  );
}
