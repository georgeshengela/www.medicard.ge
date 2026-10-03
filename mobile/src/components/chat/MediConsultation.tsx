import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { ChatBubbleAssistant, ChatBubbleUser } from '@/components/chat/ChatBubble';
import { ChatEmptyHero, ChatSuggestionChip } from '@/components/chat/ChatExtras';
import { ChatFeedbackRow } from '@/components/chat/ChatFeedbackRow';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { Disclaimer } from '@/components/Disclaimer';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api, type ChatMessage } from '@/lib/api';
import { streamAiQuery } from '@/lib/aiQueryStream';
import { getConversationalChatProfile } from '@/lib/chatUiConfig';
import { CHAT_MESSAGE_LIMIT, requireAnalysisText, IncompleteAnalysisError } from '@/lib/analysisFlow';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { localAccountId } from '@/lib/localAccount';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';
import { consumeAssistantLaunch } from '@/lib/assistant';
import type { CycleMediContext } from '@/lib/cycleMediContext';
import { takeMediCycleContext, takeMediPrefill } from '@/lib/mediHandoff';
import { MediContextChip } from '@/components/chat/MediContextChip';
import { tx } from '@/i18n/locale';
import { aiConsentDeclinedText, aiConsentRetryLabel, isAiConsentDeclined } from '@/lib/aiConsentDecline';

/**
 * Medi's clinical conversation ("ექიმთან საუბარი") and deep analysis ("ღრმა ანალიზი").
 * Rendered inside /assistant (one Medi, 2026-09-27); /chat/* routes redirect there.
 * Storage, endpoint and quota are unchanged: ChatSession + /api/ai/query.
 */
type Props = {
  apiMode: 'DOCTOR' | 'CONSILIUM';
  sessionId?: string;
  /** Fixed copy from the route (push notifications, neutral chip questions) — never health text. */
  prefill?: string;
  /** `handoff=1`: a drafted question waits in memory (mediHandoff), consume-once, for this account. */
  handoff?: boolean;
  /** Header with the mode switch, supplied by /assistant. */
  header: (profile: { title: string; icon: ReturnType<typeof getConversationalChatProfile>['icon'] }) => React.ReactNode;
  /**
   * Set while an admin has paused this mode (admin „მოდულები“): a saved conversation stays readable,
   * nothing new can be sent, and this text says why.
   */
  pausedMessage?: string;
};

export function MediConsultation(props: Props) {
  const { user } = useAuth();
  return <MediConsultationContent key={`${user?.id}:${props.apiMode}:${props.sessionId ?? 'new'}`} {...props} />;
}

