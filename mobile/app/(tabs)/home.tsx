import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Clock,
  FileText,
  MessageSquareText,
  Pill,
  Sparkles,
} from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { UsageBanner } from '@/components/PlanUsageCard';
import { Disclaimer } from '@/components/Disclaimer';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { modulesForGender, type ModuleTile } from '@/constants/modules';
import { ka } from '@/i18n/ka';
import { api, type ChatSummary, type ScheduledDose } from '@/lib/api';
import { formatRelative, greeting, nextDoseTime } from '@/lib/format';
import { getCyclePromptSeen, type HomeLanding } from '@/lib/homeScreenPrefs';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors, useIsDark, type Palette } from '@/theme/colors';
import { useCycleColors } from '@/theme/cycle';
import { useAuth } from '@/store/AuthContext';

export default function Home() {
  const { user, refresh, stats } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [schedule, setSchedule] = useState<ScheduledDose[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);

  const load = useCallback(async () => {
    const [chatResult, medResult] = await Promise.allSettled([api.chats.list(), api.medications.list()]);
    if (chatResult.status === 'fulfilled') setChats(chatResult.value.sessions.slice(0, 3));
    if (medResult.status === 'fulfilled') setSchedule(medResult.value.schedule);
  }, []);

  const maybeShowCyclePrompt = useCallback(async () => {
    if (user?.gender !== 'FEMALE') return;
    const seen = await getCyclePromptSeen();
    if (!seen) setShowCyclePrompt(true);
  }, [user?.gender]);

  useFocusEffect(
    useCallback(() => {
      load();
      refresh();
      void maybeShowCyclePrompt();
    }, [load, refresh, maybeShowCyclePrompt]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  }, [load, refresh]);

  const onPromptClose = useCallback(
    (landing: HomeLanding) => {
      setShowCyclePrompt(false);
      if (landing === 'cycle') router.replace('/cycle' as never);
    },
    [router],
  );

  const upcoming = nextDoseTime(schedule.map((dose) => dose.time));
  const nextDose = upcoming ? schedule.find((dose) => dose.time === upcoming) : undefined;

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const initials = user?.fullName
    ?.split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const tiles = modulesForGender(user?.gender);
  const spotlightKeys = new Set(['doctor', 'cycle']);
  const spotlights = tiles.filter((tile) => spotlightKeys.has(tile.key));
  const serviceTiles = tiles.filter((tile) => !spotlightKeys.has(tile.key));

  const statItems = useMemo(
    () => [
      { label: ka.profile.statRecords, value: stats?.records ?? 0, icon: FileText },
      { label: ka.profile.statChats, value: stats?.chats ?? 0, icon: MessageSquareText },
      { label: ka.profile.statMeds, value: stats?.activeMedications ?? 0, icon: Pill },
    ],
    [stats],
  );

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg-100"
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: tabInset }}
        contentContainerClassName="px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-5 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary-200">
              Medicard.GE
            </Text>
            <Text className="mt-1.5 text-[24px] font-bold leading-8 text-text-100">
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text className="mt-1 text-sm leading-5 text-text-300">{ka.home.tagline}</Text>
          </View>
          <View
            className="h-11 w-11 items-center justify-center bg-accent-100/45"
            style={{ borderRadius: 999 }}
          >
            <Text className="text-sm font-bold text-primary-200">{initials || 'M'}</Text>
          </View>
        </View>

        <View className="mb-1">
          <UsageBanner />
        </View>

        <SectionLabel title={ka.home.startHere} />
        <View>
          {spotlights.map((tile, index) => (
            <SpotlightPanel
              key={tile.key}
              tile={tile}
              colors={colors}
              onPress={() => router.push(tile.href as never)}
              style={index < spotlights.length - 1 ? { marginBottom: 12 } : undefined}
            />
          ))}
        </View>

        <SectionLabel title={ka.home.yourOverview} />
        <Card padded={false}>
          <View className="flex-row">
            {statItems.map((item, index) => (
              <View key={item.label} className="flex-1 flex-row items-center">
                {index > 0 ? <View className="h-10 w-px bg-bg-300" /> : null}
                <View className="flex-1 items-center py-4">
                  <View
                    className="mb-2 h-9 w-9 items-center justify-center bg-accent-100/40"
                    style={{ borderRadius: 999 }}
                  >
                    <item.icon size={16} color={colors.primary200} strokeWidth={2.1} />
                  </View>
                  <Text className="text-xl font-bold text-text-100">{item.value}</Text>
                  <Text className="mt-0.5 text-[10px] font-semibold text-text-300">{item.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {nextDose ? (
          <>
            <SectionLabel title={ka.home.nextDose} />
            <Card onPress={() => router.push('/(tabs)/medications')}>
              <View className="flex-row items-center">
                <View
                  className="h-10 w-10 items-center justify-center bg-state-successBg"
                  style={{ borderRadius: 999 }}
                >
                  <Pill size={18} color={colors.success} strokeWidth={2.1} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-text-100" numberOfLines={1}>
                    {nextDose.medName}
                  </Text>
                  <Text className="mt-0.5 text-sm text-text-300">{nextDose.dosage}</Text>
                </View>
                <Badge label={nextDose.time} tone="success" icon={Clock} />
              </View>
            </Card>
          </>
        ) : null}

        <SectionLabel title={ka.home.allServices} />
        <View>
          {serviceTiles.map((tile) => (
            <ServiceRow
              key={tile.key}
              tile={tile}
              colors={colors}
              onPress={() => router.push(tile.href as never)}
            />
          ))}
        </View>

        <View className="mb-3 mt-6 flex-row items-center justify-between">
          <SectionLabel title={ka.home.recentActivity} inline />
          {chats.length > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/(tabs)/records')}>
              <Text className="text-sm font-semibold text-primary-200">{ka.common.seeAll}</Text>
            </Pressable>
          ) : null}
        </View>

        {chats.length === 0 ? (
          <Card>
            <View className="items-center py-2">
              <View
                className="mb-3 h-12 w-12 items-center justify-center bg-accent-100/35"
                style={{ borderRadius: 999 }}
              >
                <Sparkles size={20} color={colors.primary200} strokeWidth={2.1} />
              </View>
              <Text className="text-center text-base font-semibold text-text-200">{ka.home.noActivity}</Text>
              <Text className="mt-1.5 text-center text-sm leading-5 text-text-300">{ka.home.noActivityHint}</Text>
            </View>
          </Card>
        ) : (
          chats.map((chat) => (
            <Card
              key={chat.id}
              className="mb-2.5"
              onPress={() =>
                router.push(`/chat/${chat.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}?sessionId=${chat.id}`)
              }
            >
              <View className="flex-row items-center">
                <View
                  className="h-9 w-9 items-center justify-center bg-accent-100/50"
                  style={{ borderRadius: 999 }}
                >
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

      <DefaultHomePrompt visible={showCyclePrompt} onClose={onPromptClose} />
    </>
  );
}

function SectionLabel({
  title,
  className = '',
  inline = false,
}: {
  title: string;
  className?: string;
  inline?: boolean;
}) {
  if (inline) {
    return <Text className="text-base font-bold text-text-100">{title}</Text>;
  }
  return (
    <Text className={`mt-6 mb-3.5 text-[11px] font-bold uppercase tracking-[1.2px] text-text-300 ${className}`}>
      {title}
    </Text>
  );
}

function SpotlightPanel({
  tile,
  colors,
  onPress,
  style,
}: {
  tile: ModuleTile;
  colors: Palette;
  onPress: () => void;
  style?: object;
}) {
  const isCycle = tile.key === 'cycle';
  const cycle = useCycleColors();
  const isDark = useIsDark();

  const accent = isCycle ? cycle.rose : colors.primary200;
  const accentInk = isCycle ? cycle.muted : colors.primary100;
  const accentSoft = isCycle ? cycle.roseSoft : colors.accent100;
  const cardBg = isCycle ? (isDark ? cycle.cardSoft : cycle.cream) : colors.surface;
  const borderColor = isCycle ? cycle.border : colors.bg300;
  const iconBg = isDark ? `${accent}22` : accentSoft;

  const eyebrow = isCycle ? ka.home.cycleEyebrow : ka.home.doctorEyebrow;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={onPress}
      style={[
        {
          borderRadius: 20,
          borderWidth: 1,
          borderColor,
          backgroundColor: cardBg,
          overflow: 'hidden',
        },
        style,
      ]}
      className="active:opacity-90"
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: accent,
        }}
      />

      <View style={{ paddingVertical: 15, paddingRight: 14, paddingLeft: 18 }}>
        <View className="flex-row items-start">
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: iconBg,
              borderWidth: 1,
              borderColor: `${accent}30`,
            }}
          >
            <tile.icon size={23} color={accent} strokeWidth={2.15} />
          </View>

          <View className="ml-3.5 min-w-0 flex-1">
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                letterSpacing: 1.15,
                textTransform: 'uppercase',
                color: accentInk,
              }}
            >
              {eyebrow}
            </Text>
            <Text className="mt-1 text-[17px] font-bold leading-[22px] tracking-[-0.2px] text-text-100">
              {tile.title}
            </Text>
            <Text className="mt-1 text-[13px] leading-[18px] text-text-300" numberOfLines={2}>
              {tile.subtitle}
            </Text>
          </View>

          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? colors.bg200 : colors.bg100,
              borderWidth: 1,
              borderColor: colors.bg300,
              marginLeft: 6,
              marginTop: 4,
            }}
          >
            <ChevronRight size={16} color={accent} strokeWidth={2.4} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ServiceRow({
  tile,
  colors,
  onPress,
}: {
  tile: ModuleTile;
  colors: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={onPress}
      className="mb-2 flex-row items-center border border-bg-300 bg-surface p-3.5 active:opacity-80"
      style={{ borderRadius: 18 }}
    >
      <View
        className={`h-11 w-11 items-center justify-center ${tile.tint}`}
        style={{ borderRadius: 999 }}
      >
        <tile.icon size={20} color={tile.iconColor} strokeWidth={2.1} />
      </View>
      <View className="ml-3.5 flex-1">
        <Text className="text-[15px] font-bold text-text-100">{tile.title}</Text>
        <Text className="mt-0.5 text-xs leading-4 text-text-300" numberOfLines={1}>
          {tile.subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.text300} strokeWidth={2.2} />
    </Pressable>
  );
}
