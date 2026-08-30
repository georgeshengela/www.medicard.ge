import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Check, Clock, Droplets, Flag, MessageCircle, Share2, TrendingUp } from 'lucide-react-native';
import { HydrationAppBar } from '@/components/hydration/HydrationChrome';
import { HydrationContainerIcon } from '@/components/hydration/HydrationIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { useHydration } from '@/hooks/useHydration';
import { ka } from '@/i18n/ka';
import { formatMl, hydrationLevel, peakHourLabel } from '@/lib/hydration';

export default function HydrationDetailsScreen() {
  const T = useFigmaHydration();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const h = useHydration();
  const log = h.logs.find((row) => row.id === id) ?? h.logs[0];
  const level = hydrationLevel(h.todayMl, h.goalMl);
  const peak = peakHourLabel(h.logs);

  const dateLabel = useMemo(
    () => (log ? new Date(log.at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : ''),
    [log],
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <HydrationAppBar onBack={() => router.back()} title={ka.hydration.detailsTitle} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <HydrationContainerIcon type={log?.container ?? 'medium'} size={72} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 32, color: T.textPrimary }}>
            {formatMl(log?.ml ?? h.todayMl)}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>
            {ka.hydration.containers[log?.container ?? 'medium']}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Calendar size={16} color={T.textSecondary} />
              <Text style={{ color: T.textSecondary, fontSize: 13 }}>{dateLabel}</Text>
            </View>
            {log ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={16} color={T.textSecondary} />
                <Text style={{ color: T.textSecondary, fontSize: 13 }}>
                  {new Date(log.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ textAlign: 'center', color: T.textSecondary, fontSize: 14, lineHeight: 22 }}>{ka.hydration.detailsHint}</Text>
        </View>

        <Card title={ka.hydration.recommendation} T={T}>
          {[ka.hydration.rec1, ka.hydration.rec2, ka.hydration.rec3].map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6, alignItems: 'flex-start' }}>
              <Check size={16} color={T.success} strokeWidth={2.6} />
              <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
                {line}
              </Text>
            </View>
          ))}
          <Pressable onPress={() => router.push('/health-metrics/hydration/level' as never)}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand, marginTop: 8 }}>
              {ka.hydration.seeImprovements}
            </Text>
          </Pressable>
        </Card>

        <Card title={ka.hydration.keyStats} T={T}>
          <Stat icon={<Flag size={18} color={T.brand} />} value={`${Math.round(h.progress * 100)}%`} sub={ka.hydration.dailyGoal} T={T} />
          <Stat icon={<Droplets size={18} color={T.brand} />} value={String(Math.round(h.allMl / Math.max(1, new Set(h.logs.map((l) => l.date)).size)))} sub={ka.hydration.dailyAverage} T={T} />
          <Stat icon={<TrendingUp size={18} color={T.brand} />} value={h.weekTrend != null ? `${h.weekTrend}%` : '—'} sub={ka.hydration.vsLastMonth} T={T} />
          <Pressable onPress={() => router.push('/health-metrics/hydration/level' as never)}>
            <Stat icon={<Droplets size={18} color={T.brand} />} value={String(level)} sub={ka.hydration.levels[level].title} T={T} />
          </Pressable>
          <Stat icon={<Clock size={18} color={T.brand} />} value={peak ?? '—'} sub={ka.hydration.mostActive} T={T} />
        </Card>

        <Pressable
          onPress={() => router.push('/health-metrics/hydration/level' as never)}
          style={{ minHeight: 48, borderRadius: 16, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>{ka.hydration.seeImprovements}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/chat/doctor' as never)}
          style={{ minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: T.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
        >
          <MessageCircle size={18} color={T.brand} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.brand }}>{ka.hydration.consultMedi}</Text>
        </Pressable>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Share2 size={16} color={T.brand} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>{ka.common.share}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Card({ title, T, children }: { title: string; T: ReturnType<typeof useFigmaHydration>; children: React.ReactNode }) {
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, backgroundColor: T.cardBg }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({
  icon,
  value,
  sub,
  T,
}: {
  icon: React.ReactNode;
  value: string;
  sub: string;
  T: ReturnType<typeof useFigmaHydration>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: T.textPrimary }}>{value}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: T.textSecondary }}>{sub}</Text>
      </View>
    </View>
  );
}
