import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gift, RefreshCw, WifiOff } from 'lucide-react-native';
import { appLang, tx } from '@/i18n/locale';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { Bone } from '@/components/ui/Skeleton';
import {
  AffordLine,
  QuestWalletCard,
  RewardStage,
  RewardTile,
  StockPill,
  isSoldOut,
  rewardKind,
  useQuestInk,
  useTileWidth,
} from '@/components/quest/store/QuestStoreKit';
import { useOffline } from '@/hooks/useOffline';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { rewardsApi, type StoreCatalog, type StoreReward } from '@/lib/quest/rewardsApi';
import { buildRewardsDevCatalog } from '@/lib/quest/rewardsDevFixture.js';
import { isQuestDevEnabled, getQuestDevScenario } from '@/lib/quest/devFixture';
import { rewardTitle, rewardsCopy } from '@/i18n/quest/rewards.js';
import { trackQuestEvent } from '@/lib/productObservability';
import { getMediCoinBalanceHint, subscribeMediCoinBalance } from '@/lib/quest/cache';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';

/** Under 'quest' so the Quest refresh signal (coins, claims) also refreshes eligibility. */
const CATALOG_KEY = ['quest', 'rewards', 'catalog'] as const;

type Filter = 'all' | 'afford' | 'gadget' | 'giftcard' | 'digital';

/**
 * Rewards store (owner 2026-10-04 redesign): the standard module header, the violet Medi Coins card with
 * the next prize it is closest to, filter chips that only show what exists, the featured prizes as a
 * horizontal shelf and everything else as a two-column gallery. Each tile shows the price and how far
 * away it is — a store people can read at a glance.
 */
