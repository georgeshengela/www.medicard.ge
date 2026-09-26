import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Beef, BookOpen, Camera, Droplet, Flame, Salad, Wheat, type LucideIcon } from 'lucide-react-native';
import { useNutritionDashboard } from '@/components/nutrition/ProgramUI';
import { MetricCardSkeleton } from '@/components/ui/Skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 92;
const STROKE = 10;
const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Energy ring: eaten against the daily target, filling once on mount like the day rings. */
function EnergyRing({ progress, color, track, reduceMotion }: { progress: number; color: string; track: string; reduceMotion: boolean }) {
  const r = RING / 2 - STROKE / 2;
  const circumference = 2 * Math.PI * r;
  const shown = useSharedValue(reduceMotion ? progress : 0);
  useEffect(() => {
    shown.value = reduceMotion
      ? progress
      : withDelay(200, withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduceMotion, shown]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.value) }));
  return (
    <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
      <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={RING / 2}
        cy={RING / 2}
        r={r}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
      />
    </Svg>
  );
}

type Macro = { key: string; label: string; icon: LucideIcon; ink: HubInk; value: number; target: number | null };

function MacroChip({ macro }: { macro: Macro }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = hubInk(macro.ink, dark);
  const ratio = macro.target ? Math.min(1, macro.value / macro.target) : 0;
  return (
    <View style={[s.macro, { backgroundColor: c.bg100 }]}>
      <View style={s.macroHead}>
        <View style={[s.macroIcon, { backgroundColor: hubTint(ink, dark) }]}>
          <macro.icon size={14} color={ink} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={1} style={[hubText.small, { color: c.text200, flex: 1 }]}>
          {macro.label}
        </Text>
      </View>
      <Text numberOfLines={1} style={[hubText.value, { color: c.text100, fontSize: 14, lineHeight: 20 }]}>
        {Math.round(macro.value)}
        <Text style={[hubText.small, { color: c.text300 }]}>{macro.target ? ` / ${Math.round(macro.target)} გ` : ' გ'}</Text>
      </Text>
      {macro.target ? (
        <View style={[s.macroTrack, { backgroundColor: c.bg300 }]}>
          <View style={[s.macroFill, { width: `${ratio * 100}%`, backgroundColor: ink }]} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Nutrition on Home the way Cal AI frames it: one ring for today's energy,
 * three macros with their own colour, and a camera button you cannot miss.
 */
export function HomeNutritionCard() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();
  const { data, loading } = useNutritionDashboard();
  const energyInk = hubInk('amber', dark);

  if (loading && !data) return <MetricCardSkeleton />;

  const eaten = data?.today.calories ?? 0;
  const target = data?.targets?.calories ?? null;
  const logged = (data?.mealCount ?? 0) > 0;
  const remaining = data?.remaining ?? null;
  const over = target != null && remaining != null && remaining < 0;
  const progress = target ? Math.min(1, eaten / target) : logged ? 1 : 0;

  const macros: Macro[] = [
    { key: 'protein', label: 'ცილა', icon: Beef, ink: 'rose', value: data?.today.protein ?? 0, target: data?.targets?.protein ?? null },
    { key: 'carbs', label: 'ნახშ.', icon: Wheat, ink: 'amber', value: data?.today.carbs ?? 0, target: data?.targets?.carbs ?? null },
    { key: 'fat', label: 'ცხიმი', icon: Droplet, ink: 'sky', value: data?.today.fat ?? 0, target: data?.targets?.fat ?? null },
  ];

  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <View style={s.top}>
        <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <EnergyRing progress={progress} color={logged ? energyInk : c.bg300} track={c.bg200} reduceMotion={reduceMotion} />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {logged ? (
                <>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 18, lineHeight: 22 }]}>
                    {groupDigits(target != null && remaining != null ? Math.abs(remaining) : eaten)}
                  </Text>
                  <Text style={[hubText.small, { color: c.text300, fontSize: 10, lineHeight: 13 }]}>
                    {target != null ? (over ? 'ზევით' : 'დარჩა') : 'კკალ'}
                  </Text>
                </>
              ) : (
                <Salad size={30} color={energyInk} strokeWidth={1.7} />
              )}
            </View>
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Flame size={15} color={energyInk} strokeWidth={2.2} />
            <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
              {logged && data ? `დღეს · ${data.mealCount} კვება` : 'დღეს'}
            </Text>
          </View>
          <Text numberOfLines={1} style={[hubText.value, { color: c.text100, fontSize: 19, lineHeight: 26 }]}>
            {logged
              ? target
                ? `${groupDigits(eaten)} / ${groupDigits(target)} კკალ`
                : `${groupDigits(eaten)} კკალ`
              : 'ჯერ არაფერი ჩაწერილა'}
          </Text>
          <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
            {logged
              ? target
                ? over
                  ? `სამიზნეზე ${groupDigits(-remaining!)} კკალ-ით მეტი`
                  : `მიზნამდე ${groupDigits(remaining!)} კკალ`
                : 'აირჩიე მიზანი და დღიური სამიზნე გამოჩნდება'
              : 'გადაიღე კერძი — მედი კალორიებსა და შემადგენლობას დაითვლის'}
          </Text>
        </View>
      </View>

      {logged ? (
        <View style={s.macros}>
          {macros.map((macro) => (
            <MacroChip key={macro.key} macro={macro} />
          ))}
        </View>
      ) : null}

      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="გადაიღე კერძი და დაითვალე კალორიები"
          onPress={() => router.push('/nutrition/diary' as never)}
          style={[s.primary, { backgroundColor: dark ? '#0D9488' : '#0F766E' }]}
        >
          <Camera size={20} color="#FFFFFF" strokeWidth={2} />
          <Text style={[hubText.link, { color: '#FFFFFF', fontSize: 14 }]}>გადაიღე კერძი</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="კვების დღიური და გეგმა"
          onPress={() => router.push('/nutrition' as never)}
          style={[s.secondary, { backgroundColor: c.bg200 }]}
        >
          <BookOpen size={19} color={c.text100} strokeWidth={1.9} />
          <Text style={[hubText.link, { color: c.text100 }]}>დღიური</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  macros: { flexDirection: 'row', gap: 8 },
  macro: { flex: 1, minWidth: 0, borderRadius: 16, padding: 10, gap: 6 },
  macroHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  macroIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  macroTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  macroFill: { height: 4, borderRadius: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
