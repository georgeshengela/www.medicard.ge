import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Droplets, Flame, Footprints, Gift, History, Sparkles, Trophy, Wallet } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { Bone } from '@/components/ui/Skeleton';
import { QuestCard } from '@/components/quest/QuestCard';
import { QuestHubHeader } from '@/components/quest/QuestHubHeader';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestRewardFloat } from '@/components/quest/QuestRewardFloat';
import { QuestSegmentedProgress } from '@/components/quest/QuestSegmentedProgress';
import { QuestAchievementBadge } from '@/components/quest/QuestAchievementBadge';
import { QuestDevLauncher } from '@/components/dev/QuestDevLauncher';
import { useAchievements } from '@/hooks/useAchievements';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useWeather } from '@/hooks/useWeather';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';
import { isHealthSyncEnabled } from '@/lib/healthSync.shared';
import type { QuestItem } from '@/lib/quest/api';
import { rewardsApi } from '@/lib/quest/rewardsApi';
import { moodLine, movementContextLine, q, whyTargetCopy, type QuestWeatherContext } from '@/lib/quest/copy';
import { showWhyTarget } from '@/lib/quest/smartContext.js';
import { achievementCopy } from '@/i18n/quest/achievements.js';
import type { AchievementItem, AchievementsOverview } from '@/lib/quest/achievements';
import { achievementsCounter, achievementsPreview, dailyCounter, dailySegments, formatQuestNumber, questKind, rankKeyFromLevel } from '@/lib/quest/logic.js';
import {
  getMediCoinBalanceHint,
  invalidateMediCoinBalance,
  presentQuestLevelUp,
  requestEntitlementRefresh,
  subscribeEntitlementRefresh,
  subscribeMediCoinBalance,
} from '@/lib/quest/cache';
import { trackQuestEvent } from '@/lib/productObservability';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { QUEST } from '@/theme/questTokens';

