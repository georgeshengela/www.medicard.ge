import React, { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { FlagPill, useMedilab } from '@/components/lab/MedilabUI';
import { HUB, hubText } from '@/theme/hub';
import { moverChangeLabel, type LabMover } from '@/lib/labMovers';

const SPARK_W = 52;
const SPARK_H = 26;

/**
 * „რა შეიცვალა“ — the biggest moves between her last two tests, one flat card. The spark is in the
 * module indigo; the status pill (amber outside the range, green inside) carries the meaning, so a
 * rise is never painted „bad“ just for going up.
 */
export function LabMoversCard({
  movers,
  onOpen,
}: {
  movers: LabMover[];
  onOpen: (key: string) => void;
}) {
  const M = useMedilab();
  if (!movers.length) return null;

  return (
    <View style={{ backgroundColor: M.c.surface, borderRadius: HUB.cardRadius, overflow: 'hidden' }}>
      {movers.map((row, index) => (
        <Pressable
          key={row.key}
          accessibilityRole="button"
          accessibilityLabel={`${row.name}: ${row.prevDisplay} → ${row.lastDisplay} ${row.unit}, ${moverChangeLabel(row)}`}
          onPress={() => onOpen(row.key)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 }}
        >
          <View style={{ width: SPARK_W, height: SPARK_H + 6, borderRadius: 10, backgroundColor: M.inkSoft, alignItems: 'center', justifyContent: 'center' }}>
            <LabMoverSpark values={row.values} color={M.ink} />
          </View>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 12,
              paddingRight: 14,
              borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
              borderTopColor: M.c.bg300,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[hubText.cardTitle, { fontSize: 14, color: M.c.text100 }]}>{row.name}</Text>
              <Text numberOfLines={1} style={[hubText.caption, { color: M.c.text200 }]}>
                {row.prevDisplay} → {row.lastDisplay}
                {row.unit ? ` ${row.unit}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 18, color: M.c.text100 }}>{moverChangeLabel(row)}</Text>
              <FlagPill flag={row.flag} />
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function LabMoverSpark({
  values,
  color,
  width = SPARK_W,
  height = SPARK_H,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.0001);
  const padX = 3;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const pts = values.map((value, i) => {
    const x = padX + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = padY + (1 - (value - min) / span) * innerH;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const last = values.length - 1;
  const lastX = padX + innerW;
  const lastY = padY + (1 - (values[last] - min) / span) * innerH;
  const area = `${pts.join(' ')} L ${lastX.toFixed(1)} ${height} L ${padX} ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${uid})`} />
      <Path d={pts.join(' ')} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lastX} cy={lastY} r={2.2} fill={color} />
    </Svg>
  );
}
