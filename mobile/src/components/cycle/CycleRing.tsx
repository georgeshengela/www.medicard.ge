import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  day: number | null;
  cycleLength: number;
  label: string;
  phaseHint?: string;
};

export function CycleRing({ day, cycleLength, label, phaseHint }: Props) {
  const c = useCycleColors();
  const size = 196;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const progress = day && cycleLength ? Math.min(1, Math.max(0, day / cycleLength)) : 0;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(progress, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress, anim]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - anim.value),
  }));

  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', width: '100%' }}>
      <View
        style={{
          width: size + 24,
          height: size + 24,
          borderRadius: (size + 24) / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
          ...cycleShadow.soft,
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: size - 32,
            height: size - 32,
            borderRadius: (size - 32) / 2,
            backgroundColor: c.roseSoft,
            opacity: 0.55,
          }}
        />
        <Svg width={size} height={size}>
          <Defs>
            <SvgGrad id="cycleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={c.blushDeep} />
              <Stop offset="55%" stopColor={c.rose} />
              <Stop offset="100%" stopColor={c.lavender} />
            </SvgGrad>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={c.creamDeep}
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#cycleGrad)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            animatedProps={animatedProps}
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
            width: size - 56,
          }}
        >
          <Text
            style={{
              color: c.muted,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            style={{
              color: c.ink,
              fontSize: 48,
              fontWeight: '800',
              letterSpacing: -2,
              marginTop: 2,
              lineHeight: 54,
            }}
          >
            {day ?? '—'}
          </Text>
          <Text style={{ color: c.mutedSoft, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
            / {cycleLength} დღე
          </Text>
        </View>
      </View>

      {phaseHint ? (
        <View
          style={{
            marginTop: 14,
            maxWidth: '92%',
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 24,
            ...cycleShadow.card,
          }}
        >
          <Text
            style={{
              color: c.rose,
              fontSize: 13,
              fontWeight: '800',
              textAlign: 'center',
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {phaseHint}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
