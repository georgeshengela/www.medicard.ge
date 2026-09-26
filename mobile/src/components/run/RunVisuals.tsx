import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Route } from 'lucide-react-native';
import type { LatLng } from '@/lib/run/geo';
import { formatPace } from '@/lib/run/geo';
import { routeThumbPath, splitDurations, type DayBucket } from '@/lib/run/insights';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubTint, HUB } from '@/theme/hub';
import { Copy, RUN_TEAL } from './PulseUi';

/** The walk's own shape in a tinted tile — falls back to the route icon. */
export function RouteThumb({ segments, size = HUB.tile + 10 }: { segments: LatLng[][]; size?: number }) {
  const dark = useIsDark(), ink = hubInk('teal', dark);
  const d = useMemo(() => routeThumbPath(segments, size, size, 8), [segments, size]);
  return <View style={{ width: size, height: size, borderRadius: HUB.tileRadius, backgroundColor: hubTint(ink, dark), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {d ? <Svg width={size} height={size} accessible={false}>
      <Path d={d} stroke={RUN_TEAL} strokeOpacity={0.25} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke={ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg> : <Route size={20} color={ink} />}
  </View>;
}

/** Seven day columns; today is the solid one. */
export function WeekBars({ days, height: full = 86 }: { days: DayBucket[]; height?: number }) {
  const c = useThemeColors(), dark = useIsDark(), ink = hubInk('teal', dark);
  const height = days.some(d => d.meters > 0) ? full : 28;
  const max = Math.max(1000, ...days.map(d => d.meters));
  return <View accessible accessibilityLabel={days.map(d => `${d.label} ${(d.meters / 1000).toFixed(1)} კმ`).join(', ')} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
    {days.map(day => {
      const h = day.meters > 0 ? Math.max(6, (day.meters / max) * height) : 4;
      return <View key={day.key} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
        <View style={{ height, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 26, height: h, borderRadius: 8, backgroundColor: day.meters > 0 ? (day.isToday ? RUN_TEAL : ink + (dark ? '59' : '47')) : c.bg200 }} />
        </View>
        <Copy size={10} bold={day.isToday} style={{ color: day.isToday ? c.primary100 : c.text200 }}>{day.label}</Copy>
      </View>;
    })}
  </View>;
}

/** One row per kilometre; a longer bar is a faster kilometre. */
export function SplitBars({ splits }: { splits: number[] }) {
  const c = useThemeColors();
  const rows = splitDurations(splits).map((ms, i) => ({ km: i + 1, ms }));
  const known = rows.filter(r => r.ms != null && r.ms > 0) as { km: number; ms: number }[];
  if (!known.length) return null;
  const fastest = Math.min(...known.map(r => r.ms));
  return <View style={{ gap: 10 }}>
    {rows.map(row => {
      const best = row.ms != null && row.ms === fastest && known.length > 1;
      return <View key={row.km} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Copy size={12} bold style={{ width: 34, color: c.text200 }}>{row.km} კმ</Copy>
        <View style={{ flex: 1, height: 10, borderRadius: 6, backgroundColor: c.bg200, overflow: 'hidden' }}>
          {row.ms != null ? <View style={{ height: 10, borderRadius: 6, width: `${Math.max(12, (fastest / row.ms) * 100)}%`, backgroundColor: best ? RUN_TEAL : c.bg300 }} /> : null}
        </View>
        <Copy size={12} bold style={{ width: 52, textAlign: 'right', fontVariant: ['tabular-nums'], color: best ? c.primary100 : c.text100 }}>{row.ms != null ? formatPace(row.ms / 1000) : '–'}</Copy>
      </View>;
    })}
  </View>;
}
