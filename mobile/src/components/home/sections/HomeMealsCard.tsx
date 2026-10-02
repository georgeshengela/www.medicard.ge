import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Apple, Flame, Moon, SunMedium, Utensils, type LucideIcon } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import type { HomeNutritionState } from '@/components/home/sections/HomeEnergyCard';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { groupDigits, nextPlannedMeal, recentMeals, streakFooter } from '@/lib/home/energySummary';
import { mealLabels } from '@/lib/nutrition';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { tx } from '@/i18n/locale';

type MealType = keyof typeof mealLabels;
const MEAL_ICON: Record<MealType, LucideIcon> = { breakfast: SunMedium, lunch: Utensils, dinner: Moon, snack: Apple };
const iconFor = (type: string): LucideIcon => MEAL_ICON[type as MealType] ?? Utensils;
const labelFor = (type: string): string => mealLabels[type as MealType] ?? tx('კვება', 'Meal');

/**
 * „დღის კვება“ — today's logged meals (the latest three, then „+N“), one planned meal not eaten yet,
 * and the meal-logging streak as a quiet footer. Everything comes from the shared dashboard
 * (`todayMeals`, `planned`, `streak`); no extra request. Hidden while nothing is logged today.
 * No X marks, no red, no on-target counting.
 */
export function HomeMealsCard({ nutrition, first = false }: { nutrition: HomeNutritionState; first?: boolean }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const features = useFeatureState();
  const data = nutrition.data;
  const meals = Array.isArray(data?.todayMeals) ? data.todayMeals : [];
  if (!data || !(data.mealCount > 0) || !meals.length) return null;

  const { shown, more } = recentMeals(meals);
  const planned = isHrefAvailable('/nutrition/plan', features) ? nextPlannedMeal(data.planned, meals, new Date().getHours()) : null;
  const streak = streakFooter(data.streak);
  const openDiary = () => router.push('/nutrition/diary' as never);

  const rows: React.ReactNode[] = shown.map((meal) => {
    const Icon = iconFor(meal.type);
    const foods = meal.title?.trim() || meal.names.filter(Boolean).join(', ');
    const kcal = groupDigits(meal.totals?.calories ?? 0);
    return (
      <Pressable
        key={meal.id}
        accessibilityRole="button"
        accessibilityLabel={tx(`${labelFor(meal.type)}: ${foods}, ${kcal} კკალ`, `${labelFor(meal.type)}: ${foods}, ${kcal} kcal`)}
        onPress={openDiary}
        style={s.row}
      >
        <View style={[s.tile, { backgroundColor: accent.tint }]}>
          <Icon size={19} color={accent.ink} strokeWidth={1.9} />
        </View>
        <View style={s.text}>
          <Text numberOfLines={1} style={[s.name, { color: c.text100 }]}>
            {labelFor(meal.type)}
          </Text>
          {foods ? (
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
              {foods}
            </Text>
          ) : null}
        </View>
        <Text style={[s.kcal, { color: c.text100 }]}>{tx(`${kcal} კკალ`, `${kcal} kcal`)}</Text>
      </Pressable>
    );
  });

  if (more > 0) {
    rows.push(
      <Pressable
        key="more"
        accessibilityRole="button"
        accessibilityLabel={tx(`კიდევ ${more} კვება — დღიურის გახსნა`, `${more} more — open the diary`)}
        onPress={openDiary}
        style={s.moreRow}
      >
        <Text style={[hubText.link, { color: accent.ink }]}>{tx(`+${more} კვება — ყველა`, `+${more} more — see all`)}</Text>
      </Pressable>,
    );
  }

  if (planned) {
    const Icon = iconFor(planned.type);
    const kcal = groupDigits(planned.data.totals?.calories ?? 0);
    rows.push(
      <Pressable
        key="planned"
        accessibilityRole="button"
        accessibilityLabel={tx(
          `გეგმით: ${labelFor(planned.type)}, ${planned.data.title}, ${kcal} კკალ. რაციონის გახსნა`,
          `Planned: ${labelFor(planned.type)}, ${planned.data.title}, ${kcal} kcal. Open meal plan`,
        )}
        onPress={() => router.push('/nutrition/plan' as never)}
        style={s.row}
      >
        <View style={[s.tile, { backgroundColor: c.bg100 }]}>
          <Icon size={19} color={c.text200} strokeWidth={1.9} />
        </View>
        <View style={s.text}>
          <View style={s.nameRow}>
            <Text numberOfLines={1} style={[s.name, { color: c.text100, flexShrink: 1 }]}>
              {labelFor(planned.type)}
            </Text>
            <View style={[s.chip, { borderColor: accent.ink }]}>
              <Text style={[s.chipText, { color: accent.ink }]}>{tx('გეგმით', 'Planned')}</Text>
            </View>
          </View>
          <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
            {planned.data.title}
          </Text>
        </View>
        <Text style={[s.kcal, { color: c.text200 }]}>{tx(`${kcal} კკალ`, `${kcal} kcal`)}</Text>
      </Pressable>,
    );
  }

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: first ? 22 : HUB.sectionGap }}>
      <HomeSectionHeading title={tx('დღის კვება', "Today's meals")} linkLabel={tx('ყველა', 'All')} onLink={openDiary} />
      <View style={[s.card, { backgroundColor: c.surface }]}>
        {rows.map((row, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: c.bg300 } : null}>
            {row}
          </View>
        ))}
        {streak ? (
          <View
            accessible
            accessibilityLabel={tx(
              `კვების სერია ${streak.current} დღე${streak.best ? `, რეკორდი ${streak.best}` : ''}`,
              `Meal streak ${streak.current} ${streak.current === 1 ? 'day' : 'days'}${streak.best ? `, best ${streak.best}` : ''}`,
            )}
            style={[s.footer, { borderTopColor: c.bg300 }]}
          >
            <Flame size={16} color={accent.ink} strokeWidth={2} />
            <Text style={[hubText.caption, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold', flexShrink: 1 }]}>
              {tx(`კვების სერია · ${streak.current} დღე`, `Meal streak · ${streak.current} ${streak.current === 1 ? 'day' : 'days'}`)}
              {streak.best ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', color: c.text200 }}>{tx(` · რეკორდი ${streak.best}`, ` · best ${streak.best}`)}</Text>
              ) : null}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, paddingTop: 6, paddingHorizontal: HUB.cardPad, paddingBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  kcal: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 },
  chip: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1 },
  chipText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 10, lineHeight: 14 },
  moreRow: { minHeight: 44, justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 12, borderTopWidth: 1 },
});
