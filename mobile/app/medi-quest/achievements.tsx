import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { Bone } from '@/components/ui/Skeleton';
import { QuestAchievementBadge, rarityColors } from '@/components/quest/QuestAchievementBadge';
import { QuestClaimButton } from '@/components/quest/QuestClaimButton';
import { QuestProgressBar } from '@/components/quest/QuestProgressBar';
import { QuestReward } from '@/components/quest/QuestReward';
import { QuestRewardFloat } from '@/components/quest/QuestRewardFloat';
import { useAchievements } from '@/hooks/useAchievements';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsDark, useThemeColors } from '@/theme/colors';
import type { AchievementItem } from '@/lib/quest/achievements';
import { q } from '@/lib/quest/copy';
import { achievementCopy } from '@/i18n/quest/achievements.js';
import { achievementsCounter, formatQuestNumber, groupAchievements, rankKeyFromLevel } from '@/lib/quest/logic.js';
import { presentQuestLevelUp } from '@/lib/quest/cache';
import { trackQuestEvent } from '@/lib/productObservability';
import { QUEST } from '@/theme/questTokens';

export default function QuestAchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const offline = useOffline();
  const questText = q('ka');
  const copy = achievementCopy('ka');
  const { overview, loading, error, stale, refresh, claim } = useAchievements();
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [floatReward, setFloatReward] = useState<string | null>(null);

  useEffect(() => {
    void trackQuestEvent('achievements_opened');
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onClaim = async (item: AchievementItem) => {
    if (claimingId || offline) return;
    setClaimingId(item.id);
    void trackQuestEvent('achievement_claim_tapped', item.key || item.id);
    const result = await claim(item.id);
    setClaimingId(null);
    if (!result || !result.claimed) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setFloatReward(`+${result.reward.coinsAwarded} · +${result.reward.xpAwarded} ${questText.xp}`);
    setTimeout(() => setFloatReward(null), reduce ? 500 : 1400);
    if (result.profile.leveledUp) {
      presentQuestLevelUp({
        level: result.profile.currentLevel,
        previousLevel: result.profile.previousLevel,
        rankKey: result.profile.rankKey || rankKeyFromLevel(result.profile.currentLevel),
        coins: result.reward.coinsAwarded,
        xp: result.reward.xpAwarded,
      });
    }
  };

  const items = overview?.items ?? [];
  const counter = achievementsCounter(overview?.summary);
  const groups = groupAchievements(items);

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={questText.back}
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
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 40, gap: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !overview ? (
          <AchievementsSkeleton />
        ) : error && !overview ? (
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
              <Trophy size={26} color={colors.primary200} strokeWidth={2.2} />
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
              <Button label={questText.retry} onPress={() => void refresh()} />
            </View>
          </Animated.View>
        ) : overview ? (
          <>
            {/* Hero summary */}
            <Animated.View
              entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base)}
              style={{
                backgroundColor: dark ? colors.surface : '#FFFFFF',
                borderWidth: 1,
                borderColor: colors.bg300,
                borderRadius: QUEST.radius,
                padding: QUEST.pad,
                overflow: 'hidden',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
                  }}
                >
                  <Trophy size={26} color={colors.primary200} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.text100 }}>
                    {copy.unlockedOf(counter.unlocked, counter.total)}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: colors.text300, marginTop: 2 }}>
                    {counter.claimable > 0 ? copy.claimableLine(counter.claimable) : copy.subtitle}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 14 }}>
                <QuestProgressBar percent={counter.percent} height={QUEST.barWeekly} />
              </View>
              {stale ? (
                <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300 }}>
                  {questText.stale}
                </Text>
              ) : null}
            </Animated.View>

            {items.length === 0 ? (
              <View
                style={{
                  backgroundColor: dark ? colors.surface : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  borderRadius: QUEST.radius,
                  padding: QUEST.pad,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: colors.text200 }}>
                  {copy.empty}
                </Text>
              </View>
            ) : (
              groups.map((group, groupIndex) => (
                <View key={group.category} style={{ gap: 12 }}>
                  <Animated.View
                    entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(80 + groupIndex * QUEST.motion.stagger)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}
                  >
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.text100 }}>
                      {copy.categories[group.category as keyof typeof copy.categories] || group.category}
                    </Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: colors.text300 }}>
                      {group.items.filter((row: AchievementItem) => row.unlocked).length} / {group.items.length}
                    </Text>
                  </Animated.View>
                  <Animated.View
                    entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(120 + groupIndex * QUEST.motion.stagger)}
                    style={{
                      backgroundColor: dark ? colors.surface : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: colors.bg300,
                      borderRadius: QUEST.radius,
                      overflow: 'hidden',
                    }}
                  >
                    {group.items.map((item: AchievementItem, index: number) => (
                      <AchievementRow
                        key={item.id}
                        item={item}
                        last={index === group.items.length - 1}
                        claiming={claimingId === item.id}
                        offline={offline}
                        onClaim={() => void onClaim(item)}
                      />
                    ))}
                  </Animated.View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      <QuestRewardFloat text={floatReward} top={insets.top + 60} />
    </View>
  );
}

