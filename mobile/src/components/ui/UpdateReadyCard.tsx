import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing, FadeInDown, FadeOut, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, X } from 'lucide-react-native';
import { TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { tx } from '@/i18n/locale';
import { applyOtaNow, otaCardVisible, subscribeOta } from '@/lib/otaUpdates';
import { useBrandTone } from '@/theme/brandTone';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk } from '@/theme/hub';

/** Hidden for the rest of this run once she closes it; the update still applies after ≥10 min away. */
let dismissedThisRun = false;

/** The brand gradient of the one bold element (the badge): teal, or rose with the women's Home. */
const BADGE = { teal: ['#0B6F67', '#14B8A6'] as const, rose: ['#8E2A4E', '#D6406A'] as const };

/** A brand-gradient disc with an arrow and one soft breathing ring (still with reduced motion). */
function Badge({ colors, ring }: { colors: readonly [string, string]; ring: string }) {
  const reduce = usePrefersReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) { cancelAnimation(t); t.value = 0; return; }
    t.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduce, t]);
  const pulse = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(t.value, [0, 1], [1, 1.45]) }],
  }));
  return (
    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: ring }, pulse]} />
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <ArrowUp size={21} color="#FFFFFF" strokeWidth={2.6} />
      </LinearGradient>
    </View>
  );
}

/**
 * „ახალი ვერსია · მზადაა“ — a quiet card above the tab bar when an over-the-air update is downloaded
 * (owner 2026-10-11). One tap restarts into it; nothing is blocked and the App Store is not involved.
 * Shown automatically (admin switch in #/settings); during a MEDIRUN session the restart waits.
 */
export function UpdateReadyCard({ preview = false }: { preview?: boolean } = {}) {
  const visible = useSyncExternalStore(subscribeOta, otaCardVisible, otaCardVisible);
  const [closed, setClosed] = useState(dismissedThisRun);
  const [state, setState] = useState<'idle' | 'working' | 'busy'>('idle');
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const dark = useIsDark();
  const tone = useBrandTone() === 'rose' ? 'rose' : 'teal';
  if ((!visible || closed) && !preview) return null;
  const ink = hubInk('teal', dark);
  // The dark-theme ink is a light tint: its button text is dark, the light theme's is white.
  const onInk = dark ? '#042F2E' : '#FFFFFF';

  const update = async () => {
    setState('working');
    const result = preview ? 'none' : await applyOtaNow();
    if (result === 'busy') setState('busy');
    else if (result !== 'reloading') setState('idle');
  };
  const close = () => {
    dismissedThisRun = true;
    setClosed(true);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      exiting={FadeOut.duration(180)}
      pointerEvents="box-none"
      style={preview ? { width: '100%' } : { position: 'absolute', left: 16, right: 16, bottom: TAB_BAR_HEIGHT + 10 + Math.max(insets.bottom, 12) + 12, alignItems: 'center' }}
    >
      <View style={{ width: '100%', maxWidth: 480 }}>
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 12,
            borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.bg300,
            shadowColor: '#0B2A2C', shadowOpacity: dark ? 0.4 : 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6,
          }}
        >
          <Badge colors={BADGE[tone]} ring={ink} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: c.text100, fontSize: 15, lineHeight: 21, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
              {tx('ახალი ვერსია', 'New version')}
            </Text>
            <Text numberOfLines={1} style={{ color: c.text300, fontSize: 12, lineHeight: 17, fontFamily: 'NotoSansGeorgian_400Regular' }}>
              {state === 'busy' ? tx('ჯერ სირბილი დაასრულე', 'Finish your run first') : tx('მზადაა ჩასართავად', 'Ready to install')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('განახლება ახლავე', 'Update now')}
            onPress={() => void update()}
            disabled={state === 'working'}
            style={{ minHeight: 38, paddingHorizontal: 16, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: ink }}
          >
            {state === 'working'
              ? <ActivityIndicator size="small" color={onInk} />
              : <Text style={{ color: onInk, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' }}>{tx('განახლება', 'Update')}</Text>}
          </Pressable>
        </View>
        {/* close: a small chip on the corner, out of the content's way */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('მოგვიანებით', 'Later')}
          onPress={close}
          hitSlop={10}
          style={{ position: 'absolute', top: -8, right: -6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.bg300 }}
        >
          <X size={13} color={c.text300} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
