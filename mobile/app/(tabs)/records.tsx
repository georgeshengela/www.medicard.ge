import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ChevronRight,
  FileText,
  FlaskConical,
  MessageSquareText,
  Plus,
  ScanFace,
  ScanLine,
  Sparkles,
  Stethoscope,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { HomeLabSection } from '@/components/home/HomeLabSection';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { HubTileGrid, type HubTile } from '@/components/home/HubTiles';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { EMPTY_ART } from '@/constants/appArt';
import { ka } from '@/i18n/ka';
import { api, type ChatSummary, type MedicalRecord } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { mediModeForSession, mediRoute } from '@/lib/mediModes';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { isFeatureOn, isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { tx } from '@/i18n/locale';

const RECORDS_KEY = ['records', 'list'] as const;
/** Under 'records' so a write to /api/records (or `invalidate('records')`) refreshes the whole tab. */
const CHATS_KEY = ['records', 'chats'] as const;
const EMPTY_RECORDS: MedicalRecord[] = [];
const EMPTY_CHATS: ChatSummary[] = [];
const fetchRecords = async () => (await api.records.list()).records;
const fetchChats = async () => (await api.chats.list()).sessions;

const FILTERS = ['ALL', 'LAB', 'CT_MRI', 'SKIN', 'SKINCARE', 'SYMPTOM'] as const;

const TYPE_LOOK: Record<string, { icon: LucideIcon; ink: HubInk }> = {
  LAB: { icon: FlaskConical, ink: 'blue' },
  CT_MRI: { icon: ScanLine, ink: 'sky' },
  XRAY: { icon: ScanLine, ink: 'sky' },
  IMAGING: { icon: ScanLine, ink: 'sky' },
  SKIN: { icon: ScanFace, ink: 'rose' },
  SKINCARE: { icon: Sparkles, ink: 'violet' },
  SYMPTOM: { icon: Stethoscope, ink: 'teal' },
};

const ADD_TILES: HubTile[] = [
  { key: 'lab', title: ka.records.addLab, detail: tx('ფოტო ან PDF — ნორმებით', 'Photo or PDF — with reference ranges'), href: '/lab/analyze', icon: FlaskConical, ink: 'blue' },
  { key: 'imaging', title: ka.records.addImaging, detail: tx('რენტგენი, ექო, MRI', 'X-ray, ultrasound, MRI'), href: '/module/imaging', icon: ScanLine, ink: 'sky' },
  { key: 'skin', title: tx('კანი', 'Skin'), detail: tx('ფოტოს შეფასება', 'Photo check'), href: '/module/skin', icon: ScanFace, ink: 'rose' },
  { key: 'symptoms', title: tx('სიმპტომები', 'Symptoms'), detail: tx('აღწერე, რა გაწუხებს', 'Describe what bothers you'), href: '/symptoms', icon: Stethoscope, ink: 'teal' },
];

/** The header „+“ sheet. */
const UPLOADS = [
  { text: ka.records.addLab, href: '/lab/analyze' },
  { text: ka.records.addImaging, href: '/module/imaging' },
];

/** "ჩემი ბარათი" — lab results, saved analyses and every conversation with Medi, in the Home hub language. */
export default function Records() {
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const tabInset = useTabBarInset();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  // Lab results, imaging, skin and symptoms have admin switches of their own; saved entries stay listed.
  const features = useFeatureState();
  const labsOn = isFeatureOn('labs', features);
  const addTiles = ADD_TILES.filter((tile) => isHrefAvailable(tile.href, features));
  const uploads = useMemo(() => UPLOADS.filter((option) => isHrefAvailable(option.href, features)), [features]);

  // Records: AI endpoints (lab, skin, Medi) and uploads invalidate 'records' after they save, so 30 s
  // fresh is safe. Chats stay LIVE: streamed Medi answers bypass api.ts and never signal.
  const recordsQuery = useAccountQuery({ key: [...RECORDS_KEY], fetch: fetchRecords, staleTime: FRESH.SHORT });
  const chatsQuery = useAccountQuery({ key: [...CHATS_KEY], fetch: fetchChats, staleTime: FRESH.LIVE });
  const records = recordsQuery.data ?? EMPTY_RECORDS;
  const chats = chatsQuery.data ?? EMPTY_CHATS;
  const settled = (q: { isPending: boolean; fetchStatus: string }) => !q.isPending || q.fetchStatus === 'idle';
  const ready = settled(recordsQuery) && settled(chatsQuery);

  const refetchRecords = recordsQuery.refetch;
  const refetchChats = chatsQuery.refetch;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchRecords(), refetchChats()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchRecords, refetchChats]);

  const visible = useMemo(
    () => (filter === 'ALL' ? records : records.filter((record) => record.type === filter)),
    [records, filter],
  );

  // Deleting a medical record or conversation is permanent, so it always asks first.
  const confirmDelete = (message: string, onConfirm: () => void) =>
    Alert.alert(message, undefined, [
      { text: ka.common.cancel, style: 'cancel' },
      { text: ka.common.delete, style: 'destructive', onPress: onConfirm },
    ]);

  const removeRecord = (id: string) =>
    confirmDelete(ka.records.deleteConfirm, () => {
      queryClient.setQueryData<MedicalRecord[]>(accountKey(...RECORDS_KEY), (prev) =>
        prev?.filter((record) => record.id !== id),
      );
      void api.records.remove(id).catch(() => refetchRecords());
    });

  const removeChat = (id: string) =>
    confirmDelete(ka.chats.deleteConfirm, () => {
      queryClient.setQueryData<ChatSummary[]>(accountKey(...CHATS_KEY), (prev) => prev?.filter((chat) => chat.id !== id));
      void api.chats.remove(id).catch(() => refetchChats());
    });

  const isEmpty = records.length === 0 && chats.length === 0;

  const startUpload = useCallback(() => {
    Alert.alert(ka.records.addCta, ka.records.emptyHint, [
      { text: ka.common.cancel, style: 'cancel' },
      ...uploads.map((option) => ({ text: option.text, onPress: () => router.push(option.href as never) })),
    ]);
  }, [router, uploads]);
  const canUpload = uploads.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => !canUpload ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.records.addCta}
              hitSlop={10}
              onPress={startUpload}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={22} color={c.primary200} strokeWidth={2.3} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{ paddingBottom: tabInset + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary200} />}
        showsVerticalScrollIndicator={false}
      >
        {labsOn ? (
          <View style={[s.section, { marginTop: 12 }]}>
            <HomeLabSection edgeInset={0} />
          </View>
        ) : null}

        {!ready ? (
          <View style={s.section}>
            <RecordsPageSkeleton />
          </View>
        ) : isEmpty ? (
          <View style={s.section}>
            <HubFeatureCard
              tone="spotlight"
              icon={FileText}
              lead={
                <Image
                  source={EMPTY_ART.records}
                  resizeMode="contain"
                  accessible={false}
                  accessibilityIgnoresInvertColors
                  style={{ width: 56, height: 56, marginTop: -6 }}
                />
              }
              title={ka.records.empty}
              body={ka.records.emptyHint}
              cta={canUpload ? ka.records.addCta : undefined}
              onPress={canUpload ? startUpload : undefined}
            />
          </View>
        ) : (
          <>
            {records.length > 0 ? (
              <View style={s.section}>
                <HomeSectionHeading title={tx('ანალიზები და დასკვნები', 'Tests and reports')} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -HUB.gutter, marginBottom: 12 }} contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 8 }}>
                  {FILTERS.map((option) => {
                    const selected = filter === option;
                    const label = option === 'ALL' ? ka.records.filterAll : ka.records.types[option];
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setFilter(option)}
                        style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: selected ? c.primary200 : c.surface }}
                      >
                        <Text style={[hubText.link, { color: selected ? '#FFFFFF' : c.text200 }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={[s.card, { backgroundColor: c.surface }]}>
                  {visible.length === 0 ? (
                    <Text style={[hubText.body, { color: c.text200, paddingVertical: 16 }]}>{tx('ამ ტიპის ჩანაწერი ჯერ არ გაქვს.', "You don't have entries of this type yet.")}</Text>
                  ) : (
                    visible.map((record, index) => {
                      const look = TYPE_LOOK[record.type] ?? { icon: FileText, ink: 'neutral' as HubInk };
                      return (
                        <HubRow
                          key={record.id}
                          first={index === 0}
                          icon={look.icon}
                          ink={look.ink}
                          title={ka.records.types[record.type as keyof typeof ka.records.types] ?? record.type}
                          meta={formatRelative(record.createdAt)}
                          body={plainSummary(record.aiAnalysis)}
                          onOpen={() => router.push(`/record/${record.id}` as never)}
                          onDelete={() => removeRecord(record.id)}
                          dark={dark}
                        />
                      );
                    })
                  )}
                </View>
              </View>
            ) : null}

            {chats.length > 0 ? (
              <View style={s.section}>
                <HomeSectionHeading title={ka.chats.title} linkLabel="Medi" onLink={() => router.push(mediRoute() as never)} />
                <View style={[s.card, { backgroundColor: c.surface }]}>
                  {chats.map((chat, index) => {
                    const mode = mediModeForSession(chat.mode);
                    return (
                      <HubRow
                        key={chat.id}
                        first={index === 0}
                        icon={MessageSquareText}
                        ink={mode === 'deep' ? 'violet' : mode === 'doctor' ? 'teal' : 'sky'}
                        title={chat.title}
                        meta={`${ka.chat.mediModes[mode]} · ${formatRelative(chat.updatedAt)}`}
                        body={chat.preview}
                        onOpen={() => router.push(mediRoute({ mode, sessionId: chat.id }) as never)}
                        onDelete={() => removeChat(chat.id)}
                        dark={dark}
                        chevron
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        )}

        {addTiles.length ? (
          <View style={s.section}>
            <HomeSectionHeading title={tx('დამატება', 'Add')} />
            <HubTileGrid tiles={addTiles} />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

/** One list row: the open area and the delete button are siblings, never a button inside a button. */
function HubRow({
  first, icon: Icon, ink, title, meta, body, onOpen, onDelete, dark, chevron,
}: {
  first: boolean; icon: LucideIcon; ink: HubInk; title: string; meta: string; body?: string;
  onOpen: () => void; onDelete: () => void; dark: boolean; chevron?: boolean;
}) {
  const c = useThemeColors();
  const color = hubInk(ink, dark);
  return (
    <View style={[s.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`} onPress={onOpen} style={s.rowMain}>
        <View style={[s.tile, { backgroundColor: hubTint(color, dark) }]}>
          <Icon size={19} color={color} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{title}</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{meta}</Text>
          {body ? <Text numberOfLines={2} style={[hubText.body, { color: c.text200 }]}>{body}</Text> : null}
        </View>
        {chevron ? <ChevronRight size={18} color={c.text300} strokeWidth={2.2} /> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={ka.common.delete} onPress={onDelete} style={s.delete}>
        <Trash2 size={16} color={c.text300} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** First readable sentence of the Markdown analysis, for the list preview. */
function plainSummary(markdown: string): string {
  const line = (markdown || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('|'));

  if (!line) return '';
  const clean = line.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1').replace(/[*`>]/g, '');
  return clean.length <= 130 ? clean : `${clean.slice(0, 127)}…`;
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 64 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
});
