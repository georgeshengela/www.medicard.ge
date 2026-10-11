import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingExitLinks } from '@/components/auth/OnboardingExit';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { HeartbeatDisc } from '@/components/welcome/HeartbeatHero';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { reportError } from '@/lib/errorReporter';
import { displayFirstName } from '@/lib/displayName';
import { finishRetryDelay } from '@/lib/onboarding';
import { useOnboardingDevPreview, onboardingScreenBlocked } from '@/lib/onboardingDevPreview';
import { finishOnboarding } from '@/lib/profileSetupFlow';
import { useAuth } from '@/store/AuthContext';
import { useVelvet } from '@/theme/velvet';

/** A short welcome beat while onboarding is saved — nothing is analysed here. */
const MIN_HOLD_MS = 1500;

/**
 * Profile is being prepared — the heartbeat disc for a short beat, then home. Only `finishOnboarding` runs here: the
 * old hidden AI „health score“ call was removed (2026-10-08), so this screen never sends anything to AI.
 */
export default function ProfileSetupAnalyzingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile, setUser } = useAuth();
  const started = useRef(false);
  const alive = useRef(true);
  // Bumped by „ხელახლა ცდა“: runs the final save again after it failed (and its retries too).
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { palette: p, dark } = useVelvet();
  const { width } = useWindowDimensions();
  const reduceMotion = usePrefersReducedMotion();

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
      if (!preview) {
        // Nothing else re-runs this save (AuthGate stays out of profile-setup and nothing hydrates
        // on foreground), so a failure is retried here a bounded number of times and then shown
        // with a retry button — never an endless spinner. finishOnboarding is safe to repeat.
        for (let failures = 1; ; failures += 1) {
          try {
            const result = await finishOnboarding(healthProfile, user);
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
  }, [ready, user, healthProfile, router, setHealthProfile, setUser, preview, attempt]);

  const retry = () => {
    setError(null);
    started.current = false;
    setAttempt((n) => n + 1);
  };

  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  // Never the server's placeholder name: without a real one the line is just „ვამზადებთ პროფილს“.
  const name = useMemo(() => displayFirstName(user, extra), [user, extra]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user || !healthProfile) return <Redirect href="/(auth)/sign-in" />;
  const blocked = onboardingScreenBlocked(preview, user, healthProfile);
  if (blocked === 'assessment') return <Redirect href="/(auth)/assessment" />;

  // The sign-in's heartbeat disc closes registration: the same object the person started with.
  return (
    <View style={{ flex: 1, backgroundColor: p.surface }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <HeartbeatDisc palette={p} dark={dark} disc={124} width={width} reduceMotion={reduceMotion} />
        {error ? null : (
          <Text style={{ marginTop: 34, paddingHorizontal: 32, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 31, color: p.text, textAlign: 'center' }}>
            {ka.profileSetup.preparingProfile(name)}
          </Text>
        )}
      </View>
      {error ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, color: p.text, textAlign: 'center' }}>
            {tx('პროფილი ვერ შევინახეთ', 'We couldn’t save your profile')}
          </Text>
          <VelvetNotice palette={p} text={error} />
          <VelvetButton palette={p} label={tx('ხელახლა ცდა', 'Try again')} onPress={retry} />
          <OnboardingExitLinks color={p.ink2} />
        </View>
      ) : null}
    </View>
  );
}
