import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  ShoppingBasket,
  Sunrise,
  Sun,
  Moon,
  Apple,
  ChevronDown,
} from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { tx } from "@/i18n/locale";
import { formatYmd } from "@/lib/format";
import { useThemeColors } from "@/theme/colors";
import { localDay, shiftDay, mealLabels, foodTotals } from "@/lib/nutrition";
import {
  nutritionProgramApi,
  allergenLabels,
  nutritionDateLabel,
  type NutritionWeek,
  type PlannedMeal,
  type Recipe,
} from "@/lib/nutritionProgram";
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
export default function NutritionPlan() {
  const { user } = useAuth();
  return <Plan key={user?.id || "guest"} />;
}
function Plan() {
  const c = useThemeColors(),
    router = useRouter(),
    {
      data: d,
      error: dashboardError,
      load: loadDashboard,
    } = useNutritionDashboard();
  const [from, setFrom] = useState(localDay()),
    [day, setDay] = useState(localDay()),
    [week, setWeek] = useState<NutritionWeek | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [opened, setOpened] = useState<string | null>(null),
    [shopping, setShopping] = useState(false),
    [alternatives, setAlternatives] = useState<{
      id: string;
      recipes: Recipe[];
    } | null>(null),
    [notice, setNotice] = useState("");
  const alive = useRef(true),
    seq = useRef(0),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      seq.current++;
    };
  }, []);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const data = await nutritionProgramApi.week(from);
      if (alive.current && seq.current === n) setWeek(data);
    } catch (e) {
      if (alive.current && seq.current === n) setError((e as Error).message);
    } finally {
      if (alive.current && seq.current === n) setLoading(false);
    }
  }, [from]);
  useFocusEffect(
    useCallback(() => {
      setWeek(null);
      void load();
      return () => {
        seq.current++;
      };
    }, [load]),
  );
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const changeWeek = (n: number) => {
    const value = shiftDay(from, n);
    setFrom(value);
    setDay(value);
    setOpened(null);
    setAlternatives(null);
  };
  const meals = (week?.meals.filter((m) => m.date === day) || []).sort(
    (a, b) =>
      Object.keys(mealLabels).indexOf(a.type) -
      Object.keys(mealLabels).indexOf(b.type),
  );
  const current =
    !!d?.targets && !!d.program?.active && d.mealPlanning?.eligible !== false;
  const mealValid = (m: PlannedMeal) =>
    current && m.programRevision === d?.program?.revision;
  const icons = { breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: Apple };
  return (
    <NScreen
      title={shopping ? tx("საყიდლების სია", "Shopping list") : tx("ჩემი რაციონი", "My meal plan")}
      subtitle={tx("7 დღე · მოქნილი კერძები · შენი არჩევანი", "7 days · flexible dishes · your choice")}
      onBack={shopping ? () => setShopping(false) : undefined}
    >
      {!!(error || dashboardError) && (
        <NError
          message={error || dashboardError}
          retry={() => {
            void load();
            void loadDashboard();
          }}
        />
      )}
      {!!notice && (
        <NText accessibilityLiveRegion="polite" style={{ color: c.primary100 }}>
          {notice}
        </NText>
      )}
      {shopping ? (
        <>
          <NCard>
            <NText>{tx("მთელი არჩეული კვირის ინგრედიენტები", "Ingredients for the whole selected week")}</NText>
            <NText style={{ color: c.text200, fontSize: 12 }}>
              {tx(
                "რაოდენობა ეხება სახელში მითითებულ მდგომარეობას: მოხარშული, მზა ან მშრალი. შეამოწმე, რა გაქვს უკვე სახლში; ეს უმი შესაძენი წონის კონვერტაცია არ არის.",
                "Amounts refer to the state in the name: cooked, ready-made or dry. Check what you already have at home; this is not converted to raw weight for buying.",
              )}
            </NText>
          </NCard>
          {week?.shopping.map((item) => (
            <View
              key={item.name}
              style={{
                flexDirection: "row",
                gap: 14,
                borderBottomWidth: 1,
                borderColor: c.bg300,
                paddingVertical: 9,
              }}
            >
              <NText style={{ flex: 1 }}>{item.name}</NText>
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                {item.grams} {tx("გ", "g")}
              </NText>
            </View>
          ))}
          <NButton
            secondary
            label={tx("რაციონის ნახვა", "View meal plan")}
            onPress={() => setShopping(false)}
          />
        </>
      ) : (
        <>
          {!current && d && (
            <NCard>
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                {d.targets
                  ? tx("რაციონისთვის კვების არჩევანი დააზუსტე", "Set your food preferences for the plan")
                  : tx("ჯერ დღის მიზანი შეარჩიე", "First choose a daily goal")}
              </NText>
              <NText style={{ color: c.text200 }}>
                {d.mealPlanning?.reasons.join(" ") ||
                  d.reasons[0] ||
                  tx("რაციონი შენს საჭიროებას, არჩევანსა და ალერგენებს მოერგება.", "Your plan adapts to your needs, preferences and allergens.")}
              </NText>
              <NButton
                label={
                  d.targets ? tx("კვების არჩევანის დაზუსტება", "Set food preferences") : tx("გეგმის შერჩევა", "Choose a plan")
                }
                onPress={() => router.push("/nutrition/goal")}
              />
              {d.targets && (
                <NText style={{ fontSize: 12, color: c.text200 }}>
                  {tx(
                    "დღის სამიზნე შენახულია. კვების დღიურში ჩაწერა შეგიძლია გააგრძელო.",
                    "Your daily target is saved. You can keep logging in your food diary.",
                  )}
                </NText>
              )}
            </NCard>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx("წინა კვირა", "Previous week")}
              disabled={busy || from <= shiftDay(localDay(), -83)}
              onPress={() => changeWeek(-7)}
              style={{ padding: 10 }}
            >
              <ChevronLeft size={22} color={c.text100} />
            </Pressable>
            <NText style={{ flex: 1, textAlign: "center", fontSize: 13 }}>
              {formatYmd(from)} — {formatYmd(shiftDay(from, 6))}
            </NText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx("შემდეგი კვირა", "Next week")}
              disabled={busy || from >= shiftDay(localDay(), 21)}
              onPress={() => changeWeek(7)}
              style={{ padding: 10 }}
            >
              <ChevronRight size={22} color={c.text100} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {Array.from({ length: 7 }, (_, i) => shiftDay(from, i)).map((v) => (
              <Pressable
                key={v}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ selected: day === v }}
                accessibilityLabel={formatYmd(v, true)}
                onPress={() => {
                  setDay(v);
                  setOpened(null);
                  setAlternatives(null);
                }}
                style={{
                  width: 57,
                  minHeight: 70,
                  paddingVertical: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  backgroundColor: day === v ? c.accent100 : c.surface,
                  borderWidth: 1,
                  borderColor: day === v ? c.primary100 : c.bg300,
                }}
              >
                <NText style={{ fontSize: 11, color: c.text200 }}>
                  {nutritionDateLabel(v, true)}
                </NText>
                <NText
                  style={{
                    fontSize: 20,
                    lineHeight: 28,
                    fontFamily: "NotoSansGeorgian_600SemiBold",
                  }}
                >
                  {Number(v.slice(8))}
                </NText>
              </Pressable>
            ))}
          </ScrollView>
          {loading ? (
            <NLoading />
          ) : meals.length ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <NText
                  style={{
                    fontSize: 18,
                    fontFamily: "NotoSansGeorgian_600SemiBold",
                  }}
                >
                  {tx("დღის მენიუ", "Day menu")}
                </NText>
                <Pressable
                  onPress={() => setShopping(true)}
                  accessibilityRole="button"
                  accessibilityLabel={tx("საყიდლების სია", "Shopping list")}
                  style={{ padding: 10 }}
                >
                  <ShoppingBasket color={c.primary100} size={22} />
                </Pressable>
              </View>
              <NCard>
                <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                  {foodTotals(meals.flatMap((m) => m.data.items)).calories}{" "}
                  {tx("კკალ · დაგეგმილი", "kcal · planned")}
                </NText>
                <MacroRails
                  actual={foodTotals(meals.flatMap((m) => m.data.items))}
                  target={d?.targets || null}
                />
                <NText style={{ fontSize: 11, color: c.text200 }}>
                  {tx(
                    "გეგმაში არსებული საკვები მიღებულად არ ითვლება. კერძების მაკროები შეიძლება სამიზნისგან განსხვავდებოდეს — შეცვლისას ჯამიც განახლდება.",
                    "Planned food doesn't count as eaten. Dish macros may differ from your target — the total updates when you swap.",
                  )}
                </NText>
              </NCard>
              {meals.map((m) => {
                const Icon = icons[m.type],
                  expanded = opened === m.id;
                return (
                  <NCard key={m.id}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => {
                        setOpened(expanded ? null : m.id);
                        setAlternatives(null);
                      }}
                      style={{ gap: 13 }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 13,
                            backgroundColor: c.accent100,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon color={c.primary100} size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <NText style={{ fontSize: 12, color: c.text200 }}>
                            {mealLabels[m.type]}
                            {m.eaten ? tx(" · აღრიცხულია", " · logged") : ""}
                          </NText>
                          <NText
                            style={{
                              fontFamily: "NotoSansGeorgian_600SemiBold",
                            }}
                          >
                            {m.data.title}
                          </NText>
                        </View>
                        {m.eaten ? (
                          <Check color={c.primary100} size={20} />
                        ) : (
                          <ChevronDown color={c.text200} size={18} />
                        )}
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <NText style={{ fontSize: 13 }}>
                          {m.data.totals.calories} {tx("კკალ", "kcal")}
                        </NText>
                        <Clock color={c.text200} size={13} />
                        <NText style={{ fontSize: 12, color: c.text200 }}>
                          {m.data.minutes} {tx("წუთი", "min")}
                        </NText>
                      </View>
                    </Pressable>
                    {expanded && (
                      <>
                        <View style={{ height: 1, backgroundColor: c.bg300 }} />
                        {m.data.items.map((v, i) => (
                          <View
                            key={i}
                            style={{ flexDirection: "row", gap: 12 }}
                          >
                            <NText style={{ flex: 1, fontSize: 13 }}>
                              {v.name}
                            </NText>
                            <NText style={{ fontSize: 13 }}>
                              {Math.round(v.grams)} {tx("გ", "g")}
                            </NText>
                          </View>
                        ))}
                        <NText style={{ color: c.text200 }}>
                          {m.data.instructions}
                        </NText>
                        <NText style={{ fontSize: 11, color: c.text200 }}>
                          {tx("ალერგენები:", "Allergens:")}{" "}
                          {m.data.allergens
                            .map((k) => allergenLabels[k] || k)
                            .join(", ") || tx("კატალოგში მონიშნული არ არის", "none marked in the catalog")}{" "}
                          {tx("· შეფუთვაც შეამოწმე.", "· check the packaging too.")}
                        </NText>
                        <NText
                          style={{
                            fontSize: 10,
                            lineHeight: 16,
                            color: c.text200,
                          }}
                        >
                          {m.data.source}
                        </NText>
                        {m.eaten ? (
                          <NButton
                            secondary
                            label={tx("პორციის შესწორება დღიურში", "Adjust portion in diary")}
                            onPress={() => router.push("/nutrition/diary")}
                          />
                        ) : mealValid(m) ? (
                          <>
                            <NButton
                              disabled={busy || m.date > localDay()}
                              label={
                                m.date > localDay()
                                  ? tx("ჯერ მომავალი კვებაა", "This meal is still ahead")
                                  : tx("მივირთვი · დღიურში დამატება", "I ate it · add to diary")
                              }
                              onPress={() =>
                                void run(async () => {
                                  await nutritionProgramApi.eat(m.id);
                                  if (!alive.current) return;
                                  setNotice(
                                    tx("კვება დღიურში ჩაიწერა. რეალური პორცია იქ შეგიძლია შეასწორო.", "Meal added to your diary. You can adjust the actual portion there."),
                                  );
                                  await load();
                                  void loadDashboard();
                                })
                              }
                            />
                            <NText style={{ fontSize: 11, color: c.text200 }}>
                              {tx(
                                "თუ იგივე კვება უკვე ფოტოთი ან ხელით ჩაწერე, მეორედ აღარ დაამატო.",
                                "If you already logged this meal by photo or by hand, don't add it again.",
                              )}
                            </NText>
                            <NButton
                              secondary
                              disabled={busy}
                              label={tx("სხვა კერძის არჩევა", "Choose another dish")}
                              onPress={() =>
                                void run(async () => {
                                  const result =
                                    await nutritionProgramApi.recipes(m.type);
                                  if (alive.current)
                                    setAlternatives({
                                      id: m.id,
                                      recipes: result.recipes.filter(
                                        (v) => v.id !== m.recipeId,
                                      ),
                                    });
                                })
                              }
                            />
                          </>
                        ) : (
                          <NText style={{ color: c.text200 }}>
                            {tx(
                              "ეს კერძი ძველი გეგმისაა. ახალი რეკომენდაციისთვის განაახლე რაციონი.",
                              "This dish is from an old plan. Refresh your plan for new suggestions.",
                            )}
                          </NText>
                        )}
                        {alternatives?.id === m.id && (
                          <View style={{ gap: 8 }}>
                            <NText>{tx("შესაბამისი ალტერნატივები", "Matching alternatives")}</NText>
                            {alternatives.recipes.length ? (
                              alternatives.recipes.map((recipe) => (
                                <NButton
                                  key={recipe.id}
                                  secondary
                                  disabled={busy}
                                  label={tx(`${recipe.title} · ${recipe.totals.calories} კკალ`, `${recipe.title} · ${recipe.totals.calories} kcal`)}
                                  onPress={() =>
                                    void run(async () => {
                                      await nutritionProgramApi.swap(
                                        m.id,
                                        recipe.id,
                                      );
                                      if (!alive.current) return;
                                      setAlternatives(null);
                                      await load();
                                    })
                                  }
                                />
                              ))
                            ) : (
                              <NText>
                                {tx("ამ შეზღუდვებით სხვა კერძი ჯერ არ არის.", "No other dishes fit these restrictions yet.")}
                              </NText>
                            )}
                          </View>
                        )}
                      </>
                    )}
                  </NCard>
                );
              })}
            </>
          ) : (
            <NCard>
              <View style={{ alignItems: "center", padding: 12 }}>
                <Sunrise size={42} color={c.primary100} />
              </View>
              <NText
                style={{
                  textAlign: "center",
                  fontSize: 20,
                  lineHeight: 29,
                  fontFamily: "NotoSansGeorgian_600SemiBold",
                }}
              >
                {tx("კვირა წინასწარ დაგეგმე", "Plan your week ahead")}
              </NText>
              <NText style={{ textAlign: "center", color: c.text200 }}>
                {tx(
                  "ოთხი კვება დღეში, შესაცვლელი კერძები და ინგრედიენტების ერთიანი სია.",
                  "Four meals a day, swappable dishes and one ingredient list.",
                )}
              </NText>
            </NCard>
          )}
          {current && from >= localDay() && (
            <NButton
              disabled={busy || loading}
              label={
                busy
                  ? tx("მუშავდება…", "Working…")
                  : week?.meals.length
                    ? tx("კვირის განახლება · მიღებული კვება დარჩება", "Refresh week · eaten meals stay")
                    : tx("7 დღის რაციონის შექმნა", "Create a 7-day plan")
              }
              onPress={() =>
                void run(async () => {
                  const result = await nutritionProgramApi.generate(
                    from,
                    d!.program!.revision,
                    week?.meals.length
                      ? Math.floor(Math.random() * 999) + 1
                      : 0,
                  );
                  if (alive.current) {
                    setWeek(result);
                    setOpened(null);
                    setAlternatives(null);
                  }
                })
              }
            />
          )}
          <NButton
            secondary
            label={tx("კვების დღიური", "Food diary")}
            onPress={() => router.push("/nutrition/diary")}
          />
        </>
      )}
    </NScreen>
  );
}
