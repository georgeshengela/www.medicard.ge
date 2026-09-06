import React, { useEffect } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0–100, XP progress inside the current level. */
  percent: number;
  /** Center label — usually the level number. */
  label: string;
  /** Tiny caption under the number (e.g. "დონე"). Omit on small rings. */
  caption?: string;
  size?: number;
  stroke?: number;
  /** Delay before the arc sweeps in (for staggered hero reveals). */
  delay?: number;
  /** Fill the disc with the brand wash so it reads as a badge. */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Nightingale circular progress (64px track, 6px stroke, round caps) with the
 * level number in the center. The arc sweeps from 0 to `percent` on mount and
 * eases to the new value whenever XP changes.
 */
export function QuestLevelRing({
  percent,
  label,
  caption,
  size = QUEST.ringHome,
  stroke,
  delay = 0,
  filled = true,
  style,
  accessibilityLabel,
}: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const sw = stroke ?? (size >= 96 ? 8 : 6);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const inner = size - sw * 2 - 6;
  const target = Math.max(0, Math.min(1, percent / 100));
  const anim = useSharedValue(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      anim.value = target;
      return;
    }
    anim.value = withDelay(
      delay,
      withTiming(target, { duration: QUEST.motion.slow + 200, easing: Easing.out(Easing.cubic) }),
    );
  }, [anim, target, reduce, delay]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - anim.value),
  }));

  const numberSize = size >= 120 ? 44 : size >= 96 ? 34 : 22;
  const numberLine = size >= 120 ? 50 : size >= 96 ? 40 : 26;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.bg300} strokeWidth={sw} fill="none" />
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.primary200}
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            animatedProps={arcProps}
          />
        </G>
      </Svg>
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: filled ? (dark ? QUEST.wash.dark : QUEST.wash.lightSoft) : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: numberSize,
            lineHeight: numberLine,
            letterSpacing: -0.5,
            color: colors.primary100,
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
        {caption && size >= 96 ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 10,
              lineHeight: 14,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: colors.text300,
              marginTop: -2,
            }}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
