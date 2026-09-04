import React, { useId } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { ka } from '@/i18n/ka';
import { moverChangeLabel, type LabMover } from '@/lib/labMovers';
import type { LabFlag } from '@/types/lab';

const SPARK_W = 52;
const SPARK_H = 26;

export function LabMoversCard({
  movers,
  onOpen,
}: {
  movers: LabMover[];
  onOpen: (key: string) => void;
}) {
  const T = useFigmaLab();
  if (!movers.length) return null;

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary }}>{ka.lab.movers}</Text>
      <View
        style={{
          backgroundColor: T.cardBg,
          borderWidth: 1,
          borderColor: T.border,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {movers.map((row, index) => {
          const ink = row.up ? T.destructive : T.brand;
          const soft = row.up ? T.destructiveSoft : T.brandSoft;
          return (
            <Pressable
              key={row.key}
              onPress={() => onOpen(row.key)}
              style={{
                minHeight: 52,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderTopWidth: index ? 1 : 0,
                borderTopColor: T.border,
              }}
            >
              <View style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: ink }} />
              <View style={{ width: SPARK_W, height: SPARK_H, borderRadius: 8, backgroundColor: soft, overflow: 'hidden' }}>
                <LabMoverSpark values={row.values} color={ink} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: T.textPrimary }}
                >
                  {row.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 15, color: T.textSecondary }}
                >
                  {row.prevDisplay} → {row.lastDisplay}
                  {row.unit ? ` ${row.unit}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 16, color: ink }}>
                  {moverChangeLabel(row)}
                </Text>
                <View
                  style={{
                    backgroundColor: flagTone(row.flag, T).bg,
                    borderRadius: 6,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: 'NotoSansGeorgian_500Medium',
                      fontSize: 10,
                      lineHeight: 14,
                      color: flagTone(row.flag, T).fg,
                    }}
                  >
                    {row.prevFlag !== row.flag
                      ? `${flagWord(row.prevFlag)} → ${flagWord(row.flag)}`
                      : flagWord(row.flag)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
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

function flagWord(flag: LabFlag): string {
  if (flag === 'H') return ka.lab.above;
  if (flag === 'L') return ka.lab.below;
  if (flag === 'N') return ka.lab.normal;
  return ka.lab.unknown;
}

function flagTone(flag: LabFlag, T: ReturnType<typeof useFigmaLab>) {
  if (flag === 'H' || flag === 'L') return { bg: T.destructiveSoft, fg: T.destructive };
  if (flag === 'N') return { bg: T.brandSoft, fg: T.brand };
  return { bg: T.tabTrack, fg: T.textSecondary };
}
