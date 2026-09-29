import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { FigmaWelcomeSlide, type LandingCopy } from '@/components/welcome/FigmaWelcomeSlide';
import { welcomeProgressState } from '@/constants/figmaWelcomeLayout';
import { WELCOME_SLIDES } from '@/constants/welcomeSlides';
import { kaDictionary } from '@/i18n/ka';
import { en } from '@/i18n/en';
import {
  appLang,
  deviceLanguage,
  hasChosenLanguage,
  saveLanguage,
  setLanguageAndReload,
  setPendingRoute,
  type AppLang,
} from '@/i18n/locale';
import { OnboardingDevLauncher } from '@/components/dev/OnboardingDevLauncher';
import { setWelcomeCompleted } from '@/lib/onboardingPrefs';

const { width: SCREEN_W } = Dimensions.get('window');
const LANDING = WELCOME_SLIDES[0];
const SIGN_IN = '/(auth)/sign-in';

/**
 * The welcome screen is where the language is chosen: the copy here follows the highlighted
 * option at once (both dictionaries are local), and "Get started" continues in that language.
 */
const COPY: Record<AppLang, LandingCopy & { body: string }> = {
  ka: {
    body: kaDictionary.onboarding.slides.landingBody,
    getStarted: kaDictionary.onboarding.getStarted,
    alreadyHaveAccount: kaDictionary.onboarding.alreadyHaveAccount,
    signIn: kaDictionary.auth.signIn,
  },
  en: {
    body: en.onboarding.slides.landingBody,
    getStarted: en.onboarding.getStarted,
    alreadyHaveAccount: en.onboarding.alreadyHaveAccount,
    signIn: en.auth.signIn,
  },
};

const OPTIONS: { value: AppLang; label: string }[] = [
  { value: 'ka', label: 'ქართული' },
  { value: 'en', label: 'English' },
];
const PILL_W = 236;
const PAD = 4;
const BORDER = 1;
const PILL_H = 46;
// Absolute children sit inside the border; the two options share the padded inner width.
const THUMB_W = (PILL_W - BORDER * 2 - PAD * 2) / 2;

function LanguagePill({ value, onChange }: { value: AppLang; onChange: (lang: AppLang) => void }) {
  const x = useRef(new Animated.Value(value === 'en' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(x, {
      toValue: value === 'en' ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, x]);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="ენა · Language" style={styles.pill}>
      <Animated.View
        pointerEvents="none"
        style={[styles.thumb, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, THUMB_W] }) }] }]}
      />
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            hitSlop={6}
            style={styles.option}
          >
            <Text style={[styles.optionText, { color: active ? '#0F766E' : 'rgba(255,255,255,0.92)' }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single landing screen — carousel onboarding disabled for now. */
export default function WelcomeScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<AppLang>(() => (hasChosenLanguage() ? appLang() : deviceLanguage()));
  const [busy, setBusy] = useState(false);

  const finish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await setWelcomeCompleted(true);
    if (lang !== appLang()) {
      // Restart in the chosen language and continue straight to sign-in.
      setPendingRoute(SIGN_IN);
      if (await setLanguageAndReload(lang)) return;
    }
    saveLanguage(lang);
    router.replace(SIGN_IN);
  }, [busy, lang, router]);

  useEffect(() => {
    RNStatusBar.setBarStyle('light-content', true);
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor('#14B8A6', true);
    }
  }, []);

  const copy = COPY[lang];

  return (
    <View className="flex-1" style={{ width: SCREEN_W, backgroundColor: '#14B8A6' }}>
      <StatusBar style="light" />
      <FigmaWelcomeSlide
        frame={LANDING.frame}
        kind="landing"
        title=""
        body={copy.body}
        landingCopy={copy}
        landingTop={
          <View style={{ alignItems: 'center', marginBottom: 22 }}>
            <LanguagePill value={lang} onChange={setLang} />
          </View>
        }
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

const styles = StyleSheet.create({
  pill: {
    width: PILL_W,
    height: PILL_H,
    padding: PAD,
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: BORDER,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    width: THUMB_W,
    height: PILL_H - BORDER * 2 - PAD * 2,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#042F2E',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
});
