import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ChefHat, Plus } from "lucide-react-native";
import { api } from "@/lib/api";
import { localDay, mealLabels, mealTypeForHour, newUuid, type FoodItem, type SavedFood } from "@/lib/nutrition";
import { syncMealsToHealth } from "@/lib/nutritionHealth";
import { useAuth } from "@/store/AuthContext";
import { HUB, hubText } from "@/theme/hub";
import { ModuleHeaderButton } from "@/components/brand/ModuleHeader";
import { NButton, NCard, NError, NLoading, NNotice, NScreen, NText, useMedifood, withMedifood } from "@/components/nutrition/ProgramUI";
import { HubSection } from "@/components/nutrition/NutritionUi";
import { PortionSheet } from "@/components/nutrition/PortionSheet";
import { SwipeDeleteRow, SwipeGroup } from "@/components/records/SwipeDeleteRow";
import { UndoToast } from "@/components/records/UndoToast";
import { useUndoDelete } from "@/components/records/useUndoDelete";
import { tx } from "@/i18n/locale";

export default withMedifood(function RecipesScreen() {
  const { user } = useAuth();
  return <Recipes key={user?.id || "guest"} />;
});

/** MEDIFOOD · ჩემი რეცეპტები: own dishes, one tap logs a serving, swipe left deletes (with „დაბრუნება“). */
function Recipes() {
  const M = useMedifood();
  const c = M.c;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<SavedFood[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [portion, setPortion] = useState<SavedFood | null>(null);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setError("");
    try {
      const data = await api.nutrition.recipes.list();
      if (n === seq.current) setRecipes(data.recipes);
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        seq.current++;
      };
    }, [load]),
  );
  /** One serving straight into today's diary, filed by the current hour. */
  const logServing = async (item: FoodItem, food: SavedFood) => {
    setPortion(null);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const type = mealTypeForHour(new Date().getHours());
      const { meal } = await api.nutrition.save({ id: newUuid(), date: localDay(), type, items: [{ ...item, name: food.name }], note: "", title: food.name, source: "saved" });
      void import("@/lib/funnel").then(({ trackFirstHealthAction }) => trackFirstHealthAction("meal")).catch(() => undefined);
      void api.nutrition.foods.used([food.id]).catch(() => {});
      void syncMealsToHealth([meal]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMessage(tx(`${food.name} ჩაიწერა · ${mealLabels[type]} · ${Math.round(item.calories)} კკალ`, `${food.name} logged · ${mealLabels[type]} · ${Math.round(item.calories)} kcal`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // A swiped-away recipe disappears at once; the real delete runs after the 5 s „დაბრუნება“ window.
  const { held, remove: hold, undo } = useUndoDelete<SavedFood>((food) => {
    void api.nutrition.recipes
      .remove(food.id)
      .then(() => setRecipes((list) => list?.filter((r) => r.id !== food.id) || list))
      .catch((e) => {
        setError((e as Error).message);
        void load();
      });
  });
  const shown = recipes ? recipes.filter((r) => r.id !== held?.id) : null;
  const openNew = () => router.push("/nutrition/recipe");
  return (
    <>
      <NScreen title={tx("ჩემი რეცეპტები", "My recipes")} right={<ModuleHeaderButton label={tx("ახალი რეცეპტი", "New recipe")} icon={Plus} onPress={openNew} />}>
        {!!error && <NError message={error} retry={() => void load()} />}
        {!!message && <NNotice>{message}</NNotice>}
        {!recipes && !error && <NLoading />}
        {shown && shown.length === 0 && (
          <NCard style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
            <View style={[s.bigTile, { backgroundColor: M.inkSoft }]}>
              <ChefHat size={28} color={M.ink} strokeWidth={1.8} />
            </View>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17, textAlign: "center" }]}>{tx("დედის ლობიო, შენი სალათი, კვირის სუპი", "Mom's lobio, your salad, Sunday soup")}</Text>
            <Text style={[hubText.body, { color: c.text200, textAlign: "center" }]}>
              {tx("ჩაწერე ინგრედიენტები ერთხელ, მიუთითე რამდენ პორციას გამოდის — და შემდეგ ყოველ ჯერზე ერთი შეხებით ჩაიწერს ზუსტ კალორიას და მაკროებს.", "Enter the ingredients once and how many servings it makes — then every time, one tap logs the exact calories and macros.")}
            </Text>
            <NButton icon={Plus} label={tx("პირველი რეცეპტის შექმნა", "Create your first recipe")} onPress={openNew} style={{ alignSelf: "stretch", marginTop: 4 }} />
          </NCard>
        )}
        {shown && shown.length > 0 && (
          <HubSection first title={tx(`${shown.length} რეცეპტი`, `${shown.length} ${shown.length === 1 ? "recipe" : "recipes"}`)}>
            <SwipeGroup>
              <View style={[s.list, { backgroundColor: c.surface }]}>
                {shown.map((r, i) => {
                  const serving = r.serving?.grams || 100;
                  const kcal = Math.round((r.per100.calories * serving) / 100);
                  const servings = r.recipe?.servings || 1;
                  const protein = Math.round((r.per100.protein * serving) / 100);
                  return (
                    <SwipeDeleteRow key={r.id} onDelete={() => hold(r)}>
                      {(open, a11y) => (
                        <View style={{ backgroundColor: c.surface, paddingHorizontal: 14 }}>
                          <View style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={tx(`${r.name}, რედაქტირება`, `${r.name}, edit`)}
                              {...a11y}
                              onPress={() => router.push({ pathname: "/nutrition/recipe", params: { id: r.id } })}
                              onLongPress={open}
                              delayLongPress={350}
                              style={s.main}
                            >
                              <View style={[s.tile, { backgroundColor: M.inkSoft }]}>
                                <ChefHat size={19} color={M.ink} strokeWidth={1.9} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100 }]}>{r.name}</Text>
                                <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>
                                  {tx(`${kcal} კკალ პორცია · ${servings} პორცია · ცილა ${protein} გ`, `${kcal} kcal a serving · ${servings} ${servings === 1 ? "serving" : "servings"} · protein ${protein} g`)}
                                </Text>
                              </View>
                            </Pressable>
                            <Pressable accessibilityRole="button" accessibilityLabel={tx(`${r.name} — პორციის ჩაწერა`, `${r.name} — log a serving`)} disabled={busy} onPress={() => setPortion(r)} hitSlop={4} style={[s.log, { backgroundColor: M.ink, opacity: busy ? 0.5 : 1 }]}>
                              <Plus size={18} color={M.onInk} strokeWidth={2.4} />
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </SwipeDeleteRow>
                  );
                })}
              </View>
            </SwipeGroup>
            <NText style={{ fontSize: 11, lineHeight: 16, color: c.text300, marginTop: 8, marginHorizontal: 4 }}>
              {tx("„+“ ერთ პორციას დღევანდელ დღიურში ჩაწერს. წასაშლელად გადაწიე მარცხნივ. რეცეპტები ძებნასა და „შენახულში“ც ჩანს.", "“+” logs one serving in today's diary. Swipe left to delete. Recipes also show up in search and “Saved”.")}
            </NText>
          </HubSection>
        )}
        <PortionSheet food={portion} onClose={() => setPortion(null)} onAdd={(item, food) => void logServing(item, food)} />
      </NScreen>
      {held ? <UndoToast key={held.id} title={tx("რეცეპტი წაიშალა", "Recipe deleted")} bottom={insets.bottom + 16} onUndo={undo} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  list: { borderRadius: HUB.cardRadius, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 66 },
  main: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  bigTile: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  log: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
