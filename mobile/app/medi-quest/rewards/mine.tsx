import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, RefreshCw, Store } from 'lucide-react-native';
import { appLang, tx } from '@/i18n/locale';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { Bone } from '@/components/ui/Skeleton';
import { Pill, QuestButton, QuestSheet, RewardStage, coins, questDate, useQuestInk } from '@/components/quest/store/QuestStoreKit';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { rewardsApi, type RedemptionItem } from '@/lib/quest/rewardsApi';
import { groupMineRedemptions } from '@/lib/quest/rewardsLogic.js';
import { buildRewardsDevMine } from '@/lib/quest/rewardsDevFixture.js';
import { getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';
import { rewardTitle, rewardsCopy } from '@/i18n/quest/rewards.js';
import { trackQuestEvent } from '@/lib/productObservability';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { FRESH } from '@/lib/queryClient';

const fmtDate = questDate;

type Group = 'active' | 'used' | 'expired';

/**
 * My rewards (owner 2026-10-04 redesign): every redemption is a tappable row with its picture and a
 * status in words; the sheet explains what happens next and shows the code again (it used to be
 * visible only once, right after redeeming).
 */
export default function MyRewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const ink = useQuestInk();
  const copy = rewardsCopy(appLang());
  const [open, setOpen] = useState<{ item: RedemptionItem; group: Group } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const devScenario = isQuestDevEnabled() ? getQuestDevScenario() : 'LIVE';
  const devActive = devScenario !== 'LIVE';
  // Redeems write /api/rewards, which invalidates this key; SHORT covers expiry on its own.
  const query = useAccountQuery({
    key: ['quest', 'rewards', 'mine'],
    fetch: async () => groupMineRedemptions(await rewardsApi.mine()),
    staleTime: FRESH.SHORT,
    enabled: !devActive,
  });
  const groups = useMemo<Record<Group, RedemptionItem[]>>(
    () => (devActive ? groupMineRedemptions(buildRewardsDevMine(devScenario as never)) : query.data ?? { active: [], used: [], expired: [] }),
    [devActive, devScenario, query.data],
  );
  const loading = !devActive && !query.data && query.fetchStatus !== 'idle';
  const failed = !devActive && !query.data && query.isError;
  const empty = !groups.active.length && !groups.used.length && !groups.expired.length;

  useEffect(() => {
    void trackQuestEvent('my_rewards_opened');
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (!devActive) await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const sections: { id: Group; title: string }[] = [
    { id: 'active', title: tx('მიმდინარე', 'Current') },
    { id: 'used', title: copy.used },
    { id: 'expired', title: copy.expired },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink.violet} />}
        showsVerticalScrollIndicator={false}
      >
        <ModuleHeader
          module="quest"
          subtitle={copy.myRewards}
          fallbackHref="/medi-quest/rewards"
          style={s.gutter}
          right={<ModuleHeaderButton label={tx('მაღაზია', 'Store')} icon={Store} onPress={() => router.push('/medi-quest/rewards' as never)} />}
        />

        {loading ? (
          <View style={[s.gutter, { gap: 10, marginTop: 24 }]}>
            {[0, 1, 2].map((i) => <Bone key={i} height={76} radius={20} />)}
          </View>
        ) : failed ? (
          <View style={[s.gutter, { marginTop: 24 }]}>
            <View style={[s.card, { backgroundColor: c.surface }]}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('სია ვერ ჩაიტვირთა', 'Couldn’t load your rewards')}</Text>
              <Text style={[hubText.caption, { color: c.text200 }]}>{tx('შეამოწმე ინტერნეტი და სცადე ხელახლა.', 'Check your connection and try again.')}</Text>
              <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={[s.retry, { backgroundColor: ink.dark ? 'rgba(196,181,253,0.12)' : '#F1EDFB' }]}>
                <RefreshCw size={15} color={ink.violet} />
                <Text style={[hubText.link, { color: ink.violet }]}>{tx('ხელახლა ცდა', 'Try again')}</Text>
              </Pressable>
            </View>
          </View>
        ) : empty ? (
          <View style={[s.gutter, { marginTop: 24 }]}>
            <View style={[s.card, { backgroundColor: c.surface, alignItems: 'flex-start' }]}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ჯერ არაფერი აგიღია', 'Nothing taken yet')}</Text>
              <Text style={[hubText.caption, { color: c.text200 }]}>{tx('აიღე საჩუქარი Medi Coins-ით — აქ ნახავ მის სტატუსს და კოდს.', 'Take a prize with Medi Coins — its status and code will show here.')}</Text>
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <QuestButton label={tx('მაღაზიის ნახვა', 'Open the store')} onPress={() => router.push('/medi-quest/rewards' as never)} />
              </View>
            </View>
          </View>
        ) : (
          sections.map((section) =>
            groups[section.id].length ? (
              <View key={section.id} style={[s.gutter, { marginTop: HUB.sectionGap - 6 }]}>
                <HomeSectionHeading title={section.title} />
                <View style={{ gap: 10 }}>
                  {groups[section.id].map((item) => (
                    <Row key={item.id} item={item} group={section.id} onPress={() => setOpen({ item, group: section.id })} />
                  ))}
                </View>
              </View>
            ) : null,
          )
        )}
      </ScrollView>

      <RedemptionSheet value={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function statusOf(item: RedemptionItem, group: Group): { label: string; tone: 'wait' | 'live' | 'done' } {
  if (group === 'expired') return { label: tx('ვადაგასული', 'Expired'), tone: 'done' };
  if (group === 'used') return { label: item.status === 'PENDING' ? tx('გადმოგეცა', 'Handed over') : tx('გამოყენებული', 'Used'), tone: 'done' };
  if (item.status === 'PENDING') return { label: tx('გადაცემას ელოდება', 'Waiting for hand-over'), tone: 'wait' };
  return { label: tx('აქტიური', 'Active'), tone: 'live' };
}

function StatusPill({ item, group }: { item: RedemptionItem; group: Group }) {
  const c = useThemeColors();
  const ink = useQuestInk();
  const status = statusOf(item, group);
  const colors =
    status.tone === 'wait'
      ? { fg: ink.gold, bg: ink.dark ? 'rgba(251,191,36,0.16)' : '#FDF3DD' }
      : status.tone === 'live'
        ? { fg: ink.violet, bg: ink.dark ? 'rgba(196,181,253,0.14)' : '#F1EDFB' }
        : { fg: c.text300, bg: ink.dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' };
  return <Pill text={status.label} fg={colors.fg} bg={colors.bg} />;
}

function Row({ item, group, onPress }: { item: RedemptionItem; group: Group; onPress: () => void }) {
  const c = useThemeColors();
  const title = item.reward ? rewardTitle(item.reward.titleKey, appLang()) : tx('ჯილდო', 'Reward');
  const status = statusOf(item, group);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status.label}. ${fmtDate(item.redeemedAt)}`}
      onPress={onPress}
      className="active:opacity-80"
      style={[s.row, { backgroundColor: c.surface, opacity: group === 'expired' ? 0.7 : 1 }]}
    >
      <View style={{ width: 60 }}>
        {item.reward ? <RewardStage reward={item.reward} height={60} radius={16} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, fontSize: 14, lineHeight: 20 }]}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill item={item} group={group} />
          <Text style={[hubText.small, { color: c.text300 }]}>{fmtDate(item.redeemedAt)}</Text>
        </View>
      </View>
      <ChevronRight size={17} color={c.text300} />
    </Pressable>
  );
}

/** What happens next, the code again (fetched on open — the list only has the masked one), the dates. */
function RedemptionSheet({ value, onClose }: { value: { item: RedemptionItem; group: Group } | null; onClose: () => void }) {
  const c = useThemeColors();
  const ink = useQuestInk();
  const [code, setCode] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const item = value?.item ?? null;

  useEffect(() => {
    setCode(null);
    setRevealing(false);
  }, [item?.id]);

  if (!value || !item) return <QuestSheet visible={false} onClose={onClose}>{null}</QuestSheet>;
  const title = item.reward ? rewardTitle(item.reward.titleKey, appLang()) : tx('ჯილდო', 'Reward');
  const hasCode = Boolean(item.code || item.codeMasked);
  const reveal = async () => {
    if (code) {
      await Share.share({ message: code });
      return;
    }
    if (item.code) {
      setCode(item.code);
      return;
    }
    setRevealing(true);
    try {
      const full = await rewardsApi.redemption(item.id);
      setCode(full.code ?? null);
    } catch {
      setCode(null);
    } finally {
      setRevealing(false);
    }
  };
  const next =
    item.status === 'PENDING' && value.group === 'active'
      ? tx('ანგარიშის ტელეფონზე დაგირეკავთ და საჩუქარს თბილისში 14 დღეში გადმოგცემთ. თუ ვერ მოხერხდა, მონეტები სრულად დაგიბრუნდება.', 'We’ll call your account phone and hand the prize over in Tbilisi within 14 days. If that fails, every coin comes back.')
      : item.entitlement && value.group === 'active'
        ? tx(`აქტიურია ${fmtDate(item.entitlement.endsAt)}-მდე.`, `Active until ${fmtDate(item.entitlement.endsAt)}.`)
        : null;

  return (
    <QuestSheet visible onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 84 }}>
          {item.reward ? <RewardStage reward={item.reward} height={84} radius={20} /> : null}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text numberOfLines={3} style={[hubText.cardTitle, { color: c.text100 }]}>{title}</Text>
          <View style={{ flexDirection: 'row' }}><StatusPill item={item} group={value.group} /></View>
        </View>
      </View>
      {next ? <Text style={[hubText.body, { color: c.text200 }]}>{next}</Text> : null}
      {hasCode ? (
        <Pressable accessibilityRole="button" onPress={() => void reveal()} style={[s.code, { borderColor: ink.violet }]}>
          <Text style={[hubText.small, { color: c.text300 }]}>{tx('კოდი', 'Code')}</Text>
          <Text style={[s.codeText, { color: c.text100 }]}>{revealing ? '…' : code ?? item.codeMasked ?? '••••'}</Text>
          <Text style={[hubText.small, { color: ink.violet }]}>{code ? tx('შეეხე გასაზიარებლად', 'Tap to share') : tx('შეეხე სანახავად', 'Tap to reveal')}</Text>
        </Pressable>
      ) : null}
      <View style={[s.facts, { borderColor: c.bg300 }]}>
        <Fact label={tx('აიღე', 'Taken')} value={fmtDate(item.redeemedAt)} />
        <Fact label={tx('დაიხარჯა', 'Spent')} value={tx(`${coins(item.coinCost)} მონეტა`, `${coins(item.coinCost)} coins`)} />
        {item.expiresAt ? <Fact label={tx('ვადა', 'Valid until')} value={fmtDate(item.expiresAt)} /> : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <QuestButton kind="secondary" label={tx('დახურვა', 'Close')} onPress={onClose} />
      </View>
    </QuestSheet>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{label}</Text>
      <Text style={[hubText.link, { color: c.text100 }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  gutter: { paddingHorizontal: HUB.gutter },
  card: { borderRadius: 22, padding: 18, gap: 8 },
  retry: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 10, paddingRight: 14 },
  code: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  codeText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, letterSpacing: 2 },
  facts: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
});
