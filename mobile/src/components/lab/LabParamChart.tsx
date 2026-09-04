import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { formatLabDateKa } from '@/lib/labExtract';
import { ka } from '@/i18n/ka';
import type { LabParameter } from '@/types/lab';

type Point = { date: string; param: LabParameter };

export function LabParamChart({ points }: { points: Point[] }) {
  const T = useFigmaLab();
  const [width, setWidth] = useState(0);
  const height = 220;
  const pad = { l: 8, r: 8, t: 16, b: 28 };

  const { path, dots, labels, low, high } = useMemo(() => {
    const innerW = Math.max(1, width - pad.l - pad.r);
    const innerH = height - pad.t - pad.b;
    const values = points.map((p) => p.param.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 0.0001);
    const mapped = points.map((p, i) => {
      const x = pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
      const y = pad.t + (1 - (p.param.value - min) / span) * innerH;
      return { x, y, ...p };
    });
    const d = mapped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const refLow = points[points.length - 1]?.param.refLow;
    const refHigh = points[points.length - 1]?.param.refHigh;
    return { path: d, dots: mapped, labels: mapped, low: refLow, high: refHigh };
  }, [height, pad.b, pad.l, pad.r, pad.t, points, width]);

  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const delta = prev ? last.param.value - prev.param.value : 0;
  const pct = prev && prev.param.value !== 0 ? Math.round((delta / Math.abs(prev.param.value)) * 100) : 0;

  return (
    <View style={{ gap: 12 }}>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height, backgroundColor: T.cardBg, borderRadius: 16, borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}
      >
        {width > 0 && path ? (
          <Svg width={width} height={height}>
            {low != null && high != null ? (
              <Path
                d={bandPath(points, width, height, pad, low, high)}
                fill={T.brandSoft}
                opacity={0.7}
              />
            ) : null}
            <Path d={path} stroke={T.brand} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            {dots.map((dot) => (
              <Circle key={dot.date} cx={dot.x} cy={dot.y} r={5} fill={T.pageBg} stroke={dot.param.flag === 'N' ? T.brand : T.destructive} strokeWidth={2} />
            ))}
            {labels.map((dot) => (
              <Line key={`g-${dot.date}`} x1={dot.x} y1={height - 22} x2={dot.x} y2={height - 16} stroke={T.border} />
            ))}
          </Svg>
        ) : null}
      </View>
      {prev ? (
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 15,
            color: delta > 0 ? T.destructive : delta < 0 ? T.brand : T.textSecondary,
          }}
        >
          {delta > 0 ? ka.lab.wentUp(Math.abs(pct)) : delta < 0 ? ka.lab.wentDown(Math.abs(pct)) : ka.lab.unchanged}
        </Text>
      ) : (
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>{ka.lab.needMorePoints}</Text>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {points.slice(0, 1).concat(points.length > 1 ? [points[points.length - 1]] : []).map((p) => (
          <Text key={p.date} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: T.textMuted }}>
            {formatLabDateKa(p.date).split(',')[0]}
          </Text>
        ))}
      </View>
    </View>
  );
}

function bandPath(
  points: Point[],
  width: number,
  height: number,
  pad: { l: number; r: number; t: number; b: number },
  low: number,
  high: number,
) {
  const values = points.map((p) => p.param.value);
  const min = Math.min(...values, low);
  const max = Math.max(...values, high);
  const span = Math.max(max - min, 0.0001);
  const innerH = height - pad.t - pad.b;
  const y = (v: number) => pad.t + (1 - (v - min) / span) * innerH;
  return `M ${pad.l} ${y(high)} H ${width - pad.r} V ${y(low)} H ${pad.l} Z`;
}
