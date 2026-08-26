import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ChatBubbleAssistant, ChatBubbleUser, ChatTypingBubble } from '@/components/chat/ChatBubble';
import { ChatEmptyHero, ChatSuggestionChip } from '@/components/chat/ChatExtras';
import { ChatFeedbackRow } from '@/components/chat/ChatFeedbackRow';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { ChatTopNav } from '@/components/chat/ChatTopNav';
import { Disclaimer } from '@/components/Disclaimer';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api, type ChatMessage } from '@/lib/api';
import { getConversationalChatProfile } from '@/lib/chatUiConfig';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';

export default function ChatScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ mode?: string; sessionId?: string; prefill?: string }>();
  const profile = useMemo(() => getConversationalChatProfile(params.mode), [params.mode]);
  const mode = profile.apiMode ?? 'DOCTOR';

  const { user, applyUsage } = useAuth();
  const plan = usePlanUsage();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(
    typeof params.sessionId === 'string' ? params.sessionId : undefined,
  );
  const [draft, setDraft] = useState(typeof params.prefill === 'string' ? params.prefill : '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const remainingLabel = useMemo(() => {
    if (plan.unlimited) return ka.usage.unlimitedBanner;
    if (plan.exhausted) return ka.usage.exhaustedTitle;
    if (plan.remaining != null) return ka.chat.chatsRemaining(plan.remaining);
    return undefined;
  }, [plan]);

  useEffect(() => {
    if (!params.sessionId) return;
    api.chats
      .get(params.sessionId)
      .then((response) => setMessages(response.session.messages ?? []))
      .catch(() => undefined);
  }, [params.sessionId]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (message.length < 2 || sending) return;

      setDraft('');
      setError(null);
      setSending(true);
      setMessages((prev) => [...prev, { role: 'user', content: message, timestamp: new Date().toISOString() }]);
      scrollToEnd();

      try {
        const response = await api.ai.query({ message, mode, sessionId });
        setSessionId(response.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.answer,
            timestamp: new Date().toISOString(),
            interactionId: response.interactionId,
          },
        ]);
        applyUsage(response.usage);
      } catch (err) {
        setMessages((prev) => prev.slice(0, -1));
        setDraft(message);

        if (err instanceof ApiError && err.isQuotaExceeded) {
          setQuotaBlock(err.usage?.resetsInMs);
          if (err.usage) applyUsage(err.usage);
        } else {
          setError(err instanceof ApiError ? err.message : ka.common.error);
        }
      } finally {
        setSending(false);
        scrollToEnd();
      }
    },
    [sending, mode, sessionId, applyUsage, scrollToEnd],
  );

  const submitFeedback = useCallback(async (index: number, rating: 1 | -1) => {
    const message = messages[index];
    if (!message?.interactionId || message.feedbackRating) return;

    setMessages((prev) => prev.map((item, i) => (i === index ? { ...item, feedbackRating: rating } : item)));

    try {
      await api.ai.feedback({ interactionId: message.interactionId, rating });
    } catch {
      setMessages((prev) => prev.map((item, i) => (i === index ? { ...item, feedbackRating: undefined } : item)));
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
            remainingLabel={remainingLabel}
            onBack={() => router.back()}
            onSettings={() => router.push('/package' as never)}
          />
        }
        footer={<ChatInputBar value={draft} onChangeText={setDraft} onSend={() => send(draft)} sending={sending} />}
      >
        <FlatList
          ref={listRef}
          style={{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: FIGMA_CHAT.messageGap }} />}
          ListEmptyComponent={
            <View style={{ gap: 12 }}>
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
              <ChatBubbleAssistant icon={profile.icon} timestamp={item.timestamp}>
                <Markdown content={item.content} allowLinks={profile.allowMarkdownLinks} />
                {item.interactionId ? (
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
              {sending ? <ChatTypingBubble icon={profile.icon} /> : null}
              {error ? (
                <View
                  style={{
                    padding: 12,
                    borderRadius: FIGMA_CHAT.bubbleRadius,
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FECACA',
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#DC2626' }}>{error}</Text>
                </View>
              ) : null}
              {messages.length > 0 ? <Disclaimer /> : null}
            </View>
          }
        />
      </ChatScreenShell>

      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
        onUpgrade={() => {
          setQuotaBlock(undefined);
          Alert.alert(ka.usage.upsellTitle, ka.usage.premiumSoon);
        }}
      />
    </>
  );
}
