import React from "react";
import { View, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  Camera,
  CalendarDays,
  ChartNoAxesCombined,
  Droplet,
  Flame,
  Footprints,
  Leaf,
  Mic,
  Ruler,
  Scale,
  Settings2,
  Target,
  Trophy,
} from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { mealLabels } from "@/lib/nutrition";
import { useThemeColors } from "@/theme/colors";
import { hubText } from "@/theme/hub";
import {
  NScreen,
  NText,
  NCard,
  NButton,
  NLink,
  NLoading,
  NError,
  EnergyRing,
  MacroRails,
  useNutritionDashboard,
} from "./ProgramUI";
export default function Nutrition() {
  const { user } = useAuth();
  return <Hub key={user?.id || "guest"} />;
}
function Hub() {
  const c = useThemeColors(),
    router = useRouter(),
    { data: d, error, loading, load } = useNutritionDashboard();
  const stat = (icon: React.ReactNode, value: string, label: string, onPress?: () => void) => (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value}`}
      disabled={!onPress}
      onPress={onPress}
      style={{ flex: 1, minWidth: 0, backgroundColor: c.bg100, borderRadius: 16, padding: 12, gap: 4 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <NText numberOfLines={1} style={{ fontSize: 11, lineHeight: 16, color: c.text200, flex: 1 }}>{label}</NText>
      </View>
      <NText numberOfLines={1} style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 15, lineHeight: 21 }}>{value}</NText>
    </Pressable>
  );
  return (
    <NScreen
      title="კვება შენს რიტმში"
      subtitle="მიზანი · რაციონი · ყოველდღიური პროგრესი"
    >
      {error ? (
        <NError message={error} retry={() => void load()} />
      ) : loading && !d ? (
        <NLoading />
      ) : null}
      {d && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Leaf color={c.primary100} size={17} />
            <NText style={{ color: c.text200, fontSize: 12, flex: 1 }}>
              დღეს · {nutritionDateLabel(d.date)}
            </NText>
            {d.streak.current > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.accent100, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                <Flame size={14} color={c.primary100} />
                <NText style={{ fontSize: 12, color: c.primary100, fontFamily: "NotoSansGeorgian_600SemiBold" }}>{d.streak.current} დღე</NText>
              </View>
            )}
          </View>
          <NCard>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                დღის ბალანსი
              </NText>
              <View style={{ flexDirection: "row" }}>
                <Pressable
                  onPress={() => router.push("/nutrition/settings")}
                  accessibilityRole="button"
                  accessibilityLabel="კვების პარამეტრები"
                  style={{ padding: 10 }}
                >
                  <Settings2 size={20} color={c.text200} />
                </Pressable>
                <Pressable
                  onPress={() => router.push("/nutrition/goal")}
                  accessibilityRole="button"
                  accessibilityLabel="კვების მიზნის მართვა"
                  style={{ padding: 10 }}
                >
                  <Target size={20} color={c.primary100} />
                </Pressable>
              </View>
            </View>
            <EnergyRing
              value={d.today.calories}
              target={d.budget ?? d.targets?.calories ?? null}
            />
            <NText
              style={{ textAlign: "center", color: c.text200, fontSize: 13 }}
            >
              {d.targets
                ? d.remaining! >= 0
                  ? `დღის ბიუჯეტამდე ${Math.round(d.remaining!)} კკალ`
                  : `ბიუჯეტზე ${Math.abs(Math.round(d.remaining!))} კკალ-ით მეტი`
                : d.program?.active
                  ? "გეგმა გადასამოწმებელია"
                  : "აღრიცხე კვება და შეარჩიე შენი მიზანი"}
            </NText>
            {d.targets && (d.burned.counted > 0 || d.rollover > 0) && (
              <NText style={{ textAlign: "center", color: c.text300, fontSize: 11 }}>
                სამიზნე {d.targets.calories}
                {d.burned.counted > 0 ? ` + დამწვარი ${d.burned.counted}` : ""}
                {d.rollover > 0 ? ` + გუშინდელი ${d.rollover}` : ""} = {d.budget} კკალ
              </NText>
            )}
            <MacroRails actual={d.today} target={d.targets} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {stat(<Droplet size={14} color={c.primary100} />, d.water.goalMl ? `${(d.water.ml / 1000).toFixed(1)} / ${(d.water.goalMl / 1000).toFixed(1)} ლ` : `${(d.water.ml / 1000).toFixed(1)} ლ`, "წყალი", () => router.push("/health-metrics/hydration"))}
              {stat(<Footprints size={14} color={c.primary100} />, d.steps.toLocaleString("en-US").replace(/,/g, " "), "ნაბიჯი", () => router.push("/health-metrics/steps"))}
              {stat(<Flame size={14} color={c.primary100} />, `${d.burned.total} კკალ`, "დამწვარი", () => router.push("/nutrition/activity"))}
            </View>
            <NButton
              label="კვების დამატება"
              onPress={() => router.push("/nutrition/diary")}
            />
            <NText
              style={{ fontSize: 11, color: c.text200, textAlign: "center" }}
            >
              ითვლება მხოლოდ შენახული კვება · შეფასებები მიახლოებითია
            </NText>
          </NCard>
          {d.todayMeals.length > 0 && (
            <NCard style={{ gap: 8 }}>
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>დღეს ჩაწერილი</NText>
              {d.todayMeals.map((meal) => (
                <Pressable key={meal.id} accessibilityRole="button" onPress={() => router.push("/nutrition/diary")} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
                  <View style={{ flex: 1 }}>
                    <NText numberOfLines={1} style={{ fontSize: 14 }}>{meal.title || meal.names.join(" · ")}</NText>
                    <NText style={{ fontSize: 11, color: c.text200 }}>{mealLabels[meal.type]} · ც {Math.round(meal.totals.protein)} · ნ {Math.round(meal.totals.carbs)} · ცხ {Math.round(meal.totals.fat)} გ</NText>
                  </View>
                  <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{Math.round(meal.totals.calories)}</NText>
                </Pressable>
              ))}
            </NCard>
          )}
          {(!d.program?.active || d.needsReview) && (
            <NCard style={{ backgroundColor: c.accent100 }}>
              <NText
                style={{
                  fontSize: 19,
                  lineHeight: 28,
                  fontFamily: "NotoSansGeorgian_600SemiBold",
                }}
              >
                {d.needsReview
                  ? "გეგმა შენთან ერთად იცვლება"
                  : "შენი მიზანი, შენი ტემპით"}
              </NText>
              <NText style={{ color: c.text200 }}>
                {d.needsReview
                  ? d.reasons.join(" ")
                  : "დაკლება, შენარჩუნება თუ მომატება — დღის სამიზნე და რაციონი ერთ გეგმაში."}
              </NText>
              <NButton
                label={d.program ? "გეგმის გადამოწმება" : "ჩემი გეგმის შექმნა"}
                onPress={() => router.push("/nutrition/goal")}
              />
            </NCard>
          )}
          <NCard style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Trophy size={18} color={c.primary100} />
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>თანმიმდევრობა</NText>
              <NText style={{ fontSize: 12, color: c.text200 }}>რეკორდი {d.streak.best} დღე</NText>
            </View>
            <Text style={[hubText.value, { color: c.text100, fontSize: 28, lineHeight: 36 }]}>
              {d.streak.current} <Text style={[hubText.small, { color: c.text200 }]}>დღე ზედიზედ</Text>
            </Text>
            <NText style={{ fontSize: 12, color: c.text200 }}>
              {d.streak.loggedToday
                ? d.streak.nextMilestone
                  ? `დღეს ჩაწერილია. შემდეგი ნიშნული: ${d.streak.nextMilestone} დღე.`
                  : "დღეს ჩაწერილია. ყველა ნიშნული აღებულია!"
                : d.streak.current > 0
                  ? "დღეს ერთი ჩანაწერი — და სერია გრძელდება."
                  : "პირველი ჩანაწერით სერია იწყება. კვირაში ერთი გამოტოვება ბუნებრივია."}
            </NText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {[3, 7, 14, 30, 60, 100].map((m) => {
                const reached = d.streak.reached.includes(m);
                return (
                  <View key={m} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: reached ? c.accent100 : c.bg200 }}>
                    <NText style={{ fontSize: 11, color: reached ? c.primary100 : c.text300 }}>{m} დღე</NText>
                  </View>
                );
              })}
            </View>
          </NCard>
          <View>
            <NLink
              title="ჩემი რაციონი"
              subtitle="7 დღე · კერძები · საყიდლების სია"
              icon={<CalendarDays color={c.primary100} size={21} />}
              onPress={() => router.push("/nutrition/plan")}
            />
            <View style={{ height: 1, backgroundColor: c.bg300 }} />
            <NLink
              title="კვების დღიური"
              subtitle={`${d.mealCount} ჩანაწერი დღეს · ფოტო, შტრიხკოდი, ეტიკეტი, ძებნა, ხმა`}
              icon={<Camera color={c.primary100} size={21} />}
              onPress={() => router.push("/nutrition/diary")}
            />
            <View style={{ height: 1, backgroundColor: c.bg300 }} />
            <NLink
              title="ვარჯიში და ენერგია"
              subtitle={d.activities.length ? `დღეს ${d.activities.length} ვარჯიში · ${d.burned.activities} კკალ` : "სირბილი, ძალოვანი, სიარული — და ბიუჯეტში ჩათვლა"}
              icon={<Flame color={c.primary100} size={21} />}
              onPress={() => router.push("/nutrition/activity")}
            />
            <View style={{ height: 1, backgroundColor: c.bg300 }} />
            <NLink
              title="ჩემი პროგრესი"
              subtitle="კვირის შეჯამება, წონის პროგნოზი და ტენდენციები"
              icon={<ChartNoAxesCombined color={c.primary100} size={21} />}
              onPress={() => router.push("/nutrition/progress")}
            />
            <View style={{ height: 1, backgroundColor: c.bg300 }} />
            <NLink
              title="სხეულის ზომები"
              subtitle={d.measurements[0] ? `ბოლო ჩანაწერი ${nutritionDateLabel(d.measurements[0].date)}` : "წელი, თეძო, მკერდი — სასწორის გარდა"}
              icon={<Ruler color={c.primary100} size={21} />}
              onPress={() => router.push("/nutrition/measurements")}
            />
          </View>
          {d.facts.weightGoal && (
            <NCard>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <Scale size={18} color={c.primary100} />
                <NText>ერთი საერთო მიზანი</NText>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <NText
                  style={{
                    fontSize: 27,
                    lineHeight: 38,
                    fontFamily: "NotoSansGeorgian_600SemiBold",
                  }}
                >
                  {d.facts.current?.kg ?? "—"}
                </NText>
                <ArrowUpRight size={20} color={c.text200} />
                <NText
                  style={{
                    fontSize: 27,
                    lineHeight: 38,
                    color: c.primary100,
                    fontFamily: "NotoSansGeorgian_600SemiBold",
                  }}
                >
                  {d.facts.weightGoal.targetKg} კგ
                </NText>
              </View>
              <NText style={{ fontSize: 12, color: c.text200 }}>
                {d.projection.trendEta
                  ? `მიმდინარე ტემპით მიზანს დაახლოებით ${nutritionDateLabel(d.projection.trendEta)}-ს მიაღწევ.`
                  : d.projection.planEta
                    ? `გეგმის ტემპით ორიენტირი: ${nutritionDateLabel(d.projection.planEta)}.`
                    : "იგივე მიზანი ჩანს წონის გვერდზეც და Medi-სთანაც."}
              </NText>
              <NButton
                secondary
                label="წონის აღრიცხვა"
                onPress={() => router.push("/health-metrics/weight")}
              />
            </NCard>
          )}
          <NLink
            title="დაელაპარაკე Medi-ს"
            subtitle="„ორი ხინკალი ვჭამე“ — Medi ჩაწერს და დაითვლის"
            icon={<Mic color={c.primary100} size={21} />}
            onPress={() => router.push("/assistant")}
          />
          <NButton
            secondary
            label="როგორ გამოითვლება გეგმა?"
            onPress={() => router.push("/nutrition/method")}
          />
        </>
      )}
    </NScreen>
  );
}
