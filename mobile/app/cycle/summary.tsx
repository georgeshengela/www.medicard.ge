import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BarChart3, FileDown, MessageSquareText, Sparkles } from 'lucide-react-native';
import { CyclePeriodHistory } from '@/components/cycle/CyclePeriodHistory';
import { CyclePmsHeatmap } from '@/components/cycle/CyclePmsHeatmap';
import { FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CyclePrimaryButton,
  CycleSection,
  formatCycleDateKa,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { ApiError, type CycleBundle } from '@/lib/api';
import { loadCycleView } from '@/lib/cycleOffline';
import { buildCycleReportHtml } from '@/lib/cycleReport';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

function labelOf(id: string, lists: { id: string; label: string }[][]) {
  for (const list of lists) {
    const hit = list.find((x) => x.id === id);
    if (hit) return hit.label;
  }
  return id;
}

export default function CycleSummary() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [reportBundle, setReportBundle] = useState<CycleBundle | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.summary));
  }, [navigation, c]);

  const reload = () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadCycleView(user.id)
      .then((view) => {
        setBundle(view.display);
        setReportBundle(view.canonical);
        setPendingCount(view.pendingCount);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [user?.id]);

  if (loading) return <CycleLoading />;

  const s = bundle?.summary;

  const fmt = (iso: string | null | undefined) =>
    iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatCycleDateKa(iso) : '—';

  const context = s
    ? [
        'ციკლის შეჯამება (Medicard):',
        `რეჟიმი: ${s.mode}`,
        `საშუალო ციკლი: ${s.avgCycleLength} დღე, მენსტრუაცია: ${s.avgPeriodLength} დღე`,
        s.isIrregular ? 'არარეგულარული ციკლი' : 'რეგულარული ციკლი',
        `${ka.cycle.estimatedNextPeriod}: ${fmt(s.nextPeriodStart)}`,
        `${ka.cycle.estimatedOvulationTitle}: ${fmt(s.ovulationDate)}`,
        `ტოპ სიმპტომები: ${
          s.topSymptoms
            .map((t) => `${labelOf(t.key, [PHYSICAL_SYMPTOMS, FLOW_OPTIONS])} (${t.count})`)
            .join(', ') || '—'
        }`,
        `ტოპ განწყობა: ${
          s.topMoods.map((t) => `${labelOf(t.key, [MOOD_OPTIONS])} (${t.count})`).join(', ') || '—'
        }`,
      ].join('\n')
    : '';

  const sharePdf = async () => {
    if (!reportBundle) return;
    setPdfBusy(true);
    try {
      const html = buildCycleReportHtml(reportBundle);
      if (Platform.OS === 'web') {
        await Share.share({ message: html.replace(/<[^>]+>/g, ' ').slice(0, 4000) });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={{ color: c.danger, fontWeight: '600' }}>{error}</Text>
        ) : null}
        {pendingCount > 0 ? (
          <Text style={{ color: c.muted, marginBottom: 12, lineHeight: 20 }}>
            {ka.cycle.reportPendingWarn}
          </Text>
        ) : null}

        {s ? (
          <>
            <Animated.View entering={FadeInUp.duration(420)} style={{ marginBottom: 16 }}>
              <View
                style={{
                  borderRadius: 16,
                  padding: 22,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Sparkles size={18} color={c.brand} />
                  <Text
                    style={{
                      color: c.brand,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      marginLeft: 8,
                      fontSize: 12,
                      letterSpacing: 0.4,
                    }}
                  >
                    ექიმისთვის მზად
                  </Text>
                </View>
                <Text
                  style={{
                    color: c.ink,
                    fontSize: 22,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                  }}
                >
                  ციკლის შეჯამება
                </Text>
                <Text style={{ color: c.muted, marginTop: 6, lineHeight: 20 }}>
                  {s.loggedDays} დღის აღრიცხვა ·{' '}
                  {s.isIrregular ? 'არარეგულარული' : 'რეგულარული'} ციკლი
                </Text>
              </View>
            </Animated.View>

            <CycleSection title="ციკლი" delay={60}>
              <CycleCard>
                <Line c={c} k={ka.cycle.avgCycle} v={`${s.avgCycleLength} დღე`} />
                <Line c={c} k={ka.cycle.avgPeriod} v={`${s.avgPeriodLength} დღე`} />
                {s.shortestCycle != null ? (
                  <Line c={c} k={ka.cycle.shortestCycle} v={`${s.shortestCycle} დღე`} />
                ) : null}
                {s.longestCycle != null ? (
                  <Line c={c} k={ka.cycle.longestCycle} v={`${s.longestCycle} დღე`} />
                ) : null}
                {s.variability != null ? (
                  <Line c={c} k={ka.cycle.cycleVariability} v={`${s.variability} დღე`} />
                ) : null}
                <Line c={c} k={ka.cycle.estimatedNextPeriod} v={fmt(s.nextPeriodStart)} />
                <Line c={c} k={ka.cycle.ovulation} v={fmt(s.ovulationDate)} last />
                {s.cycleCount ? (
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>
                    {ka.cycle.basedOnCycles(s.cycleCount)}
                    {' · '}
                    {s.confidence === 'high'
                      ? ka.cycle.confidenceHigh
                      : s.confidence === 'medium'
                        ? ka.cycle.confidenceMedium
                        : ka.cycle.confidenceLow}
                  </Text>
                ) : (
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>{ka.cycle.confidenceLow}</Text>
                )}
              </CycleCard>
            </CycleSection>

            {bundle ? (
              <CycleSection title={ka.cycle.periodHistory} delay={80}>
                <CyclePeriodHistory bundle={bundle} onChanged={reload} />
              </CycleSection>
            ) : null}

            <CycleSection title={ka.cycle.symptoms} delay={100}>
              <CycleCard>
                {s.topSymptoms.length === 0 ? (
                  <Text style={{ color: c.muted }}>—</Text>
                ) : (
                  s.topSymptoms.map((t, i) => (
                    <FreqRow
                      key={t.key}
                      c={c}
                      label={labelOf(t.key, [PHYSICAL_SYMPTOMS])}
                      count={t.count}
                      max={s.topSymptoms[0]?.count || 1}
                      last={i === s.topSymptoms.length - 1}
                    />
                  ))
                )}
              </CycleCard>
            </CycleSection>

            <CycleSection title={ka.cycle.moods} delay={140}>
              <CycleCard>
                {s.topMoods.length === 0 ? (
                  <Text style={{ color: c.muted }}>—</Text>
                ) : (
                  s.topMoods.map((t, i) => (
                    <FreqRow
                      key={t.key}
                      c={c}
                      label={labelOf(t.key, [MOOD_OPTIONS])}
                      count={t.count}
                      max={s.topMoods[0]?.count || 1}
                      last={i === s.topMoods.length - 1}
                    />
                  ))
                )}
              </CycleCard>
            </CycleSection>

            {bundle ? (
              <CycleSection title={ka.cycle.pmsPattern} delay={120}>
                <CyclePmsHeatmap bundle={bundle} />
              </CycleSection>
            ) : null}

            <View style={{ marginTop: 8, gap: 10 }}>
              <CyclePrimaryButton
                label={pdfBusy ? ka.cycle.pdfGenerating : ka.cycle.pdfShare}
                onPress={sharePdf}
                icon={FileDown}
                disabled={pdfBusy}
              />
              <Pressable
                onPress={() => router.push('/cycle/trends' as never)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  borderRadius: 18,
                  backgroundColor: c.lavenderSoft,
                }}
              >
                <BarChart3 size={18} color={c.lavender} />
                <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 8 }}>
                  {ka.cycle.trendsOpen}
                </Text>
              </Pressable>
              <CyclePrimaryButton
                label={ka.cycle.openChat}
                onPress={() =>
                  router.push({
                    pathname: '/chat/doctor',
                    params: { prefill: context },
                  } as never)
                }
                icon={MessageSquareText}
              />
            </View>
          </>
        ) : (
          <Text style={{ color: c.muted, fontWeight: '600' }}>{ka.cycle.emptyHint}</Text>
        )}
      </ScrollView>
    </CycleAtmosphere>
  );
}

function Line({
  c,
  k,
  v,
  last,
}: {
  c: ReturnType<typeof useCycleColors>;
  k: string;
  v: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <Text style={{ color: c.muted, flex: 1, paddingRight: 12 }}>{k}</Text>
      <Text style={{ color: c.ink, fontWeight: '700' }}>{v}</Text>
    </View>
  );
}

function FreqRow({
  c,
  label,
  count,
  max,
  last,
}: {
  c: ReturnType<typeof useCycleColors>;
  label: string;
  count: number;
  max: number;
  last?: boolean;
}) {
  const pct = Math.max(0.12, count / Math.max(1, max));
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: c.ink, fontWeight: '600', flex: 1 }}>{label}</Text>
        <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{count}×</Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: c.creamDeep,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(pct * 100)}%`,
            height: '100%',
            backgroundColor: c.brand,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}
