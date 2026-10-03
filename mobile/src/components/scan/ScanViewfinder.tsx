import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * MEDISCAN's one bold element: a viewfinder with corners in the brand ink and a light sweeping over whatever is
 * being read (the chosen kind's glyph). `scanning` speeds the sweep up while a result is being read.
 */
export function ScanViewfinder({ size = 120, icon: Icon, scanning = false }: { size?: number; icon: LucideIcon; scanning?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const reduceMotion = usePrefersReducedMotion();
  const sweep = useSharedValue(0);
  const ink = dark ? MODULE_BRANDS.scan.ink.dark : MODULE_BRANDS.scan.ink.light;
  useEffect(() => {
    if (reduceMotion) { cancelAnimation(sweep); sweep.value = 0.5; return; }
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: scanning ? 1100 : 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(sweep);
  }, [reduceMotion, scanning, sweep]);
  const inner = size - 28;
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.value * (inner - 22) }] }));
  const corner = Math.round(size * 0.24);
  const stroke = 3;
  const bracket = (pos: { top?: number; bottom?: number; left?: number; right?: number }) => (
    <View pointerEvents="none" style={{
      position: 'absolute', width: corner, height: corner, ...pos, borderColor: ink,
      borderTopWidth: pos.top !== undefined ? stroke : 0, borderBottomWidth: pos.bottom !== undefined ? stroke : 0,
      borderLeftWidth: pos.left !== undefined ? stroke : 0, borderRightWidth: pos.right !== undefined ? stroke : 0,
      borderTopLeftRadius: pos.top !== undefined && pos.left !== undefined ? 18 : 0, borderTopRightRadius: pos.top !== undefined && pos.right !== undefined ? 18 : 0,
      borderBottomLeftRadius: pos.bottom !== undefined && pos.left !== undefined ? 18 : 0, borderBottomRightRadius: pos.bottom !== undefined && pos.right !== undefined ? 18 : 0,
    }} />
  );
  return (
    <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {bracket({ top: 0, left: 0 })}{bracket({ top: 0, right: 0 })}{bracket({ bottom: 0, left: 0 })}{bracket({ bottom: 0, right: 0 })}
      <View style={{ width: inner, height: inner, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: `${ink}${dark ? '1F' : '12'}` }}>
        <Icon size={inner * 0.42} color={dark ? c.text200 : c.text100} strokeWidth={1.4} />
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 22 }, line]}>
          <Svg width="100%" height="22" viewBox="0 0 100 22" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="scanSweep" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ink} stopOpacity="0" />
                <Stop offset="0.82" stopColor={ink} stopOpacity="0.32" />
                <Stop offset="1" stopColor={ink} stopOpacity="0.95" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="22" fill="url(#scanSweep)" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}
