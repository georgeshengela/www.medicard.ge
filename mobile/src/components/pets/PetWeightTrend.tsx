import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { Pet, PetWeightLog } from '@/lib/api';
import { petWeightDeltaPercent, petWeightMeasurements } from '@/lib/petsHealth';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { useThemeColors } from '@/theme/colors';
import { PetPanel, PetText } from './PetUi';

export function PetWeightTrend({ items }: { items: PetWeightLog[]; pet?: Pet | null }) {
  const c = useThemeColors(), [width, setWidth] = useState(280), [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => petWeightMeasurements(items) as PetWeightLog[], [items]);
  const selected = rows.find(row => row.id === selectedId) ?? rows[rows.length - 1];
  if (!selected) return null;
  const values = rows.map(row => row.weightKg), min = Math.min(...values), max = Math.max(...values), pad = Math.max((max - min) * .2, max * .02, .05);
  const lo = Math.max(0, min - pad), hi = max + pad;
  const times = rows.map(row => Date.parse(`${row.recordedOn}T12:00:00Z`)), span = times[times.length - 1] - times[0];
  const points = rows.map((row, i) => ({ row, x: span ? 10 + (width - 20) * (times[i] - times[0]) / span : rows.length > 1 ? 10 + (width - 20) * i / (rows.length - 1) : width / 2, y: 12 + 116 * (1 - (row.weightKg - lo) / (hi - lo)) }));
  const delta = petWeightDeltaPercent(rows);
  return <PetPanel><View style={{ gap: 14 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><PetText size={23} bold>{Number(selected.weightKg.toFixed(2))} კგ</PetText><PetText size={12} muted>{formatCycleDateKa(selected.recordedOn)}</PetText></View><View style={{ alignItems: 'flex-end', flex: 1 }}><PetText bold color={c.primary100}>{delta == null ? 'პირველი გაზომვა' : `${delta > 0 ? '+' : ''}${delta}%`}</PetText><PetText size={11} muted>{delta == null ? 'დინამიკა შემდეგ გამოჩნდება' : 'ბოლო ორ გაზომვას შორის'}</PetText></View></View>
    <View onLayout={event => setWidth(Math.max(100, event.nativeEvent.layout.width))} accessible accessibilityLabel={rows.map(row => `${formatCycleDateKa(row.recordedOn)}: ${row.weightKg} კილოგრამი`).join('; ')}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><PetText size={10} muted>{Number(hi.toFixed(2))} კგ</PetText><PetText size={10} muted>ბოლო {rows.length} გაზომვა</PetText></View><Svg width="100%" height={140} viewBox={`0 0 ${width} 140`}>{[12, 70, 128].map(y => <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={c.bg300} strokeDasharray="4 5" />)}{points.length > 1 ? <Path d={points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} stroke={c.primary100} strokeWidth={2.5} strokeLinejoin="round" fill="none" /> : null}{points.map(point => <Circle key={point.row.id} cx={point.x} cy={point.y} r={point.row.id === selected.id ? 6 : 4} fill={c.primary100} stroke={c.surface} strokeWidth={2} />)}</Svg><PetText size={10} muted>{Number(lo.toFixed(2))} კგ</PetText></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{rows.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${formatCycleDateKa(row.recordedOn)}, ${row.weightKg} კგ`} accessibilityState={{ selected: row.id === selected.id }} onPress={() => setSelectedId(row.id)} style={{ minHeight: 44, padding: 10, borderRadius: 13, backgroundColor: row.id === selected.id ? c.accent100 : c.surfaceRaised }}><PetText size={12} bold={row.id === selected.id}>{row.recordedOn.slice(5).split('-').reverse().join('.')}</PetText></Pressable>)}</ScrollView>
    <PetText size={12} muted>წერტილები რეალური გაზომვებია; ხაზები მათ აკავშირებს. ცვლილება თავისთავად ჯანმრთელობის შეფასება არ არის.</PetText>
  </View></PetPanel>;
}
