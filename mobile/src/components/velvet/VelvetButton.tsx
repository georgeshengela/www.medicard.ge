import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

const H = 56;

type Props = {
  label: string;
  onPress: () => void;
  palette: VelvetPalette;
  busy?: boolean;
  /** Not ready yet: the pill sits pressed into the material, unlit; it rises and lights up teal once it can be pressed. */
  disabled?: boolean;
  /** `primary` = the one teal action; `quiet` = a raised pill of the material with teal ink. */
  tone?: 'primary' | 'quiet';
  icon?: LucideIcon;
  accessibilityHint?: string;
};

/** A raised velvet pill that sinks a little under the finger. */
export function VelvetButton({ label, onPress, palette: p, busy = false, disabled = false, tone = 'primary', icon: Icon, accessibilityHint }: Props) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const lit = tone === 'primary' && !disabled;
  const ink = lit ? '#FFFFFF' : tone === 'quiet' ? p.ink : p.inkOff;

  const content = busy ? (
    <ActivityIndicator color={ink} />
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {Icon ? <Icon size={18} color={ink} strokeWidth={2.2} /> : null}
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: tone === 'quiet' ? 16 : 17, lineHeight: 24, color: ink }}>{label}</Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: disabled || busy }}
      accessibilityHint={accessibilityHint}
      disabled={disabled || busy}
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
          {
            flex: 1,
            borderRadius: H / 2,
            backgroundColor: p.surface,
            boxShadow: lit ? `-4px -4px 10px ${p.light}, 6px 9px 18px ${p.ctaShade}` : disabled ? velvetField(p) : velvetLift(p),
          },
          pressStyle,
        ]}
      >
        {lit ? (
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
            {content}
          </LinearGradient>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{content}</View>
        )}
      </Animated.View>
    </Pressable>
  );
}
