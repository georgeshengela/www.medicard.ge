import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChefHat,
  ChevronRight,
  Droplet,
  Flame,
  Footprints,
  MessageSquareText,
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
import { isFeatureOn, isHrefAvailable, useFeatureState } from "@/lib/featureFlags";
import { tx } from "@/i18n/locale";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { mealLabels } from "@/lib/nutrition";
import { fastProgress, hoursLabel, timeLabel } from "@/lib/fasting";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubInk, hubText, hubTint } from "@/theme/hub";
import { moduleInk } from "@/theme/moduleBrand";
import { HubFeatureCard } from "@/components/home/HubFeatureCard";
import { ModuleHeaderButton } from "@/components/brand/ModuleHeader";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { NScreen, NLoading, NError, useNutritionDashboard, withMedifood } from "./ProgramUI";
import { MedifoodHero } from "./MedifoodHero";
import { HubCard, HubSection, MacroLine, PRIMARY_LOG_TILES, QuickLogTiles, SECONDARY_LOG_TILES } from "./NutritionUi";

export default withMedifood(function Nutrition() {
  const { user } = useAuth();
  return <Hub key={user?.id || "guest"} />;
});

/**
 * MEDIFOOD — the nutrition hub: the standard module header, the module's one hero (today's energy and
 * macros), the day's water / steps / burned, the ways to log, then the goal, the streak and the rest.
 */
