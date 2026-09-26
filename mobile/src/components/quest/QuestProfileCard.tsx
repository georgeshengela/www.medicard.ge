import React from 'react';
import { Pressable, View } from 'react-native';
import { ArrowUpRight, Coins, Flag, Gift } from 'lucide-react-native';
import type { QuestDashboard } from '@/lib/quest/api';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { QuestLevelRing } from './QuestLevelRing';
import { QuestProgressBar } from './QuestProgressBar';
import { levelRingProgress } from '@/lib/quest/logic.js';
import { QCard, QText } from './QuestHubPrimitives';
import { Bone } from '@/components/ui/Skeleton';

export function QuestProfileCard({ dashboard, loading, error, stale, onOpen, onRetry, edgeInset = 16, hideTitle = false }: { dashboard: QuestDashboard | null; loading: boolean; error: boolean; stale: boolean; onOpen: () => void; onRetry: () => void; edgeInset?: number; hideTitle?: boolean }) {
  const c = useThemeColors(), dark = useIsDark(), ink = dark ? '#5EEAD4' : '#0F766E';
  const profile = dashboard?.profile;
  const done = dashboard?.summary.dailyCompleted ?? 0, total = dashboard?.summary.dailyTotal ?? 0;
  const rewards = dashboard?.summary.unclaimedRewards ?? 0;
  return <View style={{ paddingHorizontal: edgeInset, gap: 9 }}>
    {hideTitle ? null : <HomeSectionTitle title="MEDI QUEST" />}
    {loading && !dashboard ? <QCard><Bone width="65%" height={22} /><Bone height={78} radius={16} /></QCard> : <Pressable accessibilityRole="button" accessibilityLabel="MEDI QUEST — მისიები, პროგრესი და ჯილდოები" onPress={error && !dashboard ? onRetry : onOpen} className="active:opacity-90" style={{ borderRadius: 22, padding: 18, gap: 16, backgroundColor: c.surface }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        {profile ? <QuestLevelRing percent={levelRingProgress(profile).percent} label={String(profile.level)} size={66} accessibilityLabel={`დონე ${profile.level}`} /> : <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Flag size={25} color={ink} /></View>}
        <View style={{ flex: 1, gap: 3 }}><QText bold size={17}>{error && !dashboard ? 'განახლება ვერ მოხერხდა' : 'შენი ყოველდღიური პროგრესი'}</QText><QText size={12} muted>{error && !dashboard ? 'შეეხე ხელახლა საცდელად' : profile ? `დონე ${profile.level} · მისიები და ჯილდოები` : 'მისიები · ეტაპები · ჯილდოები'}</QText></View>
        <ArrowUpRight size={20} color={ink} />
      </View>
      {profile ? <>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><QText size={12} muted>{total ? `დღეს ${done} / ${total} მისია შესრულდა` : 'შენი მისიები ერთ სივრცეში'}</QText><View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Coins size={15} color={c.warning} /><QText size={13} bold>{profile.coinBalance.toLocaleString()}</QText></View></View>
        <QuestProgressBar percent={total ? done / total * 100 : 0} height={6} />
      </> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {rewards ? <Gift size={16} color={ink} /> : null}<QText size={13} bold color={ink}>{rewards ? `${rewards} ჯილდო გელოდება` : 'გახსენი შენი მისიები'}</QText>
        {stale ? <QText size={11} muted>· შენახული</QText> : null}
      </View>
    </Pressable>}
  </View>;
}
