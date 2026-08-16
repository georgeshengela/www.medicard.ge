import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Clock, MessageSquareText, Pill } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { UsageBanner } from '@/components/UsageBanner';
import { Disclaimer } from '@/components/Disclaimer';
import { MODULE_TILES, type ModuleTile } from '@/constants/modules';
import { ka } from '@/i18n/ka';
import { api, type ChatSummary, type ScheduledDose } from '@/lib/api';
import { formatRelative, greeting, nextDoseTime } from '@/lib/format';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

export default function Home() {
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [schedule, setSchedule] = useState<ScheduledDose[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [chatResult, medResult] = await Promise.allSettled([api.chats.list(), api.medications.list()]);
    if (chatResult.status === 'fulfilled') setChats(chatResult.value.sessions.slice(0, 3));
    if (medResult.status === 'fulfilled') setSchedule(medResult.value.schedule);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refresh();
    }, [load, refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  }, [load, refresh]);

  const upcoming = nextDoseTime(schedule.map((dose) => dose.time));
  const nextDose = upcoming ? schedule.find((dose) => dose.time === upcoming) : undefined;

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const [primary, ...secondary] = MODULE_TILES;

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: tabInset }}
      contentContainerClassName="px-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-5">
        <Text className="text-sm text-text-300">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text className="mt-0.5 text-2xl font-bold text-text-100">{ka.home.question}</Text>
      </View>

      <UsageBanner />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(primary.href as never)}
        className="mt-4 flex-row items-center rounded-2xl bg-primary-200 p-4 active:opacity-85"
      >
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
          <primary.icon size={24} color={colors.onPrimary} strokeWidth={2.1} />
        </View>
        <View className="ml-3.5 flex-1">
          <Text className="text-lg font-bold text-white">{primary.title}</Text>
          <Text className="mt-0.5 text-sm text-white/80">{primary.subtitle}</Text>
        </View>
        <ChevronRight size={20} color={colors.onPrimary} strokeWidth={2.2} />
      </Pressable>

      {nextDose ? (
        <Card className="mt-3" onPress={() => router.push('/(tabs)/medications')}>
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-state-successBg">
              <Pill size={18} color={colors.success} strokeWidth={2.1} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-semibold uppercase text-text-300">{ka.home.nextDose}</Text>
              <Text className="mt-0.5 text-base font-bold text-text-100" numberOfLines={1}>
                {nextDose.medName} · {nextDose.dosage}
              </Text>
            </View>
            <Badge label={nextDose.time} tone="success" icon={Clock} />
          </View>
        </Card>
      ) : null}

      <Text className="mb-3 mt-6 text-lg font-bold text-text-100">{ka.home.quickActions}</Text>

      <View className="flex-row flex-wrap justify-between">
        {secondary.map((tile) => (
          <ModuleCard key={tile.key} tile={tile} onPress={() => router.push(tile.href as never)} />
        ))}
      </View>

      <View className="mb-3 mt-6 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-text-100">{ka.home.recentActivity}</Text>
        {chats.length > 0 ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/(tabs)/records')}>
            <Text className="text-sm font-semibold text-primary-200">{ka.common.seeAll}</Text>
          </Pressable>
        ) : null}
      </View>

      {chats.length === 0 ? (
        <Card>
          <Text className="text-base font-semibold text-text-200">{ka.home.noActivity}</Text>
          <Text className="mt-1 text-sm text-text-300">{ka.home.noActivityHint}</Text>
        </Card>
      ) : (
        chats.map((chat) => (
          <Card
            key={chat.id}
            className="mb-2.5"
            onPress={() => router.push(`/chat/${chat.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}?sessionId=${chat.id}`)}
          >
            <View className="flex-row items-center">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-100/50">
                <MessageSquareText size={16} color={colors.primary200} strokeWidth={2.1} />
              </View>
              <View className="ml-3 flex-1">
                <Text numberOfLines={1} className="text-base font-semibold text-text-100">
                  {chat.title}
                </Text>
                <Text numberOfLines={1} className="mt-0.5 text-sm text-text-300">
                  {chat.preview || formatRelative(chat.updatedAt)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.text300} strokeWidth={2.2} />
            </View>
          </Card>
        ))
      )}

      <Disclaimer className="mt-5" />
    </ScrollView>
  );
}

function ModuleCard({ tile, onPress }: { tile: ModuleTile; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={onPress}
      style={{
        shadowColor: 'transparent',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }}
      className="mb-3 w-[48.5%] rounded-2xl border border-bg-300 bg-surface p-3.5 active:opacity-80"
    >
      <View className={`h-11 w-11 items-center justify-center rounded-2xl ${tile.tint}`}>
        <tile.icon size={21} color={tile.iconColor} strokeWidth={2.1} />
      </View>
      <Text className="mt-3 text-base font-bold leading-5 text-text-100">{tile.title}</Text>
      <Text numberOfLines={2} className="mt-1 text-xs leading-4 text-text-300">
        {tile.subtitle}
      </Text>
    </Pressable>
  );
}
