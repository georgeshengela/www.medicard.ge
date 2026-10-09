import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, ChefHat, ChevronRight, Pencil, ShoppingBasket, Sparkles } from "lucide-react-native";
import { tx } from "@/i18n/locale";
import { mealLabels, mealTypeForHour } from "@/lib/nutrition";
import { formatYmd } from "@/lib/format";
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
 * - a goal but no menu today → „✓ შენი კვების გეგმა მზადაა“ with its facts; „მენიუს შედგენა“ composes it with the
 *   animation (or „კვირის მენიუ“ when the menu starts on a later day), „გეგმის შეცვლა“ reopens the questions;
 * - a menu today → the plate shows what is eaten (x/4), the next dish, the week and the shopping list.
 * (owner 2026-10-09: „how do I know I already have one?“ — a saved plan must say so before asking to compose.)
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

  if (ready) {
    const cfg = d.program!.config;
    const upcoming = d.planned.filter((p) => p.date > d.date).sort((x, y) => x.date.localeCompare(y.date));
    const goalText = cfg.mode === "lose" ? tx(`კლება · ${cfg.targetKg} კგ`, `Lose · ${cfg.targetKg} kg`) : cfg.mode === "gain" ? tx(`მომატება · ${cfg.targetKg} კგ`, `Gain · ${cfg.targetKg} kg`) : tx("წონის შენარჩუნება", "Keep weight");
    const dietText = cfg.diet === "vegan" ? tx("ვეგანური", "Vegan") : cfg.diet === "vegetarian" ? tx("ვეგეტარიანული", "Vegetarian") : tx("მრავალფეროვანი", "Varied");
    const facts = [
      { k: tx("დღეში", "a day"), v: `${group(d.targets!.calories)} ${tx("კკალ", "kcal")}` },
      { k: tx("მიზანი", "goal"), v: goalText },
      { k: tx("სტილი", "style"), v: dietText },
      ...(cfg.allergens.length ? [{ k: tx("გამორიცხული", "excluded"), v: tx(`${cfg.allergens.length} ალერგენი`, `${cfg.allergens.length} allergen${cfg.allergens.length === 1 ? "" : "s"}`) }] : []),
    ];
    const next = upcoming.length
      ? { label: tx("კვირის მენიუ", "Week menu"), hint: tx(`მენიუ შედგენილია · იწყება ${formatYmd(upcoming[0].date)}`, `Menu ready · starts ${formatYmd(upcoming[0].date)}`), go: () => router.push("/nutrition/plan" as never), icon: ChefHat }
      : eligible
        ? { label: tx("მენიუს შედგენა", "Compose the menu"), hint: tx("შემდეგი ნაბიჯი: 7 დღის მენიუ და საყიდლების სია", "Next: a 7-day menu and a shopping list"), go: () => router.push({ pathname: "/nutrition/plan", params: { compose: "1" } } as never), icon: Sparkles }
        : { label: tx("დაზუსტება", "Refine"), hint: d.mealPlanning?.reasons[0] || tx("მენიუსთვის ალერგენები ან კვების სტილი დასაზუსტებელია.", "Allergens or eating style need a closer look for the menu."), go: () => router.push("/nutrition/goal" as never), icon: Sparkles };
    const NextIcon = next.icon;
    return (
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.row}>
          <PlanPlate size={72} stroke={7} mode="idle">
            <CheckCircle2 size={24} color={M.ink} strokeWidth={2} />
          </PlanPlate>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[hubText.small, { color: M.ink, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{tx("✓ აქტიური გეგმა", "✓ Active plan")}</Text>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17, lineHeight: 24, fontFamily: "NotoSansGeorgian_700Bold" }]}>{tx("შენი კვების გეგმა მზადაა", "Your nutrition plan is ready")}</Text>
            {d.program!.startedOn ? <Text style={[hubText.caption, { color: c.text300 }]}>{tx(`დაწყებულია ${formatYmd(d.program!.startedOn)}`, `Started ${formatYmd(d.program!.startedOn)}`)}</Text> : null}
          </View>
        </View>
        <View style={s.facts}>
          {facts.map((f) => (
            <View key={f.k} style={[s.fact, { backgroundColor: c.bg200 }]}>
              <Text numberOfLines={1} style={[hubText.value, { color: c.text100, fontSize: 14, lineHeight: 19 }]}>{f.v}</Text>
              <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{f.k}</Text>
            </View>
          ))}
        </View>
        <Text style={[hubText.caption, { color: c.text200 }]}>{next.hint}</Text>
        <View style={s.actions}>
          <Pressable accessibilityRole="button" onPress={next.go} style={[s.action, { backgroundColor: M.ink }]}>
            <NextIcon size={16} color={M.onInk} strokeWidth={2.2} />
            <Text numberOfLines={1} style={[hubText.link, { color: M.onInk }]}>{next.label}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/nutrition/goal" as never)} style={[s.action, { backgroundColor: c.bg200 }]}>
            <Pencil size={15} color={c.text100} strokeWidth={2.1} />
            <Text numberOfLines={1} style={[hubText.link, { color: c.text100 }]}>{tx("გეგმის შეცვლა", "Edit plan")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // No saved plan yet: four questions first.
  const title = tx("შემიდგინე კვება", "Plan my meals");
  const body = tx("4 კითხვა — და 7 დღის მენიუ შენს მიზანზე, გემოვნებასა და ალერგენებზე, საყიდლების სიით.", "4 questions — then a 7-day menu fitted to your goal, taste and allergens, with a shopping list.");
  const cta = tx("დავიწყოთ", "Let's start");
  const go = () => router.push("/nutrition/goal" as never);
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
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  fact: { flexGrow: 1, minWidth: "30%", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, gap: 1 },
  action: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
  cta: { alignSelf: "flex-start", minHeight: 40, borderRadius: 13, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
});
