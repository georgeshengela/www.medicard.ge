import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, SendHorizontal, Users } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Markdown } from '@/components/ui/Markdown';
import { Disclaimer } from '@/components/Disclaimer';
import { EmptyState } from '@/components/EmptyState';
import { QuotaSheet } from '@/components/QuotaSheet';
import { UsageBanner } from '@/components/UsageBanner';
import { ka } from '@/i18n/ka';
import { ApiError, api, type ChatMessage } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ mode?: string; sessionId?: string }>();
  const isConsilium = params.mode === 'consilium';
  const mode = isConsilium ? 'CONSILIUM' : 'DOCTOR';
  const copy = isConsilium ? ka.modules.consilium : ka.modules.doctor;

  const { applyUsage } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(params.sessionId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

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
          { role: 'assistant', content: response.answer, timestamp: new Date().toISOString() },
        ]);
        applyUsage(response.usage);
      } catch (err) {
        // Roll the optimistic user turn back so the transcript matches the server.
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

  const suggestions = useMemo(
    () =>
      isConsilium
        ? []
        : [ka.modules.doctor.suggestion1, ka.modules.doctor.suggestion2, ka.modules.doctor.suggestion3],
    [isConsilium],
  );

  return (
    <>
      <Stack.Screen options={{ title: copy.title }} />

      <KeyboardAvoidingView
        className="flex-1 bg-bg-100"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        <View className="px-4 pb-2 pt-1">
          <UsageBanner compact />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, index) => String(index)}
          contentContainerClassName="px-4 pb-4"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View>
              <EmptyState icon={isConsilium ? Users : Bot} title={copy.emptyTitle} body={copy.emptyBody} />
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  accessibilityRole="button"
                  onPress={() => send(suggestion)}
                  className="mb-2.5 rounded-2xl border border-bg-300 bg-surface px-4 py-3 active:opacity-70"
                >
                  <Text className="text-base text-text-200">{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <View className="mb-3 max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary-200 px-4 py-3">
                <Text className="text-base leading-6 text-white">{item.content}</Text>
              </View>
            ) : (
              <Card className="mb-3 max-w-[95%] self-start rounded-bl-md">
                <View className="mb-2.5 flex-row items-center">
                  <View className="h-6 w-6 items-center justify-center rounded-lg bg-accent-100/60">
                    {isConsilium ? (
                      <Users size={12} color={colors.primary200} strokeWidth={2.4} />
                    ) : (
                      <Bot size={12} color={colors.primary200} strokeWidth={2.4} />
                    )}
                  </View>
                  <Text className="ml-2 text-xs font-bold uppercase text-primary-200">{copy.title}</Text>
                </View>
                <Markdown content={item.content} />
              </Card>
            )
          }
          ListFooterComponent={
            <>
              {sending ? (
                <Card className="mb-3 max-w-[70%] self-start rounded-bl-md">
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color={colors.primary200} />
                    <Text className="ml-2.5 text-sm text-text-300">{ka.common.analyzing}</Text>
                  </View>
                </Card>
              ) : null}

              {error ? (
                <View className="mb-3 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
                  <Text className="text-sm text-state-danger">{error}</Text>
                </View>
              ) : null}

              {messages.length > 0 ? <Disclaimer className="mt-1" /> : null}
            </>
          }
        />

        <View
          className="border-t border-bg-300 bg-bg-100 px-4 pt-2.5"
          style={{ paddingBottom: Math.max(insets.bottom, 10) }}
        >
          <View className="flex-row items-end">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={copy.inputPlaceholder}
              placeholderTextColor={colors.text300}
              multiline
              className="max-h-32 flex-1 rounded-2xl border border-bg-300 bg-surface px-4 py-3 text-base text-text-100"
              style={{ fontSize: 15, lineHeight: 21 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.common.send}
              accessibilityState={{ disabled: draft.trim().length < 2 || sending }}
              onPress={() => send(draft)}
              disabled={draft.trim().length < 2 || sending}
              className={`ml-2.5 h-12 w-12 items-center justify-center rounded-2xl ${
                draft.trim().length < 2 || sending ? 'bg-primary-200/35' : 'bg-primary-200 active:opacity-80'
              }`}
            >
              <SendHorizontal size={19} color={colors.onPrimary} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

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
