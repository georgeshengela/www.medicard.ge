import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { useQuestJourney } from '@/hooks/useQuestJourney';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useWeather } from '@/hooks/useWeather';
import { useThemeColors } from '@/theme/colors';
import { QuestHubView } from '@/components/quest/QuestHubView';
import { QuestRewardFloat } from '@/components/quest/QuestRewardFloat';
import { QButton, QText } from '@/components/quest/QuestHubPrimitives';
import { QuestDevLauncher } from '@/components/dev/QuestDevLauncher';
import { APP_MODAL_PROPS, APP_MODAL_OVERLAY } from '@/components/ui/appModal';
import { questHubTab, type QuestHubTab } from '@/lib/quest/hubPresentation';
import { movementContextLine, whyTargetCopy } from '@/lib/quest/copy';
import { showWhyTarget } from '@/lib/quest/smartContext.js';
import { questKind, rankKeyFromLevel } from '@/lib/quest/logic.js';
import { presentQuestLevelUp, subscribeEntitlementRefresh } from '@/lib/quest/cache';
import { rewardsApi } from '@/lib/quest/rewardsApi';
import { trackQuestEvent } from '@/lib/productObservability';
import type { QuestItem } from '@/lib/quest/api';

export default function MediQuestHub() {
  const router = useRouter(), params = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets(), colors = useThemeColors();
  const quest = useQuestDashboard(), offline = useOffline(), reduce = usePrefersReducedMotion(), weather = useWeather();
  const [tab, setTab] = useState<QuestHubTab>(() => questHubTab(params.tab));
  const journey = useQuestJourney(tab !== 'missions');
  const [refreshing, setRefreshing] = useState(false), [claimingId, setClaimingId] = useState<string | null>(null);
  const [floatReward, setFloatReward] = useState<string | null>(null), [whyQuest, setWhyQuest] = useState<QuestItem | null>(null);
  const [questStyle, setQuestStyle] = useState(false);
  const busy = useRef(false), rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; void trackQuestEvent('quest_hub_opened'); return () => { mounted.current = false; if (rewardTimer.current) clearTimeout(rewardTimer.current); }; }, []);
  useEffect(() => setTab(questHubTab(params.tab)), [params.tab]);
  useFocusEffect(useCallback(() => {
    let alive = true;
    const load = async () => {
      try { const res = await rewardsApi.entitlements(); if (alive) setQuestStyle(res.items.some(i => i.entitlementKey === 'quest.theme.premium')); }
      catch { if (alive) setQuestStyle(false); }
    };
    void load(); const off = subscribeEntitlementRefresh(() => void load());
    return () => { alive = false; off(); };
  }, []));
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await Promise.all([quest.refresh(true), journey.refresh()]); }
    finally { if (mounted.current) setRefreshing(false); }
  };
  const onClaim = async (id: string) => {
    if (busy.current || offline || quest.stale || quest.fixtureOffline) return;
    busy.current = true; setClaimingId(id);
    try {
      const result = await quest.claim(id);
      if (!mounted.current || !result?.claimed) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setFloatReward('+' + result.reward.coinsAwarded + ' მონეტა · +' + result.reward.xpAwarded + ' XP');
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
      rewardTimer.current = setTimeout(() => setFloatReward(null), reduce ? 1600 : 2400);
      if (result.profile.leveledUp) presentQuestLevelUp({ level: result.profile.currentLevel, previousLevel: result.profile.previousLevel, rankKey: rankKeyFromLevel(result.profile.currentLevel), coins: result.reward.coinsAwarded, xp: result.reward.xpAwarded });
    } finally { busy.current = false; if (mounted.current) setClaimingId(null); }
  };
  return <View style={{ flex: 1 }}>
    <QuestHubView dashboard={quest.dashboard} loading={quest.loading} error={quest.error} stale={quest.stale} offline={offline || quest.fixtureOffline} tab={tab}
      onTab={next => { setTab(next); router.setParams({ tab: next }); }} onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
      onNavigate={path => router.push(path as never)} refreshing={refreshing} onRefresh={() => void onRefresh()} claimingId={claimingId} claimError={quest.claimError} onClaim={id => void onClaim(id)}
      companion={journey.overview} companionLoading={journey.loading} companionError={journey.error} companionStale={journey.stale} onCompanionRetry={() => void journey.refresh()} onEquip={(item, clear) => void journey.equip(item, clear)} equipBusy={journey.busyKey} equipError={journey.equipError} questStyle={questStyle}
      contextFor={item => questKind(item) === 'movement' ? movementContextLine(item, { weather: weather.recommendation ? { category: weather.recommendation.category, severity: weather.recommendation.severity, stale: weather.stale, bestOutdoorWindow: weather.recommendation.bestOutdoorWindow } : null }, 'ka') : null}
      whyLabel={item => showWhyTarget(item) ? whyTargetCopy(item, 'ka').button : null} onWhy={setWhyQuest} />
    <QuestRewardFloat text={floatReward} top={insets.top + 65} />
    <QuestDevLauncher variant="chip" />
    <Modal visible={Boolean(whyQuest)} {...APP_MODAL_PROPS} onRequestClose={() => setWhyQuest(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 20 }}>
        <Pressable accessibilityLabel="დახურვა" onPress={() => setWhyQuest(null)} style={{ position: 'absolute', inset: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View accessibilityViewIsModal style={{ maxHeight: '85%', padding: 22, paddingBottom: insets.bottom + 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.surface, gap: 16 }}>
          <ScrollView>{whyQuest ? <View style={{ gap: 12 }}><QText size={21} bold>{whyTargetCopy(whyQuest, 'ka').title}</QText><QText size={16} bold color={colors.primary200}>{whyQuest.target.toLocaleString()} ნაბიჯი</QText><QText muted>{whyTargetCopy(whyQuest, 'ka').body}</QText></View> : null}</ScrollView>
          <QButton label="გასაგებია" onPress={() => setWhyQuest(null)} />
        </View>
      </View>
    </Modal>
  </View>;
}
