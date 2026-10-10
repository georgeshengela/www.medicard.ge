import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { VelvetPalette } from '@/theme/velvet';

const H = 56;

type Props = {
  label: string;
  onPress: () => void;
  palette: VelvetPalette;
  busy?: boolean;
};

/** The one teal action on a velvet page: a raised pill that sinks a little under the finger. */
export function VelvetButton({ label, onPress, palette: p, busy = false }: Props) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.98, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 160 });
      }}
      style={{ height: H }}
    >
      <Animated.View
        style={[
          { flex: 1, borderRadius: H / 2, boxShadow: `-4px -4px 10px ${p.light}, 6px 9px 18px ${p.ctaShade}` },
          pressStyle,
        ]}
      >
        <LinearGradient
          colors={['#0B8A7F', '#0D9488', '#14B8A6']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flex: 1,
            borderRadius: H / 2,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.28)',
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, lineHeight: 24, color: '#FFFFFF' }}>{label}</Text>
          )}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}
