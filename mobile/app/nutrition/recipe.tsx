import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Bookmark, ChefHat, Minus, PenLine, Plus, Search, Sparkles, X } from "lucide-react-native";
import { api } from "@/lib/api";
import {
  foodFields,
  foodTotals,
  healthScore,
  itemFromFields,
  newUuid,
  scaleFood,
  type FoodFields,
  type FoodItem,
} from "@/lib/nutrition";
import { useAuth } from "@/store/AuthContext";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubInk, hubText, hubTint } from "@/theme/hub";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { NButton, NError, NLoading, NScreen } from "@/components/nutrition/ProgramUI";
import { HubCard, HubSection, MacroLine, ScoreBadge } from "@/components/nutrition/NutritionUi";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { FoodSearchModal, type FoodPick } from "@/components/nutrition/FoodSearchModal";
import { DescribeMealModal } from "@/components/nutrition/DescribeMealModal";

export default function RecipeScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" && params.id ? params.id : "";
  return <RecipeEditor key={(user?.id || "guest") + id} owner={user?.id || ""} recipeId={id} />;
}

type Sheet = null | "search" | "saved" | "describe" | "manual";
const snapshot = (name: string, servings: number, items: FoodItem[]) => JSON.stringify({ name: name.trim(), servings, items });

/**
 * Build a recipe from ingredients: search, saved foods, a described list
 * (AI estimate the person reviews) or manual values. Saved as one food whose
 * serving is the pot divided by the number of servings.
 */
