import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import {
  FileText,
  MessageSquareText,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { MedilabHero } from '@/components/records/MedilabHero';
import { SwipeDeleteRow, SwipeGroup, type RowA11y } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { recordLook } from '@/components/records/recordTypes';
import { MedilabSegmented } from '@/components/lab/MedilabUI';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { EMPTY_ART } from '@/constants/appArt';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { useLab } from '@/hooks/useLab';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type ChatSummary, type MedicalRecord } from '@/lib/api';
import { isFeatureOn, isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { mediModeForSession, mediRoute } from '@/lib/mediModes';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { groupByPeriod, listDate, plainSummary } from '@/lib/recordsList';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

const RECORDS_KEY = ['records', 'list'] as const;
/** Under 'records' so a write to /api/records (or `invalidate('records')`) refreshes the whole tab. */
const CHATS_KEY = ['records', 'chats'] as const;
const EMPTY_RECORDS: MedicalRecord[] = [];
const EMPTY_CHATS: ChatSummary[] = [];
const fetchRecords = async () => (await api.records.list()).records;
const fetchChats = async () => (await api.chats.list()).sessions;

type Segment = 'records' | 'chats';
type RecordType = MedicalRecord['type'];

const FILTER_ORDER: RecordType[] = ['LAB', 'CT_MRI', 'XRAY', 'SKIN', 'SKINCARE', 'SYMPTOM', 'PRESCRIPTION'];

/**
 * MEDILAB („ჩემი ბარათი“) — the latest lab values as range bars, every saved report and every Medi
 * conversation. Two segments keep it short; rows delete with an iPhone swipe (or long press) and come
 * back with „დაბრუნება“ for five seconds, so nothing is lost by a stray swipe.
 */
export default function Records() {
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const reduceMotion = usePrefersReducedMotion();
  const ink = moduleInk('lab', dark);

  const [segment, setSegment] = useState<Segment>('records');
  const [filter, setFilter] = useState<RecordType | 'ALL'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // Lab results, imaging, skin and Medi have admin switches of their own; saved entries stay listed.
  const features = useFeatureState();
  const labsOn = isFeatureOn('labs', features);
  const canScanLab = isHrefAvailable('/scan?type=lab', features);
  const canScan = canScanLab || isHrefAvailable('/scan?type=imaging', features) || isHrefAvailable('/scan?type=skin', features);
  const canChat = isHrefAvailable(mediRoute(), features);

  // Records: AI endpoints (lab, skin, Medi) and uploads invalidate 'records' after they save, so 30 s
  // fresh is safe. Chats stay LIVE: streamed Medi answers bypass api.ts and never signal.
  const recordsQuery = useAccountQuery({ key: [...RECORDS_KEY], fetch: fetchRecords, staleTime: FRESH.SHORT });
  const chatsQuery = useAccountQuery({ key: [...CHATS_KEY], fetch: fetchChats, staleTime: FRESH.LIVE });
  const { panels } = useLab();
  const settled = (q: { isPending: boolean; fetchStatus: string }) => !q.isPending || q.fetchStatus === 'idle';
  const ready = settled(recordsQuery) && settled(chatsQuery);

  // ---- delete with undo -------------------------------------------------------------------------
  const refetchRecords = recordsQuery.refetch;
  const refetchChats = chatsQuery.refetch;
  const { held: pending, remove: hold, undo } = useUndoDelete<{ kind: Segment; id: string }>((item) => {
    if (item.kind === 'records') {
      queryClient.setQueryData<MedicalRecord[]>(accountKey(...RECORDS_KEY), (prev) => prev?.filter((r) => r.id !== item.id));
      void api.records.remove(item.id).catch(() => refetchRecords());
    } else {
      queryClient.setQueryData<ChatSummary[]>(accountKey(...CHATS_KEY), (prev) => prev?.filter((chat) => chat.id !== item.id));
      void api.chats.remove(item.id).catch(() => refetchChats());
    }
  });
  const remove = (kind: Segment, id: string) => hold({ kind, id });

  const records = useMemo(
    () => (recordsQuery.data ?? EMPTY_RECORDS).filter((r) => !(pending?.kind === 'records' && pending.id === r.id)),
    [recordsQuery.data, pending],
  );
  const chats = useMemo(
    () => (chatsQuery.data ?? EMPTY_CHATS).filter((chat) => !(pending?.kind === 'chats' && pending.id === chat.id)),
    [chatsQuery.data, pending],
  );

  // Filter chips only for the types she actually has, and only when there is more than one.
  const presentTypes = useMemo(() => FILTER_ORDER.filter((type) => records.some((r) => r.type === type)), [records]);
  const activeFilter = filter !== 'ALL' && presentTypes.includes(filter) ? filter : 'ALL';
  const visibleRecords = activeFilter === 'ALL' ? records : records.filter((r) => r.type === activeFilter);
  const recordGroups = useMemo(() => groupByPeriod(visibleRecords, (r) => r.createdAt), [visibleRecords]);
  const chatGroups = useMemo(() => groupByPeriod(chats, (chat) => chat.updatedAt), [chats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchRecords(), refetchChats()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchRecords, refetchChats]);

  const upload = canScan ? () => router.push('/scan' as never) : undefined;
  const newChat = canChat ? () => router.push(mediRoute() as never) : undefined;
  const headerAction = segment === 'records' ? upload : newChat;

  const layout = reduceMotion ? undefined : LinearTransition.duration(220);
  const exiting = reduceMotion ? undefined : FadeOut.duration(140);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <SwipeGroup>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabInset + 88 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink} />}
          showsVerticalScrollIndicator={false}
        >
          {/* The standard MEDI module header (MEDIRUN's): back · wordmark + one line · one icon button. */}
          <ModuleHeader
            module="lab"
            subtitle={tx('ანალიზები, დასკვნები და საუბრები', 'Lab tests, reports and conversations')}
            style={s.section}
            right={headerAction ? (
              <ModuleHeaderButton
                label={segment === 'records' ? ka.records.addCta : tx('ახალი საუბარი', 'New conversation')}
                icon={Plus}
                onPress={headerAction}
              />
            ) : undefined}
          />
          {labsOn ? (
            <View style={[s.section, { marginTop: HUB.sectionGap - 8 }]}>
              <MedilabHero
                panels={panels}
                onOpenLab={() => router.push('/lab' as never)}
                onUpload={canScanLab ? () => router.push('/scan?type=lab' as never) : undefined}
              />
            </View>
          ) : null}

          <View style={[s.section, { marginTop: labsOn ? 20 : HUB.sectionGap - 8 }]}>
            <MedilabSegmented
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'records', label: tx('ჩანაწერები', 'Entries'), count: ready ? records.length : undefined },
                { value: 'chats', label: tx('საუბრები', 'Conversations'), count: ready ? chats.length : undefined },
              ]}
            />
          </View>

          {!ready ? (
            <View style={[s.section, { marginTop: 16 }]}>
              <RecordsPageSkeleton />
            </View>
          ) : segment === 'records' ? (
            <>
              {presentTypes.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 14 }}
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
                <View style={[s.section, { marginTop: 16 }]}>
                  <HubFeatureCard
                    icon={FileText}
                    lead={<Image source={EMPTY_ART.records} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors style={{ width: 56, height: 56, marginTop: -6 }} />}
                    title={ka.records.empty}
                    body={ka.records.emptyHint}
                    cta={upload ? ka.records.addCta : undefined}
                    onPress={upload}
                  />
                </View>
              ) : (
                recordGroups.map((group) => (
                  <View key={group.label} style={[s.section, { marginTop: 18 }]}>
                    <Text style={[s.groupLabel, { color: c.text300 }]}>{group.label}</Text>
                    <View style={[s.card, { backgroundColor: c.surface }]}>
                      {group.items.map((record, index) => {
                        const look = recordLook(record.type);
                        return (
                          <Animated.View key={record.id} layout={layout} exiting={exiting}>
                            <SwipeDeleteRow onDelete={() => remove('records', record.id)}>
                              {(open, a11y) => (
                                <ListRow
                                  first={index === 0}
                                  icon={look.icon}
                                  ink={look.ink}
                                  title={look.title()}
                                  date={listDate(record.createdAt)}
                                  body={plainSummary(record.aiAnalysis)}
                                  bodyLines={2}
                                  onOpen={() => router.push(`/record/${record.id}` as never)}
                                  onLongPress={open}
                                  a11y={a11y}
                                />
                              )}
                            </SwipeDeleteRow>
                          </Animated.View>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </>
          ) : chats.length === 0 ? (
            <View style={[s.section, { marginTop: 16 }]}>
              <HubFeatureCard
                icon={MessageSquareText}
                title={tx('საუბრები აქ შეინახება', 'Conversations are saved here')}
                body={tx('ჰკითხე Medi-ს ნებისმიერი რამ ჯანმრთელობაზე — ყველა საუბარი აქ დაგხვდება.', 'Ask Medi anything about your health — every conversation will wait for you here.')}
                cta={newChat ? tx('საუბრის დაწყება', 'Start a conversation') : undefined}
                onPress={newChat}
              />
            </View>
          ) : (
            chatGroups.map((group) => (
              <View key={group.label} style={[s.section, { marginTop: 18 }]}>
                <Text style={[s.groupLabel, { color: c.text300 }]}>{group.label}</Text>
                <View style={[s.card, { backgroundColor: c.surface }]}>
                  {group.items.map((chat, index) => {
                    const mode = mediModeForSession(chat.mode);
                    return (
                      <Animated.View key={chat.id} layout={layout} exiting={exiting}>
                        <SwipeDeleteRow onDelete={() => remove('chats', chat.id)}>
                          {(open, a11y) => (
                            <ListRow
                              first={index === 0}
                              icon={MessageSquareText}
                              ink={mode === 'deep' ? 'violet' : mode === 'doctor' ? 'teal' : 'sky'}
                              title={chat.title}
                              date={listDate(chat.updatedAt)}
                              tag={mode === 'medi' ? undefined : ka.chat.mediModes[mode]}
                              body={chat.preview}
                              bodyLines={1}
                              onOpen={() => router.push(mediRoute({ mode, sessionId: chat.id }) as never)}
                              onLongPress={open}
                              a11y={a11y}
                            />
                          )}
                        </SwipeDeleteRow>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          {ready && (segment === 'records' ? records.length : chats.length) > 0 ? (
            <Text style={[s.hint, { color: c.text300 }]}>
              {tx('წასაშლელად გადაწიე მარცხნივ', 'Swipe left to delete')}
            </Text>
          ) : null}
        </ScrollView>
      </SwipeGroup>

      {pending ? (
        <UndoToast
          key={`${pending.kind}-${pending.id}`}
          title={pending.kind === 'records' ? tx('ჩანაწერი წაიშალა', 'Entry deleted') : tx('საუბარი წაიშალა', 'Conversation deleted')}
          bottom={tabInset + 12}
          onUndo={undo}
        />
      ) : null}
    </View>
  );
}

/** One list row, Mail-style: icon tile · title with the date on the right · a short preview. */
function ListRow({
  first, icon: Icon, ink, title, date, tag, body, bodyLines, onOpen, onLongPress, a11y,
}: {
  first: boolean; icon: LucideIcon; ink: HubInk; title: string; date: string; tag?: string; body?: string; bodyLines: number;
  onOpen: () => void; onLongPress: () => void; a11y: RowA11y;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const color = hubInk(ink, dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, tag, date, body].filter(Boolean).join('. ')}
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
        {tag ? <Text numberOfLines={1} style={[hubText.small, { color, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tag}</Text> : null}
        {body ? <Text numberOfLines={bodyLines} style={[hubText.body, { color: c.text200 }]}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter },
  chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
  groupLabel: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 12, paddingRight: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  hint: { textAlign: 'center', marginTop: 16, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 },
});
