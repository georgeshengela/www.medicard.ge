import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Footprints, Pause } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { formatClock, formatDistanceShort } from '@/lib/run/geo';
import { isActiveRunPhase, useRunSession } from '@/lib/run/store';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

function PulseDot({ paused, reduce }: { paused: boolean; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce || paused) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.cubic) }),
      ),
      -1,
      false,
    );
  }, [paused, reduce, t]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.15 + t.value * 0.45,
    transform: [{ scale: 1 + t.value * 0.7 }],
  }));

  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      {!paused && !reduce ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
            },
            halo,
          ]}
        />
      ) : null}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: paused ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.2)',
        }}
      >
        {paused ? (
          <Pause size={13} color="#FFFFFF" strokeWidth={2.6} fill="#FFFFFF" />
        ) : (
          <Footprints size={14} color="#FFFFFF" strokeWidth={2.5} />
        )}
      </View>
    </View>
  );
}

/**
 * Compact live-run chip — always on top while a session is running/paused.
 * Tap returns to the map. Hidden on the active map screen itself.
 */
export function ActiveRunBadge() {
  const s = useRunSession();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const prevPhase = useRef(s.phase);

  const live = isActiveRunPhase(s.phase);
  const onActiveMap = pathname === '/run/active' || pathname?.endsWith('/run/active');
  const show = live && !onActiveMap;

  // If the run finishes while the map is closed, open the summary.
  useEffect(() => {
    const wasLive = isActiveRunPhase(prevPhase.current);
    prevPhase.current = s.phase;
    if (!wasLive || s.phase !== 'finished' || !s.summary) return;
    if (pathname === '/run/summary' || pathname?.endsWith('/run/summary')) return;
    router.push('/run/summary' as never);
  }, [s.phase, s.summary, pathname, router]);

  if (!show) return null;

  const paused = s.phase === 'paused';
  const clock = formatClock(s.movingMs);
  const dist = formatDistanceShort(s.distanceM);
  const label = paused ? ka.run.activePaused : ka.run.activeLive;

  return (
    <Animated.View
      pointerEvents="box-none"
      entering={reduce ? undefined : FadeInUp.duration(QUEST.motion.base).springify().damping(16)}
      exiting={reduce ? undefined : FadeOutUp.duration(QUEST.motion.fast)}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        top: insets.top + 8,
        zIndex: 70,
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${clock}`}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/run/active' as never);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          maxWidth: 360,
          paddingLeft: 8,
          paddingRight: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: paused ? (dark ? '#374151' : '#1F2937') : dark ? '#0D9488' : colors.primary200,
          borderWidth: 1,
          borderColor: paused ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)',
          shadowColor: paused ? '#000' : '#0F766E',
          shadowOpacity: dark ? 0.4 : 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <PulseDot paused={paused} reduce={reduce} />
        <View style={{ flexShrink: 1 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.2 }}
          >
            {label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 20, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
              {clock}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 16, color: 'rgba(255,255,255,0.78)' }}>
              {dist}
            </Text>
          </View>
        </View>
        <View
          style={{
            marginLeft: 4,
            paddingHorizontal: 10,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: '#FFFFFF' }}>{ka.run.activeOpen}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** True when the chrome overlay must stay interactive for the live-run badge. */
export function useActiveRunChrome(): boolean {
  const s = useRunSession();
  const pathname = usePathname();
  const onActiveMap = pathname === '/run/active' || pathname?.endsWith('/run/active');
  return isActiveRunPhase(s.phase) && !onActiveMap;
}
