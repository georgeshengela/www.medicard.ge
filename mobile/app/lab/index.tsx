import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlaskConical, Plus } from 'lucide-react-native';
import { LabBackChevron, LabChevronRight } from '@/components/lab/LabIcons';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';

export default function LabHubScreen() {
  const T = useFigmaLab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dates, byDate, panels, loading } = useLab();

  const movers = useMemo(() => summarizeMovers(panels), [panels]);
  const abnormal = panels.flatMap((p) => p.parameters).filter((row) => row.flag === 'H' || row.flag === 'L').length;

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
          <StatCard label={ka.lab.testsCount} value={String(dates.length)} T={T} />
          <StatCard label={ka.lab.watchCount} value={String(abnormal)} warn={abnormal > 0} T={T} />
        </View>
        {movers.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>{ka.lab.movers}</Text>
            {movers.map((row) => (
              <Pressable
                key={row.key}
                onPress={() => router.push(`/lab/param/${encodeURIComponent(row.key)}` as never)}
                style={{
                  backgroundColor: T.cardBg,
                  borderWidth: 1,
                  borderColor: T.border,
                  borderRadius: 14,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.textPrimary }}>{row.name}</Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: row.up ? T.destructive : T.brand }}>
                    {row.up ? ka.lab.wentUp(row.pct) : ka.lab.wentDown(row.pct)}
                  </Text>
                </View>
                <LabChevronRight color={T.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>{ka.lab.allLogs}</Text>
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
        {dates.map((date) => {
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
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  warn,
  T,
}: {
  label: string;
  value: string;
  warn?: boolean;
  T: ReturnType<typeof useFigmaLab>;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: T.cardBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 16,
        padding: 14,
        gap: 4,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, color: warn ? T.destructive : T.textPrimary }}>{value}</Text>
    </View>
  );
}

function summarizeMovers(panels: ReturnType<typeof useLab>['panels']) {
  const byKey = new Map<string, { name: string; values: number[] }>();
  const ordered = [...panels].sort((a, b) => a.date.localeCompare(b.date));
  for (const panel of ordered) {
    for (const row of panel.parameters) {
      const cur = byKey.get(row.key) ?? { name: row.nameKa || row.nameEn, values: [] };
      cur.values.push(row.value);
      byKey.set(row.key, cur);
    }
  }
  return [...byKey.entries()]
    .map(([key, row]) => {
      if (row.values.length < 2) return null;
      const prev = row.values[row.values.length - 2];
      const last = row.values[row.values.length - 1];
      if (!prev) return null;
      const pct = Math.round((Math.abs(last - prev) / Math.abs(prev)) * 100);
      if (pct < 1) return null;
      return { key, name: row.name, pct, up: last > prev };
    })
    .filter((row): row is { key: string; name: string; pct: number; up: boolean } => Boolean(row))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);
}
