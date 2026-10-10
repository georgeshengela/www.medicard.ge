import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronRight, MessageCircle, Plus } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { LabAlignCard } from '@/components/lab/LabAlignCard';
import { LabMoversCard } from '@/components/lab/LabMoversCard';
import { LabParamRow } from '@/components/lab/LabParamRow';
import { MedilabActionRow, MedilabChips, MedilabSearch, MedilabSegmented, useMedilab } from '@/components/lab/MedilabUI';
import { MedilabHero } from '@/components/records/MedilabHero';
import { SwipeDeleteRow, SwipeGroup, type RowA11y } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { useLab } from '@/hooks/useLab';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { labFlagCounts, labParamMatches, type LabFlagFilter } from '@/lib/labFilter';
import { labMediPrompt } from '@/lib/labMediPrompt';
import { summarizeLabMovers } from '@/lib/labMovers';
import { labRowName } from '@/lib/labNames';
import { localAccountId } from '@/lib/localAccount';
import { mediPrefillRoute } from '@/lib/mediHandoff';
import { shortMonth } from '@/lib/recordsList';
import { HUB, hubText } from '@/theme/hub';

type Mode = 'tests' | 'off';

/**
 * MEDILAB · ლაბორატორია — the latest sheet as range bars, then every test by date or every value
 * outside its range. A test deletes with the iPhone swipe and comes back with „დაბრუნება“.
 */
