import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ka } from '@/i18n/ka';
import type { PasswordStrengthLevel } from '@/lib/passwordStrength';
import { velvetField, type VelvetPalette } from '@/theme/velvet';

const LEVELS: Record<Exclude<PasswordStrengthLevel, 'empty'>, { share: number; color: string; label: () => string }> = {
  weak: { share: 0.34, color: '#D97706', label: () => ka.auth.passwordStrengthWeak },
  fair: { share: 0.67, color: '#14B8A6', label: () => ka.auth.passwordStrengthFair },
  strong: { share: 1, color: '#10B981', label: () => ka.auth.passwordStrengthStrong },
};

/** Password strength as light filling a groove carved under the field. */
export function VelvetStrength({ level, palette: p }: { level: PasswordStrengthLevel; palette: VelvetPalette }) {
  const fill = useSharedValue(0);
  const info = level === 'empty' ? null : LEVELS[level];

  useEffect(() => {
    fill.value = withTiming(info ? info.share : 0, { duration: 320 });
  }, [fill, info]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  if (!info) return null;
  return (
    <View style={{ marginTop: 10, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: p.surface, boxShadow: velvetField(p), overflow: 'hidden' }}>
        <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: info.color, boxShadow: `0px 0px 6px ${info.color}` }, fillStyle]} />
      </View>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: info.color }}>{info.label()}</Text>
    </View>
  );
}
