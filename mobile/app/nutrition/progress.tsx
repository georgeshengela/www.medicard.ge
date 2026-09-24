import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/store/AuthContext";
import { useThemeColors } from "@/theme/colors";
import {
  NScreen,
  NText,
  NCard,
  NButton,
  NError,
  NLoading,
  WeightChart,
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
  const max = Math.max(
    1,
    ...(d?.days.map((v) =>
      Math.max(v.totals.calories, v.target?.calories || 0),
    ) || []),
  );
  return (
    <NScreen
      title="შენი პროგრესი"
      subtitle="პატარა ნაბიჯები, თვალსაჩინო ცვლილება"
    >
      {error && <NError message={error} retry={() => void load()} />}{" "}
      {loading && !d && <NLoading />}
      {d && (
        <>
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
            <View style={{ flexDirection: "row", gap: 9, paddingTop: 16 }}>
              {d.days.map((v) => (
                <View
                  key={v.date}
                  accessible
                  accessibilityLabel={`${v.date}: ${v.recorded ? v.totals.calories + " აღრიცხული კკალ" : "ჩანაწერი არ არის"}${v.target ? ", სამიზნე " + v.target.calories : ""}`}
                  style={{ flex: 1, alignItems: "center", gap: 7 }}
                >
                  <View
                    style={{
                      height: 148,
                      width: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    {v.target && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: (v.target.calories / max) * 140,
                          height: 2,
                          width: "100%",
                          backgroundColor: c.text200,
                        }}
                      />
                    )}
                    <View
                      style={{
                        height: v.recorded
                          ? Math.max(4, (v.totals.calories / max) * 140)
                          : 3,
                        backgroundColor: v.recorded ? c.primary100 : c.bg300,
                        borderRadius: 5,
                        width: "65%",
                        alignSelf: "center",
                      }}
                    />
                  </View>
                  <NText
                    style={{ fontSize: 10, lineHeight: 15, color: c.text200 }}
                  >
                    {v.date.slice(8)}
                  </NText>
                  <NText style={{ fontSize: 9, lineHeight: 13 }}>
                    {v.recorded ? v.totals.calories : "—"}
                  </NText>
                </View>
              ))}
            </View>
            <NText style={{ fontSize: 11, color: c.text200 }}>
              ხაზი — იმ დღის სამიზნე · ტირე — ჩანაწერი არ არის. საშუალო მხოლოდ
              აღრიცხულ დღეებს ითვლის; არასრული დღიური სრულ მიღებას არ ასახავს.
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
