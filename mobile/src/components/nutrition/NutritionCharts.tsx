import React, { useEffect, useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text,
  View,
  type TextProps,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Beef, Droplet, Leaf, Wheat } from "lucide-react-native";
import { useIsDark, useThemeColors } from "@/theme/colors";
import {
  nutritionDateLabel,
  type NutritionDay,
  type NutritionTargets,
  type NutritionTotals,
} from "@/lib/nutritionProgram";

function Label({ style, ...props }: TextProps) {
  const c = useThemeColors();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: "NotoSansGeorgian_400Regular",
          fontSize: 12,
          lineHeight: 19,
          color: c.text200,
        },
        style,
      ]}
    />
  );
}
const bold = "NotoSansGeorgian_600SemiBold";
function Reveal({ children }: { children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!mounted || reduce) return;
        progress.setValue(0);
        Animated.timing(progress, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }).start();
      })
      .catch(() => {});
    return () => {
      mounted = false;
      progress.stopAnimation();
    };
  }, [progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [5, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
function polar(cx: number, cy: number, radius: number, degrees: number) {
  const a = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}
function arc(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
) {
  const a = polar(cx, cy, radius, start),
    b = polar(cx, cy, radius, end);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/** Open-ended energy dial: the ring is progress only when a real target exists. */
export function EnergyRing({
  value,
  target,
}: {
  value: number;
  target: number | null;
}) {
  const c = useThemeColors(),
    dark = useIsDark();
  const ratio =
    target && target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  const id = "energy" + useId().replace(/[^a-z0-9]/gi, "");
  const end = polar(150, 127, 101, 140 + ratio * 260);
  const ink = dark ? "#72CABA" : "#168679";
  return (
    <Reveal>
      <View
        accessible
        accessibilityLabel={`${Math.round(value)} აღრიცხული კკალ${target ? `, დღის სამიზნე ${target} კკალ` : ", დღის სამიზნე ჯერ არჩეული არ არის"}`}
        style={{
          width: "100%",
          maxWidth: 300,
          aspectRatio: 300 / 252,
          alignSelf: "center",
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 300 252">
          <Defs>
            <LinearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={dark ? "#408F85" : "#0F766E"} />
              <Stop offset="1" stopColor={dark ? "#8AD5C7" : "#3EB6A0"} />
            </LinearGradient>
          </Defs>
          {Array.from({ length: 41 }, (_, i) => {
            const a = polar(150, 127, i % 5 === 0 ? 117 : 120, 140 + i * 6.5),
              b = polar(150, 127, 124, 140 + i * 6.5);
            return (
              <Line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={target && i / 40 <= ratio && value > 0 ? ink : c.bg300}
                strokeWidth={i % 5 === 0 ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          <Path
            d={arc(150, 127, 101, 140, 400)}
            fill="none"
            stroke={c.bg200}
            strokeWidth={13}
            strokeLinecap="round"
          />
          {ratio > 0 && (
            <>
              <Path
                d={arc(150, 127, 101, 140, 140 + ratio * 260)}
                fill="none"
                stroke={`url(#${id})`}
                strokeWidth={13}
                strokeLinecap="round"
              />
              <Circle cx={end.x} cy={end.y} r={4} fill={c.surface} />
            </>
          )}
          <Path
            d={arc(150, 127, 88, 140, 400)}
            fill="none"
            stroke={c.bg300}
            strokeOpacity={0.45}
            strokeWidth={0.7}
          />
        </Svg>
        <View
          style={{
            position: "absolute",
            top: "23%",
            left: 0,
            right: 0,
            alignItems: "center",
            gap: 3,
          }}
        >
          <Leaf size={19} color={ink} strokeWidth={1.7} />
          <Label style={{ fontSize: 11, marginTop: 2 }}>
            აღრიცხული ენერგია
          </Label>
          <Label
            style={{
              fontSize: 43,
              lineHeight: 55,
              color: c.text100,
              fontFamily: bold,
              fontVariant: ["tabular-nums"],
              letterSpacing: -1.5,
            }}
          >
            {Math.round(value).toLocaleString("en-US")}
          </Label>
          <Label style={{ fontSize: 11, lineHeight: 17 }}>კილოკალორია</Label>
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 4,
            left: 40,
            right: 40,
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: c.bg200,
            }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: ink,
              }}
            />
            <Label style={{ fontSize: 10, lineHeight: 16 }}>
              {target
                ? `${target} კკალ · დღის სამიზნე`
                : "შენი რიტმი, შენი ბალანსი"}
            </Label>
          </View>
        </View>
      </View>
    </Reveal>
  );
}

export function MacroRails({
  actual,
  target,
}: {
  actual: NutritionTotals;
  target: NutritionTargets | null;
}) {
  const c = useThemeColors(),
    dark = useIsDark();
  const colors = dark
    ? ["#80C6B6", "#B6A6D5", "#D3B38A"]
    : ["#267F70", "#7D66A5", "#996B37"];
  const icons = [Beef, Wheat, Droplet],
    names = ["ცილა", "ნახშირწყალი", "ცხიმი"];
  return (
    <View style={{ flexDirection: "row", paddingVertical: 9 }}>
      {(["protein", "carbs", "fat"] as const).map((key, i) => {
        const Icon = icons[i],
          goal = target?.[key] || 0,
          progress = goal ? Math.min(1, Math.max(0, actual[key] / goal)) : 0,
          circumference = 2 * Math.PI * 19;
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={`${names[i]}: ${Math.round(actual[key])} გრამი${goal ? `, სამიზნე ${goal} გრამი` : ""}`}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 3,
              borderLeftWidth: i ? 1 : 0,
              borderColor: c.bg300,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 3,
              }}
            >
              <Svg width={46} height={46} style={{ position: "absolute" }}>
                <Circle
                  cx={23}
                  cy={23}
                  r={19}
                  stroke={c.bg200}
                  strokeWidth={3}
                  fill="none"
                />
                {progress > 0 && (
                  <Circle
                    cx={23}
                    cy={23}
                    r={19}
                    stroke={colors[i]}
                    strokeWidth={3}
                    fill="none"
                    strokeDasharray={`${circumference * progress} ${circumference}`}
                    strokeLinecap="round"
                    transform="rotate(-90 23 23)"
                  />
                )}
              </Svg>
              <Icon color={colors[i]} size={19} strokeWidth={1.6} />
            </View>
            <Label style={{ fontSize: 10 }}>{names[i]}</Label>
            <Label
              style={{
                fontFamily: bold,
                fontSize: 16,
                lineHeight: 24,
                color: c.text100,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.round(actual[key])}
              <Label style={{ fontSize: 10 }}> გ</Label>
            </Label>
            {!!target && (
              <Label style={{ fontSize: 9, lineHeight: 15 }}>
                {goal} გ სამიზნე
              </Label>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function IntakeWeekChart({ days }: { days: NutritionDay[] }) {
  const c = useThemeColors(),
    dark = useIsDark();
  const [selected, setSelected] = useState(days.at(-1)?.date || "");
  const current = days.find((d) => d.date === selected) || days.at(-1);
  const max = Math.max(
    1,
    ...days.map((d) => Math.max(d.totals.calories, d.target?.calories || 0)),
  );
  const ink = dark ? "#80C6B6" : "#268E7F";
  if (!current) return null;
  return (
    <View style={{ gap: 18 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        <View style={{ gap: 3, flex: 1 }}>
          <Label>{nutritionDateLabel(current.date)}</Label>
          <Label
            style={{
              fontFamily: bold,
              fontSize: 32,
              lineHeight: 43,
              color: c.text100,
              fontVariant: ["tabular-nums"],
            }}
          >
            {current.recorded ? Math.round(current.totals.calories) : "—"}
            <Label> კკალ</Label>
          </Label>
        </View>
        <View style={{ alignItems: "flex-end", paddingBottom: 6, gap: 4 }}>
          <Label style={{ fontSize: 10 }}>
            {current.recorded
              ? `${current.mealCount} კვება აღრიცხული`
              : "ჩანაწერი არ არის"}
          </Label>
          <Label style={{ fontSize: 10 }}>
            {current.target
              ? `${current.target.calories} კკალ სამიზნე`
              : "სამიზნე არ იყო არჩეული"}
          </Label>
        </View>
      </View>
      <Reveal>
        <View style={{ position: "relative" }}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 160,
              justifyContent: "space-between",
            }}
          >
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  borderTopWidth: 1,
                  borderColor: c.bg300,
                  borderStyle: "dashed",
                  opacity: 0.55,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 3 }}>
            {days.map((d) => {
              const active = current.date === d.date;
              return (
                <Pressable
                  key={d.date}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${nutritionDateLabel(d.date)}: ${d.recorded ? d.totals.calories + " აღრიცხული კკალ" : "ჩანაწერი არ არის"}${d.target ? ", სამიზნე " + d.target.calories : ""}`}
                  onPress={() => setSelected(d.date)}
                  style={{
                    flex: 1,
                    minHeight: 210,
                    alignItems: "center",
                    paddingHorizontal: 3,
                    borderRadius: 12,
                    backgroundColor: active ? c.bg200 : "transparent",
                  }}
                >
                  <View
                    style={{
                      height: 160,
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    {d.recorded ? (
                      <View
                        style={{
                          width: "65%",
                          minWidth: 13,
                          height: Math.max(4, (d.totals.calories / max) * 148),
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                          borderBottomLeftRadius: 3,
                          borderBottomRightRadius: 3,
                          backgroundColor: ink,
                          opacity: active ? 1 : 0.6,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 10,
                          height: 3,
                          borderRadius: 2,
                          backgroundColor: c.text200,
                        }}
                      />
                    )}
                    {!!d.target && (
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          bottom: (d.target.calories / max) * 148,
                          width: "88%",
                          borderTopWidth: 2,
                          borderColor: c.text200,
                          borderStyle: "dashed",
                        }}
                      />
                    )}
                  </View>
                  <Label
                    style={{
                      fontSize: 9,
                      lineHeight: 17,
                      marginTop: 9,
                      color: active ? c.text100 : c.text200,
                    }}
                  >
                    {nutritionDateLabel(d.date, true)}
                  </Label>
                  <Label
                    style={{
                      fontSize: 10,
                      lineHeight: 17,
                      fontFamily: active ? bold : undefined,
                    }}
                  >
                    {Number(d.date.slice(8))}
                  </Label>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Reveal>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 15 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              height: 7,
              width: 7,
              borderRadius: 2,
              backgroundColor: ink,
            }}
          />
          <Label style={{ fontSize: 10 }}>აღრიცხული</Label>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 14,
              borderTopWidth: 2,
              borderColor: c.text200,
              borderStyle: "dashed",
            }}
          />
          <Label style={{ fontSize: 10 }}>იმ დღის სამიზნე</Label>
        </View>
      </View>
    </View>
  );
}

export function WeightChart({
  points,
}: {
  points: { weightKg: number; date: string }[];
}) {
  const c = useThemeColors(),
    dark = useIsDark(),
    id = "weight" + useId().replace(/[^a-z0-9]/gi, "");
  const ink = dark ? "#80C6B6" : "#268E7F";
  const lastPoint = points.at(-1);
  if (points.length < 2)
    return (
      <View style={{ gap: 12, paddingVertical: 10 }}>
        <Label
          style={{
            fontSize: 34,
            lineHeight: 44,
            fontFamily: bold,
            color: c.text100,
          }}
        >
          {lastPoint?.weightKg ?? "—"}
          <Label> კგ</Label>
        </Label>
        <Svg width="100%" height={70} viewBox="0 0 300 70">
          <Line
            x1={12}
            y1={46}
            x2={288}
            y2={46}
            stroke={c.bg300}
            strokeDasharray="4 6"
          />
          {lastPoint && <Circle cx={150} cy={46} r={5} fill={ink} />}
        </Svg>
        <Label>ტენდენცია გამოჩნდება, როცა მინიმუმ ორი გაზომვა გექნება.</Label>
      </View>
    );
  const min =
      Math.floor((Math.min(...points.map((p) => p.weightKg)) - 0.5) * 2) / 2,
    max = Math.ceil((Math.max(...points.map((p) => p.weightKg)) + 0.5) * 2) / 2;
  const first = Date.parse(points[0].date),
    last = Date.parse(lastPoint!.date);
  const coords = points.map((p) => ({
    x: 37 + ((Date.parse(p.date) - first) / Math.max(1, last - first)) * 263,
    y: 155 - ((p.weightKg - min) / (max - min)) * 128,
  }));
  const path = coords.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const delta =
    Math.round((lastPoint!.weightKg - points[0].weightKg) * 10) / 10;
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View>
          <Label>ბოლო გაზომვა</Label>
          <Label
            style={{
              fontSize: 32,
              lineHeight: 44,
              fontFamily: bold,
              color: c.text100,
              fontVariant: ["tabular-nums"],
            }}
          >
            {lastPoint!.weightKg}
            <Label> კგ</Label>
          </Label>
        </View>
        <View
          style={{
            borderRadius: 14,
            padding: 10,
            backgroundColor: c.bg200,
            alignItems: "flex-end",
          }}
        >
          <Label style={{ color: c.text100, fontFamily: bold }}>
            {delta > 0 ? "+" : ""}
            {delta} კგ
          </Label>
          <Label style={{ fontSize: 9, lineHeight: 15 }}>
            პერიოდის ცვლილება
          </Label>
        </View>
      </View>
      <Reveal>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={points
            .map((p) => `${p.date}: ${p.weightKg} კგ`)
            .join(", ")}
        >
          <Svg height={178} width="100%" viewBox="0 0 316 178">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ink} stopOpacity={0.18} />
                <Stop offset="1" stopColor={ink} stopOpacity={0.015} />
              </LinearGradient>
            </Defs>
            {[max, (max + min) / 2, min].map((n, i) => (
              <React.Fragment key={i}>
                <SvgText x={0} y={31 + i * 64} fill={c.text200} fontSize={9}>
                  {Math.round(n * 10) / 10}
                </SvgText>
                <Line
                  x1={35}
                  y1={27 + i * 64}
                  x2={305}
                  y2={27 + i * 64}
                  stroke={c.bg300}
                  strokeDasharray="3 5"
                />
              </React.Fragment>
            ))}
            <Path d={`${path} L 300 155 L 37 155 Z`} fill={`url(#${id})`} />
            <Path
              d={path}
              stroke={ink}
              strokeWidth={2.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            {coords.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === coords.length - 1 ? 5 : 2.6}
                fill={i === coords.length - 1 ? ink : c.surface}
                stroke={ink}
                strokeWidth={1.6}
              />
            ))}
            <Circle
              cx={coords.at(-1)!.x}
              cy={coords.at(-1)!.y}
              r={9}
              stroke={ink}
              strokeOpacity={0.35}
              strokeWidth={1}
              fill="none"
            />
          </Svg>
        </View>
      </Reveal>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Label style={{ fontSize: 10 }}>
          {nutritionDateLabel(points[0].date)}
        </Label>
        <Label style={{ fontSize: 10 }}>
          {nutritionDateLabel(lastPoint!.date)}
        </Label>
      </View>
    </View>
  );
}
