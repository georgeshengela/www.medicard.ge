import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { CycleCard } from '@/components/cycle/CycleUI';
import { CyclePmsHeatmap } from '@/components/cycle/CyclePmsHeatmap';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { hasPmsPattern } from '@/lib/cycleAnalytics';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
};

export function CycleTrendsCharts({ bundle }: Props) {
  const c = useCycleColors();
  const analytics = bundle.analytics;
  const trends = bundle.trends;
  const cycles = analytics?.cycleLengths?.filter((x) => x.length != null) ?? trends?.cycleLengths ?? [];
  const insights = bundle.observationInsights;
  const stats = analytics?.cycleLengthStats;
  const bleed = analytics?.bleedDurations;
  const quality = analytics?.insightDataQuality ?? 'LOW';
  const hasCycleStats = (analytics?.completedCycleCount ?? 0) >= 2 && Boolean(stats?.count);
  const hasLifestyle =
    Boolean(analytics?.lifestylePatterns?.length) || Boolean(insights?.lifestyle.patterns?.length);
  const showPms = hasPmsPattern(bundle);

  const cycleA11y = useMemo(() => {
    const lengths = cycles.map((x) => ('length' in x ? x.length : null)).filter((n): n is number => n != null);
    return lengths.length ? ka.cycle.cycleLengthsA11y(lengths.join(', ')) : null;
  }, [cycles]);

  if (!trends && !analytics) return null;
  if (!hasCycleStats && cycles.length < 3 && !showPms && !hasLifestyle) return null;

  return (
    <View style={{ gap: 22 }}>
      {hasCycleStats ? (
        <QualityCard quality={quality} completed={analytics?.completedCycleCount} c={c} />
      ) : null}

      <Section title={ka.cycle.trendsSectionCycle}>
        {stats?.count ? (
          <CycleCard>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {(
                [
                  stats.average != null ? { k: ka.cycle.trendsCycleLength, v: `${stats.average}` } : null,
                  stats.shortest != null ? { k: ka.cycle.shortestCycle, v: `${stats.shortest}` } : null,
                  stats.longest != null ? { k: ka.cycle.longestCycle, v: `${stats.longest}` } : null,
                  stats.variability != null ? { k: ka.cycle.cycleVariability, v: `${stats.variability}` } : null,
                  bleed?.average != null ? { k: ka.cycle.loggedBleedDuration, v: `${bleed.average}` } : null,
                ] as Array<{ k: string; v: string } | null>
              )
                .filter((row): row is { k: string; v: string } => row != null)
                .map((row) => (
                  <StatChip key={row.k} label={row.k} value={row.v} c={c} />
                ))}
            </View>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>{ka.cycle.trendsLoggedHint}</Text>
            {cycleA11y ? (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>{cycleA11y}</Text>
            ) : null}
            {bleed?.average != null && bleed.shortest != null && bleed.longest != null ? (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 6 }}>
                {ka.cycle.bleedDurationsA11y(bleed.average, bleed.shortest, bleed.longest)}
              </Text>
            ) : null}
          </CycleCard>
        ) : null}
        {cycles.length >= 3 ? <CycleLengthBars cycles={cycles} c={c} /> : null}
      </Section>

      {showPms ? (
        <Section title={ka.cycle.trendsSectionBefore}>
          <CyclePmsHeatmap bundle={bundle} />
        </Section>
      ) : null}

      <Section title={ka.cycle.trendsSectionLifestyle}>
        {(analytics?.lifestylePatterns ?? []).map((p, i) => (
          <CycleCard key={`${p.left}-${i}`}>
            <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20 }}>
              {ka.cycle.lifestyleTogether(p.numerator, p.denominator)}
            </Text>
          </CycleCard>
        ))}
        {(insights?.lifestyle.patterns ?? []).map((p) => (
          <Text key={p.id} style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
            {p.textKa}
          </Text>
        ))}
      </Section>

      {analytics?.contraceptionContext.startedAt ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{ka.cycle.contraceptionHistoryNote}</Text>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useCycleColors();
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>{title}</Text>
      {items}
    </View>
  );
}

function QualityCard({
  quality,
  completed,
  c,
}: {
  quality: 'LOW' | 'MEDIUM' | 'HIGH';
  coverage?: number;
  completed?: number;
  c: ReturnType<typeof useCycleColors>;
}) {
  const label =
    quality === 'HIGH' ? ka.cycle.insightQualityHigh : quality === 'MEDIUM' ? ka.cycle.insightQualityMedium : ka.cycle.insightQualityLow;
  return (
    <CycleCard>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 6 }}>{label}</Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{ka.cycle.insightQualityHint}</Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 6 }}>{ka.cycle.analyticsHorizonHint}</Text>
      {completed != null ? (
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>
          {ka.cycle.basedOnCycles(completed)}
        </Text>
      ) : null}
    </CycleCard>
  );
}

function StatChip({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useCycleColors>;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        minWidth: '30%',
        backgroundColor: c.cardSoft,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'NotoSansGeorgian_500Medium' }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function CycleLengthBars({
  cycles,
  c,
}: {
  cycles: { startDate?: string; start?: string; length: number | null }[];
  c: ReturnType<typeof useCycleColors>;
}) {
  const usable = cycles.filter((x) => x.length != null) as { startDate?: string; start?: string; length: number }[];
  const maxLen = Math.max(...usable.map((x) => x.length), 28);
  return (
    <CycleCard>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 12 }}>
        {ka.cycle.trendsCycleLength}
      </Text>
      <Svg width="100%" height={120} viewBox={`0 0 ${Math.max(usable.length * 40, 160)} 120`}>
        {usable.map((item, i) => {
          const h = (item.length / maxLen) * 90;
          return (
            <Rect
              key={item.startDate ?? item.start ?? String(i)}
              x={i * 40 + 8}
              y={100 - h}
              width={24}
              height={h}
              rx={6}
              fill={c.brand}
              opacity={0.9}
            />
          );
        })}
      </Svg>
    </CycleCard>
  );
}
