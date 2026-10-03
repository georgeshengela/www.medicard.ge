import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { tx } from '@/i18n/locale';
import { waveDayAt, waveHeightAt, type CycleWaveModel, type WavePhase } from '@/lib/home/cycleWave';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The words of the answer: one caption, one number (or word) with its unit, one line under it. */
export type WaveAnswer = { top: string | null; value: string; unit: string | null; sub: string | null; tone?: 'period' | 'ink' };

/** The expected start as a small calendar leaf, dashed like an estimated day in the calendar. */
export type WaveLeaf = { kind: 'day'; weekday: string; day: number; month: string } | { kind: 'range'; from: string; to: string };

const H = 108;
const PAD_X = 12;
const TOP = 18;
const BASE = H - 24;
const DOTS_Y = BASE + 12;
/** How long a finger's preview stays after release, so a tap can be read. */
const HOLD_MS = 2600;

/**
 * „ციკლის ტალღა“ — the women's Home answer (owner 2026-10-03, replacing the plain centred glow):
 * the countdown left-aligned in a light large numeral with the expected start as a dashed calendar
 * leaf, then the whole cycle as one wave in the dial's phase colours (lived = full, ahead = dashed
 * and pale, the calendar's estimate grammar), today a breathing pearl, the expected period a dashed
 * rose drop (or the whole window for a variable cycle), and one dot per day underneath (logged
 * bleeding rose). Sliding a finger along the wave previews that day's date and phase.
 */
