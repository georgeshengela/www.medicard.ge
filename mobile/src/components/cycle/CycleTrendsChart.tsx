import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { CycleCard } from '@/components/cycle/CycleUI';
import { CyclePmsHeatmap } from '@/components/cycle/CyclePmsHeatmap';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { formatRecurrenceKa } from '@/lib/cycleAnalytics';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { formatPainEntry, painSeverityLabel } from '@/lib/cycleObservations';
import { bbtSeriesWithGaps, fertilityTestHistory } from '@/lib/cycleFertility';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { showFertilityUi } from '@/lib/cycleContraception';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
};

export function CycleTrendsCharts({ bundle }: Props) {
  const c = useCycleColors();
  const analytics = bundle.analytics;
  const trends = bundle.trends;
  const cycles = analytics?.cycleLengths?.filter((x) => x.length != null) ?? trends?.cycleLengths ?? [];
  const symptoms = trends?.topSymptoms90d.slice(0, 5) ?? [];
  const bbt = trends?.bbtPoints ?? [];
  const insights = bundle.observationInsights;
  const stats = analytics?.cycleLengthStats;
  const bleed = analytics?.bleedDurations;
  const quality = analytics?.insightDataQuality ?? 'LOW';

  const cycleA11y = useMemo(() => {
    const lengths = cycles.map((x) => ('length' in x ? x.length : null)).filter((n): n is number => n != null);
    return lengths.length ? ka.cycle.cycleLengthsA11y(lengths.join(', ')) : null;
  }, [cycles]);

  if (!trends && !analytics) return null;

  const empty =
    (analytics?.completedCycleCount ?? 0) < 2 &&
    !symptoms.length &&
    !bbt.length &&
    !(insights?.pain.daysLogged);

  if (empty) {
    return (
      <CycleCard>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{ka.cycle.trendsLogCycles}</Text>
      </CycleCard>
    );
  }

  return (
    <View style={{ gap: 22 }}>
      <QualityCard quality={quality} coverage={analytics?.loggingCoverage} completed={analytics?.completedCycleCount} c={c} />

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
        {cycles.length >= 2 ? <CycleLengthBars cycles={cycles} c={c} /> : null}
      </Section>

      <Section title={ka.cycle.trendsSectionBefore}>
        <CyclePmsHeatmap bundle={bundle} />
        {(analytics?.symptomPatterns ?? []).length ? (
          <CycleCard>
            {(analytics?.symptomPatterns ?? []).map((p) => (
              <Text key={p.key} style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                {formatRecurrenceKa(p, cycleChipLabel(p.key), ka.cycle.patternInCycles)}
              </Text>
            ))}
            {(analytics?.moodPatterns ?? []).map((p) => (
              <Text key={`mood-${p.key}`} style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                {formatRecurrenceKa(p, cycleChipLabel(p.key), ka.cycle.patternInCycles)}
              </Text>
            ))}
          </CycleCard>
        ) : analytics && analytics.completedCycleCount < 3 ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{ka.cycle.trendsNeedMoreCycles}</Text>
        ) : null}
        {symptoms.length ? <Symptom90d symptoms={symptoms} c={c} /> : null}
      </Section>

      <Section title={ka.cycle.trendsSectionPain}>
        {(analytics?.painPatterns ?? []).map((p) => (
          <CycleCard key={p.painType}>
            <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20 }}>
              {formatRecurrenceKa(
                p,
                ka.cycle.painType[p.painType as keyof typeof ka.cycle.painType] ?? p.painType,
                ka.cycle.patternInCycles,
              )}
            </Text>
          </CycleCard>
        ))}
        {insights?.pain.daysLogged ? (
          <CycleCard>
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>
              {ka.cycle.painDaysLogged(insights.pain.daysLogged)} · {ka.cycle.observationBasedOn(insights.pain.sampleDays)}
            </Text>
            <Text style={{ color: c.ink, fontSize: 13, marginBottom: 8 }}>
              {`${painSeverityLabel('mild')} ${insights.pain.severityCounts.mild} · ${painSeverityLabel('moderate')} ${insights.pain.severityCounts.moderate} · ${painSeverityLabel('severe')} ${insights.pain.severityCounts.severe}`}
            </Text>
            {(insights.pain.recent ?? []).slice(0, 8).map((row) => (
              <Text key={`${row.date}-${row.type}`} style={{ color: c.ink, fontSize: 13, marginBottom: 4 }}>
                {formatCycleDateKa(row.date)} — {formatPainEntry(row)}
              </Text>
            ))}
          </CycleCard>
        ) : null}
      </Section>

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
        {(analytics?.customTagDayCounts ?? []).length ? (
          <CycleCard>
            {(analytics?.customTagDayCounts ?? []).map((row) => {
              const name = bundle.customTags?.find((t) => t.id === row.tagId)?.name ?? row.tagId;
              return (
                <Text key={row.tagId} style={{ color: c.ink, fontSize: 13, marginBottom: 4 }}>
                  {ka.cycle.customTagCount(name, row.dayCount)}
                </Text>
              );
            })}
          </CycleCard>
        ) : null}
      </Section>

      {bundle.profile.mode === 'TRY_TO_CONCEIVE' ? (
        <Section title={ka.cycle.trendsSectionFertility}>
          {analytics?.fertilityObservations ? (
            <CycleCard>
              <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20 }}>
                {ka.cycle.bbtReadingCount(analytics.fertilityObservations.bbtReadingCount)}
              </Text>
              <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginTop: 6 }}>
                {ka.cycle.opkPositiveCycles(
                  analytics.fertilityObservations.cyclesWithPositiveOpk,
                  analytics.fertilityObservations.eligibleCycles,
                )}
              </Text>
            </CycleCard>
          ) : null}
          {bbt.length ? (
            <CycleCard>
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 12 }}>
                {ka.cycle.trendsBbt}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
                {ka.cycle.trendsBbtHint}
              </Text>
              <BbtGapChart
                points={bbt}
                estimatedOvulation={showFertilityUi(bundle) ? bundle.predictions?.ovulationDate : null}
                c={c}
              />
            </CycleCard>
          ) : (
            <CycleCard>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>{ka.cycle.ttcEmptyBbt}</Text>
            </CycleCard>
          )}
          <FertilityTestHistory logs={bundle.logs} c={c} />
        </Section>
      ) : null}

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
  coverage,
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
          {coverage != null ? ` · ${Math.round(coverage * 100)}%` : ''}
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

