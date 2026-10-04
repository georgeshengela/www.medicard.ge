import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useIsFocused } from 'expo-router';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useScrollLock } from '@/components/ui/LockableScrollView';
import { scrubHaptics } from '@/lib/scrubHaptics';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { tx } from '@/i18n/locale';
import { waveDayAt, waveHeightAt, type CycleWaveModel, type WavePhase } from '@/lib/home/cycleWave';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** anime.js-style easings, run on the UI thread (anime.js itself drives the DOM, not native views). */
const OUT_SOFT = Easing.bezier(0.22, 1, 0.36, 1);
const OUT_TEXT = Easing.out(Easing.cubic);
/** The pearl rides the wave for this long; everything else is timed around it. */
const DRAW_MS = 1300;
const DRAW_DELAY = 160;
/** Delay between neighbouring day dots as they ripple out from today. */
const DOT_STAGGER = 26;

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
/** A still finger takes the wave after this long; a sideways move takes it at once, a vertical one scrolls. */
const TAKE_MS = 170;
const SLOP = 8;

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

  const focused = useIsFocused();
  /** Intro timeline, 0 → 1 (the dots run in day units, see `dotsTo`); final values when motion is reduced. */
  const draw = useSharedValue(0);
  const fill = useSharedValue(0);
  const dotsT = useSharedValue(0);
  const ahead = useSharedValue(0);
  /** The bloom when the pearl lands, then one slow breathing ring. */
  const bloom = useSharedValue(0);
  const breath = useSharedValue(0);
  const enterRef = useRef(true);

  useEffect(
    () => () => {
      if (holdRef.current) clearTimeout(holdRef.current);
      clearTake();
      setLocked(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const xOf = (t: number, w = width) => PAD_X + (t / model.span) * (w - PAD_X * 2);
  const yOf = (t: number) => BASE - waveHeightAt(model, t) * (BASE - TOP);

  const todayRef = useRef<number | null>(null);
  todayRef.current = model.todayT != null ? Math.round(model.todayT + 0.5) : null;
  /** A tick on every new day, a firmer one on today. */
  const setScrubDay = (d: number | null, silent = false) => {
    if (d === scrubRef.current) return;
    scrubRef.current = d;
    setScrub(d);
    if (d == null || silent) return;
    if (d === todayRef.current) scrubHaptics.landmark();
    else scrubHaptics.tick();
  };
  // The wave spans the page, so it must not swallow page scrolls: it takes the finger only after a
  // sideways move or a short still hold, and then pauses the page's scroll until release.
  const lockScroll = useScrollLock();
  const lockedRef = useRef(false);
  const setLocked = (on: boolean) => {
    if (lockedRef.current === on) return;
    lockedRef.current = on;
    lockScroll(on);
  };
  const touch = useRef({ active: false, abandoned: false, x: 0, take: null as ReturnType<typeof setTimeout> | null });
  const clearTake = () => {
    if (touch.current.take) clearTimeout(touch.current.take);
    touch.current.take = null;
  };
  const take = () => {
    const g = touch.current;
    if (g.active || g.abandoned) return;
    clearTake();
    g.active = true;
    setLocked(true);
    scrubHaptics.grab();
    setScrubDay(dayAt(g.x), true);
  };
  const dayAt = (x: number) => {
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
        // Until the wave has taken the finger, the page's scroll may have it.
        onPanResponderTerminationRequest: () => !touch.current.active,
        onShouldBlockNativeResponder: () => false,
        onPanResponderGrant: (e) => {
          if (holdRef.current) clearTimeout(holdRef.current);
          const g = touch.current;
          g.active = false;
          g.abandoned = false;
          g.x = e.nativeEvent.locationX;
          clearTake();
          g.take = setTimeout(take, TAKE_MS);
        },
        onPanResponderMove: (e, gs) => {
          const g = touch.current;
          g.x = e.nativeEvent.locationX;
          if (g.active) {
            setScrubDay(dayAt(g.x));
            return;
          }
          if (g.abandoned) return;
          if (Math.abs(gs.dx) > SLOP && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2) take();
          else if (Math.abs(gs.dy) > SLOP) {
            g.abandoned = true;
            clearTake();
          }
        },
        onPanResponderRelease: () => {
          const g = touch.current;
          clearTake();
          if (!g.active && !g.abandoned) setScrubDay(dayAt(g.x)); // a tap shows that day
          g.active = false;
          setLocked(false);
          if (scrubRef.current != null) holdRef.current = setTimeout(() => setScrubDay(null), HOLD_MS);
        },
        onPanResponderTerminate: () => {
          const g = touch.current;
          clearTake();
          const wasActive = g.active;
          g.active = false;
          g.abandoned = true;
          setLocked(false);
          if (wasActive) setScrubDay(null);
        },
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
    // The lived run as its own polyline (day 0 → today) with cumulative lengths: the line draws itself
    // along it and the pearl rides it (anime.js `createDrawable` + `createMotionPath`, done natively).
    const lx: number[] = [];
    const ly: number[] = [];
    if (model.todayT != null) {
      for (const p of model.points) {
        if (p.t >= model.todayT) break;
        lx.push(xOf(p.t));
        ly.push(yOf(p.t));
      }
      lx.push(xOf(model.todayT));
      ly.push(yOf(model.todayT));
    }
    const cum = lx.map(() => 0);
    for (let i = 1; i < lx.length; i += 1) cum[i] = cum[i - 1] + Math.hypot(lx[i] - lx[i - 1], ly[i] - ly[i - 1]);
    const livedLen = cum[cum.length - 1] ?? 0;
    const livedLine = lx.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ly[i].toFixed(1)}`).join(' ');
    const livedArea = lx.length > 1 ? `${livedLine} L${lx[lx.length - 1].toFixed(1)},${BASE} L${lx[0].toFixed(1)},${BASE} Z` : '';
    return { line, area, stops, lx, ly, cum, livedLen, livedLine, livedArea };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, model, c]);

  const todayDay = model.todayT != null ? Math.round(model.todayT + 0.5) : 1;
  const dotsTo = model.dots.reduce((m, d) => Math.max(m, Math.abs(d.day - todayDay)), 0) + 1;
  const ready = geometry != null;

  // The intro plays once per mount, as soon as the wave has a width; a data refresh never replays it.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!alive) return;
        if (reduced) {
          enterRef.current = false;
          draw.value = 1;
          fill.value = 1;
          dotsT.value = 999;
          ahead.value = 1;
          bloom.value = 1;
          return;
        }
        draw.value = withDelay(DRAW_DELAY, withTiming(1, { duration: DRAW_MS, easing: OUT_SOFT }));
        fill.value = withDelay(DRAW_DELAY + 260, withTiming(1, { duration: DRAW_MS, easing: OUT_TEXT }));
        dotsT.value = withDelay(
          DRAW_DELAY + 520,
          withSequence(withTiming(dotsTo, { duration: dotsTo * DOT_STAGGER + 260, easing: Easing.linear }), withTiming(999, { duration: 0 })),
        );
        ahead.value = withDelay(DRAW_DELAY + DRAW_MS * 0.7, withTiming(1, { duration: 700, easing: OUT_TEXT }));
        bloom.value = withDelay(DRAW_DELAY + DRAW_MS * 0.82, withTiming(1, { duration: 1100, easing: OUT_SOFT }));
      });
    const t = setTimeout(() => {
      enterRef.current = false;
    }, 1400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // One thin ring breathing out from today, only while Home is on screen and motion is allowed.
  useEffect(() => {
    if (reduceMotion || !focused) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    breath.value = 0;
    breath.value = withDelay(DRAW_DELAY + DRAW_MS + 900, withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion, focused]);

  const LX = geometry?.lx ?? EMPTY;
  const LY = geometry?.ly ?? EMPTY;
  const CUM = geometry?.cum ?? EMPTY;
  const LEN = geometry?.livedLen ?? 0;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: (1 - draw.value) * (LEN + 2) }), [LEN]);
  const fillProps = useAnimatedProps(() => ({ fillOpacity: fill.value * (dark ? 0.42 : 0.38) }), [dark]);
  const aheadLineProps = useAnimatedProps(() => ({ opacity: ahead.value }));
  const aheadFillProps = useAnimatedProps(() => ({ fillOpacity: ahead.value * (dark ? 0.09 : 0.1) }), [dark]);
  const pearlProps = useAnimatedProps(() => {
    const at = pointAlong(LX, LY, CUM, draw.value * LEN);
    return { cx: at.x, cy: at.y };
  }, [LX, LY, CUM, LEN]);
  // The landing bloom: one thin ring opening like a petal, then gone.
  const bloomProps = useAnimatedProps(() => {
    const k = bloom.value;
    const at = pointAlong(LX, LY, CUM, LEN);
    return { cx: at.x, cy: at.y, r: 7 + k * 20, strokeOpacity: k > 0 && k < 1 ? (1 - k) * 0.7 : 0 };
  }, [LX, LY, CUM, LEN]);
  const breathProps = useAnimatedProps(() => {
    const k = 1 - (1 - breath.value) * (1 - breath.value);
    const at = pointAlong(LX, LY, CUM, LEN);
    return { cx: at.x, cy: at.y, r: 8 + k * 13, strokeOpacity: breath.value > 0 ? (1 - k) * 0.5 : 0 };
  }, [LX, LY, CUM, LEN]);

  const todayX = model.todayT != null && width ? xOf(model.todayT) : null;
  const enter = enterRef.current;
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
            <Animated.Text
              entering={enter ? FadeInDown.duration(560).easing(OUT_TEXT) : undefined}
              numberOfLines={1}
              style={[s.caption, { color: c.muted }]}
            >
              {shown.top}
            </Animated.Text>
          ) : null}
          {/* A finger on the wave swaps the number with a short fade; the intro lifts it in. */}
          <Animated.View
            key={`${shown.value}|${shown.unit ?? ''}`}
            entering={enter ? FadeInDown.delay(90).duration(600).easing(OUT_TEXT) : FadeIn.duration(180)}
            style={s.valueRow}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[s.value, { color: valueColor, fontSize: big, lineHeight: Math.round(big * 1.1) }]}
            >
              {shown.value}
            </Text>
            {shown.unit ? <Text style={[s.unit, { color: valueColor }]}>{shown.unit}</Text> : null}
          </Animated.View>
          {shown.sub ? (
            <Animated.Text
              entering={enter ? FadeInDown.delay(180).duration(600).easing(OUT_TEXT) : undefined}
              numberOfLines={2}
              style={[s.sub, { color: c.muted }]}
            >
              {shown.sub}
            </Animated.Text>
          ) : null}
        </View>
        {leaf && scrub == null ? (
          <Animated.View entering={enter ? FadeIn.delay(DRAW_DELAY + DRAW_MS * 0.75).duration(600) : FadeIn.duration(200)}>
            <Leaf leaf={leaf} />
          </Animated.View>
        ) : null}
      </Pressable>

      <View
        onLayout={onLayout}
        style={s.wave}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...pan.panHandlers}
      >
        {geometry ? (
          <Svg width={width} height={H} pointerEvents="none">
            <Defs>
              <SvgGradient id="cwPhase" x1={xOf(0)} y1={0} x2={xOf(model.span)} y2={0} gradientUnits="userSpaceOnUse">
                {geometry.stops.map((st, i) => (
                  <Stop key={i} offset={st.offset} stopColor={st.color} />
                ))}
              </SvgGradient>
              <ClipPath id="cwAhead">
                <Rect x={todayX ?? 0} y={0} width={width} height={H} />
              </ClipPath>
            </Defs>

            {/* A variable cycle's whole start window, as a dashed rose run on the floor. */}
            {model.windowT ? (
              <AnimatedRect
                animatedProps={aheadLineProps}
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
              <AnimatedPath d={geometry.area} fill="url(#cwPhase)" animatedProps={aheadFillProps} />
              <AnimatedPath
                d={geometry.line}
                stroke="url(#cwPhase)"
                strokeWidth={2}
                strokeDasharray="1 5"
                strokeLinecap="round"
                fill="none"
                animatedProps={aheadLineProps}
              />
            </G>
            {/* The lived part draws itself from day 1 to today like a silk thread; its fill follows softly. */}
            {geometry.livedArea ? <AnimatedPath d={geometry.livedArea} fill="url(#cwPhase)" animatedProps={fillProps} /> : null}
            {geometry.livedLine ? (
              <AnimatedPath
                d={geometry.livedLine}
                stroke="url(#cwPhase)"
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={[geometry.livedLen + 2, geometry.livedLen + 2]}
                animatedProps={lineProps}
              />
            ) : null}

            {/* One dot per cycle day: lived filled, ahead hollow, logged bleeding rose. */}
            {/* The day dots ripple out from today (anime.js `stagger(…, { from })`). */}
            {model.dots.map((d) => {
              const x = xOf(d.day - 0.5);
              const dist = Math.abs(d.day - todayDay);
              if (d.bleed) return <DayDot key={d.day} t={dotsT} dist={dist} cx={x} r={2.6} fill={c.period} />;
              if (d.state === 'ahead')
                return <DayDot key={d.day} t={dotsT} dist={dist} cx={x} r={1.9} fill="none" stroke={c.mutedSoft} opacity={0.7} />;
              return (
                <DayDot key={d.day} t={dotsT} dist={dist} cx={x} r={d.state === 'today' ? 2.6 : 1.9} fill={d.state === 'today' ? c.ink : c.mutedSoft} />
              );
            })}

            {model.dropT != null && !model.windowT ? <Drop x={xOf(model.dropT)} y={BASE - 4} color={c.period} dark={dark} t={ahead} /> : null}

            {scrubX != null && scrub != null ? (
              <G>
                <Path d={`M${scrubX},${TOP - 8} L${scrubX},${DOTS_Y - 5}`} stroke={c.ink} strokeOpacity={0.35} strokeWidth={1} />
                <Circle cx={scrubX} cy={yOf(scrub - 0.5)} r={5.5} fill={c.ink} />
              </G>
            ) : null}

            {todayX != null && model.todayT != null ? (
              <G opacity={scrub != null ? 0.45 : 1}>
                <AnimatedCircle fill="none" stroke={tone} strokeWidth={1.2} animatedProps={breathProps} />
                <AnimatedCircle fill="none" stroke={tone} strokeWidth={1.4} animatedProps={bloomProps} />
                <AnimatedCircle r={7} fill={dark ? c.ink : '#FFFFFF'} stroke={tone} strokeWidth={3} animatedProps={pearlProps} />
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

const EMPTY: number[] = [];

/** A point at distance `at` along a polyline with cumulative lengths `cum` (worklet). */
function pointAlong(xs: number[], ys: number[], cum: number[], at: number): { x: number; y: number } {
  'worklet';
  const n = xs.length;
  if (n === 0) return { x: -40, y: -40 };
  if (n === 1 || at <= 0) return { x: xs[0], y: ys[0] };
  let i = 1;
  while (i < n - 1 && cum[i] < at) i += 1;
  const seg = cum[i] - cum[i - 1] || 1;
  const f = Math.min(1, Math.max(0, (at - cum[i - 1]) / seg));
  return { x: xs[i - 1] + (xs[i] - xs[i - 1]) * f, y: ys[i - 1] + (ys[i] - ys[i - 1]) * f };
}

/** A rose drop outline whose round bottom rests at `y` (worklet). */
function dropPath(x: number, y: number): string {
  'worklet';
  const h = 18;
  const w = 13;
  const top = y - h;
  return `M${x},${top} C${x + w * 0.2},${top + h * 0.3} ${x + w / 2},${top + h * 0.5} ${x + w / 2},${top + h * 0.7} A${w / 2},${w / 2} 0 1 1 ${x - w / 2},${top + h * 0.7} C${x - w / 2},${top + h * 0.5} ${x - w * 0.2},${top + h * 0.3} ${x},${top} Z`;
}

/** One day dot that pops in when the ripple from today reaches it (a soft back-out, like anime.js `outBack`). */
function DayDot({
  t,
  dist,
  cx,
  r,
  fill,
  stroke,
  opacity,
}: {
  t: SharedValue<number>;
  dist: number;
  cx: number;
  r: number;
  fill: string;
  stroke?: string;
  opacity?: number;
}) {
  const props = useAnimatedProps(() => {
    const k = Math.min(1, Math.max(0, (t.value - dist) / 2.2));
    const b = k - 1;
    const eased = k >= 1 ? 1 : 1 + 2.4 * b * b * b + 1.4 * b * b;
    return { r: r * Math.max(0, eased) };
  }, [dist, r]);
  return (
    <AnimatedCircle cx={cx} cy={DOTS_Y} fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} opacity={opacity} animatedProps={props} />
  );
}

/** A small rose drop, dashed and pale: the expected start, not a logged one. It drips into place once. */
function Drop({ x, y, color, dark, t }: { x: number; y: number; color: string; dark: boolean; t: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ d: dropPath(x, y - (1 - t.value) * 10), opacity: t.value }), [x, y]);
  return (
    <AnimatedPath
      d={dropPath(x, y)}
      fill={cycleHexAlpha(color, dark ? 0.24 : 0.14)}
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray="2.5 2"
      animatedProps={props}
    />
  );
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

/** Loader height: about the wave stage's own, so nothing jumps when the cycle arrives. */
const LOADER_H = 236;
const LOADER_WAVE_H = 96;

/**
 * While the cycle loads (Flo-like, owner 2026-10-05): one thin rose thread flows along a soft hill —
 * its head draws forward with a pearl on it, its tail follows and lets go — on the stage's own
 * blush card. One calm loop, nothing else; a still thread when motion is reduced.
 */
export function CycleWaveLoader({ label }: { label: string }) {
  const dark = useIsDark();
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const flow = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !focused) {
      cancelAnimation(flow);
      flow.value = 0.5;
      return;
    }
    flow.value = 0;
    flow.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(flow);
  }, [flow, reduceMotion, focused]);

  const path = useMemo(() => {
    if (!width) return null;
    const xs: number[] = [];
    const ys: number[] = [];
    const left = 24;
    const right = width - 24;
    const base = LOADER_WAVE_H - 14;
    const top = 14;
    const steps = 64;
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      // A calm hill with a gentle shoulder: no peak that could read as a forecast.
      const v = 0.12 + 0.62 * Math.exp(-((u - 0.52) ** 2) / (2 * 0.2 * 0.2)) + 0.14 * Math.exp(-((u - 0.18) ** 2) / (2 * 0.09 * 0.09));
      xs.push(left + u * (right - left));
      ys.push(base - Math.min(1, v) * (base - top));
    }
    const cum = xs.map(() => 0);
    for (let i = 1; i < xs.length; i += 1) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const len = cum[cum.length - 1];
    const d = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    return { xs, ys, cum, len, d };
  }, [width]);

  const XS = path?.xs ?? EMPTY;
  const YS = path?.ys ?? EMPTY;
  const CUM = path?.cum ?? EMPTY;
  const LEN = path?.len ?? 0;
  const still = reduceMotion;
  // Head leads, tail follows 38 % later: the thread is drawn, then let go, and the loop meets itself at 0.
  const threadProps = useAnimatedProps(() => {
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const head = still ? 1 : ease(Math.min(1, Math.max(0, flow.value / 0.62)));
    const tail = still ? 0 : ease(Math.min(1, Math.max(0, (flow.value - 0.38) / 0.62)));
    const visible = Math.max(0.001, (head - tail) * LEN);
    return { strokeDasharray: [visible, LEN * 2 + 4], strokeDashoffset: -tail * LEN };
  }, [LEN, still]);
  const pearlProps = useAnimatedProps(() => {
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const head = ease(Math.min(1, Math.max(0, flow.value / 0.62)));
    const tail = ease(Math.min(1, Math.max(0, (flow.value - 0.38) / 0.62)));
    const at = pointAlong(XS, YS, CUM, head * LEN);
    return { cx: at.x, cy: at.y, opacity: still ? 0 : Math.min(1, (head - tail) * 6) };
  }, [XS, YS, CUM, LEN, still]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[s.stage, s.loader, { backgroundColor: c.cardSoft }]}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w !== width) setWidth(w);
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[cycleHexAlpha(c.period, dark ? 0.2 : 0.14), cycleHexAlpha(c.period, dark ? 0.06 : 0.04), cycleHexAlpha(c.period, 0)]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.loaderHead}>
        <View style={[s.loaderBone, { width: 96, height: 12, backgroundColor: cycleHexAlpha(c.muted, 0.14) }]} />
        <View style={[s.loaderBone, { width: 132, height: 40, borderRadius: 14, backgroundColor: cycleHexAlpha(c.muted, 0.1) }]} />
      </View>
      {path ? (
        <Svg width={width} height={LOADER_WAVE_H}>
          <Path d={path.d} stroke={cycleHexAlpha(c.period, dark ? 0.16 : 0.12)} strokeWidth={1.5} strokeDasharray="1 5" strokeLinecap="round" fill="none" />
          <AnimatedPath d={path.d} stroke={c.period} strokeOpacity={0.8} strokeWidth={2} strokeLinecap="round" fill="none" animatedProps={threadProps} />
          <AnimatedCircle r={4.5} fill={dark ? c.ink : '#FFFFFF'} stroke={c.period} strokeWidth={2} animatedProps={pearlProps} />
        </Svg>
      ) : (
        <View style={{ height: LOADER_WAVE_H }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loader: { height: LOADER_H, justifyContent: 'space-between' },
  loaderHead: { paddingHorizontal: 18, gap: 10 },
  loaderBone: { borderRadius: 6 },
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
