import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Coins, Gift } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { Bone } from '@/components/ui/Skeleton';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { groupThousands, questSummary, weeklyLine, type QuestSummary } from '@/lib/home/activeHome';
import { FRESH } from '@/lib/queryClient';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

const QUEST_ROUTE = '/medi-quest';
/** Segments beyond this read as noise; the a / b count stays exact. */
const MAX_SEGMENTS = 6;

type Props = { first?: boolean };

/**
 * „MEDI QUEST“ — coins, level, today's missions and the weekly steps mission in one compact card.
 * Steps and water are not repeated (the hero and the water tile show them). Tapping opens the hub.
 */
export function HomeQuestCard({ first = false }: Props) {
  const features = useFeatureState();
  if (!isFeatureOn('quest', features)) return null;
  return <QuestCard first={first} />;
}

function QuestCard({ first }: { first: boolean }) {
  const router = useRouter();
  const c = useThemeColors();
  // Home is the only subscriber of ['quest','dashboard'] on this screen. SHORT instead of LIVE:
  // Home remounts on every tab return, and every real change (health push, socket event, coins)
  // already invalidates 'quest' and refetches this observer.
  const quest = useQuestDashboard({ staleTime: FRESH.SHORT });
  const summary = questSummary(quest.dashboard);
  if (!summary && !quest.loading) return null;
  const open = () => router.push(QUEST_ROUTE as never);

  return (
    <View style={[s.section, { marginTop: first ? 22 : HUB.sectionGap }]}>
      <HomeSectionHeading title="MEDI QUEST" linkLabel={tx('ყველა მისია', 'All missions')} onLink={open} />
      {summary ? <QuestBody summary={summary} onOpen={open} /> : <QuestSkeleton surface={c.surface} />}
    </View>
  );
}

function QuestBody({ summary, onOpen }: { summary: QuestSummary; onOpen: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = useHomeAccent();
  const amber = hubInk('amber', dark);
  const segments = Math.min(summary.dailyTotal, MAX_SEGMENTS);
  const filled = summary.dailyTotal > MAX_SEGMENTS ? Math.round((summary.dailyDone / summary.dailyTotal) * MAX_SEGMENTS) : summary.dailyDone;
  const coins = tx(`${groupThousands(summary.coins)} Medi Coins`, `${groupThousands(summary.coins)} Medi Coins`);
  const level = tx(`დონე ${summary.level}`, `Level ${summary.level}`);
  const daily = `${summary.dailyDone} / ${summary.dailyTotal}`;
  const rewards = tx(`${summary.claimable} ჯილდო გელოდება`, summary.claimable === 1 ? '1 reward is waiting' : `${summary.claimable} rewards are waiting`);
  const label = [
    coins,
    level,
    tx(`დღის მისიები ${daily}`, `Daily missions ${daily}`),
    summary.claimable > 0 ? rewards : null,
    summary.weekly ? `${summary.weekly.title}: ${weeklyLine(summary.weekly)}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={tx('MEDI QUEST-ის გვერდი', 'Opens MEDI QUEST')} onPress={onOpen} style={[s.card, { backgroundColor: c.surface }]}>
      <View style={s.head}>
        <View style={[s.icon, { backgroundColor: hubTint(amber, dark) }]}>
          <Coins size={21} color={amber} strokeWidth={1.8} />
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.coins, { color: c.text100 }]}>
          {coins}
        </Text>
        <Text style={[s.chip, { color: amber, backgroundColor: `${amber}${dark ? '26' : '1A'}` }]}>{level}</Text>
      </View>

      {summary.dailyTotal > 0 ? (
        <View style={{ gap: 8 }}>
          <View style={s.between}>
            <Text style={[s.rowTitle, { color: c.text100 }]}>{tx('დღის მისიები', 'Daily missions')}</Text>
            <Text style={[s.rowTitle, { color: c.text200, fontVariant: ['tabular-nums'] }]}>{daily}</Text>
          </View>
          <View style={s.segments}>
            {Array.from({ length: segments }, (_, i) => (
              <View key={i} style={[s.segment, { backgroundColor: i < filled ? accent.ink : c.bg200 }]} />
            ))}
          </View>
        </View>
      ) : null}

      {summary.claimable > 0 ? (
        <View style={s.claim}>
          <Gift size={15} color={accent.ink} strokeWidth={2} />
          <Text style={[s.rowTitle, { color: accent.ink }]}>{rewards}</Text>
        </View>
      ) : null}

      {summary.weekly ? (
        <View style={[s.weekly, { borderTopColor: c.bg300 }]}>
          <View style={[s.weeklyIcon, { backgroundColor: accent.tint }]}>
            <CalendarDays size={18} color={accent.ink} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <Text numberOfLines={1} style={[s.rowTitle, { color: c.text100 }]}>{summary.weekly.title}</Text>
            <View style={[s.track, { backgroundColor: c.bg200 }]}>
              <View style={[s.fill, { width: `${Math.round(summary.weekly.ratio * 100)}%`, backgroundColor: accent.ink }]} />
            </View>
            <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{weeklyLine(summary.weekly)}</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

function QuestSkeleton({ surface }: { surface: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={tx('იტვირთება', 'Loading')} style={[s.card, { backgroundColor: surface }]}>
      <View style={s.head}>
        <Bone width={HUB.tile} height={HUB.tile} radius={HUB.tileRadius} />
        <View style={{ flex: 1 }}>
          <Bone width="55%" height={16} radius={8} />
        </View>
      </View>
      <Bone height={6} radius={3} />
      <Bone height={40} radius={12} />
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  coins: { flex: 1, minWidth: 0, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 23 },
  chip: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekly: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingTop: 12 },
  weeklyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
