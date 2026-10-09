import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChefHat, ChevronRight, ShoppingBasket, Sparkles } from "lucide-react-native";
import { tx } from "@/i18n/locale";
import { mealLabels, mealTypeForHour } from "@/lib/nutrition";
import type { NutritionDashboard } from "@/lib/nutritionProgram";
import { HUB, hubText } from "@/theme/hub";
import { useMedifood } from "./ProgramUI";
import { MEAL_TYPES } from "./NutritionUi";
import { PlanPlate, type PlateSlot } from "./PlanPlate";

const group = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");

/**
 * „ჩემი რაციონი“ on the hub — the meal plan made the module's second headline (owner 2026-10-09:
 * „where is the function that composes my meals?“). One card, three states:
 * - no goal yet → „შემიდგინე კვება“: four questions, then the composer;
 * - a goal but no menu today → one tap „შედგენა“ opens the plan and composes it with the animation;
 * - a menu today → the plate shows what is eaten (x/4), the next dish, the week and the shopping list.
 */
export function PlanCard({ d }: { d: NutritionDashboard }) {
  const M = useMedifood(),
    { c } = M,
    router = useRouter();
  const today = d.planned.filter((p) => p.date === d.date);
  const ready = !!d.targets && !!d.program?.active && !d.needsReview;
  const eligible = ready && d.mealPlanning?.eligible !== false;

  if (today.length && eligible) {
    const slots: PlateSlot[] = MEAL_TYPES.map((type) => {
      const p = today.find((m) => m.type === type);
      return !p ? "empty" : p.eaten ? "eaten" : "planned";
    });
    const eaten = today.filter((p) => p.eaten).length;
    // The next dish by the clock: the first uneaten one from the current meal on (lunch at 13:30), else the first left.
    const left = today.filter((p) => !p.eaten).sort((x, y) => MEAL_TYPES.indexOf(x.type) - MEAL_TYPES.indexOf(y.type));
    const now = MEAL_TYPES.indexOf(mealTypeForHour(new Date().getHours()));
    const next = left.find((p) => MEAL_TYPES.indexOf(p.type) >= now) ?? left[0];
    return (
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx(`დღის მენიუ: ${eaten} ${today.length}-დან მიღებულია. რაციონის გახსნა`, `Today's menu: ${eaten} of ${today.length} eaten. Open the meal plan`)} onPress={() => router.push("/nutrition/plan" as never)} style={s.row}>
          <PlanPlate size={92} stroke={9} slots={slots}>
            <Text style={[hubText.value, { color: c.text100, fontSize: 20, lineHeight: 25 }]}>
              {eaten}
              <Text style={[hubText.small, { color: c.text300 }]}>/{today.length}</Text>
            </Text>
          </PlanPlate>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[hubText.small, { color: M.ink, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{next ? tx(`შემდეგი · ${mealLabels[next.type]}`, `Next · ${mealLabels[next.type]}`) : tx("დღის მენიუ შესრულდა", "Today's menu is done")}</Text>
            <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, fontSize: 16, lineHeight: 22 }]}>{next ? next.data.title : tx("ყველა კერძი მიღებულია", "Every dish eaten")}</Text>
            {next ? (
              <Text style={[hubText.caption, { color: c.text200 }]}>
                {group(next.data.totals.calories)} {tx("კკალ", "kcal")} · {next.data.minutes} {tx("წთ", "min")}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={18} color={c.text300} />
        </Pressable>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/nutrition/plan" as never)} style={[s.action, { backgroundColor: M.inkSoft }]}>
            <ChefHat size={16} color={M.ink} strokeWidth={2.1} />
            <Text numberOfLines={1} style={[hubText.link, { color: M.ink }]}>{tx("კვირის მენიუ", "Week menu")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/nutrition/plan", params: { shopping: "1" } } as never)} style={[s.action, { backgroundColor: c.bg200 }]}>
            <ShoppingBasket size={16} color={c.text100} strokeWidth={2.1} />
            <Text numberOfLines={1} style={[hubText.link, { color: c.text100 }]}>{tx("საყიდლები", "Shopping")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const compose = eligible;
  const title = compose ? tx("შემიდგინე რაციონი", "Compose my meal plan") : ready ? tx("რაციონისთვის არჩევანი დააზუსტე", "Refine your choices for the plan") : tx("შემიდგინე კვება", "Plan my meals");
  const body = compose
    ? tx(`7 დღე · დღეში ${group(d.targets!.calories)} კკალ · 4 კვება · საყიდლების სია`, `7 days · ${group(d.targets!.calories)} kcal a day · 4 meals · a shopping list`)
    : ready
      ? d.mealPlanning?.reasons[0] || tx("ალერგენები ან კვების სტილი დასაზუსტებელია.", "Allergens or eating style need a closer look.")
      : tx("4 კითხვა — და 7 დღის მენიუ შენს მიზანზე, გემოვნებასა და ალერგენებზე, საყიდლების სიით.", "4 questions — then a 7-day menu fitted to your goal, taste and allergens, with a shopping list.");
  const cta = compose ? tx("შედგენა", "Compose") : ready ? tx("დაზუსტება", "Refine") : tx("დავიწყოთ", "Let's start");
  const go = () => router.push((compose ? { pathname: "/nutrition/plan", params: { compose: "1" } } : "/nutrition/goal") as never);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${body}. ${cta}`} onPress={go} style={[s.card, s.row, { backgroundColor: c.surface }]}>
      <PlanPlate size={96} stroke={9} mode="idle">
        <ChefHat size={26} color={M.ink} strokeWidth={1.9} />
      </PlanPlate>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ gap: 2 }}>
          <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17, lineHeight: 24, fontFamily: "NotoSansGeorgian_700Bold" }]}>{title}</Text>
          <Text style={[hubText.caption, { color: c.text200 }]}>{body}</Text>
        </View>
        <View style={[s.cta, { backgroundColor: M.ink }]}>
          <Sparkles size={15} color={M.onInk} strokeWidth={2.2} />
          <Text style={[hubText.link, { color: M.onInk, fontSize: 14 }]}>{cta}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: 14, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
  cta: { alignSelf: "flex-start", minHeight: 40, borderRadius: 13, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
});
