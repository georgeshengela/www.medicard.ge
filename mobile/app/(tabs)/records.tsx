import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronDown, ChevronRight, ChevronUp, FileText, type LucideIcon } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { MediHeaderButton } from '@/components/medi/MediHeaderButton';
import { MedilabHero } from '@/components/records/MedilabHero';
import { SwipeDeleteRow, SwipeGroup, type RowA11y } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { recordLook } from '@/components/records/recordTypes';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { EMPTY_ART } from '@/constants/appArt';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { useLab } from '@/hooks/useLab';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type MedicalRecord } from '@/lib/api';
import { isFeatureOn, isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { mediRoute } from '@/lib/mediModes';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { listDate, plainSummary, shortMonth } from '@/lib/recordsList';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

const RECORDS_KEY = ['records', 'list'] as const;
const EMPTY_RECORDS: MedicalRecord[] = [];
const fetchRecords = async () => (await api.records.list()).records;
type RecordType = MedicalRecord['type'];

const FILTER_ORDER: RecordType[] = ['CT_MRI', 'XRAY', 'SKIN', 'SKINCARE', 'SYMPTOM', 'PRESCRIPTION', 'LAB'];
/** Rows a section shows before „კიდევ N“. */
const FIRST = { tests: 3, records: 4 };

/**
 * MEDILAB (owner 2026-10-10: „everything clear, simple and beautiful; the test page was hard to
 * find“). One page, top to bottom: the latest lab test as the spotlight with one button straight to
 * it; three upload tiles (lab sheet, imaging, skin); earlier tests, each one tap from its page;
 * saved reports. Medi conversations live with Medi (its header's „ყველა საუბარი“), not here.
 * Long sections fold after a few rows. A lab sheet whose values were read lives under its test (the
 * test page links the sheet), so it is not listed twice. A report deletes with an iPhone swipe (or
 * long press) and comes back with „დაბრუნება“ for five seconds.
 */
export default function Records() {
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const reduceMotion = usePrefersReducedMotion();
  const ink = moduleInk('lab', dark);

  const [filter, setFilter] = useState<RecordType | 'ALL'>('ALL');
  const [open, setOpen] = useState({ tests: false, records: false });
  const [refreshing, setRefreshing] = useState(false);

  // Lab results, imaging, skin and Medi have admin switches of their own; saved entries stay listed.
  const features = useFeatureState();
  const labsOn = isFeatureOn('labs', features);
  const canScanLab = isHrefAvailable('/scan?type=lab', features);
  const canScanImaging = isHrefAvailable('/scan?type=imaging', features);
  const canScanSkin = isHrefAvailable('/scan?type=skin', features);
  const canChat = isHrefAvailable(mediRoute(), features);

  // Records: AI endpoints (lab, skin, Medi) and uploads invalidate 'records' after they save, so 30 s
  // fresh is safe.
  const recordsQuery = useAccountQuery({ key: [...RECORDS_KEY], fetch: fetchRecords, staleTime: FRESH.SHORT });
  const { panels, dates, byDate } = useLab();
  const ready = !recordsQuery.isPending || recordsQuery.fetchStatus === 'idle';

  // ---- delete with undo -------------------------------------------------------------------------
  const refetchRecords = recordsQuery.refetch;
  const { held: pending, remove: hold, undo } = useUndoDelete<string>((id) => {
    queryClient.setQueryData<MedicalRecord[]>(accountKey(...RECORDS_KEY), (prev) => prev?.filter((r) => r.id !== id));
    void api.records.remove(id).catch(() => refetchRecords());
  });

  // A lab sheet whose values were read is reached from its test; the rest stay in „დოკუმენტები“.
  const readSheets = useMemo(() => new Set(panels.flatMap((p) => p.recordIds ?? [])), [panels]);
  const records = useMemo(
    () =>
      (recordsQuery.data ?? EMPTY_RECORDS).filter(
        (r) => r.id !== pending && !(labsOn && r.type === 'LAB' && readSheets.has(r.id)),
      ),
    [recordsQuery.data, pending, labsOn, readSheets],
  );
  const earlierTests = useMemo(() => dates.slice(1), [dates]);

  // Filter chips only for the types she actually has, and only when there is more than one.
  const presentTypes = useMemo(() => FILTER_ORDER.filter((type) => records.some((r) => r.type === type)), [records]);
  const activeFilter = filter !== 'ALL' && presentTypes.includes(filter) ? filter : 'ALL';
  const visibleRecords = activeFilter === 'ALL' ? records : records.filter((r) => r.type === activeFilter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchRecords();
    } finally {
      setRefreshing(false);
    }
  }, [refetchRecords]);

  const openTest = (date: string) => router.push(`/lab/${date}` as never);
  const toggle = (key: keyof typeof open) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const uploads = [
    canScanLab ? { key: 'lab', look: recordLook('LAB'), label: tx('ანალიზი', 'Lab test'), href: '/scan?type=lab' } : null,
    canScanImaging ? { key: 'imaging', look: recordLook('XRAY'), label: tx('გამოსახულება', 'Imaging'), href: '/scan?type=imaging' } : null,
    canScanSkin ? { key: 'skin', look: recordLook('SKIN'), label: tx('კანი', 'Skin'), href: '/scan?type=skin' } : null,
  ].filter(Boolean) as { key: string; look: ReturnType<typeof recordLook>; label: string; href: string }[];

  const layout = reduceMotion ? undefined : LinearTransition.duration(220);
  const exiting = reduceMotion ? undefined : FadeOut.duration(140);
  const shownTests = open.tests ? earlierTests : earlierTests.slice(0, FIRST.tests);
  const shownRecords = open.records ? visibleRecords : visibleRecords.slice(0, FIRST.records);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <SwipeGroup>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabInset + 88, paddingHorizontal: HUB.gutter }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink} />}
          showsVerticalScrollIndicator={false}
        >
          {/* The standard MEDI module header (MEDIRUN's): back · wordmark + one line · Medi. */}
          <ModuleHeader
            module="lab"
            subtitle={tx('ანალიზები და დასკვნები', 'Lab tests and reports')}
            right={canChat ? <MediHeaderButton /> : undefined}
          />

          {labsOn ? (
            <View style={{ marginTop: 20 }}>
              <MedilabHero panels={panels} onOpenTest={openTest} onUpload={canScanLab ? () => router.push('/scan?type=lab' as never) : undefined} />
            </View>
          ) : null}

          {uploads.length ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('დაამატე', 'Add')} />
              <View style={s.uploads}>
                {uploads.map((u) => {
                  const color = hubInk(u.look.ink, dark);
                  const Icon = u.look.icon;
                  return (
                    <Pressable
                      key={u.key}
                      accessibilityRole="button"
                      accessibilityLabel={tx(`ატვირთვა: ${u.label}`, `Upload: ${u.label}`)}
                      onPress={() => router.push(u.href as never)}
                      style={[s.upload, { backgroundColor: c.surface }]}
                    >
                      <View style={[s.uploadIcon, { backgroundColor: hubTint(color, dark) }]}>
                        <Icon size={21} color={color} strokeWidth={1.9} />
                      </View>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[hubText.cardTitle, { fontSize: 12.5, lineHeight: 18, color: c.text100 }]}>{u.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {labsOn && earlierTests.length ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('წინა ანალიზები', 'Earlier tests')} linkLabel={tx('ყველა', 'All')} onLink={() => router.push('/lab' as never)} />
              <View style={[s.card, { backgroundColor: c.surface }]}>
                {shownTests.map((date, index) => {
                  const params = (byDate.get(date) ?? []).flatMap((panel) => panel.parameters);
                  const off = params.filter((p) => p.flag === 'H' || p.flag === 'L').length;
                  return <TestRow key={date} first={index === 0} date={date} count={params.length} off={off} onPress={() => openTest(date)} />;
                })}
                <MoreRow total={earlierTests.length} first={FIRST.tests} open={open.tests} onPress={() => toggle('tests')} />
              </View>
            </View>
          ) : null}

          {!ready ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <RecordsPageSkeleton />
            </View>
          ) : (
            <>
              <View style={{ marginTop: HUB.sectionGap }}>
                <HomeSectionHeading title={tx('დოკუმენტები', 'Reports')} />
                {presentTypes.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -HUB.gutter, marginBottom: 12 }}
                    contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 8 }}
                  >
                    {(['ALL', ...presentTypes] as const).map((option) => {
                      const selected = activeFilter === option;
                      const label = option === 'ALL' ? ka.records.filterAll : ka.records.types[option];
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setFilter(option)}
                          style={[s.chip, { backgroundColor: selected ? ink : c.surface }]}
                        >
                          <Text style={[hubText.link, { color: selected ? (dark ? '#1E1B4B' : '#FFFFFF') : c.text200 }]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
                {records.length === 0 ? (
                  <HubFeatureCard
                    icon={FileText}
                    lead={<Image source={EMPTY_ART.records} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors style={{ width: 56, height: 56, marginTop: -6 }} />}
                    title={tx('დასკვნები აქ შეინახება', 'Reports are saved here')}
                    body={tx('რენტგენი, CT/MRI, კანის შემოწმება და რეცეპტები — ზემოთ „დაამატე“-დან.', 'X-rays, CT/MRI, skin checks and prescriptions — from „Add“ above.')}
                  />
                ) : (
                  <View style={[s.card, { backgroundColor: c.surface }]}>
                    {shownRecords.map((record, index) => {
                      const look = recordLook(record.type);
                      return (
                        <Animated.View key={record.id} layout={layout} exiting={exiting}>
                          <SwipeDeleteRow onDelete={() => hold(record.id)}>
                            {(openSwipe, a11y) => (
                              <ListRow
                                first={index === 0}
                                icon={look.icon}
                                ink={look.ink}
                                title={look.title()}
                                date={listDate(record.createdAt)}
                                body={plainSummary(record.aiAnalysis)}
                                bodyLines={2}
                                onOpen={() => router.push(`/record/${record.id}` as never)}
                                onLongPress={openSwipe}
                                a11y={a11y}
                              />
                            )}
                          </SwipeDeleteRow>
                        </Animated.View>
                      );
                    })}
                    <MoreRow total={visibleRecords.length} first={FIRST.records} open={open.records} onPress={() => toggle('records')} />
                  </View>
                )}
              </View>

              {records.length > 0 ? (
                <Text style={[s.hint, { color: c.text300 }]}>{tx('წასაშლელად გადაწიე მარცხნივ', 'Swipe left to delete')}</Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </SwipeGroup>

      {pending ? (
        <UndoToast
          key={pending}
          title={tx('ჩანაწერი წაიშალა', 'Entry deleted')}
          bottom={tabInset + 12}
          onUndo={undo}
        />
      ) : null}
    </View>
  );
}

/** „კიდევ N“ / „ნაკლები“ at the foot of a folded section (nothing when everything already shows). */
function MoreRow({ total, first, open, onPress }: { total: number; first: number; open: boolean; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('lab', dark);
  if (total <= first) return null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.more, { borderTopColor: c.bg300 }]}>
      <Text style={[hubText.link, { color: ink }]}>{open ? tx('ნაკლების ჩვენება', 'Show less') : tx(`კიდევ ${total - first}`, `${total - first} more`)}</Text>
      {open ? <ChevronUp size={16} color={ink} /> : <ChevronDown size={16} color={ink} />}
    </Pressable>
  );
}

/** A lab test date: a small calendar leaf (day + month), the full date and what it holds. */
function TestRow({ first, date, count, off, onPress }: { first: boolean; date: string; count: number; off: number; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('lab', dark);
  const amber = hubInk('amber', dark);
  const [, m, d] = date.split('-').map(Number);
  const title = isTodayYmd(date) ? ka.common.today : formatLabDateKa(date);
  const summary = off
    ? tx(`${count} მაჩვენებელი · ${off} ნორმის გარეთ`, `${count} values · ${off} outside the range`)
    : tx(`${count} მაჩვენებელი · ყველა ნორმაშია`, `${count} values · all in range`);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${summary}`} onPress={onPress} style={s.testRow}>
      <View style={[s.leaf, { backgroundColor: hubTint(ink, dark) }]}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 19, color: ink }}>{d || ''}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, lineHeight: 13, color: ink }}>{m ? shortMonth(m - 1) : ''}</Text>
      </View>
      <View style={[s.testText, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{title}</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: off ? amber : c.text200 }]}>{summary}</Text>
        </View>
        <ChevronRight size={18} color={c.text300} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

/** One list row, Mail-style: icon tile · title with the date on the right · a short preview. */
function ListRow({
  first, icon: Icon, ink, title, date, body, bodyLines, onOpen, onLongPress, a11y,
}: {
  first: boolean; icon: LucideIcon; ink: HubInk; title: string; date: string; body?: string; bodyLines: number;
  onOpen: () => void; onLongPress: () => void; a11y: RowA11y;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const color = hubInk(ink, dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, date, body].filter(Boolean).join('. ')}
      accessibilityHint={tx('წასაშლელად გადაწიე მარცხნივ', 'Swipe left to delete')}
      {...a11y}
      onPress={onOpen}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[s.row, { backgroundColor: c.surface }]}
    >
      <View style={[s.tile, { backgroundColor: hubTint(color, dark) }]}>
        <Icon size={19} color={color} strokeWidth={1.9} />
      </View>
      <View style={[s.rowText, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
        <View style={s.rowTop}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { flex: 1, color: c.text100 }]}>{title}</Text>
          <Text style={[hubText.caption, { color: c.text300 }]}>{date}</Text>
        </View>
        {body ? <Text numberOfLines={bodyLines} style={[hubText.body, { color: c.text200 }]}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  uploads: { flexDirection: 'row', gap: 10 },
  upload: { flex: 1, minHeight: 92, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 12 },
  uploadIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  leaf: { width: HUB.tile, height: HUB.tile + 4, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  testText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 14 },
  more: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 12, paddingRight: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  hint: { textAlign: 'center', marginTop: 16, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 },
});
