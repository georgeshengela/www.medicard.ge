import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { OnboardingExitLinks } from '@/components/auth/OnboardingExit';
import { AnalyzingBackdrop } from '@/components/profile/AnalyzingBackdrop';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { reportError } from '@/lib/errorReporter';
import { finishRetryDelay } from '@/lib/onboarding';
import { useOnboardingDevPreview, onboardingScreenBlocked } from '@/lib/onboardingDevPreview';
import { useAnimatedProgress } from '@/hooks/useAnimatedProgress';
import { finishOnboarding } from '@/lib/profileSetupFlow';
import { useAuth } from '@/store/AuthContext';

const AVATAR = 88;
const RING = 112;
const RING_STROKE = 4;
const RING_R = (RING - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const MIN_HOLD_MS = 3000;
const LOGO_SIZE = 34;
const LOGO_GAP = 16;

function firstNameOf(fullName: string, extra: Record<string, unknown>): string {
  const legal = typeof extra.legalName === 'string' ? extra.legalName.trim() : '';
  const raw = (legal || fullName).trim();
  return raw.split(/\s+/)[0] ?? '';
}

/** Profile is being prepared — Figma 8846:211832 rings, then home. */
export default function ProfileSetupAnalyzingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const preview = useOnboardingDevPreview();
  const params = useLocalSearchParams<{ force?: string }>();
  const force = params.force === '1';
  const { ready, user, healthProfile, setHealthProfile, setUser } = useAuth();
  const started = useRef(false);
  const analysisTried = useRef(false);
  const alive = useRef(true);
  // Bumped by „ხელახლა ცდა“: runs the final save again after it failed (and its retries too).
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: MIN_HOLD_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [progress, pulse]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !user || !healthProfile || started.current) return;
    started.current = true;

    const shownAt = Date.now();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    void (async () => {
      let profile = healthProfile;
      const extraAnswers = (healthProfile.extraAnswers ?? {}) as Record<string, unknown>;
      // Once per screen: a retry of the save below never asks the AI again.
      if (extraAnswers.aiPrivacyDecision === 'accepted' && !analysisTried.current) {
        analysisTried.current = true;
        try {
          const res = await api.healthProfile.onboardingAnalysis({ force });
          profile = res.profile;
          setHealthProfile(profile);
        } catch {
          // score page is skipped — still mark onboarding done
        }
      }

      if (!preview) {
        // Nothing else re-runs this save (AuthGate stays out of profile-setup and nothing hydrates
        // on foreground), so a failure is retried here a bounded number of times and then shown
        // with a retry button — never an endless spinner. finishOnboarding is safe to repeat.
        for (let failures = 1; ; failures += 1) {
          try {
            const result = await finishOnboarding(profile, user);
            setHealthProfile(result.profile);
            setUser(result.user);
            break;
          } catch (e) {
            const delay = finishRetryDelay(e, failures);
            if (delay !== null && alive.current) {
              await wait(delay);
              if (alive.current) continue;
            }
            if (!alive.current) return;
            reportError('error', e);
            setError(authErrorMessage(e));
            return;
          }
        }
      }

      const left = MIN_HOLD_MS - (Date.now() - shownAt);
      if (left > 0) await wait(left);
      if (!alive.current) return;

      router.replace('/(tabs)/home' as never);
    })();
  }, [ready, user, healthProfile, router, setHealthProfile, setUser, preview, force, attempt]);

  const retry = () => {
    setError(null);
    started.current = false;
    setAttempt((n) => n + 1);
  };

  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  const avatarId = normalizeAvatarForGender(
    typeof extra.avatarId === 'string' ? extra.avatarId : null,
    user?.gender,
  );
  const avatarSource = isAvatarId(avatarId) ? AVATAR_SOURCES[avatarId] : AVATAR_SOURCES['avatar-1'];
  const name = useMemo(
    () => (user ? firstNameOf(user.fullName, extra) : ''),
    [user, extra],
  );
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const fill = useAnimatedProgress(progress, 0);
  const dashOffset = RING_C * (1 - fill);

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

  return (
    <View style={{ flex: 1, backgroundColor: '#14B8A6' }}>
      <AnalyzingBackdrop />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
          <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RING_R}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RING_R}
                stroke="#FFFFFF"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            <View
              style={{
                width: AVATAR,
                height: AVATAR,
                borderRadius: AVATAR / 2,
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.7)',
                overflow: 'hidden',
                backgroundColor: '#0F766E',
              }}
            >
              <Image source={avatarSource} style={{ width: '100%', height: '100%' }} />
            </View>
          </View>
          <View style={{ marginTop: LOGO_GAP }}>
            <MedicardLogoMark size={LOGO_SIZE} tone="inverse" />
          </View>
        </Animated.View>
      </View>
      <View style={{ paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + (error ? 12 : 32), alignItems: 'center' }}>
        {error ? (
          <>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 20, lineHeight: 28, color: '#FFFFFF', textAlign: 'center' }}
            >
              {tx('პროფილი ვერ შევინახეთ', 'We couldn’t save your profile')}
            </Text>
            <Text
              accessibilityRole="alert"
              style={{
                marginTop: 8,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 14,
                lineHeight: 21,
                color: 'rgba(255,255,255,0.9)',
                textAlign: 'center',
              }}
            >
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={{
                marginTop: 20,
                alignSelf: 'stretch',
                height: 52,
                borderRadius: 16,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#0F766E' }}>
                {tx('ხელახლა ცდა', 'Try again')}
              </Text>
            </Pressable>
            <OnboardingExitLinks color="#FFFFFF" />
          </>
        ) : (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 22,
              lineHeight: 32,
              color: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            {ka.profileSetup.preparingProfile(name)}
          </Text>
        )}
      </View>
    </View>
  );
}
