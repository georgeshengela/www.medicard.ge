import React, { useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChefHat,
  ChevronRight,
  Droplet,
  Flame,
  Footprints,
  Plus,
  Scale,
  Settings2,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { isHrefAvailable, useFeatureState } from "@/lib/featureFlags";
import { tx } from "@/i18n/locale";
import { nutritionDateLabel, nutritionProgramApi, type NutritionDashboard, type PlannedMeal } from "@/lib/nutritionProgram";
import { mealLabels } from "@/lib/nutrition";
import { fastProgress, hoursLabel, timeLabel } from "@/lib/fasting";
import { accountKey, queryClient } from "@/lib/queryClient";
import { HUB, hubText } from "@/theme/hub";
import { HubFeatureCard } from "@/components/home/HubFeatureCard";
import { ModuleHeaderButton } from "@/components/brand/ModuleHeader";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { NScreen, NLoading, NError, useMedifood, useNutritionDashboard, withMedifood } from "./ProgramUI";
import { MedifoodHero } from "./MedifoodHero";
import { diaryHref, HubCard, HubSection, LogBar, MEAL_ICONS, MEAL_TYPES, type MealType } from "./NutritionUi";

export default withMedifood(function Nutrition() {
  const { user } = useAuth();
  return <Hub key={user?.id || "guest"} />;
});

const group = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");

/**
 * MEDIFOOD — today in one screen, in the order a food app is used (MyFitnessPal / Yazio / Cal AI):
 * the day's balance (the module's one hero), the logging bar, the four meals of the day — with the
 * meal plan's dish waiting in an empty slot — water and movement, the tools (meal plan first), and
 * the goal. Every door leads to one place: food goes through the diary.
 */
function Hub() {
  const M = useMedifood(),
    { c } = M,
    router = useRouter(),
    { data: d, error, loading, load } = useNutritionDashboard();
  const features = useFeatureState();
  const open = (href: string) => router.push(href as never);
  return (
    <NScreen
      title={d ? tx(`დღეს · ${nutritionDateLabel(d.date)}`, `Today · ${nutritionDateLabel(d.date)}`) : tx("კვება", "Nutrition")}
      fallbackHref="/(tabs)/home"
      right={<ModuleHeaderButton label={tx("კვების პარამეტრები", "Nutrition settings")} icon={Settings2} onPress={() => open("/nutrition/settings")} />}
    >
      {error ? <NError message={error} retry={() => void load()} /> : loading && !d ? <NLoading /> : null}
      {d && (
        <>
          <View style={{ gap: 10 }}>
            <MedifoodHero d={d} onOpen={() => open("/nutrition/diary")} />
            {d.fasting?.active ? <FastingStrip d={d} onOpen={() => open("/nutrition/fasting")} /> : null}
            <LogBar />
          </View>

          <HubSection title={tx("დღის კვება", "Today's meals")} linkLabel={tx("დღიური", "Diary")} onLink={() => open("/nutrition/diary")}>
            <MealSlots d={d} planOn={isHrefAvailable("/nutrition/plan", features)} reload={load} />
          </HubSection>

          <HubSection title={tx("წყალი და მოძრაობა", "Water and movement")}>
            <DayTiles d={d} />
            <View style={{ paddingHorizontal: 4, marginTop: 6 }}>
              <MedicalSourcesLink sourceIds={d.targets ? ["energyTarget", "macroRanges", "waterIntake", "activityMet"] : ["waterIntake", "activityMet"]} />
            </View>
          </HubSection>

          <HubSection title={tx("ხელსაწყოები", "Tools")}>
            <Tools d={d} />
          </HubSection>

          <HubSection title={tx("შენი მიზანი", "Your goal")}>
            <View style={{ gap: 8 }}>
              <GoalCard d={d} />
              <StreakRow d={d} />
            </View>
          </HubSection>

          <Pressable accessibilityRole="button" onPress={() => open("/nutrition/method")} style={{ paddingVertical: 4, minHeight: 44, justifyContent: "center" }}>
            <Text style={[hubText.caption, { color: c.text300, textAlign: "center" }]}>{tx("როგორ ითვლება გეგმა და რატომ არის შეფასება მიახლოებითი", "How the plan is calculated and why estimates are approximate")}</Text>
          </Pressable>
        </>
      )}
    </NScreen>
  );
}

/**
 * The four meals of today in one card. A slot shows what was logged (names + kcal); an empty slot with
 * a meal-plan dish offers it with one-tap „მივირთვი“ (the plan no longer hides behind „მეტი“). „+“ opens
 * the diary's add menu for that slot; the row itself opens the diary.
 */
function MealSlots({ d, planOn, reload }: { d: NutritionDashboard; planOn: boolean; reload: () => Promise<void> }) {
  const M = useMedifood(),
    { c } = M,
    router = useRouter();
  const [eating, setEating] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const eat = async (meal: PlannedMeal) => {
    if (eating) return;
    setEating(meal.id);
    setProblem("");
    try {
      await nutritionProgramApi.eat(meal.id);
      void queryClient.invalidateQueries({ queryKey: accountKey("nutrition", "meals", d.date) });
      await reload();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setEating(null);
    }
  };
  return (
    <HubCard style={{ gap: 0, paddingVertical: 4, paddingHorizontal: 14 }}>
      {MEAL_TYPES.map((type, index) => {
        const meals = d.todayMeals.filter((m) => m.type === type);
        const kcal = meals.reduce((sum, m) => sum + (m.totals?.calories || 0), 0);
        const names = meals.map((m) => m.title?.trim() || m.names.filter(Boolean).join(", ")).filter(Boolean).join(" · ");
        const planned = planOn && !meals.length ? d.planned.find((p) => p.type === type && !p.eaten && p.date === d.date) : undefined;
        const Icon = MEAL_ICONS[type];
        const filled = meals.length > 0;
        return (
          <View key={type} style={[s.slot, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                filled
                  ? tx(`${mealLabels[type]}: ${names}, ${group(kcal)} კკალ. დღიურის გახსნა`, `${mealLabels[type]}: ${names}, ${group(kcal)} kcal. Open diary`)
                  : planned
                    ? tx(`${mealLabels[type]}: გეგმით ${planned.data.title}. რაციონის გახსნა`, `${mealLabels[type]}: planned ${planned.data.title}. Open meal plan`)
                    : tx(`${mealLabels[type]}: ჯერ არაფერია. დღიურის გახსნა`, `${mealLabels[type]}: nothing yet. Open diary`)
              }
              onPress={() => router.push((planned ? "/nutrition/plan" : "/nutrition/diary") as never)}
              style={s.slotMain}
            >
              <View style={[s.slotIcon, { backgroundColor: filled ? M.ink : M.inkSoft }]}>
                <Icon size={19} color={filled ? M.onInk : M.ink} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 14.5 }]}>{mealLabels[type]}</Text>
                {filled ? (
                  <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{names}</Text>
                ) : planned ? (
                  <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
                    <Text style={{ color: M.ink, fontFamily: "NotoSansGeorgian_600SemiBold" }}>{tx("რაციონი: ", "Plan: ")}</Text>
                    {planned.data.title} · {group(planned.data.totals.calories)} {tx("კკალ", "kcal")}
                  </Text>
                ) : null}
              </View>
              {filled ? (
                <Text style={[hubText.value, { color: c.text100 }]}>
                  {group(kcal)} <Text style={[hubText.small, { color: c.text300 }]}>{tx("კკალ", "kcal")}</Text>
                </Text>
              ) : null}
            </Pressable>
            {planned ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx(`${planned.data.title} — მივირთვი, დღიურში დამატება`, `${planned.data.title} — I ate it, add to diary`)}
                accessibilityState={{ busy: eating === planned.id }}
                disabled={!!eating}
                onPress={() => void eat(planned)}
                hitSlop={4}
                style={[s.add, { backgroundColor: M.ink, opacity: eating ? 0.5 : 1 }]}
              >
                <Check size={19} color={M.onInk} strokeWidth={2.6} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx(`დამატება: ${mealLabels[type]}`, `Add to ${mealLabels[type].toLowerCase()}`)}
              onPress={() => router.push(diaryHref("more", type))}
              hitSlop={4}
              style={[s.add, { backgroundColor: c.bg200 }]}
            >
              <Plus size={19} color={c.text100} strokeWidth={2.4} />
            </Pressable>
          </View>
        );
      })}
      {problem ? <Text accessibilityRole="alert" style={[hubText.caption, { color: c.danger, paddingBottom: 10 }]}>{problem}</Text> : null}
    </HubCard>
  );
}

