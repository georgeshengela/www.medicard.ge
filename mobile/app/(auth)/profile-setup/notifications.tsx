import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { ProfileSetupPrimaryButton } from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { requestNotificationPermission, registerPushTokenWithServer, setPushOptedIn } from '@/lib/notifications';
import { markPrimerAsked, primerCopy } from '@/lib/permissionPrimer';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';

/** Enable notifications — Figma 8845:312878 */
export default function ProfileSetupNotificationsScreen() {
  const FIGMA_PROFILE_SETUP = useFigmaProfileSetup();
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const layoutsOn = isFeatureOn('homeLayouts', useFeatureState());

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

  // Step 8: the Home layout — skipped while the admin switch „homeLayouts“ is off.
  const goLocation = () =>
    router.replace(onboardingStepHref(layoutsOn || preview ? '/(auth)/profile-setup/home-layout' : '/(auth)/profile-setup/analyzing', preview) as never);

  // App Review 5.1.1(iv): one "Continue" button that always opens the OS sheet; the
  // person answers there. No skip before the request.
  const continueFlow = () => {
    if (busy) return;
    setBusy(true);
    void (async () => {
      try {
        const osGranted = await requestNotificationPermission().catch(() => false);
        await markPrimerAsked('notifications');
        if (osGranted) {
          await setPushOptedIn(true);
          await registerPushTokenWithServer({ skipPermissionProbe: true }).catch(() => undefined);
        }
        const updated = await patchProfileExtra(healthProfile, user, {
          notificationsEnabled: osGranted,
        });
        setHealthProfile(updated);
        goLocation();
      } finally {
        setBusy(false);
      }
    })();
  };

  const copy = primerCopy('notifications');

  return (
    <ProfileSetupShell
      title={copy.title}
      body={copy.body}
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
            label={copy.cta}
            onPress={continueFlow}
            loading={busy}
            icon="arrow"
          />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View
          style={{
            height: 240,
            borderBottomWidth: 1,
            borderBottomColor: FIGMA_PROFILE_SETUP.inputBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: FIGMA_PROFILE_SETUP.cardBg,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: FIGMA_PROFILE_SETUP.inputBorder,
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
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: FIGMA_PROFILE_SETUP.titleColor }}>
                {ka.profileSetup.notificationsPreviewTitle}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: FIGMA_PROFILE_SETUP.bodyColor }}>
                {ka.profileSetup.notificationsPreviewBody}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#14B8A6', marginTop: 4 }}>
                {ka.profileSetup.notificationsPreviewAction}
              </Text>
            </View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 10, color: '#6B7280' }}>{tx('30წთ', '30 min')}</Text>
          </View>
        </View>
      </View>
    </ProfileSetupShell>
  );
}
