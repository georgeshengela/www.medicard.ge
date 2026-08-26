import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View, type ViewStyle } from 'react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';

type HotspotStyle = Pick<ViewStyle, 'left' | 'top' | 'width' | 'height'>;

type Props = {
  selected: boolean;
  onPress: () => void;
  label?: string;
  style: HotspotStyle;
};

export function SymptomHotspot({ selected, onPress, label, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!selected) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [selected, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Pressable onPress={onPress} style={{ position: 'absolute', ...style, alignItems: 'center', justifyContent: 'center' }}>
      {selected && label ? (
        <View style={{ alignItems: 'center', position: 'absolute', top: -38, zIndex: 2 }}>
          <View style={{ backgroundColor: T.white, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, ...T.shadowCard }}>
            <Animated.Text style={{ fontSize: 13, fontWeight: '700', color: T.textPrimary }}>{label}</Animated.Text>
          </View>
        </View>
      ) : null}
      {selected ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: T.brand,
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }}
        />
      ) : null}
      <View
        style={{
          width: selected ? 22 : 16,
          height: selected ? 22 : 16,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: T.white,
          backgroundColor: selected ? T.brand : 'rgba(20,184,166,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          ...T.shadowXs,
        }}
      >
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.white }} />
      </View>
    </Pressable>
  );
}
