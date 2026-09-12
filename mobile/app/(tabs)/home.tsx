import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, MessageSquareText, Sparkles } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Disclaimer } from '@/components/Disclaimer';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeDashboardTop } from '@/components/home/HomeDashboardTop';
import { HomeBmiWeightSection } from '@/components/home/HomeBmiWeightSection';
import { HomeNextDoseSection } from '@/components/home/HomeNextDoseSection';
import { HomeHealthMetricsSection } from '@/components/home/HomeHealthMetricsSection';
import { HomeHydrationSection } from '@/components/home/HomeHydrationSection';
import { HomeMediQuestSection } from '@/components/quest/HomeMediQuestSection';
import { HomeMediCompanionEntry } from '@/components/companion/HomeMediCompanionEntry';
import { MediWorldHomeEntry } from '@/components/world/MediWorldHomeEntry';
import { HomeWeatherSection } from '@/components/weather/HomeWeatherSection';
import { HomeRunSection } from '@/components/run/HomeRunSection';
import { HomeLabSection } from '@/components/home/HomeLabSection';
import { HomeCyclePreviewCard } from '@/components/home/HomeCyclePreviewCard';
import { HomeSymptomAssistantCard } from '@/components/home/HomeSymptomAssistantCard';
import { HomeAnalysisSection } from '@/components/home/HomeAnalysisSection';
import { HomeConsiliumCard } from '@/components/home/HomeConsiliumCard';
import { modulesForGender, POWER_TOOL_MODULE_KEYS, SPOTLIGHT_MODULE_KEYS } from '@/constants/modules';
import { homeAccentFor } from '@/constants/homeVisuals';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { ka } from '@/i18n/ka';
import { api, type ChatSummary } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { getCyclePromptSeen, type HomeLanding } from '@/lib/homeScreenPrefs';
import { buildHomeSectionOrder, type HomeSectionId } from '@/lib/home/homeSectionOrder';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors, useIsDark } from '@/theme/colors';
import { OnboardingDevLauncher } from '@/components/dev/OnboardingDevLauncher';
import { NotificationsDevLauncher } from '@/components/dev/NotificationsDevLauncher';
import { QuestDevLauncher } from '@/components/dev/QuestDevLauncher';
import { useAuth } from '@/store/AuthContext';
import { useHydration } from '@/hooks/useHydration';
import { requestQuestRefresh } from '@/lib/quest/cache';
import { healthScoreLabelKa } from '@/lib/healthScore';
import { analysisFromProfile } from '@/types/onboardingAnalysis';

