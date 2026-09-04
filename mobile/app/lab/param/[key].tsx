import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LabBackChevron } from '@/components/lab/LabIcons';
import { LabLogRow } from '@/components/lab/LabLogRow';
import { LabParamChart } from '@/components/lab/LabParamChart';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import { formatLabDateKa } from '@/lib/labExtract';

export default function LabParamScreen() {
  const T = useFigmaLab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key: rawKey } = useLocalSearchParams<{ key: string }>();
  const key = rawKey ? decodeURIComponent(Array.isArray(rawKey) ? rawKey[0] : rawKey) : '';
  const { seriesFor } = useLab();
  const points = useMemo(() => (key ? seriesFor(key) : []), [key, seriesFor]);
  const latest = points[points.length - 1];
  const name = latest ? latest.param.nameKa || latest.param.nameEn : key;

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <LabBackChevron color={T.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, color: T.textPrimary }}>
            {name}
          </Text>
          {latest ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, color: T.textSecondary }}>
              {latest.param.display} {latest.param.unit}
              {latest.param.refLow != null && latest.param.refHigh != null
                ? `  ·  ${latest.param.refLow}–${latest.param.refHigh}`
                : ''}
            </Text>
          ) : null}
        </View>
        {points.length ? <LabParamChart points={points} /> : <Text style={{ color: T.textSecondary }}>{ka.lab.needMorePoints}</Text>}
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>{ka.lab.historyTitle}</Text>
        {points
          .slice()
          .reverse()
          .map((point) => (
            <LabLogRow
              key={point.date + point.panelId}
              title={`${point.param.display} ${point.param.unit}`.trim()}
              subtitle={formatLabDateKa(point.date)}
              flag={point.param.flag}
              onPress={() => router.push(`/lab/${point.date}` as never)}
            />
          ))}
      </ScrollView>
    </View>
  );
}