/** Water, steps and burned energy: three quiet tiles, value over label, so nothing is cut. */
function DayTiles({ d }: { d: NutritionDashboard }) {
  const M = useMedifood(),
    { c } = M,
    router = useRouter();
  const features = useFeatureState();
  const tile = (Icon: LucideIcon, value: string, label: string, href: string, unit?: string) => {
    if (!isHrefAvailable(href, features)) return null;
    return (
      <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => router.push(href as never)} style={[s.dayTile, { backgroundColor: c.surface }]}>
        <Icon size={17} color={M.ink} strokeWidth={2.1} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[hubText.value, { color: c.text100, fontSize: 17, lineHeight: 23, fontVariant: ["tabular-nums"] }]}>{value}{unit ? <Text style={[hubText.small, { color: c.text300 }]}>{` ${unit}`}</Text> : null}</Text>
        <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{label}</Text>
      </Pressable>
    );
  };
  const litres = (ml: number) => (ml / 1000).toFixed(1);
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {tile(Droplet, d.water.goalMl ? `${litres(d.water.ml)} / ${litres(d.water.goalMl)}` : litres(d.water.ml), tx("წყალი, ლ", "Water, L"), "/health-metrics/hydration")}
      {tile(Footprints, group(d.steps), tx("ნაბიჯი", "Steps"), "/health-metrics/steps")}
      {tile(Flame, group(d.burned.total), tx("დამწვარი", "Burned"), "/nutrition/activity", tx("კკალ", "kcal"))}
    </View>
  );
}

