import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { LabChevronRight } from '@/components/lab/LabIcons';
import { LabMoverSpark } from '@/components/lab/LabMoversCard';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { moverChangeLabel, summarizeLabMovers } from '@/lib/labMovers';
import type { LabFlag, LabParameter } from '@/types/lab';

type Spotlight = {
  key: string;
  name: string;
  flag: LabFlag;
  display: string;
  unit: string;
  values: number[];
  change?: string;
};

export function HomeLabSection() {
  const router = useRouter();
  const FIGMA = useFigmaHomeDashboard();
  const T = useFigmaLab();
  const { dates, byDate, panels } = useLab();
  const latest = dates[0];
  const params = latest ? (byDate.get(latest) ?? []).flatMap((panel) => panel.parameters) : [];
  const high = params.filter((row) => row.flag === 'H').length;
  const low = params.filter((row) => row.flag === 'L').length;
  const normal = params.filter((row) => row.flag === 'N').length;
  const watch = high + low;
  const movers = useMemo(() => summarizeLabMovers(panels, 3), [panels]);

  const spots = useMemo<Spotlight[]>(() => {
    const flagged = params.filter((row) => row.flag === 'H' || row.flag === 'L').slice(0, 2);
    if (flagged.length) {
      return flagged.map((row) => {
        const mover = movers.find((item) => item.key === row.key);
        return toSpot(row, mover?.values ?? [row.value], mover ? moverChangeLabel(mover) : undefined);
      });
    }
    return movers.slice(0, 2).map((row) => ({
      key: row.key,
      name: row.name,
      flag: row.flag,
      display: row.lastDisplay,
      unit: row.unit,
      values: row.values,
      change: moverChangeLabel(row),
    }));
  }, [movers, params]);

  const openLab = () => router.push('/lab' as never);
  const openParam = (key: string) => router.push(`/lab/param/${encodeURIComponent(key)}` as never);

  return (
    <View style={{ paddingVertical: 4, gap: 8, marginTop: S.sectionTop }}>
      <HomeSectionTitle title={ka.home.labTitle} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      <Pressable
        accessibilityRole="button"
        onPress={openLab}
        style={{
          marginHorizontal: 16,
          backgroundColor: FIGMA.setupCardBg,
          borderWidth: 1,
          borderColor: FIGMA.border,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: T.iconWell,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FlaskConical size={20} color={T.iconWellInk} strokeWidth={2.1} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {latest ? (
              <>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: FIGMA.textPrimary }}
                >
                  {isTodayYmd(latest) ? ka.common.today : formatLabDateKa(latest)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: FIGMA.textSecondary }}
                >
                  {ka.lab.paramsOnDate(params.length, watch)}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: FIGMA.textPrimary }}>
                  {ka.lab.emptyTitle}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: FIGMA.textSecondary }}>
                  {ka.home.labAdd}
                </Text>
              </>
            )}
          </View>
          <LabChevronRight color={T.textMuted} />
        </View>

        {latest ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatChip label={ka.lab.normal} value={normal} tone="ok" T={T} />
            <StatChip label={ka.lab.above} value={high} tone="warn" T={T} />
            <StatChip label={ka.lab.below} value={low} tone="warn" T={T} />
          </View>
        ) : null}

        {latest && spots.length ? (
          <View style={{ gap: 6 }}>
            {spots.map((row) => {
              const color = row.flag === 'H' || row.flag === 'L' ? T.destructive : T.brand;
              return (
                <Pressable
                  key={row.key}
                  onPress={() => openParam(row.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 32,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: T.tabTrack,
                  }}
                >
                  {row.values.length > 1 ? (
                    <LabMoverSpark values={row.values} color={color} width={40} height={18} />
                  ) : (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                  )}
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, color: FIGMA.textPrimary }}
                  >
                    {row.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 15, color: FIGMA.textSecondary }}
                  >
                    {row.display}
                    {row.unit ? ` ${row.unit}` : ''}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11, lineHeight: 15, color }}>
                    {row.change ?? (row.flag === 'H' ? ka.lab.above : row.flag === 'L' ? ka.lab.below : ka.lab.normal)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : latest && !watch ? (
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: T.brandSoft,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, color: T.brand }}>
              {ka.home.labClear}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function toSpot(row: LabParameter, values: number[], change?: string): Spotlight {
  return {
    key: row.key,
    name: row.nameKa || row.nameEn,
    flag: row.flag,
    display: row.display,
    unit: row.unit,
    values,
    change,
  };
}

function StatChip({
  label,
  value,
  tone,
  T,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn';
  T: ReturnType<typeof useFigmaLab>;
}) {
  const on = value > 0 && tone === 'warn';
  return (
    <View
      style={{
        flex: 1,
        minHeight: 36,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: on ? T.destructiveSoft : T.brandSoft,
        gap: 1,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 18, color: on ? T.destructive : T.brand }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 10, lineHeight: 13, color: on ? T.destructive : T.brand }}>
        {label}
      </Text>
    </View>
  );
}
