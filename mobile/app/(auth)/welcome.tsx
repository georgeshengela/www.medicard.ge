import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartbeatHero } from '@/components/welcome/HeartbeatHero';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetSegment } from '@/components/velvet/VelvetSegment';
import { VelvetThemeToggle } from '@/components/velvet/VelvetThemeToggle';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
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
import { useTheme } from '@/store/ThemeContext';
import { useVelvet } from '@/theme/velvet';

const SIGN_IN = '/(auth)/sign-in';

/**
 * The welcome screen is where the language and the theme are chosen: the copy follows the highlighted
 * language at once (both dictionaries are local) and the theme toggle switches the whole app right here.
 * „Get started“ continues in that language.
 */
const COPY: Record<AppLang, { body: string; getStarted: string; alreadyHaveAccount: string; signIn: string; wordmark: string; language: string; darkTheme: string }> = {
  ka: {
    body: kaDictionary.onboarding.slides.landingBody,
    getStarted: kaDictionary.onboarding.getStarted,
    alreadyHaveAccount: kaDictionary.onboarding.alreadyHaveAccount,
    signIn: kaDictionary.auth.signIn,
    wordmark: kaDictionary.app.brandWordmark,
    language: kaDictionary.onboarding.language,
    darkTheme: kaDictionary.onboarding.darkTheme,
  },
  en: {
    body: en.onboarding.slides.landingBody,
    getStarted: en.onboarding.getStarted,
    alreadyHaveAccount: en.onboarding.alreadyHaveAccount,
    signIn: en.auth.signIn,
    wordmark: en.app.brandWordmark,
    language: en.onboarding.language,
    darkTheme: en.onboarding.darkTheme,
  },
};

const LANGS = [
  { value: 'ka', label: 'ქართული' },
  { value: 'en', label: 'English' },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = usePrefersReducedMotion();
  const { setPreference } = useTheme();
  const { palette: p, dark } = useVelvet();
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

  const copy = COPY[lang];

  return (
    <View style={{ flex: 1, backgroundColor: p.surface, paddingTop: insets.top }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/* centred a little low, so the wordmark sits near the controls rather than mid-screen */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 }}>
        <HeartbeatHero palette={p} dark={dark} wordmark={copy.wordmark} reduceMotion={reduceMotion} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <VelvetSegment
            value={lang}
            options={LANGS}
            onChange={setLang}
            palette={p}
            accessibilityLabel={copy.language}
            style={{ flex: 1 }}
          />
          <VelvetThemeToggle
            dark={dark}
            onToggle={() => setPreference(dark ? 'light' : 'dark')}
            palette={p}
            accessibilityLabel={copy.darkTheme}
          />
        </View>

        <Text
          style={{
            marginTop: 18,
            marginHorizontal: -6,
            minHeight: 44,
            textAlign: 'center',
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 15,
            lineHeight: 22,
            color: p.ink2,
          }}
        >
          {/* keep the dash with the word before it, never at the start of a line */}
          {copy.body.replace(' —', ' —')}
        </Text>

        <View style={{ marginTop: 18 }}>
          <VelvetButton label={copy.getStarted} onPress={() => void finish()} palette={p} busy={busy} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void finish()}
          hitSlop={8}
          style={{ marginTop: 6, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, color: p.ink2 }}>
            {copy.alreadyHaveAccount}{' '}
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: p.ink }}>{copy.signIn}</Text>
          </Text>
        </Pressable>
      </View>

      {/* DEV only (renders null in production): QA shortcuts, kept clear of the hero. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 4, left: 0, right: 0 }}>
        <OnboardingDevLauncher variant="inline" />
      </View>
    </View>
  );
}
