import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { weatherIconFor } from '@/components/weather/weatherIcons';
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

export function WeatherEmblem({ icon, isDay, accent, track, fill, score, size = 52 }: Props) {
  const Icon = weatherIconFor(icon, isDay);
  const reduce = usePrefersReducedMotion();
  const stroke = size >= 64 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const inner = Math.round(size * 0.7);
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
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
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
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={Math.round(size * 0.34)} color={accent} strokeWidth={2.15} />
      </View>
    </View>
  );
}
