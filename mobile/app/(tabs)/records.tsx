import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, FileText, FolderHeart, MessageSquareText, Plus, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { ka } from '@/i18n/ka';
import { api, type ChatSummary, type MedicalRecord } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors } from '@/theme/colors';

const FILTERS = ['ALL', 'LAB', 'CT_MRI', 'SKIN', 'SKINCARE', 'SYMPTOM'] as const;

export default function Records() {
  const router = useRouter();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const [recordResult, chatResult] = await Promise.allSettled([api.records.list(), api.chats.list()]);
    if (recordResult.status === 'fulfilled') setRecords(recordResult.value.records);
    if (chatResult.status === 'fulfilled') setChats(chatResult.value.sessions);
    setReady(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(
    () => (filter === 'ALL' ? records : records.filter((record) => record.type === filter)),
    [records, filter],
  );

  const removeRecord = async (id: string) => {
    setRecords((prev) => prev.filter((record) => record.id !== id));
    await api.records.remove(id).catch(() => load());
  };

  const removeChat = async (id: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== id));
    await api.chats.remove(id).catch(() => load());
  };

  const isEmpty = records.length === 0 && chats.length === 0;

  const startUpload = useCallback(() => {
    Alert.alert(ka.records.addCta, ka.records.emptyHint, [
      { text: ka.common.cancel, style: 'cancel' },
      { text: ka.records.addLab, onPress: () => router.push('/module/lab' as never) },
      { text: ka.records.addImaging, onPress: () => router.push('/module/imaging' as never) },
    ]);
  }, [router]);

  return (
    <>
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.records.addCta}
            hitSlop={10}
            onPress={startUpload}
            style={{ paddingHorizontal: 4, paddingVertical: 4 }}
          >
            <Plus size={22} color={colors.primary200} strokeWidth={2.3} />
          </Pressable>
        ),
      }}
    />
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerStyle={{ paddingBottom: tabInset + 24 }}
      contentContainerClassName="px-4 pt-3"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      {!ready ? (
        <RecordsPageSkeleton />
      ) : isEmpty ? (
        <EmptyState icon={FolderHeart} title={ka.records.empty} body={ka.records.emptyHint}>
          <Button label={ka.records.addCta} icon={Plus} size="lg" onPress={startUpload} />
        </EmptyState>
      ) : (
        <>
          {records.length > 0 ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-4 px-4">
                {FILTERS.map((option) => {
                  const selected = filter === option;
                  const label = option === 'ALL' ? ka.records.filterAll : ka.records.types[option];
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setFilter(option)}
                      className={`mr-2 rounded-full border px-3.5 py-2 active:opacity-70 ${
                        selected ? 'border-primary-200 bg-primary-200' : 'border-bg-300 bg-surface'
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-text-200'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {visible.map((record) => (
                <Card key={record.id} className="mb-2.5" onPress={() => router.push(`/record/${record.id}`)}>
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-100/50">
                      <FileText size={17} color={colors.primary200} strokeWidth={2.1} />
                    </View>

                    <View className="ml-3 flex-1">
                      <View className="flex-row items-center">
                        <Badge label={ka.records.types[record.type] ?? record.type} tone="brand" />
                        <Text className="ml-2 text-xs text-text-300">{formatRelative(record.createdAt)}</Text>
                      </View>
                      <Text numberOfLines={2} className="mt-1.5 text-sm leading-5 text-text-200">
                        {plainSummary(record.aiAnalysis)}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={ka.common.delete}
                      hitSlop={10}
                      className="ml-2"
                      onPress={() => removeRecord(record.id)}
                    >
                      <Trash2 size={16} color={colors.text300} strokeWidth={2} />
                    </Pressable>
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {chats.length > 0 ? (
            <>
              <Text className="mb-3 mt-4 text-lg font-bold text-text-100">{ka.chats.title}</Text>
              {chats.map((chat) => (
                <Card
                  key={chat.id}
                  className="mb-2.5"
                  onPress={() =>
                    router.push(`/chat/${chat.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}?sessionId=${chat.id}`)
                  }
                >
                  <View className="flex-row items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-bg-200">
                      <MessageSquareText size={17} color={colors.primary200} strokeWidth={2.1} />
                    </View>

                    <View className="ml-3 flex-1">
                      <Text numberOfLines={1} className="text-base font-semibold text-text-100">
                        {chat.title}
                      </Text>
                      <Text numberOfLines={1} className="mt-0.5 text-sm text-text-300">
                        {chat.preview || formatRelative(chat.updatedAt)}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={ka.common.delete}
                      hitSlop={10}
                      className="ml-2 mr-1"
                      onPress={() => removeChat(chat.id)}
                    >
                      <Trash2 size={16} color={colors.text300} strokeWidth={2} />
                    </Pressable>
                    <ChevronRight size={18} color={colors.text300} strokeWidth={2.2} />
                  </View>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
    {!isEmpty ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ka.records.addCta}
        onPress={startUpload}
        style={{
          position: 'absolute',
          right: 16,
          bottom: tabInset - 40,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary200,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 3,
        }}
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2.4} />
      </Pressable>
    ) : null}
    </>
  );
}

/** First readable sentence of the Markdown analysis, for the list preview. */
function plainSummary(markdown: string): string {
  const line = markdown
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('|'));

  if (!line) return '';
  const clean = line.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1').replace(/[*`>]/g, '');
  return clean.length <= 130 ? clean : `${clean.slice(0, 127)}…`;
}
