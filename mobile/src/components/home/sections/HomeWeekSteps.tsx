import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { ringPalette } from '@/components/home/HomeDayRings';
import { useHomeStepsWeek } from '@/hooks/useHomeActive';
import { barHeight, buildStepsWeek, groupThousands } from '@/lib/home/activeHome';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

const CHART = 76;

/**
 * „შენი კვირა“ (owner 2026-10-04, standard Home): seven days of steps as bars with the goal line and
 * the average of the completed days — Apple Health's trends, kept to one card. Reads the stored daily
 * rows (no device read, no network, `useHomeStepsWeek`); hidden until two past days have a value.
 */
export function HomeWeekSteps({ todayTotal, goal, fetchedAt }: { todayTotal: number; goal: number; fetchedAt: string | null }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const ink = ringPalette(dark).steps;
  const { rows } = useHomeStepsWeek(fetchedAt);
  const week = useMemo(() => (rows ? buildStepsWeek({ rows, todayTotal, goal }) : null), [rows, todayTotal, goal]);
  if (!week || week.pastDays < 2) return null;

  const goalY = goal > 0 ? Math.round((goal / week.scaleMax) * CHART) : null;
  const metDays = week.bars.filter((bar) => bar.value != null && goal > 0 && bar.value >= goal).length;
  const headline = week.average != null ? groupThousands(week.average) : groupThousands(todayTotal);
  const caption =
    week.average != null
      ? tx('ნაბიჯი დღეში, საშუალოდ', 'steps a day on average')
      : tx('ნაბიჯი დღეს', 'steps today');
  const side = goal > 0 ? tx(`მიზანი ${metDays}/7 დღე`, `Goal ${metDays}/7 days`) : null;

  return (
    <View style={s.section}>
      <HomeSectionHeading title={tx('შენი კვირა', 'Your week')} linkLabel={tx('ნაბიჯები', 'Steps')} onLink={() => router.push('/health-metrics/steps' as never)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[`${headline} ${caption}`, side].filter(Boolean).join('. ')}
        onPress={() => router.push('/health-metrics/steps' as never)}
        style={[s.card, { backgroundColor: c.surface }]}
      >
        <View style={s.top}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.big, { color: c.text100 }]}>{headline}</Text>
            <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{caption}</Text>
          </View>
          {side ? (
            <View style={[s.pill, { backgroundColor: `${ink}${dark ? '26' : '14'}` }]}>
              <Text numberOfLines={1} style={[s.pillText, { color: ink }]}>{side}</Text>
            </View>
          ) : null}
        </View>
        <View style={[s.chart, { height: CHART + 18 }]}>
          {goalY != null ? (
            <View pointerEvents="none" style={[s.goal, { bottom: 18 + goalY, borderColor: c.text300 }]} />
          ) : null}
          {week.bars.map((bar) => {
            const h = barHeight(bar.value, week.scaleMax, CHART);
            return (
              <View key={bar.key} style={s.col}>
                <View style={{ height: CHART, justifyContent: 'flex-end' }}>
                  <View
                    style={[
                      s.bar,
                      bar.value == null
                        ? { height: 4, backgroundColor: c.bg200 }
                        : { height: h, backgroundColor: bar.isToday ? ink : `${ink}${dark ? '80' : '66'}` },
                    ]}
                  />
                </View>
                <Text style={[s.day, { color: bar.isToday ? c.text100 : c.text300, fontFamily: bar.isToday ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular' }]}>
                  {bar.label}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, padding: 16, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums'] },
  pill: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, lineHeight: 15 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  goal: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: 18, borderRadius: 6 },
  day: { fontSize: 10, lineHeight: 14 },
});
