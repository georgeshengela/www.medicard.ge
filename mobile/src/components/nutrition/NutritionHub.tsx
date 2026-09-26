import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Droplet,
  Flame,
  Footprints,
  Mic,
  Ruler,
  Scale,
  Settings2,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { mealLabels } from "@/lib/nutrition";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubInk, hubText, hubTint, type HubInk } from "@/theme/hub";
import { HubFeatureCard } from "@/components/home/HubFeatureCard";
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
    <NScreen title="კვება" subtitle="ჩაწერე, გადაამოწმე, გაიგე">
      {error ? <NError message={error} retry={() => void load()} /> : loading && !d ? <NLoading /> : null}
      {d && (
        <>
          <HubSection first title={`დღეს · ${nutritionDateLabel(d.date)}`}>
            <HubCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>დღის ბალანსი</Text>
                {d.streak.current > 0 && (
                  <View style={[s.pill, { backgroundColor: hubTint(hubInk("teal", dark), dark) }]}>
                    <Flame size={13} color={hubInk("teal", dark)} />
                    <Text style={[hubText.small, { color: hubInk("teal", dark), fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{d.streak.current} დღე</Text>
                  </View>
                )}
                <Pressable onPress={() => router.push("/nutrition/settings")} accessibilityRole="button" accessibilityLabel="კვების პარამეტრები" style={s.iconButton}>
                  <Settings2 size={19} color={c.text200} />
                </Pressable>
              </View>
              <EnergyRing value={d.today.calories} target={d.budget ?? d.targets?.calories ?? null} />
              <Text style={[hubText.body, { color: c.text200, textAlign: "center" }]}>
                {d.targets
                  ? d.remaining! >= 0
                    ? `კიდევ ${Math.round(d.remaining!)} კკალ შეგიძლია დღეს`
                    : `დღის ბიუჯეტზე ${Math.abs(Math.round(d.remaining!))} კკალ-ით მეტი — ხვალ ახალი დღეა`
                  : d.program?.active
                    ? "გეგმა გადასამოწმებელია"
                    : "ჩაწერე კვება — მიზანს ქვემოთ აირჩევ"}
              </Text>
              {d.targets && (d.burned.counted > 0 || d.rollover > 0) && (
                <Text style={[hubText.small, { color: c.text300, textAlign: "center" }]}>
                  სამიზნე {d.targets.calories}{d.burned.counted > 0 ? ` + დამწვარი ${d.burned.counted}` : ""}{d.rollover > 0 ? ` + გუშინდელი ${d.rollover}` : ""} = {d.budget} კკალ
                </Text>
              )}
              <MacroRails actual={d.today} target={d.targets} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                {dayTile(Droplet, "sky", d.water.goalMl ? `${(d.water.ml / 1000).toFixed(1)} / ${(d.water.goalMl / 1000).toFixed(1)} ლ` : `${(d.water.ml / 1000).toFixed(1)} ლ`, "წყალი", "/health-metrics/hydration")}
                {dayTile(Footprints, "green", d.steps.toLocaleString("en-US").replace(/,/g, " "), "ნაბიჯი", "/health-metrics/steps")}
                {dayTile(Flame, "amber", `${d.burned.total} კკალ`, "დამწვარი", "/nutrition/activity")}
              </View>
            </HubCard>
          </HubSection>

          <HubSection title="ჩაწერე კვება" linkLabel="დღიური" onLink={() => router.push("/nutrition/diary")}>
            <HubCard style={{ gap: 10 }}>
              <QuickLogTiles tiles={PRIMARY_LOG_TILES} columns={2} />
              <QuickLogTiles tiles={SECONDARY_LOG_TILES} columns={2} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={14} color={c.primary100} />
                <Text style={[hubText.small, { color: c.text200, flex: 1 }]}>AI შეფასებას შენახვამდე ყოველთვის გადაამოწმებ — არაფერი ინახება შენ გარეშე.</Text>
              </View>
            </HubCard>
          </HubSection>

          {d.todayMeals.length > 0 && (
            <HubSection title="დღეს ჩაწერილი" linkLabel="ყველა" onLink={() => router.push("/nutrition/diary")}>
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
                    <Text style={[hubText.value, { color: c.text100 }]}>{Math.round(meal.totals.calories)} <Text style={[hubText.small, { color: c.text300 }]}>კკალ</Text></Text>
                  </Pressable>
                ))}
              </HubCard>
            </HubSection>
          )}

          <HubSection title="შენი მიზანი">
            {!d.program?.active || d.needsReview ? (
              <HubFeatureCard
                tone="spotlight"
                icon={Target}
                title={d.needsReview ? "გეგმა შენთან ერთად იცვლება" : "შენი მიზანი, შენი ტემპით"}
                body={d.needsReview ? d.reasons.join(" ") : "დაკლება, შენარჩუნება თუ მომატება — დღის ბიუჯეტი, მაკროები და 7 დღის რაციონი ერთ გეგმაში."}
                cta={d.program ? "გეგმის გადამოწმება" : "ჩემი გეგმის შექმნა"}
                onPress={() => router.push("/nutrition/goal")}
                note="ეს ორიენტირია, არა ექიმის დანიშნულება."
              />
            ) : (
              <HubCard>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[s.linkIcon, { backgroundColor: hubTint(hubInk("teal", dark), dark) }]}>
                    <Scale size={20} color={hubInk("teal", dark)} strokeWidth={1.9} />
                  </View>
                  <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>წონის მიზანი</Text>
                  <Pressable onPress={() => router.push("/nutrition/goal")} accessibilityRole="button" accessibilityLabel="მიზნის შეცვლა" style={s.iconButton}>
                    <Target size={19} color={c.primary100} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 30, lineHeight: 38 }]}>{d.facts.current?.kg ?? "—"}</Text>
                  <ArrowUpRight size={18} color={c.text300} />
                  <Text style={[hubText.value, { color: c.primary100, fontSize: 30, lineHeight: 38 }]}>{d.facts.weightGoal?.targetKg ?? d.program.config.targetKg} <Text style={[hubText.small, { color: c.text300 }]}>კგ</Text></Text>
                </View>
                <Text style={[hubText.caption, { color: c.text200 }]}>
                  {d.projection.trendEta
                    ? `მიმდინარე ტემპით მიზანს დაახლოებით ${nutritionDateLabel(d.projection.trendEta)}-ს მიაღწევ.`
                    : d.projection.planEta
                      ? `გეგმის ტემპით ორიენტირი: ${nutritionDateLabel(d.projection.planEta)}.`
                      : "დღის სამიზნე გეგმიდანაა. წონას როცა ჩაწერ, პროგნოზიც გამოჩნდება."}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => router.push("/health-metrics/weight")} style={[s.secondary, { backgroundColor: c.bg200 }]}>
                  <Text style={[hubText.link, { color: c.text100 }]}>წონის ჩაწერა</Text>
                </Pressable>
              </HubCard>
            )}
          </HubSection>

          <HubSection title="სერია და ნიშნულები">
            <HubCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[s.linkIcon, { backgroundColor: hubTint(hubInk("amber", dark), dark) }]}>
                  <Trophy size={20} color={hubInk("amber", dark)} strokeWidth={1.9} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 22, lineHeight: 28 }]}>{d.streak.current} <Text style={[hubText.small, { color: c.text200 }]}>დღე ზედიზედ</Text></Text>
                  <Text style={[hubText.small, { color: c.text300 }]}>რეკორდი {d.streak.best} დღე</Text>
                </View>
              </View>
              <Text style={[hubText.caption, { color: c.text200 }]}>
                {d.streak.loggedToday
                  ? d.streak.nextMilestone
                    ? `დღეს ჩაწერილია. შემდეგი ნიშნული ${d.streak.nextMilestone} დღეა.`
                    : "დღეს ჩაწერილია. ყველა ნიშნული აღებულია!"
                  : d.streak.current > 0
                    ? "დღეს ერთი ჩანაწერი — და სერია გრძელდება."
                    : "პირველი ჩანაწერით სერია იწყება. გამოტოვება ვალს არ ქმნის."}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {[3, 7, 14, 30, 60, 100].map((m) => {
                  const reached = d.streak.reached.includes(m);
                  return (
                    <View key={m} style={[s.pill, { backgroundColor: reached ? hubTint(hubInk("teal", dark), dark) : c.bg200 }]}>
                      <Text style={[hubText.small, { color: reached ? hubInk("teal", dark) : c.text300 }]}>{m} დღე</Text>
                    </View>
                  );
                })}
              </View>
            </HubCard>
          </HubSection>

          <HubSection title="მეტი">
            <HubCard style={{ gap: 0, paddingVertical: 4 }}>
              {link(CalendarDays, "teal", "ჩემი რაციონი", "7 დღის კერძები და საყიდლების სია", "/nutrition/plan")}
              {link(Flame, "amber", "ვარჯიში და ენერგია", d.activities.length ? `დღეს ${d.activities.length} ვარჯიში · ${d.burned.activities} კკალ` : "სირბილი, ძალოვანი, სიარული — ბიუჯეტში ჩათვლით", "/nutrition/activity")}
              {link(ChartNoAxesCombined, "blue", "პროგრესი", "კვირის შეჯამება, წონის პროგნოზი, ტენდენციები", "/nutrition/progress")}
              {link(Ruler, "violet", "სხეულის ზომები", d.measurements[0] ? `ბოლო ჩანაწერი ${nutritionDateLabel(d.measurements[0].date)}` : "წელი, თეძო, მკერდი — სასწორის გარდა", "/nutrition/measurements")}
              {link(Mic, "rose", "უთხარი Medi-ს", "„ორი ხინკალი ვჭამე“ — ჩაწერს და დაითვლის", "/assistant")}
              {link(Settings2, "neutral", "პარამეტრები და შეხსენებები", "ბიუჯეტის წესები, კვების შეხსენებები, მეთოდი", "/nutrition/settings", true)}
            </HubCard>
          </HubSection>
          <Pressable accessibilityRole="button" onPress={() => router.push("/nutrition/method")} style={{ paddingVertical: 8 }}>
            <Text style={[hubText.small, { color: c.text300, textAlign: "center" }]}>როგორ ითვლება გეგმა და რატომ არის შეფასება მიახლოებითი →</Text>
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
});