export default function MediQuestHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const { user } = useAuth();
  const offline = useOffline();
  const reduce = usePrefersReducedMotion();
  const weather = useWeather();
  const copy = q('ka');
  const { dashboard, loading, error, stale, refresh, claim, mood, fixtureOffline } = useQuestDashboard();
  const claimBlocked = offline || fixtureOffline;
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [displayCoins, setDisplayCoins] = useState<number | null>(null);
  const [floatReward, setFloatReward] = useState<string | null>(null);
  const [streakInfo, setStreakInfo] = useState(false);
  const [whyQuest, setWhyQuest] = useState<QuestItem | null>(null);
  const [healthOn, setHealthOn] = useState(true);
  const [questStyle, setQuestStyle] = useState(false);

  const loadQuestStyle = useCallback(async () => {
    try {
      const res = await rewardsApi.entitlements();
      setQuestStyle(res.items.some((item) => item.entitlementKey === 'quest.theme.premium'));
    } catch {
      setQuestStyle(false);
    }
  }, []);

  useEffect(() => {
    void trackQuestEvent('quest_hub_opened');
    void isHealthSyncEnabled().then(setHealthOn);
  }, []);

  // Re-fetch on focus so Store → redeem → back shows gold Quest Style without stale mount.
  useFocusEffect(
    useCallback(() => {
      void loadQuestStyle();
    }, [loadQuestStyle]),
  );

  useEffect(() => {
    return subscribeEntitlementRefresh(() => {
      void loadQuestStyle();
    });
  }, [loadQuestStyle]);

  const profile = dashboard?.profile ?? null;

  useEffect(() => {
    const hint = getMediCoinBalanceHint();
    if (hint != null) setDisplayCoins(hint);
    else if (profile) setDisplayCoins(profile.coinBalance);
  }, [profile?.coinBalance]);

  useEffect(() => {
    return subscribeMediCoinBalance((coins) => {
      if (coins != null) setDisplayCoins(coins);
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadQuestStyle()]);
    setRefreshing(false);
  }, [refresh, loadQuestStyle]);

  const windowHint = weather.recommendation?.bestOutdoorWindow
    ? copy.weatherBest(weather.recommendation.bestOutdoorWindow.start, weather.recommendation.bestOutdoorWindow.end)
    : null;

  // Phase 5 — ONE smart contextual Medi line per movement card. Weather Wellness
  // stays the single weather source; it only shapes copy, never target/reward.
  const questWeather: QuestWeatherContext = weather.recommendation
    ? {
        category: weather.recommendation.category,
        severity: weather.recommendation.severity,
        stale: weather.stale,
        bestOutdoorWindow: weather.recommendation.bestOutdoorWindow
          ? { start: weather.recommendation.bestOutdoorWindow.start, end: weather.recommendation.bestOutdoorWindow.end }
          : null,
      }
    : null;
  const contextFor = (quest: QuestItem) =>
    questKind(quest) === 'movement' ? movementContextLine(quest, { weather: questWeather }, 'ka') : null;
  const openWhyTarget = (quest: QuestItem) => {
    void trackQuestEvent('quest_why_target_opened', quest.id);
    setWhyQuest(quest);
  };

  const onClaim = async (id: string) => {
    if (claimingId || claimBlocked) return;
    setClaimingId(id);
    void trackQuestEvent('quest_claim_tapped', id);
    const result = await claim(id);
    setClaimingId(null);
    if (!result) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setFloatReward(`+${result.reward.coinsAwarded} · +${result.reward.xpAwarded} ${copy.xp}`);
    setDisplayCoins(result.profile.coinBalance);
    invalidateMediCoinBalance({ coins: result.profile.coinBalance });
    setTimeout(() => setFloatReward(null), reduce ? 500 : 1400);
    if (result.profile.leveledUp) {
      presentQuestLevelUp({
        level: result.profile.currentLevel,
        previousLevel: result.profile.previousLevel,
        rankKey: rankKeyFromLevel(result.profile.currentLevel),
        coins: result.reward.coinsAwarded,
        xp: result.reward.xpAwarded,
      });
    }
  };

  const daily: QuestItem[] = dashboard?.daily.quests ?? [];
  const weekly: QuestItem[] = dashboard?.weekly.quests ?? [];
  const hasSteps = daily.some((row) => questKind(row) === 'movement') || weekly.some((row) => questKind(row) === 'movement');
  const hasHydro = daily.some((row) => questKind(row) === 'hydration');
  const seed = `${dashboard?.daily.periodKey || ''}:${user?.id || ''}:${mood}`;
  const counter = dailyCounter(dashboard?.summary);
  const segments = dailySegments(daily);

  const openHistory = () => {
    void trackQuestEvent('quest_history_opened');
    router.push('/medi-quest/history' as never);
  };
  const openWallet = () => {
    void trackQuestEvent('quest_wallet_opened');
    router.push('/medi-quest/wallet' as never);
  };
  const openRewards = () => {
    void trackQuestEvent('rewards_store_opened');
    router.push('/medi-quest/rewards' as never);
  };
  const openAchievements = () => {
    void trackQuestEvent('achievements_opened_from_hub');
    router.push('/medi-quest/achievements' as never);
  };

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={8}
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 18,
            lineHeight: 24,
            letterSpacing: -0.2,
            color: colors.text100,
          }}
        >
          {copy.section}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.history}
          hitSlop={8}
          onPress={openHistory}
          className="active:opacity-70"
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? colors.surfaceRaised : colors.surface,
            borderWidth: 1,
            borderColor: colors.bg300,
            marginRight: 8,
          }}
        >
          <History size={18} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 40, gap: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !dashboard ? (
          <HubSkeleton />
        ) : error && !dashboard ? (
          <Animated.View
            entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base)}
            style={{
              marginTop: 48,
              alignItems: 'center',
              backgroundColor: dark ? colors.surface : '#FFFFFF',
              borderWidth: 1,
              borderColor: colors.bg300,
              borderRadius: QUEST.radius,
              paddingHorizontal: QUEST.pad + 8,
              paddingVertical: 28,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
              }}
            >
              <Sparkles size={26} color={colors.primary200} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                marginTop: 16,
                textAlign: 'center',
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 14,
                lineHeight: 20,
                color: colors.text200,
              }}
            >
              {copy.loadError}
            </Text>
            <View style={{ marginTop: 18, alignSelf: 'stretch' }}>
              <Button label={copy.retry} onPress={() => void refresh()} />
            </View>
          </Animated.View>
        ) : dashboard ? (
          <>
            {profile ? (
              <Animated.View entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base)}>
                <QuestHubHeader
                  profile={profile}
                  locale="ka"
                  displayCoins={displayCoins ?? profile.coinBalance}
                  onCoinsPress={openWallet}
                  onStreakPress={() => setStreakInfo(true)}
                  questStyle={questStyle}
                />
              </Animated.View>
            ) : null}

            <Animated.View entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(80)} style={{ gap: 6 }}>
              <QuestMediLine text={moodLine(mood, seed, 'ka')} />
              {stale || claimBlocked ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300, marginLeft: 21 }}>
                  {copy.stale}
                </Text>
              ) : null}
            </Animated.View>

            {/* Today */}
            <View style={{ gap: 12 }}>
              <Animated.View entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(120)}>
                <SectionHead
                  title={copy.today}
                  meta={counter.total > 0 ? `${counter.done} / ${counter.total}` : undefined}
                  metaTone={counter.allDone ? 'success' : 'default'}
                />
                {segments.length > 0 ? (
                  <View style={{ marginTop: 10 }}>
                    <QuestSegmentedProgress segments={segments} height={6} accessibilityLabel={copy.missionsDone(counter.done, counter.total)} />
                  </View>
                ) : null}
              </Animated.View>

              {daily.length === 0 ? (
                <View
                  style={{
                    backgroundColor: dark ? colors.surface : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: colors.bg300,
                    borderRadius: QUEST.radius,
                    padding: QUEST.pad,
                  }}
                >
                  <QuestMediLine text={copy.empty} />
                </View>
              ) : (
                daily.map((quest, index) => {
                  const hint = contextFor(quest);
                  return (
                    <QuestCard
                      key={quest.id}
                      index={index + 1}
                      quest={quest}
                      contextHint={hint}
                      contextIsWindow={Boolean(hint && questWeather?.bestOutdoorWindow && hint.includes(questWeather.bestOutdoorWindow.start))}
                      whyTargetLabel={showWhyTarget(quest) ? copy.whyTarget.button : null}
                      onWhyTarget={() => openWhyTarget(quest)}
                      offline={claimBlocked}
                      claiming={claimingId === quest.id}
                      onClaim={() => void onClaim(quest.id)}
                      onOpenMedi={() => router.push('/chat/doctor' as never)}
                    />
                  );
                })
              )}
            </View>

            {/* Weekly */}
            {weekly.length ? (
              <View style={{ gap: 12 }}>
                <Animated.View entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(200)}>
                  <SectionHead title={copy.weekly} meta={copy.untilSunday} />
                </Animated.View>
                {weekly.map((quest, index) => (
                  <QuestCard
                    key={quest.id}
                    index={daily.length + index + 1}
                    quest={quest}
                    weekly
                    contextHint={questKind(quest) === 'movement' ? windowHint : null}
                    contextIsWindow
                    offline={claimBlocked}
                    claiming={claimingId === quest.id}
                    onClaim={() => void onClaim(quest.id)}
                  />
                ))}
              </View>
            ) : null}

            {/* Achievements preview */}
            <AchievementsPreview onPress={openAchievements} />

            {/* Unlock cards */}
            {!hasSteps && !healthOn ? (
              <UnlockCard
                icon={<Footprints size={20} color={QUEST.accent.movement} strokeWidth={2.2} />}
                title={copy.unlockSteps}
                body={copy.setupSteps}
                cta={copy.connect}
                onPress={() => {
                  void trackQuestEvent('step_setup_opened');
                  router.push('/profile/permissions' as never);
                }}
              />
            ) : null}

            {!hasHydro ? (
              <UnlockCard
                icon={<Droplets size={20} color={QUEST.accent.hydration} strokeWidth={2.2} />}
                title={copy.unlockHydro}
                body={copy.setupHydro}
                cta={copy.setGoal}
                onPress={() => {
                  void trackQuestEvent('hydration_setup_opened');
                  router.push('/health-metrics/hydration' as never);
                }}
              />
            ) : null}

            {/* Footer tiles */}
            <Animated.View
              entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(260)}
              style={{ flexDirection: 'column', gap: 8 }}
            >
              <NavTile icon={<History size={18} color={colors.primary200} strokeWidth={2.2} />} label={copy.history} onPress={openHistory} />
              <NavTile icon={<Wallet size={18} color={colors.primary200} strokeWidth={2.2} />} label={copy.wallet} onPress={openWallet} />
              <NavTile icon={<Gift size={18} color={colors.primary200} strokeWidth={2.2} />} label={copy.rewardsStore} onPress={openRewards} />
            </Animated.View>
          </>
        ) : null}
      </ScrollView>

      <QuestRewardFloat text={floatReward} top={insets.top + 60} />
      <QuestDevLauncher variant="chip" />

      <Modal visible={streakInfo} {...APP_MODAL_PROPS} onRequestClose={() => setStreakInfo(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }} onPress={() => setStreakInfo(false)} />
          <View
            style={{
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.surface,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 20) + 8,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.bg300, marginBottom: 20 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.warningBg,
                }}
              >
                <Flame size={26} color={colors.warning} fill={colors.warning} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, color: colors.text100 }}>
                  {profile && profile.currentStreak > 0 ? copy.streakDays(profile.currentStreak) : copy.streakStart}
                </Text>
                {profile && profile.longestStreak > 0 ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: colors.text300, marginTop: 2 }}>
                    {copy.streakLabel} · max {copy.streakDays(profile.longestStreak)}
                  </Text>
                ) : null}
              </View>
            </View>
            <Text style={{ marginTop: 16, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: colors.text200 }}>
              {copy.streakHint}
            </Text>
            <View style={{ marginTop: 20 }}>
              <Button label={copy.continue} onPress={() => setStreakInfo(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Phase 5 — "Why this goal?" bottom sheet (Medi explanation, no algorithm internals). */}
      <Modal visible={whyQuest != null} {...APP_MODAL_PROPS} onRequestClose={() => setWhyQuest(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }} onPress={() => setWhyQuest(null)} />
          <View
            style={{
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.surface,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 20) + 8,
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.bg300, marginBottom: 20 }} />
            {whyQuest ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
                    }}
                  >
                    <Footprints size={26} color={QUEST.accent.movement} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, color: colors.text100 }}>
                      {whyTargetCopy(whyQuest, 'ka').title}
                    </Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: colors.text300, marginTop: 2 }}>
                      {copy.stepsTitle} · {formatQuestNumber(whyQuest.target, 'ka')}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 16 }}>
                  <QuestMediLine text={whyTargetCopy(whyQuest, 'ka').body} />
                </View>
                <View style={{ marginTop: 20 }}>
                  <Button label={copy.continue} onPress={() => setWhyQuest(null)} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Phase 4 — compact achievements strip: medallions + unlocked counter → collection screen. */
