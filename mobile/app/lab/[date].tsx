import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { MessageCircle, Sparkles } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { LabParamRow } from '@/components/lab/LabParamRow';
import { MedilabButton, MedilabChips, MedilabSearch, useMedilab } from '@/components/lab/MedilabUI';
import { SwipeDeleteRow, SwipeGroup } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { QuotaSheet } from '@/components/QuotaSheet';
import { AiConsentDeclinedNote } from '@/components/ui/AiConsentDeclinedNote';
import { Markdown } from '@/components/ui/Markdown';
import { useLab } from '@/hooks/useLab';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError, api } from '@/lib/api';
import { isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { labFlagCounts, labParamMatches, type LabFlagFilter } from '@/lib/labFilter';
import { labMediPrompt } from '@/lib/labMediPrompt';
import { labRowName } from '@/lib/labNames';
import { localAccountId } from '@/lib/localAccount';
import { mediPrefillRoute } from '@/lib/mediHandoff';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';
import { HUB, hubText } from '@/theme/hub';

type Held = { panelId: string; key: string };

/**
 * One lab test (a date): how many values sit outside their range, Medi's explanation, and every value
 * with its range bar — outside-the-range first. A value deletes with the iPhone swipe (undo for 5 s).
 */
export default function LabDateScreen() {
  const M = useMedilab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = usePrefersReducedMotion();
  const { date } = useLocalSearchParams<{ date: string }>();
  const dateKey = (Array.isArray(date) ? date[0] : date) ?? '';
  const { byDate, loading, removeParam, setAnalysis } = useLab();
  const plan = usePlanUsage();
  const { applyUsage } = useAuth();
  const [query, setQuery] = useState('');
  const [flag, setFlag] = useState<LabFlagFilter>('all');
  const [explaining, setExplaining] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const [explainError, setExplainError] = useState<string | null>(null);

  const { held, remove: hold, undo } = useUndoDelete<Held>((item) => void removeParam(item.panelId, item.key));

  const panels = useMemo(() => byDate.get(dateKey) ?? [], [byDate, dateKey]);
  const panel = panels[0];
  const analysis = panels.map((row) => row.analysis).find((text) => text?.trim()) ?? '';
  const allRows = useMemo(
    () =>
      panels
        .flatMap((p) => p.parameters.map((param) => ({ ...param, panelId: p.id })))
        .filter((row) => !(held && held.panelId === row.panelId && held.key === row.key)),
    [panels, held],
  );
  const counts = useMemo(() => labFlagCounts(allRows), [allRows]);
  const rows = useMemo(() => {
    const matching = allRows.filter((row) => labParamMatches(row, query, flag));
    const off = (r: { flag: string }) => (r.flag === 'H' || r.flag === 'L' ? 0 : 1);
    return matching.map((row, i) => ({ row, i })).sort((a, b) => off(a.row) - off(b.row) || a.i - b.i).map(({ row }) => row);
  }, [allRows, flag, query]);
  const needsExplain = Boolean(panel?.parameters.length) && !analysis.trim();

  const title = dateKey && isTodayYmd(dateKey) ? ka.common.today : dateKey ? formatLabDateKa(dateKey) : ka.lab.title;
  const prompt = labMediPrompt(panels);
  const layout = reduceMotion ? undefined : LinearTransition.duration(220);
  const exiting = reduceMotion ? undefined : FadeOut.duration(140);

  const explain = async () => {
    if (!panel || !dateKey) return;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < 1) {
      setQuotaBlock(plan.usage?.resetsInMs);
      return;
    }
    setExplaining(true);
    setExplainError(null);
    setDeclined(false);
    try {
      const response = await api.ai.explainLab({ parameters: panel.parameters, visionNotes: panel.visionNotes, date: dateKey, recordId: panel.recordIds[0] });
      applyUsage(response.usage);
      await setAnalysis(dateKey, response.analysis);
    } catch (err) {
      if (isAiConsentDeclined(err)) {
        setDeclined(true);
      } else if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        setExplainError(err instanceof ApiError ? err.message : ka.common.error);
      }
    } finally {
      setExplaining(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.c.bg100 }}>
      <SwipeGroup>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96, paddingHorizontal: HUB.gutter }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ModuleHeader
            module="lab"
            subtitle={tx(`ანალიზი · ${title}`, `Lab test · ${title}`)}
            right={prompt ? (
              <ModuleHeaderButton
                label={ka.lab.askMediChat}
                icon={MessageCircle}
                // Lab values wait in memory (mediHandoff); the route carries only `handoff=1`.
                onPress={() => router.push(mediPrefillRoute(localAccountId(), prompt) as never)}
              />
            ) : undefined}
          />

          {!panels.length ? (
            <Text style={[hubText.body, { color: M.c.text200, marginTop: 24 }]}>{loading ? ka.common.loading : ka.lab.emptyDate}</Text>
          ) : (
            <>
              {/* What this test holds, at a glance. */}
              <View style={[s.stats, { backgroundColor: M.c.surface }]}>
                <Stat value={counts.all} label={tx('მაჩვენებელი', 'values')} color={M.c.text100} />
                <View style={[s.statRule, { backgroundColor: M.c.bg300 }]} />
                <Stat value={counts.watch} label={tx('ნორმის გარეთ', 'out of range')} color={counts.watch ? M.attention : M.c.text100} />
                <View style={[s.statRule, { backgroundColor: M.c.bg300 }]} />
                <Stat value={counts.N} label={tx('ნორმაში', 'in range')} color={counts.N ? M.normal : M.c.text100} />
              </View>

              {analysis || needsExplain ? (
                <View style={{ marginTop: HUB.sectionGap }}>
                  <HomeSectionHeading title={tx('Medi-ს განმარტება', "Medi's explanation")} />
                  <View style={[s.card, { backgroundColor: M.c.surface, padding: HUB.cardPad, gap: 12 }]}>
                    {analysis ? (
                      <Markdown content={analysis} />
                    ) : declined ? (
                      <AiConsentDeclinedNote background={M.c.bg100} onRetry={() => void explain()} />
                    ) : (
                      <>
                        <Text style={[hubText.body, { color: M.c.text200 }]}>
                          {tx('Medi ერთად ახსნის ამ ანალიზის ყველა მაჩვენებელს — რას ნიშნავს და რას ჰკითხო ექიმს.', 'Medi explains every value of this test together — what it means and what to ask your doctor.')}
                        </Text>
                        <MedilabButton label={explaining ? ka.lab.askMediBusy : ka.lab.askMedi} icon={explaining ? undefined : Sparkles} busy={explaining} onPress={() => void explain()} />
                      </>
                    )}
                    {explainError ? <Text style={[hubText.caption, { color: M.attention }]}>{explainError}</Text> : null}
                  </View>
                </View>
              ) : null}

              <View style={{ marginTop: HUB.sectionGap }}>
                <HomeSectionHeading title={tx('მაჩვენებლები', 'Values')} />
                {allRows.length > 10 ? (
                  <View style={{ marginBottom: 12 }}>
                    <MedilabSearch value={query} onChange={setQuery} />
                  </View>
                ) : null}
                {counts.watch > 0 && counts.N > 0 ? (
                  <View style={{ marginBottom: 12 }}>
                    <MedilabChips
                      value={flag}
                      onChange={setFlag}
                      options={[
                        { value: 'all', label: ka.lab.filterAll, count: counts.all },
                        { value: 'watch', label: tx('ნორმის გარეთ', 'Out of range'), count: counts.watch },
                        { value: 'N', label: tx('ნორმაში', 'In range'), count: counts.N },
                      ]}
                    />
                  </View>
                ) : null}
                {rows.length ? (
                  <View style={s.card}>
                    {rows.map((row, index) => (
                      <Animated.View key={`${row.panelId}-${row.key}`} layout={layout} exiting={exiting}>
                        <SwipeDeleteRow onDelete={() => hold({ panelId: row.panelId, key: row.key })}>
                          {(open, a11y) => (
                            <LabParamRow
                              first={index === 0}
                              name={labRowName(row)}
                              value={row.value}
                              display={row.display}
                              unit={row.unit}
                              flag={row.flag}
                              refLow={row.refLow}
                              refHigh={row.refHigh}
                              onPress={() => router.push(`/lab/param/${encodeURIComponent(row.key)}` as never)}
                              onLongPress={open}
                              a11y={a11y}
                            />
                          )}
                        </SwipeDeleteRow>
                      </Animated.View>
                    ))}
                  </View>
                ) : (
                  <Text style={[hubText.body, { color: M.c.text200 }]}>{ka.lab.filterEmpty}</Text>
                )}
                <Text style={[hubText.caption, { color: M.c.text300, marginTop: 12, marginHorizontal: 4 }]}>
                  {tx('ზოლზე ფერადი ზონა ფურცელზე დაბეჭდილი ნორმაა. წასაშლელად გადაწიე მარცხნივ.', 'The tinted zone on each bar is the range printed on the sheet. Swipe left to delete.')}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SwipeGroup>

      {held ? <UndoToast key={`${held.panelId}-${held.key}`} title={tx('მაჩვენებელი წაიშალა', 'Value deleted')} bottom={insets.bottom + 16} onUndo={undo} /> : null}
      <QuotaSheet visible={quotaBlock !== undefined} resetsInMs={quotaBlock} onClose={() => setQuotaBlock(undefined)} />
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  const M = useMedilab();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 28, color }}>{value}</Text>
      <Text numberOfLines={1} style={[hubText.caption, { color: M.c.text200 }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  stats: { marginTop: 20, borderRadius: HUB.cardRadius, flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
});
