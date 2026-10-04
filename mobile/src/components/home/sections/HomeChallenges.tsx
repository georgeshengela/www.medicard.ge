import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Coins } from 'lucide-react-native';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { OutlineRings, withAlpha } from '@/components/brand/OutlineRings';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { useHomeRunWeek } from '@/hooks/useHomeActive';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { groupThousands, questSummary, summarizeRunWeek } from '@/lib/home/activeHome';
import { FRESH } from '@/lib/queryClient';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { moduleInk } from '@/theme/moduleBrand';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * „გამოწვევები“ (owner 2026-10-04, standard Home): MEDIRUN and MEDIQUEST side by side — challenges and
 * rewards are what keeps men using a health app. Same reverse brand tile as the modules sheet (a 4 %
 * tint, the colour only in lines). MEDIRUN reads the on-device walk history (no network); MEDIQUEST the
 * quest dashboard Home already caches. A paused module drops its tile; the other takes the row.
 */
export function HomeChallenges() {
  const features = useFeatureState();
  const runOn = isFeatureOn('medirun', features);
  const questOn = isFeatureOn('quest', features);
  if (!runOn && !questOn) return null;
  return (
    <View style={s.section}>
      <HomeSectionHeading title={tx('გამოწვევები', 'Challenges')} />
      <View style={s.row}>
        {runOn ? <RunTile /> : null}
        {questOn ? <QuestTile /> : null}
      </View>
    </View>
  );
}

function Tile({ module, value, caption, accent, a11y, onPress }: {
  module: 'run' | 'quest';
  value: string;
  caption: string;
  accent?: React.ReactNode;
  a11y: string;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk(module, dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={[s.tile, { backgroundColor: withAlpha(ink, dark ? 0.07 : 0.04), borderColor: withAlpha(ink, dark ? 0.42 : 0.3) }]}
    >
      <OutlineRings ink={ink} dark={dark} size={84} />
      <ModuleWordmark module={module} size={15} />
      <View style={{ gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.value, { color: c.text100 }]}>{value}</Text>
          {accent}
        </View>
        <Text numberOfLines={2} style={[hubText.small, { color: c.text200 }]}>{caption}</Text>
      </View>
    </Pressable>
  );
}

function RunTile() {
  const router = useRouter();
  const { walks } = useHomeRunWeek();
  const week = walks ? summarizeRunWeek(walks) : null;
  const km = week ? week.weekKm : 0;
  const value = tx(`${km > 0 ? km.toFixed(1) : '0'} კმ`, `${km > 0 ? km.toFixed(1) : '0'} km`);
  const caption = week && km > 0
    ? tx(`ამ კვირაში · ${week.activeDays} დღე`, `this week · ${week.activeDays} ${week.activeDays === 1 ? 'day' : 'days'}`)
    : tx('გაანათე ქალაქი — დაიწყე გასეირნება', 'Light up the city — start a walk');
  return <Tile module="run" value={value} caption={caption} a11y={`MEDIRUN. ${value}. ${caption}`} onPress={() => router.push('/run' as never)} />;
}

function QuestTile() {
  const router = useRouter();
  const dark = useIsDark();
  // Same key and freshness as the active Home's MEDIQUEST card: real changes invalidate 'quest'.
  const quest = useQuestDashboard({ staleTime: FRESH.SHORT });
  const summary = questSummary(quest.dashboard);
  const ink = moduleInk('quest', dark);
  const value = summary && summary.dailyTotal > 0 ? `${summary.dailyDone} / ${summary.dailyTotal}` : groupThousands(summary?.coins ?? 0);
  const caption = !summary
    ? tx('მისიები და ჯილდოები', 'Missions and rewards')
    : summary.claimable > 0
      ? tx(`${summary.claimable} ჯილდო გელოდება`, summary.claimable === 1 ? '1 reward is waiting' : `${summary.claimable} rewards are waiting`)
      : summary.dailyTotal > 0
        ? tx(`დღის მისიები · ${groupThousands(summary.coins)} მონეტა`, `daily missions · ${groupThousands(summary.coins)} coins`)
        : tx('Medi Coins', 'Medi Coins');
  return (
    <Tile
      module="quest"
      value={value}
      caption={caption}
      accent={!summary || summary.dailyTotal === 0 ? <Coins size={16} color={ink} strokeWidth={2} /> : null}
      a11y={`MEDIQUEST. ${value}. ${caption}`}
      onPress={() => router.push('/medi-quest' as never)}
    />
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minHeight: 112, padding: 14, borderRadius: 20, borderWidth: 1, overflow: 'hidden', gap: 12 },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
});