function AchievementsPreview({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const copy = achievementCopy('ka');
  const { overview } = useAchievements();
  if (!overview || !overview.items.length) return null;

  const counter = achievementsCounter(overview.summary);
  const preview = achievementsPreview(overview.items, 4) as AchievementItem[];
  const overviewTyped = overview as AchievementsOverview;
  if (!preview.length) return null;

  return (
    <View style={{ gap: 12 }}>
      <Animated.View
        entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(230)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.text100 }}>
          {copy.preview}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: counter.claimable > 0 ? colors.success : colors.text300 }}>
          {counter.unlocked} / {counter.total}
        </Text>
      </Animated.View>
      <Animated.View entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(260)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${copy.preview}. ${copy.unlockedOf(counter.unlocked, counter.total)}`}
          onPress={onPress}
          className="active:opacity-80"
          style={{
            backgroundColor: dark ? colors.surface : '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.bg300,
            borderRadius: QUEST.radius,
            padding: QUEST.pad,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              {preview.map((item) => (
                <QuestAchievementBadge key={item.id} item={item} size={44} showClaimedMark={false} />
              ))}
            </View>
            <ChevronRight size={18} color={colors.text300} strokeWidth={2.3} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Trophy size={13} color={colors.primary200} strokeWidth={2.4} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17, color: colors.text300 }}
            >
              {counter.claimable > 0
                ? copy.claimableLine(counter.claimable)
                : overviewTyped.summary.secretsLocked > 0
                  ? copy.secretBody
                  : copy.unlockedOf(counter.unlocked, counter.total)}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function SectionHead({ title, meta, metaTone = 'default' }: { title: string; meta?: string; metaTone?: 'default' | 'success' }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.text100 }}>
        {title}
      </Text>
      {meta ? (
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 13,
            lineHeight: 18,
            color: metaTone === 'success' ? colors.success : colors.text300,
          }}
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

function UnlockCard({
  icon,
  title,
  body,
  cta,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(220)}
      style={{
        backgroundColor: dark ? colors.surface : '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.bg300,
        borderStyle: 'dashed',
        borderRadius: QUEST.radius,
        padding: QUEST.pad,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: QUEST.icon,
            height: QUEST.icon,
            borderRadius: QUEST.iconRadius,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: colors.text100 }}>{title}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: colors.text200, marginTop: 2 }}>
            {body}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cta}
        onPress={onPress}
        className="active:opacity-70"
        style={{
          marginTop: 12,
          height: 40,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
        }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.primary100 }}>{cta}</Text>
        <ChevronRight size={16} color={colors.primary100} strokeWidth={2.4} />
      </Pressable>
    </Animated.View>
  );
}

function NavTile({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-75"
      style={{
        alignSelf: 'stretch',
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        borderRadius: QUEST.rowRadius,
        borderWidth: 1,
        borderColor: colors.bg300,
        backgroundColor: dark ? colors.surface : '#FFFFFF',
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
        }}
      >
        {icon}
      </View>
      <Text
        style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: colors.text100 }}
        numberOfLines={2}
      >
        {label}
      </Text>
      <ChevronRight size={16} color={colors.text300} strokeWidth={2.3} />
    </Pressable>
  );
}

function HubSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, borderRadius: QUEST.radius, padding: QUEST.pad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Bone width={QUEST.ringHub} height={QUEST.ringHub} radius={999} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="30%" height={10} />
            <Bone width="70%" height={22} radius={8} />
            <Bone width="50%" height={12} />
            <Bone height={8} radius={999} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Bone height={56} width="48%" radius={16} />
          <Bone height={56} width="48%" radius={16} />
        </View>
      </View>
      <Bone height={14} width="60%" />
      <Bone height={16} width="20%" />
      {[0, 1].map((i) => (
        <View key={i} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, borderRadius: QUEST.radius, padding: QUEST.pad }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bone width={QUEST.icon} height={QUEST.icon} radius={12} />
            <Bone width="50%" height={18} radius={8} />
          </View>
          <Bone height={7} radius={999} style={{ marginTop: 14 }} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
            <Bone width={72} height={22} radius={999} />
            <Bone width={56} height={22} radius={999} />
          </View>
        </View>
      ))}
    </View>
  );
}