function Hub() {
  const c = useThemeColors(),
    dark = useIsDark(),
    router = useRouter(),
    { data: d, error, loading, load } = useNutritionDashboard();
  const ink = moduleInk("food", dark);
  // Water, steps, weight and Medi have admin switches of their own: a paused one loses its door here.
  const features = useFeatureState();
  const dayTile = (icon: LucideIcon, hex: string, value: string, label: string, href: string) => {
    if (!isHrefAvailable(href, features)) return null;
    const Icon = icon;
    return (
      <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => router.push(href as never)} style={[s.dayTile, { backgroundColor: c.surface }]}>
        <View style={[s.dayIcon, { backgroundColor: hubTint(hex, dark) }]}>
          <Icon size={16} color={hex} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[hubText.value, { color: c.text100, fontSize: 14, lineHeight: 19 }]}>{value}</Text>
          <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{label}</Text>
        </View>
      </Pressable>
    );
  };
  const link = (icon: LucideIcon, hex: string, title: string, subtitle: string, href: string) => {
    if (!isHrefAvailable(href, features)) return null;
    const Icon = icon;
    return (
      <Pressable key={title} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={() => router.push(href as never)} style={s.link}>
        <View style={[s.linkIcon, { backgroundColor: hubTint(hex, dark) }]}>
          <Icon size={19} color={hex} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{title}</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>{subtitle}</Text>
        </View>
        <ChevronRight size={18} color={c.text300} />
      </Pressable>
    );
  };
  const links = d
    ? [
        link(CalendarDays, ink, tx("ჩემი რაციონი", "My meal plan"), tx("7 დღის კერძები და საყიდლების სია", "7 days of meals and a shopping list"), "/nutrition/plan"),
        link(ChefHat, hubInk("green", dark), tx("ჩემი რეცეპტები", "My recipes"), tx("ერთხელ ჩაწერე, მერე ერთი შეხებით", "Save once, then log in one tap"), "/nutrition/recipes"),
        link(Timer, hubInk("violet", dark), tx("ინტერვალური შიმშილი", "Intermittent fasting"), d.fasting?.active ? tx("ტაიმერი ჩართულია", "Timer is running") : tx("16:8 და სხვა ფანჯრები, ტაიმერი", "16:8 and other windows, a timer"), "/nutrition/fasting"),
        link(Flame, hubInk("amber", dark), tx("ვარჯიში და ენერგია", "Exercise and energy"), d.activities.length ? tx(`დღეს ${d.activities.length} ვარჯიში · ${d.burned.activities} კკალ`, `${d.activities.length} ${d.activities.length === 1 ? "workout" : "workouts"} today · ${d.burned.activities} kcal`) : tx("სირბილი, ძალოვანი, სიარული", "Running, strength, walking"), "/nutrition/activity"),
        link(ChartNoAxesCombined, hubInk("blue", dark), tx("პროგრესი", "Progress"), tx("კვირის შეჯამება, წონის პროგნოზი", "Weekly summary, weight forecast"), "/nutrition/progress"),
        link(Ruler, hubInk("violet", dark), tx("სხეულის ზომები", "Body measurements"), d.measurements[0] ? tx(`ბოლო ჩანაწერი ${nutritionDateLabel(d.measurements[0].date)}`, `Last entry ${nutritionDateLabel(d.measurements[0].date)}`) : tx("წელი, თეძო, მკერდი", "Waist, hips, chest"), "/nutrition/measurements"),
        isFeatureOn("voice", features)
          ? link(Mic, hubInk("rose", dark), tx("უთხარი Medi-ს", "Tell Medi"), tx("„ორი ხინკალი ვჭამე“ — და ჩაიწერება", "“I ate two khinkali” — and it's logged"), "/assistant")
          : link(MessageSquareText, hubInk("rose", dark), tx("მიწერე Medi-ს", "Message Medi"), tx("„ორი ხინკალი ვჭამე“ — და ჩაიწერება", "“I ate two khinkali” — and it's logged"), "/assistant"),
      ].filter(Boolean)
    : [];
  const target = d ? d.facts.weightGoal?.targetKg ?? d.program?.config.targetKg ?? null : null;
  return (
    <NScreen
      title={d ? tx(`დღეს · ${nutritionDateLabel(d.date)}`, `Today · ${nutritionDateLabel(d.date)}`) : tx("კვება", "Nutrition")}
      fallbackHref="/(tabs)/home"
      right={<ModuleHeaderButton label={tx("კვების პარამეტრები", "Nutrition settings")} icon={Settings2} onPress={() => router.push("/nutrition/settings")} />}
    >
      {error ? <NError message={error} retry={() => void load()} /> : loading && !d ? <NLoading /> : null}
      {d && (
        <>
          <View style={{ gap: 8 }}>
            <MedifoodHero d={d} onOpen={() => router.push("/nutrition/diary")} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {dayTile(Droplet, hubInk("sky", dark), d.water.goalMl ? `${(d.water.ml / 1000).toFixed(1)} / ${(d.water.goalMl / 1000).toFixed(1)}` : `${(d.water.ml / 1000).toFixed(1)}`, tx("წყალი, ლ", "Water, L"), "/health-metrics/hydration")}
              {dayTile(Footprints, hubInk("green", dark), d.steps.toLocaleString("en-US").replace(/,/g, " "), tx("ნაბიჯი", "Steps"), "/health-metrics/steps")}
              {dayTile(Flame, hubInk("amber", dark), `${d.burned.total} ${tx("კკალ", "kcal")}`, tx("დამწვარი", "Burned"), "/nutrition/activity")}
            </View>
            <View style={{ paddingHorizontal: 4, marginBottom: -8 }}>
              <MedicalSourcesLink sourceIds={d.targets ? ["energyTarget", "macroRanges", "waterIntake", "activityMet"] : ["waterIntake", "activityMet"]} />
            </View>
          </View>

          <HubSection title={tx("ჩაწერე კვება", "Log food")} linkLabel={tx("დღიური", "Diary")} onLink={() => router.push("/nutrition/diary")}>
            <HubCard style={{ gap: 8, padding: 10 }}>
              <QuickLogTiles tiles={PRIMARY_LOG_TILES} columns={4} />
              <QuickLogTiles tiles={SECONDARY_LOG_TILES} columns={4} />
            </HubCard>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4, marginTop: -4 }}>
              <Sparkles size={14} color={ink} style={{ marginTop: 1 }} />
              <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{tx("AI შეფასებას შენახვამდე ყოველთვის გადაამოწმებ — არაფერი ინახება შენ გარეშე.", "You always check the AI estimate before saving — nothing is saved without you.")}</Text>
            </View>
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
                    <ChevronRight size={18} color={c.text300} />
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
              <HubCard style={{ gap: 0, paddingVertical: 6 }}>
                {d.todayMeals.map((meal, index) => (
                  <Pressable key={meal.id} accessibilityRole="button" onPress={() => router.push("/nutrition/diary")} style={[s.mealRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
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
                lead={
                  <View style={[s.linkIcon, { backgroundColor: hubTint(ink, dark) }]}>
                    <Target size={21} color={ink} strokeWidth={1.8} />
                  </View>
                }
                title={d.needsReview ? tx("გეგმა შენთან ერთად იცვლება", "Your plan changes with you") : tx("შენი მიზანი, შენი ტემპით", "Your goal, your pace")}
                body={d.needsReview ? d.reasons.join(" ") : tx("დაკლება, შენარჩუნება თუ მომატება — დღის ბიუჯეტი, მაკროები და 7 დღის რაციონი ერთ გეგმაში.", "Lose, maintain or gain — a daily budget, macros and a 7-day meal plan, all in one plan.")}
                cta={d.program ? tx("გეგმის გადამოწმება", "Review plan") : tx("ჩემი გეგმის შექმნა", "Create my plan")}
                onPress={() => router.push("/nutrition/goal")}
                note={tx("ეს ორიენტირია, არა ექიმის დანიშნულება.", "This is a guide, not a doctor's prescription.")}
              />
            ) : (
              <HubCard>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[s.linkIcon, { backgroundColor: hubTint(ink, dark) }]}>
                    <Scale size={20} color={ink} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[hubText.caption, { color: c.text200 }]}>{tx("წონის მიზანი", "Weight goal")}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[hubText.value, { color: c.text100, fontSize: 22, lineHeight: 29 }]}>{d.facts.current?.kg ?? "—"}</Text>
                      <ArrowRight size={16} color={c.text300} />
                      <Text style={[hubText.value, { color: ink, fontSize: 22, lineHeight: 29 }]}>
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
                    <Pressable accessibilityRole="button" onPress={() => router.push("/health-metrics/weight")} hitSlop={6} style={[s.smallButton, { backgroundColor: hubTint(ink, dark) }]}>
                      <Text style={[hubText.link, { color: ink }]}>{tx("წონის ჩაწერა", "Log weight")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </HubCard>
            )}
          </HubSection>

          <HubSection title={tx("სერია", "Streak")}>
            <HubCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.linkIcon, { backgroundColor: hubTint(hubInk("amber", dark), dark) }]}>
                  <Trophy size={20} color={hubInk("amber", dark)} strokeWidth={1.9} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 20, lineHeight: 26 }]}>
                    {d.streak.current} <Text style={[hubText.caption, { color: c.text200 }]}>{tx(`დღე ზედიზედ · რეკორდი ${d.streak.best}`, `${d.streak.current === 1 ? "day in a row" : "days in a row"} · best ${d.streak.best}`)}</Text>
                  </Text>
                  <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
                    {d.streak.loggedToday
                      ? d.streak.nextMilestone
                        ? tx(`დღეს ჩაწერილია · შემდეგი ნიშნული ${d.streak.nextMilestone} დღე`, `Logged today · next milestone ${d.streak.nextMilestone} days`)
                        : tx("დღეს ჩაწერილია · ყველა ნიშნული აღებულია", "Logged today · every milestone reached")
                      : d.streak.current > 0
                        ? tx("დღეს ერთი ჩანაწერი — და სერია გრძელდება", "One entry today keeps your streak going")
                        : tx("პირველი ჩანაწერით იწყება · გამოტოვება ვალს არ ქმნის", "Starts with your first entry · a missed day is no debt")}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[3, 7, 14, 30, 60, 100].map((m) => {
                  const reached = d.streak.reached.includes(m);
                  return (
                    <View key={m} accessibilityLabel={tx(`${m} დღე${reached ? ", აღებულია" : ""}`, `${m} days${reached ? ", reached" : ""}`)} style={[s.milestone, { backgroundColor: reached ? ink : c.bg200 }]}>
                      <Text style={[hubText.link, { color: reached ? (dark ? "#022C22" : "#FFFFFF") : c.text300, fontSize: 12 }]}>{m}</Text>
                    </View>
                  );
                })}
              </View>
            </HubCard>
          </HubSection>

          {links.length > 0 && (
            <HubSection title={tx("მეტი", "More")}>
              <HubCard style={{ gap: 0, paddingVertical: 4 }}>
                {links.map((row, index) => (
                  <View key={index} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 } : undefined}>
                    {row}
                  </View>
                ))}
              </HubCard>
            </HubSection>
          )}
          <Pressable accessibilityRole="button" onPress={() => router.push("/nutrition/method")} style={{ paddingVertical: 4, minHeight: 44, justifyContent: "center" }}>
            <Text style={[hubText.caption, { color: c.text300, textAlign: "center" }]}>{tx("როგორ ითვლება გეგმა და რატომ არის შეფასება მიახლოებითი", "How the plan is calculated and why estimates are approximate")}</Text>
          </Pressable>
        </>
      )}
    </NScreen>
  );
}

const s = StyleSheet.create({
  dayTile: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  dayIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  link: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, minHeight: 60 },
  linkIcon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: "center", justifyContent: "center" },
  smallButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  milestone: { flex: 1, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
