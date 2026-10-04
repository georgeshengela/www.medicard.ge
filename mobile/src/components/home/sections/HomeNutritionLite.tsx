import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, Salad, Scale } from 'lucide-react-native';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { HomeWeightLogSheet } from '@/components/home/HomeWeightLogSheet';
import { useHomeWeight } from '@/components/home/sections/HomeWeightProgress';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import type { useNutritionDashboard } from '@/components/nutrition/ProgramUI';
import { MetricCardSkeleton } from '@/components/ui/Skeleton';
import { isFeatureOn, isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { tx } from '@/i18n/locale';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Nutrition in one row for layouts where it is not the lead (women's, active): the same numbers
 * and wording as the standard card (HomeNutritionCard), plus the camera shortcut into the diary.
 */
export function HomeNutritionLite({
  nutrition,
  bare = false,
  hub,
}: {
  nutrition: ReturnType<typeof useNutritionDashboard>;
  /** Inside another section (women's „შენი დღე“): no heading and no gutters of its own. */
  bare?: boolean;
  /**
   * The women's „შენი დღე“ (owner 2026-10-03): a small MEDIFOOD hub — its wordmark with „ჰაბი ›“ on
   * top, the day's calories, and her weight under them (weigh-in sheet without leaving Home).
   * `pregnant`: the weight row shows the weight only, never a goal or „მიზნამდე“.
   */
  hub?: { pregnant: boolean };
}) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const features = useFeatureState();
  const photoOn = isFeatureOn('nutritionAi', features);
  const { data, loading } = nutrition;
  const openCamera = () => router.push({ pathname: '/nutrition/diary', params: { method: 'camera' } } as never);
  const cameraLabel = tx('გადაიღე კერძი — კამერა იხსნება და Medi კალორიებს დაითვლის', 'Snap a meal — the camera opens and Medi counts the calories');
  const weight = useHomeWeight(nutrition);
  const weightOn = Boolean(hub) && isHrefAvailable('/health-metrics/weight', features);

  const eaten = data?.today?.calories ?? 0;
  const target = data?.budget ?? data?.targets?.calories ?? null;
  const meals = data?.mealCount ?? 0;
  const logged = meals > 0;
  const remaining = data?.remaining ?? null;
  const over = target != null && remaining != null && remaining < 0;
  const progress = target ? Math.min(1, eaten / target) : 0;

  const headline = logged
    ? target
      ? over
        ? tx(`${groupDigits(-remaining!)} კკალ ბიუჯეტზე მეტი`, `${groupDigits(-remaining!)} kcal over budget`)
        : tx(`${groupDigits(remaining!)} კკალ კიდევ შეგიძლია`, `${groupDigits(remaining!)} kcal left`)
      : tx(`${groupDigits(eaten)} კკალ დღეს`, `${groupDigits(eaten)} kcal today`)
    : tx('დღეს ჯერ არაფერი ჩაწერილა', 'Nothing logged today yet');
  const caption = logged
    ? target
      ? tx(`${groupDigits(eaten)} / ${groupDigits(target)} კკალ · ${meals} კვება`, `${groupDigits(eaten)} / ${groupDigits(target)} kcal · ${meals} ${meals === 1 ? 'meal' : 'meals'}`)
      : tx(`${meals} კვება`, `${meals} ${meals === 1 ? 'meal' : 'meals'}`)
    : photoOn
      ? tx('გადაიღე კერძი — Medi კალორიებსა და შემადგენლობას დაითვლის.', 'Snap a meal — Medi counts the calories and nutrients.')
      : tx('ჩაწერე დღის პირველი კვება.', "Log today's first meal.");

  return (
    <View style={bare ? s.bare : s.section}>
      {/* Standard (owner 2026-10-04): the hub card as its own section — the MEDIFOOD wordmark is the
          heading above the card (title, then content); inside „შენი დღე“ (bare) it sits in the card. */}
      {bare ? null : hub ? (
        <HomeSectionHeading title="MEDIFOOD" brand="food" linkLabel={tx('ჰაბი', 'Hub')} onLink={() => router.push('/nutrition' as never)} />
      ) : (
        <HomeSectionHeading title={tx('კვება', 'Nutrition')} linkLabel={tx('ყველა', 'All')} onLink={() => router.push('/nutrition' as never)} />
      )}
      {loading && !data ? (
        <MetricCardSkeleton />
      ) : (
        <View style={[s.card, hub ? s.hubCard : null, { backgroundColor: c.surface }]}>
          {hub && bare ? (
            <View style={s.hubHead}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('MEDIFOOD — კვების ჰაბის გახსნა', 'MEDIFOOD — open the nutrition hub')}
                onPress={() => router.push('/nutrition' as never)}
                style={s.hubLink}
              >
                <ModuleWordmark module="food" size={17} />
              </Pressable>
              <View style={s.hubActions}>
                {photoOn ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={cameraLabel} hitSlop={6} onPress={openCamera} style={[s.cameraSmall, { backgroundColor: accent.cta }]}>
                    <Camera size={16} color={accent.onCta} strokeWidth={2.2} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx('კვების ჰაბის გახსნა', 'Open the nutrition hub')}
                  hitSlop={6}
                  onPress={() => router.push('/nutrition' as never)}
                  style={s.hubLink}
                >
                  <Text style={[hubText.link, { color: accent.ink }]}>{tx('ჰაბი', 'Hub')}</Text>
                  <ChevronRight size={15} color={accent.ink} />
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={s.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(`${headline}. კვების დღიურის გახსნა`, `${headline}. Open food diary`)}
            onPress={() => router.push('/nutrition/diary' as never)}
            style={s.main}
          >
            <View style={[s.icon, { backgroundColor: accent.tint }]}>
              <Salad size={21} color={accent.ink} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100 }]}>{headline}</Text>
              <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{caption}</Text>
              {target ? (
                <View style={[s.track, { backgroundColor: c.bg200 }]}>
                  <View style={[s.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: accent.ink }]} />
                </View>
              ) : null}
            </View>
          </Pressable>
          {photoOn && !(hub && bare) ? (
            <Pressable accessibilityRole="button" accessibilityLabel={cameraLabel} onPress={openCamera} style={[s.camera, { backgroundColor: accent.cta }]}>
              <Camera size={20} color={accent.onCta} strokeWidth={2} />
            </Pressable>
          ) : null}
          </View>
          {weightOn && hub && weight.ready ? <WeightRow weight={weight} pregnant={hub.pregnant} /> : null}
        </View>
      )}
    </View>
  );
}

