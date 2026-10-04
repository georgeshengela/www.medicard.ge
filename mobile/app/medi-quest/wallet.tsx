import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, Store } from 'lucide-react-native';
import { appLang, tx } from '@/i18n/locale';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { Bone } from '@/components/ui/Skeleton';
import { QuestArt } from '@/components/quest/QuestIcon';
import { ledgerArt } from '@/components/quest/questArt';
import { QuestWalletCard, coins, questDate, useQuestInk } from '@/components/quest/store/QuestStoreKit';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { questApi } from '@/lib/quest/api';
import { walletSourceLabel } from '@/lib/quest/rewardsLogic.js';
import { q } from '@/lib/quest/copy';
import { buildQuestDevWallet, getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';
import { rewardsCopy } from '@/i18n/quest/rewards.js';
import { getMediCoinBalanceHint, subscribeMediCoinBalance } from '@/lib/quest/cache';

type WalletData = Awaited<ReturnType<typeof questApi.rewards>>;

/**
 * Medi Coins wallet (owner 2026-10-04 redesign): the standard module header, the violet coins card
 * (same as the store) with the way to spend them, earned / spent in two numbers, and every movement
 * named by where it came from — MEDIRUN boxes and store refunds included.
 */
export default function QuestWalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const ink = useQuestInk();
  const copy = q(appLang());
  const rewards = rewardsCopy(appLang());
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveCoins, setLiveCoins] = useState<number | null>(() => getMediCoinBalanceHint());

  const load = useCallback(async () => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
      setData(buildQuestDevWallet() as unknown as WalletData);
      setLoading(false);
      return;
    }
    try {
      setData(await questApi.rewards());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeMediCoinBalance((value) => {
      setLiveCoins(value);
      if (value == null) void load();
      else setData((prev) => (prev ? { ...prev, balance: { ...prev.balance, coins: value } } : prev));
    });
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const sourceLabel = (sourceType: string) =>
    walletSourceLabel(sourceType, {
      mission: copy.mission,
      ledgerAchievement: copy.ledgerAchievement,
      ledgerSystem: copy.ledgerSystem,
      ledgerAdmin: copy.ledgerAdmin,
      ledgerUnknown: copy.ledgerUnknown,
      ledgerRedeem: rewards.ledgerRedeem || copy.ledgerRedeem,
      ledgerHunt: copy.ledgerHunt,
      ledgerReferral: copy.ledgerReferral,
      ledgerMedirun: copy.ledgerMedirun,
      ledgerRefund: copy.ledgerRefund,
    });
  const balance = liveCoins ?? data?.balance?.coins ?? 0;
  const rows = (data?.transactions ?? []).filter((row) => row.currency !== 'XP');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink.violet} />}
        showsVerticalScrollIndicator={false}
      >
        <ModuleHeader
          module="quest"
          subtitle="Medi Coins"
          fallbackHref="/medi-quest"
          style={s.gutter}
          right={<ModuleHeaderButton label={tx('მაღაზია', 'Store')} icon={Store} onPress={() => router.push('/medi-quest/rewards' as never)} />}
        />

        <QuestWalletCard
          style={[s.gutter, { marginTop: 18 }]}
          caption={tx('ბალანსი', 'Balance')}
          balance={balance}
          loading={loading && liveCoins == null}
          action={{ label: tx('გამოიყენე მაღაზიაში', 'Spend in the store'), onPress: () => router.push('/medi-quest/rewards' as never) }}
        />

        {data ? (
          <View style={[s.gutter, s.totals]}>
            <Total label={tx('სულ მიღებული', 'Earned')} value={`+${coins(data.totalEarned?.coins ?? 0)}`} tone={ink.violet} />
            <Total label={tx('დახარჯული', 'Spent')} value={coins(Math.abs(data.totalSpent?.coins ?? 0))} tone={c.text100} />
          </View>
        ) : null}

        <View style={[s.gutter, { marginTop: HUB.sectionGap - 6 }]}>
          <HomeSectionHeading title={copy.recent} />
          {loading && !data ? (
            <View style={{ gap: 8 }}>{[0, 1, 2].map((i) => <Bone key={i} height={60} radius={18} />)}</View>
          ) : failed && !data ? (
            <View style={[s.card, { backgroundColor: c.surface }]}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ისტორია ვერ ჩაიტვირთა', 'Couldn’t load your history')}</Text>
              <Pressable accessibilityRole="button" onPress={() => void load()} style={[s.retry, { backgroundColor: ink.dark ? 'rgba(196,181,253,0.12)' : '#F1EDFB' }]}>
                <RefreshCw size={15} color={ink.violet} />
                <Text style={[hubText.link, { color: ink.violet }]}>{tx('ხელახლა ცდა', 'Try again')}</Text>
              </Pressable>
            </View>
          ) : !rows.length ? (
            <View style={[s.card, { backgroundColor: c.surface }]}>
              <Text style={[hubText.body, { color: c.text200 }]}>{copy.walletEmpty}</Text>
            </View>
          ) : (
            <View style={[s.list, { backgroundColor: c.surface }]}>
              {rows.map((row, index) => {
                const positive = row.amount > 0;
                return (
                  <View key={row.id} style={[s.row, index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 } : null]}>
                    <View style={[s.art, { backgroundColor: ink.dark ? 'rgba(196,181,253,0.10)' : '#F5F1FF' }]}>
                      <QuestArt source={ledgerArt(row.sourceType)} size={28} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 14, lineHeight: 20 }]}>{sourceLabel(row.sourceType)}</Text>
                      <Text style={[hubText.small, { color: c.text300 }]}>{questDate(row.createdAt)}</Text>
                    </View>
                    <Text style={[s.amount, { color: positive ? ink.violet : c.text200 }]}>
                      {positive ? '+' : '−'}{coins(Math.abs(row.amount))}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone: string }) {
  const c = useThemeColors();
  return (
    <View style={[s.total, { backgroundColor: c.surface }]}>
      <Text style={[hubText.small, { color: c.text300 }]}>{label}</Text>
      <Text style={[s.totalValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  gutter: { paddingHorizontal: HUB.gutter },
  totals: { flexDirection: 'row', gap: 10, marginTop: 12 },
  total: { flex: 1, borderRadius: 18, padding: 14, gap: 2 },
  totalValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
  card: { borderRadius: 20, padding: 16, gap: 8 },
  retry: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20 },
  list: { borderRadius: 22, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  art: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  amount: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
