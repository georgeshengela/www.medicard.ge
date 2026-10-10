import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { LabChangesCard } from '@/components/lab/LabChangesCard';
import { LabMediCard } from '@/components/lab/LabMediCard';
import { LabSummaryCard, OrganTile } from '@/components/lab/LabOverview';
import { LabValueRow } from '@/components/lab/LabValueRow';
import { MedilabSearch, useMedilab } from '@/components/lab/MedilabUI';
import { SwipeDeleteRow, SwipeGroup } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useLab } from '@/hooks/useLab';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError, api } from '@/lib/api';
import { isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { compareLabTests, groupLabBySystem, labPlainName, labSystemName, type LabSystemId } from '@/lib/labBody';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { labFlagCounts, labParamMatches } from '@/lib/labFilter';
import { labMediPrompt } from '@/lib/labMediPrompt';
import { labRowName } from '@/lib/labNames';
import { localAccountId } from '@/lib/localAccount';
import { mediPrefillRoute } from '@/lib/mediHandoff';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';
import { HUB, hubText } from '@/theme/hub';

type Held = { panelId: string; key: string };

/**
 * One lab test (a date) for someone with no medical background (owner 2026-10-10: one page, no tabs).
 * A quiet summary, then every value by body system with our organ drawings — systems with something
 * outside open first, the rest folded, one compact line per value (risk first, detail on tap, like
 * InsideTracker / Function Health) — then „რა შეიცვალა“ against the test before and Medi's
 * explanation. A value deletes with the iPhone swipe (undo for 5 s).
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
  const { applyUsage, user } = useAuth();
  const gender = user?.gender === 'FEMALE' ? 'FEMALE' : 'MALE';
  const [query, setQuery] = useState('');
  // Folded state per system the person touched; by default a system is open when something is outside.
  const [toggled, setToggled] = useState<Partial<Record<LabSystemId, boolean>>>({});
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
  const systems = useMemo(() => groupLabBySystem(allRows), [allRows]);
  const needle = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const matching = allRows.filter((row) => labParamMatches(row, query, 'all') || (needle && (labPlainName(row.key) ?? '').toLowerCase().includes(needle)));
    return groupLabBySystem(matching);
  }, [allRows, query, needle]);
  // „რა შეიცვალა“: this test against the newest one before it.
  const comparison = useMemo(() => {
    const prevDate = [...byDate.keys()].filter((d) => d < dateKey).sort().pop();
    if (!prevDate) return null;
    const previous = (byDate.get(prevDate) ?? []).flatMap((p) => p.parameters);
    return compareLabTests(allRows, previous, prevDate);
  }, [byDate, dateKey, allRows]);
  const needsExplain = Boolean(panel?.parameters.length) && !analysis.trim();

  const title = dateKey && isTodayYmd(dateKey) ? ka.common.today : dateKey ? formatLabDateKa(dateKey) : ka.lab.title;
  const prompt = labMediPrompt(panels);
  const layout = reduceMotion ? undefined : LinearTransition.duration(220);
  const exiting = reduceMotion ? undefined : FadeOut.duration(140);

  const isOpen = (id: LabSystemId, off: number) => Boolean(needle) || (toggled[id] ?? off > 0);
  const openParam = (key: string) => router.push(`/lab/param/${encodeURIComponent(key)}` as never);
  const askMedi = prompt ? () => router.push(mediPrefillRoute(localAccountId(), prompt) as never) : undefined;

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
            right={askMedi ? (
              // Lab values wait in memory (mediHandoff); the route carries only `handoff=1`.
              <ModuleHeaderButton label={ka.lab.askMediChat} icon={MessageCircle} onPress={askMedi} />
            ) : undefined}
          />

          {!panels.length ? (
            <Text style={[hubText.body, { color: M.c.text200, marginTop: 24 }]}>{loading ? ka.common.loading : ka.lab.emptyDate}</Text>
          ) : (
            <>
              <View style={{ marginTop: 20 }}>
                <LabSummaryCard dateLabel={title} total={counts.all} inRange={counts.N} off={counts.watch} />
              </View>

              <View style={{ marginTop: HUB.sectionGap }}>
                <HomeSectionHeading title={tx('მაჩვენებლები', 'Values')} />
                {allRows.length > 10 ? (
                  <View style={{ marginBottom: 12 }}>
                    <MedilabSearch value={query} onChange={setQuery} />
                  </View>
                ) : null}
                {groups.length ? (
                  groups.map((group, gi) => {
                    const open = isOpen(group.id, group.off);
                    const tone = group.off ? M.attention : group.tone === 'ok' ? M.normal : M.c.text300;
                    return (
                      <View key={group.id} style={{ marginTop: gi ? 10 : 0 }}>
                        <View style={[s.card, { backgroundColor: M.c.surface }]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: open }}
                            accessibilityLabel={labSystemName(group.id)}
                            onPress={() => setToggled((prev) => ({ ...prev, [group.id]: !open }))}
                            style={s.groupHead}
                          >
                            <OrganTile system={group.id} gender={gender} tone={group.off ? 'warn' : group.tone} size={40} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[hubText.cardTitle, { color: M.c.text100 }]}>{labSystemName(group.id)}</Text>
                              <Text style={[hubText.caption, { fontFamily: 'NotoSansGeorgian_600SemiBold', color: tone }]}>
                                {group.off
                                  ? tx(`${group.off} ნორმის გარეთ · ${group.rows.length}-დან`, `${group.off} of ${group.rows.length} outside`)
                                  : group.tone === 'ok'
                                    ? tx(`ყველა ნორმაშია · ${group.rows.length}`, `All ${group.rows.length} in range`)
                                    : tx('ნორმა ფურცელზე არ წერია', 'No range on the sheet')}
                              </Text>
                            </View>
                            {open ? <ChevronDown size={18} color={M.c.text300} /> : <ChevronRight size={18} color={M.c.text300} />}
                          </Pressable>
                          {open
                            ? group.rows.map((row) => (
                                <Animated.View key={`${row.panelId}-${row.key}`} layout={layout} exiting={exiting}>
                                  <SwipeDeleteRow onDelete={() => hold({ panelId: row.panelId, key: row.key })}>
                                    {(openSwipe, a11y) => (
                                      <LabValueRow
                                        first={false}
                                        plain={labPlainName(row.key)}
                                        name={labRowName(row)}
                                        param={row}
                                        onPress={() => openParam(row.key)}
                                        onLongPress={openSwipe}
                                        a11y={a11y}
                                      />
                                    )}
                                  </SwipeDeleteRow>
                                </Animated.View>
                              ))
                            : null}
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={[hubText.body, { color: M.c.text200 }]}>{ka.lab.filterEmpty}</Text>
                )}
                <Text style={[hubText.caption, { color: M.c.text300, marginTop: 12, marginHorizontal: 4 }]}>
                  {tx(
                    'მწვანე ზოლი ფურცელზე დაბეჭდილი ნორმაა. დეტალებისთვის და ისტორიისთვის შეეხე მაჩვენებელს; წასაშლელად გადაწიე მარცხნივ.',
                    'The green part is the range printed on the sheet. Tap a value for details and history; swipe left to delete.',
                  )}
                </Text>
                </View>

              {comparison ? (
                <View style={{ marginTop: HUB.sectionGap }}>
                  <HomeSectionHeading title={tx('რა შეიცვალა', 'What changed')} />
                  <Text style={[hubText.caption, { color: M.c.text300, marginTop: -6, marginBottom: 10, marginHorizontal: 4 }]}>
                    {tx(`წინა ანალიზთან შედარებით (${formatLabDateKa(comparison.prevDate)})`, `Compared with the test before (${formatLabDateKa(comparison.prevDate)})`)}
                  </Text>
                  <LabChangesCard comparison={comparison} onOpen={openParam} />
                </View>
              ) : null}

              {analysis || needsExplain ? (
                <View style={{ marginTop: HUB.sectionGap }}>
                  <HomeSectionHeading title={tx('Medi-ს განმარტება', "Medi's explanation")} />
                  <LabMediCard
                    analysis={analysis}
                    dateLabel={title}
                    busy={explaining}
                    declined={declined}
                    error={explainError}
                    onExplain={() => void explain()}
                    onAsk={askMedi}
                  />
                </View>
              ) : null}

              <Text style={[hubText.caption, { color: M.c.text300, marginTop: 14, marginHorizontal: 4 }]}>
                {tx('ეს დიაგნოზი არ არის — შედეგი ექიმს აჩვენე, ის წაიკითხავს სხვა ანალიზებთან და შენს მდგომარეობასთან ერთად.', 'This is not a diagnosis — show the result to your doctor, who reads it with your other results and how you feel.')}
              </Text>
            </>
          )}
        </ScrollView>
      </SwipeGroup>

      {held ? <UndoToast key={`${held.panelId}-${held.key}`} title={tx('მაჩვენებელი წაიშალა', 'Value deleted')} bottom={insets.bottom + 16} onUndo={undo} /> : null}
      <QuotaSheet visible={quotaBlock !== undefined} resetsInMs={quotaBlock} onClose={() => setQuotaBlock(undefined)} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
});
