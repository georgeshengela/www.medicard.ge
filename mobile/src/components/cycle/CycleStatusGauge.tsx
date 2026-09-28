import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Info } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/**
 * Cycle ring (2026-09-28 redesign): one bead per cycle day, read clockwise from the top.
 * Grammar shared with the day strip and calendar — logged = solid, estimated = outline:
 *  - logged bleeding: solid clay bead
 *  - estimated fertile window: blue outline bead (tap → explanation)
 *  - days already lived: quiet filled bead; days ahead: track bead
 *  - today: a larger teal marker
 * The centre carries one number and its words; the hero decides which (countdown or cycle day).
 */
const VB = 300;
const C = VB / 2;
const R = 128;

export type GaugeCenter = { top?: string | null; value: string; bottom?: string | null; tone?: 'period' | 'ink' };

type Props = {
  day: number | null;
  cycleLength: number;
  hideLengthChrome?: boolean;
  phaseHint?: string;
  periodActive?: boolean;
  recordedPeriodDays?: number[];
  pmsPattern?: boolean;
  fertileDays?: { from: number; to: number } | null;
  a11yLabel?: string;
  center?: GaugeCenter;
  onInfo?: () => void;
  onPressFertile?: () => void;
};

function beadPoint(index: number, count: number) {
  const deg = -90 + (index / count) * 360;
  const rad = (deg * Math.PI) / 180;
  return { x: C + R * Math.cos(rad), y: C + R * Math.sin(rad) };
}

export function CycleStatusGauge({
  day,
  cycleLength,
  hideLengthChrome,
  phaseHint,
  periodActive,
  recordedPeriodDays = [],
  pmsPattern = false,
  fertileDays,
  a11yLabel,
  center,
  onInfo,
  onPressFertile,
}: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const { width: screenW, height: screenH, fontScale } = useWindowDimensions();
  const compact = fontScale >= 1.25 || screenH < 720;
  const size = Math.min(screenW - 72, compact ? 212 : 244);
  const length = hideLengthChrome ? 0 : Math.max(14, Math.round(cycleLength) || 28);
  // Late cycles run past the usual length: grow the ring instead of wrapping today onto day 1.
  const count = length ? Math.max(length, day ?? 0) : 28;
  const beadR = Math.min(6.4, ((2 * Math.PI * R) / count) * 0.26);
  const recorded = useMemo(() => new Set(recordedPeriodDays), [recordedPeriodDays]);

  const beads = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const d = i + 1;
        const p = beadPoint(i, count);
        const isToday = !hideLengthChrome && day === d;
        const logged = recorded.has(d);
        const fertile = Boolean(fertileDays && d >= Math.min(fertileDays.from, fertileDays.to) && d <= Math.max(fertileDays.from, fertileDays.to));
        const lived = !hideLengthChrome && day != null && d < day;
        return { d, ...p, isToday, logged, fertile, lived };
      }),
    [count, day, hideLengthChrome, recorded, fertileDays],
  );

  const todayBead = beads.find((b) => b.isToday);
  const valueSize = Math.round(size * 0.25);
  const centerValue = center?.value ?? (hideLengthChrome ? '—' : day != null ? String(day) : '—');
  const centerTop = center ? center.top : ka.cycle.cycleDay;
  const centerBottom = center ? center.bottom : hideLengthChrome ? null : ka.cycle.outOf(length);

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(420)} style={{ alignItems: 'center', width: '100%' }}>
      <View accessible accessibilityRole="image" accessibilityLabel={a11yLabel} style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          <G>
            {beads.map((b) => {
              if (b.isToday) return null;
              if (b.logged) return <Circle key={b.d} cx={b.x} cy={b.y} r={beadR} fill={c.period} />;
              if (b.fertile) {
                return (
                  <Circle
                    key={b.d}
                    cx={b.x}
                    cy={b.y}
                    r={beadR - 0.9}
                    fill={c.fertilitySoft}
                    stroke={c.fertile}
                    strokeWidth={1.8}
                    opacity={b.lived ? 0.5 : 1}
                    onPress={onPressFertile}
                  />
                );
              }
              return (
                <Circle
                  key={b.d}
                  cx={b.x}
                  cy={b.y}
                  r={beadR * (b.lived ? 0.78 : 0.62)}
                  fill={b.lived ? cycleHexAlpha(c.ink, 0.28) : c.gaugeTrack}
                />
              );
            })}
          </G>
          {todayBead ? (
            <G>
              <Circle cx={todayBead.x} cy={todayBead.y} r={beadR * 2.25} fill={cycleHexAlpha(c.todayRing, 0.16)} />
              <Circle cx={todayBead.x} cy={todayBead.y} r={beadR * 1.45} fill={todayBead.logged ? c.period : c.todayRing} stroke={c.card} strokeWidth={2.5} />
            </G>
          ) : null}
        </Svg>

        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: size * 0.18, right: size * 0.18, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          {centerTop ? (
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
              {centerTop}
            </Text>
          ) : null}
          <Animated.Text
            key={centerValue}
            entering={reduceMotion ? undefined : ZoomIn.duration(360)}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: center?.tone === 'period' ? c.period : c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: valueSize,
              lineHeight: Math.round(valueSize * 1.18),
              letterSpacing: -1.5,
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          >
            {centerValue}
          </Animated.Text>
          {centerBottom ? (
            <Text numberOfLines={2} style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center' }}>
              {centerBottom}
            </Text>
          ) : null}
        </View>
      </View>

      {phaseHint || pmsPattern ? (
        <Pressable
          onPress={onInfo}
          disabled={!onInfo}
          accessibilityRole={onInfo ? 'button' : undefined}
          accessibilityLabel={onInfo ? `${phaseHint ?? ''}. ${ka.cycle.howCalculated}` : undefined}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, minHeight: 44, paddingHorizontal: 8 }}
        >
          {phaseHint ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: periodActive ? c.periodSoft : c.cardSoft }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: periodActive ? c.period : c.luteal }} />
              <Text numberOfLines={2} style={{ color: periodActive ? c.period : c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 17, flexShrink: 1 }}>
                {phaseHint}
              </Text>
              {onInfo ? <Info size={14} color={c.muted} strokeWidth={2} /> : null}
            </View>
          ) : null}
          {pmsPattern ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.cardSoft }}>
              <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17 }}>{ka.cycle.gaugePmsPattern}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
