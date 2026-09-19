import React, { useCallback, useEffect } from 'react';
import { Dimensions, Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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

  useEffect(() => {
    RNStatusBar.setBarStyle('light-content', true);
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor('#14B8A6', true);
    }
  }, []);

  const body = SLIDE_COPY[LANDING.bodyKey as keyof typeof SLIDE_COPY] as string;

  return (
    <View className="flex-1" style={{ width: SCREEN_W, backgroundColor: '#14B8A6' }}>
      <StatusBar style="light" />
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
      {/* Floating so QA can always reach it regardless of screen height (DEV renders null in prod). */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 220, left: 0, right: 0 }}>
        <OnboardingDevLauncher variant="inline" />
      </View>
    </View>
  );
}
