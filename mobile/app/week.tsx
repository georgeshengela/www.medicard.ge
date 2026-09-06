import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Droplets, Footprints, Moon, Pill, Scale } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { ka } from '@/i18n/ka';
import { markEngageSeen } from '@/lib/mediEngagePrefs';
import { buildWeekReport, type WeekReport } from '@/lib/mediWeekReport';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { useThemeColors } from '@/theme/colors';

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Footprints;
  label: string;
  value: string;
  hint?: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        minWidth: '47%',
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 14,
        gap: 8,
      }}
    >
      <Icon size={18} color={colors.primary200} strokeWidth={2.1} />
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: colors.text300 }}>{label}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>{value}</Text>
      {hint ? (
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function WeekWithMediScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const FIGMA = useFigmaHealthMetrics();
  const [report, setReport] = useState<WeekReport | null>(null);

  useFocusEffect(
    useCallback(() => {
      void markEngageSeen('weekly');
      void buildWeekReport().then((report) => {
        setReport(report);
        void import('@/lib/productObservability').then(({ syncWeeklyReportOpened }) =>
          syncWeeklyReportOpened(report.startYmd, 'in_app'),
        );
      });
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({ width: 44, height: 44, justifyContent: 'center', opacity: pressed ? 0.55 : 1 })}
        >
          <ChevronLeft size={24} color={FIGMA.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'right',
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 17,
            color: FIGMA.textPrimary,
          }}
        >
          {ka.weekMedi.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 28, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <HomeSectionTitle title={ka.weekMedi.insightTitle} />
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 16 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 22, color: colors.text100 }}>
              {report?.insight ?? ka.weekMedi.loading}
            </Text>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <HomeSectionTitle title={ka.weekMedi.metricsTitle} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <StatCard
              icon={Footprints}
              label={ka.weekMedi.steps}
              value={report ? report.steps.total.toLocaleString('ka-GE') : '—'}
              hint={
                report?.steps.deltaPct != null
                  ? ka.weekMedi.stepsDelta(report.steps.deltaPct)
                  : ka.weekMedi.noCompare
              }
            />
            <StatCard
              icon={Droplets}
              label={ka.weekMedi.water}
              value={report ? `${Math.round(report.hydration.avgMl / 10) / 100} ლ` : '—'}
              hint={report ? ka.weekMedi.waterHit(report.hydration.daysHit) : undefined}
            />
            <StatCard
              icon={Scale}
              label={ka.weekMedi.weight}
              value={
                report?.weight.end != null ? `${report.weight.end} ${ka.profile.kg}` : ka.weekMedi.none
              }
              hint={
                report?.weight.start != null && report.weight.end != null && report.weight.start !== report.weight.end
                  ? `${report.weight.start} → ${report.weight.end}`
                  : undefined
              }
            />
            <StatCard
              icon={Pill}
              label={ka.weekMedi.meds}
              value={report ? String(report.meds.taken) : '—'}
              hint={report ? ka.weekMedi.medsHint(report.meds.skipped) : undefined}
            />
            <StatCard
              icon={Moon}
              label={ka.weekMedi.sleep}
              value={report?.sleepAvg != null ? `${report.sleepAvg} სთ` : ka.weekMedi.none}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
