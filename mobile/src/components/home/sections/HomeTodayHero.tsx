import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, RadialGradient, Stop } from 'react-native-svg';
import { Camera, ChevronRight, Droplets, FlaskConical, Footprints, Pill, Plus, Scale, type LucideIcon } from 'lucide-react-native';
import { HomeWeightLogSheet } from '@/components/home/HomeWeightLogSheet';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { isFeatureOn, isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import type { TodayAnswer } from '@/lib/home/todayAnswer';
import { tx } from '@/i18n/locale';
import { useAuth } from '@/store/AuthContext';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const STROKE = 12;
const GAP = 4;

export type TodayDial = {
  key: 'steps' | 'water' | 'meds';
  /** 0..1 */
  progress: number;
  value: string;
  label: string;
  onPress: () => void;
  a11y: string;
};

/** Ring gradients (start → end) and the ink used for the legend, per theme. */
function ringTones(dark: boolean): Record<TodayDial['key'], { from: string; to: string; ink: string }> {
  return dark
    ? {
        steps: { from: '#14B8A6', to: '#5EEAD4', ink: '#2DD4BF' },
        water: { from: '#3B82F6', to: '#7DD3FC', ink: '#60A5FA' },
        meds: { from: '#8B5CF6', to: '#C4B5FD', ink: '#A78BFA' },
      }
    : {
        steps: { from: '#0D9488', to: '#2DD4BF', ink: '#0F766E' },
        water: { from: '#2563EB', to: '#38BDF8', ink: '#2563EB' },
        meds: { from: '#7C3AED', to: '#A78BFA', ink: '#7C3AED' },
      };
}

const ICONS: Record<TodayDial['key'], LucideIcon> = { steps: Footprints, water: Droplets, meds: Pill };

/**
 * The standard Home's hero (owner 2026-10-04, built for men first). Sits on the canvas like the women's
 * hero (no outer card): one big answer — the single thing worth doing now (`todayAnswer`) — then the
 * day as Apple-style concentric rings (gradient strokes on tinted tracks, a soft glow behind) with a
 * tappable legend, and one row of one-tap actions, because men keep using a health app when logging
 * costs one tap. Every ring and action follows its module's admin switch.
 */
export function HomeTodayHero({
  answer,
  dials,
  onAddWater,
  onWeightSaved,
}: {
  answer: TodayAnswer;
  dials: TodayDial[];
  onAddWater?: () => void;
  onWeightSaved: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = useHomeAccent();
  const router = useRouter();
  const features = useFeatureState();
  const { healthProfile } = useAuth();
  const { width } = useWindowDimensions();
  const [weighIn, setWeighIn] = useState(false);
  const tones = ringTones(dark);
  const ringSize = width < 360 ? 112 : 136;

  const actions: { key: string; label: string; a11y: string; icon: LucideIcon; ink: string; onPress: () => void }[] = [];
  if (onAddWater) {
    actions.push({ key: 'water', label: tx('ჭიქა წყალი', 'Glass'), a11y: tx('წყლის ჭიქის დამატება', 'Add a glass of water'), icon: Droplets, ink: tones.water.ink, onPress: onAddWater });
  }
  if (isHrefAvailable('/health-metrics/weight', features)) {
    actions.push({ key: 'weight', label: tx('აწონვა', 'Weigh in'), a11y: tx('წონის ჩაწერა', 'Log your weight'), icon: Scale, ink: accent.ink, onPress: () => setWeighIn(true) });
  }
  if (isFeatureOn('nutrition', features) && isFeatureOn('nutritionAi', features)) {
    actions.push({
      key: 'meal',
      label: tx('კერძი', 'Meal'),
      a11y: tx('კერძის ფოტო — Medi კალორიებს დაითვლის', 'Meal photo — Medi counts the calories'),
      icon: Camera,
      ink: dark ? '#34D399' : '#047857',
      onPress: () => router.push({ pathname: '/nutrition/diary', params: { method: 'camera' } } as never),
    });
  }
  if (isHrefAvailable('/scan?type=lab', features)) {
    actions.push({ key: 'lab', label: tx('ანალიზი', 'Lab test'), a11y: tx('ანალიზის ფოტო — MEDISCAN', 'Lab sheet photo — MEDISCAN'), icon: FlaskConical, ink: dark ? '#A5B4FC' : '#4F46E5', onPress: () => router.push('/scan?type=lab' as never) });
  }

  return (
    <View style={s.section}>
      <View accessible accessibilityRole="header" accessibilityLabel={`${answer.title}. ${answer.caption}`} style={s.answer}>
        <View style={s.kickerRow}>
          <View style={[s.kickerDot, { backgroundColor: accent.ink }]} />
          <Text style={[s.kicker, { color: accent.ink }]}>{tx('დღეს', 'Today')}</Text>
        </View>
        <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.title, { color: c.text100 }]}>
          {answer.title}
        </Text>
        <Text numberOfLines={2} style={[s.caption, { color: c.text200 }]}>
          {answer.caption}
        </Text>
      </View>

      {dials.length ? (
        <View style={[s.panel, { backgroundColor: c.surface }]}>
          <Rings dials={dials} size={ringSize} tones={tones} glow={accent.ink} />
          <View style={s.legend}>
            {dials.map((dial, index) => {
              const Icon = ICONS[dial.key];
              const ink = tones[dial.key].ink;
              return (
                <Pressable
                  key={dial.key}
                  accessibilityRole="button"
                  accessibilityLabel={dial.a11y}
                  onPress={dial.onPress}
                  style={[s.legendRow, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 } : null]}
                >
                  <View style={[s.legendIcon, { backgroundColor: `${ink}${dark ? '2E' : '17'}` }]}>
                    <Icon size={14} color={ink} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.legendValue, { color: c.text100 }]}>
                      {dial.value}
                    </Text>
                    <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{dial.label}</Text>
                  </View>
                  <ChevronRight size={15} color={c.text300} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {actions.length ? (
        <View style={s.actions}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={action.a11y}
                onPress={action.onPress}
                style={[s.action, { backgroundColor: c.surface }]}
              >
                <View style={[s.actionIcon, { backgroundColor: `${action.ink}${dark ? '2E' : '17'}` }]}>
                  <Icon size={17} color={action.ink} strokeWidth={2.1} />
                  {action.key === 'water' ? (
                    <View style={[s.plus, { backgroundColor: action.ink, borderColor: c.surface }]}>
                      <Plus size={8} color="#FFFFFF" strokeWidth={3.4} />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={[s.actionLabel, { color: c.text100 }]}>{action.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <HomeWeightLogSheet
        visible={weighIn}
        profile={healthProfile}
        initialKg={healthProfile?.weightKg ?? 75}
        onClose={() => setWeighIn(false)}
        onSaved={onWeightSaved}
      />
    </View>
  );
}

/** Concentric rings: gradient strokes with round caps on tracks tinted in their own colour, a soft glow behind. */
function Rings({ dials, size, tones, glow }: {
  dials: TodayDial[];
  size: number;
  tones: ReturnType<typeof ringTones>;
  glow: string;
}) {
  const dark = useIsDark();
  const outer = (size - STROKE) / 2;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="todayGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={dark ? 0.22 : 0.12} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
          {dials.map((dial) => (
            <SvgGradient key={dial.key} id={`ring-${dial.key}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={tones[dial.key].from} />
              <Stop offset="1" stopColor={tones[dial.key].to} />
            </SvgGradient>
          ))}
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#todayGlow)" />
      </Svg>
      {dials.map((dial, index) => (
        <Ring
          key={dial.key}
          size={size}
          radius={outer - index * (STROKE + GAP)}
          gradientId={`ring-${dial.key}`}
          track={`${tones[dial.key].ink}${dark ? '33' : '1F'}`}
          progress={dial.progress}
          delay={index * 140}
        />
      ))}
    </View>
  );
}

function Ring({ size, radius, gradientId, track, progress, delay }: {
  size: number;
  radius: number;
  gradientId: string;
  track: string;
  progress: number;
  delay: number;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const circumference = 2 * Math.PI * radius;
  const value = Math.min(1, Math.max(0, progress));
  const shown = useSharedValue(reduceMotion ? value : 0);
  useEffect(() => {
    shown.value = reduceMotion ? value : withDelay(delay, withTiming(value, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [delay, value, reduceMotion, shown]);
  // A started ring always shows a dot of colour, so a tiny value still reads as "begun".
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - (shown.value > 0 ? Math.max(shown.value, 0.012) : 0)),
  }));
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: 20, gap: 14 },
  answer: { gap: 4 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerDot: { width: 6, height: 6, borderRadius: 3 },
  kicker: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 17, letterSpacing: 0.3 },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, lineHeight: 36, letterSpacing: -0.6 },
  caption: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19 },
  panel: { borderRadius: HUB.cardRadius, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, minWidth: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 4 },
  legendIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  legendValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minHeight: 68, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  actionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15 },
});
