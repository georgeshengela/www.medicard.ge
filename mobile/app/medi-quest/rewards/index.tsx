import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Gift, Sparkles } from 'lucide-react-native';
import { Bone } from '@/components/ui/Skeleton';
import { QuestAnimatedNumber } from '@/components/quest/QuestAnimatedNumber';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { formatQuestNumber } from '@/lib/quest/logic.js';
import { rewardsApi, type StoreCatalog, type StoreReward } from '@/lib/quest/rewardsApi';
import { canShowRedeem, coinsShortfall } from '@/lib/quest/rewardsLogic.js';
import { buildRewardsDevCatalog } from '@/lib/quest/rewardsDevFixture.js';
import { isQuestDevEnabled, getQuestDevScenario } from '@/lib/quest/devFixture';
import {
  rewardDescription,
  rewardErrorMessage,
  rewardTitle,
  rewardsCopy,
} from '@/i18n/quest/rewards.js';
import { trackQuestEvent } from '@/lib/productObservability';
import { getMediCoinBalanceHint, subscribeMediCoinBalance } from '@/lib/quest/cache';
import { QUEST } from '@/theme/questTokens';

export default function RewardsStoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const offline = useOffline();
  const reduce = usePrefersReducedMotion();
  const copy = rewardsCopy('ka');
  const [data, setData] = useState<StoreCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveCoins, setLiveCoins] = useState<number | null>(() => getMediCoinBalanceHint());

  const load = useCallback(async () => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
      setData(buildRewardsDevCatalog(getQuestDevScenario() as never) as StoreCatalog);
      setLoading(false);
      return;
    }
    try {
      setData(await rewardsApi.catalog());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void trackQuestEvent('rewards_store_opened');
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeMediCoinBalance((coins) => {
      setLiveCoins(coins);
      if (coins != null) {
        setData((prev) => (prev ? { ...prev, balance: { ...prev.balance, coins } } : prev));
      } else {
        void load();
      }
    });
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const balance = liveCoins ?? data?.balance.coins ?? 0;
  const featured = data?.featured ?? [];
  const available = data?.available ?? [];

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
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
          {copy.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.myRewards}
          onPress={() => router.push('/medi-quest/rewards/mine' as never)}
          style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.primary200 }}>
            {copy.myRewards}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base)}
          style={{
            backgroundColor: dark ? colors.surface : '#FFFFFF',
            borderWidth: 1,
            borderColor: colors.bg300,
            borderRadius: QUEST.radius,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 12,
              lineHeight: 16,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: colors.text300,
            }}
          >
            {copy.coinsLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <QuestCoinMark size={28} color={dark ? QUEST.pill.coinInkDark : QUEST.pill.coinInkLight} />
            {loading && !data ? (
              <Bone width={120} height={36} radius={10} />
            ) : (
              <QuestAnimatedNumber
                value={balance}
                locale="ka"
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 36,
                  lineHeight: 44,
                  letterSpacing: -1,
                  color: colors.text100,
                }}
              />
            )}
          </View>
          <Text
            style={{
              marginTop: 10,
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 14,
              lineHeight: 20,
              color: colors.text200,
            }}
          >
            {copy.tagline}
          </Text>
          {offline ? (
            <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text300 }}>
              {copy.offlineRedeem}
            </Text>
          ) : null}
        </Animated.View>

        {featured.length ? (
          <Section title={copy.featured}>
            {featured.map((reward, i) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                balance={balance}
                offline={offline}
                copy={copy}
                dark={dark}
                colors={colors}
                delay={i}
                reduce={reduce}
                onPress={() => router.push(`/medi-quest/rewards/${reward.id}` as never)}
              />
            ))}
          </Section>
        ) : null}

        <Section title={copy.available}>
          {loading && !data ? (
            [0, 1].map((i) => <Bone key={i} height={96} radius={QUEST.radius} />)
          ) : !available.length ? (
            <QuestMediLine text={copy.emptyStore} />
          ) : (
            available.map((reward, i) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                balance={balance}
                offline={offline}
                copy={copy}
                dark={dark}
                colors={colors}
                delay={i}
                reduce={reduce}
                onPress={() => router.push(`/medi-quest/rewards/${reward.id}` as never)}
              />
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          lineHeight: 22,
          color: colors.text100,
          paddingHorizontal: 2,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function RewardCard({
  reward,
  balance,
  offline,
  copy,
  dark,
  colors,
  delay,
  reduce,
  onPress,
}: {
  reward: StoreReward;
  balance: number;
  offline: boolean;
  copy: ReturnType<typeof rewardsCopy>;
  dark: boolean;
  colors: ReturnType<typeof useThemeColors>;
  delay: number;
  reduce: boolean;
  onPress: () => void;
}) {
  const shortfall = coinsShortfall(reward.coinCost, balance);
  const redeemable = canShowRedeem(reward, { offline });
  const title = rewardTitle(reward.titleKey, 'ka');
  const desc = rewardDescription(reward.descriptionKey, 'ka');
  const a11y = `${title}, ${formatQuestNumber(reward.coinCost, 'ka')} Medi Coins, ${
    reward.inventoryState === 'OUT_OF_STOCK' ? copy.outOfStock : redeemable ? copy.view : copy.unavailable
  }`;

  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(60 + delay * 40)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => {
          void trackQuestEvent('reward_viewed', reward.key);
          onPress();
        }}
        className="active:opacity-75"
        style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          backgroundColor: dark ? colors.surface : '#FFFFFF',
          borderWidth: 1,
          borderColor: colors.bg300,
          borderRadius: QUEST.radius,
          padding: QUEST.pad,
        }}
      >
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
          {reward.featured ? (
            <Sparkles size={QUEST.glyph} color={colors.primary200} strokeWidth={2.2} />
          ) : (
            <Gift size={QUEST.glyph} color={colors.primary200} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: colors.text100 }}>
            {title}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: colors.text300 }}>
            {desc}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: colors.primary100 }}>
              {formatQuestNumber(reward.coinCost, 'ka')} Medi Coins
            </Text>
            {reward.inventoryState === 'OUT_OF_STOCK' ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>{copy.outOfStock}</Text>
            ) : shortfall > 0 ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
                {copy.needMore(formatQuestNumber(shortfall, 'ka'))}
              </Text>
            ) : null}
          </View>
          {!redeemable && reward.userEligibility?.reasonCode && reward.userEligibility.reasonCode !== 'REWARD_INSUFFICIENT_COINS' ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
              {rewardErrorMessage(reward.userEligibility.reasonCode, 'ka')}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={colors.text300} strokeWidth={2.2} />
      </Pressable>
    </Animated.View>
  );
}
