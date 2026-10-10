import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MessageSquareText, SquarePen } from 'lucide-react-native';
import { SwipeDeleteRow, SwipeGroup, type RowA11y } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, type ChatSummary } from '@/lib/api';
import { mediModeForSession, type MediMode } from '@/lib/mediModes';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { groupByPeriod, listDate } from '@/lib/recordsList';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** Under 'records' so a write to /api/records (or `invalidate('records')`) refreshes it too. */
const CHATS_KEY = ['records', 'chats'] as const;
const EMPTY: ChatSummary[] = [];
const fetchChats = async () => (await api.chats.list()).sessions;

/**
 * Every Medi conversation, opened from Medi itself (owner 2026-10-10: conversations got lost inside
 * MEDILAB and do not belong there). A sheet over the chat: „ახალი საუბარი“ on top, then the threads by
 * period — the current one marked — each opening in place; a row deletes with the iPhone swipe and
 * comes back with „დაბრუნება“ for five seconds.
 */
export function MediHistorySheet({ visible, currentId, onClose, onOpen, onNew }: {
  visible: boolean;
  currentId?: string;
  onClose: () => void;
  onOpen: (mode: MediMode, sessionId: string) => void;
  /** null while the current chat is already empty. */
  onNew: (() => void) | null;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  // Live: streamed Medi answers bypass api.ts and never signal a write.
  const query = useAccountQuery({ key: [...CHATS_KEY], fetch: fetchChats, staleTime: FRESH.LIVE, enabled: visible });
  const refetch = query.refetch;
  const { held, remove: hold, undo } = useUndoDelete<string>((id) => {
    queryClient.setQueryData<ChatSummary[]>(accountKey(...CHATS_KEY), (prev) => prev?.filter((chat) => chat.id !== id));
    void api.chats.remove(id).catch(() => refetch());
  });
  const chats = useMemo(() => (query.data ?? EMPTY).filter((chat) => chat.id !== held), [query.data, held]);
  const groups = useMemo(() => groupByPeriod(chats, (chat) => chat.updatedAt), [chats]);
  const loading = query.isPending && query.fetchStatus !== 'idle';
  const ink = hubInk('teal', dark);

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
          <View style={[s.sheet, { backgroundColor: c.bg100, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={[s.grabber, { backgroundColor: c.bg300 }]} />
            <View style={s.head}>
              <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>{tx('საუბრები', 'Conversations')}</Text>
              {chats.length ? <Text style={[hubText.caption, { color: c.text300 }]}>{chats.length}</Text> : null}
            </View>

            <SwipeGroup>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                {onNew ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { onClose(); onNew(); }}
                    style={[s.newRow, { backgroundColor: c.surface }]}
                  >
                    <View style={[s.tile, { marginTop: 0, backgroundColor: hubTint(ink, dark) }]}>
                      <SquarePen size={18} color={ink} strokeWidth={2} />
                    </View>
                    <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ახალი საუბარი', 'New conversation')}</Text>
                  </Pressable>
                ) : null}

                {loading && !chats.length ? (
                  <Text style={[hubText.body, s.calm, { color: c.text300 }]}>{ka.common.loading}</Text>
                ) : !chats.length ? (
                  <Text style={[hubText.body, s.calm, { color: c.text200 }]}>
                    {tx('აქ შეინახება ყველა საუბარი Medi-სთან — დაუბრუნდები ნებისმიერ დროს.', 'Every conversation with Medi is kept here — come back to any of them.')}
                  </Text>
                ) : (
                  groups.map((group) => (
                    <View key={group.label} style={{ marginTop: 16 }}>
                      <Text style={[s.groupLabel, { color: c.text300 }]}>{group.label}</Text>
                      <View style={[s.card, { backgroundColor: c.surface }]}>
                        {group.items.map((chat, index) => {
                          const mode = mediModeForSession(chat.mode);
                          return (
                            <SwipeDeleteRow key={chat.id} onDelete={() => hold(chat.id)}>
                              {(open, a11y) => (
                                <ChatRow
                                  first={index === 0}
                                  chat={chat}
                                  mode={mode}
                                  current={chat.id === currentId}
                                  onOpen={() => { onClose(); if (chat.id !== currentId) onOpen(mode, chat.id); }}
                                  onLongPress={open}
                                  a11y={a11y}
                                />
                              )}
                            </SwipeDeleteRow>
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}
                {chats.length ? <Text style={[s.hint, { color: c.text300 }]}>{tx('წასაშლელად გადაწიე მარცხნივ', 'Swipe left to delete')}</Text> : null}
              </ScrollView>
            </SwipeGroup>
          </View>
          {held ? <UndoToast key={held} title={tx('საუბარი წაიშალა', 'Conversation deleted')} bottom={Math.max(insets.bottom, 16) + 8} onUndo={undo} /> : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** One conversation, Mail-style: icon tile · title with the date · the mode tag · a one-line preview. */
function ChatRow({ first, chat, mode, current, onOpen, onLongPress, a11y }: {
  first: boolean; chat: ChatSummary; mode: MediMode; current: boolean; onOpen: () => void; onLongPress: () => void; a11y: RowA11y;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const color = hubInk(mode === 'deep' ? 'violet' : mode === 'doctor' ? 'teal' : 'sky', dark);
  const tag = current ? tx('ახლა ღიაა', 'Open now') : mode === 'medi' ? undefined : ka.chat.mediModes[mode];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      accessibilityLabel={[chat.title, tag, listDate(chat.updatedAt), chat.preview].filter(Boolean).join('. ')}
      accessibilityHint={tx('წასაშლელად გადაწიე მარცხნივ', 'Swipe left to delete')}
      {...a11y}
      onPress={onOpen}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[s.row, { backgroundColor: c.surface }]}
    >
      <View style={[s.tile, { backgroundColor: hubTint(color, dark) }]}>
        <MessageSquareText size={19} color={color} strokeWidth={1.9} />
      </View>
      <View style={[s.rowText, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
        <View style={s.rowTop}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { flex: 1, color: c.text100 }]}>{chat.title}</Text>
          <Text style={[hubText.caption, { color: c.text300 }]}>{listDate(chat.updatedAt)}</Text>
        </View>
        {tag ? <Text numberOfLines={1} style={[hubText.small, { color, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tag}</Text> : null}
        {chat.preview ? <Text numberOfLines={1} style={[hubText.body, { color: c.text200 }]}>{chat.preview}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sheet: { maxHeight: '86%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: HUB.gutter + 4, marginBottom: 12 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: HUB.cardRadius },
  calm: { marginTop: 16, marginHorizontal: 4 },
  groupLabel: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 14 },
  rowText: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 12, paddingRight: 14 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  hint: { textAlign: 'center', marginTop: 14, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 },
});
