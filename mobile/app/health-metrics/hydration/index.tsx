import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Flag, LayoutList, Sparkles } from 'lucide-react-native';
import { GoalTrendUp } from '@/components/health/steps-goal/StepsGoalIcons';
import { HydrationAppBar, HydrationPeriodTabs } from '@/components/hydration/HydrationChrome';
import {
  HydrationContainerIcon,
  HydrationDrop,
  MiniSpark,
} from '@/components/hydration/HydrationIcons';
import { HydrationGlass } from '@/components/hydration/HydrationGlass';
import { HydrationMonthCalendar } from '@/components/hydration/HydrationMonthCalendar';
import { HydrationWeekChart } from '@/components/hydration/HydrationWeekChart';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { useHydration } from '@/hooks/useHydration';
import { ka } from '@/i18n/ka';
import { formatLiters, formatMl, formatMlTight, monthGrid, todayYmd } from '@/lib/hydration';
import type { StepChartPeriod } from '@/types/stepsMetrics';

type Props = {
  initialPeriod?: StepChartPeriod;
};

export default function HydrationHomeScreen({ initialPeriod }: Props) {
  const T = useFigmaHydration();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ period?: string }>();
  const start = (initialPeriod ?? (params.period as StepChartPeriod) ?? '1d') as StepChartPeriod;
  const h = useHydration();
  const [period, setPeriod] = useState<StepChartPeriod>(start);
  const cells = useMemo(() => {
    const now = new Date();
    return monthGrid(now.getFullYear(), now.getMonth());
  }, []);
  const today = todayYmd();
  const weekSpark = h.weekTotals.length ? h.weekTotals : [0];

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <HydrationAppBar
        onBack={() => router.back()}
        onAdd={() => router.push('/health-metrics/hydration/log' as never)}
        todayMl={h.todayMl}
        goalMl={h.goalMl}
      />
      {period === '1d' ? (
        <>
          <HydrationHero h={h} T={T} />
          <HydrationGlass ml={h.todayMl} goalMl={h.goalMl} />
        </>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          <HydrationHero h={h} T={T} />
          {period === '1w' ? (
            <View style={{ gap: 16 }}>
              <HydrationMonthCalendar cells={cells} today={today} logs={h.logs} goalMl={h.goalMl} />
              <View style={{ paddingHorizontal: 16, gap: 16 }}>
                <HubCards h={h} T={T} weekSpark={weekSpark} />
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 16 }}>
              <HydrationWeekChart values={h.weekTotals} />
              <HubCards h={h} T={T} weekSpark={weekSpark} />
            </View>
          )}
        </ScrollView>
      )}
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, paddingBottom: Math.max(insets.bottom, 8) }}>
        <HydrationPeriodTabs value={period} onChange={setPeriod} />
      </View>
    </View>
  );
}

