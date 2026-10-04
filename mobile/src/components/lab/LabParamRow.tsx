import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RowA11y } from '@/components/records/SwipeDeleteRow';
import { ka } from '@/i18n/ka';
import type { LabFlag } from '@/types/lab';
import { hubText } from '@/theme/hub';
import { FlagPill, RangeBar, flagIsOff, hasRange, useMedilab } from './MedilabUI';

/**
 * One lab value in a grouped card: name, then either its range bar or a short line (date, norm),
 * and on the right the value — amber when outside the range — with its status pill under it.
 */
export function LabParamRow({
  first,
  name,
  sub,
  value,
  display,
  unit,
  flag,
  refLow,
  refHigh,
  showBar = true,
  onPress,
  onLongPress,
  a11y,
}: {
  first: boolean;
  name: string;
  sub?: string;
  value: number;
  display: string;
  unit: string;
  flag: LabFlag;
  refLow: number | null;
  refHigh: number | null;
  showBar?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  a11y?: RowA11y;
}) {
  const M = useMedilab();
  const off = flagIsOff(flag);
  const bar = showBar && hasRange({ value, refLow, refHigh });
  const status = flag === 'H' ? ka.lab.above : flag === 'L' ? ka.lab.below : flag === 'N' ? ka.lab.normal : ka.lab.unknown;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, `${display} ${unit}`.trim(), status, sub].filter(Boolean).join('. ')}
      {...a11y}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{ backgroundColor: M.c.surface, paddingHorizontal: 14 }}
    >
      <View style={[s.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: M.c.bg300 }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { fontSize: 14.5, color: M.c.text100 }]}>{name}</Text>
          {bar ? (
            <View style={{ maxWidth: 180 }}>
              <RangeBar value={value} low={refLow as number} high={refHigh as number} flag={flag} />
            </View>
          ) : null}
          {sub ? <Text numberOfLines={1} style={[hubText.caption, { color: M.c.text300, marginTop: bar ? -2 : -4 }]}>{sub}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 21, color: off ? M.attention : M.c.text100 }}>
            {display}
            {unit ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: M.c.text300 }}> {unit}</Text> : null}
          </Text>
          <FlagPill flag={flag} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 64 },
});
