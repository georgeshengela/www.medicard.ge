import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarCheck2, Ruler, TrendingDown, TrendingUp } from "lucide-react-native";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { useAuth } from "@/store/AuthContext";
import { tx } from "@/i18n/locale";
import { useThemeColors } from "@/theme/colors";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import {
  NScreen,
  NText,
  NCard,
  NButton,
  NError,
  NLoading,
  WeightChart,
  IntakeWeekChart,
  useNutritionDashboard,
} from "@/components/nutrition/ProgramUI";
export default function NutritionProgress() {
  const { user } = useAuth();
  return <Progress key={user?.id || "guest"} />;
}
function Progress() {
  const c = useThemeColors(),
    r = useRouter(),
    { data: d, error, loading, load } = useNutritionDashboard();
  const recorded = d?.days.filter((v) => v.recorded) || [];
  const stat = (value: string, label: string) => (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: c.bg100, borderRadius: 16, padding: 12, gap: 2 }}>
      <NText numberOfLines={1} style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 18, lineHeight: 24 }}>{value}</NText>
      <NText numberOfLines={2} style={{ fontSize: 11, lineHeight: 15, color: c.text200 }}>{label}</NText>
    </View>
  );
  const projection = d?.projection;
  const latest = d?.measurements[0];
  const earlier = d?.measurements.find((m) => m.date !== latest?.date);
  return (
    <NScreen
      title={tx("შენი პროგრესი", "Your progress")}
      subtitle={tx("პატარა ნაბიჯები, თვალსაჩინო ცვლილება", "Small steps, visible change")}
    >
      {!!error && <NError message={error} retry={() => void load()} />}
      {loading && !d && <NLoading />}
      {d && (
        <>
          <NCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <CalendarCheck2 size={18} color={c.primary100} />
              <NText style={{ fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>{tx("კვირის შეჯამება", "Weekly summary")}</NText>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {stat(`${d.week.recordedDays}/7`, tx("დღე ჩანაწერით", "days logged"))}
              {stat(d.week.targetDays ? `${d.week.onTargetDays}/${d.week.targetDays}` : "—", tx("დღე ბიუჯეტში", "days on budget"))}
              {stat(d.week.averageCalories != null ? String(d.week.averageCalories) : "—", tx("კკალ საშუალოდ", "kcal on average"))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {stat(d.week.averageProtein != null ? `${d.week.averageProtein} ${tx("გ", "g")}` : "—", tx("ცილა საშუალოდ", "protein on average"))}
              {stat(d.week.balanceCalories != null ? `${d.week.balanceCalories > 0 ? "+" : ""}${d.week.balanceCalories}` : "—", tx("ბალანსი სამიზნესთან, კკალ", "balance vs target, kcal"))}
              {stat(`${d.streak.current}`, tx("დღე ზედიზედ", "days in a row"))}
            </View>
            <NText style={{ fontSize: 11, color: c.text200 }}>
              {tx("„ბიუჯეტში“ ნიშნავს დღის სამიზნის 60–105%-ს — ეს MEDICARD-ის საკუთარი ორიენტირია. მხოლოდ ჩაწერილი დღეები ითვლება.", "“On budget” means 60–105% of your daily target — this is MEDICARD’s own guide. Only logged days count.")}
            </NText>
            <MedicalSourcesLink sourceIds={["energyTarget"]} />
          </NCard>
          <NCard>
            <NText
              style={{
                fontSize: 18,
                fontFamily: "NotoSansGeorgian_600SemiBold",
              }}
            >
              {tx("კვების ბოლო 7 დღე", "Last 7 days of eating")}
            </NText>
            <NText style={{ fontSize: 13, color: c.text200 }}>
              {tx(`${recorded.length} დღე ჩანაწერით`, `${recorded.length} ${recorded.length === 1 ? "day" : "days"} logged`)} ·{" "}
              {recorded.length
                ? Math.round(
                    recorded.reduce((s, v) => s + v.totals.calories, 0) /
                      recorded.length,
                  )
                : "—"}{" "}
              {tx("კკალ საშუალოდ", "kcal on average")}
            </NText>
            <IntakeWeekChart days={d.days} />
            <NText style={{ fontSize: 11, color: c.text200 }}>
              {tx("შეეხე დღეს დეტალებისთვის. ტირე ნიშნავს, რომ ჩანაწერი არ არის. საშუალო მხოლოდ აღრიცხულ დღეებს ითვლის; არასრული დღიური სრულ მიღებას არ ასახავს.", "Tap a day for details. A dash means no entries. The average counts only logged days; an incomplete diary doesn’t show your full intake.")}
            </NText>
          </NCard>
          <NCard>
            <NText
              style={{
                fontSize: 18,
                fontFamily: "NotoSansGeorgian_600SemiBold",
              }}
            >
              {tx("წონის ცვლილება", "Weight change")}
            </NText>
            <WeightChart points={d.facts.weightHistory} />
            {projection && projection.target != null && projection.current != null && (
              <View style={{ backgroundColor: c.bg100, borderRadius: 16, padding: 14, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {projection.direction === "up" ? <TrendingUp size={17} color={c.primary100} /> : <TrendingDown size={17} color={c.primary100} />}
                  <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>
                    {projection.direction === "reached" ? tx("მიზანი მიღწეულია", "Goal reached") : tx(`მიზნამდე ${Math.abs(projection.remainingKg || 0)} კგ`, `${Math.abs(projection.remainingKg || 0)} kg to go`)}
                  </NText>
                </View>
                <NText style={{ fontSize: 13, color: c.text200, lineHeight: 20 }}>
                  {projection.trendKgPerWeek != null
                    ? tx(`ბოლო კვირების ტემპი: ${projection.trendKgPerWeek > 0 ? "+" : ""}${projection.trendKgPerWeek} კგ/კვირა. `, `Recent pace: ${projection.trendKgPerWeek > 0 ? "+" : ""}${projection.trendKgPerWeek} kg/week. `)
                    : tx("ტემპის დასათვლელად კვირაზე მეტი ინტერვალით მინიმუმ სამი გაზომვა სჭირდება. ", "Working out a pace needs at least three measurements spread over more than a week. ")}
                  {projection.trendEta
                    ? tx(`ამ ტემპით მიზანს დაახლოებით ${nutritionDateLabel(projection.trendEta)}-ს მიაღწევ.`, `At this pace you’ll reach your goal around ${nutritionDateLabel(projection.trendEta)}.`)
                    : projection.planEta
                      ? tx(`გეგმის ტემპით ორიენტირი ${nutritionDateLabel(projection.planEta)}-ია.`, `At the plan’s pace: around ${nutritionDateLabel(projection.planEta)}.`)
                      : projection.trendKgPerWeek != null && projection.direction !== "reached"
                        ? tx("ტენდენცია ჯერ მიზნის მიმართულებით არ მიდის — ეს ნორმალურია, გადაამოწმე გეგმა 2–4 კვირაში.", "The trend isn’t heading toward your goal yet — that’s normal; review your plan in 2–4 weeks.")
                        : ""}
                </NText>
                <NText style={{ fontSize: 11, color: c.text300 }}>{tx("პროგნოზი ორიენტირია, არა დაპირება. წონა კვირის განმავლობაშიც მერყეობს.", "The forecast is a guide, not a promise. Weight shifts even within a week.")}</NText>
                <MedicalSourcesLink sourceIds={["bodyWeightPlanner", "weightPace"]} />
              </View>
            )}
            <NText style={{ fontSize: 12, color: c.text200 }}>
              {tx("ბოლო 28 გაზომვა. დღის რყევა ბუნებრივია — ყურადღება მიაქციე ხანგრძლივ ტენდენციას.", "Last 28 measurements. Daily swings are natural — watch the long-term trend.")}
            </NText>
            <NButton
              label={tx("წონის დამატება", "Add weight")}
              onPress={() => r.push("/health-metrics/weight")}
            />
          </NCard>
          <NCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Ruler size={18} color={c.primary100} />
              <NText style={{ fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>{tx("სხეულის ზომები", "Body measurements")}</NText>
            </View>
            {latest ? (
              <View style={{ gap: 4 }}>
                <NText style={{ fontSize: 12, color: c.text200 }}>{tx("ბოლო ჩანაწერი", "Latest entry")} · {nutritionDateLabel(latest.date)}{earlier ? tx(` · წინა ${nutritionDateLabel(earlier.date)}`, ` · previous ${nutritionDateLabel(earlier.date)}`) : ""}</NText>
                {(
                  [
                    ["waistCm", tx("წელი", "Waist")],
                    ["hipsCm", tx("თეძო", "Hips")],
                    ["chestCm", tx("მკერდი", "Chest")],
                    ["armCm", tx("მკლავი", "Arm")],
                    ["thighCm", tx("ბარძაყი", "Thigh")],
                  ] as const
                )
                  .filter(([key]) => latest[key] != null)
                  .map(([key, label]) => {
                    const diff = earlier?.[key] != null ? Math.round(((latest[key] as number) - (earlier[key] as number)) * 10) / 10 : null;
                    return (
                      <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <NText>{label}</NText>
                        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                          {latest[key]} {tx("სმ", "cm")}{diff != null && diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : ""}
                        </NText>
                      </View>
                    );
                  })}
              </View>
            ) : (
              <NText style={{ color: c.text200 }}>{tx("წელი, თეძო და მკერდი ხშირად სასწორზე ადრე იცვლება. ერთი ჩანაწერი კვირაში საკმარისია.", "Waist, hips and chest often change before the scale does. One entry a week is enough.")}</NText>
            )}
            <NButton secondary label={latest ? tx("ზომების განახლება", "Update measurements") : tx("ზომების დამატება", "Add measurements")} onPress={() => r.push("/nutrition/measurements")} />
          </NCard>
          <NCard>
            <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
              {tx("თანმიმდევრულობა სრულყოფილებაზე წინ", "Consistency over perfection")}
            </NText>
            <NText style={{ color: c.text200 }}>
              {tx("ერთი დღის გადაცდენა ვალს არ ქმნის. არ არის საჭირო კვების გამოტოვება ან ვარჯიშით „ანაზღაურება“. გეგმა გადაამოწმე 2–4 კვირაში, ან თუ მდგომარეობა შეიცვალა.", "One day over is no debt. There’s no need to skip meals or “make up for it” with exercise. Review your plan in 2–4 weeks, or sooner if things change.")}
            </NText>
            <NButton
              secondary
              label={tx("მიზნისა და გეგმის ნახვა", "See goal and plan")}
              onPress={() => r.push("/nutrition/goal")}
            />
          </NCard>
        </>
      )}
    </NScreen>
  );
}
