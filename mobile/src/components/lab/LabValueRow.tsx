import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RowA11y } from '@/components/records/SwipeDeleteRow';
import { flagTone, labBounds, labRuler, labStatusWord } from '@/lib/labBody';
import type { LabParameter } from '@/types/lab';
import { hubText } from '@/theme/hub';
import { useMedilab } from './MedilabUI';

/**
 * One lab value as one compact line (owner 2026-10-10: the page was too long; like Function Health's
 * list, the full ruler and history live on the value's own page). Left: the plain name, the printed
 * name under it — with „მაღალი“ / „დაბალი“ in amber when outside. Right: the value in its tone and a
 * small three-zone bar with the dot where the value sits.
 */
export function LabValueRow({
  first,
  plain,
  param,
  name,
  onPress,
  onLongPress,
  a11y,
}: {
  first: boolean;
  /** Plain-language name, or null when we only have the printed one. */
  plain: string | null;
  name: string;
  param: LabParameter;
  onPress: () => void;
  onLongPress?: () => void;
  a11y?: RowA11y;
}) {
  const M = useMedilab();
  const tone = flagTone(param.flag);
  const color = tone === 'warn' ? M.attention : tone === 'ok' ? M.normal : M.c.text300;
  const word = labStatusWord(param);
  const bounds = Number.isFinite(param.value) ? labBounds(param) : null;
  const display = param.display || String(param.value);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[plain ?? name, plain ? name : null, `${display} ${param.unit}`.trim(), word].filter(Boolean).join('. ')}
      {...a11y}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{ backgroundColor: M.c.surface, paddingHorizontal: 16 }}
    >
      <View style={[s.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: M.c.bg300 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[hubText.cardTitle, { fontSize: 14.5, lineHeight: 20, color: M.c.text100 }]}>{plain ?? name}</Text>
          <Text style={[hubText.caption, { color: M.c.text300 }]}>
            {plain ? name : param.unit}
            {tone === 'warn' ? <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', color: M.attention }}> · {word}</Text> : null}
          </Text>
        </View>
        <View style={s.right}>
          <Text numberOfLines={1} style={[s.value, { color: tone === 'warn' ? M.attention : M.c.text100 }]}>
            {display}
            {param.unit ? <Text style={[s.unit, { color: M.c.text300 }]}> {param.unit}</Text> : null}
          </Text>
          {bounds ? <MiniRange value={param.value} bounds={bounds} color={color} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Three soft zones (low · normal · high) and the dot — the ruler in a glance. */
export function MiniRange({ value, bounds, color, width = 84 }: { value: number; bounds: { low: number | null; high: number | null }; color: string; width?: number }) {
  const M = useMedilab();
  const r = labRuler(value, bounds);
  const off = `${M.attention}${M.dark ? '3D' : '29'}`;
  const ok = `${M.normal}${M.dark ? '47' : '33'}`;
  return (
    <View style={{ width, height: 10, justifyContent: 'center' }} accessible={false}>
      <View style={s.track}>
        {r.lowZone ? <View style={{ flex: r.lowZone, backgroundColor: off }} /> : null}
        <View style={{ flex: 1 - r.lowZone - r.highZone, backgroundColor: ok }} />
        {r.highZone ? <View style={{ flex: r.highZone, backgroundColor: off }} /> : null}
      </View>
      <View style={[s.dot, { left: r.at * width - 5, backgroundColor: color, borderColor: M.c.surface }]} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 60 },
  right: { alignItems: 'flex-end', gap: 6, minWidth: 84 },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20 },
  unit: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11 },
  track: { flexDirection: 'row', gap: 1.5, height: 5, borderRadius: 3, overflow: 'hidden' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
