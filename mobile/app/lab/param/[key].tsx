import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LabBackChevron, LabInfoCircle } from '@/components/lab/LabIcons';
import { LabLogRow } from '@/components/lab/LabLogRow';
import { LabParamChart } from '@/components/lab/LabParamChart';
import { LabParamExplainSheet } from '@/components/lab/LabParamExplainSheet';
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
  const [explainOpen, setExplainOpen] = useState(false);
  const points = useMemo(() => (key ? seriesFor(key) : []), [key, seriesFor]);
  const latest = points[points.length - 1];
  const name = latest ? latest.param.nameKa || latest.param.nameEn : key;

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <LabBackChevron color={T.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
          <Text
            style={{
              flex: 1,
              paddingRight: 12,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 28,
              lineHeight: 36,
              letterSpacing: -0.25,
              color: T.textPrimary,
            }}
          >
            {name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.lab.explainA11y}
            onPress={() => setExplainOpen(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: T.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LabInfoCircle color="#FFFFFF" size={22} />
          </Pressable>
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
      <LabParamExplainSheet visible={explainOpen} param={latest?.param ?? null} onClose={() => setExplainOpen(false)} />
    </View>
  );
}
