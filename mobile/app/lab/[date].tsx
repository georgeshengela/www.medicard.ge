import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Sparkles } from 'lucide-react-native';
import { LabBackChevron, LabChevronDown } from '@/components/lab/LabIcons';
import { LabLogRow } from '@/components/lab/LabLogRow';
import { QuotaSheet } from '@/components/QuotaSheet';
import { Markdown } from '@/components/ui/Markdown';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';

export default function LabDateScreen() {
  const T = useFigmaLab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const dateKey = Array.isArray(date) ? date[0] : date;
  const { byDate, removeParam, setAnalysis } = useLab();
  const plan = usePlanUsage();
  const { applyUsage } = useAuth();
  const [newestFirst, setNewestFirst] = useState(true);
  const [explaining, setExplaining] = useState(false);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const [explainError, setExplainError] = useState<string | null>(null);
  const panels = byDate.get(dateKey) ?? [];
  const panel = panels[0];
  const analysis = panels.map((row) => row.analysis).find((text) => text?.trim()) ?? '';
  const needsExplain = Boolean(panel?.parameters.length) && !analysis.trim();
  const rows = useMemo(() => {
    const list = panels.flatMap((panel) =>
      panel.parameters.map((param) => ({
        ...param,
        panelId: panel.id,
        time: new Date(panel.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      })),
    );
    return newestFirst ? list : [...list].reverse();
  }, [newestFirst, panels]);

  const title = dateKey && isTodayYmd(dateKey) ? ka.common.today : dateKey ? formatLabDateKa(dateKey) : ka.lab.title;
  const cta = T.pageBg === '#030712' ? '#0D9488' : T.brand;

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <LabBackChevron color={T.textSecondary} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, color: T.textPrimary }}>
          {title}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 26, color: T.textSecondary }}>
          {ka.lab.datePageHint}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>{ka.lab.allLogs}</Text>
        <Pressable onPress={() => setNewestFirst((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={20} color={T.brand} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.brand }}>
            {newestFirst ? ka.lab.newestFirst : ka.lab.oldestFirst}
          </Text>
          <LabChevronDown color={T.brand} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }} showsVerticalScrollIndicator={false}>
        {needsExplain || analysis ? (
          <View
            style={{
              backgroundColor: T.cardBg,
              borderWidth: 1,
              borderColor: T.border,
              borderRadius: 14,
              padding: 16,
              gap: 10,
              ...T.shadowXs,
            }}
          >
            {analysis ? <Markdown content={analysis} /> : (
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>
                {ka.lab.askMediHint}
              </Text>
            )}
            {needsExplain ? (
              <Pressable
                onPress={() => {
                  if (!panel || !dateKey) return;
                  if (!plan.unlimited && plan.remaining != null && plan.remaining < 1) {
                    setQuotaBlock(plan.usage?.resetsInMs);
                    return;
                  }
                  setExplaining(true);
                  setExplainError(null);
                  void api.ai
                    .explainLab({
                      parameters: panel.parameters,
                      visionNotes: panel.visionNotes,
                      date: dateKey,
                      recordId: panel.recordIds[0],
                    })
                    .then(async (response) => {
                      applyUsage(response.usage);
                      await setAnalysis(dateKey, response.analysis);
                    })
                    .catch((err) => {
                      if (err instanceof ApiError && err.isQuotaExceeded) {
                        setQuotaBlock(err.usage?.resetsInMs);
                        if (err.usage) applyUsage(err.usage);
                      } else {
                        setExplainError(err instanceof ApiError ? err.message : ka.common.error);
                      }
                    })
                    .finally(() => setExplaining(false));
                }}
                disabled={explaining}
                style={{
                  backgroundColor: cta,
                  borderRadius: 16,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: explaining ? 0.55 : 1,
                }}
              >
                {explaining ? <ActivityIndicator color="#fff" /> : <Sparkles size={18} color="#fff" strokeWidth={2.2} />}
                <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                  {explaining ? ka.lab.askMediBusy : ka.lab.askMedi}
                </Text>
              </Pressable>
            ) : null}
            {explainError ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: '#DC2626' }}>{explainError}</Text>
            ) : null}
          </View>
        ) : null}
        {rows.map((row) => (
          <LabLogRow
            key={`${row.panelId}-${row.key}`}
            title={`${row.nameKa || row.nameEn}  ${row.display} ${row.unit}`.trim()}
            subtitle={row.time}
            flag={row.flag}
            onPress={() => router.push(`/lab/param/${encodeURIComponent(row.key)}` as never)}
            onLongPress={() => {
              Alert.alert(ka.lab.deleteParam, undefined, [
                { text: ka.common.cancel, style: 'cancel' },
                { text: ka.common.delete, style: 'destructive', onPress: () => void removeParam(row.panelId, row.key) },
              ]);
            }}
          />
        ))}
        {!rows.length ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>{ka.lab.emptyDate}</Text>
        ) : null}
      </ScrollView>
      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
        onUpgrade={() => {
          setQuotaBlock(undefined);
          router.push('/package');
        }}
      />
    </View>
  );
}
