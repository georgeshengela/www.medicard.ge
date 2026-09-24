import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  Camera,
  CalendarDays,
  ChartNoAxesCombined,
  Target,
  Mic,
  Scale,
  Leaf,
} from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { useThemeColors } from "@/theme/colors";
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
            <NText style={{ color: c.text200, fontSize: 12 }}>
              დღეს · {nutritionDateLabel(d.date)}
            </NText>
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
              <Pressable
                onPress={() => router.push("/nutrition/goal")}
                accessibilityRole="button"
                accessibilityLabel="კვების მიზნის მართვა"
                style={{ padding: 10 }}
              >
                <Target size={20} color={c.primary100} />
              </Pressable>
            </View>
            <EnergyRing
              value={d.today.calories}
              target={d.targets?.calories || null}
            />
            <NText
              style={{ textAlign: "center", color: c.text200, fontSize: 13 }}
            >
              {d.targets
                ? d.remaining! >= 0
                  ? `დღის სამიზნემდე ${Math.round(d.remaining!)} კკალ`
                  : `სამიზნეზე ${Math.abs(Math.round(d.remaining!))} კკალ-ით მეტი`
                : d.program?.active
                  ? "გეგმა გადასამოწმებელია"
                  : "აღრიცხე კვება და შეარჩიე შენი მიზანი"}
            </NText>
            <MacroRails actual={d.today} target={d.targets} />
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
              subtitle={`${d.mealCount} ჩანაწერი დღეს · ფოტო ან ხელით`}
              icon={<Camera color={c.primary100} size={21} />}
              onPress={() => router.push("/nutrition/diary")}
            />
            <View style={{ height: 1, backgroundColor: c.bg300 }} />
            <NLink
              title="ჩემი პროგრესი"
              subtitle="კვების და წონის ტენდენციები"
              icon={<ChartNoAxesCombined color={c.primary100} size={21} />}
              onPress={() => router.push("/nutrition/progress")}
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
                იგივე მიზანი ჩანს წონის გვერდზეც და Medi-სთანაც.
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
            subtitle="„დღეს რამდენი კალორია აღვრიცხე?“"
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
