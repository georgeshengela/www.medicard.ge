import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { ChevronRight } from "lucide-react-native";
import { tx } from "@/i18n/locale";
import type { NutritionDashboard } from "@/lib/nutritionProgram";
import { MODULE_BRANDS } from "@/theme/moduleBrand";
import { HUB } from "@/theme/hub";

const BRAND = MODULE_BRANDS.food;
/** Over the budget: warm amber reads as „look here“ on the emerald, never as an alarm. */
const OVER = "#FCD34D";
const RING = 132;
const STROKE = 11;
/** The gauge opens at the bottom: 270° from 135° to 405°. */
const START = 135;
const SWEEP = 270;

const group = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, to),
    b = polar(cx, cy, r, from);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from <= 180 ? 0 : 1} 0 ${b.x} ${b.y}`;
}

/**
 * MEDIFOOD's one hero card (the module gradient, corner glow and rings — like MEDILAB's): today's
 * energy as a compact gauge, what is left of the day's budget, and the three macros as thin bars.
 * The whole card opens the diary.
 */
export function MedifoodHero({ d, onOpen }: { d: NutritionDashboard; onOpen: () => void }) {
  const eaten = d.today.calories;
  const budget = d.budget ?? d.targets?.calories ?? null;
  const ratio = budget && budget > 0 ? Math.min(1, Math.max(0, eaten / budget)) : 0;
  const over = budget != null && d.remaining != null && d.remaining < 0;
  const remaining = d.remaining != null ? Math.round(d.remaining) : null;
  const end = START + ratio * SWEEP;
  const dot = polar(RING / 2, RING / 2, (RING - STROKE) / 2, end);
  const budgetLine = d.targets
    ? d.burned.counted > 0 || d.rollover > 0
      ? tx(
          `სამიზნე ${group(d.targets.calories)}${d.burned.counted > 0 ? ` + დამწვარი ${group(d.burned.counted)}` : ""}${d.rollover > 0 ? ` + გუშინდელი ${group(d.rollover)}` : ""}`,
          `Target ${group(d.targets.calories)}${d.burned.counted > 0 ? ` + burned ${group(d.burned.counted)}` : ""}${d.rollover > 0 ? ` + yesterday ${group(d.rollover)}` : ""}`,
        )
      : tx(`დღის სამიზნე ${group(d.targets.calories)} კკალ`, `Daily target ${group(d.targets.calories)} kcal`)
    : d.program?.active
      ? tx("გეგმა გადასამოწმებელია", "Your plan needs a review")
      : tx("სამიზნე ჯერ არ გაქვს — ქვემოთ აირჩიე", "No target yet — pick one below");

  const label = budget
    ? over
      ? tx(`დღეს ${group(eaten)} კკალ, ბიუჯეტზე ${group(-remaining!)}-ით მეტი. დღიურის გახსნა`, `${group(eaten)} kcal today, ${group(-remaining!)} over budget. Open diary`)
      : tx(`დღეს ${group(eaten)} კკალ, დარჩა ${group(remaining ?? budget - eaten)}. დღიურის გახსნა`, `${group(eaten)} kcal today, ${group(remaining ?? budget - eaten)} left. Open diary`)
    : tx(`დღეს ${group(eaten)} კკალ. დღიურის გახსნა`, `${group(eaten)} kcal today. Open diary`);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onOpen} style={s.wrap}>
      <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
        <View pointerEvents="none" style={[s.ring, s.ringOuter]} />
        <View pointerEvents="none" style={[s.ring, s.ringInner]} />

        <View style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={s.title}>{tx("დღის ბალანსი", "Today's balance")}</Text>
            <Text numberOfLines={1} style={s.sub}>{budgetLine}</Text>
          </View>
          <View style={s.more}>
            <Text style={s.moreText}>{tx("დღიური", "Diary")}</Text>
            <ChevronRight size={15} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </View>

        <View style={s.body}>
          <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <Path d={arc(RING / 2, RING / 2, (RING - STROKE) / 2, START, START + SWEEP)} stroke="rgba(255,255,255,0.18)" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
              {ratio > 0 ? (
                <>
                  <Path d={arc(RING / 2, RING / 2, (RING - STROKE) / 2, START, Math.max(START + 0.5, end))} stroke={over ? OVER : "#FFFFFF"} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
                  <Circle cx={dot.x} cy={dot.y} r={3} fill={BRAND.gradient[1]} />
                </>
              ) : null}
            </Svg>
            <Text style={s.big}>{group(eaten)}</Text>
            <Text style={s.unit}>{tx("კკალ დღეს", "kcal today")}</Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
            {budget ? (
              <View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[s.left, over && { color: OVER }]}>
                  {group(Math.abs(remaining ?? budget - eaten))}
                </Text>
                <Text numberOfLines={1} style={s.leftLabel}>{over ? tx("კკალ ბიუჯეტზე მეტი", "kcal over budget") : tx("კკალ დარჩა", "kcal left")}</Text>
              </View>
            ) : null}
            {(["protein", "carbs", "fat"] as const).map((key) => {
              const goal = d.targets?.[key] || 0;
              const value = d.today[key];
              const share = goal ? Math.min(1, value / goal) : 0;
              const name = key === "protein" ? tx("ცილა", "Protein") : key === "carbs" ? tx("ნახშ.", "Carbs") : tx("ცხიმი", "Fat");
              return (
                <View key={key} accessible accessibilityLabel={tx(`${name}: ${Math.round(value)} გრამი${goal ? ` ${goal}-დან` : ""}`, `${name}: ${Math.round(value)} grams${goal ? ` of ${goal}` : ""}`)} style={{ gap: 4 }}>
                  <View style={s.macroHead}>
                    <Text numberOfLines={1} style={s.macroName}>{name}</Text>
                    <Text numberOfLines={1} style={s.macroValue}>
                      {Math.round(value)}
                      <Text style={s.macroGoal}>{goal ? ` / ${goal} ${tx("გ", "g")}` : ` ${tx("გ", "g")}`}</Text>
                    </Text>
                  </View>
                  <View style={s.track}>
                    {share > 0 ? <View style={[s.fill, { width: `${Math.max(4, share * 100)}%`, backgroundColor: goal && value > goal * 1.1 ? OVER : "#FFFFFF" }]} /> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        {over ? <Text style={s.note}>{tx("ხვალ ახალი დღეა — გადაცდენა ვალს არ ქმნის.", "Tomorrow is a new day — going over is no debt.")}</Text> : null}
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: HUB.cardRadius, overflow: "hidden" },
  card: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 14, overflow: "hidden" },
  glow: { position: "absolute", width: 200, height: 200, borderRadius: 100, right: -70, top: -90 },
  ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(167,243,208,0.16)" },
  ringOuter: { width: 240, height: 240, borderRadius: 120, right: -100, top: -110 },
  ringInner: { width: 160, height: 160, borderRadius: 80, right: -60, top: -70 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: "NotoSansGeorgian_700Bold", fontSize: 16, lineHeight: 22, color: "#FFFFFF" },
  sub: { fontFamily: "NotoSansGeorgian_500Medium", fontSize: 12.5, lineHeight: 17, color: BRAND.onHero },
  more: {
    flexDirection: "row", alignItems: "center", gap: 2, height: 30, paddingLeft: 12, paddingRight: 8, borderRadius: 15,
    backgroundColor: "rgba(2,44,34,0.35)", borderWidth: 1, borderColor: "rgba(167,243,208,0.25)",
  },
  moreText: { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 12, lineHeight: 16, color: "#FFFFFF" },
  body: { flexDirection: "row", alignItems: "center", gap: 16 },
  big: { fontFamily: "NotoSansGeorgian_700Bold", fontSize: 30, lineHeight: 36, color: "#FFFFFF", fontVariant: ["tabular-nums"], letterSpacing: -0.8, marginTop: 4 },
  unit: { fontFamily: "NotoSansGeorgian_500Medium", fontSize: 11, lineHeight: 15, color: BRAND.onHero },
  left: { fontFamily: "NotoSansGeorgian_700Bold", fontSize: 22, lineHeight: 28, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  leftLabel: { fontFamily: "NotoSansGeorgian_500Medium", fontSize: 12, lineHeight: 16, color: BRAND.onHero },
  macroHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 6 },
  macroName: { fontFamily: "NotoSansGeorgian_500Medium", fontSize: 12, lineHeight: 16, color: "#FFFFFF", flexShrink: 1 },
  macroValue: { fontFamily: "NotoSansGeorgian_700Bold", fontSize: 12, lineHeight: 16, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  macroGoal: { fontFamily: "NotoSansGeorgian_400Regular", color: BRAND.onHero },
  track: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  fill: { height: 5, borderRadius: 3 },
  note: { fontFamily: "NotoSansGeorgian_500Medium", fontSize: 12, lineHeight: 17, color: BRAND.onHero },
});