/** The module's tools: the meal plan first and wide (it used to get lost), then four equal tiles. */
function Tools({ d }: { d: NutritionDashboard }) {
  const M = useMedifood(),
    { c } = M,
    router = useRouter();
  const features = useFeatureState();
  const plannedToday = d.planned.filter((p) => p.date === d.date);
  const left = plannedToday.filter((p) => !p.eaten).length;
  const planDetail = !d.targets
    ? tx("ჯერ მიზანი აირჩიე — მერე 7 დღის მენიუ", "Pick a goal first — then a 7-day menu")
    : plannedToday.length
      ? left
        ? tx(`დღეს ${plannedToday.length} კერძი · დარჩა ${left}`, `${plannedToday.length} dishes today · ${left} to go`)
        : tx(`დღეს ${plannedToday.length} კერძი · ყველა მიღებულია`, `${plannedToday.length} dishes today · all eaten`)
      : tx("7 დღის მენიუ და საყიდლების სია", "A 7-day menu and a shopping list");
  const small: { icon: LucideIcon; title: string; detail: string; href: string }[] = [
    { icon: ChefHat, title: tx("რეცეპტები", "Recipes"), detail: tx("შენი კერძები", "Your dishes"), href: "/nutrition/recipes" },
    { icon: Timer, title: tx("შიმშილი", "Fasting"), detail: d.fasting?.active ? tx("ტაიმერი ჩართულია", "Timer running") : tx("16:8 ტაიმერი", "16:8 timer"), href: "/nutrition/fasting" },
    { icon: Flame, title: tx("ვარჯიში", "Exercise"), detail: d.activities.length ? tx(`დღეს ${group(d.burned.activities)} კკალ`, `${group(d.burned.activities)} kcal today`) : tx("სირბილი, ძალოვანი…", "Running, strength…"), href: "/nutrition/activity" },
    { icon: ChartNoAxesCombined, title: tx("პროგრესი", "Progress"), detail: tx("წონა და ზომები", "Weight and sizes"), href: "/nutrition/progress" },
  ].filter((t) => isHrefAvailable(t.href, features));
  return (
    <View style={{ gap: 8 }}>
      {isHrefAvailable("/nutrition/plan", features) ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${tx("ჩემი რაციონი", "My meal plan")}. ${planDetail}`} onPress={() => router.push("/nutrition/plan" as never)} style={[s.planTile, { backgroundColor: c.surface }]}>
          <View style={[s.toolIcon, { backgroundColor: M.ink }]}>
            <CalendarDays size={20} color={M.onInk} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{tx("ჩემი რაციონი", "My meal plan")}</Text>
            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>{planDetail}</Text>
          </View>
          <ChevronRight size={18} color={c.text300} />
        </Pressable>
      ) : null}
      <View style={s.toolGrid}>
        {small.map((tool) => (
          <Pressable key={tool.href} accessibilityRole="button" accessibilityLabel={`${tool.title}. ${tool.detail}`} onPress={() => router.push(tool.href as never)} style={[s.tool, { backgroundColor: c.surface }]}>
            <View style={[s.toolIcon, { backgroundColor: M.inkSoft }]}>
              <tool.icon size={19} color={M.ink} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[hubText.cardTitle, { color: c.text100, fontSize: 14 }]}>{tool.title}</Text>
              <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{tool.detail}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FastingStrip({ d, onOpen }: { d: NutritionDashboard; onOpen: () => void }) {
  const M = useMedifood(),
    { c } = M;
  const fast = d.fasting!.active!;
  const progress = fastProgress(fast);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tx("შიმშილის ტაიმერის გახსნა", "Open fasting timer")} onPress={onOpen} style={[s.fast, { backgroundColor: c.surface }]}>
      <Timer size={18} color={M.ink} strokeWidth={2.1} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text numberOfLines={1} style={[hubText.link, { color: c.text100 }]}>
          {progress >= 1 ? tx("შიმშილის მიზანი შესრულდა", "Fasting goal reached") : tx(`შიმშილი · მიზანი ${timeLabel(fast.goalAt)}-ზე`, `Fasting · goal at ${timeLabel(fast.goalAt)}`)}
          <Text style={[hubText.small, { color: c.text300 }]}>{tx(`  ${hoursLabel(fast.targetMinutes)} ფანჯარა`, `  ${hoursLabel(fast.targetMinutes)} window`)}</Text>
        </Text>
        <View style={[s.track, { backgroundColor: c.bg200 }]}>
          <View style={[s.fill, { width: `${Math.round(Math.min(1, progress) * 100)}%`, backgroundColor: M.ink }]} />
        </View>
      </View>
      <ChevronRight size={17} color={c.text300} />
    </Pressable>
  );
}

function GoalCard({ d }: { d: NutritionDashboard }) {
  const M = useMedifood(),
    { c } = M,
    router = useRouter();
  const features = useFeatureState();
  const target = d.facts.weightGoal?.targetKg ?? d.program?.config.targetKg ?? null;
  if (!d.program?.active || d.needsReview)
    return (
      <HubFeatureCard
        lead={
          <View style={[s.toolIcon, { backgroundColor: M.inkSoft }]}>
            <Target size={21} color={M.ink} strokeWidth={1.8} />
          </View>
        }
        title={d.needsReview ? tx("გეგმა შენთან ერთად იცვლება", "Your plan changes with you") : tx("შენი მიზანი, შენი ტემპით", "Your goal, your pace")}
        body={d.needsReview ? d.reasons.join(" ") : tx("დაკლება, შენარჩუნება თუ მომატება — დღის ბიუჯეტი, მაკროები და 7 დღის რაციონი ერთ გეგმაში.", "Lose, maintain or gain — a daily budget, macros and a 7-day meal plan, all in one plan.")}
        cta={d.program ? tx("გეგმის გადამოწმება", "Review plan") : tx("ჩემი გეგმის შექმნა", "Create my plan")}
        onPress={() => router.push("/nutrition/goal")}
        note={tx("ეს ორიენტირია, არა ექიმის დანიშნულება.", "This is a guide, not a doctor's prescription.")}
      />
    );
  return (
    <HubCard>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={[s.toolIcon, { backgroundColor: M.inkSoft }]}>
          <Scale size={20} color={M.ink} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[hubText.caption, { color: c.text200 }]}>{tx("წონის მიზანი", "Weight goal")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[hubText.value, { color: c.text100, fontSize: 22, lineHeight: 29 }]}>{d.facts.current?.kg ?? "—"}</Text>
            <ArrowRight size={16} color={c.text300} />
            <Text style={[hubText.value, { color: M.ink, fontSize: 22, lineHeight: 29 }]}>
              {target ?? "—"} <Text style={[hubText.small, { color: c.text300 }]}>{tx("კგ", "kg")}</Text>
            </Text>
          </View>
        </View>
        <Pressable onPress={() => router.push("/nutrition/goal")} accessibilityRole="button" accessibilityLabel={tx("მიზნის შეცვლა", "Change goal")} hitSlop={6} style={[s.smallButton, { backgroundColor: c.bg200 }]}>
          <Text style={[hubText.link, { color: c.text100 }]}>{tx("შეცვლა", "Change")}</Text>
        </Pressable>
      </View>
      <Text style={[hubText.caption, { color: c.text200 }]}>
        {d.projection.trendEta
          ? tx(`მიმდინარე ტემპით მიზანს დაახლოებით ${nutritionDateLabel(d.projection.trendEta)}-ს მიაღწევ.`, `At your current pace you'll reach your goal around ${nutritionDateLabel(d.projection.trendEta)}.`)
          : d.projection.planEta
            ? tx(`გეგმის ტემპით ორიენტირი: ${nutritionDateLabel(d.projection.planEta)}.`, `At the plan's pace: around ${nutritionDateLabel(d.projection.planEta)}.`)
            : tx("დღის სამიზნე გეგმიდანაა. წონას როცა ჩაწერ, პროგნოზიც გამოჩნდება.", "Your daily target comes from the plan. Log your weight and a forecast will appear.")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <MedicalSourcesLink sourceIds={["bodyWeightPlanner", "weightPace"]} />
        {isHrefAvailable("/health-metrics/weight", features) ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/health-metrics/weight")} hitSlop={6} style={[s.smallButton, { backgroundColor: M.inkSoft }]}>
            <Text style={[hubText.link, { color: M.ink }]}>{tx("წონის ჩაწერა", "Log weight")}</Text>
          </Pressable>
        ) : null}
      </View>
    </HubCard>
  );
}

