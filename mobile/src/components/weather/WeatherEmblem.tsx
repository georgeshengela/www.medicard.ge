import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { Meteocon, meteoconSlugFor } from '@/components/weather/Meteocon';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { WeatherCondition, WeatherRecommendation } from '@/lib/weather';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  icon: WeatherCondition | WeatherRecommendation['icon'];
  isDay: boolean;
  accent: string;
  track: string;
  fill: string;
  score?: number | null;
  size?: number;
};

export function WeatherEmblem({ icon, isDay, accent, track, fill, score, size = 64 }: Props) {
  const slug = meteoconSlugFor(icon, isDay);
  const reduce = usePrefersReducedMotion();
  const stroke = size >= 72 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const inner = Math.round(size * 0.78);
  const progress = Math.max(0, Math.min(1, (score ?? 0) / 100));
  const anim = useSharedValue(reduce ? progress : 0);

  useEffect(() => {
    anim.value = reduce ? progress : withTiming(progress, { duration: 520 });
  }, [anim, progress, reduce]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - anim.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill={fill} />
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={accent}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            animatedProps={arcProps}
          />
        </G>
      </Svg>
      <Meteocon slug={slug} size={inner} />
    </View>
  );
}