function AchievementRow({
  item,
  last,
  claiming,
  offline,
  onClaim,
}: {
  item: AchievementItem;
  last: boolean;
  claiming: boolean;
  offline: boolean;
  onClaim: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const copy = achievementCopy('ka');
  const rarity = rarityColors(item.rarity, dark);
  const lockedSecret = item.secret && !item.unlocked;
  const showProgress = !item.unlocked && !lockedSecret && item.threshold != null && item.threshold > 1;

  return (
    <View
      style={{
        padding: QUEST.pad,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: dark ? colors.bg300 : colors.bg200,
        opacity: !item.unlocked && !item.claimable ? 0.92 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <QuestAchievementBadge item={item} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 15,
                lineHeight: 20,
                color: colors.text100,
              }}
            >
              {copy.title(item)}
            </Text>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 7,
                paddingVertical: 2,
                backgroundColor: item.unlocked ? rarity.fill : dark ? colors.surfaceRaised : colors.bg200,
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 10,
                  lineHeight: 14,
                  color: item.unlocked ? rarity.ink : colors.text300,
                }}
              >
                {copy.rarity[item.rarity]}
              </Text>
            </View>
          </View>
          <Text
            numberOfLines={2}
            style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: colors.text300, marginTop: 2 }}
          >
            {copy.description(item)}
          </Text>
        </View>
      </View>

      {showProgress ? (
        <View style={{ marginTop: 12, gap: 6 }}>
          <QuestProgressBar percent={item.progressPercent ?? 0} height={QUEST.barDaily} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, lineHeight: 15, color: colors.text300 }}>
            {copy.progressOf(formatQuestNumber(item.progress ?? 0, 'ka'), formatQuestNumber(item.threshold ?? 0, 'ka'))}
          </Text>
        </View>
      ) : null}

      {!lockedSecret && item.rewardXp != null && item.rewardCoins != null ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <QuestReward xp={item.rewardXp} coins={item.rewardCoins} muted={!item.claimable} size="sm" />
          {item.claimable ? (
            <QuestClaimButton label={copy.claim} size="sm" loading={claiming} disabled={offline} onPress={onClaim} />
          ) : item.claimed ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, color: colors.success }}>
              {copy.claimed}
            </Text>
          ) : (
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: colors.text300 }}>
              {copy.locked}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function AchievementsSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, borderRadius: QUEST.radius, padding: QUEST.pad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Bone width={56} height={56} radius={18} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="55%" height={20} radius={8} />
            <Bone width="40%" height={12} />
          </View>
        </View>
        <Bone height={8} radius={999} style={{ marginTop: 14 }} />
      </View>
      {[0, 1].map((section) => (
        <View key={section} style={{ gap: 12 }}>
          <Bone width="40%" height={16} radius={8} />
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.bg300, borderRadius: QUEST.radius, padding: QUEST.pad, gap: 16 }}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Bone width={48} height={48} radius={15} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Bone width="60%" height={14} radius={6} />
                  <Bone width="80%" height={10} radius={5} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
