import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { requestNotificationPermission, registerPushTokenWithServer, setPushOptedIn } from '@/lib/notifications';
import { markPrimerAsked, primerCopy } from '@/lib/permissionPrimer';
import { previewPushCopy } from '@/lib/pushCopy';
import type { HealthProfile } from '@/lib/api';
import { reportError } from '@/lib/errorReporter';
import { withExtraAnswers } from '@/lib/onboarding';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { ONBOARDING_COUNTED_QUESTIONS } from '@/constants/assessmentSteps';
import { velvetField, velvetRaised, useVelvet } from '@/theme/velvet';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';

/** Enable notifications — Figma 8845:312878 */
export default function ProfileSetupNotificationsScreen() {
  const { palette: p } = useVelvet();
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
        let updated: HealthProfile;
        try {
          updated = await patchProfileExtra(healthProfile, user, {
            notificationsEnabled: osGranted,
          });
        } catch (e) {
          // The OS sheet is already answered; a failed save must not keep the person on this
          // one-button screen. The answer goes on in memory and the final onboarding save
          // (finishOnboarding re-sends extraAnswers) stores it.
          reportError('error', e);
          updated = withExtraAnswers(healthProfile, { notificationsEnabled: osGranted });
        }
        setHealthProfile(updated);
        goLocation();
      } finally {
        setBusy(false);
      }
    })();
  };

  const copy = primerCopy('notifications');
  // A real medication reminder (its own push template), never an alert the app does not send (App Review).
  const sample = previewPushCopy('medication');

  return (
    <ProfileSetupShell
      title={copy.title}
      body={copy.body}
      primaryLabel=""
      onPrimary={() => {}}
      showStepper={false}
      hidePrimary
      velvetStep={ONBOARDING_COUNTED_QUESTIONS + 1}
      footerSlot={
        <View style={{ gap: 14, width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Info size={16} color={p.inkOff} />
            <Text style={{ flexShrink: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p.inkOff }}>
              {ka.profileSetup.notificationsHint}
            </Text>
          </View>
          {/* App Review 5.1.1(iv): the one button, and it always opens the system sheet. */}
          <VelvetButton palette={p} label={copy.cta} onPress={continueFlow} busy={busy} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', paddingTop: 26 }}>
        {/* A notification as it will look: the page's one raised object. */}
        <View
          style={{
            width: '100%',
            maxWidth: 340,
            borderRadius: 24,
            padding: 16,
            flexDirection: 'row',
            gap: 12,
            backgroundColor: p.raised,
            boxShadow: velvetRaised(p),
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: p.field, boxShadow: velvetField(p) }}>
            <MedicardLogoMark size={30} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flexShrink: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: p.text }}>
                {sample.title}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 18, color: p.inkOff }}>{tx('ახლა', 'now')}</Text>
            </View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: p.ink2 }}>
              {sample.body}
            </Text>
            <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: p.ink }}>
              {ka.profileSetup.notificationsPreviewAction}
            </Text>
          </View>
        </View>
      </View>
    </ProfileSetupShell>
  );
}
