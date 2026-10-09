import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Check, ChefHat } from "lucide-react-native";
import { tx } from "@/i18n/locale";
import type { NutritionWeek } from "@/lib/nutritionProgram";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HUB, hubText } from "@/theme/hub";
import { useMedifood } from "./ProgramUI";
import { PlanPlate } from "./PlanPlate";

const group = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");

/** How long each of the four steps stays on screen while the menu is composed. */
export const COMPOSE_STEP_MS = 620;

/**
 * The composing moment (one orchestrated animation, owner 2026-10-09): the plate draws one meal arc
 * per step while four steps tick — target, dishes, allergens, shopping list — then a check lands in
 * the middle. The real request runs underneath; the steps only describe what the server does.
 */
export function PlanComposer({ step, calories, result }: { step: number; calories: number | null; result: NutritionWeek | null }) {
  const M = useMedifood(),
    { c } = M;
  const reduce = usePrefersReducedMotion();
  const dishes = result?.meals.length ?? null;
  const items = result?.shopping.length ?? null;
  const rows = [
    { doing: tx("ვითვლი დღის სამიზნეს", "Working out your daily target"), done: calories ? tx(`სამიზნე · ${group(calories)} კკალ დღეში`, `Target · ${group(calories)} kcal a day`) : tx("სამიზნე მზადაა", "Target ready") },
    { doing: tx("ვარჩევ კერძებს 7 დღეზე", "Choosing dishes for 7 days"), done: dishes ? tx(`${dishes} კერძი 7 დღეზე`, `${dishes} dishes over 7 days`) : tx("კერძები შერჩეულია", "Dishes chosen") },
    { doing: tx("ვამოწმებ ალერგენებს და არჩევანს", "Checking allergens and choices"), done: tx("ალერგენები და არჩევანი გათვალისწინებულია", "Allergens and choices respected") },
    { doing: tx("ვადგენ საყიდლების სიას", "Writing the shopping list"), done: items ? tx(`საყიდლების სია · ${items} ინგრედიენტი`, `Shopping list · ${items} ingredients`) : tx("საყიდლების სია მზადაა", "Shopping list ready") },
  ];
  const finished = step >= rows.length;
  return (
    <View accessibilityLiveRegion="polite" style={[s.card, { backgroundColor: c.surface }]}>
      <PlanPlate size={176} stroke={13} mode="compose" filled={step}>
        {finished ? (
          <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(12)} style={[s.centre, { backgroundColor: M.ink }]}>
            <Check size={30} color={M.onInk} strokeWidth={3} />
          </Animated.View>
        ) : (
          <ChefHat size={34} color={M.ink} strokeWidth={1.8} />
        )}
      </PlanPlate>
      <Text style={[hubText.sectionTitle, { color: c.text100, textAlign: "center", fontSize: 19, lineHeight: 26 }]}>
        {finished ? tx("შენი რაციონი მზადაა", "Your meal plan is ready") : tx("ვადგენ შენს რაციონს…", "Composing your meal plan…")}
      </Text>
      <View style={{ alignSelf: "stretch", gap: 10 }}>
        {rows.map((row, index) => {
          const done = index < step;
          const doing = index === step;
          return (
            <Animated.View key={index} entering={reduce ? undefined : FadeInDown.delay(index * 90).duration(320)} style={[s.row, { opacity: done || doing ? 1 : 0.4 }]}>
              <View style={[s.mark, { backgroundColor: done ? M.ink : c.bg200 }]}>
                {done ? (
                  <Animated.View entering={reduce ? undefined : ZoomIn.duration(220)}>
                    <Check size={14} color={M.onInk} strokeWidth={3} />
                  </Animated.View>
                ) : doing ? (
                  <ActivityIndicator size="small" color={M.ink} />
                ) : null}
              </View>
              {done ? (
                <Animated.Text entering={reduce ? undefined : FadeIn.duration(220)} style={[hubText.body, { color: c.text100, fontSize: 14, flex: 1 }]}>
                  {row.done}
                </Animated.Text>
              ) : (
                <Text style={[hubText.body, { color: doing ? c.text100 : c.text300, fontSize: 14, flex: 1 }]}>{row.doing}</Text>
              )}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, paddingVertical: 24, paddingHorizontal: 20, alignItems: "center", gap: 18 },
  centre: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 30 },
  mark: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
