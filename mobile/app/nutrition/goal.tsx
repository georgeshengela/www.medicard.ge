import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { loadWeightGoal } from "@/lib/weightGoal";
import { openWeightGoalWizard } from "@/lib/weightNav";
import { Check, ShieldCheck, Target, Utensils } from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { useThemeColors } from "@/theme/colors";
import {
  nutritionProgramApi,
  applyNutritionSavedState,
  allergenLabels,
  type ProgramConfig,
  type NutritionPreview,
  type AllergyClarification,
} from "@/lib/nutritionProgram";
import { AllergyReview } from "@/components/nutrition/AllergyReview";
import { consumeAssistantPayload } from "@/lib/assistant";
import {
  NScreen,
  NText,
  NCard,
  NButton,
  NError,
  NLoading,
  MacroRails,
  useNutritionDashboard,
} from "@/components/nutrition/ProgramUI";
import { tx } from "@/i18n/locale";
import { formatYmd } from "@/lib/format";
export default function NutritionGoal() {
  const { user } = useAuth();
  return <Goal key={user?.id || "guest"} owner={user?.id || ""} />;
}
function Goal({ owner }: { owner: string }) {
  const { refreshHealthProfile } = useAuth();
  const c = useThemeColors(),
    router = useRouter(),
    { data: d, error: loadError, loading, load } = useNutritionDashboard();
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<NutritionPreview | null>(null),
    [paused, setPaused] = useState(false);
  const [form, setForm] = useState({
    weight: "",
    height: "",
    birth: "",
    sex: "",
    target: "",
    mode: "lose",
    activity: "",
    pace: "gentle",
    diet: "balanced",
    allergens: [] as string[],
    avoidFoods: "",
  });
  const [screening, setScreening] = useState<Record<string, boolean | null>>({
    pregnancyOrBreastfeeding: null,
    eatingDisorder: null,
    medicalDiet: null,
  });
  const [allergyClarifications, setAllergyClarifications] = useState<
    AllergyClarification[]
  >([]);
  const init = useRef(false),
    alive = useRef(true),
    lock = useRef(false),
    launch = useRef<{ targetKg?: number; loseKg?: number } | null>(null);
  useEffect(() => {
    alive.current = true;
    launch.current =
      consumeAssistantPayload(owner, "/nutrition/goal")?.nutritionGoal || null;
    return () => {
      alive.current = false;
    };
  }, [owner]);
  // Coming back from the weight goal wizard: the canonical goal is the target.
  useFocusEffect(
    useCallback(() => {
      if (!init.current) return;
      let active = true;
      void loadWeightGoal().then((goal) => {
        if (!active || !alive.current || !goal) return;
        setForm((current) => {
          const weight = Number(current.weight);
          const mode = weight ? (goal.targetKg < weight ? "lose" : goal.targetKg > weight ? "gain" : "maintain") : current.mode;
          return { ...current, target: String(goal.targetKg), mode };
        });
      });
      return () => {
        active = false;
      };
    }, []),
  );
  useEffect(() => {
    if (!d || init.current) return;
    init.current = true;
    const p = d.program?.config,
      f = d.facts;
    const weight = f.current?.kg || p?.weightKg;
    setAllergyClarifications(
      (p?.allergyClarifications || []).filter((a) =>
        (f.unclassifiedAllergies || []).includes(a.label),
      ),
    );
    const wanted =
      launch.current?.targetKg ??
      (launch.current?.loseKg != null && weight
        ? weight - launch.current.loseKg
        : undefined) ??
      f.weightGoal?.targetKg ??
      p?.targetKg;
    setForm({
      weight: weight ? String(weight) : "",
      height: String(f.heightCm || p?.heightCm || ""),
      birth: f.birthDate || p?.birthDate || "",
      sex: f.sex || p?.sex || "",
      target: wanted ? String(wanted) : "",
      mode:
        wanted && weight
          ? wanted < weight
            ? "lose"
            : wanted > weight
              ? "gain"
              : "maintain"
          : p?.mode || "lose",
      activity: f.activity || p?.activity || "",
      pace: p?.pace || "gentle",
      diet: p?.diet || f.diet,
      allergens: [
        ...new Set([...(p?.allergens || []), ...(f.requiredAllergens || [])]),
      ],
      avoidFoods: p?.avoidFoods || "",
    });
  }, [d]);
  const patch = (key: string, value: unknown) =>
    setForm((v) => ({ ...v, [key]: value }));
  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    Keyboard.dismiss();
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const config = (): ProgramConfig => ({
    mode: form.mode as ProgramConfig["mode"],
    weightKg: Number(form.weight.replace(",", ".")),
    heightCm: Number(form.height.replace(",", ".")),
    birthDate: form.birth,
    sex: form.sex as ProgramConfig["sex"],
    targetKg:
      form.mode === "maintain"
        ? Number(form.weight.replace(",", "."))
        : Number(form.target.replace(",", ".")),
    activity: form.activity as ProgramConfig["activity"],
    pace: form.pace as ProgramConfig["pace"],
    diet: form.diet as ProgramConfig["diet"],
    allergens: [
      ...new Set([
        ...form.allergens,
        ...(d?.facts.requiredAllergens || []),
        ...allergyClarifications
          .filter((a) => a.kind === "food")
          .flatMap((a) => a.allergens),
      ]),
    ],
    allergyClarifications,
    avoidFoods: form.avoidFoods,
    screening: screening as ProgramConfig["screening"],
  });
  const field = (
    label: string,
    key: "weight" | "height" | "birth" | "target" | "avoidFoods",
    numeric = false,
  ) => (
    <View style={{ gap: 6 }}>
      <NText style={{ fontSize: 13 }}>{label}</NText>
      <TextInput
        accessibilityLabel={label}
        value={form[key]}
        onChangeText={(v) => patch(key, v)}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCapitalize="none"
        maxLength={key === "avoidFoods" ? 300 : 20}
        placeholder={key === "birth" ? "1990-05-21" : undefined}
        placeholderTextColor={c.text200}
        style={{
          fontFamily: "NotoSansGeorgian_400Regular",
          color: c.text100,
          fontSize: 16,
          minHeight: 49,
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.bg300,
          borderRadius: 14,
        }}
      />
    </View>
  );
  const choices = (key: string, options: [string, string][]) => (
    <View style={{ gap: 8 }}>
      {options.map(([value, label]) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityState={{ checked: (form as any)[key] === value }}
          onPress={() => patch(key, value)}
          style={{
            padding: 14,
            minHeight: 48,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: (form as any)[key] === value ? c.primary100 : c.bg300,
            backgroundColor:
              (form as any)[key] === value ? c.accent100 : c.surface,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.primary100,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {(form as any)[key] === value && (
              <Check size={14} color={c.primary100} />
            )}
          </View>
          <NText style={{ flex: 1 }}>{label}</NText>
        </Pressable>
      ))}
    </View>
  );
  const next = () => {
    setError("");
    Keyboard.dismiss();
    if (step === 0) {
      const v = config();
      if (
        !v.weightKg ||
        v.weightKg < 30 ||
        v.weightKg > 300 ||
        !v.heightCm ||
        v.heightCm < 130 ||
        v.heightCm > 220 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(form.birth) ||
        !form.sex ||
        !v.targetKg ||
        v.targetKg < 30 ||
        v.targetKg > 300
      ) {
        setError(
          tx("გადაამოწმე წონა (30–300 კგ), სიმაღლე (130–220 სმ), დაბადების თარიღი და ფორმულის კოეფიციენტი.", "Check your weight (30–300 kg), height (130–220 cm), date of birth and formula coefficient."),
        );
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!form.activity) {
        setError(tx("აირჩიე შენი ჩვეულებრივი აქტივობა.", "Choose your usual activity level."));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (Object.values(screening).some((v) => v === null)) {
        setError(tx("უპასუხე სამივე კითხვას, რომ გეგმის შესაბამისობა შევამოწმოთ.", "Answer all three questions so we can check whether the plan suits you."));
        return;
      }
      void run(async () => {
        const v = await nutritionProgramApi.preview(config());
        if (alive.current) {
          setPreview(v);
          setStep(3);
        }
      });
    } else
      void run(async () => {
        const saved = await nutritionProgramApi.save(
          config(),
          d?.program?.revision || null,
        );
        await applyNutritionSavedState(owner, saved);
        if (alive.current) await refreshHealthProfile().catch(() => {});
        if (alive.current) router.replace("/nutrition");
      });
  };
  const back = () => {
    if (busy) return;
    if (step > 0) {
      setStep(step - 1);
      setPreview(null);
      setError("");
    } else router.canGoBack() ? router.back() : router.replace("/nutrition");
  };
  return (
    <NScreen
      title={tx("შენი კვების გეგმა", "Your nutrition plan")}
      subtitle={`${step + 1} / 4 · ${tx(["მიზანი", "შენი ყოველდღიურობა", "შესაბამისობის შემოწმება", "გადაამოწმე და დაიწყე"], ["Goal", "Your routine", "Suitability check", "Review and start"])[step]}`}
      onBack={back}
      footer={
        d && !paused ? (
          <NButton
            disabled={busy || (step === 3 && !preview?.eligible)}
            label={
              busy
                ? tx("მუშავდება…", "Working…")
                : step === 3
                  ? tx("გეგმისა და მიმდინარე წონის შენახვა", "Save plan and current weight")
                  : step === 2
                    ? tx("დღის სამიზნის ნახვა", "See daily target")
                    : tx("გაგრძელება", "Continue")
            }
            onPress={next}
          />
        ) : undefined
      }
    >
      {loading && !d && <NLoading />}
      {!!loadError && <NError message={loadError} retry={() => void load()} />}
      {!!error && <NError message={error} />}
      {d && !paused && (
        <View key={step} style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 3,
                  backgroundColor: i <= step ? c.primary100 : c.bg300,
                }}
              />
            ))}
          </View>
          {step === 0 && (
            <>
              <Target color={c.primary100} size={27} />
              <NText
                style={{
                  fontSize: 22,
                  lineHeight: 32,
                  fontFamily: "NotoSansGeorgian_600SemiBold",
                }}
              >
                {tx("რისკენ მიდიხარ?", "What’s your goal?")}
              </NText>
              {choices("mode", [
                ["lose", tx("წონის დაკლება", "Lose weight")],
                ["maintain", tx("წონის შენარჩუნება", "Maintain weight")],
                ["gain", tx("წონის მომატება", "Gain weight")],
              ])}
              {field(tx("მიმდინარე წონა · კგ", "Current weight · kg"), "weight", true)}
              <NText style={{ fontSize: 11, color: c.text200 }}>
                {tx("შენახვისას ეს წონა დღევანდელ გაზომვად ჩაიწერება.", "When you save, this weight is logged as today’s measurement.")}{" "}
                {d.facts.current?.date
                  ? tx(`ბოლო გაზომვა: ${formatYmd(d.facts.current.date, true)}.`, `Last measurement: ${formatYmd(d.facts.current.date, true)}.`)
                  : tx("პროფილიდან შევსებული მონაცემი გადაამოწმე.", "Check the value filled in from your profile.")}
              </NText>
              {form.mode !== "maintain" && (
                // One weight goal: the target is edited only in the weight wizard.
                <View style={{ gap: 8, padding: 14, borderRadius: 16, backgroundColor: c.bg200 }}>
                  <NText style={{ fontSize: 12, color: c.text200 }}>{tx("სასურველი წონა", "Target weight")}</NText>
                  <NText style={{ fontSize: 20, fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                    {form.target ? tx(`${form.target} კგ`, `${form.target} kg`) : tx("მიზანი ჯერ არ გაქვს", "No goal set yet")}
                  </NText>
                  <NButton
                    secondary
                    disabled={busy}
                    label={form.target ? tx("მიზნის შეცვლა", "Change goal") : tx("მიზნის დასახვა", "Set a goal")}
                    onPress={() => openWeightGoalWizard(router, "/nutrition/goal")}
                  />
                </View>
              )}
              {field(tx("სიმაღლე · სმ", "Height · cm"), "height", true)}
              {field(tx("დაბადების თარიღი · წელი-თვე-დღე", "Date of birth · year-month-day"), "birth")}
              <NText>{tx("ფორმულის სქესობრივი კოეფიციენტი", "Formula sex coefficient")}</NText>
              {choices("sex", [
                ["female", tx("ქალი", "Female")],
                ["male", tx("კაცი", "Male")],
              ])}
              <NText style={{ fontSize: 12, color: c.text200 }}>
                {tx("ფორმულას ორი კოეფიციენტი აქვს. თუ არცერთი შეესაბამება შენს მდგომარეობას, გამოიყენე დღიური და გეგმა სპეციალისტთან შეარჩიე. პროფილის იდენტობა არ იცვლება.", "The formula has two coefficients. If neither fits your situation, use the diary and choose a plan with a specialist. Your profile identity doesn’t change.")}
              </NText>
              {d.program?.active && (
                <NButton
                  secondary
                  disabled={busy}
                  label={tx("კალორიული გეგმის შეჩერება", "Pause calorie plan")}
                  onPress={() =>
                    void run(async () => {
                      await nutritionProgramApi.pause(d.program!.revision);
                      if (alive.current) setPaused(true);
                    })
                  }
                />
              )}
            </>
          )}
          {step === 1 && (
            <>
              <Utensils color={c.primary100} size={27} />
              <NText
                style={{
                  fontSize: 22,
                  lineHeight: 32,
                  fontFamily: "NotoSansGeorgian_600SemiBold",
                }}
              >
                {tx("შენს ცხოვრებას მოერგოს", "Fit it to your life")}
              </NText>
              <NText>{tx("ჩვეულებრივი აქტივობა", "Usual activity")}</NText>
              {choices("activity", [
                ["sedentary", tx("უმეტესად ვზივარ", "Mostly sitting")],
                ["light", tx("მსუბუქად ვმოძრაობ", "Lightly active")],
                ["moderate", tx("რეგულარულად ვვარჯიშობ", "I exercise regularly")],
                ["active", tx("დღის დიდი ნაწილი აქტიური ვარ", "Active most of the day")],
              ])}
              {form.mode === "lose" && (
                <>
                  <NText>{tx("კალორიული ცვლილების ტემპი", "Calorie change pace")}</NText>
                  {choices("pace", [
                    ["gentle", tx("რბილი ცვლილება · −250 კკალ", "Gentle change · −250 kcal")],
                    ["steady", tx("ზომიერი ცვლილება · −400 კკალ", "Moderate change · −400 kcal")],
                  ])}
                </>
              )}
              <NText>{tx("კვების არჩევანი", "Eating style")}</NText>
              {choices("diet", [
                ["balanced", tx("მრავალფეროვანი", "Varied")],
                ["vegetarian", tx("ვეგეტარიანული", "Vegetarian")],
                ["vegan", tx("ვეგანური", "Vegan")],
              ])}
              <NText>{tx("გამოსარიცხი ალერგენები", "Allergens to exclude")}</NText>
              {!!d.facts.requiredAllergens.length && (
                <NText style={{ fontSize: 12, color: c.text200 }}>
                  {tx("პროფილიდან დამატებულია:", "Added from your profile:")}{" "}
                  {d.facts.requiredAllergens
                    .map((a) => allergenLabels[a] || a)
                    .join(", ")}
                  {tx(". მათ ავტომატურად გამოვრიცხავთ. თუ პროფილის ჩანაწერი არასწორია, ის პროფილში შეასწორე.", ". We’ll exclude them automatically. If your profile entry is wrong, fix it in your profile.")}
                </NText>
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(allergenLabels).map(([key, label]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: form.allergens.includes(key),
                      disabled: d.facts.requiredAllergens.includes(key),
                    }}
                    disabled={d.facts.requiredAllergens.includes(key)}
                    onPress={() =>
                      patch(
                        "allergens",
                        form.allergens.includes(key)
                          ? form.allergens.filter((v) => v !== key)
                          : [...form.allergens, key],
                      )
                    }
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 13,
                      paddingVertical: 11,
                      borderRadius: 13,
                      backgroundColor: form.allergens.includes(key)
                        ? c.accent100
                        : c.surface,
                      borderWidth: 1,
                      borderColor: form.allergens.includes(key)
                        ? c.primary100
                        : c.bg300,
                    }}
                  >
                    <NText style={{ fontSize: 12 }}>
                      {form.allergens.includes(key) ? "✓ " : ""}
                      {label}
                    </NText>
                  </Pressable>
                ))}
              </View>
              <AllergyReview
                labels={d.facts.unclassifiedAllergies || []}
                value={allergyClarifications}
                onChange={setAllergyClarifications}
              />
              {field(tx("სხვა საკვები შეზღუდვა · სურვილისამებრ", "Other food restrictions · optional"), "avoidFoods")}
              <NText style={{ fontSize: 12, color: c.text200 }}>
                {tx("სხვა შეზღუდვის მითითებისას ავტომატურ რაციონს არ შევადგენთ, რადგან თავისუფალი ტექსტიდან უსაფრთხო გამორიცხვას ვერ ვადასტურებთ. დღის სამიზნე და დღიური დარჩება.", "If you add other restrictions, we won’t build an automatic meal plan, because we can’t safely confirm exclusions from free text. Your daily target and diary stay available.")}
              </NText>
            </>
          )}
          {step === 2 && (
            <>
              <ShieldCheck color={c.primary100} size={29} />
              <NText
                style={{
                  fontSize: 22,
                  lineHeight: 32,
                  fontFamily: "NotoSansGeorgian_600SemiBold",
                }}
              >
                {tx("შენზე მორგებული ზრუნვა", "Care that fits you")}
              </NText>
              <NText style={{ color: c.text200 }}>
                {tx("რამდენიმე პასუხი გვეხმარება გავიგოთ, გამოგადგება თუ არა ავტომატური გეგმა. დადებითი პასუხისას დღიური კვლავ ხელმისაწვდომია.", "A few answers help us understand whether an automatic plan is right for you. If you answer yes, the diary is still available.")}
              </NText>
              {[
                ["pregnancyOrBreastfeeding", tx("ორსულად ხარ ან ძუძუთი კვებავ?", "Are you pregnant or breastfeeding?")],
                [
                  "eatingDisorder",
                  tx("გაქვს ან გქონია კვებითი აშლილობა, ან ახლა კვებითი ქცევის სირთულე გაწუხებს?", "Do you have or have you ever had an eating disorder, or are you struggling with your eating right now?"),
                ],
                [
                  "medicalDiet",
                  tx("გაქვს ქრონიკული დაავადება, ექიმის მიერ დანიშნული დიეტა ან მდგომარეობა/მკურნალობა, რომელიც კვებაზე მოქმედებს?", "Do you have a chronic condition, a diet prescribed by a doctor, or a condition or treatment that affects how you eat?"),
                ],
              ].map(([key, label]) => (
                <NCard key={key}>
                  <NText>{label}</NText>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {[false, true].map((v) => (
                      <Pressable
                        key={String(v)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: screening[key] === v }}
                        onPress={() =>
                          setScreening((s) => ({ ...s, [key]: v }))
                        }
                        style={{
                          flex: 1,
                          minHeight: 46,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 13,
                          borderWidth: 1,
                          borderColor:
                            screening[key] === v ? c.primary100 : c.bg300,
                          backgroundColor:
                            screening[key] === v ? c.accent100 : c.bg100,
                        }}
                      >
                        <NText>{v ? tx("კი", "Yes") : tx("არა", "No")}</NText>
                      </Pressable>
                    ))}
                  </View>
                </NCard>
              ))}
            </>
          )}
          {step === 3 && preview && (
            <>
              {preview.eligible && preview.targets ? (
                <>
                  <NCard>
                    <NText>{tx("შენი საწყისი დღის სამიზნე", "Your starting daily target")}</NText>
                    <NText
                      style={{
                        fontSize: 39,
                        lineHeight: 53,
                        fontFamily: "NotoSansGeorgian_700Bold",
                      }}
                    >
                      {preview.targets.calories} <NText>{tx("კკალ", "kcal")}</NText>
                    </NText>
                    <MacroRails actual={preview.targets} target={null} />
                    <NText style={{ fontSize: 12, color: c.text200 }}>
                      {tx("დაკლების/მომატების ზუსტი თარიღი გარანტირებული არ არის. ეს საწყისი შეფასებაა, არა მკაცრი დღიური ლიმიტი.", "An exact date for losing or gaining weight isn’t guaranteed. This is a starting estimate, not a strict daily limit.")}
                    </NText>
                  </NCard>
                  <NText>{preview.explanation}</NText>
                  {preview.mealPlanning && !preview.mealPlanning.eligible && (
                    <NCard>
                      <NText
                        style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}
                      >
                        {tx("დღის სამიზნე მზადაა · რაციონს დაზუსტება სჭირდება", "Daily target ready · meal plan needs more detail")}
                      </NText>
                      {preview.mealPlanning.reasons.map((reason) => (
                        <NText
                          key={reason}
                          style={{ fontSize: 13, color: c.text200 }}
                        >
                          {reason}
                        </NText>
                      ))}
                      <NText style={{ fontSize: 12 }}>
                        {tx("შეგიძლია მიზანი შეინახო და კვება დღიურში აღრიცხო. კერძების ავტომატურ შერჩევას დაზუსტების შემდეგ ჩავრთავთ.", "You can save your goal and log meals in the diary. We’ll turn on automatic meal suggestions once the details are clear.")}
                      </NText>
                      <NButton
                        secondary
                        label={tx("კვების არჩევანის დაზუსტება", "Refine eating style")}
                        onPress={() => {
                          setStep(1);
                          setPreview(null);
                        }}
                      />
                    </NCard>
                  )}
                  <NText style={{ fontSize: 12, color: c.text200 }}>
                    {tx("შენახვა განაახლებს აპში შენს საერთო წონის მიზანს. რაციონს შემდეგ ეტაპზე შეადგენ.", "Saving updates your weight goal across the app. You’ll build your meal plan in the next step.")}
                  </NText>
                </>
              ) : (
                <NCard>
                  <NText
                    style={{
                      fontSize: 19,
                      fontFamily: "NotoSansGeorgian_600SemiBold",
                    }}
                  >
                    {tx("გეგმა სპეციალისტთან შეარჩიე", "Choose a plan with a specialist")}
                  </NText>
                  {preview.reasons.map((v) => (
                    <NText key={v}>{v}</NText>
                  ))}
                  <NButton
                    label={tx("კვების დღიურზე გადასვლა", "Go to food diary")}
                    onPress={() => router.replace("/nutrition/diary")}
                  />
                </NCard>
              )}
              <NButton
                secondary
                label={tx("მეთოდი და წყაროები", "Method and sources")}
                onPress={() => router.push("/nutrition/method")}
              />
            </>
          )}
        </View>
      )}
      {paused && (
        <NCard>
          <NText>
            {tx("გეგმა შეჩერებულია. დღიური, ჩანაწერები და წონის მიზანი შენახულია.", "Plan paused. Your diary, entries and weight goal are saved.")}
          </NText>
          <NButton
            label={tx("კვებაზე დაბრუნება", "Back to nutrition")}
            onPress={() => router.replace("/nutrition")}
          />
        </NCard>
      )}
    </NScreen>
  );
}
