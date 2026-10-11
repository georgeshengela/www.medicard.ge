import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { OnboardingDevLauncher } from '@/components/dev/OnboardingDevLauncher';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetSegment } from '@/components/velvet/VelvetSegment';
import { VelvetThemeToggle } from '@/components/velvet/VelvetThemeToggle';
import { HeartbeatDisc, VelvetWordmark } from '@/components/welcome/HeartbeatHero';
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
import { setWelcomeCompleted } from '@/lib/onboardingPrefs';
import { useTheme } from '@/store/ThemeContext';
import { useVelvet } from '@/theme/velvet';

const SIGN_IN = '/(auth)/sign-in';

/** The native launch screen (app.json expo-splash-screen): brand teal, the white mark at 260 pt of a 512 px image whose mark spans 400 px. */
const SPLASH_TEAL = '#14B8A6';
const SPLASH_MARK = (260 * 400) / 512;

/** Hero layout: the disc and the wordmark under it, centred a little low. */
const HERO_TOP = 48;
const WORDMARK_GAP = 40;
const WORDMARK_LINE = 44;
/** Where sign-in's header disc sits (AuthShell top gutter + half of VelvetAuthHeader's 92 pt disc). */
const SIGN_IN_DISC_CENTER = 16 + 46;
const SIGN_IN_DISC = 92;

/** Intro timeline (ms): the splash folds into the disc, the line and the first beat, then the page arrives. */
const T = {
  fold: [150, 820],
  markOut: [680, 920],
  tealOut: [760, 1000],
  rise: [450, 1000],
  line: [1000, 1350],
  firstPulse: 1000,
  glide: [1750, 2350],
  wordmark: [2050, 2400],
  controls: [2150, 2230, 2310, 2390],
  controlLength: 360,
  end: 2800,
} as const;