export function CycleWaveStage({
  model,
  tone,
  answer,
  leaf,
  title,
  detail,
  describeDay,
  a11yLabel,
  onOpen,
}: {
  model: CycleWaveModel;
  tone: string;
  answer: WaveAnswer;
  leaf: WaveLeaf | null;
  title: string;
  detail: string | null;
  describeDay: (day: number) => WaveAnswer | null;
  /** The whole answer for screen readers (the wave itself is hidden from them). */
  a11yLabel: string;
  /** Tapping the words opens the cycle screen; the wave keeps its touches for the preview. */
  onOpen: () => void;
}) {
  const theme = useThemeColors();
  const dark = useIsDark();
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const scrubRef = useRef<number | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const widthRef = useRef(0);
  const modelRef = useRef(model);
  modelRef.current = model;

  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath, reduceMotion]);
  const haloProps = useAnimatedProps(() => ({ r: 11 + breath.value * 5, opacity: 0.34 - breath.value * 0.2 }));

  useEffect(() => () => {
    if (holdRef.current) clearTimeout(holdRef.current);
  }, []);

  const xOf = (t: number, w = width) => PAD_X + (t / model.span) * (w - PAD_X * 2);
  const yOf = (t: number) => BASE - waveHeightAt(model, t) * (BASE - TOP);

  const setScrubDay = (d: number | null) => {
    if (d === scrubRef.current) return;
    scrubRef.current = d;
    setScrub(d);
    if (d != null) Haptics.selectionAsync().catch(() => undefined);
  };
  const dayAtX = (x: number) => {
    const w = widthRef.current;
    const m = modelRef.current;
    if (!w) return null;
    return waveDayAt(m, ((x - PAD_X) / (w - PAD_X * 2)) * m.span);
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          if (holdRef.current) clearTimeout(holdRef.current);
          setScrubDay(dayAtX(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => setScrubDay(dayAtX(e.nativeEvent.locationX)),
        onPanResponderRelease: () => {
          holdRef.current = setTimeout(() => setScrubDay(null), HOLD_MS);
        },
        onPanResponderTerminate: () => setScrubDay(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const shown = (scrub != null ? describeDay(scrub) : null) ?? answer;
  const valueColor = shown.tone === 'period' ? c.period : c.ink;
  const big = shown.value.length > 3 ? 44 : shown.value.length > 2 ? 52 : 64;

  const phaseColor = (kind: WavePhase['kind']) =>
    kind === 'period' || kind === 'next'
      ? c.period
      : kind === 'fertile'
        ? c.fertileFill
        : kind === 'luteal'
          ? c.luteal
          : c.follicularFill;

  const geometry = useMemo(() => {
    if (!width) return null;
    const line = model.points.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.t).toFixed(1)},${yOf(p.t).toFixed(1)}`).join(' ');
    const area = `${line} L${xOf(model.span).toFixed(1)},${BASE} L${xOf(0).toFixed(1)},${BASE} Z`;
    // Soft blends at each phase edge, a solid run in between.
    const stops: { offset: number; color: string }[] = [];
    const blend = Math.min(0.6, model.span / 60);
    for (const p of model.phases) {
      const color = phaseColor(p.kind);
      stops.push({ offset: Math.min(p.from + blend, p.to) / model.span, color });
      stops.push({ offset: Math.max(p.to - blend, p.from) / model.span, color });
    }
    return { line, area, stops };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, model, c]);

  const todayX = model.todayT != null && width ? xOf(model.todayT) : null;
  const scrubX = scrub != null && width ? xOf(scrub - 0.5) : null;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    widthRef.current = w;
    if (w !== width) setWidth(w);
  };

  return (
    <View style={[s.stage, { backgroundColor: c.cardSoft }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[cycleHexAlpha(tone, dark ? 0.26 : 0.2), cycleHexAlpha(tone, dark ? 0.08 : 0.05), cycleHexAlpha(tone, 0)]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={a11yLabel} onPress={onOpen} style={s.head}>
        <View style={s.answer}>
          {shown.top ? (
            <Text numberOfLines={1} style={[s.caption, { color: c.muted }]}>
              {shown.top}
            </Text>
          ) : null}
          <View style={s.valueRow}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[s.value, { color: valueColor, fontSize: big, lineHeight: Math.round(big * 1.1) }]}
            >
              {shown.value}
            </Text>
            {shown.unit ? <Text style={[s.unit, { color: valueColor }]}>{shown.unit}</Text> : null}
          </View>
          {shown.sub ? (
            <Text numberOfLines={2} style={[s.sub, { color: c.muted }]}>
              {shown.sub}
            </Text>
          ) : null}
        </View>
        {leaf && scrub == null ? <Leaf leaf={leaf} /> : null}
      </Pressable>

      <View
        onLayout={onLayout}
        style={s.wave}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...pan.panHandlers}
      >
        {geometry ? (
          <Svg width={width} height={H}>
            <Defs>
              <SvgGradient id="cwPhase" x1={xOf(0)} y1={0} x2={xOf(model.span)} y2={0} gradientUnits="userSpaceOnUse">
                {geometry.stops.map((st, i) => (
                  <Stop key={i} offset={st.offset} stopColor={st.color} />
                ))}
              </SvgGradient>
              <ClipPath id="cwLived">
                <Rect x={0} y={0} width={todayX ?? 0} height={H} />
              </ClipPath>
              <ClipPath id="cwAhead">
                <Rect x={todayX ?? 0} y={0} width={width} height={H} />
              </ClipPath>
            </Defs>

            {/* A variable cycle's whole start window, as a dashed rose run on the floor. */}
            {model.windowT ? (
              <Rect
                x={xOf(model.windowT.from)}
                y={BASE - 9}
                width={Math.max(8, xOf(model.windowT.to) - xOf(model.windowT.from))}
                height={18}
                rx={9}
                fill={cycleHexAlpha(c.period, dark ? 0.18 : 0.1)}
                stroke={c.period}
                strokeWidth={1.4}
                strokeDasharray="3 3"
              />
            ) : null}

            <G clipPath="url(#cwAhead)">
              <Path d={geometry.area} fill="url(#cwPhase)" fillOpacity={dark ? 0.09 : 0.1} />
              <Path d={geometry.line} stroke="url(#cwPhase)" strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" fill="none" />
            </G>
            <G clipPath="url(#cwLived)">
              <Path d={geometry.area} fill="url(#cwPhase)" fillOpacity={dark ? 0.42 : 0.38} />
              <Path d={geometry.line} stroke="url(#cwPhase)" strokeWidth={3} strokeLinecap="round" fill="none" />
            </G>

            {/* One dot per cycle day: lived filled, ahead hollow, logged bleeding rose. */}
            {model.dots.map((d) => {
              const x = xOf(d.day - 0.5);
              if (d.bleed) return <Circle key={d.day} cx={x} cy={DOTS_Y} r={2.6} fill={c.period} />;
              if (d.state === 'ahead')
                return <Circle key={d.day} cx={x} cy={DOTS_Y} r={1.9} fill="none" stroke={c.mutedSoft} strokeWidth={1} opacity={0.7} />;
              return <Circle key={d.day} cx={x} cy={DOTS_Y} r={d.state === 'today' ? 2.6 : 1.9} fill={d.state === 'today' ? c.ink : c.mutedSoft} />;
            })}

            {model.dropT != null && !model.windowT ? <Drop x={xOf(model.dropT)} y={BASE - 4} color={c.period} dark={dark} /> : null}

            {scrubX != null && scrub != null ? (
              <G>
                <Path d={`M${scrubX},${TOP - 8} L${scrubX},${DOTS_Y - 5}`} stroke={c.ink} strokeOpacity={0.35} strokeWidth={1} />
                <Circle cx={scrubX} cy={yOf(scrub - 0.5)} r={5.5} fill={c.ink} />
              </G>
            ) : null}

            {todayX != null && model.todayT != null ? (
              <G opacity={scrub != null ? 0.45 : 1}>
                <AnimatedCircle cx={todayX} cy={yOf(model.todayT)} fill={tone} animatedProps={haloProps} />
                <Circle cx={todayX} cy={yOf(model.todayT)} r={7} fill={dark ? c.ink : '#FFFFFF'} stroke={tone} strokeWidth={3} />
              </G>
            ) : null}
          </Svg>
        ) : (
          <View style={{ height: H }} />
        )}
      </View>

      <Pressable accessible={false} onPress={onOpen} style={s.foot}>
        <View style={s.phaseRow}>
          <View style={[s.phaseDot, { backgroundColor: tone }]} />
          <Text numberOfLines={2} style={[s.phaseText, { color: c.ink }]}>
            {title}
          </Text>
        </View>
        {detail ? <Text style={[s.detail, { color: theme.text200 }]}>{detail}</Text> : null}
        <Text style={[s.hint, { color: c.mutedSoft }]}>{tx('გადაატარე თითი — ნახე ნებისმიერი დღე', 'Slide to see any day')}</Text>
      </Pressable>
    </View>
  );
}

/** A small rose drop, dashed and pale: the expected start, not a logged one. */
function Drop({ x, y, color, dark }: { x: number; y: number; color: string; dark: boolean }) {
  const h = 18;
  const w = 13;
  const top = y - h;
  const d = `M${x},${top} C${x + w * 0.2},${top + h * 0.3} ${x + w / 2},${top + h * 0.5} ${x + w / 2},${top + h * 0.7} A${w / 2},${w / 2} 0 1 1 ${x - w / 2},${top + h * 0.7} C${x - w / 2},${top + h * 0.5} ${x - w * 0.2},${top + h * 0.3} ${x},${top} Z`;
  return <Path d={d} fill={cycleHexAlpha(color, dark ? 0.24 : 0.14)} stroke={color} strokeWidth={1.5} strokeDasharray="2.5 2" />;
}

function Leaf({ leaf }: { leaf: WaveLeaf }) {
  const c = useCycleColors();
  const dark = useIsDark();
  return (
    <View style={[s.leaf, { borderColor: c.period, backgroundColor: cycleHexAlpha(c.period, dark ? 0.12 : 0.06) }]}>
      {leaf.kind === 'day' ? (
        <>
          <Text style={[s.leafSmall, { color: c.muted }]}>{leaf.weekday}</Text>
          <Text style={[s.leafDay, { color: c.period }]}>{leaf.day}</Text>
          <Text style={[s.leafSmall, { color: c.muted }]}>{leaf.month}</Text>
        </>
      ) : (
        <>
          <Text style={[s.leafRange, { color: c.period }]}>{leaf.from}</Text>
          <Text style={[s.leafSmall, { color: c.muted }]}>–</Text>
          <Text style={[s.leafRange, { color: c.period }]}>{leaf.to}</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  stage: { alignSelf: 'stretch', borderRadius: 20, overflow: 'hidden', paddingTop: 18, paddingBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, gap: 12 },
  answer: { flex: 1, minWidth: 0 },
  caption: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  value: { fontFamily: 'NotoSansGeorgian_400Regular', letterSpacing: -2, fontVariant: ['tabular-nums'], flexShrink: 1 },
  unit: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 20, lineHeight: 26 },
  sub: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, marginTop: 2 },
  leaf: {
    width: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: 7,
    marginTop: 4,
  },
  leafSmall: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15 },
  leafDay: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums'] },
  leafRange: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  wave: { marginTop: 6, alignSelf: 'stretch' },
  foot: { paddingHorizontal: 18, gap: 3, marginTop: 2 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phaseDot: { width: 9, height: 9, borderRadius: 5 },
  phaseText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  detail: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, paddingLeft: 17 },
  hint: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15, paddingLeft: 17, marginTop: 4 },
});
