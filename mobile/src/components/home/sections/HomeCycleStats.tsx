import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HeartHandshake } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubLinkRow } from '@/components/home/HubTiles';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { suppressCycleLengthChrome } from '@/lib/cycleForecastEligibility';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { cycleStatsModel, type CycleStat, type StatTone } from '@/lib/home/homeCycle';
import { useThemeColors } from '@/theme/colors';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import type { HomeCycleData } from './HomeCycleHero';

export type HomeCycleStatsProps = {
  cycle: HomeCycleData;
  locked: boolean | null;
  /** Women's space entry allowed (root: `useCommunityEntry(user.id, female) && isFeatureOn('community')`). */
  showCommunity: boolean;
  first?: boolean;
};

/**
 * „ჩემი ციკლი“ — cycle length, bleeding length and variation against the typical adult ranges
 * (same math as the cycle screen's stats card), only from a real inferred pattern of 2+ cycles.
 * Under it the women's space row when the launch gate lets her in. Neither → null.
 */
export function HomeCycleStats({ cycle, locked, showCommunity, first }: HomeCycleStatsProps) {
  const router = useRouter();
  const theme = useThemeColors();
  const c = useCycleColors();
  const accent = useHomeAccent();
  const cycleOn = isFeatureOn('cycle', useFeatureState());
  const bundle = locked === false && cycleOn ? (cycle.view?.display ?? null) : null;
  const stats = bundle
    ? cycleStatsModel({
        eligible: cycleModeCapabilities(bundle.profile.mode).showClassicCycleOverview && !suppressCycleLengthChrome(bundle),
        averages: bundle.averages,
        cycleLengths: bundle.trends?.cycleLengths,
      })
    : null;

  if (!stats && !showCommunity) return null;

  const openTrends = () => router.push('/cycle/trends' as never);
  const tiles: { key: string; label: string; stat: CycleStat }[] = stats
    ? [
        { key: 'cycle', label: ka.cycle.statsCycle, stat: stats.cycle },
        { key: 'period', label: tx('მენსტრუაცია', 'Period'), stat: stats.period },
        { key: 'variation', label: ka.cycle.statsVariation, stat: stats.variation },
      ]
    : [];
  const valueText = (stat: CycleStat) => (stat.value != null ? String(stat.value) : '—');

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: first ? 22 : HUB.sectionGap }}>
      <HomeSectionHeading
        title={ka.cycle.statsTitle}
        linkLabel={stats ? tx('ტენდენციები', 'Trends') : undefined}
        onLink={stats ? openTrends : undefined}
      />
      {stats ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${ka.cycle.statsTitle}. ${tiles
            .map((t) => `${t.label} ${valueText(t.stat)} ${ka.cycle.statsDayUnit}, ${toneLabel(t.stat.tone)}`)
            .join('; ')}. ${ka.cycle.statsBasedOn(stats.cycleCount)}`}
          onPress={openTrends}
          style={[s.card, { backgroundColor: theme.surface }]}
        >
          <View style={s.tiles}>
            {tiles.map((t) => (
              <View key={t.key} style={[s.tile, { backgroundColor: accent.soft }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[hubText.small, { color: theme.text200 }]}>
                  {t.label}
                </Text>
                <View style={s.valueRow}>
                  <Text style={[s.value, { color: c.ink }]}>{valueText(t.stat)}</Text>
                  {t.stat.value != null ? (
                    <Text style={[s.unit, { color: theme.text200 }]}>{ka.cycle.statsDayUnit}</Text>
                  ) : null}
                </View>
                <ToneChip tone={t.stat.tone} />
              </View>
            ))}
          </View>
          <Text style={[hubText.caption, { color: theme.text200 }]}>{ka.cycle.statsBasedOn(stats.cycleCount)}</Text>
        </Pressable>
      ) : null}
      {showCommunity ? (
        <HubLinkRow
          icon={HeartHandshake}
          ink="rose"
          title={tx('ქალების სივრცე', "Women's space")}
          detail={tx('ჰკითხე, გაუზიარე და იპოვე მხარდაჭერა', 'Ask, share and find support')}
          href="/community"
          style={stats ? { marginTop: 10 } : undefined}
        />
      ) : null}
    </View>
  );
}

function toneLabel(tone: StatTone): string {
  if (tone === 'typical') return ka.cycle.statsTypical;
  if (tone === 'longer') return ka.cycle.statsLonger;
  if (tone === 'shorter') return ka.cycle.statsShorter;
  if (tone === 'variable') return ka.cycle.statsVariable;
  return ka.cycle.statsNeedMore;
}

/** Calm reference chip: green for typical, lilac otherwise — never red (a range is not a diagnosis). */
function ToneChip({ tone }: { tone: StatTone }) {
  const theme = useThemeColors();
  const c = useCycleColors();
  if (tone === 'unknown') {
    return <Text style={[hubText.small, { color: theme.text300 }]}>{ka.cycle.statsNeedMore}</Text>;
  }
  const color = tone === 'typical' ? c.success : c.luteal;
  return (
    <View style={[s.chip, { backgroundColor: cycleHexAlpha(color, 0.12) }]}>
      <Text numberOfLines={1} style={[s.chipText, { color }]}>
        {toneLabel(tone)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: 16, gap: 12 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, borderRadius: 16, padding: 12, gap: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18 },
  chip: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, maxWidth: '100%' },
  chipText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 10, lineHeight: 14 },
});
