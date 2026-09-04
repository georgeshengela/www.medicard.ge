import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { ka } from '@/i18n/ka';

const STAGES = [ka.lab.waitScan, ka.lab.waitRead, ka.lab.waitNorm, ka.lab.waitStore] as const;

export function LabWaitingAnimation({
  stage,
  index = 0,
  total = 1,
}: {
  stage?: string;
  index?: number;
  total?: number;
}) {
  const T = useFigmaLab();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse, spin]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const drop = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.08]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.7, 1]),
  }));

  const [tick, setTick] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 2200);
    return () => clearInterval(id);
  }, []);
  const copy = stage || STAGES[tick % STAGES.length];

  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, gap: 16 }}>
      <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: 132, height: 132 }, ring]}>
          <Svg width={132} height={132} viewBox="0 0 132 132">
            <Circle cx="66" cy="66" r="58" stroke={T.brandSoft} strokeWidth="8" fill="none" />
            <Circle
              cx="66"
              cy="66"
              r="58"
              stroke={T.brand}
              strokeWidth="8"
              fill="none"
              strokeDasharray="90 280"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
        <Animated.View style={drop}>
          <Svg width={48} height={56} viewBox="0 0 21 26" fill="none">
            <Path
              d="M8.58 0.8C9.51 -0.27 11.16 -0.27 12.09 0.8L17.79 7.31C19.64 9.43 20.67 12.15 20.67 14.98C20.67 20.68 16.03 25.31 10.33 25.31C4.64 25.31 0 20.68 0 14.98C0 12.15 1.02 9.43 2.88 7.31L8.58 0.8Z"
              fill={T.brand}
            />
          </Svg>
        </Animated.View>
      </View>
      <OrbitDots color={T.brand} />
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 16,
          lineHeight: 22,
          color: T.textPrimary,
          textAlign: 'center',
        }}
      >
        {copy}
      </Text>
      {total > 1 ? (
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>
          {ka.lab.pageOf(index + 1, total)}
        </Text>
      ) : null}
    </View>
  );
}

function OrbitDots({ color }: { color: string }) {
  const a = useSharedValue(0);
  useEffect(() => {
    a.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
  }, [a]);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <AnimatedDot key={i} delay={i * 180} color={color} progress={a} />
      ))}
    </View>
  );
}

function AnimatedDot({
  delay,
  color,
  progress,
}: {
  delay: number;
  color: string;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate((progress.value + delay / 1800) % 1, [0, 0.5, 1], [0.25, 1, 0.25]),
    transform: [{ scale: interpolate((progress.value + delay / 1800) % 1, [0, 0.5, 1], [0.7, 1.15, 0.7]) }],
  }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

export function LabWaitHint() {
  const T = useFigmaLab();
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withDelay(400, withRepeat(withTiming(1, { duration: 1600 }), -1, true));
  }, [fade]);
  const style = useAnimatedStyle(() => ({ opacity: interpolate(fade.value, [0, 1], [0.45, 1]) }));
  return (
    <Animated.Text
      style={[
        {
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 13,
          lineHeight: 18,
          color: T.textSecondary,
          textAlign: 'center',
          paddingHorizontal: 24,
        },
        style,
      ]}
    >
      {ka.lab.waitHint}
    </Animated.Text>
  );
}
