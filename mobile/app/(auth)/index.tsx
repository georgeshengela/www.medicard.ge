import React, { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartbeatDisc } from '@/components/welcome/HeartbeatHero';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { takePendingRoute } from '@/i18n/locale';
import { useVelvet } from '@/theme/velvet';

/** Long enough for the first pulse to reach the disc and the beat to land. */
const HOLD_MS = 1500;
/** Height of the welcome screen's controls under its hero (segment row, body, button, sign-in). */
const WELCOME_CONTROLS = 258;
const WELCOME_HERO_TOP = 48;
const WELCOME_WORDMARK = 84;

/**
 * Launch screen (owner 2026-10-11): the welcome screen's heartbeat disc on velvet, at exactly the spot
 * where it sits on welcome. The first pulse runs in and the disc beats; then welcome takes over around
 * it, so opening the app reads as one movement.
 */
export default function AuthSplash() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { palette, dark } = useVelvet();
  const reduceMotion = usePrefersReducedMotion();

  const disc = Math.round(Math.min(200, width * 0.52));
  const heroArea = height - insets.top - insets.bottom - WELCOME_CONTROLS;
  const discTop = insets.top + WELCOME_HERO_TOP + Math.max(0, (heroArea - WELCOME_HERO_TOP - (disc + WELCOME_WORDMARK)) / 2);

  useEffect(() => {
    // Just restarted in the language picked on welcome: continue where the person was going.
    const pending = takePendingRoute();
    if (pending) {
      router.replace(pending as never);
      return undefined;
    }
    const done = setTimeout(() => router.replace('/(auth)/welcome'), HOLD_MS);
    return () => clearTimeout(done);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: discTop }}>
        <HeartbeatDisc palette={palette} dark={dark} disc={disc} width={width} reduceMotion={reduceMotion} />
      </View>
    </View>
  );
}
