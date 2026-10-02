import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Info } from 'lucide-react-native';
import { HomeLayoutOptions } from '@/components/home/layout/HomeLayoutOptions';
import { ProfileSetupPrimaryButton } from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { primaryGoalFromProfile } from '@/lib/assessmentForm';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { trackHomeLayoutChanged } from '@/lib/funnel';
import { homeLayoutAvailable, recommendedHomeLayout, storedHomeLayout, type HomeLayoutId } from '@/lib/home/homeLayout';
import { chooseHomeLayout } from '@/lib/home/homeLayoutStore';
import { onboardingScreenBlocked, onboardingStepHref, useOnboardingDevPreview } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';

/**
 * Onboarding step 8 (owner 2026-10-02): before the first Home, pick how Home should look.
 * Women see their layout first and pre-selected („შენთვის“); a nutrition goal pre-selects
 * „კვება და წონა“. The choice is saved at once and can be changed any time on Home or in Profile.
 */
export default function ProfileSetupHomeLayoutScreen() {
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const c = useThemeColors();
  const { ready, user, healthProfile } = useAuth();
  const features = useFeatureState();
  const layoutsOn = isFeatureOn('homeLayouts', features);
  const gender = user?.gender;
  const recommended = recommendedHomeLayout(primaryGoalFromProfile(healthProfile), gender, features);
  const stored = storedHomeLayout(healthProfile?.extraAnswers).layout;
  const [selected, setSelected] = useState<HomeLayoutId>(stored ?? recommended);
  const [busy, setBusy] = useState(false);

  const goNext = () => router.replace(onboardingStepHref('/(auth)/profile-setup/analyzing', preview) as never);

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
  // Admin paused the layouts: nothing to choose, go straight on (the choice is never required).
  if (!layoutsOn && !preview) return <Redirect href="/(auth)/profile-setup/analyzing" />;

  const choice = homeLayoutAvailable(selected, gender, features) ? selected : 'standard';

  const continueFlow = () => {
    if (busy) return;
    setBusy(true);
    if (!preview) {
      chooseHomeLayout(choice, { offerDone: true, immediate: true });
      trackHomeLayoutChanged(choice, 'none', 'onboarding');
    }
    goNext();
  };

  return (
    <ProfileSetupShell
      title={tx('შენი მთავარი გვერდი', 'Your Home')}
      body={tx(
        'აირჩიე, რა გამოჩნდეს პირველად, როცა აპს გახსნი. ყველა ფუნქცია ყოველთვის ხელმისაწვდომია.',
        'Choose what you see first when you open the app. Every feature stays one tap away.',
      )}
      primaryLabel=""
      onPrimary={() => {}}
      showStepper={false}
      hidePrimary
      footerSlot={
        <View style={{ gap: 16, width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 }}>
            <Info size={18} color={c.text200} />
            <Text style={{ flexShrink: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: c.text200, textAlign: 'center' }}>
              {tx(
                'მერეც შეგიძლია შეცვალო — მთავარ გვერდზე ან პროფილის პარამეტრებში.',
                'You can change it later — on Home or in Profile settings.',
              )}
            </Text>
          </View>
          <ProfileSetupPrimaryButton
            label={tx('გაგრძელება', 'Continue')}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              continueFlow();
            }}
            loading={busy}
            icon="arrow"
          />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <HomeLayoutOptions
          value={choice}
          onSelect={setSelected}
          gender={gender}
          features={features}
          recommended={recommended}
        />
      </View>
    </ProfileSetupShell>
  );
}
