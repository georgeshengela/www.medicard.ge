import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, View, type ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { loadWeightGoal } from "@/lib/weightGoal";
import { openWeightGoalWizard } from "@/lib/weightNav";
import { Pause, ShieldCheck, Target, Utensils } from "lucide-react-native";
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
  NHeading,
  NLabel,
  NChoiceList,
  NSegment,
  NChip,
  NField,
  MacroRails,
  useMedifood,
  useNutritionDashboard,
  withMedifood,
} from "@/components/nutrition/ProgramUI";
import { tx } from "@/i18n/locale";
import { formatYmd } from "@/lib/format";
export default withMedifood(function NutritionGoal() {
  const { user } = useAuth();
  return <Goal key={user?.id || "guest"} owner={user?.id || ""} />;
});
function Goal({ owner }: { owner: string }) {
  const { refreshHealthProfile } = useAuth();
  const c = useThemeColors(),
    M = useMedifood(),
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
    launch = useRef<{ targetKg?: number; loseKg?: number } | null>(null),
    scroll = useRef<ScrollView | null>(null);
  // Every step starts at its top.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
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
  const composeNext = !!preview?.eligible && preview.mealPlanning?.eligible !== false;
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
        // The plan is saved: go straight on to composing the menu (the plate animation) when meal
        // planning is open for this person; otherwise back to the hub.
        if (alive.current) router.replace((composeNext ? { pathname: "/nutrition/plan", params: { compose: "1" } } : "/nutrition") as never);
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
      title={tx(`კვების გეგმა · ${step + 1}/4`, `Nutrition plan · ${step + 1}/4`)}
      onBack={back}
      scrollRef={scroll}
      footer={
        d && !paused ? (
          <NButton
            disabled={busy || (step === 3 && !preview?.eligible)}
            label={
              busy
                ? tx("მუშავდება…", "Working…")
                : step === 3
                  ? composeNext
                    ? tx("შენახვა და რაციონის შედგენა", "Save and compose my meal plan")
                    : tx("გეგმის შენახვა", "Save plan")
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
        <View key={step} style={{ gap: 16 }}>
          <View accessible accessibilityLabel={tx(`ნაბიჯი ${step + 1} 4-დან`, `Step ${step + 1} of 4`)} style={{ flexDirection: "row", gap: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? M.ink : c.bg300 }} />
            ))}
          </View>
          {step === 0 && (
            <>
              <NHeading icon={Target} title={tx("რისკენ მიდიხარ?", "What’s your goal?")} />
              <NSegment
                value={form.mode}
                onChange={(v) => patch("mode", v)}
                options={[
                  { value: "lose", label: tx("დაკლება", "Lose") },
                  { value: "maintain", label: tx("შენარჩუნება", "Maintain") },
                  { value: "gain", label: tx("მომატება", "Gain") },
                ]}
              />
              {form.mode !== "maintain" && (
                // One weight goal: the target is edited only in the weight wizard.
                <NCard style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <NText style={{ fontSize: 12, lineHeight: 17, color: c.text200 }}>{tx("სასურველი წონა", "Target weight")}</NText>
                    <NText style={{ fontSize: 20, lineHeight: 28, fontFamily: "NotoSansGeorgian_700Bold", color: form.target ? c.text100 : c.text300 }}>
                      {form.target ? tx(`${form.target} კგ`, `${form.target} kg`) : tx("ჯერ არ გაქვს", "Not set yet")}
                    </NText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => openWeightGoalWizard(router, "/nutrition/goal")}
                    style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 13, justifyContent: "center", backgroundColor: M.inkSoft }}
                  >
                    <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", color: M.ink, fontSize: 13 }}>{form.target ? tx("შეცვლა", "Change") : tx("დასახვა", "Set a goal")}</NText>
                  </Pressable>
                </NCard>
              )}
              <NField
                label={tx("მიმდინარე წონა · კგ", "Current weight · kg")}
                value={form.weight}
                onChangeText={(v) => patch("weight", v)}
                keyboardType="decimal-pad"
                maxLength={6}
                hint={`${tx("შენახვისას ეს წონა დღევანდელ გაზომვად ჩაიწერება.", "When you save, this weight is logged as today’s measurement.")} ${
                  d.facts.current?.date
                    ? tx(`ბოლო გაზომვა: ${formatYmd(d.facts.current.date, true)}.`, `Last measurement: ${formatYmd(d.facts.current.date, true)}.`)
                    : tx("პროფილიდან შევსებული მონაცემი გადაამოწმე.", "Check the value filled in from your profile.")
                }`}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <NField label={tx("სიმაღლე · სმ", "Height · cm")} value={form.height} onChangeText={(v) => patch("height", v)} keyboardType="decimal-pad" maxLength={5} />
                </View>
                <View style={{ flex: 1.3 }}>
                  <NField label={tx("დაბადების თარიღი", "Date of birth")} value={form.birth} onChangeText={(v) => patch("birth", v)} placeholder="1990-05-21" autoCapitalize="none" maxLength={10} />
                </View>
              </View>
              <NLabel>{tx("ფორმულის სქესობრივი კოეფიციენტი", "Formula sex coefficient")}</NLabel>
              <NSegment
                value={form.sex}
                onChange={(v) => patch("sex", v)}
                options={[
                  { value: "female", label: tx("ქალი", "Female") },
                  { value: "male", label: tx("კაცი", "Male") },
                ]}
              />
              <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300, marginTop: -6, marginHorizontal: 2 }}>
                {tx("ფორმულას ორი კოეფიციენტი აქვს. თუ არცერთი შეესაბამება შენს მდგომარეობას, გამოიყენე დღიური და გეგმა სპეციალისტთან შეარჩიე. პროფილის იდენტობა არ იცვლება.", "The formula has two coefficients. If neither fits your situation, use the diary and choose a plan with a specialist. Your profile identity doesn’t change.")}
              </NText>
              {d.program?.active && (
                <NButton
                  secondary
                  disabled={busy}
                  icon={Pause}
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
              <NHeading icon={Utensils} title={tx("შენს ცხოვრებას მოერგოს", "Fit it to your life")} />
              <NLabel>{tx("ჩვეულებრივი აქტივობა", "Usual activity")}</NLabel>
              <NChoiceList
                value={form.activity}
                onChange={(v) => patch("activity", v)}
                options={[
                  { value: "sedentary", label: tx("უმეტესად ვზივარ", "Mostly sitting") },
                  { value: "light", label: tx("მსუბუქად ვმოძრაობ", "Lightly active") },
                  { value: "moderate", label: tx("რეგულარულად ვვარჯიშობ", "I exercise regularly") },
                  { value: "active", label: tx("დღის დიდი ნაწილი აქტიური ვარ", "Active most of the day") },
                ]}
              />
              {form.mode === "lose" && (
                <>
                  <NLabel>{tx("კალორიული ცვლილების ტემპი", "Calorie change pace")}</NLabel>
                  <NChoiceList
                    value={form.pace}
                    onChange={(v) => patch("pace", v)}
                    options={[
                      { value: "gentle", label: tx("რბილი ცვლილება", "Gentle change"), detail: tx("−250 კკალ დღეში", "−250 kcal a day") },
                      { value: "steady", label: tx("ზომიერი ცვლილება", "Moderate change"), detail: tx("−400 კკალ დღეში", "−400 kcal a day") },
                    ]}
                  />
                </>
              )}
              <NLabel>{tx("კვების არჩევანი", "Eating style")}</NLabel>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    ["balanced", tx("მრავალფეროვანი", "Varied")],
                    ["vegetarian", tx("ვეგეტარიანული", "Vegetarian")],
                    ["vegan", tx("ვეგანური", "Vegan")],
                  ] as const
                ).map(([value, label]) => (
                  <NChip key={value} label={label} selected={form.diet === value} onPress={() => patch("diet", value)} />
                ))}
              </View>
              <NLabel>{tx("გამოსარიცხი ალერგენები", "Allergens to exclude")}</NLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(allergenLabels).map(([key, label]) => {
                  const required = d.facts.requiredAllergens.includes(key);
                  const selected = form.allergens.includes(key) || required;
                  return (
                    <NChip
                      key={key}
                      label={selected ? `✓ ${label}` : label}
                      selected={selected}
                      disabled={required}
                      accessibilityLabel={label}
                      onPress={() => patch("allergens", form.allergens.includes(key) ? form.allergens.filter((v) => v !== key) : [...form.allergens, key])}
                    />
                  );
                })}
              </View>
              {!!d.facts.requiredAllergens.length && (
                <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300, marginTop: -6, marginHorizontal: 2 }}>
                  {tx("პროფილიდან დამატებულია:", "Added from your profile:")} {d.facts.requiredAllergens.map((a) => allergenLabels[a] || a).join(", ")}
                  {tx(". მათ ავტომატურად გამოვრიცხავთ. თუ პროფილის ჩანაწერი არასწორია, ის პროფილში შეასწორე.", ". We’ll exclude them automatically. If your profile entry is wrong, fix it in your profile.")}
                </NText>
              )}
              <AllergyReview labels={d.facts.unclassifiedAllergies || []} value={allergyClarifications} onChange={setAllergyClarifications} />
              <NField
                label={tx("სხვა საკვები შეზღუდვა · სურვილისამებრ", "Other food restrictions · optional")}
                value={form.avoidFoods}
                onChangeText={(v) => patch("avoidFoods", v)}
                maxLength={300}
                hint={tx("სხვა შეზღუდვის მითითებისას ავტომატურ რაციონს არ შევადგენთ, რადგან თავისუფალი ტექსტიდან უსაფრთხო გამორიცხვას ვერ ვადასტურებთ. დღის სამიზნე და დღიური დარჩება.", "If you add other restrictions, we won’t build an automatic meal plan, because we can’t safely confirm exclusions from free text. Your daily target and diary stay available.")}
              />
            </>
          )}
          {step === 2 && (
            <>
              <NHeading
                icon={ShieldCheck}
                title={tx("შენზე მორგებული ზრუნვა", "Care that fits you")}
                body={tx("რამდენიმე პასუხი გვეხმარება გავიგოთ, გამოგადგება თუ არა ავტომატური გეგმა. დადებითი პასუხისას დღიური კვლავ ხელმისაწვდომია.", "A few answers help us understand whether an automatic plan is right for you. If you answer yes, the diary is still available.")}
              />
              {(
                [
                  ["pregnancyOrBreastfeeding", tx("ორსულად ხარ ან ძუძუთი კვებავ?", "Are you pregnant or breastfeeding?")],
                  ["eatingDisorder", tx("გაქვს ან გქონია კვებითი აშლილობა, ან ახლა კვებითი ქცევის სირთულე გაწუხებს?", "Do you have or have you ever had an eating disorder, or are you struggling with your eating right now?")],
                  ["medicalDiet", tx("გაქვს ქრონიკული დაავადება, ექიმის მიერ დანიშნული დიეტა ან მდგომარეობა/მკურნალობა, რომელიც კვებაზე მოქმედებს?", "Do you have a chronic condition, a diet prescribed by a doctor, or a condition or treatment that affects how you eat?")],
                ] as const
              ).map(([key, label]) => (
                <NCard key={key}>
                  <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 15 }}>{label}</NText>
                  <NSegment
                    on="card"
                    value={screening[key] === null ? "" : screening[key] ? "yes" : "no"}
                    onChange={(v) => setScreening((current) => ({ ...current, [key]: v === "yes" }))}
                    options={[
                      { value: "no", label: tx("არა", "No") },
                      { value: "yes", label: tx("კი", "Yes") },
                    ]}
                  />
                </NCard>
              ))}
            </>
          )}
          {step === 3 && preview && (
            <>
              {preview.eligible && preview.targets ? (
                <>
                  <NCard>
                    <NText style={{ fontSize: 13, color: c.text200 }}>{tx("შენი საწყისი დღის სამიზნე", "Your starting daily target")}</NText>
                    <NText style={{ fontSize: 38, lineHeight: 48, fontFamily: "NotoSansGeorgian_700Bold", color: M.ink }}>
                      {preview.targets.calories} <NText style={{ fontSize: 15, color: c.text200 }}>{tx("კკალ", "kcal")}</NText>
                    </NText>
                    <MacroRails actual={preview.targets} target={null} />
                    <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300 }}>
                      {tx("დაკლების/მომატების ზუსტი თარიღი გარანტირებული არ არის. ეს საწყისი შეფასებაა, არა მკაცრი დღიური ლიმიტი.", "An exact date for losing or gaining weight isn’t guaranteed. This is a starting estimate, not a strict daily limit.")}
                    </NText>
                  </NCard>
                  <NText style={{ color: c.text200, marginHorizontal: 2 }}>{preview.explanation}</NText>
                  {preview.mealPlanning && !preview.mealPlanning.eligible && (
                    <NCard>
                      <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{tx("დღის სამიზნე მზადაა · რაციონს დაზუსტება სჭირდება", "Daily target ready · meal plan needs more detail")}</NText>
                      {preview.mealPlanning.reasons.map((reason) => (
                        <NText key={reason} style={{ fontSize: 13, color: c.text200 }}>
                          {reason}
                        </NText>
                      ))}
                      <NText style={{ fontSize: 12, color: c.text200 }}>{tx("შეგიძლია მიზანი შეინახო და კვება დღიურში აღრიცხო. კერძების ავტომატურ შერჩევას დაზუსტების შემდეგ ჩავრთავთ.", "You can save your goal and log meals in the diary. We’ll turn on automatic meal suggestions once the details are clear.")}</NText>
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
                  <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300, marginHorizontal: 2 }}>{tx("შენახვა განაახლებს აპში შენს საერთო წონის მიზანს და მიმდინარე წონას. შემდეგ რაციონს შეგიდგენ.", "Saving updates your weight goal and current weight across the app. Next we compose your meal plan.")}</NText>
                </>
              ) : (
                <NCard>
                  <NText style={{ fontSize: 18, lineHeight: 26, fontFamily: "NotoSansGeorgian_700Bold" }}>{tx("გეგმა სპეციალისტთან შეარჩიე", "Choose a plan with a specialist")}</NText>
                  {preview.reasons.map((v) => (
                    <NText key={v} style={{ color: c.text200 }}>
                      {v}
                    </NText>
                  ))}
                  <NButton label={tx("კვების დღიურზე გადასვლა", "Go to food diary")} onPress={() => router.replace("/nutrition/diary")} />
                </NCard>
              )}
              <NButton secondary label={tx("მეთოდი და წყაროები", "Method and sources")} onPress={() => router.push("/nutrition/method")} />
            </>
          )}
        </View>
      )}
      {paused && (
        <NCard>
          <NText>{tx("გეგმა შეჩერებულია. დღიური, ჩანაწერები და წონის მიზანი შენახულია.", "Plan paused. Your diary, entries and weight goal are saved.")}</NText>
          <NButton label={tx("კვებაზე დაბრუნება", "Back to nutrition")} onPress={() => router.replace("/nutrition")} />
        </NCard>
      )}
    </NScreen>
  );
}
