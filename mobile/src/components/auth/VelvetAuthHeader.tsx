import React, { useEffect } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { HeartbeatDisc, VelvetWordmark } from '@/components/welcome/HeartbeatHero';
import { FIGMA_AUTH } from '@/constants/figmaAuthLayout';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { VelvetPalette } from '@/theme/velvet';

const DISC = 92;
const DISC_COMPACT = 56;
const KEYBOARD_EASE = Easing.bezier(0.17, 0.59, 0.4, 0.77);

type Props = {
  palette: VelvetPalette;
  dark: boolean;
  /** The brand wordmark (sign-in) or a plain heading (sign-up). */
  title: string;
  titleKind?: 'wordmark' | 'heading';
  subtitle?: string;
  /** Keyboard up: the disc shrinks, the heartbeat line and subtitle fold away. */
  compact: boolean;
  durationMs: number;
};

/**
 * Velvet auth header: the welcome screen's heartbeat disc, smaller, carried on to sign-in and sign-up so
 * the first minutes feel like one place. The pulse keeps running while the person types.
 */
export function VelvetAuthHeader({ palette: p, dark, title, titleKind = 'wordmark', subtitle, compact, durationMs }: Props) {
  const { width } = useWindowDimensions();
  const reduceMotion = usePrefersReducedMotion();
  const progress = useSharedValue(compact ? 1 : 0);
  const subHeight = useSharedValue(44);

  useEffect(() => {
    progress.value = reduceMotion ? (compact ? 1 : 0) : withTiming(compact ? 1 : 0, { duration: durationMs, easing: KEYBOARD_EASE });
  }, [compact, durationMs, progress, reduceMotion]);

  const lineOpacity = useDerivedValue(() => interpolate(progress.value, [0, 0.6], [1, 0], Extrapolation.CLAMP));
  const rowStyle = useAnimatedStyle(() => ({ height: interpolate(progress.value, [0, 1], [DISC, DISC_COMPACT]) }));
  const discStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress.value, [0, 1], [1, DISC_COMPACT / DISC]) }] }));
  const titleStyle = useAnimatedStyle(() => ({ marginTop: interpolate(progress.value, [0, 1], [26, 10]) }));
  const subStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [1, 0, 0]),
    height: interpolate(progress.value, [0, 1], [subHeight.value, 0]),
    marginTop: interpolate(progress.value, [0, 1], [10, 0]),
  }));
  const boxStyle = useAnimatedStyle(() => ({ marginBottom: interpolate(progress.value, [0, 1], [30, 14]) }));

  return (
    <Animated.View style={[{ alignItems: 'center' }, boxStyle]}>
      {/* the heartbeat line runs edge to edge, past the screen gutter */}
      <Animated.View style={[{ marginHorizontal: -FIGMA_AUTH.screenPaddingX, alignItems: 'center', justifyContent: 'center' }, rowStyle]}>
        <Animated.View style={discStyle}>
          <HeartbeatDisc palette={p} dark={dark} disc={DISC} width={width} reduceMotion={reduceMotion} lineOpacity={lineOpacity} ripple={false} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[{ alignItems: 'center' }, titleStyle]}>
        {titleKind === 'wordmark' ? (
          <VelvetWordmark text={title} size={compact ? 26 : 32} palette={p} />
        ) : (
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: compact ? 22 : 26, lineHeight: compact ? 30 : 34, color: p.text, textAlign: 'center' }}>
            {title}
          </Text>
        )}
      </Animated.View>

      {subtitle ? (
        <Animated.View style={[{ overflow: 'hidden', alignSelf: 'stretch', alignItems: 'center' }, subStyle]}>
          <View>
            <Text
              onLayout={(e) => {
                subHeight.value = Math.ceil(e.nativeEvent.layout.height);
              }}
              style={{ maxWidth: 320, paddingHorizontal: 4, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 22, color: p.ink2 }}
            >
              {subtitle}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
