import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ChatBubbleAssistant, ChatBubbleUser } from '@/components/chat/ChatBubble';
import { ChatEmptyHero, ChatSuggestionChip } from '@/components/chat/ChatExtras';
import { ChatFeedbackRow } from '@/components/chat/ChatFeedbackRow';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { ChatTopNav } from '@/components/chat/ChatTopNav';
import { Disclaimer } from '@/components/Disclaimer';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api, ensureAiSharingConsentForRequest, type ChatMessage } from '@/lib/api';
import { streamAiQuery } from '@/lib/aiQueryStream';
import { getConversationalChatProfile } from '@/lib/chatUiConfig';
import { CHAT_MESSAGE_LIMIT, requireAnalysisText, IncompleteAnalysisError } from '@/lib/analysisFlow';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { localAccountId } from '@/lib/localAccount';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';
import { consumeAssistantLaunch } from '@/lib/assistant';

export default function ChatScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string; sessionId?: string }>();
  return <ChatScreenContent key={`${user?.id}:${params.mode}:${params.sessionId ?? 'new'}`} />;
}

function ChatScreenContent() {
  const FIGMA_CHAT = useFigmaChat();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ mode?: string; sessionId?: string; prefill?: string }>();
  const profile = useMemo(() => getConversationalChatProfile(params.mode), [params.mode]);
  const mode = profile.apiMode ?? 'DOCTOR';

  const { user, applyUsage } = useAuth();
  const colors = useThemeColors();
  const task = useAnalysisTask(`${user?.id}:${params.mode}:${params.sessionId ?? 'new'}`);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const nearBottom = useRef(true);
  const [scrolledUp, setScrolledUp] = useState(false);
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>(params.sessionId ? 'loading' : 'ready');
  const [historyAttempt, setHistoryAttempt] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(
    typeof params.sessionId === 'string' ? params.sessionId : undefined,
  );
  const [draft, setDraft] = useState(typeof params.prefill === 'string' ? params.prefill : '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, title: profile.title });
  }, [navigation, profile.title]);

  const initials =
    user?.fullName
      ?.split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() ?? 'M';

  useEffect(() => {
    if (!params.sessionId) return;
    let current = true;
    const owner = localAccountId();
    setHistoryState('loading');
    api.chats.get(params.sessionId).then(response => {
      if (!current || localAccountId() !== owner) return;
      setMessages(response.session.messages ?? []);
      setHistoryState('ready');
    }).catch(() => { if (current && localAccountId() === owner) setHistoryState('error'); });
    return () => { current = false; };
  }, [params.sessionId, historyAttempt]);

  const scrollToEnd = useCallback(() => {
    if (!nearBottom.current) return;
    requestAnimationFrame(() => { if (alive.current && nearBottom.current) listRef.current?.scrollToEnd({ animated: false }); });
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (message.length < 2 || message.length > CHAT_MESSAGE_LIMIT || historyState !== 'ready') return;
      const operation = task.begin();
      if (!operation) return;
      const controller = new AbortController();
      abort.current = controller;
      nearBottom.current = true; setScrolledUp(false);

      const userAt = new Date().toISOString();
      setDraft(current => current.trim() === message ? '' : current);
      setFailedMessage(null);
      setError(null);
      setSending(true);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: message, timestamp: userAt },
        { role: 'assistant', content: '', timestamp: userAt, streaming: true },
      ]);
      scrollToEnd();

      const pending = { current: '' };
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flushDeltas = () => {
        flushTimer = null;
        const extra = pending.current;
        pending.current = '';
        if (!extra || !operation.current()) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role !== 'assistant' || !last.streaming) return prev;
          next[next.length - 1] = { ...last, content: last.content + extra };
          return next;
        });
      };
      const onDelta = (chunk: string) => {
        if (!operation.current()) return;
        pending.current += chunk;
        if (!flushTimer) flushTimer = setTimeout(flushDeltas, 40);
      };

      try {
        const response = await streamAiQuery({ message, mode, sessionId }, { onDelta, signal: controller.signal });
        if (!operation.current()) return;
        requireAnalysisText(response.answer);
        if (flushTimer) clearTimeout(flushTimer);
        flushDeltas();
        setSessionId(response.sessionId);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              role: 'assistant',
              content: response.answer,
              timestamp: new Date().toISOString(),
              interactionId: response.interactionId,
            };
          }
          return next;
        });
        if (response.usage) applyUsage(response.usage);
        void import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh()).catch(() => undefined);
      } catch (err) {
        if (flushTimer) clearTimeout(flushTimer);
        if (!operation.current()) return;
        setMessages((prev) => prev.slice(0, -2));
        setDraft(current => current.trim() ? current : message);
        setFailedMessage(message);

        if (err instanceof ApiError && err.isQuotaExceeded) {
          setQuotaBlock(err.usage?.resetsInMs);
          if (err.usage) applyUsage(err.usage);
        } else {
          setError((err instanceof ApiError || err instanceof IncompleteAnalysisError) ? err.message : ka.common.error);
        }
      } finally {
        if (flushTimer) clearTimeout(flushTimer);
        if (operation.current()) { setSending(false); scrollToEnd(); }
        if (abort.current === controller) abort.current = null;
        operation.finish();
      }
    },
    [historyState, task, mode, sessionId, applyUsage, scrollToEnd],
  );

  useEffect(() => {
    if (!user?.id || historyState !== 'ready' || params.sessionId) return;
    const message = consumeAssistantLaunch(user.id, `/chat/${mode === 'CONSILIUM' ? 'consilium' : 'doctor'}`);
    if (message) { setDraft(message); void send(message); }
  }, [user?.id, historyState, params.sessionId, mode, send]);

  const submitFeedback = useCallback(async (index: number, rating: 1 | -1) => {
    const owner = localAccountId();
    const message = messages[index];
    if (!message?.interactionId || message.feedbackRating) return;

    setMessages((prev) => prev.map((item, i) => (i === index ? { ...item, feedbackRating: rating } : item)));

    try {
      await api.ai.feedback({ interactionId: message.interactionId, rating });
    } catch {
      if (!alive.current || localAccountId() !== owner) return;
      setMessages(prev => prev.map(item => item.interactionId === message.interactionId ? { ...item, feedbackRating: undefined } : item));
    }
  }, [messages]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: profile.title }} />

      <ChatScreenShell
        header={
          <ChatTopNav
            title={profile.title}
            icon={profile.icon}
            onBack={() => router.back()}
            onSettings={() => { void ensureAiSharingConsentForRequest('', 'GET', undefined, true).catch(() => undefined); }}
          />
        }
        footer={<ChatInputBar value={draft} onChangeText={setDraft} onSend={() => send(draft)} sending={sending} disabled={historyState !== 'ready'} />}
      >
        <FlatList
          ref={listRef}
          style={{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={false}
          scrollEventThrottle={100}
          onScroll={event => {
            const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
            const near = contentSize.height - layoutMeasurement.height - contentOffset.y < 100;
            nearBottom.current = near;
            setScrolledUp(!near);
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: FIGMA_CHAT.messageGap }} />}
          ListEmptyComponent={historyState === 'loading' ? <View style={{ padding: 28, gap: 12, alignItems: 'center' }}><ActivityIndicator color={FIGMA_CHAT.brand} /><Text style={{ color: FIGMA_CHAT.textSecondary }}>საუბარი იტვირთება…</Text></View> : historyState === 'error' ? (
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={{ color: colors.danger, fontFamily: 'NotoSansGeorgian_400Regular' }}>საუბარი ვერ ჩაიტვირთა. შეამოწმე კავშირი და სცადე ხელახლა.</Text>
              <Pressable accessibilityRole="button" onPress={() => setHistoryAttempt(n => n + 1)} style={{ minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: FIGMA_CHAT.brandQuaternary }}>
                <Text style={{ color: FIGMA_CHAT.brand, textAlign: 'center', fontFamily: 'NotoSansGeorgian_600SemiBold' }}>ხელახლა ცდა</Text>
              </Pressable>
            </View>
          ) : <View style={{ gap: 12 }}>
              <ChatBubbleAssistant icon={profile.icon} timestamp={new Date().toISOString()}>
                <ChatEmptyHero title={profile.emptyTitle} body={profile.emptyBody} />
              </ChatBubbleAssistant>
              {profile.suggestions.map((suggestion) => (
                <ChatSuggestionChip key={suggestion} label={suggestion} onPress={() => send(suggestion)} />
              ))}
            </View>
          }
          renderItem={({ item, index }) =>
            item.role === 'user' ? (
              <ChatBubbleUser content={item.content} timestamp={item.timestamp} userInitials={initials} />
            ) : (
              <ChatBubbleAssistant icon={profile.icon} timestamp={item.timestamp} streaming={item.streaming}>
                {item.content ? (
                  <Markdown content={item.content} allowLinks={profile.allowMarkdownLinks} />
                ) : null}
                {item.interactionId && !item.streaming ? (
                  <ChatFeedbackRow
                    feedbackRating={item.feedbackRating}
                    onRate={(rating) => submitFeedback(index, rating)}
                  />
                ) : null}
              </ChatBubbleAssistant>
            )
          }
          ListFooterComponent={
            <View style={{ gap: FIGMA_CHAT.messageGap, paddingTop: messages.length ? FIGMA_CHAT.messageGap : 0 }}>
              {error ? (
                <View
                  style={{
                    padding: 12,
                    borderRadius: FIGMA_CHAT.bubbleRadius,
                    backgroundColor: colors.dangerBg,
                    borderWidth: 1,
                    borderColor: colors.danger,
                  }}
                >
                  <Text style={{ fontSize: 14, color: colors.danger, fontFamily: 'NotoSansGeorgian_400Regular', lineHeight: 21 }}>{error}</Text>
                  {failedMessage ? <Pressable accessibilityRole="button" disabled={sending} onPress={() => void send(failedMessage)} style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}>
                    <Text style={{ color: colors.danger, fontFamily: 'NotoSansGeorgian_700Bold' }}>ხელახლა გაგზავნა</Text>
                  </Pressable> : null}
                </View>
              ) : null}
              {messages.length > 0 ? <Disclaimer /> : null}
            </View>
          }
        />
        {scrolledUp && messages.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="ბოლო შეტყობინებაზე გადასვლა" onPress={() => { nearBottom.current = true; setScrolledUp(false); scrollToEnd(); }} style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, marginVertical: 4, borderRadius: 18, borderWidth: 1, borderColor: FIGMA_CHAT.brandBorderLight, backgroundColor: FIGMA_CHAT.brandQuaternary }}>
          <Text style={{ color: FIGMA_CHAT.brand, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>↓ ბოლო შეტყობინება</Text>
        </Pressable> : null}
      </ChatScreenShell>

      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
      />
    </>
  );
}
