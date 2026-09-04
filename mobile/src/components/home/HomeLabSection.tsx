import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { LabChevronRight } from '@/components/lab/LabIcons';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';

export function HomeLabSection() {
  const router = useRouter();
  const FIGMA = useFigmaHomeDashboard();
  const T = useFigmaLab();
  const { dates, byDate, panels } = useLab();
  const latest = dates[0];
  const params = latest ? (byDate.get(latest) ?? []).flatMap((panel) => panel.parameters) : [];
  const off = params.filter((row) => row.flag === 'H' || row.flag === 'L').length;
  const movers = useMemo(() => {
    const last = panels
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((panel) => panel.parameters);
    return last.filter((row) => row.flag === 'H' || row.flag === 'L').slice(0, 2);
  }, [panels]);

  return (
    <View style={{ paddingVertical: 4, gap: 8, marginTop: S.sectionTop }}>
      <HomeSectionTitle title={ka.home.labTitle} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      <Pressable
        onPress={() => router.push('/lab' as never)}
        style={{
          marginHorizontal: 16,
          backgroundColor: FIGMA.setupCardBg,
          borderWidth: 1,
          borderColor: FIGMA.border,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: T.iconWell,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FlaskConical size={20} color={T.iconWellInk} strokeWidth={2.1} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {latest ? (
            <>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: FIGMA.textPrimary }}>
                {isTodayYmd(latest) ? ka.common.today : formatLabDateKa(latest)}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA.textSecondary }}>
                {ka.lab.paramsOnDate(params.length, off)}
              </Text>
              {movers.length ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: T.destructive }} numberOfLines={1}>
                  {movers.map((row) => `${row.nameKa || row.nameEn} · ${row.flag === 'H' ? ka.lab.above : ka.lab.below}`).join('  ')}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: FIGMA.textPrimary }}>
                {ka.lab.emptyTitle}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA.textSecondary }} numberOfLines={2}>
                {ka.lab.emptyBody}
              </Text>
            </>
          )}
        </View>
        <LabChevronRight color={T.textMuted} />
      </Pressable>
    </View>
  );
}
