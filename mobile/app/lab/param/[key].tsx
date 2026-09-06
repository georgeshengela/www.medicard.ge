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
import { formatPrintedNorm } from '@/lib/labExplain';
import { resolveCanonicalLabKey, titledLabName } from '@/lib/labNames';
import type { LabFlag } from '@/types/lab';

export default function LabParamScreen() {
  const T = useFigmaLab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key: rawKey } = useLocalSearchParams<{ key: string }>();
  const key = rawKey ? decodeURIComponent(Array.isArray(rawKey) ? rawKey[0] : rawKey) : '';
  const chartKey = key ? resolveCanonicalLabKey({ key, nameEn: key, nameKa: key }) : '';
  const { seriesFor } = useLab();
  const [explainOpen, setExplainOpen] = useState(false);
  const points = useMemo(() => (chartKey ? seriesFor(chartKey) : []), [chartKey, seriesFor]);
  const latest = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;
  const name = latest ? titledLabName(latest.param) : key;
  const latin = latest?.param.nameEn && latest.param.nameEn !== name ? latest.param.nameEn : '';
  const badge = latest ? badgeFor(latest.param.flag, T) : null;
  const printed = latest ? formatPrintedNorm(latest.param) : null;
  const delta =
    latest && previous
      ? `${latest.param.value - previous.param.value > 0 ? '+' : ''}${fmt(latest.param.value - previous.param.value)}`
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <LabBackChevron color={T.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 18 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', minHeight: 44 }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 28,
                lineHeight: 36,
                letterSpacing: -0.25,
                color: T.textPrimary,
              }}
            >
              {name}
            </Text>
            {latin ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: T.textMuted }}>{latin}</Text>
            ) : null}
          </View>
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

        {latest ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>{ka.lab.lastResult}</Text>
            <View
              style={{
                backgroundColor: T.cardBg,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: T.border,
                padding: 18,
                gap: 14,
                ...T.shadowXs,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, flexShrink: 1 }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 40,
                      lineHeight: 46,
                      letterSpacing: -0.8,
                      color: T.textPrimary,
                    }}
                  >
                    {latest.param.display}
                  </Text>
                  {latest.param.unit ? (
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 16, lineHeight: 22, color: T.textSecondary, paddingBottom: 8 }}>
                      {latest.param.unit}
                    </Text>
                  ) : null}
                </View>
                {badge ? (
                  <View
                    style={{
                      backgroundColor: badge.bg,
                      borderWidth: 1,
                      borderColor: badge.border,
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: badge.fg }}>{badge.label}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 8 }}>
                <MetaRow label={ka.lab.testedOn} value={formatLabDateKa(latest.date)} color={T.textPrimary} muted={T.textMuted} />
                {printed ? <MetaRow label={ka.lab.refRange} value={printed} color={T.textPrimary} muted={T.textMuted} /> : null}
                {delta ? (
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_500Medium',
                      fontSize: 14,
                      lineHeight: 20,
                      color: latest.param.value - (previous?.param.value ?? latest.param.value) >= 0 ? T.brand : T.destructive,
                    }}
                  >
                    {ka.lab.vsPrevious(delta, latest.param.unit)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>{ka.lab.historyByDate}</Text>
          {points
            .slice()
            .reverse()
            .map((point) => {
              const range = formatPrintedNorm(point.param);
              return (
                <LabLogRow
                  key={point.date + point.panelId}
                  title={formatLabDateKa(point.date)}
                  subtitle={`${point.param.display} ${point.param.unit}${range ? ` · ${range}` : ''}`.trim()}
                  flag={point.param.flag}
                  onPress={() => router.push(`/lab/${point.date}` as never)}
                />
              );
            })}
        </View>
      </ScrollView>
      <LabParamExplainSheet visible={explainOpen} param={latest?.param ?? null} onClose={() => setExplainOpen(false)} />
    </View>
  );
}

function MetaRow({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: muted }}>{label}</Text>
      {value ? (
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color }}>{value}</Text>
      ) : null}
    </View>
  );
}

function badgeFor(flag: LabFlag, T: ReturnType<typeof useFigmaLab>) {
  if (flag === 'H') return { label: ka.lab.above, bg: T.destructiveSoft, border: T.destructiveBorder, fg: T.destructive };
  if (flag === 'L') return { label: ka.lab.below, bg: T.destructiveSoft, border: T.destructiveBorder, fg: T.destructive };
  if (flag === 'N') return { label: ka.lab.normal, bg: T.brandSoft, border: T.brandLight, fg: T.brand };
  return { label: ka.lab.unknown, bg: T.cardBg, border: T.border, fg: T.textSecondary };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) >= 10 ? 1 : 2).replace(/\.0$/, '');
}
