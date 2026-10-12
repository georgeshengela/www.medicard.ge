/**
 * WHO growth chart for one indicator: the 3–97 and 15–85 percentile bands as soft coral areas, the median as a
 * dashed line, and the child's own measurements as a line with the latest point lit. No ranking words on the
 * chart — the note under it explains, calmly.
 */
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { tx } from '@/i18n/locale';
import type { GrowthIndicator } from '@/lib/family/familyApi';
import { FONT, useFamilyInk } from './FamilyUI';

const H = 250;
const PAD = { left: 36, right: 12, top: 12, bottom: 26 };

function areaPath(upper: [number, number][], lower: [number, number][], x: (d: number) => number, y: (v: number) => number) {
  if (!upper.length || !lower.length) return '';
  const top = upper.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const bottom = [...lower].reverse().map(([d, v]) => `L${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `${top} ${bottom} Z`;
}

function linePath(points: [number, number][], x: (d: number) => number, y: (v: number) => number) {
  return points.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}

export function GrowthChart({ data, unit }: { data: GrowthIndicator; unit: string }) {
  const { c, ink, fill, dark } = useFamilyInk();
  const [width, setWidth] = useState(0);
  const curves = data.curves;
  const window = data.window;
  const geometry = useMemo(() => {
    if (!curves || !window || !width) return null;
    const pts = data.points.filter((p) => p.ageDays >= window.from && p.ageDays <= window.to);
    const values = [...curves.p3.map(([, v]) => v), ...curves.p97.map(([, v]) => v), ...pts.map((p) => p.value)];
    let min = Math.min(...values), max = Math.max(...values);
    const padV = (max - min) * 0.06;
    min = Math.max(0, min - padV); max += padV;
    const x = (d: number) => PAD.left + ((d - window.from) / (window.to - window.from)) * (width - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
    const years = window.to - window.from > 800;
    const step = years ? 365.25 * (window.to - window.from > 3000 ? 2 : 1) : 30.4375 * 6;
    const xTicks: { d: number; label: string }[] = [];
    for (let d = Math.ceil(window.from / step) * step; d <= window.to + 1; d += step) {
      xTicks.push({ d, label: years ? tx(`${Math.round(d / 365.25)}წ`, `${Math.round(d / 365.25)}y`) : tx(`${Math.round(d / 30.4375)}თ`, `${Math.round(d / 30.4375)}m`) });
    }
    const span = max - min;
    const raw = span / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const yStep = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
    const yTicks: number[] = [];
    for (let v = Math.ceil(min / yStep) * yStep; v <= max; v += yStep) yTicks.push(Math.round(v * 100) / 100);
    return { pts, x, y, xTicks, yTicks };
  }, [curves, window, width, data.points]);

  const band = dark ? 'rgba(253,186,116,0.10)' : 'rgba(234,88,12,0.07)';
  const bandInner = dark ? 'rgba(253,186,116,0.16)' : 'rgba(234,88,12,0.12)';
  const latest = data.latest;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: H }}
      accessible accessibilityLabel={latest ? tx(`გრაფიკი: ბოლო მნიშვნელობა ${latest.value} ${unit}, ${Math.round(latest.percentile)}-ე პერცენტილი`, `Chart: latest ${latest.value} ${unit}, ${Math.round(latest.percentile)}th percentile`) : tx('ზრდის გრაფიკი', 'Growth chart')}>
      {geometry && curves ? (
        <Svg width={width} height={H}>
          {geometry.yTicks.map((v) => (
            <G key={`y${v}`}>
              <Line x1={PAD.left} x2={width - PAD.right} y1={geometry.y(v)} y2={geometry.y(v)} stroke={c.bg200} strokeWidth={1} />
              <SvgText x={PAD.left - 6} y={geometry.y(v) + 4} fontSize={10} fill={c.text300} textAnchor="end" fontFamily={FONT.regular}>{String(v)}</SvgText>
            </G>
          ))}
          {geometry.xTicks.map((t) => (
            <SvgText key={`x${t.d}`} x={geometry.x(t.d)} y={H - 8} fontSize={10} fill={c.text300} textAnchor="middle" fontFamily={FONT.regular}>{t.label}</SvgText>
          ))}
          <Path d={areaPath(curves.p97, curves.p3, geometry.x, geometry.y)} fill={band} />
          <Path d={areaPath(curves.p85, curves.p15, geometry.x, geometry.y)} fill={bandInner} />
          <Path d={linePath(curves.p50, geometry.x, geometry.y)} stroke={ink} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="5 5" fill="none" />
          {geometry.pts.length > 1 ? <Path d={linePath(geometry.pts.map((p) => [p.ageDays, p.value]), geometry.x, geometry.y)} stroke={fill} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {geometry.pts.map((p, i) => {
            const isLast = i === geometry.pts.length - 1;
            return <Circle key={p.id} cx={geometry.x(p.ageDays)} cy={geometry.y(p.value)} r={isLast ? 6 : 3.5} fill={isLast ? fill : c.surface} stroke={fill} strokeWidth={2} />;
          })}
        </Svg>
      ) : null}
    </View>
  );
}

export function ChartLegend() {
  const { c, ink, dark } = useFamilyInk();
  const items = [
    { swatch: dark ? 'rgba(253,186,116,0.16)' : 'rgba(234,88,12,0.12)', label: tx('15–85-ე', '15th–85th') },
    { swatch: dark ? 'rgba(253,186,116,0.10)' : 'rgba(234,88,12,0.07)', label: tx('3–97-ე', '3rd–97th') },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 10, borderRadius: 3, backgroundColor: i.swatch }} />
          <SvgLabel text={i.label} color={c.text200} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 16, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: ink }} />
        <SvgLabel text={tx('მედიანა', 'Median')} color={c.text200} />
      </View>
    </View>
  );
}

function SvgLabel({ text, color }: { text: string; color: string }) {
  return <Text style={{ fontFamily: FONT.regular, fontSize: 11, color }}>{text}</Text>;
}
