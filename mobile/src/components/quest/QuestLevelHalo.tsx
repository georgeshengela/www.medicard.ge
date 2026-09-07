import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** Figma 8853:146377 — 320px Nightingale score halo. Exact ring geometry from exported ellipses. */
const SIZE = 320;
const INNER = 160;
const BRAND = '#14B8A6';
const BADGE = '#22C55E';

type Props = {
  level: number;
  visible: boolean;
};

export function QuestLevelHalo({ level, visible }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const scale = useSharedValue(reduce ? 1 : 0.72);
  const spinB = useSharedValue(-15.65);
  const spinC = useSharedValue(-6.63);

  useEffect(() => {
    if (!visible) return;
    if (reduce) {
      scale.value = 1;
      spinB.value = -15.65;
      spinC.value = -6.63;
      return;
    }
    scale.value = 0.72;
    scale.value = withDelay(
      80,
      withSequence(
        withSpring(1.04, { damping: 12, stiffness: 220 }),
        withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      ),
    );
    spinB.value = -15.65;
    spinC.value = -6.63;
    spinB.value = withRepeat(withTiming(-15.65 + 360, { duration: 28000, easing: Easing.linear }), -1, false);
    spinC.value = withRepeat(withTiming(-6.63 - 360, { duration: 36000, easing: Easing.linear }), -1, false);
  }, [visible, reduce, scale, spinB, spinC]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const rotB = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinB.value}deg` }] }));
  const rotC = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinC.value}deg` }] }));

  const fill = dark ? QUEST.wash.dark : QUEST.wash.lightSoft;
  const ink = dark ? colors.primary100 : BRAND;

  return (
    <Animated.View
      style={[
        { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
        pop,
      ]}
    >
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 274.728, height: 274.728 }, rotC]}>
        <Svg width={274.728} height={274.728}>
          <Circle
            cx={137.364}
            cy={137.364}
            r={135.364}
            stroke={BRAND}
            strokeWidth={4}
            fill="none"
            opacity={0.08}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.5 24"
          />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 249.56, height: 249.56 }, rotB]}>
        <Svg width={249.56} height={249.56}>
          <Circle
            cx={124.78}
            cy={124.78}
            r={121.78}
            stroke={BRAND}
            strokeWidth={6}
            fill="none"
            opacity={0.24}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.5 16"
          />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', width: 220.5, height: 220.5 }}>
        <Svg width={220.5} height={220.5}>
          <Circle
            cx={110.25}
            cy={110.25}
            r={106.25}
            stroke={BRAND}
            strokeWidth={8}
            fill="none"
            opacity={0.32}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.5 16"
          />
        </Svg>
      </View>

      <View
        style={{
          width: INNER,
          height: INNER,
          borderRadius: INNER / 2,
          borderWidth: 1.25,
          borderColor: BRAND,
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#0F172A',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 75,
            lineHeight: 85,
            letterSpacing: -1,
            color: ink,
            textAlign: 'center',
            includeFontPadding: false,
            width: INNER - 16,
          }}
        >
          {String(level)}
        </Text>
        <View
          style={{
            position: 'absolute',
            right: -1.25,
            bottom: -1.25,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: BADGE,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        >
          <Svg width={25} height={25} viewBox="0 0 25 25">
            <Path
              d="M21.8434 6.21841C22.1485 5.91331 22.643 5.91331 22.9481 6.21841C23.2532 6.52351 23.2532 7.01806 22.9481 7.32314L9.92731 20.344C9.62223 20.6491 9.12768 20.649 8.82257 20.344L2.57257 14.094C2.26748 13.7889 2.26748 13.2943 2.57257 12.9892C2.87767 12.6841 3.37221 12.6841 3.67731 12.9892L9.37494 18.6869L21.8434 6.21841Z"
              fill="#FFFFFF"
            />
          </Svg>
        </View>
      </View>
    </Animated.View>
  );
}
