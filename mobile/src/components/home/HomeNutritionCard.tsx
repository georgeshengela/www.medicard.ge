import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, Camera } from 'lucide-react-native';
import { useNutritionDashboard } from '@/components/nutrition/ProgramUI';
import { MetricCardSkeleton } from '@/components/ui/Skeleton';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Nutrition on Home, the way Cal AI does it: today's energy against the target,
 * the three macros, and one unmistakable button that takes a photo of the meal.
 */
export function HomeNutritionCard() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const { data, loading } = useNutritionDashboard();
  const ink = hubInk('amber', dark);

  if (loading && !data) return <MetricCardSkeleton />;

  const eaten = data?.today.calories ?? 0;
  const target = data?.targets?.calories ?? null;
  const logged = (data?.mealCount ?? 0) > 0;
  const ratio = target ? Math.min(1, eaten / target) : 0;
  const headline = logged
    ? target
      ? `${groupDigits(eaten)} / ${groupDigits(target)} კკალ`
      : `${groupDigits(eaten)} კკალ დღეს`
    : 'დღეს ჯერ არაფერი ჩაწერილა';
  const sub = logged
    ? target
      ? data!.remaining! >= 0
        ? `დარჩა ${groupDigits(data!.remaining!)} კკალ`
        : `სამიზნეზე ${groupDigits(-data!.remaining!)} კკალ-ით მეტი`
      : 'აირჩიე მიზანი და დღიური სამიზნე გამოჩნდება'
    : 'გადაიღე კერძი — მედი კალორიებსა და შემადგენლობას დაითვლის';

  const macros = data && logged
    ? [
        { label: 'ცილა', value: data.today.protein, target: data.targets?.protein },
        { label: 'ნახშ.', value: data.today.carbs, target: data.targets?.carbs },
        { label: 'ცხიმი', value: data.today.fat, target: data.targets?.fat },
      ]
    : null;

  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={1} style={[hubText.value, { color: c.text100, fontSize: 17, lineHeight: 24 }]}>
            {headline}
          </Text>
          <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
            {sub}
          </Text>
        </View>
      </View>

      {target ? (
        <View style={[s.track, { backgroundColor: c.bg200 }]}>
          <View style={[s.fill, { width: `${ratio * 100}%`, backgroundColor: ink }]} />
        </View>
      ) : null}

      {macros ? (
        <View style={s.macros}>
          {macros.map((m) => (
            <View key={m.label} style={[s.macro, { backgroundColor: hubTint(ink, dark) }]}>
              <Text style={[hubText.small, { color: c.text200 }]}>{m.label}</Text>
              <Text style={[hubText.link, { color: c.text100 }]}>
                {Math.round(m.value)}
                {m.target ? ` / ${Math.round(m.target)}` : ''} გ
              </Text>
            </View>
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
  card: {
    borderRadius: HUB.cardRadius,
    padding: HUB.cardPad,
    gap: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  macros: { flexDirection: 'row', gap: 8 },
  macro: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 1,
  },
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
