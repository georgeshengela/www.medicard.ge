import React from 'react';
import { Pressable, View } from 'react-native';
import { ArrowUpRight, Flag, Gift } from 'lucide-react-native';
import type { QuestDashboard } from '@/lib/quest/api';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { QuestLevelRing } from './QuestLevelRing';
import { QuestProgressBar } from './QuestProgressBar';
import { levelRingProgress } from '@/lib/quest/logic.js';
import { tx } from '@/i18n/locale';
import { QButton, QCard, QText } from './QuestHubPrimitives';
import { QuestCoinMark } from './QuestIcon';
import { Bone } from '@/components/ui/Skeleton';

/**
 * Profile MEDIQUEST card (owner 2026-10-04 polish): level ring, „დონე N“ with today's missions in one
 * line, the coin balance as a pill, the day's bar and what is waiting. Profile mounts it inside the
 * quest module tone, so the ring and bar speak MEDIQUEST violet. Retry is a real button.
 */
export function QuestProfileCard({ dashboard, loading, error, stale, onOpen, onRetry, edgeInset = 16, hideTitle = false }: { dashboard: QuestDashboard | null; loading: boolean; error: boolean; stale: boolean; onOpen: () => void; onRetry: () => void; edgeInset?: number; hideTitle?: boolean }) {
  const c = useThemeColors(), dark = useIsDark(), ink = c.primary100;
  const profile = dashboard?.profile;
  const done = dashboard?.summary.dailyCompleted ?? 0, total = dashboard?.summary.dailyTotal ?? 0;
  const rewards = dashboard?.summary.unclaimedRewards ?? 0;
  const failed = error && !dashboard;
  return <View style={{ paddingHorizontal: edgeInset, gap: 9 }}>
    {hideTitle ? null : <HomeSectionTitle title="MEDIQUEST" brand="quest" />}
    {loading && !dashboard ? <QCard><Bone width="65%" height={22} /><Bone height={78} radius={16} /></QCard> : failed ? <QCard>
      <QText bold size={16}>{tx('MEDIQUEST ვერ განახლდა', 'Couldn’t refresh MEDIQUEST')}</QText>
      <QText size={12} muted>{tx('შენი მონეტები და პროგრესი ანგარიშზე ინახება.', 'Your coins and progress are saved to your account.')}</QText>
      <QButton secondary label={tx('ხელახლა ცდა', 'Try again')} onPress={onRetry} />
    </QCard> : <Pressable accessibilityRole="button" accessibilityLabel={tx('MEDIQUEST — მისიები, პროგრესი და ჯილდოები', 'MEDIQUEST — missions, progress and rewards')} onPress={onOpen} className="active:opacity-90" style={{ borderRadius: 22, padding: 16, gap: 14, backgroundColor: c.surface }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {profile ? <QuestLevelRing percent={levelRingProgress(profile).percent} label={String(profile.level)} size={56} accessibilityLabel={tx(`დონე ${profile.level}`, `Level ${profile.level}`)} /> : <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><Flag size={24} color={ink} /></View>}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <QText bold size={16}>{profile ? tx(`დონე ${profile.level}`, `Level ${profile.level}`) : tx('დაიწყე მისიები', 'Start your missions')}</QText>
          <QText size={12} muted>{total ? tx(`დღეს ${done} / ${total} მისია`, `${done} / ${total} missions today`) : tx('მისიები, ეტაპები და ჯილდოები', 'Missions, stages and rewards')}</QText>
        </View>
        {profile ? <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, minHeight: 32, borderRadius: 16, backgroundColor: dark ? 'rgba(251,191,36,0.14)' : '#FDF3DD' }}><QuestCoinMark size={15} /><QText size={13} bold>{profile.coinBalance.toLocaleString()}</QText></View> : <ArrowUpRight size={20} color={ink} />}
      </View>
      {profile && total ? <QuestProgressBar percent={done / total * 100} height={6} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {rewards ? <Gift size={16} color={ink} /> : null}
        <QText size={13} bold color={ink}>{rewards ? tx(`${rewards} ჯილდო გელოდება`, `${rewards} ${rewards === 1 ? 'reward' : 'rewards'} waiting`) : tx('მისიების გახსნა', 'Open missions')}</QText>
        <View style={{ flex: 1 }} />
        {stale ? <QText size={11} muted>{tx('შენახული ვერსია', 'Saved version')}</QText> : null}
        <ArrowUpRight size={17} color={ink} />
      </View>
    </Pressable>}
  </View>;
}
