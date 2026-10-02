import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Salad } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import type { useNutritionDashboard } from '@/components/nutrition/ProgramUI';
import { MetricCardSkeleton } from '@/components/ui/Skeleton';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { tx } from '@/i18n/locale';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Nutrition in one row for layouts where it is not the lead (women's, active): the same numbers
 * and wording as the standard card (HomeNutritionCard), plus the camera shortcut into the diary.
 */
export function HomeNutritionLite({ nutrition }: { nutrition: ReturnType<typeof useNutritionDashboard> }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const features = useFeatureState();
  const photoOn = isFeatureOn('nutritionAi', features);
  const { data, loading } = nutrition;

  const eaten = data?.today.calories ?? 0;
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
    <View style={s.section}>
      <HomeSectionHeading title={tx('კვება', 'Nutrition')} linkLabel={tx('ყველა', 'All')} onLink={() => router.push('/nutrition' as never)} />
      {loading && !data ? (
        <MetricCardSkeleton />
      ) : (
        <View style={[s.card, { backgroundColor: c.surface }]}>
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
          {photoOn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx('გადაიღე კერძი — კამერა იხსნება და Medi კალორიებს დაითვლის', 'Snap a meal — the camera opens and Medi counts the calories')}
              onPress={() => router.push({ pathname: '/nutrition/diary', params: { method: 'camera' } } as never)}
              style={[s.camera, { backgroundColor: accent.cta }]}
            >
              <Camera size={20} color={accent.onCta} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  camera: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
