import React, { useEffect, useMemo } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#14B8A6', '#0D9488', '#99F6E4', '#FBBF24', '#F59E0B', '#F43F5E', '#BE123C'] as const;
const WIDTH = 375;
const HEIGHT = 375;

type Kind = 'ribbon' | 'dot' | 'star';

type Particle = {
  id: number;
  x: number;
  startY: number;
  color: string;
  kind: Kind;
  size: number;
  delay: number;
  duration: number;
  sway: number;
  spins: number;
};

function seedParticles(count: number): Particle[] {
  const kinds: Kind[] = ['ribbon', 'ribbon', 'dot', 'star'];
  return Array.from({ length: count }, (_, id) => {
    const kind = kinds[id % kinds.length];
    return {
      id,
      x: (id * 97 + 23) % WIDTH,
      startY: -30 - (id % 7) * 18,
      color: COLORS[id % COLORS.length],
      kind,
      size: kind === 'dot' ? 6 + (id % 4) : kind === 'star' ? 10 + (id % 5) : 8 + (id % 8),
      delay: (id % 12) * 90,
      duration: 2400 + (id % 8) * 220,
      sway: 16 + (id % 5) * 8,
      spins: kind === 'dot' ? 1 : 2 + (id % 3),
    };
  });
}

function ConfettiPiece({ particle }: { particle: Particle }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(1, { duration: particle.duration, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [particle.delay, particle.duration, t]);

  const style = useAnimatedStyle(() => {
    const progress = t.value;
    const fade = progress < 0.08 ? progress / 0.08 : progress > 0.82 ? (1 - progress) / 0.18 : 1;
    return {
      opacity: fade,
      transform: [
        { translateX: particle.x + Math.sin(progress * Math.PI * 2) * particle.sway },
        { translateY: particle.startY + progress * (HEIGHT + 40) },
        { rotate: `${progress * 360 * particle.spins}deg` },
      ],
    };
  });

  if (particle.kind === 'dot') {
    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: particle.size,
            height: particle.size,
            borderRadius: particle.size / 2,
            backgroundColor: particle.color,
          },
          style,
        ]}
      />
    );
  }

  if (particle.kind === 'star') {
    return (
      <Animated.View style={[{ position: 'absolute', width: particle.size, height: particle.size }, style]}>
        <View
          style={{
            position: 'absolute',
            width: particle.size,
            height: particle.size * 0.32,
            top: particle.size * 0.34,
            backgroundColor: particle.color,
            borderRadius: 1,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: particle.size * 0.32,
            height: particle.size,
            left: particle.size * 0.34,
            backgroundColor: particle.color,
            borderRadius: 1,
          }}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: particle.size * 0.35,
          height: particle.size * 1.6,
          borderRadius: 99,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

export function StepsGoalConfetti() {
  const scale = Math.min(1, Dimensions.get('window').width / WIDTH);
  const particles = useMemo(() => seedParticles(42), []);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HEIGHT * scale,
        overflow: 'hidden',
        alignItems: 'center',
      }}
    >
      <View style={{ width: WIDTH, height: HEIGHT, transform: [{ scale }] }}>
        {particles.map((particle) => (
          <ConfettiPiece key={particle.id} particle={particle} />
        ))}
      </View>
    </View>
  );
}
