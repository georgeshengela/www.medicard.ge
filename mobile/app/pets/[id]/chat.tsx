import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Info, Stethoscope } from 'lucide-react-native';
import { ChatBubbleAssistant, ChatBubbleUser } from '@/components/chat/ChatBubble';
import { ChatEmptyHero, ChatSuggestionChip } from '@/components/chat/ChatExtras';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { QuotaSheet } from '@/components/QuotaSheet';
import { PetButton as Button } from '@/components/pets/PetUi';
import { PetPanel as Card } from '@/components/pets/PetUi';
import { PetIntro, PetLoading, PetText } from '@/components/pets/PetUi';
import { kindLabel } from '@/lib/petsCare';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { PetErrorText, PetSheet } from '@/components/pets/PetScreen';
import { Markdown } from '@/components/ui/Markdown';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet, type PetChatMessage, type PetCareDraft } from '@/lib/api';
import { getPetVetChatProfile } from '@/lib/chatUiConfig';
import { getScopedPreference, localAccountId, setScopedPreference } from '@/lib/localAccount';
import { newPetsRequestId } from '@/lib/petsHealth';
import { streamPetVetQuery } from '@/lib/petVetQueryStream';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';
import { consumeAssistantLaunch } from '@/lib/assistant';
import { useThemeColors } from '@/theme/colors';

const DISCLOSURE_KEY = 'medicard.pets.vetDisclosure.v1';

function toUiMessage(row: PetChatMessage): PetChatMessage {
  return {
    ...row,
    timestamp: row.timestamp || row.createdAt || new Date().toISOString(),
    streaming: false,
  };
}

function DraftCard({ draft, petId }: { draft: PetCareDraft; petId: string }) {
  const router = useRouter();
  const qs = new URLSearchParams();
  if (draft.kind) qs.set('kind', draft.kind);
  if (draft.title) qs.set('title', draft.title);
  if (draft.productId) qs.set('productId', draft.productId);
  if (draft.dose) qs.set('dose', draft.dose);
  if (draft.doseUnit) qs.set('doseUnit', draft.doseUnit);
  if (draft.startOn) qs.set('startOn', draft.startOn);
  if (draft.dueTime) qs.set('dueTime', draft.dueTime);
  if (draft.recurrenceKind) qs.set('recurrenceKind', draft.recurrenceKind);
  if (draft.intervalCount) qs.set('intervalCount', String(draft.intervalCount));

  return (
    <Card>
      <Text className="text-base font-bold text-text-100">{ka.pets.vetDraftTitle}</Text>
      <Text className="mt-1 text-sm text-text-200">
        {[draft.kind ? kindLabel(draft.kind, ka.pets) : null, draft.title, draft.dose, draft.doseUnit, draft.startOn ? formatCycleDateKa(draft.startOn) : null].filter(Boolean).join(' · ') || '—'}
      </Text>
      {draft.incomplete ? <Text className="mt-1 text-sm text-state-warning">{ka.pets.vetDraftIncomplete}</Text> : null}
      <Text className="mt-1 text-sm text-text-300">{ka.pets.vetDraftNotSaved}</Text>
      <View className="mt-3">
        <Button
          label={ka.pets.vetDraftReview}
          variant="secondary"
          onPress={() => router.push(`/pets/${petId}/care/plan?${qs.toString()}`)}
        />
      </View>
    </Card>
  );
}

