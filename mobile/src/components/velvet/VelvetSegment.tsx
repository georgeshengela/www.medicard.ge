import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { velvetKnob, velvetTrack, type VelvetPalette } from '@/theme/velvet';

const H = 52;
const BORDER = 3;
const INSET = 4;

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: readonly [Option<T>, Option<T>];
  onChange: (value: T) => void;
  palette: VelvetPalette;
  accessibilityLabel: string;
  style?: ViewStyle;
};

/** Two options in a pressed track; the chosen one sits on a raised thumb that springs across. */
export function VelvetSegment<T extends string>({ value, options, onChange, palette: p, accessibilityLabel, style }: Props<T>) {
  const [inner, setInner] = useState(0);
  const thumbW = Math.max(0, (inner - INSET * 2) / 2);
  const index = options[1].value === value ? 1 : 0;
  const x = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (thumbW <= 0) return;
    // The first measured position is set, not sprung; later choices spring across.
    x.value = placed.current ? withSpring(index * thumbW, { damping: 15, stiffness: 210, mass: 0.8 }) : index * thumbW;
    placed.current = true;
  }, [index, thumbW, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setInner(e.nativeEvent.layout.width - BORDER * 2)}
      style={[
        {
          height: H,
          flexDirection: 'row',
          borderRadius: 30,
          borderWidth: BORDER,
          borderColor: p.surface,
          backgroundColor: p.surface,
          boxShadow: velvetTrack(p),
        },
        style,
      ]}
    >
      {thumbW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: INSET,
              top: INSET,
              width: thumbW,
              height: H - BORDER * 2 - INSET * 2,
              borderRadius: 22,
              backgroundColor: p.surface,
              boxShadow: velvetKnob(p),
            },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            hitSlop={4}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => undefined);
              onChange(option.value);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text
              numberOfLines={1}
              style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: active ? p.ink : p.inkOff }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
