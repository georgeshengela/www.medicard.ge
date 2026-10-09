import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Check, ChevronDown, ChevronUp, Clock, RefreshCw, Repeat2, ShoppingBasket } from "lucide-react-native";
import { useAuth } from "@/store/AuthContext";
import { tx } from "@/i18n/locale";
import { getPreference, setPreference } from "@/lib/storage";
import { localDay, shiftDay, foodTotals } from "@/lib/nutrition";
import { nutritionProgramApi, allergenLabels, type NutritionWeek, type PlannedMeal, type Recipe } from "@/lib/nutritionProgram";
import { accountKey, queryClient } from "@/lib/queryClient";
import { NScreen, NText, NCard, NButton, NError, NLoading, NNotice, NWeekStrip, MacroRails, useMedifood, useNutritionDashboard, withMedifood } from "@/components/nutrition/ProgramUI";
import { ModuleHeaderButton } from "@/components/brand/ModuleHeader";
import { HubSection, MEAL_ICONS, MEAL_TYPES } from "@/components/nutrition/NutritionUi";
import { mealLabels } from "@/lib/nutrition";
import { HUB, hubText } from "@/theme/hub";

export default withMedifood(function NutritionPlan() {
  const { user } = useAuth();
  return <Plan key={user?.id || "guest"} owner={user?.id || ""} />;
});

const kcal = (n: number) => Math.round(n).toLocaleString("en-US").replace(/,/g, " ");

/**
 * „ჩემი რაციონი“ — the 7-day menu. The week strip picks a day; each dish is one row with a one-tap
 * „✓ მივირთვი“ (it goes into the diary), opening the row shows ingredients, steps, allergens and „სხვა
 * კერძი“. The shopping list ticks off per week on this device.
 */
