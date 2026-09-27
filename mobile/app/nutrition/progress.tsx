import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { CalendarCheck2, Ruler, TrendingDown, TrendingUp } from "lucide-react-native";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { useAuth } from "@/store/AuthContext";
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
      title="შენი პროგრესი"
      subtitle="პატარა ნაბიჯები, თვალსაჩინო ცვლილება"
    >
      {!!error && <NError message={error} retry={() => void load()} />}
      {loading && !d && <NLoading />}
      {d && (
        <>
          <NCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <CalendarCheck2 size={18} color={c.primary100} />
              <NText style={{ fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>კვირის შეჯამება</NText>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {stat(`${d.week.recordedDays}/7`, "დღე ჩანაწერით")}
              {stat(d.week.targetDays ? `${d.week.onTargetDays}/${d.week.targetDays}` : "—", "დღე ბიუჯეტში")}
              {stat(d.week.averageCalories != null ? String(d.week.averageCalories) : "—", "კკალ საშუალოდ")}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {stat(d.week.averageProtein != null ? `${d.week.averageProtein} გ` : "—", "ცილა საშუალოდ")}
              {stat(d.week.balanceCalories != null ? `${d.week.balanceCalories > 0 ? "+" : ""}${d.week.balanceCalories}` : "—", "ბალანსი სამიზნესთან, კკალ")}
              {stat(`${d.streak.current}`, "დღე ზედიზედ")}
            </View>
            <NText style={{ fontSize: 11, color: c.text200 }}>
              „ბიუჯეტში“ ნიშნავს დღის სამიზნის 60–105%-ს — ეს MEDICARD-ის საკუთარი ორიენტირია. მხოლოდ ჩაწერილი დღეები ითვლება.
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
              კვების ბოლო 7 დღე
            </NText>
            <NText style={{ fontSize: 13, color: c.text200 }}>
              {recorded.length} დღე ჩანაწერით ·{" "}
              {recorded.length
                ? Math.round(
                    recorded.reduce((s, v) => s + v.totals.calories, 0) /
                      recorded.length,
                  )
                : "—"}{" "}
              კკალ საშუალოდ
            </NText>
            <IntakeWeekChart days={d.days} />
            <NText style={{ fontSize: 11, color: c.text200 }}>
              შეეხე დღეს დეტალებისთვის. ტირე ნიშნავს, რომ ჩანაწერი არ არის.
              საშუალო მხოლოდ აღრიცხულ დღეებს ითვლის; არასრული დღიური სრულ
              მიღებას არ ასახავს.
            </NText>
          </NCard>
          <NCard>
            <NText
              style={{
                fontSize: 18,
                fontFamily: "NotoSansGeorgian_600SemiBold",
              }}
            >
              წონის ცვლილება
            </NText>
            <WeightChart points={d.facts.weightHistory} />
            {projection && projection.target != null && projection.current != null && (
              <View style={{ backgroundColor: c.bg100, borderRadius: 16, padding: 14, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {projection.direction === "up" ? <TrendingUp size={17} color={c.primary100} /> : <TrendingDown size={17} color={c.primary100} />}
                  <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>
                    {projection.direction === "reached" ? "მიზანი მიღწეულია" : `მიზნამდე ${Math.abs(projection.remainingKg || 0)} კგ`}
                  </NText>
                </View>
                <NText style={{ fontSize: 13, color: c.text200, lineHeight: 20 }}>
                  {projection.trendKgPerWeek != null
                    ? `ბოლო კვირების ტემპი: ${projection.trendKgPerWeek > 0 ? "+" : ""}${projection.trendKgPerWeek} კგ/კვირა. `
                    : "ტემპის დასათვლელად კვირაზე მეტი ინტერვალით მინიმუმ სამი გაზომვა სჭირდება. "}
                  {projection.trendEta
                    ? `ამ ტემპით მიზანს დაახლოებით ${nutritionDateLabel(projection.trendEta)}-ს მიაღწევ.`
                    : projection.planEta
                      ? `გეგმის ტემპით ორიენტირი ${nutritionDateLabel(projection.planEta)}-ია.`
                      : projection.trendKgPerWeek != null && projection.direction !== "reached"
                        ? "ტენდენცია ჯერ მიზნის მიმართულებით არ მიდის — ეს ნორმალურია, გადაამოწმე გეგმა 2–4 კვირაში."
                        : ""}
                </NText>
                <NText style={{ fontSize: 11, color: c.text300 }}>პროგნოზი ორიენტირია, არა დაპირება. წონა კვირის განმავლობაშიც მერყეობს.</NText>
                <MedicalSourcesLink sourceIds={["bodyWeightPlanner", "weightPace"]} />
              </View>
            )}
            <NText style={{ fontSize: 12, color: c.text200 }}>
              ბოლო 28 გაზომვა. დღის რყევა ბუნებრივია — ყურადღება მიაქციე
              ხანგრძლივ ტენდენციას.
            </NText>
            <NButton
              label="წონის დამატება"
              onPress={() => r.push("/health-metrics/weight")}
            />
          </NCard>
          <NCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Ruler size={18} color={c.primary100} />
              <NText style={{ fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>სხეულის ზომები</NText>
            </View>
            {latest ? (
              <View style={{ gap: 4 }}>
                <NText style={{ fontSize: 12, color: c.text200 }}>ბოლო ჩანაწერი · {nutritionDateLabel(latest.date)}{earlier ? ` · წინა ${nutritionDateLabel(earlier.date)}` : ""}</NText>
                {(
                  [
                    ["waistCm", "წელი"],
                    ["hipsCm", "თეძო"],
                    ["chestCm", "მკერდი"],
                    ["armCm", "მკლავი"],
                    ["thighCm", "ბარძაყი"],
                  ] as const
                )
                  .filter(([key]) => latest[key] != null)
                  .map(([key, label]) => {
                    const diff = earlier?.[key] != null ? Math.round(((latest[key] as number) - (earlier[key] as number)) * 10) / 10 : null;
                    return (
                      <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <NText>{label}</NText>
                        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                          {latest[key]} სმ{diff != null && diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff})` : ""}
                        </NText>
                      </View>
                    );
                  })}
              </View>
            ) : (
              <NText style={{ color: c.text200 }}>წელი, თეძო და მკერდი ხშირად სასწორზე ადრე იცვლება. ერთი ჩანაწერი კვირაში საკმარისია.</NText>
            )}
            <NButton secondary label={latest ? "ზომების განახლება" : "ზომების დამატება"} onPress={() => r.push("/nutrition/measurements")} />
          </NCard>
          <NCard>
            <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
              თანმიმდევრულობა სრულყოფილებაზე წინ
            </NText>
            <NText style={{ color: c.text200 }}>
              ერთი დღის გადაცდენა ვალს არ ქმნის. არ არის საჭირო კვების
              გამოტოვება ან ვარჯიშით „ანაზღაურება“. გეგმა გადაამოწმე 2–4
              კვირაში, ან თუ მდგომარეობა შეიცვალა.
            </NText>
            <NButton
              secondary
              label="მიზნისა და გეგმის ნახვა"
              onPress={() => r.push("/nutrition/goal")}
            />
          </NCard>
        </>
      )}
    </NScreen>
  );
}