/** The logging streak in one line: today's state and the next milestone, no wall of pills. */
function StreakRow({ d }: { d: NutritionDashboard }) {
  const M = useMedifood(),
    { c } = M;
  const { streak } = d;
  const line = streak.loggedToday
    ? streak.nextMilestone
      ? tx(`დღეს ჩაწერილია · შემდეგი ნიშნული ${streak.nextMilestone} დღე`, `Logged today · next milestone ${streak.nextMilestone} days`)
      : tx("დღეს ჩაწერილია · ყველა ნიშნული აღებულია", "Logged today · every milestone reached")
    : streak.current > 0
      ? tx("დღეს ერთი ჩანაწერი — და სერია გაგრძელდება", "One entry today keeps your streak going")
      : tx("პირველი ჩანაწერით იწყება · გამოტოვება ვალს არ ქმნის", "Starts with your first entry · a missed day is no debt");
  return (
    <View accessible accessibilityLabel={tx(`სერია: ${streak.current} დღე ზედიზედ, რეკორდი ${streak.best}. ${line}`, `Streak: ${streak.current} days in a row, best ${streak.best}. ${line}`)} style={[s.streak, { backgroundColor: c.surface }]}>
      <Trophy size={18} color={M.ink} strokeWidth={2} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[hubText.link, { color: c.text100 }]}>
          {tx(`${streak.current} დღე ზედიზედ`, `${streak.current} ${streak.current === 1 ? "day" : "days"} in a row`)}
          <Text style={[hubText.small, { color: c.text300 }]}>{tx(`  · რეკორდი ${streak.best}`, `  · best ${streak.best}`)}</Text>
        </Text>
        <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{line}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  slot: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 64 },
  slotMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  slotIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  add: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  dayTile: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, gap: 2 },
  planTile: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: HUB.cardRadius, padding: 14, minHeight: 70 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tool: { width: "48.5%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, padding: 12, minHeight: 64 },
  toolIcon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: "center", justifyContent: "center" },
  fast: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  streak: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  smallButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  track: { height: 5, borderRadius: 3, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3 },
});