const kg = (n: number) => n.toFixed(1);

/** Her weight in one line under the calories: kg, the goal in words, a thin bar and „აწონვა“. */
function WeightRow({ weight, pregnant }: { weight: ReturnType<typeof useHomeWeight>; pregnant: boolean }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const { current, view, sheetOpen, setSheetOpen, onSaved, healthProfile } = weight;
  const goalText =
    pregnant || !view
      ? null
      : view.kind === 'progress'
        ? tx(`მიზნამდე ${kg(view.remainingKg)} კგ`, `${kg(view.remainingKg)} kg to goal`)
        : view.kind === 'reached'
          ? tx('მიზანს მიაღწიე', 'Goal reached')
          : view.kind === 'maintain'
            ? tx(`შენარჩუნება · ${kg(view.targetKg)} კგ`, `Maintaining · ${kg(view.targetKg)} kg`)
            : null;
  const percent = !pregnant && view ? (view.kind === 'progress' ? view.percent : view.kind === 'reached' ? 100 : null) : null;
  return (
    <>
      <View style={[s.divider, { backgroundColor: c.bg200 }]} />
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[current ? tx(`წონა ${kg(current.kg)} კილოგრამი`, `Weight ${kg(current.kg)} kilograms`) : tx('წონა', 'Weight'), goalText]
            .filter(Boolean)
            .join('. ')}
          onPress={() => router.push('/health-metrics/weight' as never)}
          style={s.main}
        >
          <View style={[s.icon, { backgroundColor: accent.tint }]}>
            <Scale size={20} color={accent.ink} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>
              {current ? (
                <>
                  {kg(current.kg)}
                  <Text style={[hubText.caption, { color: c.text200 }]}>{` ${tx('კგ', 'kg')}`}</Text>
                  {goalText ? <Text style={[hubText.caption, { color: c.text200 }]}>{` · ${goalText}`}</Text> : null}
                </>
              ) : (
                tx('წონა', 'Weight')
              )}
            </Text>
            {percent != null ? (
              <View style={[s.track, { backgroundColor: c.bg200 }]}>
                <View style={[s.fill, { width: `${Math.round(percent)}%`, backgroundColor: accent.ink }]} />
              </View>
            ) : !current ? (
              <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
                {tx('აიწონე — პროგრესს აქ ნახავ.', 'Weigh in to see your progress here.')}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('წონის ჩაწერა', 'Log your weight')}
          onPress={() => setSheetOpen(true)}
          style={[s.weighIn, { backgroundColor: accent.soft }]}
        >
          <Text style={[hubText.link, { color: accent.ink }]}>{tx('აწონვა', 'Weigh in')}</Text>
        </Pressable>
      </View>
      <HomeWeightLogSheet
        visible={sheetOpen}
        profile={healthProfile}
        initialKg={current?.kg ?? healthProfile?.weightKg ?? 70}
        onClose={() => setSheetOpen(false)}
        onSaved={onSaved}
      />
    </>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  bare: { marginTop: 12 },
  card: { borderRadius: HUB.cardRadius, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  hubCard: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  hubHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  hubLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  hubActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cameraSmall: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: HUB.tile + 14 },
  weighIn: { minHeight: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  camera: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