function RecipeEditor({ owner, recipeId }: { owner: string; recipeId: string }) {
  const c = useThemeColors(),
    dark = useIsDark(),
    router = useRouter();
  const [id] = useState(() => recipeId || newUuid());
  const [name, setName] = useState("");
  const [servings, setServings] = useState(2);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(!!recipeId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sheetError, setSheetError] = useState("");
  const [manual, setManual] = useState<FoodFields>(foodFields());
  const [leave, setLeave] = useState(false);
  const baseline = useRef(snapshot("", 2, []));
  useEffect(() => {
    if (!recipeId) return;
    let alive = true;
    api.nutrition.recipes
      .get(recipeId)
      .then(({ recipe }) => {
        if (!alive) return;
        const r = recipe.recipe;
        setName(recipe.name);
        setServings(r?.servings || 1);
        setItems(r?.items || []);
        baseline.current = snapshot(recipe.name, r?.servings || 1, r?.items || []);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [recipeId]);
  const dirty = snapshot(name, servings, items) !== baseline.current;
  const back = () => {
    if (busy) return;
    if (dirty) setLeave(true);
    else if (router.canGoBack()) router.back();
    else router.replace("/nutrition/recipes");
  };
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (sheet) {
          setSheet(null);
          return true;
        }
        back();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheet, dirty, busy]),
  );
  const add = (next: FoodItem[]) => {
    setItems((current) => [...current, ...next].slice(0, 40));
    void Haptics.selectionAsync().catch(() => {});
  };
  const onPick = (pick: FoodPick) => {
    setSheet(null);
    add(pick.items);
    if (pick.foodIds.length) void api.nutrition.foods.used(pick.foodIds).catch(() => {});
  };
  const describe = async (text: string) => {
    if (busy) return;
    setBusy(true);
    setSheetError("");
    try {
      const result = await api.nutrition.estimate(null, { mode: "text", description: text });
      if (!result.foodDetected || !result.items.length) throw new Error("ინგრედიენტები ვერ ამოვიცანი. ჩამოწერე რაოდენობებით, მაგ. „500 გ ქათამი, 200 გ ბრინჯი“.");
      add(result.items);
      if (!name.trim() && result.dishName) setName(result.dishName);
      setSheet(null);
    } catch (e) {
      setSheetError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const addManual = () => {
    const { item, error: problem } = itemFromFields(manual);
    if (!item) {
      setSheetError(problem);
      return;
    }
    add([item]);
    setManual(foodFields());
    setSheetError("");
    setSheet(null);
  };
  const save = async () => {
    if (busy) return;
    if (!name.trim()) return setError("მიუთითე რეცეპტის სახელი.");
    if (!items.length) return setError("დაამატე მინიმუმ ერთი ინგრედიენტი.");
    setBusy(true);
    setError("");
    try {
      await api.nutrition.recipes.save({ id, name: name.trim(), servings, items, favorite: true });
      baseline.current = snapshot(name, servings, items);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (router.canGoBack()) router.back();
      else router.replace("/nutrition/recipes");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const total = useMemo(() => foodTotals(items), [items]);
  const grams = items.reduce((sum, i) => sum + i.grams, 0);
  const per = (v: number) => Math.round((v / servings) * 10) / 10;
  const score = items.length ? healthScore(items) : null;
  const teal = hubInk("teal", dark);
  const inputStyle = [s.input, { backgroundColor: c.bg200, color: c.text100, borderColor: c.bg300 }];
  return (
    <NScreen
      title={recipeId ? "რეცეპტის რედაქტირება" : "ახალი რეცეპტი"}
      subtitle="ინგრედიენტები → პორციები → ერთი შეხებით ჩაწერა"
      onBack={back}
      footer={<NButton label={busy ? "ინახება…" : "რეცეპტის შენახვა"} disabled={busy || loading || !items.length || !name.trim()} onPress={() => void save()} />}
    >
      {loading ? (
        <NLoading />
      ) : (
        <>
          {!!error && <NError message={error} />}
          <HubSection first title="რეცეპტი">
            <HubCard>
              <TextInput accessibilityLabel="რეცეპტის სახელი" placeholder="მაგ. ჩაქაფული, ქათმის სუპი" placeholderTextColor={c.text300} value={name} onChangeText={setName} maxLength={120} style={[inputStyle, { fontSize: 17, fontFamily: "NotoSansGeorgian_600SemiBold" }]} />
              <View style={s.row}>
                <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>რამდენ პორციას გამოდის?</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="ნაკლები პორცია" disabled={servings <= 1} onPress={() => setServings((n) => Math.max(1, n - 1))} style={[s.round, { backgroundColor: c.bg200, opacity: servings <= 1 ? 0.4 : 1 }]}>
                  <Minus size={17} color={c.text100} />
                </Pressable>
                <Text accessibilityLiveRegion="polite" style={[hubText.value, { color: c.text100, minWidth: 32, textAlign: "center", fontSize: 18 }]}>{servings}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="მეტი პორცია" disabled={servings >= 50} onPress={() => setServings((n) => Math.min(50, n + 1))} style={[s.round, { backgroundColor: c.bg200, opacity: servings >= 50 ? 0.4 : 1 }]}>
                  <Plus size={17} color={c.text100} />
                </Pressable>
              </View>
            </HubCard>
          </HubSection>

          {items.length > 0 && (
            <HubSection title="ერთი პორცია">
              <HubCard tone="spotlight">
                <View style={s.row}>
                  <Text style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 34, lineHeight: 42, color: "#FFFFFF", flex: 1 }}>
                    {Math.round(total.calories / servings)}
                    <Text style={{ fontSize: 14, fontFamily: "NotoSansGeorgian_400Regular", color: "#B6D9D3" }}> კკალ · {Math.round(grams / servings)} გ</Text>
                  </Text>
                  <ScoreBadge score={score} />
                </View>
                <MacroLine protein={per(total.protein)} carbs={per(total.carbs)} fat={per(total.fat)} color="#D1E7E3" />
                <Text style={[hubText.caption, { color: "#B6D9D3" }]}>
                  მთლიანი: {total.calories} კკალ · {Math.round(grams)} გ · {items.length} ინგრედიენტი
                </Text>
              </HubCard>
              {score != null && <MedicalSourcesLink sourceIds={["mealQuality"]} />}
            </HubSection>
          )}

          <HubSection title="ინგრედიენტები">
            {items.length === 0 && (
              <HubCard>
                <View style={[s.row, { justifyContent: "center" }]}>
                  <ChefHat size={30} color={teal} />
                </View>
                <Text style={[hubText.body, { color: c.text200, textAlign: "center" }]}>დაამატე ყველაფერი, რაც ქვაბში ჩადის — წონა მოუმზადებელი სახით. ზეთსაც ნუ დაივიწყებ.</Text>
              </HubCard>
            )}
            {items.map((item, index) => (
              <HubCard key={index} style={{ gap: 8 }}>
                <View style={s.row}>
                  <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{item.name}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="ინგრედიენტის ამოშლა" onPress={() => setItems((list) => list.filter((_, n) => n !== index))} style={s.round}>
                    <X size={17} color={c.text200} />
                  </Pressable>
                </View>
                <Text style={[hubText.value, { color: c.text100 }]}>
                  {Math.round(item.calories)} კკალ <Text style={[hubText.caption, { color: c.text300 }]}>· {item.grams} გ</Text>
                </Text>
                <MacroLine protein={item.protein} carbs={item.carbs} fat={item.fat} />
                <View style={s.row}>
                  {[
                    ["½", 0.5],
                    ["×2", 2],
                  ].map(([label, k]) => (
                    <Pressable key={String(label)} accessibilityRole="button" accessibilityLabel={`${item.name} ${label}`} onPress={() => setItems((list) => list.map((v, n) => (n === index && v.grams * (k as number) <= 10000 ? scaleFood(v, Math.max(0.1, v.grams * (k as number))) : v)))} style={[s.step, { backgroundColor: c.bg200 }]}>
                      <Text style={[hubText.link, { color: c.text100 }]}>{label}</Text>
                    </Pressable>
                  ))}
                  <GramsField grams={item.grams} onGrams={(g) => setItems((list) => list.map((v, n) => (n === index ? scaleFood(v, g) : v)))} />
                </View>
              </HubCard>
            ))}
            <View style={s.addGrid}>
              {[
                ["search", "ძებნა", Search],
                ["saved", "შენახული", Bookmark],
                ["describe", "ჩამოწერე", Sparkles],
                ["manual", "ხელით", PenLine],
              ].map(([key, label, Icon]) => {
                const I = Icon as typeof Search;
                return (
                  <Pressable key={key as string} accessibilityRole="button" accessibilityLabel={`ინგრედიენტის დამატება: ${label}`} disabled={items.length >= 40} onPress={() => { setSheetError(""); setSheet(key as Sheet); }} style={[s.add, { backgroundColor: c.surface }]}>
                    <View style={[s.tile, { backgroundColor: hubTint(teal, dark) }]}>
                      <I size={18} color={teal} />
                    </View>
                    <Text style={[hubText.link, { color: c.text100 }]}>{label as string}</Text>
                  </Pressable>
                );
              })}
            </View>
          </HubSection>
          <Text style={[hubText.caption, { color: c.text300 }]}>რეცეპტი შენახულ საკვებში ჩნდება — დღიურში „შენახულიდან“ ან ძებნით ჩაწერ, პორციის არჩევით.</Text>
        </>
      )}

      <FoodSearchModal visible={sheet === "search" || sheet === "saved"} initialTab={sheet === "saved" ? "recent" : "search"} onClose={() => setSheet(null)} onPick={onPick} />
      <DescribeMealModal visible={sheet === "describe"} owner={owner} busy={busy} error={sheetError} onClose={() => setSheet(null)} onSubmit={(text) => void describe(text)} />
      <Modal visible={sheet === "manual"} {...APP_MODAL_PROPS} onRequestClose={() => setSheet(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={() => setSheet(null)} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface }]}>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17 }]}>ინგრედიენტი ხელით</Text>
            <Text style={[hubText.caption, { color: c.text300 }]}>მთლიანი რაოდენობის მნიშვნელობები (არა 100 გრამის).</Text>
            <TextInput accessibilityLabel="სახელი" placeholder="სახელი" placeholderTextColor={c.text300} value={manual.name} onChangeText={(v) => setManual({ ...manual, name: v })} maxLength={120} style={inputStyle} />
            <View style={s.fieldGrid}>
              {(
                [
                  ["grams", "გრამი"],
                  ["calories", "კკალ"],
                  ["protein", "ცილა გ"],
                  ["carbs", "ნახშ. გ"],
                  ["fat", "ცხიმი გ"],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={{ width: "31%", flexGrow: 1, gap: 4 }}>
                  <Text style={[hubText.small, { color: c.text200 }]}>{label}</Text>
                  <TextInput accessibilityLabel={label} value={manual[key]} onChangeText={(v) => setManual({ ...manual, [key]: v })} keyboardType="decimal-pad" maxLength={8} style={inputStyle} />
                </View>
              ))}
            </View>
            {!!sheetError && <Text accessibilityRole="alert" style={[hubText.body, { color: c.danger }]}>{sheetError}</Text>}
            <NButton label="დამატება" onPress={addManual} />
            <NButton secondary label="გაუქმება" onPress={() => setSheet(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={leave} {...APP_MODAL_PROPS} onRequestClose={() => setLeave(false)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
          <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: 24, padding: 24, gap: 14 }}>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18 }]}>გამოსვლა შენახვის გარეშე?</Text>
            <Text style={[hubText.body, { color: c.text200 }]}>რეცეპტის ცვლილებები დაიკარგება.</Text>
            <NButton secondary label="დარჩენა" onPress={() => setLeave(false)} />
            <NButton
              label="გამოსვლა"
              onPress={() => {
                setLeave(false);
                if (router.canGoBack()) router.back();
                else router.replace("/nutrition/recipes");
              }}
            />
          </View>
        </View>
      </Modal>
    </NScreen>
  );
}

