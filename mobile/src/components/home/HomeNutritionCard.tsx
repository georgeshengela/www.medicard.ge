import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Beef, ChevronRight, Droplet, Droplets, Flame, Footprints, Salad, Wheat, type LucideIcon } from 'lucide-react-native';
import { useNutritionDashboard } from '@/components/nutrition/ProgramUI';
import { QuickLogTiles } from '@/components/nutrition/NutritionUi';
import { MetricCardSkeleton } from '@/components/ui/Skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { mealLabels } from '@/lib/nutrition';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 96;
const STROKE = 10;
const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Energy ring: eaten against the daily budget, filling once on mount like the day rings. */
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
 * Nutrition on Home: the day in one glance (ring, macros, water / steps /
 * streak), then the four ways to log — each a single tap that lands in the
 * diary with that method already open. Nothing here needs explaining.
 */
export function HomeNutritionCard({ waterMl, waterGoalMl, steps }: { waterMl?: number; waterGoalMl?: number; steps?: number } = {}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();
  const { data, loading } = useNutritionDashboard();
  const energyInk = hubInk('amber', dark);
  const tealInk = hubInk('teal', dark);

  if (loading && !data) return <MetricCardSkeleton />;

  const eaten = data?.today.calories ?? 0;
  const target = data?.budget ?? data?.targets?.calories ?? null;
  const logged = (data?.mealCount ?? 0) > 0;
  const remaining = data?.remaining ?? null;
  const over = target != null && remaining != null && remaining < 0;
  const progress = target ? Math.min(1, eaten / target) : logged ? 1 : 0;
  const water = waterMl ?? data?.water.ml ?? 0;
  const waterGoal = waterGoalMl ?? data?.water.goalMl ?? null;
  const stepCount = steps ?? data?.steps ?? 0;
  const streak = data?.streak.current ?? 0;

  const macros: Macro[] = [
    { key: 'protein', label: 'ცილა', icon: Beef, ink: 'rose', value: data?.today.protein ?? 0, target: data?.targets?.protein ?? null },
    { key: 'carbs', label: 'ნახშ.', icon: Wheat, ink: 'amber', value: data?.today.carbs ?? 0, target: data?.targets?.carbs ?? null },
    { key: 'fat', label: 'ცხიმი', icon: Droplet, ink: 'sky', value: data?.today.fat ?? 0, target: data?.targets?.fat ?? null },
  ];
  const days = [
    { key: 'water', icon: Droplets, ink: hubInk('sky', dark), value: waterGoal ? `${(water / 1000).toFixed(1)} / ${(waterGoal / 1000).toFixed(1)} ლ` : `${(water / 1000).toFixed(1)} ლ`, label: 'წყალი', href: '/health-metrics/hydration' },
    { key: 'steps', icon: Footprints, ink: hubInk('green', dark), value: groupDigits(stepCount), label: 'ნაბიჯი', href: '/health-metrics/steps' },
    { key: 'streak', icon: Flame, ink: tealInk, value: streak ? `${streak} დღე` : 'დაიწყე', label: 'სერია', href: '/nutrition' },
  ];
  const headline = logged
    ? target
      ? over
        ? `${groupDigits(-remaining!)} კკალ ბიუჯეტზე მეტი`
        : `${groupDigits(remaining!)} კკალ კიდევ შეგიძლია`
      : `${groupDigits(eaten)} კკალ დღეს`
    : 'დღეს ჯერ არაფერი ჩაწერილა';
  const caption = logged
    ? target
      ? `${groupDigits(eaten)} / ${groupDigits(target)} კკალ · ${data!.mealCount} კვება`
      : `${data!.mealCount} კვება · მიზანს აირჩევ და ბიუჯეტიც გამოჩნდება`
    : 'გადაიღე, დაასკანერე ან უბრალოდ თქვი — Medi დაითვლის.';

  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${headline}. კვების დღიურის გახსნა`} onPress={() => router.push('/nutrition/diary' as never)} style={s.top}>
        <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <EnergyRing progress={progress} color={logged ? energyInk : c.bg300} track={c.bg200} reduceMotion={reduceMotion} />
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {logged ? (
                <>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 19, lineHeight: 24 }]}>
                    {groupDigits(target != null && remaining != null ? Math.abs(remaining) : eaten)}
                  </Text>
                  <Text style={[hubText.small, { color: c.text300, fontSize: 10, lineHeight: 13 }]}>
                    {target != null ? (over ? 'ზევით' : 'დარჩა') : 'კკალ'}
                  </Text>
                </>
              ) : (
                <Salad size={32} color={energyInk} strokeWidth={1.6} />
              )}
            </View>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, fontSize: 17, lineHeight: 24 }]}>{headline}</Text>
          <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{caption}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
            <Text style={[hubText.link, { color: c.primary100, fontSize: 12 }]}>დღიურის გახსნა</Text>
            <ChevronRight size={14} color={c.primary100} />
          </View>
        </View>
      </Pressable>

      {logged ? (
        <View style={s.macros}>
          {macros.map((macro) => (
            <MacroChip key={macro.key} macro={macro} />
          ))}
        </View>
      ) : null}

      <View style={[s.days, { backgroundColor: c.bg100 }]}>
        {days.map((day, index) => (
          <Pressable key={day.key} accessibilityRole="button" accessibilityLabel={`${day.label}: ${day.value}`} onPress={() => router.push(day.href as never)} style={[s.day, index > 0 && { borderLeftWidth: 1, borderLeftColor: c.bg300 }]}>
            <View style={[s.dayIcon, { backgroundColor: hubTint(day.ink, dark) }]}>
              <day.icon size={14} color={day.ink} strokeWidth={2.2} />
            </View>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text numberOfLines={1} style={[hubText.value, { color: c.text100, fontSize: 13, lineHeight: 18 }]}>{day.value}</Text>
              <Text numberOfLines={1} style={[hubText.small, { color: c.text300, fontSize: 10, lineHeight: 13 }]}>{day.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {data && data.todayMeals.length > 0 ? (
        <View style={{ gap: 2 }}>
          {data.todayMeals.slice(0, 3).map((meal) => (
            <Pressable key={meal.id} accessibilityRole="button" accessibilityLabel={`${mealLabels[meal.type]} · ${Math.round(meal.totals.calories)} კკალ`} onPress={() => router.push('/nutrition/diary' as never)} style={s.meal}>
              <Text style={[hubText.small, { color: c.text300, width: 64 }]}>{mealLabels[meal.type]}</Text>
              <Text numberOfLines={1} style={[hubText.body, { color: c.text100, flex: 1 }]}>{meal.title || meal.names.join(' · ')}</Text>
              <Text style={[hubText.value, { color: c.text100, fontSize: 13 }]}>{groupDigits(meal.totals.calories)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={[hubText.small, { color: c.text300, textTransform: 'uppercase', letterSpacing: 0.6 }]}>ჩაწერე ერთი შეხებით</Text>
        <QuickLogTiles />
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
  days: { flexDirection: 'row', borderRadius: 16, paddingVertical: 8 },
  day: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, minHeight: 40 },
  dayIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  meal: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
});
