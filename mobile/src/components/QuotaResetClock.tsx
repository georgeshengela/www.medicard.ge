import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { ka } from '@/i18n/ka';
import { DAY_MS, formatResetClock } from '@/lib/format';

const SIZE = 148;
const CX = SIZE / 2;
const CY = SIZE / 2;
const TICK_OUTER = 68;
const TICK_INNER = 58;
const RING_R = 46;
const RING_STROKE = 6;
const TICKS = 24;

type Palette = {
  brand: string;
  brandMuted: string;
  track: string;
  textPrimary: string;
  textSecondary: string;
  well: string;
  wellBorder: string;
};

type Props = {
  remainingMs: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  colors: Palette;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function tickFill(remainingMs: number, periodStart?: string | null, periodEnd?: string | null) {
  if (remainingMs <= 0) return TICKS;
  if (remainingMs < 2 * DAY_MS) {
    const elapsed = DAY_MS - remainingMs;
    return clamp(Math.floor((elapsed / DAY_MS) * TICKS), 0, TICKS);
  }
  const start = periodStart ? new Date(periodStart).getTime() : NaN;
  const end = periodEnd ? new Date(periodEnd).getTime() : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    const elapsed = Date.now() - start;
    const total = end - start;
    return clamp(Math.floor((elapsed / total) * TICKS), 0, TICKS);
  }
  return 0;
}

export function QuotaResetClock({ remainingMs, periodStart, periodEnd, colors }: Props) {
  const lastDay = remainingMs > 0 && remainingMs < 2 * DAY_MS;
  const filled = tickFill(remainingMs, periodStart, periodEnd);
  const progress = filled / TICKS;
  const circ = 2 * Math.PI * RING_R;
  const dashOffset = circ * (1 - progress);
  const compactClock = remainingMs >= DAY_MS;

  return (
    <View style={{ width: '100%', alignItems: 'center', gap: 16 }}>
      <View
        style={{
          width: SIZE + 16,
          height: SIZE + 16,
          borderRadius: 28,
          backgroundColor: colors.well,
          borderWidth: 1,
          borderColor: colors.wellBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle cx={CX} cy={CY} r={RING_R} stroke={colors.track} strokeWidth={RING_STROKE} fill="none" />
            <Circle
              cx={CX}
              cy={CY}
              r={RING_R}
              stroke={colors.brand}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={dashOffset}
              rotation={-90}
              origin={`${CX}, ${CY}`}
            />
            {Array.from({ length: TICKS }, (_, i) => {
              const angle = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
              const lit = i < filled;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              return (
                <Line
                  key={i}
                  x1={CX + TICK_INNER * cos}
                  y1={CY + TICK_INNER * sin}
                  x2={CX + TICK_OUTER * cos}
                  y2={CY + TICK_OUTER * sin}
                  stroke={lit ? colors.brand : colors.brandMuted}
                  strokeWidth={lit ? 3 : 2}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
          <View
            style={{
              position: 'absolute',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 12,
              maxWidth: 110,
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: compactClock ? 13 : 18,
                lineHeight: compactClock ? 18 : 24,
                letterSpacing: -0.3,
                color: colors.textPrimary,
                textAlign: 'center',
              }}
            >
              {formatResetClock(remainingMs)}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 11,
                lineHeight: 16,
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: 2,
              }}
            >
              {ka.usage.resetClockLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ width: '100%', gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 12,
              lineHeight: 16,
              color: colors.textSecondary,
            }}
          >
            {lastDay ? ka.usage.hourBarLabel : ka.usage.periodBarLabel}
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 12,
              lineHeight: 16,
              color: colors.brand,
            }}
          >
            {lastDay ? ka.usage.hoursFilled(filled) : ka.usage.periodFilled(filled)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3, height: 10 }}>
          {Array.from({ length: TICKS }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                borderRadius: 2,
                backgroundColor: i < filled ? colors.brand : colors.track,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
