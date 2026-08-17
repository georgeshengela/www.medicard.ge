import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { CycleCard } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
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

  return (
    <View style={{ gap: 14 }}>
      {cycles.length >= 2 ? (
        <CycleCard>
          <Text style={{ color: c.ink, fontWeight: '800', marginBottom: 12 }}>{ka.cycle.trendsCycleLength}</Text>
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
                  fill={c.rose}
                  opacity={0.85}
                />
              );
            })}
          </Svg>
        </CycleCard>
      ) : null}

      {symptoms.length ? (
        <CycleCard>
          <Text style={{ color: c.ink, fontWeight: '800', marginBottom: 12 }}>{ka.cycle.trendsSymptoms}</Text>
          {symptoms.map((s) => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: c.muted, fontSize: 12, width: 100 }} numberOfLines={1}>
                {s.key}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: c.creamDeep,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${(s.count / maxSym) * 100}%`,
                    height: '100%',
                    backgroundColor: c.lavender,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ color: c.muted, fontSize: 11, width: 24, textAlign: 'right' }}>{s.count}</Text>
            </View>
          ))}
        </CycleCard>
      ) : null}

      {bbt.length >= 2 && bundle.profile.mode === 'TRY_TO_CONCEIVE' ? (
        <CycleCard>
          <Text style={{ color: c.ink, fontWeight: '800', marginBottom: 12 }}>{ka.cycle.trendsBbt}</Text>
          <Svg width="100%" height={120} viewBox="0 0 280 120">
            <Line x1={0} y1={110} x2={280} y2={110} stroke={c.border} />
            <Polyline
              points={bbt
                .map((p, i) => {
                  const min = Math.min(...bbt.map((b) => b.bbt));
                  const max = Math.max(...bbt.map((b) => b.bbt));
                  const range = Math.max(max - min, 0.5);
                  const x = (i / Math.max(bbt.length - 1, 1)) * 260 + 10;
                  const y = 100 - ((p.bbt - min) / range) * 80;
                  return `${x},${y}`;
                })
                .join(' ')}
              fill="none"
              stroke={c.rose}
              strokeWidth={2}
            />
            {bbt.map((p, i) => {
              const min = Math.min(...bbt.map((b) => b.bbt));
              const max = Math.max(...bbt.map((b) => b.bbt));
              const range = Math.max(max - min, 0.5);
              const x = (i / Math.max(bbt.length - 1, 1)) * 260 + 10;
              const y = 100 - ((p.bbt - min) / range) * 80;
              return <Circle key={p.date} cx={x} cy={y} r={3} fill={c.rose} />;
            })}
          </Svg>
        </CycleCard>
      ) : null}
    </View>
  );
}