const span = (c: number, a: number, b: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (c - a) / (b - a)));
};
const ease = (t: number) => {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
const easeOut = (t: number) => {
  'worklet';
  return 1 - (1 - t) ** 3;
};

/**
 * The welcome screen copy follows the highlighted language at once (both dictionaries are local), and
 * the theme toggle switches the whole app right here. „Get started“ continues in that language.
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

/**
 * Welcome (owner 2026-10-11, „C · გულისცემა“ + „ლამაზი გადასვლა“). With `intro` (the launch route) the
 * first frame repeats the native launch screen, then folds into the page as one movement: the teal
 * closes into the disc's well and the white mark becomes the brand mark while the velvet disc rises,
 * the heartbeat line draws in and the first pulse beats, the disc glides up to its place and the page
 * arrives around it. „Get started“ plays it out: the disc shrinks into sign-in's header disc, the rest
 * fades, and sign-in fades in with its disc on the same spot.
 */
export function WelcomeScreen({ intro = false }: { intro?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { setPreference } = useTheme();
  const { palette: p, dark } = useVelvet();
  const [lang, setLang] = useState<AppLang>(() => (hasChosenLanguage() ? appLang() : deviceLanguage()));
  // `leaving` blocks a second tap while the page plays out; `busy` (a spinner) only while the app restarts in another language
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reduced motion is read once here (the shared hook starts at „reduced“ until the OS answers, which
  // would skip the intro): until the answer the screen shows the launch frame, which is the native one.
  const [motion, setMotion] = useState<'pending' | 'on' | 'off'>('pending');
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => alive && setMotion(reduced ? 'off' : 'on'))
      .catch(() => alive && setMotion('on'));
    return () => {
      alive = false;
    };
  }, []);
  const playing = intro && motion !== 'off';
  const [settled, setSettled] = useState(!intro);
  const [splashBar, setSplashBar] = useState(intro);

  const clock = useSharedValue(intro ? 0 : T.end);
  const exit = useSharedValue(0);
  useEffect(() => {
    if (!intro || motion === 'pending') return undefined;
    if (motion === 'off') {
      clock.value = T.end;
      setSplashBar(false);
      setSettled(true);
      return undefined;
    }
    clock.value = withTiming(T.end, { duration: T.end, easing: Easing.linear });
    const bar = setTimeout(() => setSplashBar(false), T.tealOut[0]);
    const done = setTimeout(() => setSettled(true), T.end - 300);
    return () => {
      clearTimeout(bar);
      clearTimeout(done);
    };
  }, [intro, motion, clock]);

  const disc = Math.round(Math.min(200, width * 0.52));
  const logo = Math.round(disc * 0.38);
  const well = Math.round(disc * 0.69);
  const radius = Math.hypot(width, height);

  // Where the disc's centre ends up on this layout, measured from the hero box.
  const discCenter = useSharedValue(height / 2);
  const onHeroLayout = useCallback(
    (y: number, h: number) => {
      discCenter.value = y + HERO_TOP + Math.max(0, (h - HERO_TOP - (disc + WORDMARK_GAP + WORDMARK_LINE)) / 2) + disc / 2;
    },
    [disc, discCenter],
  );
  const signInCenter = insets.top + SIGN_IN_DISC_CENTER;
  const signInScale = SIGN_IN_DISC / disc;

  const lineOpacity = useDerivedValue(() => span(clock.value, T.line[0], T.line[1]) * (1 - exit.value));
  const discStyle = useAnimatedStyle(() => {
    const start = height / 2 - discCenter.value;
    const glide = easeOut(span(clock.value, T.glide[0], T.glide[1]));
    const rise = easeOut(span(clock.value, T.rise[0], T.rise[1]));
    const out = ease(exit.value);
    return {
      transform: [
        { translateY: start * (1 - glide) + (signInCenter - discCenter.value) * out },
        { scale: (0.92 + 0.08 * rise) * (1 + (signInScale - 1) * out) },
      ],
    };
  });
  const wordmarkStyle = useAnimatedStyle(() => {
    const a = easeOut(span(clock.value, T.wordmark[0], T.wordmark[1]));
    return { opacity: a * (1 - exit.value), transform: [{ translateY: (1 - a) * 14 + exit.value * 10 }] };
  });
  const tealStyle = useAnimatedStyle(() => {
    const fold = ease(span(clock.value, T.fold[0], T.fold[1]));
    return {
      opacity: 1 - span(clock.value, T.tealOut[0], T.tealOut[1]),
      transform: [{ scale: 1 + (well / (radius * 2) - 1) * fold }],
    };
  });
  const markStyle = useAnimatedStyle(() => {
    const fold = ease(span(clock.value, T.fold[0], T.fold[1]));
    return {
      opacity: 1 - span(clock.value, T.markOut[0], T.markOut[1]),
      transform: [{ scale: 1 + (logo / SPLASH_MARK - 1) * fold }],
    };
  });

  const leave = useCallback(
    (then: () => void) => {
      if (motion === 'off') {
        then();
        return;
      }
      exit.value = withTiming(1, { duration: 440, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(then)();
      });
    },
    [exit, motion],
  );

  const finish = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    await setWelcomeCompleted(true);
    if (lang !== appLang()) {
      // Restart in the chosen language and continue straight to sign-in.
      setBusy(true);
      setPendingRoute(SIGN_IN);
      if (await setLanguageAndReload(lang)) return;
      setBusy(false);
    }
    saveLanguage(lang);
    leave(() => router.replace(SIGN_IN));
  }, [leaving, lang, leave, router]);

  const copy = COPY[lang];

  return (
    <View style={{ flex: 1, backgroundColor: p.surface, paddingTop: insets.top }}>
      <StatusBar style={splashBar || dark ? 'light' : 'dark'} />
      {/* centred a little low, so the wordmark sits near the controls rather than mid-screen */}
      <View
        onLayout={(e) => onHeroLayout(e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: HERO_TOP }}
      >
        <Animated.View style={discStyle}>
          <HeartbeatDisc
            palette={p}
            dark={dark}
            disc={disc}
            width={width}
            reduceMotion={motion === 'off'}
            lineOpacity={lineOpacity}
            startDelay={playing ? T.firstPulse : 0}
          />
        </Animated.View>
        <Animated.View style={[{ marginTop: WORDMARK_GAP }, wordmarkStyle]}>
          <VelvetWordmark text={copy.wordmark} size={38} palette={p} />
        </Animated.View>
      </View>

      <View pointerEvents={settled && !leaving ? 'auto' : 'none'} style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
        <Arrive clock={clock} exit={exit} at={T.controls[0]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <VelvetSegment value={lang} options={LANGS} onChange={setLang} palette={p} accessibilityLabel={copy.language} style={{ flex: 1 }} />
            <VelvetThemeToggle dark={dark} onToggle={() => setPreference(dark ? 'light' : 'dark')} palette={p} accessibilityLabel={copy.darkTheme} />
          </View>
        </Arrive>

        <Arrive clock={clock} exit={exit} at={T.controls[1]}>
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
        </Arrive>

        <Arrive clock={clock} exit={exit} at={T.controls[2]}>
          <View style={{ marginTop: 18 }}>
            <VelvetButton label={copy.getStarted} onPress={() => void finish()} palette={p} busy={busy} />
          </View>
        </Arrive>

        <Arrive clock={clock} exit={exit} at={T.controls[3]}>
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
        </Arrive>
      </View>

      {intro && motion !== 'off' ? (
        <>
          {/* the native launch screen, closing into the disc's well */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: width / 2 - radius,
                top: height / 2 - radius,
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
                backgroundColor: SPLASH_TEAL,
              },
              tealStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: width / 2 - SPLASH_MARK / 2, top: height / 2 - SPLASH_MARK / 2, width: SPLASH_MARK, height: SPLASH_MARK },
              markStyle,
            ]}
          >
            <MedicardLogoMark size={SPLASH_MARK} tone="inverse" />
          </Animated.View>
        </>
      ) : null}

      {/* DEV only (renders null in production): QA shortcuts, kept clear of the hero. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 4, left: 0, right: 0 }}>
        <OnboardingDevLauncher variant="inline" />
      </View>
    </View>
  );
}

/** One part of the page rising into place at `at` ms of the intro, and sinking away on exit. */
function Arrive({ clock, exit, at, children }: { clock: SharedValue<number>; exit: SharedValue<number>; at: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const a = easeOut(span(clock.value, at, at + T.controlLength));
    return { opacity: a * (1 - exit.value), transform: [{ translateY: (1 - a) * 18 + exit.value * 14 }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}
