import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Check, ShieldCheck, Target, Utensils } from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { useThemeColors } from "@/theme/colors";
import {
  nutritionProgramApi,
  applyNutritionSavedState,
  allergenLabels,
  type ProgramConfig,
  type NutritionPreview,
} from "@/lib/nutritionProgram";
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
  useEffect(() => {
    if (!d || init.current) return;
    init.current = true;
    const p = d.program?.config,
      f = d.facts;
    const weight = f.current?.kg || p?.weightKg;
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
    allergens: form.allergens,
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
          "გადაამოწმე წონა (30–300 კგ), სიმაღლე (130–220 სმ), დაბადების თარიღი და ფორმულის კოეფიციენტი.",
        );
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!form.activity) {
        setError("აირჩიე შენი ჩვეულებრივი აქტივობა.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (Object.values(screening).some((v) => v === null)) {
        setError("უპასუხე სამივე კითხვას, რომ გეგმის შესაბამისობა შევამოწმოთ.");
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
      title="შენი კვების გეგმა"
      subtitle={`${step + 1} / 4 · ${["მიზანი", "შენი ყოველდღიურობა", "შესაბამისობის შემოწმება", "გადაამოწმე და დაიწყე"][step]}`}
      onBack={back}
      footer={
        d && !paused ? (
          <NButton
            disabled={busy || (step === 3 && !preview?.eligible)}
            label={
              busy
                ? "მუშავდება…"
                : step === 3
                  ? "გეგმისა და მიმდინარე წონის შენახვა"
                  : step === 2
                    ? "დღის სამიზნის ნახვა"
                    : "გაგრძელება"
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
                რისკენ მიდიხარ?
              </NText>
              {choices("mode", [
                ["lose", "წონის დაკლება"],
                ["maintain", "წონის შენარჩუნება"],
                ["gain", "წონის მომატება"],
              ])}
              {field("მიმდინარე წონა · კგ", "weight", true)}
              <NText style={{ fontSize: 11, color: c.text200 }}>
                შენახვისას ეს წონა დღევანდელ გაზომვად ჩაიწერება.{" "}
                {d.facts.current?.date
                  ? `ბოლო გაზომვა: ${d.facts.current.date}.`
                  : "პროფილიდან შევსებული მონაცემი გადაამოწმე."}
              </NText>
              {form.mode !== "maintain" &&
                field("სასურველი წონა · კგ", "target", true)}
              {field("სიმაღლე · სმ", "height", true)}
              {field("დაბადების თარიღი · წელი-თვე-დღე", "birth")}
              <NText>ფორმულის სქესობრივი კოეფიციენტი</NText>
              {choices("sex", [
                ["female", "ქალი"],
                ["male", "კაცი"],
              ])}
              <NText style={{ fontSize: 12, color: c.text200 }}>
                ფორმულას ორი კოეფიციენტი აქვს. თუ არცერთი შეესაბამება შენს
                მდგომარეობას, გამოიყენე დღიური და გეგმა სპეციალისტთან შეარჩიე.
                პროფილის იდენტობა არ იცვლება.
              </NText>
              {d.program?.active && (
                <NButton
                  secondary
                  disabled={busy}
                  label="კალორიული გეგმის შეჩერება"
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
                შენს ცხოვრებას მოერგოს
              </NText>
              <NText>ჩვეულებრივი აქტივობა</NText>
              {choices("activity", [
                ["sedentary", "უმეტესად ვზივარ"],
                ["light", "მსუბუქად ვმოძრაობ"],
                ["moderate", "რეგულარულად ვვარჯიშობ"],
                ["active", "დღის დიდი ნაწილი აქტიური ვარ"],
              ])}
              {form.mode === "lose" && (
                <>
                  <NText>კალორიული ცვლილების ტემპი</NText>
                  {choices("pace", [
                    ["gentle", "რბილი ცვლილება · −250 კკალ"],
                    ["steady", "ზომიერი ცვლილება · −400 კკალ"],
                  ])}
                </>
              )}
              <NText>კვების არჩევანი</NText>
              {choices("diet", [
                ["balanced", "მრავალფეროვანი"],
                ["vegetarian", "ვეგეტარიანული"],
                ["vegan", "ვეგანური"],
              ])}
              <NText>გამოსარიცხი ალერგენები</NText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(allergenLabels).map(([key, label]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: form.allergens.includes(key),
                    }}
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
              {field("სხვა საკვები შეზღუდვა · სურვილისამებრ", "avoidFoods")}
              <NText style={{ fontSize: 12, color: c.text200 }}>
                სხვა შეზღუდვის მითითებისას ავტომატურ რაციონს არ შევადგენთ,
                რადგან თავისუფალი ტექსტიდან უსაფრთხო გამორიცხვას ვერ
                ვადასტურებთ. დღის სამიზნე და დღიური დარჩება.
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
                შენზე მორგებული ზრუნვა
              </NText>
              <NText style={{ color: c.text200 }}>
                რამდენიმე პასუხი გვეხმარება გავიგოთ, გამოგადგება თუ არა
                ავტომატური გეგმა. დადებითი პასუხისას დღიური კვლავ
                ხელმისაწვდომია.
              </NText>
              {[
                ["pregnancyOrBreastfeeding", "ორსულად ხარ ან ძუძუთი კვებავ?"],
                [
                  "eatingDisorder",
                  "გაქვს ან გქონია კვებითი აშლილობა, ან ახლა კვებითი ქცევის სირთულე გაწუხებს?",
                ],
                [
                  "medicalDiet",
                  "გაქვს ქრონიკული დაავადება, ექიმის მიერ დანიშნული დიეტა ან მდგომარეობა/მკურნალობა, რომელიც კვებაზე მოქმედებს?",
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
                        <NText>{v ? "კი" : "არა"}</NText>
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
                    <NText>შენი საწყისი დღის სამიზნე</NText>
                    <NText
                      style={{
                        fontSize: 39,
                        lineHeight: 53,
                        fontFamily: "NotoSansGeorgian_700Bold",
                      }}
                    >
                      {preview.targets.calories} <NText>კკალ</NText>
                    </NText>
                    <MacroRails actual={preview.targets} target={null} />
                    <NText style={{ fontSize: 12, color: c.text200 }}>
                      დაკლების/მომატების ზუსტი თარიღი გარანტირებული არ არის. ეს
                      საწყისი შეფასებაა, არა მკაცრი დღიური ლიმიტი.
                    </NText>
                  </NCard>
                  <NText>{preview.explanation}</NText>
                  <NText style={{ fontSize: 12, color: c.text200 }}>
                    შენახვა განაახლებს აპში შენს საერთო წონის მიზანს. რაციონს
                    შემდეგ ეტაპზე შეადგენ.
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
                    გეგმა სპეციალისტთან შეარჩიე
                  </NText>
                  {preview.reasons.map((v) => (
                    <NText key={v}>{v}</NText>
                  ))}
                  <NButton
                    label="კვების დღიურზე გადასვლა"
                    onPress={() => router.replace("/nutrition/diary")}
                  />
                </NCard>
              )}
              <NButton
                secondary
                label="მეთოდი და წყაროები"
                onPress={() => router.push("/nutrition/method")}
              />
            </>
          )}
        </View>
      )}
      {paused && (
        <NCard>
          <NText>
            გეგმა შეჩერებულია. დღიური, ჩანაწერები და წონის მიზანი შენახულია.
          </NText>
          <NButton
            label="კვებაზე დაბრუნება"
            onPress={() => router.replace("/nutrition")}
          />
        </NCard>
      )}
    </NScreen>
  );
}
