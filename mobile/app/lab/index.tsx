import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlaskConical, Plus } from 'lucide-react-native';
import { LabFilterBar } from '@/components/lab/LabFilterBar';
import { LabBackChevron, LabChevronRight } from '@/components/lab/LabIcons';
import { LabLogRow } from '@/components/lab/LabLogRow';
import { LabMoversCard } from '@/components/lab/LabMoversCard';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import { labFlagCounts, labParamMatches, type LabFlagFilter } from '@/lib/labFilter';
import { summarizeLabMovers } from '@/lib/labMovers';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';

export default function LabHubScreen() {
  const T = useFigmaLab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dates, byDate, panels, loading } = useLab();
  const [mode, setMode] = useState<'days' | 'watch'>('days');
  const [query, setQuery] = useState('');
  const [flag, setFlag] = useState<LabFlagFilter>('watch');

  const movers = useMemo(() => summarizeLabMovers(panels), [panels]);
  const allParams = useMemo(
    () =>
      panels.flatMap((panel) =>
        panel.parameters.map((param) => ({ ...param, date: panel.date, panelId: panel.id })),
      ),
    [panels],
  );
  const abnormal = allParams.filter((row) => row.flag === 'H' || row.flag === 'L');
  const watchRows = useMemo(
    () => allParams.filter((row) => labParamMatches(row, query, flag)),
    [allParams, flag, query],
  );
  const watchCounts = useMemo(() => labFlagCounts(abnormal), [abnormal]);
  const visibleDates = useMemo(() => {
    if (!query.trim()) return dates;
    return dates.filter((date) => {
      const list = byDate.get(date) ?? [];
      return list.some((panel) => panel.parameters.some((param) => labParamMatches(param, query, 'all')));
    });
  }, [byDate, dates, query]);

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <LabBackChevron color={T.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push('/module/lab' as never)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: T.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={22} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, color: T.textPrimary }}>
          {ka.lab.title}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 26, color: T.textSecondary }}>
          {ka.lab.subtitle}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard
            label={ka.lab.testsCount}
            value={String(dates.length)}
            selected={mode === 'days'}
            onPress={() => setMode('days')}
            T={T}
          />
          <StatCard
            label={ka.lab.watchCount}
            value={String(abnormal.length)}
            warn={abnormal.length > 0}
            selected={mode === 'watch'}
            onPress={() => {
              setMode('watch');
              setFlag('watch');
            }}
            T={T}
          />
        </View>
        {mode === 'watch' ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
              {ka.lab.watchHint}
            </Text>
            <LabFilterBar
              query={query}
              onQuery={setQuery}
              flag={flag}
              onFlag={setFlag}
              flags={['watch', 'H', 'L']}
              counts={{ watch: watchCounts.watch, H: watchCounts.H, L: watchCounts.L }}
            />
          </View>
        ) : dates.length ? (
          <LabFilterBar query={query} onQuery={setQuery} flag="all" onFlag={() => undefined} flags={[]} />
        ) : null}
        {mode === 'days' && movers.length ? (
          <LabMoversCard
            movers={movers}
            onOpen={(key) => router.push(`/lab/param/${encodeURIComponent(key)}` as never)}
          />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>
            {mode === 'watch' ? ka.lab.watchCount : ka.lab.allLogs}
          </Text>
          {mode === 'watch' && allParams.length ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>
              {ka.lab.resultCount(watchRows.length, flag === 'watch' ? abnormal.length : flag === 'H' ? watchCounts.H : watchCounts.L)}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <Text style={{ color: T.textSecondary }}>{ka.common.loading}</Text>
        ) : null}
        {!loading && !dates.length ? (
          <Pressable
            onPress={() => router.push('/module/lab' as never)}
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: T.brand,
              padding: 24,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <FlaskConical size={28} color={T.brand} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary, textAlign: 'center' }}>
              {ka.lab.emptyTitle}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary, textAlign: 'center' }}>
              {ka.lab.emptyBody}
            </Text>
          </Pressable>
        ) : null}
        {mode === 'watch' && dates.length && !watchRows.length ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>
            {abnormal.length ? ka.lab.filterEmpty : ka.lab.watchEmpty}
          </Text>
        ) : null}
        {mode === 'watch'
          ? watchRows.map((row) => (
              <LabLogRow
                key={`${row.panelId}-${row.key}-${row.date}`}
                title={`${row.nameKa || row.nameEn}  ${row.display} ${row.unit}`.trim()}
                subtitle={isTodayYmd(row.date) ? ka.common.today : formatLabDateKa(row.date)}
                flag={row.flag}
                onPress={() => router.push(`/lab/param/${encodeURIComponent(row.key)}` as never)}
              />
            ))
          : visibleDates.map((date) => {
              const list = byDate.get(date) ?? [];
              const params = list.flatMap((p) => p.parameters);
              const off = params.filter((p) => p.flag === 'H' || p.flag === 'L').length;
              return (
                <Pressable
                  key={date}
                  onPress={() => router.push(`/lab/${date}` as never)}
                  style={{
                    backgroundColor: T.cardBg,
                    borderWidth: 1,
                    borderColor: T.border,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    ...T.shadowXs,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: T.iconWell,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FlaskConical size={18} color={T.iconWellInk} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: T.textPrimary }}>
                      {isTodayYmd(date) ? ka.common.today : formatLabDateKa(date)}
                    </Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>
                      {ka.lab.paramsOnDate(params.length, off)}
                    </Text>
                  </View>
                  <LabChevronRight color={T.textMuted} />
                </Pressable>
              );
            })}
        {mode === 'days' && dates.length && !visibleDates.length ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>{ka.lab.filterEmpty}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  warn,
  selected,
  onPress,
  T,
}: {
  label: string;
  value: string;
  warn?: boolean;
  selected?: boolean;
  onPress?: () => void;
  T: ReturnType<typeof useFigmaLab>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: selected ? (warn ? T.destructiveSoft : T.brandSoft) : T.cardBg,
        borderWidth: 2,
        borderColor: selected ? (warn ? T.destructive : T.brand) : T.border,
        borderRadius: 16,
        padding: 14,
        gap: 4,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, color: warn ? T.destructive : T.textPrimary }}>{value}</Text>
    </Pressable>
  );
}

