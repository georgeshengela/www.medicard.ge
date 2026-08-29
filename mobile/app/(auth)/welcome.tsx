import React, { useCallback } from 'react';
import { Dimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FigmaWelcomeSlide } from '@/components/welcome/FigmaWelcomeSlide';
import { welcomeProgressState } from '@/constants/figmaWelcomeLayout';
import { WELCOME_SLIDES } from '@/constants/welcomeSlides';
import { ka } from '@/i18n/ka';
import { OnboardingDevLauncher } from '@/components/dev/OnboardingDevLauncher';
import { setWelcomeCompleted } from '@/lib/onboardingPrefs';

const { width: SCREEN_W } = Dimensions.get('window');
const LANDING = WELCOME_SLIDES[0];
const SLIDE_COPY = ka.onboarding.slides;

/** Single landing screen — carousel onboarding disabled for now. */
export default function WelcomeScreen() {
  const router = useRouter();

  const finish = useCallback(async () => {
    await setWelcomeCompleted(true);
    router.replace('/(auth)/sign-in');
  }, [router]);

  const body = SLIDE_COPY[LANDING.bodyKey as keyof typeof SLIDE_COPY] as string;

  return (
    <View className="flex-1 bg-bg-100" style={{ width: SCREEN_W }}>
      <FigmaWelcomeSlide
        frame={LANDING.frame}
        kind="landing"
        title=""
        body={body}
        progress={welcomeProgressState(0)}
        onPrimary={() => void finish()}
        onSignIn={() => void finish()}
        canPrev={false}
      />
      <OnboardingDevLauncher variant="inline" />
    </View>
  );
}
