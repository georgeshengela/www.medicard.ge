import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AnalyzingBackdrop } from '@/components/profile/AnalyzingBackdrop';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { analysisFromProfile } from '@/types/onboardingAnalysis';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';

/** Generating Asklepios score — Figma 8845:313481 */
export default function ProfileSetupAnalyzingScreen() {
  const FIGMA_PROFILE_SETUP = useFigmaProfileSetup();
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const params = useLocalSearchParams<{ force?: string }>();
  const force = params.force === '1';
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const pulse = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (!ready || !healthProfile || started.current) return;
    started.current = true;

    const existing = analysisFromProfile(healthProfile.extraAnswers as Record<string, unknown>);
    const resultsPath = onboardingStepHref('/(auth)/profile-setup/results', preview);
    if (existing && !force) {
      router.replace(resultsPath as never);
      return;
    }

    void (async () => {
      try {
        const res = await api.healthProfile.onboardingAnalysis({ force });
        setHealthProfile(res.profile);
      } catch {
        // heuristic fallback may still be on profile after retry from results
      } finally {
        router.replace(resultsPath as never);
      }
    })();
  }, [ready, healthProfile, router, setHealthProfile, preview, force]);

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

  const extra = (healthProfile.extraAnswers ?? {}) as Record<string, unknown>;
  const avatarId = normalizeAvatarForGender(
    typeof extra.avatarId === 'string' ? extra.avatarId : null,
    user.gender,
  );
  const avatarSource = isAvatarId(avatarId) ? AVATAR_SOURCES[avatarId] : AVATAR_SOURCES['avatar-1'];
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_PROFILE_SETUP.pageBg }}>
      <AnalyzingBackdrop />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' }}>
            <Image source={avatarSource} style={{ width: '100%', height: '100%' }} />
          </View>
          <View style={{ position: 'absolute', bottom: -12, alignSelf: 'center' }}>
            <MedicardLogoMark size={32} />
          </View>
        </Animated.View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 48, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 20, lineHeight: 28, color: FIGMA_PROFILE_SETUP.bodyColor, textAlign: 'center' }}>
          {ka.profileSetup.analyzingText}
        </Text>
      </View>
    </View>
  );
}