function Symptom90d({
  symptoms,
  c,
}: {
  symptoms: { key: string; count: number }[];
  c: ReturnType<typeof useCycleColors>;
}) {
  const maxSym = Math.max(...symptoms.map((x) => x.count), 1);
  return (
    <CycleCard>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 12 }}>
        {ka.cycle.trendsSymptoms}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>{ka.cycle.trendsSymptomsHint}</Text>
      {symptoms.map((s) => (
        <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: c.muted, fontSize: 12, width: 100 }} numberOfLines={1}>
            {cycleChipLabel(s.key)}
          </Text>
          <View style={{ flex: 1, height: 8, backgroundColor: c.border, borderRadius: 4, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(s.count / maxSym) * 100}%`,
                height: '100%',
                backgroundColor: c.brand,
                borderRadius: 4,
              }}
            />
          </View>
          <Text style={{ color: c.muted, fontSize: 11, width: 24, textAlign: 'right' }}>{s.count}</Text>
        </View>
      ))}
    </CycleCard>
  );
}

function BbtGapChart({
  points,
  estimatedOvulation,
  c,
}: {
  points: { date: string; bbt: number }[];
  estimatedOvulation?: string | null;
  c: ReturnType<typeof useCycleColors>;
}) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const span = Math.max(
    1,
    Math.round((Date.parse(`${last}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86_400_000),
  );
  const min = Math.min(...sorted.map((p) => p.bbt));
  const max = Math.max(...sorted.map((p) => p.bbt));
  const range = Math.max(max - min, 0.4);
  const xAt = (date: string) => {
    const days = Math.round((Date.parse(`${date}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86_400_000);
    return 10 + (days / span) * 260;
  };
  const yAt = (value: number) => 100 - ((value - min) / range) * 80;
  const runs = bbtSeriesWithGaps(sorted);
  const ovX =
    estimatedOvulation && estimatedOvulation >= first && estimatedOvulation <= last ? xAt(estimatedOvulation) : null;

  return (
    <Svg width="100%" height={132} viewBox="0 0 280 132">
      <Line x1={0} y1={110} x2={280} y2={110} stroke={c.border} />
      {ovX != null ? (
        <Line x1={ovX} y1={12} x2={ovX} y2={110} stroke={c.fertile} strokeDasharray="4 4" strokeWidth={1.5} />
      ) : null}
      {runs.map((run) =>
        run.length > 1 ? (
          <Polyline
            key={`${run[0].date}-${run[run.length - 1].date}`}
            points={run.map((p) => `${xAt(p.date)},${yAt(p.bbt)}`).join(' ')}
            fill="none"
            stroke={c.rose}
            strokeWidth={2}
          />
        ) : null,
      )}
      {sorted.map((p) => (
        <Circle key={p.date} cx={xAt(p.date)} cy={yAt(p.bbt)} r={3} fill={c.rose} />
      ))}
    </Svg>
  );
}

function FertilityTestHistory({
  logs,
  c,
}: {
  logs: CycleBundle['logs'];
  c: ReturnType<typeof useCycleColors>;
}) {
  const { ovulationTests, pregnancyTests } = fertilityTestHistory(logs);
  return (
    <CycleCard>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 10 }}>
        {ka.cycle.trendsTests}
      </Text>
      <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, marginBottom: 6 }}>
        {ka.cycle.opkHistory}
      </Text>
      {ovulationTests.length ? (
        ovulationTests.slice(0, 8).map((item) => (
          <Text key={`opk-${item.date}`} style={{ color: c.ink, fontSize: 13, marginBottom: 4 }}>
            {formatCycleDateKa(item.date)} — {ka.cycle.testResult[item.result]}
          </Text>
        ))
      ) : (
        <Text style={{ color: c.muted, fontSize: 13, marginBottom: 10 }}>{ka.cycle.opkHistoryEmpty}</Text>
      )}
      <Text
        style={{
          color: c.muted,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          marginTop: 8,
          marginBottom: 6,
        }}
      >
        {ka.cycle.pregHistory}
      </Text>
      {pregnancyTests.length ? (
        pregnancyTests.slice(0, 8).map((item) => (
          <Text key={`preg-${item.date}`} style={{ color: c.ink, fontSize: 13, marginBottom: 4 }}>
            {formatCycleDateKa(item.date)} — {ka.cycle.testResult[item.result]}
          </Text>
        ))
      ) : (
        <Text style={{ color: c.muted, fontSize: 13 }}>{ka.cycle.pregHistoryEmpty}</Text>
      )}
    </CycleCard>
  );
}
