import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { CycleCard } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { bbtSeriesWithGaps, fertilityTestHistory } from '@/lib/cycleFertility';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
};

export function CycleTrendsCharts({ bundle }: Props) {
  const c = useCycleColors();
  const trends = bundle.trends;
  if (!trends) return null;

  const cycles = trends.cycleLengths;
  const symptoms = trends.topSymptoms90d.slice(0, 5);
  const bbt = trends.bbtPoints;

  if (cycles.length < 2 && !symptoms.length && !bbt.length) {
    return (
      <CycleCard>
        <Text style={{ color: c.muted, fontSize: 13 }}>{ka.cycle.trendsEmpty}</Text>
      </CycleCard>
    );
  }

  const maxLen = Math.max(...cycles.map((x) => x.length), 28);
  const maxSym = Math.max(...symptoms.map((x) => x.count), 1);

  const stats: { k: string; v: string }[] = [];
  if (trends.shortestCycle != null) stats.push({ k: ka.cycle.shortestCycle, v: `${trends.shortestCycle}` });
  if (trends.longestCycle != null) stats.push({ k: ka.cycle.longestCycle, v: `${trends.longestCycle}` });
  if (trends.variability != null) stats.push({ k: ka.cycle.cycleVariability, v: `${trends.variability}` });

  return (
    <View style={{ gap: 16 }}>
      {stats.length ? (
        <CycleCard>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {stats.map((row) => (
              <View
                key={row.k}
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
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 11,
                    fontFamily: 'NotoSansGeorgian_500Medium',
                  }}
                  numberOfLines={1}
                >
                  {row.k}
                </Text>
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 16,
                    marginTop: 4,
                  }}
                >
                  {row.v}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
            {ka.cycle.trendsLoggedHint}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>
            {trends.cycleCount ? `${ka.cycle.basedOnCycles(trends.cycleCount)} · ` : ''}
            {trends.confidence === 'high'
              ? ka.cycle.confidenceHigh
              : trends.confidence === 'medium'
                ? ka.cycle.confidenceMedium
                : ka.cycle.confidenceLow}
          </Text>
        </CycleCard>
      ) : null}
      {cycles.length >= 2 ? (
        <CycleCard>
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              marginBottom: 12,
            }}
          >
            {ka.cycle.trendsCycleLength}
          </Text>
          <Svg width="100%" height={120} viewBox={`0 0 ${Math.max(cycles.length * 40, 160)} 120`}>
            {cycles.map((item, i) => {
              const h = (item.length / maxLen) * 90;
              return (
                <Rect
                  key={item.start}
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
      ) : null}

      {symptoms.length ? (
        <CycleCard>
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              marginBottom: 12,
            }}
          >
            {ka.cycle.trendsSymptoms}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            {ka.cycle.trendsSymptomsHint}
          </Text>
          {symptoms.map((s) => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: c.muted, fontSize: 12, width: 100 }} numberOfLines={1}>
                {cycleChipLabel(s.key)}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: c.border,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
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
      ) : null}

      {bundle.profile.mode === 'TRY_TO_CONCEIVE' && bbt.length ? (
        <CycleCard>
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              marginBottom: 12,
            }}
          >
            {ka.cycle.trendsBbt}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            {ka.cycle.trendsBbtHint}
          </Text>
          <BbtGapChart
            points={bbt}
            estimatedOvulation={bundle.predictions?.ovulationDate}
            c={c}
          />
        </CycleCard>
      ) : bundle.profile.mode === 'TRY_TO_CONCEIVE' ? (
        <CycleCard>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>{ka.cycle.ttcEmptyBbt}</Text>
        </CycleCard>
      ) : null}

      {bundle.profile.mode === 'TRY_TO_CONCEIVE' ? <FertilityTestHistory logs={bundle.logs} c={c} /> : null}
    </View>
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
    const days = Math.round(
      (Date.parse(`${date}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86_400_000,
    );
    return 10 + (days / span) * 260;
  };
  const yAt = (value: number) => 100 - ((value - min) / range) * 80;
  const runs = bbtSeriesWithGaps(sorted);
  const ovX =
    estimatedOvulation && estimatedOvulation >= first && estimatedOvulation <= last
      ? xAt(estimatedOvulation)
      : null;

  return (
    <Svg width="100%" height={132} viewBox="0 0 280 132">
      <Line x1={0} y1={110} x2={280} y2={110} stroke={c.border} />
      {ovX != null ? (
        <Line
          x1={ovX}
          y1={12}
          x2={ovX}
          y2={110}
          stroke={c.fertile}
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
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
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          marginBottom: 10,
        }}
      >
        {ka.cycle.trendsTests}
      </Text>
      <Text
        style={{
          color: c.muted,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          marginBottom: 6,
        }}
      >
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