/** Grams for one ingredient; every nutrient rescales from the typed weight. */
function GramsField({ grams, onGrams }: { grams: number; onGrams: (g: number) => void }) {
  const c = useThemeColors();
  const [text, setText] = useState(String(grams));
  useEffect(() => setText(String(grams)), [grams]);
  const commit = () => {
    const value = Number(text.replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value <= 10000 && value !== grams) onGrams(value);
    else setText(String(grams));
  };
  return (
    <View style={[s.gramsBox, { backgroundColor: c.bg200 }]}>
      <TextInput accessibilityLabel="წონა გრამებში" value={text} onChangeText={setText} onEndEditing={commit} onBlur={commit} keyboardType="decimal-pad" maxLength={7} style={[s.gramsInput, { color: c.text100 }]} />
      <Text style={[hubText.caption, { color: c.text300 }]}>გ</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  step: { minWidth: 56, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, minHeight: 48, fontFamily: "NotoSansGeorgian_400Regular" },
  addGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  add: { width: "48%", flexGrow: 1, minHeight: 60, borderRadius: HUB.cardRadius, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, gap: 12 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gramsBox: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 4 },
  gramsInput: { flex: 1, fontSize: 16, minHeight: 44, fontFamily: "NotoSansGeorgian_400Regular" },
});