export default function RewardsStoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const ink = useQuestInk();
  const offline = useOffline();
  const copy = rewardsCopy(appLang());
  const tileWidth = useTileWidth();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [liveCoins, setLiveCoins] = useState<number | null>(() => getMediCoinBalanceHint());
  const devScenario = isQuestDevEnabled() ? getQuestDevScenario() : 'LIVE';
  const devActive = devScenario !== 'LIVE';

  // The catalog rarely changes; coin changes and redeems invalidate 'quest' / 'rewards' anyway.
  const query = useAccountQuery<StoreCatalog>({
    key: [...CATALOG_KEY],
    fetch: () => rewardsApi.catalog(),
    staleTime: FRESH.LONG,
    enabled: !devActive,
  });
  const devCatalog = useMemo(
    () => (devActive ? (buildRewardsDevCatalog(devScenario as never) as StoreCatalog) : null),
    [devActive, devScenario],
  );
  const data = devCatalog ?? query.data ?? null;
  const loading = !devActive && !data && query.fetchStatus !== 'idle';
  const failed = !devActive && !data && query.isError;
  const { refetch } = query;

  useEffect(() => {
    void trackQuestEvent('rewards_store_opened');
  }, []);

  useEffect(() => {
    return subscribeMediCoinBalance((value) => {
      setLiveCoins(value);
      if (value != null) {
        queryClient.setQueryData<StoreCatalog>(accountKey(...CATALOG_KEY), (prev) =>
          prev ? { ...prev, balance: { ...prev.balance, coins: value } } : prev,
        );
      } else {
        void refetch();
      }
    });
  }, [refetch]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (!devActive) await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const balance = liveCoins ?? data?.balance.coins ?? 0;
  const featured = data?.featured ?? [];
  const everything = useMemo(() => [...(data?.featured ?? []), ...(data?.available ?? [])], [data]);

  // The cheapest prize still out of reach: the wallet card shows how close it is.
  const next = useMemo(() => {
    const target = everything
      .filter((r) => !isSoldOut(r) && r.coinCost > balance)
      .sort((a, b) => a.coinCost - b.coinCost)[0];
    return target ? { title: rewardTitle(target.titleKey, appLang()), need: target.coinCost - balance, progress: balance / target.coinCost } : null;
  }, [everything, balance]);

  const filters = useMemo(() => {
    const list: { id: Filter; label: string; count: number }[] = [
      { id: 'all', label: tx('ყველა', 'All'), count: everything.length },
      { id: 'afford', label: tx('საკმარისი მაქვს', 'I can afford'), count: everything.filter((r) => !isSoldOut(r) && r.coinCost <= balance).length },
      { id: 'gadget', label: tx('გაჯეტები', 'Gadgets'), count: everything.filter((r) => rewardKind(r) === 'gadget').length },
      { id: 'giftcard', label: tx('სასაჩუქრე ბარათები', 'Gift cards'), count: everything.filter((r) => rewardKind(r) === 'giftcard').length },
      { id: 'digital', label: tx('აპის სტილები', 'App styles'), count: everything.filter((r) => rewardKind(r) === 'digital').length },
    ];
    return list.filter((f) => f.id === 'all' || f.count > 0);
  }, [everything, balance]);

  const shown = useMemo(() => {
    const pool = filter === 'all' ? (data?.available ?? []) : everything;
    const picked = pool.filter((r) =>
      filter === 'all' ? true : filter === 'afford' ? !isSoldOut(r) && r.coinCost <= balance : rewardKind(r) === filter,
    );
    // Sold-out prizes go last so the gallery opens on things that can still be taken.
    return [...picked].sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)));
  }, [filter, data, everything, balance]);

  const open = (reward: StoreReward) => {
    void trackQuestEvent('reward_viewed', reward.key);
    router.push(`/medi-quest/rewards/${reward.id}` as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink.violet} />}
        showsVerticalScrollIndicator={false}
      >
        <ModuleHeader
          module="quest"
          subtitle={tx('ჯილდოების მაღაზია', 'Rewards store')}
          fallbackHref="/medi-quest"
          style={s.gutter}
          right={<ModuleHeaderButton label={copy.myRewards} icon={Gift} onPress={() => router.push('/medi-quest/rewards/mine' as never)} />}
        />

        <QuestWalletCard
          style={[s.gutter, { marginTop: 18 }]}
          balance={balance}
          loading={loading && liveCoins == null}
          next={next}
          action={{ label: tx('როგორ დავაგროვო მონეტები', 'How to earn coins'), onPress: () => router.push('/medi-quest?tab=missions' as never) }}
        />

        {offline ? (
          <View style={[s.gutter, s.notice]}>
            <WifiOff size={15} color={c.text300} />
            <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{copy.offlineRedeem}</Text>
          </View>
        ) : null}

        {failed ? (
          <View style={[s.gutter, { marginTop: 24 }]}>
            <View style={[s.errorCard, { backgroundColor: c.surface }]}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('მაღაზია ვერ ჩაიტვირთა', 'The store didn’t load')}</Text>
              <Text style={[hubText.caption, { color: c.text200 }]}>{tx('შეამოწმე ინტერნეტი და სცადე ხელახლა.', 'Check your connection and try again.')}</Text>
              <Pressable accessibilityRole="button" onPress={() => void refetch()} style={[s.retry, { backgroundColor: ink.dark ? 'rgba(196,181,253,0.12)' : '#F1EDFB' }]}>
                <RefreshCw size={15} color={ink.violet} />
                <Text style={[hubText.link, { color: ink.violet }]}>{tx('ხელახლა ცდა', 'Try again')}</Text>
              </Pressable>
            </View>
          </View>
        ) : loading ? (
          <View style={[s.gutter, s.grid, { marginTop: 24 }]}>
            {[0, 1, 2, 3].map((i) => <Bone key={i} width={tileWidth} height={tileWidth + 92} radius={22} />)}
          </View>
        ) : !everything.length ? (
          <Text style={[s.gutter, hubText.body, { color: c.text200, marginTop: 24 }]}>{copy.emptyStore}</Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginTop: 20 }}>
              {filters.map((f) => {
                const on = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${f.label}, ${f.count}`}
                    onPress={() => setFilter(f.id)}
                    style={[s.chip, on ? { backgroundColor: ink.violet, borderColor: ink.violet } : { backgroundColor: c.surface, borderColor: c.bg300 }]}
                  >
                    <Text style={[s.chipText, { color: on ? (ink.dark ? '#1E1033' : '#FFFFFF') : c.text100 }]}>{f.label}</Text>
                    <Text style={[s.chipCount, { color: on ? (ink.dark ? '#1E1033' : '#EDE4FF') : c.text300 }]}>{f.count}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {filter === 'all' && featured.length ? (
              <View style={{ marginTop: HUB.sectionGap - 4 }}>
                <View style={s.gutter}>
                  <HomeSectionHeading title={tx('მთავარი პრიზები', 'Top prizes')} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={Math.round(width * 0.68) + 12} contentContainerStyle={s.shelf}>
                  {featured.map((reward) => (
                    <FeaturedCard key={reward.id} reward={reward} balance={balance} width={Math.round(width * 0.68)} onPress={() => open(reward)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={[s.gutter, { marginTop: HUB.sectionGap - 4 }]}>
              {filter === 'all' ? <HomeSectionHeading title={tx('ყველა ჯილდო', 'All rewards')} /> : null}
              {shown.length ? (
                <View style={s.grid}>
                  {shown.map((reward) => (
                    <RewardTile key={reward.id} reward={reward} balance={balance} width={tileWidth} onPress={() => open(reward)} />
                  ))}
                </View>
              ) : (
                <Text style={[hubText.body, { color: c.text200 }]}>
                  {filter === 'afford'
                    ? tx('ჯერ არცერთისთვის არ გყოფნის — შეასრულე მისიები და აიღე პირველი საჩუქარი.', 'Not enough for any yet — finish missions to take your first prize.')
                    : copy.emptyStore}
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Shelf card for a featured prize: a big stage, the title and the price with how far away it is. */
function FeaturedCard({ reward, balance, width, onPress }: { reward: StoreReward; balance: number; width: number; onPress: () => void }) {
  const c = useThemeColors();
  const title = rewardTitle(reward.titleKey, appLang());
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} className="active:opacity-85" style={[s.featured, { width, backgroundColor: c.surface }]}>
      <RewardStage reward={reward} height={Math.round(width * 0.62)} radius={18}>
        <View style={{ position: 'absolute', top: 10, left: 10 }}><StockPill reward={reward} /></View>
      </RewardStage>
      <View style={{ paddingHorizontal: 6, gap: 10 }}>
        <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, minHeight: 44 }]}>{title}</Text>
        <AffordLine cost={reward.coinCost} balance={balance} soldOut={isSoldOut(reward)} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  gutter: { paddingHorizontal: HUB.gutter },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  errorCard: { borderRadius: 22, padding: 18, gap: 8 },
  retry: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, marginTop: 6 },
  chips: { paddingHorizontal: HUB.gutter, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  chipText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 },
  chipCount: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  shelf: { paddingHorizontal: HUB.gutter, gap: 12 },
  featured: { borderRadius: 24, padding: 8, paddingBottom: 14, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
});