function Plan({ owner }: { owner: string }) {
  const M = useMedifood(),
    { c } = M,
    router = useRouter(),
    { data: d, error: dashboardError, load: loadDashboard } = useNutritionDashboard();
  const [from, setFrom] = useState(localDay()),
    [day, setDay] = useState(localDay()),
    [week, setWeek] = useState<NutritionWeek | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [opened, setOpened] = useState<string | null>(null),
    [shopping, setShopping] = useState(false),
    [alternatives, setAlternatives] = useState<{ id: string; recipes: Recipe[] } | null>(null),
    [notice, setNotice] = useState(""),
    [ticked, setTicked] = useState<Record<string, boolean>>({});
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
  // Ticks on the shopping list: per account and per week, on this device only.
  const tickKey = `nutrition.shopping.${owner}.${from}`;
  useEffect(() => {
    let live = true;
    setTicked({});
    void getPreference(tickKey)
      .then((raw) => {
        if (live && raw) setTicked(JSON.parse(raw) as Record<string, boolean>);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tickKey]);
  const tick = (name: string) =>
    setTicked((current) => {
      const next = { ...current, [name]: !current[name] };
      void setPreference(tickKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
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
  const today = localDay();
  const meals = (week?.meals.filter((m) => m.date === day) || []).sort((a, b) => MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type));
  const current = !!d?.targets && !!d.program?.active && d.mealPlanning?.eligible !== false;
  const mealValid = (m: PlannedMeal) => current && m.programRevision === d?.program?.revision;
  const plannedDays = new Set((week?.meals || []).map((m) => m.date));
  const eat = (m: PlannedMeal) =>
    run(async () => {
      await nutritionProgramApi.eat(m.id);
      if (!alive.current) return;
      setNotice(tx("კერძი დღიურშია. რეალური პორცია იქ შეგიძლია შეასწორო.", "The dish is in your diary. You can adjust the real portion there."));
      void queryClient.invalidateQueries({ queryKey: accountKey("nutrition", "meals", m.date) });
      await load();
      void loadDashboard();
    });
  const generate = () =>
    run(async () => {
      const result = await nutritionProgramApi.generate(from, d!.program!.revision, week?.meals.length ? Math.floor(Math.random() * 999) + 1 : 0);
      if (alive.current) {
        setWeek(result);
        setOpened(null);
        setAlternatives(null);
      }
    });
  const canGenerate = current && from >= today;
  const shoppingLeft = (week?.shopping || []).filter((item) => !ticked[item.name]).length;
  return (
    <NScreen
      title={shopping ? tx("საყიდლების სია", "Shopping list") : tx("ჩემი რაციონი", "My meal plan")}
      onBack={shopping ? () => setShopping(false) : undefined}
      right={!shopping && week?.shopping.length ? <ModuleHeaderButton label={tx("საყიდლების სია", "Shopping list")} icon={ShoppingBasket} onPress={() => setShopping(true)} /> : undefined}
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
      {!!notice && <NNotice>{notice}</NNotice>}
      {shopping ? (
        <>
          <HubSection first title={tx(`${shoppingLeft} დარჩა ${week?.shopping.length || 0}-დან`, `${shoppingLeft} of ${week?.shopping.length || 0} left`)}>
            {!!week?.shopping.length && (
              <View style={[s.list, { backgroundColor: c.surface }]}>
                {week.shopping.map((item, index) => {
                  const done = !!ticked[item.name];
                  return (
                    <Pressable
                      key={item.name}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      accessibilityLabel={`${item.name}, ${Math.round(item.grams)} ${tx("გრამი", "grams")}`}
                      onPress={() => tick(item.name)}
                      style={[s.shopRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}
                    >
                      <View style={[s.box, { borderColor: done ? M.ink : c.bg300, backgroundColor: done ? M.ink : "transparent" }]}>{done ? <Check size={14} color={M.onInk} strokeWidth={3} /> : null}</View>
                      <Text style={[hubText.body, { flex: 1, fontSize: 14.5, color: done ? c.text300 : c.text100, textDecorationLine: done ? "line-through" : "none" }]}>{item.name}</Text>
                      <Text style={[hubText.value, { fontSize: 14, color: done ? c.text300 : c.text100, fontVariant: ["tabular-nums"] }]}>
                        {Math.round(item.grams)} {tx("გ", "g")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </HubSection>
          <NText style={{ color: c.text300, fontSize: 12, lineHeight: 18, marginHorizontal: 2 }}>
            {tx(
              "მთელი არჩეული კვირის ინგრედიენტები. რაოდენობა ეხება სახელში მითითებულ მდგომარეობას: მოხარშული, მზა ან მშრალი — უმი შესაძენი წონა არ არის. მონიშვნები ამ ტელეფონზე ინახება.",
              "Ingredients for the whole selected week. Amounts refer to the state in the name: cooked, ready-made or dry — not the raw weight to buy. Ticks are kept on this phone.",
            )}
          </NText>
          <NButton secondary label={tx("რაციონზე დაბრუნება", "Back to the meal plan")} onPress={() => setShopping(false)} />
        </>
      ) : (
        <>
          {!current && d && (
            <NCard>
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{d.targets ? tx("რაციონისთვის კვების არჩევანი დააზუსტე", "Set your food preferences for the plan") : tx("ჯერ დღის მიზანი შეარჩიე", "First choose a daily goal")}</NText>
              <NText style={{ color: c.text200 }}>{d.mealPlanning?.reasons.join(" ") || d.reasons[0] || tx("რაციონი შენს საჭიროებას, არჩევანსა და ალერგენებს მოერგება.", "Your plan adapts to your needs, preferences and allergens.")}</NText>
              <NButton label={d.targets ? tx("კვების არჩევანის დაზუსტება", "Set food preferences") : tx("გეგმის შერჩევა", "Choose a plan")} onPress={() => router.push("/nutrition/goal")} />
            </NCard>
          )}
          <NWeekStrip
            from={from}
            selected={day}
            disabled={busy}
            onSelect={(v) => {
              setDay(v);
              setOpened(null);
              setAlternatives(null);
            }}
            onWeek={changeWeek}
            prevDisabled={from <= shiftDay(today, -83)}
            nextDisabled={from >= shiftDay(today, 21)}
            marked={plannedDays}
          />
          {loading ? (
            <NLoading />
          ) : meals.length ? (
            <>
              <HubSection first title={tx("დღის მენიუ", "Day menu")} linkLabel={tx("საყიდლები", "Shopping")} onLink={() => setShopping(true)}>
                <NCard>
                  <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                    {kcal(foodTotals(meals.flatMap((m) => m.data.items)).calories)} {tx("კკალ · დაგეგმილი", "kcal · planned")}
                  </NText>
                  <MacroRails actual={foodTotals(meals.flatMap((m) => m.data.items))} target={d?.targets || null} />
                  <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300 }}>
                    {tx("დაგეგმილი მიღებულად არ ითვლება, სანამ „✓“-ს არ დააჭერ.", "Planned food doesn't count as eaten until you tap „✓“.")}
                  </NText>
                </NCard>
              </HubSection>
              <View style={[s.list, { backgroundColor: c.surface }]}>
                {meals.map((m, index) => {
                  const Icon = MEAL_ICONS[m.type];
                  const expanded = opened === m.id;
                  const canEat = !m.eaten && mealValid(m) && m.date <= today;
                  return (
                    <View key={m.id} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 } : undefined}>
                      <View style={s.mealRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          accessibilityLabel={tx(`${mealLabels[m.type]}: ${m.data.title}, ${kcal(m.data.totals.calories)} კკალ${m.eaten ? ", მიღებულია" : ""}. დეტალები`, `${mealLabels[m.type]}: ${m.data.title}, ${kcal(m.data.totals.calories)} kcal${m.eaten ? ", eaten" : ""}. Details`)}
                          onPress={() => {
                            setOpened(expanded ? null : m.id);
                            setAlternatives(null);
                          }}
                          style={s.mealMain}
                        >
                          <View style={[s.tile, { backgroundColor: m.eaten ? M.ink : M.inkSoft }]}>
                            <Icon color={m.eaten ? M.onInk : M.ink} size={19} strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
                              {mealLabels[m.type]}
                              {m.eaten ? tx(" · მიღებულია", " · eaten") : ""}
                            </Text>
                            <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, fontSize: 14.5 }]}>{m.data.title}</Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={[hubText.small, { color: c.text200 }]}>{kcal(m.data.totals.calories)} {tx("კკალ", "kcal")}</Text>
                              <Clock color={c.text300} size={11} />
                              <Text style={[hubText.small, { color: c.text200 }]}>{m.data.minutes} {tx("წთ", "min")}</Text>
                            </View>
                          </View>
                          {expanded ? <ChevronUp color={c.text300} size={18} /> : <ChevronDown color={c.text300} size={18} />}
                        </Pressable>
                        {canEat ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={tx(`${m.data.title} — მივირთვი, დღიურში დამატება`, `${m.data.title} — I ate it, add to diary`)}
                            disabled={busy}
                            onPress={() => void eat(m)}
                            hitSlop={4}
                            style={[s.eat, { backgroundColor: M.ink, opacity: busy ? 0.5 : 1 }]}
                          >
                            <Check size={19} color={M.onInk} strokeWidth={2.6} />
                          </Pressable>
                        ) : m.eaten ? (
                          <View accessible={false} style={[s.eat, { backgroundColor: M.inkSoft }]}>
                            <Check size={19} color={M.ink} strokeWidth={2.6} />
                          </View>
                        ) : null}
                      </View>
                      {expanded && (
                        <View style={{ paddingBottom: 14, gap: 10 }}>
                          <View style={[s.ingredients, { backgroundColor: c.bg100 }]}>
                            {m.data.items.map((v, i) => (
                              <View key={i} style={{ flexDirection: "row", gap: 12 }}>
                                <NText style={{ flex: 1, fontSize: 13 }}>{v.name}</NText>
                                <NText style={{ fontSize: 13, fontVariant: ["tabular-nums"] }}>{Math.round(v.grams)} {tx("გ", "g")}</NText>
                              </View>
                            ))}
                          </View>
                          {!!m.data.instructions && <NText style={{ color: c.text200, fontSize: 13, lineHeight: 20 }}>{m.data.instructions}</NText>}
                          <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300 }}>
                            {tx("ალერგენები:", "Allergens:")} {m.data.allergens.map((k) => allergenLabels[k] || k).join(", ") || tx("კატალოგში მონიშნული არ არის", "none marked in the catalog")}
                            {tx(" · შეფუთვაც შეამოწმე.", " · check the packaging too.")}
                          </NText>
                          {!!m.data.source && <NText style={{ fontSize: 11, lineHeight: 16, color: c.text300 }}>{m.data.source}</NText>}
                          {m.eaten ? (
                            <NButton secondary label={tx("პორციის შესწორება დღიურში", "Adjust the portion in the diary")} onPress={() => router.push({ pathname: "/nutrition/diary", params: { date: m.date } } as never)} />
                          ) : mealValid(m) ? (
                            <>
                              {m.date > today ? <NText style={{ fontSize: 12, color: c.text300 }}>{tx("ეს კვება ჯერ წინაა — იმ დღეს მონიშნავ.", "This meal is still ahead — mark it on the day.")}</NText> : null}
                              <NButton
                                secondary
                                icon={Repeat2}
                                disabled={busy}
                                label={tx("სხვა კერძის არჩევა", "Choose another dish")}
                                onPress={() =>
                                  void run(async () => {
                                    const result = await nutritionProgramApi.recipes(m.type);
                                    if (alive.current) setAlternatives({ id: m.id, recipes: result.recipes.filter((v) => v.id !== m.recipeId) });
                                  })
                                }
                              />
                            </>
                          ) : (
                            <NText style={{ color: c.text200 }}>{tx("ეს კერძი ძველი გეგმისაა. ახალი რეკომენდაციისთვის განაახლე რაციონი.", "This dish is from an old plan. Refresh your plan for new suggestions.")}</NText>
                          )}
                          {alternatives?.id === m.id && (
                            <View style={{ gap: 8 }}>
                              <Text style={[hubText.link, { color: c.text200 }]}>{tx("შესაბამისი ალტერნატივები", "Matching alternatives")}</Text>
                              {alternatives.recipes.length ? (
                                alternatives.recipes.map((recipe) => (
                                  <NButton
                                    key={recipe.id}
                                    secondary
                                    disabled={busy}
                                    label={tx(`${recipe.title} · ${kcal(recipe.totals.calories)} კკალ`, `${recipe.title} · ${kcal(recipe.totals.calories)} kcal`)}
                                    onPress={() =>
                                      void run(async () => {
                                        await nutritionProgramApi.swap(m.id, recipe.id);
                                        if (!alive.current) return;
                                        setAlternatives(null);
                                        await load();
                                      })
                                    }
                                  />
                                ))
                              ) : (
                                <NText style={{ color: c.text200 }}>{tx("ამ შეზღუდვებით სხვა კერძი ჯერ არ არის.", "No other dishes fit these restrictions yet.")}</NText>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              {canGenerate ? (
                <View style={{ gap: 6 }}>
                  <NButton secondary icon={RefreshCw} disabled={busy || loading} label={busy ? tx("მუშავდება…", "Working…") : tx("სხვა მენიუ ამ კვირაზე", "A new menu for this week")} onPress={() => void generate()} />
                  <Text style={[hubText.small, { color: c.text300, textAlign: "center" }]}>{tx("უკვე მიღებული კერძები ადგილზე დარჩება.", "Dishes you already ate stay in place.")}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <NCard style={{ alignItems: "center" }}>
              <View style={[s.emptyIcon, { backgroundColor: M.inkSoft }]}>
                <ShoppingBasket size={26} color={M.ink} strokeWidth={1.9} />
              </View>
              <Text style={[hubText.sectionTitle, { color: c.text100, fontSize: 18, textAlign: "center" }]}>{tx("კვირა წინასწარ დაგეგმე", "Plan your week ahead")}</Text>
              <Text style={[hubText.body, { color: c.text200, textAlign: "center" }]}>
                {tx("ოთხი კვება დღეში შენს სამიზნესა და ალერგენებზე მორგებული, შესაცვლელი კერძები და საყიდლების ერთი სია.", "Four meals a day fitted to your target and allergens, swappable dishes and one shopping list.")}
              </Text>
              {canGenerate ? <NButton style={{ alignSelf: "stretch" }} disabled={busy || loading} label={busy ? tx("მუშავდება…", "Working…") : tx("7 დღის რაციონის შექმნა", "Create a 7-day plan")} onPress={() => void generate()} /> : null}
            </NCard>
          )}
        </>
      )}
    </NScreen>
  );
}

const s = StyleSheet.create({
  list: { borderRadius: HUB.cardRadius, paddingHorizontal: 14 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 72 },
  mealMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  eat: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  ingredients: { borderRadius: 14, padding: 12, gap: 6 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