function HydrationHero({
  h,
  T,
}: {
  h: ReturnType<typeof useHydration>;
  T: ReturnType<typeof useFigmaHydration>;
}) {
  const router = useRouter();
  const meta = { fontFamily: 'NotoSansGeorgian_400Regular' as const, fontSize: 14, lineHeight: 20, color: T.textSecondary };
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <HydrationDrop size={40} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 48,
                lineHeight: 56,
                letterSpacing: -0.75,
                color: T.textPrimary,
              }}
            >
              {h.todayMl.toLocaleString('en-US')}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 24,
                lineHeight: 32,
                letterSpacing: -0.25,
                color: T.textSecondary,
                paddingBottom: 3,
              }}
            >
              {ka.hydration.unit}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 18, lineHeight: 24, color: T.textSecondary }}>
          {h.todayMl >= h.goalMl ? ka.hydration.goalDone : ka.hydration.remaining(formatMlTight(h.remainingMl))}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Flag size={20} color={T.textSecondary} />
          <Text style={meta}>{ka.hydration.target(formatMlTight(h.goalMl))}</Text>
        </View>
        {h.dayTrend != null ? (
          <>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: T.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <GoalTrendUp size={20} color={T.textSecondary} />
              <Text style={meta}>
                {h.dayTrend > 0 ? '+' : ''}
                {h.dayTrend}%
              </Text>
            </View>
          </>
        ) : null}
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: T.border }} />
        <Pressable
          onPress={() => router.push('/health-metrics/hydration/history' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <LayoutList size={20} color={T.textSecondary} />
          <Text style={meta}>{ka.hydration.logsCount(h.logCount)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HubCards({
  h,
  T,
  weekSpark,
}: {
  h: ReturnType<typeof useHydration>;
  T: ReturnType<typeof useFigmaHydration>;
  weekSpark: number[];
}) {
  const router = useRouter();
  const filled = Math.min(8, Math.round(h.todayMl / 250));
  return (
    <>
      <Section title={ka.hydration.dailyGoal} onSeeAll={() => router.push('/health-metrics/hydration/level' as never)} T={T}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: T.textPrimary }}>{formatMl(h.todayMl)}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
          {ka.hydration.progressToday(Math.round(h.progress * 100))}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <HydrationDrop size={22} color={i < filled ? T.brand : T.border} />
            </View>
          ))}
        </View>
        <Text style={{ marginTop: 8, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: T.textTertiary }}>
          {ka.hydration.dropLegend}
        </Text>
      </Section>

      <Section title={ka.hydration.highlight} onSeeAll={() => router.push('/health-metrics/hydration/details' as never)} T={T}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: T.textPrimary }}>{formatLiters(h.allMl)}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>
              {ka.hydration.waterConsumedAllTime}
            </Text>
          </View>
          <MiniSpark values={weekSpark} color="#22C55E" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: T.textPrimary }}>
              {formatLiters(h.weekTotals.reduce((a, b) => a + b, 0))}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>{ka.hydration.weeklyAvg}</Text>
          </View>
          <MiniSpark values={weekSpark} color={h.weekTrend != null && h.weekTrend < 0 ? T.destructive : T.brand} />
        </View>
      </Section>

      <Section title={ka.hydration.historyTitle} onSeeAll={() => router.push('/health-metrics/hydration/history' as never)} T={T}>
        {h.logs.slice(0, 3).map((log) => (
          <Pressable
            key={log.id}
            onPress={() => router.push(`/health-metrics/hydration/details?id=${log.id}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}
          >
            <HydrationContainerIcon type={log.container} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>{formatMl(log.ml)}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>
                {log.container === 'small' ? ka.hydration.glassOf : ka.hydration.bottleOf}
              </Text>
            </View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textTertiary }}>
              {new Date(log.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <ChevronRight size={18} color={T.textTertiary} />
          </Pressable>
        ))}
        {!h.logs.length ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>{ka.hydration.emptyHistory}</Text>
        ) : null}
      </Section>

      <Section title={ka.hydration.aiTitle} onSeeAll={() => router.push('/chat/doctor' as never)} T={T} sparkle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {ka.hydration.aiTips.map((tip) => (
            <View
              key={tip}
              style={{
                width: 260,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: T.border,
                backgroundColor: T.pageBg,
                gap: 8,
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: T.brand }}>{ka.hydration.aiTag}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 22, color: T.textPrimary }}>{tip}</Text>
            </View>
          ))}
        </ScrollView>
      </Section>
    </>
  );
}

function Section({
  title,
  onSeeAll,
  T,
  children,
  sparkle,
}: {
  title: string;
  onSeeAll: () => void;
  T: ReturnType<typeof useFigmaHydration>;
  children: React.ReactNode;
  sparkle?: boolean;
}) {
  return (
    <View style={{ backgroundColor: T.cardBg, borderRadius: 20, borderWidth: 1, borderColor: T.border, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {sparkle ? <Sparkles size={16} color={T.brand} /> : null}
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>{title}</Text>
        </View>
        <Pressable onPress={onSeeAll}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>{ka.hydration.seeAll}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}
