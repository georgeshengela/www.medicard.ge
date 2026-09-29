import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChefHat,
  Droplet,
  Flame,
  Footprints,
  Mic,
  Ruler,
  Scale,
  Settings2,
  Sparkles,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { tx } from "@/i18n/locale";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { mealLabels } from "@/lib/nutrition";
import { fastProgress, hoursLabel, timeLabel } from "@/lib/fasting";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubInk, hubText, hubTint, type HubInk } from "@/theme/hub";
import { HubFeatureCard } from "@/components/home/HubFeatureCard";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { NScreen, NText, NLoading, NError, EnergyRing, MacroRails, useNutritionDashboard } from "./ProgramUI";
import { HubCard, HubSection, MacroLine, PRIMARY_LOG_TILES, QuickLogTiles, SECONDARY_LOG_TILES } from "./NutritionUi";

export default function Nutrition() {
  const { user } = useAuth();
  return <Hub key={user?.id || "guest"} />;
}
function Hub() {
  const c = useThemeColors(),
    dark = useIsDark(),
    router = useRouter(),
    { data: d, error, loading, load } = useNutritionDashboard();
  const dayTile = (icon: LucideIcon, ink: HubInk, value: string, label: string, href: string) => {
    const Icon = icon, hex = hubInk(ink, dark);
    return (
      <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => router.push(href as never)} style={[s.dayTile, { backgroundColor: c.bg100 }]}>
        <View style={[s.dayIcon, { backgroundColor: hubTint(hex, dark) }]}>
          <Icon size={16} color={hex} strokeWidth={2.2} />
        </View>
        <Text numberOfLines={1} style={[hubText.value, { color: c.text100, fontSize: 14, lineHeight: 20 }]}>{value}</Text>
        <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{label}</Text>
      </Pressable>
    );
  };
  const link = (icon: LucideIcon, ink: HubInk, title: string, subtitle: string, href: string, last = false) => {
    const Icon = icon, hex = hubInk(ink, dark);
    return (
      <Pressable key={title} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={() => router.push(href as never)} style={[s.link, !last && { borderBottomWidth: 1, borderBottomColor: c.bg300 }]}>
        <View style={[s.linkIcon, { backgroundColor: hubTint(hex, dark) }]}>
          <Icon size={20} color={hex} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{title}</Text>
          <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{subtitle}</Text>
        </View>
        <ArrowUpRight size={18} color={c.text300} />
      </Pressable>
    );
  };
  return (
    <NScreen title={tx("კვება", "Nutrition")} subtitle={tx("ჩაწერე, გადაამოწმე, გაიგე", "Log it, check it, understand it")}>
      {error ? <NError message={error} retry={() => void load()} /> : loading && !d ? <NLoading /> : null}
      {d && (
        <>
          <HubSection first title={tx(`დღეს · ${nutritionDateLabel(d.date)}`, `Today · ${nutritionDateLabel(d.date)}`)}>
            <HubCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{tx("დღის ბალანსი", "Today's balance")}</Text>
                {d.streak.current > 0 && (
                  <View style={[s.pill, { backgroundColor: hubTint(hubInk("teal", dark), dark) }]}>
                    <Flame size={13} color={hubInk("teal", dark)} />
                    <Text style={[hubText.small, { color: hubInk("teal", dark), fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{tx(`${d.streak.current} დღე`, `${d.streak.current} ${d.streak.current === 1 ? "day" : "days"}`)}</Text>
                  </View>
                )}
                <Pressable onPress={() => router.push("/nutrition/settings")} accessibilityRole="button" accessibilityLabel={tx("კვების პარამეტრები", "Nutrition settings")} style={s.iconButton}>
                  <Settings2 size={19} color={c.text200} />
                </Pressable>
              </View>
              <EnergyRing value={d.today.calories} target={d.budget ?? d.targets?.calories ?? null} />
              <Text style={[hubText.body, { color: c.text200, textAlign: "center" }]}>
                {d.targets
                  ? d.remaining! >= 0
                    ? tx(`კიდევ ${Math.round(d.remaining!)} კკალ შეგიძლია დღეს`, `${Math.round(d.remaining!)} kcal left for today`)
                    : tx(`დღის ბიუჯეტზე ${Math.abs(Math.round(d.remaining!))} კკალ-ით მეტი — ხვალ ახალი დღეა`, `${Math.abs(Math.round(d.remaining!))} kcal over today's budget — tomorrow is a new day`)
                  : d.program?.active
                    ? tx("გეგმა გადასამოწმებელია", "Your plan needs a review")
                    : tx("ჩაწერე კვება — მიზანს ქვემოთ აირჩევ", "Log your meals — pick a goal below")}
              </Text>
              {d.targets && (d.burned.counted > 0 || d.rollover > 0) && (
                <Text style={[hubText.small, { color: c.text300, textAlign: "center" }]}>
                  {tx("სამიზნე", "Target")} {d.targets.calories}{d.burned.counted > 0 ? tx(` + დამწვარი ${d.burned.counted}`, ` + burned ${d.burned.counted}`) : ""}{d.rollover > 0 ? tx(` + გუშინდელი ${d.rollover}`, ` + yesterday ${d.rollover}`) : ""} = {d.budget} {tx("კკალ", "kcal")}
                </Text>
              )}
              <MacroRails actual={d.today} target={d.targets} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {dayTile(Droplet, "sky", d.water.goalMl ? `${(d.water.ml / 1000).toFixed(1)} / ${(d.water.goalMl / 1000).toFixed(1)} ${tx("ლ", "L")}` : `${(d.water.ml / 1000).toFixed(1)} ${tx("ლ", "L")}`, tx("წყალი", "Water"), "/health-metrics/hydration")}
                {dayTile(Footprints, "green", d.steps.toLocaleString("en-US").replace(/,/g, " "), tx("ნაბიჯი", "Steps"), "/health-metrics/steps")}
                {dayTile(Flame, "amber", `${d.burned.total} ${tx("კკალ", "kcal")}`, tx("დამწვარი", "Burned"), "/nutrition/activity")}
              </View>
              <MedicalSourcesLink sourceIds={d.targets ? ["energyTarget", "macroRanges", "waterIntake", "activityMet"] : ["waterIntake", "activityMet"]} />
            </HubCard>
          </HubSection>

          <HubSection title={tx("ჩაწერე კვება", "Log food")} linkLabel={tx("დღიური", "Diary")} onLink={() => router.push("/nutrition/diary")}>
            <HubCard style={{ gap: 10 }}>
              <QuickLogTiles tiles={PRIMARY_LOG_TILES} columns={2} />
              <QuickLogTiles tiles={SECONDARY_LOG_TILES} columns={2} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={14} color={c.primary100} />
                <Text style={[hubText.small, { color: c.text200, flex: 1 }]}>{tx("AI შეფასებას შენახვამდე ყოველთვის გადაამოწმებ — არაფერი ინახება შენ გარეშე.", "You always check the AI estimate before saving — nothing is saved without you.")}</Text>
              </View>
            </HubCard>
          </HubSection>

          {d.fasting?.active && (
            <HubSection title={tx("შიმშილი მიმდინარეობს", "Fast in progress")} linkLabel={tx("ტაიმერი", "Timer")} onLink={() => router.push("/nutrition/fasting")}>
              <Pressable accessibilityRole="button" accessibilityLabel={tx("შიმშილის ტაიმერის გახსნა", "Open fasting timer")} onPress={() => router.push("/nutrition/fasting")}>
                <HubCard>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={[s.linkIcon, { backgroundColor: hubTint(hubInk("violet", dark), dark) }]}>
                      <Timer size={20} color={hubInk("violet", dark)} strokeWidth={1.9} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                        {fastProgress(d.fasting.active) >= 1 ? tx("მიზანი შესრულდა", "Goal reached") : tx(`მიზანი ${timeLabel(d.fasting.active.goalAt)}-ზე`, `Goal at ${timeLabel(d.fasting.active.goalAt)}`)}
                      </Text>
                      <Text style={[hubText.caption, { color: c.text200 }]}>
                        {tx(`დაიწყო ${timeLabel(d.fasting.active.startedAt)} · ${hoursLabel(d.fasting.active.targetMinutes)} ფანჯარა`, `Started ${timeLabel(d.fasting.active.startedAt)} · ${hoursLabel(d.fasting.active.targetMinutes)} window`)}
                      </Text>
                    </View>
                    <ArrowUpRight size={18} color={c.text300} />
                  </View>
                  <View style={[s.track, { backgroundColor: c.bg200 }]}>
                    <View style={[s.fill, { width: `${Math.round(fastProgress(d.fasting.active) * 100)}%`, backgroundColor: hubInk("violet", dark) }]} />
                  </View>
                </HubCard>
              </Pressable>
            </HubSection>
          )}

          {d.todayMeals.length > 0 && (
            <HubSection title={tx("დღეს ჩაწერილი", "Logged today")} linkLabel={tx("ყველა", "All")} onLink={() => router.push("/nutrition/diary")}>
              <HubCard style={{ gap: 0 }}>
                {d.todayMeals.map((meal, index) => (
                  <Pressable key={meal.id} accessibilityRole="button" onPress={() => router.push("/nutrition/diary")} style={[s.mealRow, index > 0 && { borderTopWidth: 1, borderTopColor: c.bg300 }]}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text numberOfLines={1} style={[hubText.body, { color: c.text100, fontSize: 14 }]}>
                        <Text style={{ color: c.text300 }}>{mealLabels[meal.type]} · </Text>
                        {meal.title || meal.names.join(" · ")}
                      </Text>
                      <MacroLine protein={meal.totals.protein} carbs={meal.totals.carbs} fat={meal.totals.fat} />
                    </View>
                    <Text style={[hubText.value, { color: c.text100 }]}>{Math.round(meal.totals.calories)} <Text style={[hubText.small, { color: c.text300 }]}>{tx("კკალ", "kcal")}</Text></Text>
                  </Pressable>
                ))}
              </HubCard>
            </HubSection>
          )}

          <HubSection title={tx("შენი მიზანი", "Your goal")}>
            {!d.program?.active || d.needsReview ? (
              <HubFeatureCard
                tone="spotlight"
                icon={Target}
                title={d.needsReview ? tx("გეგმა შენთან ერთად იცვლება", "Your plan changes with you") : tx("შენი მიზანი, შენი ტემპით", "Your goal, your pace")}
                body={d.needsReview ? d.reasons.join(" ") : tx("დაკლება, შენარჩუნება თუ მომატება — დღის ბიუჯეტი, მაკროები და 7 დღის რაციონი ერთ გეგმაში.", "Lose, maintain or gain — a daily budget, macros and a 7-day meal plan in one plan.")}
                cta={d.program ? tx("გეგმის გადამოწმება", "Review plan") : tx("ჩემი გეგმის შექმნა", "Create my plan")}
                onPress={() => router.push("/nutrition/goal")}
                note={tx("ეს ორიენტირია, არა ექიმის დანიშნულება.", "This is a guide, not a doctor's prescription.")}
              />
            ) : (
              <HubCard>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[s.linkIcon, { backgroundColor: hubTint(hubInk("teal", dark), dark) }]}>
                    <Scale size={20} color={hubInk("teal", dark)} strokeWidth={1.9} />
                  </View>
                  <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{tx("წონის მიზანი", "Weight goal")}</Text>
                  <Pressable onPress={() => router.push("/nutrition/goal")} accessibilityRole="button" accessibilityLabel={tx("მიზნის შეცვლა", "Change goal")} style={s.iconButton}>
                    <Target size={19} color={c.primary100} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 30, lineHeight: 38 }]}>{d.facts.current?.kg ?? "—"}</Text>
                  <ArrowUpRight size={18} color={c.text300} />
                  <Text style={[hubText.value, { color: c.primary100, fontSize: 30, lineHeight: 38 }]}>{d.facts.weightGoal?.targetKg ?? d.program.config.targetKg} <Text style={[hubText.small, { color: c.text300 }]}>{tx("კგ", "kg")}</Text></Text>
                </View>
                <Text style={[hubText.caption, { color: c.text200 }]}>
                  {d.projection.trendEta
                    ? tx(`მიმდინარე ტემპით მიზანს დაახლოებით ${nutritionDateLabel(d.projection.trendEta)}-ს მიაღწევ.`, `At your current pace you'll reach your goal around ${nutritionDateLabel(d.projection.trendEta)}.`)
                    : d.projection.planEta
                      ? tx(`გეგმის ტემპით ორიენტირი: ${nutritionDateLabel(d.projection.planEta)}.`, `At the plan's pace: around ${nutritionDateLabel(d.projection.planEta)}.`)
                      : tx("დღის სამიზნე გეგმიდანაა. წონას როცა ჩაწერ, პროგნოზიც გამოჩნდება.", "Your daily target comes from the plan. Log your weight and a forecast will appear.")}
                </Text>
                <MedicalSourcesLink sourceIds={["bodyWeightPlanner", "weightPace"]} />
                <Pressable accessibilityRole="button" onPress={() => router.push("/health-metrics/weight")} style={[s.secondary, { backgroundColor: c.bg200 }]}>
                  <Text style={[hubText.link, { color: c.text100 }]}>{tx("წონის ჩაწერა", "Log weight")}</Text>
                </Pressable>
              </HubCard>
            )}
          </HubSection>

          <HubSection title={tx("სერია და ნიშნულები", "Streak and milestones")}>
            <HubCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[s.linkIcon, { backgroundColor: hubTint(hubInk("amber", dark), dark) }]}>
                  <Trophy size={20} color={hubInk("amber", dark)} strokeWidth={1.9} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 22, lineHeight: 28 }]}>{d.streak.current} <Text style={[hubText.small, { color: c.text200 }]}>{tx("დღე ზედიზედ", d.streak.current === 1 ? "day in a row" : "days in a row")}</Text></Text>
                  <Text style={[hubText.small, { color: c.text300 }]}>{tx(`რეკორდი ${d.streak.best} დღე`, `Best: ${d.streak.best} ${d.streak.best === 1 ? "day" : "days"}`)}</Text>
                </View>
              </View>
              <Text style={[hubText.caption, { color: c.text200 }]}>
                {d.streak.loggedToday
                  ? d.streak.nextMilestone
                    ? tx(`დღეს ჩაწერილია. შემდეგი ნიშნული ${d.streak.nextMilestone} დღეა.`, `Logged today. Next milestone: ${d.streak.nextMilestone} days.`)
                    : tx("დღეს ჩაწერილია. ყველა ნიშნული აღებულია!", "Logged today. Every milestone reached!")
                  : d.streak.current > 0
                    ? tx("დღეს ერთი ჩანაწერი — და სერია გრძელდება.", "One entry today keeps your streak going.")
                    : tx("პირველი ჩანაწერით სერია იწყება. გამოტოვება ვალს არ ქმნის.", "Your streak starts with your first entry. A missed day is no debt.")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {[3, 7, 14, 30, 60, 100].map((m) => {
                  const reached = d.streak.reached.includes(m);
                  return (
                    <View key={m} style={[s.pill, { backgroundColor: reached ? hubTint(hubInk("teal", dark), dark) : c.bg200 }]}>
                      <Text style={[hubText.small, { color: reached ? hubInk("teal", dark) : c.text300 }]}>{tx(`${m} დღე`, `${m} days`)}</Text>
                    </View>
                  );
                })}
              </View>
            </HubCard>
          </HubSection>

          <HubSection title={tx("მეტი", "More")}>
            <HubCard style={{ gap: 0, paddingVertical: 4 }}>
              {link(CalendarDays, "teal", tx("ჩემი რაციონი", "My meal plan"), tx("7 დღის კერძები და საყიდლების სია", "7 days of meals and a shopping list"), "/nutrition/plan")}
              {link(ChefHat, "green", tx("ჩემი რეცეპტები", "My recipes"), tx("საკუთარი კერძები — ერთხელ ჩაწერე, მერე ერთი შეხებით", "Your own dishes — save once, then log in one tap"), "/nutrition/recipes")}
              {link(Timer, "violet", tx("ინტერვალური შიმშილი", "Intermittent fasting"), d.fasting?.active ? tx("ტაიმერი ჩართულია", "Timer is running") : tx("16:8 და სხვა ფანჯრები, ტაიმერი და სერია", "16:8 and other windows, timer and streak"), "/nutrition/fasting")}
              {link(Flame, "amber", tx("ვარჯიში და ენერგია", "Exercise and energy"), d.activities.length ? tx(`დღეს ${d.activities.length} ვარჯიში · ${d.burned.activities} კკალ`, `${d.activities.length} ${d.activities.length === 1 ? "workout" : "workouts"} today · ${d.burned.activities} kcal`) : tx("სირბილი, ძალოვანი, სიარული — ბიუჯეტში ჩათვლით", "Running, strength, walking — counted in your budget"), "/nutrition/activity")}
              {link(ChartNoAxesCombined, "blue", tx("პროგრესი", "Progress"), tx("კვირის შეჯამება, წონის პროგნოზი, ტენდენციები", "Weekly summary, weight forecast, trends"), "/nutrition/progress")}
              {link(Ruler, "violet", tx("სხეულის ზომები", "Body measurements"), d.measurements[0] ? tx(`ბოლო ჩანაწერი ${nutritionDateLabel(d.measurements[0].date)}`, `Last entry ${nutritionDateLabel(d.measurements[0].date)}`) : tx("წელი, თეძო, მკერდი — სასწორის გარდა", "Waist, hips, chest — beyond the scale"), "/nutrition/measurements")}
              {link(Mic, "rose", tx("უთხარი Medi-ს", "Tell Medi"), tx("„ორი ხინკალი ვჭამე“ — ჩაწერს და დაითვლის", "“I ate two khinkali” — Medi logs and counts it"), "/assistant")}
              {link(Settings2, "neutral", tx("პარამეტრები და შეხსენებები", "Settings and reminders"), tx("ბიუჯეტი, მაკროები, შეხსენებები, Health", "Budget, macros, reminders, Health"), "/nutrition/settings", true)}
            </HubCard>
          </HubSection>
          <Pressable accessibilityRole="button" onPress={() => router.push("/nutrition/method")} style={{ paddingVertical: 8 }}>
            <Text style={[hubText.small, { color: c.text300, textAlign: "center" }]}>{tx("როგორ ითვლება გეგმა და რატომ არის შეფასება მიახლოებითი →", "How the plan is calculated and why estimates are approximate →")}</Text>
          </Pressable>
        </>
      )}
    </NScreen>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: -10 },
  dayTile: { flex: 1, minWidth: 0, borderRadius: 16, padding: 12, gap: 6 },
  dayIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  link: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, minHeight: 64 },
  linkIcon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: "center", justifyContent: "center" },
  secondary: { minHeight: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