function MediConsultationContent({ apiMode, sessionId: initialSessionId, prefill, handoff, header, pausedMessage }: Props) {
  const FIGMA_CHAT = useFigmaChat();
  const params = { mode: apiMode === 'CONSILIUM' ? 'consilium' : 'doctor', sessionId: initialSessionId, prefill };
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
  // W2-8b: she declined or closed the AI disclosure — a choice, not an error. Holds the question for „ხელახლა ცდა“.
  const [declinedMessage, setDeclinedMessage] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  // W2-8: opened from a cycle screen → the context staged in memory for this question (mediHandoff).
  // Shown as a removable chip; sent once, with the first question, through the consented AI path.
  const [cycleContext, setCycleContext] = useState<CycleMediContext | null>(null);
  const cycleContextRef = useRef<CycleMediContext | null>(null);
  cycleContextRef.current = cycleContext;
  useEffect(() => {
    if (!user?.id || params.sessionId || pausedMessage) return;
    // W2-8b: a drafted question (alert, tip, summary, lab, symptoms) arrives in memory, not in the URL.
    const drafted = handoff ? takeMediPrefill(user.id) : null;
    if (drafted) setDraft(drafted);
    const question = drafted ?? (typeof params.prefill === 'string' ? params.prefill : null);
    const staged = takeMediCycleContext(user.id, question);
    if (staged) setCycleContext(staged);
    // Once per mount: a second read finds nothing (consume-once).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setDeclinedMessage(null);
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
        // The cycle context rides only with the first question that goes through (consent runs first
        // inside streamAiQuery; a decline or failure keeps the chip for the retry).
        const context = sessionId ? undefined : cycleContextRef.current?.text;
        const response = await streamAiQuery({ message, mode, sessionId, ...(context ? { context } : {}) }, { onDelta, signal: controller.signal });
        if (!operation.current()) return;
        requireAnalysisText(response.answer);
        if (context) setCycleContext(null);
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

        if (isAiConsentDeclined(err)) {
          // Nothing was sent (consent runs before the request). Calm line + „ხელახლა ცდა“, no error.
          setDeclinedMessage(message);
        } else if (err instanceof ApiError && err.isQuotaExceeded) {
          setFailedMessage(message);
          setQuotaBlock(err.usage?.resetsInMs);
          if (err.usage) applyUsage(err.usage);
        } else {
          setFailedMessage(message);
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
    if (!user?.id || historyState !== 'ready' || params.sessionId || pausedMessage) return;
    const message = consumeAssistantLaunch(user.id, `/chat/${mode === 'CONSILIUM' ? 'consilium' : 'doctor'}`);
    if (message) { setDraft(message); void send(message); }
  }, [user?.id, historyState, params.sessionId, mode, send, pausedMessage]);

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
      <ChatScreenShell
        header={header({ title: profile.title, icon: profile.icon })}
        footer={<ChatInputBar value={draft} onChangeText={setDraft} onSend={() => send(draft)} sending={sending} disabled={historyState !== 'ready' || Boolean(pausedMessage)}
          accessory={cycleContext && !pausedMessage ? <MediContextChip context={cycleContext} onRemove={() => setCycleContext(null)} /> : null}
          placeholder={pausedMessage ? tx('ეს რეჟიმი დროებით შეჩერებულია', 'This mode is paused for now') : undefined} />}
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
          ListEmptyComponent={historyState === 'loading' ? <View style={{ padding: 28, gap: 12, alignItems: 'center' }}><ActivityIndicator color={FIGMA_CHAT.brand} /><Text style={{ color: FIGMA_CHAT.textSecondary }}>{tx('საუბარი იტვირთება…', 'Loading conversation…')}</Text></View> : historyState === 'error' ? (
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={{ color: colors.danger, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tx('საუბარი ვერ ჩაიტვირთა. შეამოწმე კავშირი და სცადე ხელახლა.', "Couldn't load the conversation. Check your connection and try again.")}</Text>
              <Pressable accessibilityRole="button" onPress={() => setHistoryAttempt(n => n + 1)} style={{ minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: FIGMA_CHAT.brandQuaternary }}>
                <Text style={{ color: FIGMA_CHAT.brand, textAlign: 'center', fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('ხელახლა ცდა', 'Try again')}</Text>
              </Pressable>
            </View>
          ) : <View style={{ gap: 12 }}>
              <ChatBubbleAssistant icon={profile.icon} timestamp={new Date().toISOString()}>
                <ChatEmptyHero title={profile.emptyTitle} body={profile.emptyBody} />
              </ChatBubbleAssistant>
              {pausedMessage ? null : profile.suggestions.map((suggestion) => (
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
              {pausedMessage ? (
                <Text accessibilityRole="alert" style={{ fontSize: 13, lineHeight: 21, color: FIGMA_CHAT.textSecondary, fontFamily: 'NotoSansGeorgian_400Regular', textAlign: 'center', paddingHorizontal: 8 }}>
                  {pausedMessage}
                </Text>
              ) : null}
              {declinedMessage && !error ? (
                <View accessibilityLiveRegion="polite" style={{ padding: 14, gap: 10, borderRadius: FIGMA_CHAT.bubbleRadius, backgroundColor: FIGMA_CHAT.white }}>
                  <Text style={{ fontSize: 14, lineHeight: 21, color: FIGMA_CHAT.textSecondary, fontFamily: 'NotoSansGeorgian_400Regular' }}>{aiConsentDeclinedText()}</Text>
                  <Pressable accessibilityRole="button" disabled={sending} onPress={() => void send(draft.trim().length >= 2 ? draft : declinedMessage)}
                    style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', backgroundColor: FIGMA_CHAT.brandQuaternary }}>
                    <Text style={{ color: FIGMA_CHAT.brand, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{aiConsentRetryLabel()}</Text>
                  </Pressable>
                </View>
              ) : null}
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
                    <Text style={{ color: colors.danger, fontFamily: 'NotoSansGeorgian_700Bold' }}>{tx('ხელახლა გაგზავნა', 'Resend')}</Text>
                  </Pressable> : null}
                </View>
              ) : null}
              {messages.length > 0 ? <Disclaimer /> : null}
            </View>
          }
        />
        {scrolledUp && messages.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={tx('ბოლო შეტყობინებაზე გადასვლა', 'Jump to the latest message')} onPress={() => { nearBottom.current = true; setScrolledUp(false); scrollToEnd(); }} style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, marginVertical: 4, borderRadius: 18, borderWidth: 1, borderColor: FIGMA_CHAT.brandBorderLight, backgroundColor: FIGMA_CHAT.brandQuaternary }}>
          <Text style={{ color: FIGMA_CHAT.brand, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('↓ ბოლო შეტყობინება', '↓ Latest message')}</Text>
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