export default function LabHubScreen() {
  const M = useMedilab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = usePrefersReducedMotion();
  const { dates, byDate, panels, loading, replaceAll, remove } = useLab();
  const features = useFeatureState();
  const canUpload = isHrefAvailable('/scan?type=lab', features);
  const [mode, setMode] = useState<Mode>('tests');
  const [query, setQuery] = useState('');
  const [flag, setFlag] = useState<LabFlagFilter>('watch');

  // A deleted test is hidden at once; its panels are removed after the undo window.
  const { held, remove: hold, undo } = useUndoDelete<string>((date) => {
    const ids = (byDate.get(date) ?? []).map((panel) => panel.id);
    void (async () => {
      for (const id of ids) await remove(id); // one at a time: each call rewrites the stored list
    })();
  });
  const shownPanels = useMemo(() => panels.filter((panel) => panel.date !== held), [panels, held]);
  const shownDates = useMemo(() => dates.filter((date) => date !== held), [dates, held]);

  const movers = useMemo(() => summarizeLabMovers(shownPanels), [shownPanels]);
  const allParams = useMemo(
    () => shownPanels.flatMap((panel) => panel.parameters.map((param) => ({ ...param, date: panel.date, panelId: panel.id }))),
    [shownPanels],
  );
  const offParams = useMemo(() => allParams.filter((row) => row.flag === 'H' || row.flag === 'L'), [allParams]);
  const counts = useMemo(() => labFlagCounts(offParams), [offParams]);
  const offRows = useMemo(
    () => allParams.filter((row) => labParamMatches(row, query, flag)).sort((a, b) => b.date.localeCompare(a.date)),
    [allParams, flag, query],
  );
  const visibleDates = useMemo(() => {
    if (!query.trim()) return shownDates;
    return shownDates.filter((date) => (byDate.get(date) ?? []).some((panel) => panel.parameters.some((param) => labParamMatches(param, query, 'all'))));
  }, [byDate, shownDates, query]);

  const has = shownDates.length > 0;
  const layout = reduceMotion ? undefined : LinearTransition.duration(220);
  const exiting = reduceMotion ? undefined : FadeOut.duration(140);
  const upload = () => router.push('/scan?type=lab' as never);

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
            subtitle={tx('ანალიზების მაჩვენებლები', 'Lab values')}
            right={canUpload ? <ModuleHeaderButton label={tx('ანალიზის ატვირთვა', 'Upload a lab test')} icon={Plus} onPress={upload} /> : undefined}
          />

          <View style={{ marginTop: 20 }}>
            {loading && !has ? (
              <RecordsPageSkeleton />
            ) : (
              <MedilabHero
                panels={shownPanels}
                onOpenTest={(date) => router.push(`/lab/${date}` as never)}
                onUpload={canUpload ? upload : undefined}
              />
            )}
          </View>

          {has ? (
            <>
              <MedilabSegmented
                style={{ marginTop: 20 }}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'tests', label: tx('ანალიზები', 'Tests'), count: shownDates.length },
                  { value: 'off', label: tx('ნორმის გარეთ', 'Out of range'), count: offParams.length },
                ]}
              />
              {allParams.length > 6 ? (
                <View style={{ marginTop: 12 }}>
                  <MedilabSearch value={query} onChange={setQuery} />
                </View>
              ) : null}

              {mode === 'tests' ? (
                <>
                  {movers.length && !query.trim() ? (
                    <View style={{ marginTop: HUB.sectionGap }}>
                      <HomeSectionHeading title={ka.lab.movers} />
                      <LabMoversCard movers={movers} onOpen={(key) => router.push(`/lab/param/${encodeURIComponent(key)}` as never)} />
                    </View>
                  ) : null}
                  <View style={{ marginTop: HUB.sectionGap }}>
                    <HomeSectionHeading title={tx('ყველა ანალიზი', 'All tests')} />
                    {visibleDates.length ? (
                      <View style={s.card}>
                        {visibleDates.map((date, index) => {
                          const params = (byDate.get(date) ?? []).flatMap((panel) => panel.parameters);
                          const off = params.filter((p) => p.flag === 'H' || p.flag === 'L').length;
                          return (
                            <Animated.View key={date} layout={layout} exiting={exiting}>
                              <SwipeDeleteRow onDelete={() => hold(date)}>
                                {(open, a11y) => (
                                  <TestRow
                                    first={index === 0}
                                    date={date}
                                    count={params.length}
                                    off={off}
                                    onPress={() => router.push(`/lab/${date}` as never)}
                                    onLongPress={open}
                                    a11y={a11y}
                                  />
                                )}
                              </SwipeDeleteRow>
                            </Animated.View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={[hubText.body, { color: M.c.text200 }]}>{ka.lab.filterEmpty}</Text>
                    )}
                  </View>
                </>
              ) : (
                <View style={{ marginTop: 16 }}>
                  {counts.H > 0 && counts.L > 0 ? (
                    <View style={{ marginBottom: 12 }}>
                      <MedilabChips
                        value={flag}
                        onChange={setFlag}
                        options={[
                          { value: 'watch', label: ka.lab.filterAll, count: counts.watch },
                          { value: 'L', label: ka.lab.filterLow, count: counts.L },
                          { value: 'H', label: ka.lab.filterHigh, count: counts.H },
                        ]}
                      />
                    </View>
                  ) : null}
                  {offRows.length ? (
                    <View style={s.card}>
                      {offRows.map((row, index) => (
                        <LabParamRow
                          key={`${row.panelId}-${row.key}`}
                          first={index === 0}
                          name={labRowName(row)}
                          sub={isTodayYmd(row.date) ? ka.common.today : formatLabDateKa(row.date)}
                          value={row.value}
                          display={row.display}
                          unit={row.unit}
                          flag={row.flag}
                          refLow={row.refLow}
                          refHigh={row.refHigh}
                          onPress={() => router.push(`/lab/param/${encodeURIComponent(row.key)}` as never)}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={[hubText.body, { color: M.c.text200 }]}>{offParams.length ? ka.lab.filterEmpty : ka.lab.watchEmpty}</Text>
                  )}
                </View>
              )}

              <View style={{ marginTop: HUB.sectionGap, gap: 10 }}>
                <MedilabActionRow
                  icon={MessageCircle}
                  title={ka.lab.askMediChat}
                  body={tx('ბოლო შედეგებს კითხვად მოვამზადებ — გაგზავნამდე ნახავ', 'Your latest results become a question — you see it before sending')}
                  // Lab values wait in memory (mediHandoff); the route carries only `handoff=1`.
                  onPress={() => router.push(mediPrefillRoute(localAccountId(), labMediPrompt(shownPanels)) as never)}
                />
                <LabAlignCard panels={shownPanels} onApplied={replaceAll} />
              </View>
            </>
          ) : null}
        </ScrollView>
      </SwipeGroup>

      {held ? <UndoToast key={held} title={tx('ანალიზი წაიშალა', 'Test deleted')} bottom={insets.bottom + 16} onUndo={undo} /> : null}
    </View>
  );
}

/** A test date: a small calendar leaf (day + month), the full date and what it holds. */
function TestRow({ first, date, count, off, onPress, onLongPress, a11y }: {
  first: boolean; date: string; count: number; off: number; onPress: () => void; onLongPress: () => void; a11y: RowA11y;
}) {
  const M = useMedilab();
  const [, m, d] = date.split('-').map(Number);
  const title = isTodayYmd(date) ? ka.common.today : formatLabDateKa(date);
  const summary = off
    ? tx(`${count} მაჩვენებელი · ${off} ნორმის გარეთ`, `${count} values · ${off} out of range`)
    : tx(`${count} მაჩვენებელი · ყველა ნორმაშია`, `${count} values · all in range`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}`}
      accessibilityHint={tx('წასაშლელად გადაწიე მარცხნივ', 'Swipe left to delete')}
      {...a11y}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, backgroundColor: M.c.surface }}
    >
      <View style={[s.leaf, { backgroundColor: M.inkSoft }]}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 19, color: M.ink }}>{d || ''}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, lineHeight: 13, color: M.ink }}>{m ? shortMonth(m - 1) : ''}</Text>
      </View>
      <View style={[s.testText, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: M.c.bg300 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: M.c.text100 }]}>{title}</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: off ? M.attention : M.c.text200 }]}>{summary}</Text>
        </View>
        <ChevronRight size={18} color={M.c.text300} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  leaf: { width: HUB.tile, height: HUB.tile + 4, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  testText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 14 },
});
