import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { TrendingDown, TrendingUp } from "lucide-react-native";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { useAuth } from "@/store/AuthContext";
import { useFeature } from "@/lib/featureFlags";
import { tx } from "@/i18n/locale";
import { useThemeColors } from "@/theme/colors";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { HubSection } from "@/components/nutrition/NutritionUi";
import {
  NScreen,
  NText,
  NCard,
  NButton,
  NError,
  NLoading,
  WeightChart,
  IntakeWeekChart,
  useMedifood,
  useNutritionDashboard,
  withMedifood,
} from "@/components/nutrition/ProgramUI";

export default withMedifood(function NutritionProgress() {
  const { user } = useAuth();
  return <Progress key={user?.id || "guest"} />;
});

/** MEDIFOOD · პროგრესი: the week in numbers, the last 7 days, weight with its forecast, tape measurements. */
function Progress() {
  const c = useThemeColors(),
    M = useMedifood(),
    r = useRouter(),
    { data: d, error, loading, load } = useNutritionDashboard();
  const weightOn = useFeature("weight");
  const recorded = d?.days.filter((v) => v.recorded) || [];
  const stat = (value: string, label: string) => (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: c.bg100, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 1 }}>
      <NText numberOfLines={1} style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 18, lineHeight: 24, fontVariant: ["tabular-nums"] }}>{value}</NText>
      <NText numberOfLines={2} style={{ fontSize: 11, lineHeight: 15, color: c.text200 }}>{label}</NText>
    </View>
  );
  const projection = d?.projection;
  const latest = d?.measurements[0];
  const earlier = d?.measurements.find((m) => m.date !== latest?.date);
  return (
    <NScreen title={tx("პროგრესი", "Progress")}>
      {!!error && <NError message={error} retry={() => void load()} />}
      {loading && !d && <NLoading />}
      {d && (
        <>
          <HubSection first title={tx("ეს კვირა", "This week")}>
            <NCard>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {stat(`${d.week.recordedDays}/7`, tx("დღე ჩანაწერით", "days logged"))}
                {stat(d.week.targetDays ? `${d.week.onTargetDays}/${d.week.targetDays}` : "—", tx("დღე ბიუჯეტში", "days on budget"))}
                {stat(d.week.averageCalories != null ? String(d.week.averageCalories) : "—", tx("კკალ საშუალოდ", "kcal on average"))}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {stat(d.week.averageProtein != null ? `${d.week.averageProtein} ${tx("გ", "g")}` : "—", tx("ცილა საშუალოდ", "protein on average"))}
                {stat(d.week.balanceCalories != null ? `${d.week.balanceCalories > 0 ? "+" : ""}${d.week.balanceCalories}` : "—", tx("ბალანსი, კკალ", "balance, kcal"))}
                {stat(`${d.streak.current}`, tx("დღე ზედიზედ", "days in a row"))}
              </View>
              <NText style={{ fontSize: 11, lineHeight: 17, color: c.text300 }}>
                {tx("„ბიუჯეტში“ ნიშნავს დღის სამიზნის 60–105%-ს — ეს MEDICARD-ის საკუთარი ორიენტირია. მხოლოდ ჩაწერილი დღეები ითვლება.", "“On budget” means 60–105% of your daily target — this is MEDICARD’s own guide. Only logged days count.")}
              </NText>
              <MedicalSourcesLink sourceIds={["energyTarget"]} />
            </NCard>
          </HubSection>

          <HubSection title={tx("ბოლო 7 დღე", "Last 7 days")}>
            <NCard>
              <NText style={{ fontSize: 13, color: c.text200 }}>
                {tx(`${recorded.length} დღე ჩანაწერით`, `${recorded.length} ${recorded.length === 1 ? "day" : "days"} logged`)} ·{" "}
                {recorded.length ? Math.round(recorded.reduce((sum, v) => sum + v.totals.calories, 0) / recorded.length) : "—"} {tx("კკალ საშუალოდ", "kcal on average")}
              </NText>
              <IntakeWeekChart days={d.days} />
              <NText style={{ fontSize: 11, lineHeight: 17, color: c.text300 }}>
                {tx("შეეხე დღეს დეტალებისთვის. ტირე ნიშნავს, რომ ჩანაწერი არ არის. საშუალო მხოლოდ აღრიცხულ დღეებს ითვლის; არასრული დღიური სრულ მიღებას არ ასახავს.", "Tap a day for details. A dash means no entries. The average counts only logged days; an incomplete diary doesn’t show your full intake.")}
              </NText>
            </NCard>
          </HubSection>

          <HubSection title={tx("წონა", "Weight")} linkLabel={weightOn ? tx("ჩაწერა", "Log") : undefined} onLink={weightOn ? () => r.push("/health-metrics/weight") : undefined}>
            <NCard>
              <WeightChart points={d.facts.weightHistory} />
              {projection && projection.target != null && projection.current != null && (
                <View style={{ backgroundColor: c.bg100, borderRadius: 16, padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {projection.direction === "up" ? <TrendingUp size={17} color={M.ink} /> : <TrendingDown size={17} color={M.ink} />}
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
                  <NText style={{ fontSize: 11, lineHeight: 17, color: c.text300 }}>{tx("პროგნოზი ორიენტირია, არა დაპირება. წონა კვირის განმავლობაშიც მერყეობს.", "The forecast is a guide, not a promise. Weight shifts even within a week.")}</NText>
                  <MedicalSourcesLink sourceIds={["bodyWeightPlanner", "weightPace"]} />
                </View>
              )}
              <NText style={{ fontSize: 11, lineHeight: 17, color: c.text300 }}>
                {tx("ბოლო 28 გაზომვა. დღის რყევა ბუნებრივია — ყურადღება მიაქციე ხანგრძლივ ტენდენციას.", "Last 28 measurements. Daily swings are natural — watch the long-term trend.")}
              </NText>
            </NCard>
          </HubSection>

          <HubSection title={tx("სხეულის ზომები", "Body measurements")} linkLabel={latest ? tx("განახლება", "Update") : tx("დამატება", "Add")} onLink={() => r.push("/nutrition/measurements")}>
            <NCard style={latest ? { gap: 0, paddingVertical: 8 } : undefined}>
              {latest ? (
                <>
                  <NText style={{ fontSize: 12, color: c.text300, paddingBottom: 4 }}>
                    {nutritionDateLabel(latest.date)}
                    {earlier ? tx(` · შედარება: ${nutritionDateLabel(earlier.date)}`, ` · compared with ${nutritionDateLabel(earlier.date)}`) : ""}
                  </NText>
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
                    .map(([key, label], index) => {
                      const diff = earlier?.[key] != null ? Math.round(((latest[key] as number) - (earlier[key] as number)) * 10) / 10 : null;
                      return (
                        <View key={key} style={{ flexDirection: "row", alignItems: "center", minHeight: 42, borderTopWidth: index ? 0.5 : 0, borderColor: c.bg300 }}>
                          <NText style={{ flex: 1 }}>{label}</NText>
                          {diff != null && diff !== 0 ? (
                            <NText style={{ fontSize: 12, color: c.text300, marginRight: 10 }}>
                              {diff > 0 ? "+" : ""}
                              {diff}
                            </NText>
                          ) : null}
                          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontVariant: ["tabular-nums"] }}>
                            {latest[key]} {tx("სმ", "cm")}
                          </NText>
                        </View>
                      );
                    })}
                </>
              ) : (
                <NText style={{ color: c.text200 }}>{tx("წელი, თეძო და მკერდი ხშირად სასწორზე ადრე იცვლება. ერთი ჩანაწერი კვირაში საკმარისია.", "Waist, hips and chest often change before the scale does. One entry a week is enough.")}</NText>
              )}
            </NCard>
          </HubSection>

          <NCard style={{ backgroundColor: M.inkSoft }}>
            <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{tx("თანმიმდევრულობა სრულყოფილებაზე წინ", "Consistency over perfection")}</NText>
            <NText style={{ color: c.text200, fontSize: 13, lineHeight: 20 }}>
              {tx("ერთი დღის გადაცდენა ვალს არ ქმნის. არ არის საჭირო კვების გამოტოვება ან ვარჯიშით „ანაზღაურება“. გეგმა გადაამოწმე 2–4 კვირაში, ან თუ მდგომარეობა შეიცვალა.", "One day over is no debt. There’s no need to skip meals or “make up for it” with exercise. Review your plan in 2–4 weeks, or sooner if things change.")}
            </NText>
            <NButton secondary label={tx("მიზნისა და გეგმის ნახვა", "See goal and plan")} onPress={() => r.push("/nutrition/goal")} style={{ backgroundColor: c.surface }} />
          </NCard>
        </>
      )}
    </NScreen>
  );
}
