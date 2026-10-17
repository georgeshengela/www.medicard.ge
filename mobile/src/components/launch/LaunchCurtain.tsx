import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Appearance, StyleSheet, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { HeartbeatDisc, PULSE_SPEED, pulseHitDistance } from '@/components/welcome/HeartbeatHero';
import { SPLASH_ART, SPLASH_DISC } from '@/components/launch/launchArt';
import { markLaunchArtReady, useLaunchHandoff } from '@/lib/launchHandoff';
import { VELVET } from '@/theme/velvet';

const ART = {
  light: require('../../../assets/splash/launch-light.png'),
  dark: require('../../../assets/splash/launch-dark.png'),
};

/** Timeline (ms after the native splash hides): hold the native frame, wake the disc, beat once, open. */
const HOLD = 100;
const WAKE = 260;
const AFTER_BEAT = 300;
const OPEN = 480;
/** The first pulse starts this far (pt) short of the disc, so it lands ~0.4 s after the disc wakes. */
const LEAD = 110;

const ease = (t: number) => {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};

/**
 * The launch curtain (owner 2026-10-17: „ელეგანტური და ლამაზი გადასვლა“). Its first frame is the native
 * splash itself (the same PNG on the same velvet surface, by the system appearance like the splash). When
 * the splash hides, the picture wakes into the live heartbeat disc, the pulse runs in along the line, the
 * disc beats once and the curtain opens into the app — the disc swells softly as everything fades.
 * Never touchable, always gone within ~1.5 s; reduced motion just fades. The welcome intro claims the
 * launch and plays its own movement from the same frame, so the curtain steps aside at once.
 */
export function LaunchCurtain() {
  const handoff = useLaunchHandoff();
  const { width, height } = useWindowDimensions();
  const [scheme] = useState<'light' | 'dark'>(() => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'));
  const p = VELVET[scheme];
  const [reduced, setReduced] = useState(false);
  const [live, setLive] = useState(false);
  const [done, setDone] = useState(false);

  const wake = useSharedValue(0);
  const line = useSharedValue(0);
  const open = useSharedValue(0);
  const { from, beatAt } = useMemo(() => {
    const hit = pulseHitDistance(width, SPLASH_DISC);
    const start = Math.max(0, hit - LEAD);
    return { from: start, beatAt: ((hit - start) / PULSE_SPEED) * 1000 };
  }, [width]);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => alive && setReduced(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (handoff !== 'playing') return undefined;
    const finish = () => setDone(true);
    if (reduced) {
      open.value = withTiming(1, { duration: 220 }, (ok) => ok && runOnJS(finish)());
      const fallback = setTimeout(finish, 700);
      return () => clearTimeout(fallback);
    }
    const start = setTimeout(() => {
      setLive(true);
      wake.value = withTiming(1, { duration: WAKE, easing: Easing.out(Easing.cubic) });
      line.value = withTiming(1, { duration: WAKE + 60 });
    }, HOLD);
    const openAt = HOLD + beatAt + AFTER_BEAT;
    const opening = setTimeout(() => {
      open.value = withTiming(1, { duration: OPEN, easing: Easing.linear }, (ok) => ok && runOnJS(finish)());
    }, openAt);
    // never stay longer than the movement, whatever the animation callbacks do
    const fallback = setTimeout(finish, openAt + OPEN + 600);
    return () => {
      clearTimeout(start);
      clearTimeout(opening);
      clearTimeout(fallback);
    };
  }, [handoff, reduced, beatAt, wake, line, open]);

  const curtainStyle = useAnimatedStyle(() => ({ opacity: 1 - ease(open.value) }));
  const discStyle = useAnimatedStyle(() => {
    const t = ease(open.value);
    return { opacity: 1 - Math.min(1, t * 1.25), transform: [{ scale: 1 + 0.1 * t }] };
  });
  const artStyle = useAnimatedStyle(() => ({ opacity: 1 - wake.value }));

  if (handoff === 'claimed' || done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: p.surface, zIndex: 1000, elevation: 1000 }, curtainStyle]}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Animated.View style={[{ position: 'absolute', left: 0, top: height / 2 - SPLASH_DISC / 2, width, height: SPLASH_DISC }, discStyle]}>
        {live ? (
          <HeartbeatDisc palette={p} dark={scheme === 'dark'} disc={SPLASH_DISC} width={width} reduceMotion={false} lineOpacity={line} firstFrom={from} />
        ) : null}
      </Animated.View>
      <Animated.Image
        source={ART[scheme]}
        fadeDuration={0}
        onLoad={markLaunchArtReady}
        onError={markLaunchArtReady}
        style={[
          { position: 'absolute', left: width / 2 - SPLASH_ART / 2, top: height / 2 - SPLASH_ART / 2, width: SPLASH_ART, height: SPLASH_ART },
          artStyle,
        ]}
      />
    </Animated.View>
  );
}
