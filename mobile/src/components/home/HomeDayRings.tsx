import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Droplets, Footprints, Pill, Plus, type LucideIcon } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Home hero: the welcome screen's concentric rings, made useful.
 * Each ring is one thing the person can still do today; every row is a
 * destination and the water row logs a glass without leaving Home.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 116;
const STROKE = 11;
const GAP = 3;
const FILL_MS = 900;

export type DayRing = {
  key: 'steps' | 'water' | 'meds';
  /** 0..1, already clamped by the caller. */
  progress: number;
  label: string;
  value: string;
  hint?: string;
  onPress: () => void;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
};

const ICONS: Record<DayRing['key'], LucideIcon> = { steps: Footprints, water: Droplets, meds: Pill };

function ringPalette(dark: boolean): Record<DayRing['key'], string> {
  return dark
    ? { steps: '#2DD4BF', water: '#60A5FA', meds: '#A78BFA' }
    : { steps: '#14B8A6', water: '#3B82F6', meds: '#7C3AED' };
}

function Ring({
  radius,
  color,
  track,
  progress,
  delay,
  reduceMotion,
}: {
  radius: number;
  color: string;
  track: string;
  progress: number;
  delay: number;
  reduceMotion: boolean;
}) {
  const circumference = 2 * Math.PI * radius;
  const shown = useSharedValue(reduceMotion ? progress : 0);

  useEffect(() => {
    shown.value = reduceMotion
      ? progress
      : withDelay(delay, withTiming(progress, { duration: FILL_MS, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress, reduceMotion, shown]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shown.value),
  }));

  return (
    <>
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={radius} stroke={track} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </>
  );
}

export function HomeDayRings({ rings }: { rings: DayRing[] }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const reduceMotion = usePrefersReducedMotion();
  const palette = ringPalette(dark);
  const outer = SIZE / 2 - STROKE / 2;

  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ width: SIZE, height: SIZE }}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {rings.map((ring, index) => (
            <Ring
              key={ring.key}
              radius={outer - index * (STROKE + GAP)}
              color={palette[ring.key]}
              track={c.bg200}
              progress={Math.min(1, Math.max(0, ring.progress))}
              delay={index * 120}
              reduceMotion={reduceMotion}
            />
          ))}
        </Svg>
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {rings.map((ring, index) => {
          const Icon = ICONS[ring.key];
          const color = palette[ring.key];
          return (
            <View
              key={ring.key}
              style={[
                s.row,
                index ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.bg300 } : null,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${ring.label}: ${ring.value}${ring.hint ? `, ${ring.hint}` : ''}`}
                onPress={ring.onPress}
                style={s.rowMain}
              >
                <Icon size={16} color={color} strokeWidth={2.2} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[s.value, { color: c.text100 }]}>
                    {ring.value}
                  </Text>
                  <Text numberOfLines={1} style={[s.label, { color: c.text200 }]}>
                    {ring.hint ?? ring.label}
                  </Text>
                </View>
              </Pressable>
              {ring.onQuickAdd ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={ring.quickAddLabel ?? ring.label}
                  hitSlop={8}
                  onPress={ring.onQuickAdd}
                  style={[s.quickAdd, { backgroundColor: dark ? '#1E3A5F' : '#DBEAFE' }]}
                >
                  <Plus size={17} color={color} strokeWidth={2.4} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  value: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 15,
    lineHeight: 21,
  },
  label: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  quickAdd: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
