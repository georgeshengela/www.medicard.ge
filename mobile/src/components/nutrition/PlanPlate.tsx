import React, { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMedifood } from "./ProgramUI";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The four meals as four arcs round a plate: breakfast at the top, clockwise. */
const SLOTS = 4;
const GAP = 14; // degrees between arcs

export type PlateSlot = "eaten" | "planned" | "empty";

function polar(c: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
}
function arc(c: number, r: number, from: number, to: number) {
  const a = polar(c, r, from),
    b = polar(c, r, to);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/**
 * MEDIFOOD's plate — the meal plan's one picture. Four arcs = the day's four meals:
 * - `still`: the slots as they are (eaten = emerald, planned = faded emerald, empty = track);
 * - `idle`: an invitation — a short emerald stroke travels round the empty plate (hub card);
 * - `compose`: the arcs draw one after another up to `filled` (the composing moment).
 * Reduce Motion: everything is drawn at once, nothing loops.
 */
export function PlanPlate({
  size = 120,
  slots = ["empty", "empty", "empty", "empty"],
  mode = "still",
  filled = 0,
  stroke = 10,
  children,
}: {
  size?: number;
  slots?: PlateSlot[];
  mode?: "still" | "idle" | "compose";
  /** compose: how many arcs are drawn (0–4). */
  filled?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const M = useMedifood();
  const reduce = usePrefersReducedMotion();
  const c = size / 2;
  const r = c - stroke / 2 - 2;
  const span = 360 / SLOTS - GAP;
  const length = (Math.PI * 2 * r * span) / 360;
  const inner = r - stroke / 2 - size * 0.08;

  // idle: one travelling highlight
  const spin = useSharedValue(0);
  useEffect(() => {
    if (mode !== "idle" || reduce) {
      cancelAnimation(spin);
      spin.value = 0;
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: 5200, easing: Easing.inOut(Easing.cubic) }), -1, false);
    return () => cancelAnimation(spin);
  }, [mode, reduce, spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  // compose: a gentle breath on the plate while the arcs draw
  const breath = useSharedValue(1);
  useEffect(() => {
    if (mode !== "compose" || reduce || filled >= SLOTS) {
      cancelAnimation(breath);
      breath.value = withTiming(1, { duration: 240 });
      return;
    }
    breath.value = withRepeat(withSequence(withTiming(1.035, { duration: 650 }), withTiming(1, { duration: 650 })), -1, false);
    return () => cancelAnimation(breath);
  }, [mode, reduce, filled, breath]);
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  const colorOf = (slot: PlateSlot) => (slot === "eaten" ? M.ink : slot === "planned" ? `${M.ink}66` : M.c.bg200);
  return (
    <Animated.View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, breathStyle]}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {/* the plate: a soft disc and its rim */}
        <Circle cx={c} cy={c} r={inner} fill={M.inkSoft} />
        <Circle cx={c} cy={c} r={inner - size * 0.07} fill={M.c.surface} stroke={`${M.ink}22`} strokeWidth={1} />
        {Array.from({ length: SLOTS }, (_, i) => {
          const from = i * (360 / SLOTS) + GAP / 2;
          const d = arc(c, r, from, from + span);
          return (
            <React.Fragment key={i}>
              <Path d={d} stroke={M.c.bg200} strokeWidth={stroke} strokeLinecap="round" fill="none" />
              {mode === "compose" ? (
                <ComposeArc d={d} length={length} drawn={i < filled} delay={0} stroke={stroke} color={M.ink} reduce={reduce} />
              ) : mode === "still" && slots[i] !== "empty" ? (
                <Path d={d} stroke={colorOf(slots[i])} strokeWidth={stroke} strokeLinecap="round" fill="none" />
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
      {mode === "idle" && !reduce ? (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size }, spinStyle]}>
          <Svg width={size} height={size}>
            <Path d={arc(c, r, GAP / 2, GAP / 2 + span * 0.55)} stroke={M.ink} strokeWidth={stroke} strokeLinecap="round" fill="none" opacity={0.9} />
          </Svg>
        </Animated.View>
      ) : mode === "idle" ? (
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Path d={arc(c, r, GAP / 2, GAP / 2 + span)} stroke={M.ink} strokeWidth={stroke} strokeLinecap="round" fill="none" />
        </Svg>
      ) : null}
      <View style={{ alignItems: "center", justifyContent: "center" }}>{children}</View>
    </Animated.View>
  );
}

function ComposeArc({ d, length, drawn, delay, stroke, color, reduce }: { d: string; length: number; drawn: boolean; delay: number; stroke: number; color: string; reduce: boolean }) {
  const shown = useSharedValue(drawn ? 1 : 0);
  useEffect(() => {
    shown.value = reduce ? (drawn ? 1 : 0) : withDelay(delay, withTiming(drawn ? 1 : 0, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [drawn, delay, reduce, shown]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - shown.value) }));
  return <AnimatedPath d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${length} ${length}`} animatedProps={props} />;
}