export default function PetVetChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  return user && id ? <PetVetChat key={user.id + ':' + id} petId={id} owner={user.id} /> : <PetLoading />;
}
function PetVetChat({ petId, owner }: { petId: string; owner: string }) {
  const FIGMA_CHAT = useFigmaChat();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { applyUsage } = useAuth();
  const plan = usePlanUsage();
  const listRef = useRef<FlatList<PetChatMessage>>(null);
  const alive = useRef(true), sendLock = useRef(false);
  const current = useCallback(() => alive.current && localAccountId() === owner, [owner]);
  const [loaded, setLoaded] = useState(false), [reload, setReload] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const [pet, setPet] = useState<Pet | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<PetChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const [disclosure, setDisclosure] = useState(false);
  const [disclosureSeen, setDisclosureSeen] = useState(false);

  const titledProfile = useMemo(() => getPetVetChatProfile(pet?.name), [pet?.name]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: ka.pets.vetName });
  }, [navigation]);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const active = () => !cancelled && current();
    setLoaded(false); setError(null);
    void (async () => {
      try {
        const seen = await getScopedPreference(DISCLOSURE_KEY);
        if (!active()) return;
        setDisclosureSeen(seen === '1');
        if (seen !== '1') setDisclosure(true);
        const [profile, listed] = await Promise.all([api.pets.get(petId), api.pets.chats.list(petId)]);
        if (!active()) return;
        setPet(profile.pet);
        const session = listed.sessions[0] || (await api.pets.chats.create(petId)).session;
        if (!active()) return;
        const loaded = await api.pets.chats.messages(petId, session.id);
        if (!active()) return;
        setSessionId(session.id); setMessages((loaded.messages || []).map(toUiMessage)); setLoaded(true);
      } catch (error) { if (active()) setError(error instanceof ApiError ? error.isChatSchemaUnavailable || error.isSchemaUnavailable ? ka.pets.vetUnavailable : error.message : ka.pets.vetFailed); }
    })();
    return () => { cancelled = true; alive.current = false; abortRef.current?.abort(); };
  }, [petId, current, reload]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (message.length < 2 || sendLock.current || !loaded || disclosure || !petId || !current()) return;
      sendLock.current = true;
      const userAt = new Date().toISOString();
      const requestId = newPetsRequestId();
      setDraft('');
      setError(null);
      setSending(true);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message, timestamp: userAt, status: 'COMPLETE' },
        { role: 'assistant', content: '', timestamp: userAt, streaming: true, status: 'PARTIAL' },
      ]);
      scrollToEnd();

      const pending = { current: '' };
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flushDeltas = () => {
        flushTimer = null;
        const extra = pending.current;
        pending.current = '';
        if (!extra || !current()) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role !== 'assistant' || !last.streaming) return prev;
          next[next.length - 1] = { ...last, content: last.content + extra, status: 'PARTIAL' };
          return next;
        });
      };
      const onDelta = (chunk: string) => {
        if (!current()) return;
        pending.current += chunk;
        if (!flushTimer) flushTimer = setTimeout(flushDeltas, 40);
      };

      const abort = new AbortController();
      abortRef.current = abort;
      try {
        const response = await streamPetVetQuery(
          petId,
          { message, sessionId, clientRequestId: requestId },
          { onDelta, signal: abort.signal },
        );
        if (flushTimer) clearTimeout(flushTimer);
        flushDeltas();
        if (!current()) return;
        setSessionId(response.sessionId);
        if (response.usage) applyUsage?.(response.usage);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              content: response.answer || last.content,
              streaming: false,
              status: response.status === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL',
              citations: response.citations || [],
              draft: response.draft || null,
              grounding: response.grounding || null,
            };
          }
          return next;
        });
      } catch (err) {
        if (flushTimer) clearTimeout(flushTimer);
        if (!current()) return;
        const apiErr = err instanceof ApiError ? err : null;
        if (apiErr?.status === 429) {
          setQuotaBlock(Number(apiErr.usage?.resetsInMs) || plan.usage?.resetsInMs);
        }
        const cancelled = apiErr?.status === 499 || apiErr?.code === 'CANCELLED';
        const partial = apiErr?.code === 'PARTIAL';
        setError(cancelled ? ka.pets.vetCancelled : apiErr?.message || ka.pets.vetFailed);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              streaming: false,
              status: cancelled ? 'CANCELLED' : partial ? 'PARTIAL' : 'FAILED',
            };
          }
          return next;
        });
      } finally {
        if (flushTimer) clearTimeout(flushTimer);
        abortRef.current = null; sendLock.current = false;
        if (current()) setSending(false);
      }
    },
    [applyUsage, petId, plan.usage?.resetsInMs, loaded, disclosure, current, sessionId, scrollToEnd],
  );

  useEffect(() => {
    const owner = localAccountId();
    if (!owner || !petId || !loaded || disclosure) return;
    const message = consumeAssistantLaunch(owner, `/pets/${petId}/chat`);
    if (message) { setDraft(message); void send(message); }
  }, [petId, loaded, disclosure, send]);

  const confirmDisclosure = async () => {
    if (!current()) return;
    await setScopedPreference(DISCLOSURE_KEY, '1').catch(() => undefined);
    if (current()) { setDisclosureSeen(true); setDisclosure(false); }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatScreenShell
        header={
          <View
            style={{
              backgroundColor: FIGMA_CHAT.white,
              borderBottomWidth: 1,
              borderBottomColor: FIGMA_CHAT.border,
              paddingTop: insets.top,
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={ka.common.back} accessibilityRole="button" style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={24} color={FIGMA_CHAT.textPrimary} />
            </Pressable>
            <PetPhoto photoUrl={pet?.photoUrl || null} name={pet?.name || 'M'} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: FIGMA_CHAT.textPrimary }}>
                {ka.pets.vetName}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: FIGMA_CHAT.textSecondary }}>
                {pet?.name || titledProfile.subtitle}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Medi Vet — როგორ მუშაობს" onPress={() => setDisclosure(true)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Info size={21} color={colors.primary100} /></Pressable>
          </View>
        }
        footer={
          <View>
            {sending ? (
              <Pressable
                onPress={() => abortRef.current?.abort()}
                style={{ alignSelf: 'center', paddingVertical: 6 }}
              >
                <Text style={{ color: FIGMA_CHAT.brand }}>{ka.pets.vetCancel}</Text>
              </Pressable>
            ) : null}
            <ChatInputBar
              value={draft}
              onChangeText={setDraft}
              onSend={() => void send(draft)}
              sending={sending || !loaded || disclosure}
              placeholder={titledProfile.inputPlaceholder}
              showTools={false}
            />
          </View>
        }
      >
        <FlatList
          ref={listRef}
          style={{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }}
          data={messages}
          keyExtractor={(item, index) => item.id || String(index)}
          contentContainerStyle={{ padding: 16, paddingBottom: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: FIGMA_CHAT.messageGap }} />}
          ListEmptyComponent={
            <View style={{ gap: FIGMA_CHAT.messageGap }}>
<PetIntro icon={Stethoscope} eyebrow="MEDI VET · AI" title={pet?.name ? `${pet.name} — უკეთ გავიცნოთ.` : "მისთვისაც აქ ვართ."} body="მოვლა, შენახული ჩანაწერები და შეკითხვები შენს ცხოველზე. აღწერე, რისი გაგება გინდა." />
              <Card><PetText bold>აქ საუბარი შენს ცხოველს ეხება</PetText><PetText size={13} muted>{ka.pets.vetDisclaimer}</PetText></Card>
              {!loaded && !error ? <PetText muted>ისტორია იტვირთება…</PetText> : null}
              {loaded && titledProfile.suggestions.map((suggestion) => (
                <ChatSuggestionChip key={suggestion} label={suggestion} onPress={() => void send(suggestion)} />
              ))}
            </View>
          }
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <ChatBubbleUser content={item.content} timestamp={item.timestamp || item.createdAt || ''} />
            ) : (
              <ChatBubbleAssistant
                icon={Stethoscope}
                timestamp={item.timestamp || item.createdAt || ''}
                streaming={item.streaming}
              >
                {item.content ? <Markdown content={item.content} allowLinks /> : null}
                {item.status && item.status !== 'COMPLETE' && !item.streaming ? (
                  <Text style={{ color: colors.warning, marginTop: 4 }}>
                    {item.status === 'CANCELLED'
                      ? ka.pets.vetCancelled
                      : item.status === 'PARTIAL'
                        ? ka.pets.vetPartial
                        : ka.pets.vetFailed}
                  </Text>
                ) : null}
                {item.citations?.length ? (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    <Text style={{ fontWeight: '600', color: colors.text200 }}>{ka.pets.vetSources}</Text>
                    {item.citations.map((source) => (
                      <Pressable key={source.id} onPress={() => void Linking.openURL(source.url)}>
                        <Text style={{ color: colors.primary200, textDecorationLine: 'underline' }}>
                          {source.title} — {source.publisher}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {item.draft ? <DraftCard draft={item.draft} petId={petId} /> : null}
              </ChatBubbleAssistant>
            )
          }
          ListFooterComponent={
            <View style={{ gap: FIGMA_CHAT.messageGap, paddingTop: messages.length ? FIGMA_CHAT.messageGap : 0 }}>
              {error ? <PetErrorText message={error} /> : null}
              {!loaded && error ? <Button variant="secondary" label="ისტორიის ხელახლა ჩატვირთვა" onPress={() => setReload(value => value + 1)} /> : null}
              {messages.length > 0 ? (
                <Text style={{ fontSize: 12, color: colors.text300 }}>{ka.pets.vetDisclaimer}</Text>
              ) : null}
            </View>
          }
        />
      </ChatScreenShell>

      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
      />

      <PetSheet visible={disclosure} title={ka.pets.vetDisclosureTitle} onClose={() => { setDisclosure(false); if (!disclosureSeen) router.back(); }}>
        <Text className="mb-4 text-base leading-6 text-text-200">{ka.pets.vetDisclosureBody}</Text>
        <Button label={ka.pets.vetDisclosureConfirm} onPress={() => void confirmDisclosure()} />
      </PetSheet>
    </>
  );
}
