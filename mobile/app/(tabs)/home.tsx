import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Clock, MessageSquareText, Pill, Sparkles } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { UsageBanner } from '@/components/PlanUsageCard';
import { Disclaimer } from '@/components/Disclaimer';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeStartSection } from '@/components/home/HomeStartSection';
import { HomePowerToolsSection } from '@/components/home/HomePowerToolsSection';
import { modulesForGender, POWER_TOOL_MODULE_KEYS, SPOTLIGHT_MODULE_KEYS, type ModuleTile } from '@/constants/modules';
import { homeAccentFor } from '@/constants/homeVisuals';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { ka } from '@/i18n/ka';
import { api, type ChatSummary, type ScheduledDose } from '@/lib/api';
import { formatRelative, nextDoseTime } from '@/lib/format';
import { getCyclePromptSeen, type HomeLanding } from '@/lib/homeScreenPrefs';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors, useIsDark } from '@/theme/colors';
import { OnboardingDevLauncher } from '@/components/dev/OnboardingDevLauncher';
import { useAuth } from '@/store/AuthContext';

export default function Home() {
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const isDark = useIsDark();

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
  const spotlights = tiles.filter((tile) => SPOTLIGHT_MODULE_KEYS.has(tile.key));
  const powerTools = tiles.filter((tile) => POWER_TOOL_MODULE_KEYS.has(tile.key));
  const serviceTiles = tiles.filter(
    (tile) => !SPOTLIGHT_MODULE_KEYS.has(tile.key) && !POWER_TOOL_MODULE_KEYS.has(tile.key),
  );

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg-100"
        contentContainerStyle={{ paddingTop: insets.top + S.topInset, paddingBottom: tabInset }}
        contentContainerClassName="px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />
        }
        showsVerticalScrollIndicator={false}
      >
        <HomeHero
          firstName={firstName}
          initials={initials || 'M'}
          onAskDoctor={() => router.push('/chat/doctor' as never)}
        />

        <View>
        <UsageBanner compact />
        </View>

        <HomeStartSection
          spotlights={spotlights}
          onPress={(tile) => router.push(tile.href as never)}
        />

        {nextDose ? (
          <>
            <SectionLabel title={ka.home.nextDose} />
            <Card onPress={() => router.push('/(tabs)/medications')}>
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.successBg,
                    borderWidth: 1,
                    borderColor: `${colors.success}40`,
                  }}
                >
                  <Pill size={18} color={colors.success} strokeWidth={2.1} />
                </View>
                <View className="ml-2.5 flex-1">
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

        <HomePowerToolsSection
          tools={powerTools}
          onPress={(tile) => router.push(tile.href as never)}
        />

        <SectionLabel title={ka.home.analysisTools} />
        <View className="flex-row flex-wrap" style={{ gap: S.blockGap }}>
          {serviceTiles.map((tile) => (
            <ServiceTile key={tile.key} tile={tile} onPress={() => router.push(tile.href as never)} />
          ))}
        </View>

        <View
          className="flex-row items-center justify-between"
          style={{ marginTop: S.sectionTop, marginBottom: S.sectionLabelBottom }}
        >
          <SectionLabel title={ka.home.recentActivity} inline />
          {chats.length > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/(tabs)/records')}>
              <Text className="text-sm font-semibold text-primary-200">{ka.common.seeAll}</Text>
            </Pressable>
          ) : null}
        </View>

        {chats.length === 0 ? (
          <Card>
            <View className="items-center py-3">
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: homeAccentFor('doctor', isDark).soft,
                  borderWidth: 1,
                  borderColor: homeAccentFor('doctor', isDark).border,
                }}
              >
                <Sparkles size={24} color={colors.primary200} strokeWidth={2.1} />
              </View>
              <Text className="mt-3 text-center text-base font-semibold text-text-200">{ka.home.noActivity}</Text>
              <Text className="mt-1.5 text-center text-sm leading-5 text-text-300">{ka.home.noActivityHint}</Text>
            </View>
          </Card>
        ) : (
          chats.map((chat, index) => (
            <ActivityRow
              key={chat.id}
              chat={chat}
              accentKey={index === 0 ? 'doctor' : index === 1 ? 'consilium' : 'lab'}
              onPress={() =>
                router.push(`/chat/${chat.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}?sessionId=${chat.id}`)
              }
            />
          ))
        )}

        <Disclaimer className="mt-4" />
      </ScrollView>

      <DefaultHomePrompt visible={showCyclePrompt} onClose={onPromptClose} />
      <OnboardingDevLauncher variant="fab" />
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
    <Text
      style={{ marginTop: S.sectionTop, marginBottom: S.sectionLabelBottom }}
      className={`text-[10px] font-bold uppercase tracking-[1px] text-text-300 ${className}`}
    >
      {title}
    </Text>
  );
}

function ServiceTile({ tile, onPress }: { tile: ModuleTile; onPress: () => void }) {
  const isDark = useIsDark();
  const accent = homeAccentFor(tile.key, isDark);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={onPress}
      className="active:opacity-88"
      style={{
        width: '48%',
        borderRadius: S.cardRadius,
        borderWidth: 1,
        borderColor: accent.border,
        backgroundColor: accent.soft,
        padding: 10,
        minHeight: 96,
      }}
    >
      <View
        style={{
          width: S.iconSm,
          height: S.iconSm,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: accent.bg,
        }}
      >
        <tile.icon size={18} color="#ffffff" strokeWidth={2.1} />
      </View>
      <Text className="mt-2 text-[13px] font-bold leading-[17px] text-text-100" numberOfLines={2}>
        {tile.title}
      </Text>
      <Text className="mt-0.5 text-[10px] leading-[14px] text-text-300" numberOfLines={2}>
        {tile.subtitle}
      </Text>
    </Pressable>
  );
}

function ActivityRow({
  chat,
  accentKey,
  onPress,
}: {
  chat: ChatSummary;
  accentKey: string;
  onPress: () => void;
}) {
  const isDark = useIsDark();
  const accent = homeAccentFor(accentKey, isDark);

  return (
    <Card className="mb-2" onPress={onPress}>
      <View className="flex-row items-center">
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent.bg,
          }}
        >
          <MessageSquareText size={17} color="#ffffff" strokeWidth={2.1} />
        </View>
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-text-100">
            {chat.title}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-sm text-text-300">
            {chat.preview || formatRelative(chat.updatedAt)}
          </Text>
        </View>
        <ChevronRight size={18} color={accent.bg} strokeWidth={2.4} />
      </View>
    </Card>
  );
}
