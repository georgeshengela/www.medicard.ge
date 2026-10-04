import { brandHex } from '@/theme/brandTone';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { hubInk } from '@/theme/hub';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Cog } from 'lucide-react-native';
import { tx } from '@/i18n/locale';

/**
 * Friendly stand-in for a screen that failed to render. The error is already reported (the
 * Director pings the team on Telegram within seconds), so the person is told calmly that we know
 * and are fixing it — no scary "something went wrong". Rendered by the root ErrorBoundary, so it
 * uses no app providers (no theme/font context): plain colours, system-safe weights.
 */
export function MaintenanceScreen({ onRetry }: { onRetry?: () => void }) {
  const dark = useColorScheme() === 'dark';
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduce) return undefined;
    spin.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(float);
    };
  }, [reduce, spin, float]);

  // Meshing gears turn in opposite directions; the small one turns faster.
  const cw = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const ccw = useAnimatedStyle(() => ({ transform: [{ rotate: `${22 - spin.value * 360}deg` }] }));
  const fast = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 720}deg` }] }));
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * float.value }] }));

  const ink = hubInk('teal', dark);
  const inkSoft = dark ? brandHex('#2DD4BF') : brandHex('#14B8A6');
  const inkPale = dark ? brandHex('#99F6E4') : brandHex('#5EEAD4');

  return (
    <View style={[styles.page, { backgroundColor: dark ? '#030712' : '#F8FAFA' }]}>
      <View style={styles.inner}>
        <Animated.View style={[styles.art, bob]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.glow, { backgroundColor: dark ? 'rgba(20,184,166,0.12)' : 'rgba(20,184,166,0.10)' }]} />
          <Animated.View style={[styles.gearBig, cw]}>
            <Cog size={96} color={ink} strokeWidth={1.6} />
          </Animated.View>
          <Animated.View style={[styles.gearMid, ccw]}>
            <Cog size={62} color={inkSoft} strokeWidth={1.8} />
          </Animated.View>
          <Animated.View style={[styles.gearSmall, fast]}>
            <Cog size={38} color={inkPale} strokeWidth={2} />
          </Animated.View>
        </Animated.View>

        <Text accessibilityRole="header" style={[styles.title, { color: dark ? '#FFFFFF' : '#0F1A1C' }]}>
          {tx('მიმდინარეობს ტექნიკური სამუშაოები', "We're doing a little maintenance")}
        </Text>
        <Text style={[styles.body, { color: dark ? '#D1D5DB' : '#46565A' }]}>
          {tx(
            'ამის შესახებ უკვე ვიცით და ახლავე ვასწორებთ. შენი მონაცემები სრულად უსაფრთხოა — სცადე ცოტა ხანში.',
            'We already know about this and are fixing it right now. Your data is completely safe — please try again in a little while.',
          )}
        </Text>

        {onRetry ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.cta, { backgroundColor: dark ? brandHex('#0D9488') : brandHex('#0F766E') }]}>
            <Text style={styles.ctaText}>{tx('თავიდან ცდა', 'Try again')}</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.note, { color: dark ? '#6B7280' : '#8A9A9D' }]}>
          {tx('თუ ისევ ასე იქნება, დახურე აპი და ცოტა ხანში ხელახლა გახსენი.', 'If it stays like this, close the app and open it again a bit later.')}
        </Text>
      </View>
    </View>
  );
}

const ART = 200;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  inner: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
  },
  art: {
    width: ART,
    height: ART * 0.82,
    marginBottom: 28,
  },
  glow: {
    position: 'absolute',
    left: ART * 0.08,
    top: ART * 0.02,
    width: ART * 0.8,
    height: ART * 0.8,
    borderRadius: ART * 0.4,
  },
  gearBig: {
    position: 'absolute',
    left: 30,
    top: 34,
  },
  gearMid: {
    position: 'absolute',
    left: 112,
    top: 12,
  },
  gearSmall: {
    position: 'absolute',
    left: 118,
    top: 92,
  },
  title: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  cta: {
    marginTop: 26,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
