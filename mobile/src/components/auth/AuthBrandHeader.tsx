import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { FIGMA_AUTH, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

type Props = {
  subtitle: string;
  /** Keyboard-open density — Figma 48px mark, hide subtitle. */
  compact?: boolean;
  durationMs?: number;
};

const LOGO_REST = FIGMA_AUTH.heroLogoSize;
const LOGO_FOCUS = 48;
const WORD_REST = 38;
const WORD_FOCUS = 28;
const KEYBOARD_EASE = Easing.bezier(0.17, 0.59, 0.4, 0.77);

/** Nightingale auth hero — plain teal mark, wordmark, subtitle (no tile). */
export function AuthBrandHeader({ subtitle, compact = false, durationMs = 280 }: Props) {
  const auth = useFigmaAuth();
  const reduceMotion = usePrefersReducedMotion();
  const progress = useSharedValue(compact ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = compact ? 1 : 0;
      return;
    }
    progress.value = withTiming(compact ? 1 : 0, { duration: durationMs, easing: KEYBOARD_EASE });
  }, [compact, durationMs, progress, reduceMotion]);

  const heroStyle = useAnimatedStyle(() => ({
    marginBottom: interpolate(progress.value, [0, 1], [FIGMA_AUTH.heroBottom, 10]),
  }));

  const logoBoxStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [LOGO_REST, LOGO_FOCUS]);
    return { width: size, height: size };
  });

  const logoScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, LOGO_FOCUS / LOGO_REST]) }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    marginTop: interpolate(progress.value, [0, 1], [20, 8]),
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [1, 0, 0]),
    height: interpolate(progress.value, [0, 1], [38, 0]),
    marginTop: interpolate(progress.value, [0, 1], [FIGMA_AUTH.heroGap, 0]),
  }));

  const wordSize = compact ? WORD_FOCUS : WORD_REST;

  return (
    <Animated.View style={[{ alignItems: 'center' }, heroStyle]}>
      <Animated.View
        style={[{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, logoBoxStyle]}
      >
        <Animated.View style={logoScaleStyle}>
          <BrandLogo size={LOGO_REST} variant="plain" />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[{ alignItems: 'center' }, wordStyle]}>
        <BrandWordmark
          size={wordSize}
          style={{
            includeFontPadding: false,
            lineHeight: Math.round(wordSize * 1.4),
            textAlign: 'center',
            paddingHorizontal: 4,
          }}
        />
      </Animated.View>
      <Animated.View style={[{ overflow: 'hidden', alignItems: 'center' }, subStyle]}>
        <Text
          className="max-w-[320px] text-center font-sans"
          style={{
            fontSize: FIGMA_AUTH.heroSubtitleSize,
            lineHeight: 22,
            color: auth.textSecondary,
          }}
        >
          {subtitle}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