export default function Home() {
  const { user, healthProfile, refresh } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const isDark = useIsDark();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);

  const load = useCallback(async () => {
    try {
      const { sessions } = await api.chats.list();
      setChats(sessions.slice(0, 3));
    } catch {
      /* pull-to-refresh retries */
    }
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
    await Promise.all([load(), refresh(), Promise.resolve(requestQuestRefresh())]);
    setRefreshing(false);
  }, [load, refresh]);

  const onPromptClose = useCallback(
    (landing: HomeLanding) => {
      setShowCyclePrompt(false);
      if (landing === 'cycle') router.replace('/cycle' as never);
    },
    [router],
  );

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const initials = user?.fullName
    ?.split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const tiles = modulesForGender(user?.gender);
  const cycleTile = tiles.find((tile) => tile.key === 'cycle');
  const doctorTile = tiles.find((tile) => tile.key === 'doctor');
  const serviceTiles = tiles.filter(
    (tile) => !SPOTLIGHT_MODULE_KEYS.has(tile.key) && !POWER_TOOL_MODULE_KEYS.has(tile.key),
  );
  const analysisTiles = serviceTiles.filter((tile) => tile.key !== 'consilium');
  const consiliumTile = serviceTiles.find((tile) => tile.key === 'consilium');

  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  const analysis = analysisFromProfile(extra);
  const avatarId = typeof extra.avatarId === 'string' ? extra.avatarId : null;
  const { todayMl } = useHydration();

  const sectionOrder = useMemo(
    () =>
      buildHomeSectionOrder({
        mountNextDoseSlot: true,
        includeConsilium: Boolean(consiliumTile),
        includeCycle: Boolean(cycleTile),
      }),
    [consiliumTile, cycleTile],
  );

  const renderSection = (id: HomeSectionId) => {
    switch (id) {
      case 'dashboard':
        return (
          <HomeDashboardTop
            key={id}
            firstName={firstName}
            initials={initials || 'M'}
            gender={user?.gender}
            avatarId={avatarId}
            streak={user?.currentStreak ?? 0}
            score={analysis?.score ?? null}
            scoreLabel={
              analysis?.score != null ? healthScoreLabelKa(analysis.score) : ka.home.scorePending
            }
            statusLabel={analysis?.bodyComposition?.physiqueLabelKa ?? ka.home.healthyStatus}
            waterLiters={todayMl > 0 ? todayMl / 1000 : null}
            onAvatarPress={() => router.push('/(tabs)/profile' as never)}
            onPackagePress={() => router.push('/package' as never)}
            onStreakPress={() => router.push('/profile/streak' as never)}
            onScorePress={() => {
              if (analysis) router.push('/(auth)/profile-setup/results?preview=1' as never);
            }}
          />
        );
      case 'nextDose':
        return <HomeNextDoseSection key={id} refreshing={refreshing} />;
      case 'mediQuest':
        return (
          <View key={id} style={{ position: 'relative' }}>
            <HomeMediCompanionEntry />
            <HomeMediQuestSection />
            <MediWorldHomeEntry />
          </View>
        );
      case 'steps':
        return <HomeHealthMetricsSection key={id} profile={healthProfile} />;
      case 'hydration':
        return <HomeHydrationSection key={id} />;
      case 'weight':
        return <HomeBmiWeightSection key={id} profile={healthProfile} />;
      case 'cycle':
        return cycleTile ? (
          <View key={id} className="px-4" style={{ marginTop: S.sectionTop }}>
            <HomeCyclePreviewCard onPress={() => router.push(cycleTile.href as never)} />
          </View>
        ) : null;
      case 'lab':
        return <HomeLabSection key={id} />;
      case 'weather':
        return <HomeWeatherSection key={id} />;
      case 'run':
        return <HomeRunSection key={id} />;
      case 'symptom':
        return doctorTile ? (
          <View key={id} className="px-4" style={{ marginTop: S.sectionTop }}>
            <HomeSymptomAssistantCard
              firstName={firstName}
              onPress={() => router.push(doctorTile.href as never)}
            />
          </View>
        ) : null;
      case 'analysis':
        return (
          <View key={id} className="px-4">
            <HomeAnalysisSection
              tiles={analysisTiles}
              onPress={(tile) => router.push(tile.href as never)}
            />
          </View>
        );
      case 'consilium':
        return consiliumTile ? (
          <View key={id} className="px-4">
            <HomeConsiliumCard onPress={() => router.push(consiliumTile.href as never)} />
          </View>
        ) : null;
      case 'recentActivity':
        return (
          <View key={id} className="px-4">
            <View
              className="flex-row items-center justify-between"
              style={{ marginTop: S.sectionTop, marginBottom: S.sectionLabelBottom }}
            >
              <SectionLabel title={ka.home.recentActivity} inline />
              {chats.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push('/(tabs)/records')}
                >
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
                  <Text className="mt-3 text-center text-base font-semibold text-text-200">
                    {ka.home.noActivity}
                  </Text>
                  <Text className="mt-1.5 text-center text-sm leading-5 text-text-300">
                    {ka.home.noActivityHint}
                  </Text>
                </View>
              </Card>
            ) : (
              chats.map((chat, index) => (
                <ActivityRow
                  key={chat.id}
                  chat={chat}
                  accentKey={index === 0 ? 'doctor' : index === 1 ? 'consilium' : 'lab'}
                  onPress={() =>
                    router.push(
                      `/chat/${chat.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}?sessionId=${chat.id}`,
                    )
                  }
                />
              ))
            )}
          </View>
        );
      case 'disclaimer':
        return (
          <View key={id} className="px-4">
            <Disclaimer className="mt-4" />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg-100"
        contentContainerStyle={{ paddingBottom: tabInset + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />
        }
        showsVerticalScrollIndicator={false}
      >
        {sectionOrder.map(renderSection)}
      </ScrollView>

      <DefaultHomePrompt visible={showCyclePrompt} onClose={onPromptClose} />
      <OnboardingDevLauncher variant="fab" />
      <NotificationsDevLauncher />
      <QuestDevLauncher />
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
