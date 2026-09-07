import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronRight, Flame } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Bone } from '@/components/ui/Skeleton';
import { QuestClaimButton } from '@/components/quest/QuestClaimButton';
import { QuestCoinMark, QuestIcon } from '@/components/quest/QuestIcon';
import { QuestLevelRing } from '@/components/quest/QuestLevelRing';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestReward } from '@/components/quest/QuestReward';
import { QuestRewardFloat } from '@/components/quest/QuestRewardFloat';
import { QuestSegmentedProgress } from '@/components/quest/QuestSegmentedProgress';
import { QuestStatChip } from '@/components/quest/QuestStatChip';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { presentQuestLevelUp, subscribeMediCoinBalance, getMediCoinBalanceHint } from '@/lib/quest/cache';
import {
  dailyCounter,
  dailySegments,
  formatQuestNumber,
  homeModuleView,
  levelRingProgress,
  questKind,
  rankKeyFromLevel,
  rankLabel,
} from '@/lib/quest/logic.js';
import { moodLine, movementContextLine, progressLabel, q, questTitles } from '@/lib/quest/copy';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const LOCALE = 'ka';

export function HomeMediQuestSection() {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const copy = q(LOCALE);
  const offline = useOffline();
  const { dashboard, loading, error, stale, claim, mood, refresh, fixtureOffline } = useQuestDashboard();
  const view = homeModuleView({ dashboard, loading, error, stale });
  const seed = `${dashboard?.daily.periodKey || 'day'}:${dashboard?.profile?.level || 0}`;
  // Phase 5 §48 — when the priority mission is an active movement quest, the one
  // Medi line becomes the smart contextual line (reason/time based; weather
  // context lives in the hub). No extra card, no extra rows.
  const noMissions = view.priority?.mode === 'empty';
  const priorityQuest = view.priority?.mode === 'preview' ? view.priority.quest : null;
  const line = useMemo(() => {
    if (noMissions) return copy.empty;
    if (priorityQuest) {
      const smart = movementContextLine(priorityQuest, {}, LOCALE);
      if (smart) return smart;
    }
    return moodLine(mood, seed, LOCALE);
  }, [mood, seed, priorityQuest, noMissions, copy.empty]);
  const [claiming, setClaiming] = useState(false);
  const [floatReward, setFloatReward] = useState<string | null>(null);
  const [displayCoins, setDisplayCoins] = useState<number | null>(null);
  const claimBlocked = offline || fixtureOffline;

  useEffect(() => {
    const hint = getMediCoinBalanceHint();
    if (hint != null) setDisplayCoins(hint);
    else if (dashboard?.profile) setDisplayCoins(dashboard.profile.coinBalance);
  }, [dashboard?.profile?.coinBalance]);

  useEffect(() => {
    return subscribeMediCoinBalance((coins) => {
      if (coins != null) setDisplayCoins(coins);
    });
  }, []);

  const openHub = () => router.push('/medi-quest' as never);

  if (view.kind === 'loading') {
    return (
      <Section title={copy.section}>
        <Shell>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Bone width={QUEST.ringHome} height={QUEST.ringHome} radius={999} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bone width="52%" height={18} radius={8} />
              <Bone width="70%" height={12} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Bone height={56} width="48%" radius={16} />
            <Bone height={56} width="48%" radius={16} />
          </View>
          <Bone width="38%" height={12} style={{ marginTop: 16 }} />
          <Bone height={8} radius={999} style={{ marginTop: 8 }} />
        </Shell>
      </Section>
    );
  }

  if (view.kind === 'error') {
    return (
      <Section title={copy.section}>
        <Shell>
          <QuestMediLine text={copy.loadError} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.retry}
            onPress={() => void refresh()}
            style={{ marginTop: 10, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200 }}>
              {copy.retry}
            </Text>
          </Pressable>
        </Shell>
      </Section>
    );
  }

  // Only hide the identity card when there is no profile to show.
  // No missions today still shows level / coins / streak; the empty
  // sentence is the Medi line under those stats, same as the hub.
  if (view.kind === 'empty' || !dashboard?.profile) {
    return (
      <Section title={copy.section}>
        <Shell onPress={openHub}>
          <QuestMediLine text={copy.empty} />
        </Shell>
      </Section>
    );
  }

  const profile = dashboard.profile;
  const ring = levelRingProgress(profile);
  const counter = dailyCounter(dashboard.summary);
  const segments = dailySegments(dashboard.daily.quests);
  const claimable = view.priority?.mode === 'claimable';
  const quest = view.priority?.quest;
  const titles = quest ? questTitles(quest, LOCALE) : null;
  const allDone = view.priority?.mode === 'done' || mood === 'all_daily_complete';
  const rank = rankLabel(profile.rankKey, LOCALE);
  const claimCount = view.priority?.claimCount || 0;

  const onClaim = async () => {
    if (!quest || claiming || claimBlocked) return;
    setClaiming(true);
    const result = await claim(quest.id);
    setClaiming(false);
    if (!result) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setFloatReward(`+${result.reward.coinsAwarded} · +${result.reward.xpAwarded} ${copy.xp}`);
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

  const a11y = [
    `${copy.level} ${profile.level}`,
    rank,
    copy.missionsDone(counter.done, counter.total),
    `${formatQuestNumber(displayCoins ?? profile.coinBalance, LOCALE)} ${copy.coinsName}`,
    profile.currentStreak > 0 ? copy.streakDays(profile.currentStreak) : copy.streakStart,
  ].join('. ');

  return (
    <Section title={copy.section}>
      <Animated.View entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).springify().damping(18)}>
        <Shell onPress={openHub} accessibilityLabel={a11y}>
          <Wash />

          {/* Level + rank */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <QuestLevelRing percent={ring.percent} label={String(profile.level)} size={QUEST.ringHome} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 18,
                  lineHeight: 24,
                  letterSpacing: -0.3,
                  color: colors.text100,
                }}
              >
                {rank}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.text300,
                  marginTop: 2,
                }}
              >
                {copy.level} {profile.level}
                {ring.maxed ? `  ·  ${copy.maxLevel}` : ring.remaining != null ? `  ·  ${copy.xpLeft(formatQuestNumber(ring.remaining, LOCALE))}` : ''}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.primary200} strokeWidth={2.3} />
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <QuestStatChip
              icon={<QuestCoinMark size={18} color={dark ? QUEST.pill.coinInkDark : QUEST.pill.coinInkLight} />}
              wellColor={dark ? QUEST.pill.coinDark : QUEST.pill.coinLight}
              value={formatQuestNumber(displayCoins ?? profile.coinBalance, LOCALE)}
              label={copy.coinsName}
            />
            <QuestStatChip
              icon={
                <Flame
                  size={18}
                  color={profile.currentStreak > 0 ? colors.warning : colors.text300}
                  fill={profile.currentStreak > 0 ? colors.warning : 'transparent'}
                  strokeWidth={2.2}
                />
              }
              wellColor={profile.currentStreak > 0 ? colors.warningBg : dark ? colors.bg200 : colors.bg200}
              value={profile.currentStreak > 0 ? copy.streakDays(profile.currentStreak) : '—'}
              label={copy.streakLabel}
            />
          </View>

          {/* Daily missions */}
          {counter.total > 0 ? (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: colors.text200 }}>
                  {copy.dailyMissions}
                </Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: counter.allDone ? colors.success : colors.text100 }}>
                  {counter.done} / {counter.total}
                </Text>
              </View>
              <View style={{ marginTop: 8 }}>
                <QuestSegmentedProgress segments={segments} accessibilityLabel={copy.missionsDone(counter.done, counter.total)} />
              </View>
            </View>
          ) : null}

          {/* Claim strip or Medi line */}
          <Animated.View layout={reduce ? undefined : LinearTransition.duration(QUEST.motion.base)} style={{ marginTop: 14 }}>
            {claimable && quest && titles ? (
              <Animated.View
                key="claim"
                entering={reduce ? undefined : FadeIn.duration(QUEST.motion.fast)}
                exiting={reduce ? undefined : FadeOut.duration(QUEST.motion.fast)}
                style={{
                  borderRadius: QUEST.rowRadius,
                  padding: 12,
                  backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.lightSoft,
                  borderWidth: 1,
                  borderColor: dark ? colors.accent200 : colors.accent200,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <QuestIcon kind={questKind(quest) === 'weekly' ? 'weekly' : questKind(quest)} ready size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: colors.text100 }}>
                      {titles.title}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: colors.text300 }}>
                      {claimCount > 1 ? copy.rewardWaiting(claimCount) : copy.rewardReady}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 10, marginLeft: 46 }}>
                  <QuestReward xp={quest.rewardXp} coins={quest.rewardCoins} locale={LOCALE} />
                </View>
                <View style={{ marginTop: 10 }}>
                  <QuestClaimButton
                    label={copy.claim}
                    loading={claiming}
                    disabled={claimBlocked}
                    onPress={() => void onClaim()}
                  />
                  {claimBlocked ? (
                    <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: colors.text300 }}>
                      {copy.connectToClaim}
                    </Text>
                  ) : null}
                </View>
              </Animated.View>
            ) : (
              <Animated.View key="line" entering={reduce ? undefined : FadeIn.duration(QUEST.motion.fast)}>
                <QuestMediLine text={line} />
                {quest && titles && !allDone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <QuestIcon kind={questKind(quest) === 'weekly' ? 'weekly' : questKind(quest)} size={28} />
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: colors.text200 }}>
                      {titles.title}
                    </Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: colors.text100 }}>
                      {progressLabel(quest, LOCALE)}
                    </Text>
                  </View>
                ) : null}
              </Animated.View>
            )}
          </Animated.View>

          {stale ? (
            <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: colors.text300 }}>
              {copy.stale}
            </Text>
          ) : null}
        </Shell>
      </Animated.View>
      {/* Sits on the empty right half of the section title row, clear of the card title. */}
      <QuestRewardFloat text={floatReward} top={-6} align="end" inset={QUEST.pad} />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 4, gap: 8, minHeight: QUEST.homeMinHeight, position: 'relative' }}>
      <HomeSectionTitle title={title} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      <View style={{ marginHorizontal: 16 }}>{children}</View>
    </View>
  );
}

/** 24px hero card, hairline border, brand wash — same chrome as weather / hydration. */
function Shell({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const style = {
    backgroundColor: dark ? colors.surface : '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.bg300,
    borderRadius: QUEST.radius,
    padding: QUEST.pad,
    overflow: 'hidden' as const,
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className="active:opacity-90"
        style={style}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={style}>{children}</View>;
}

/** Soft brand disc bleeding off the top-right corner — same trick as the weather card. */
function Wash() {
  const dark = useIsDark();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: -36,
        top: -44,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
        opacity: dark ? 0.9 : 0.55,
      }}
    />
  );
}
