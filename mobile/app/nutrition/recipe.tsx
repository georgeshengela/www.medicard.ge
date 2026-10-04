import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Bookmark, ChefHat, PenLine, Search, Sparkles, X } from "lucide-react-native";
import { api } from "@/lib/api";
import { tx } from "@/i18n/locale";
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
import { useThemeColors } from "@/theme/colors";
import { HUB, hubText } from "@/theme/hub";
import { MODULE_BRANDS } from "@/theme/moduleBrand";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { useKeyboardPad } from "@/components/ui/KeyboardFormShell";
import { NButton, NConfirm, NError, NLoading, NScreen, NStepper, useMedifood, withMedifood } from "@/components/nutrition/ProgramUI";
import { HubCard, HubSection, MacroLine, ScoreBadge } from "@/components/nutrition/NutritionUi";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { FoodSearchModal, type FoodPick } from "@/components/nutrition/FoodSearchModal";
import { DescribeMealModal } from "@/components/nutrition/DescribeMealModal";
import { aiConsentDeclinedText, isAiConsentDeclined } from "@/lib/aiConsentDecline";

export default withMedifood(function RecipeScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" && params.id ? params.id : "";
  return <RecipeEditor key={(user?.id || "guest") + id} owner={user?.id || ""} recipeId={id} />;
});

const BRAND = MODULE_BRANDS.food;

type Sheet = null | "search" | "saved" | "describe" | "manual";
const snapshot = (name: string, servings: number, items: FoodItem[]) => JSON.stringify({ name: name.trim(), servings, items });

/**
 * Build a recipe from ingredients: search, saved foods, a described list
 * (AI estimate the person reviews) or manual values. Saved as one food whose
 * serving is the pot divided by the number of servings.
 */
function RecipeEditor({ owner, recipeId }: { owner: string; recipeId: string }) {
  const c = useThemeColors(),
    M = useMedifood(),
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
  const [describeNotice, setDescribeNotice] = useState("");
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
    setDescribeNotice("");
    try {
      const result = await api.nutrition.estimate(null, { mode: "text", description: text });
      if (!result.foodDetected || !result.items.length) throw new Error(tx("ინგრედიენტები ვერ ამოვიცანი. ჩამოწერე რაოდენობებით, მაგ. „500 გ ქათამი, 200 გ ბრინჯი“.", "I couldn't recognize the ingredients. List them with amounts, e.g. \"500 g chicken, 200 g rice\"."));
      add(result.items);
      if (!name.trim() && result.dishName) setName(result.dishName);
      setSheet(null);
    } catch (e) {
      // Declined / closed the AI disclosure: a calm line in the sheet, the text stays for „დათვალე“.
      if (isAiConsentDeclined(e)) setDescribeNotice(aiConsentDeclinedText());
      else setSheetError((e as Error).message);
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
    if (!name.trim()) return setError(tx("მიუთითე რეცეპტის სახელი.", "Enter a recipe name."));
    if (!items.length) return setError(tx("დაამატე მინიმუმ ერთი ინგრედიენტი.", "Add at least one ingredient."));
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
  const inputStyle = [s.input, { backgroundColor: c.bg200, color: c.text100 }];
  return (
    <NScreen
      title={recipeId ? tx("რეცეპტის რედაქტირება", "Edit recipe") : tx("ახალი რეცეპტი", "New recipe")}
      onBack={back}
      footer={<NButton label={busy ? tx("ინახება…", "Saving…") : tx("რეცეპტის შენახვა", "Save recipe")} disabled={busy || loading || !items.length || !name.trim()} onPress={() => void save()} />}
    >
      {loading ? (
        <NLoading />
      ) : (
        <>
          {!!error && <NError message={error} />}
          <HubSection first title={tx("რეცეპტი", "Recipe")}>
            <HubCard>
              <TextInput accessibilityLabel={tx("რეცეპტის სახელი", "Recipe name")} placeholder={tx("მაგ. ჩაქაფული, ქათმის სუპი", "e.g. chakapuli, chicken soup")} placeholderTextColor={c.text300} value={name} onChangeText={setName} maxLength={120} style={[inputStyle, { fontSize: 17, fontFamily: "NotoSansGeorgian_600SemiBold" }]} />
              <View style={s.row}>
                <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>{tx("რამდენ პორციას გამოდის?", "How many servings does it make?")}</Text>
                <NStepper
                  value={String(servings)}
                  width={32}
                  minusLabel={tx("ნაკლები პორცია", "Fewer servings")}
                  plusLabel={tx("მეტი პორცია", "More servings")}
                  minusDisabled={servings <= 1}
                  plusDisabled={servings >= 50}
                  onMinus={() => setServings((n) => Math.max(1, n - 1))}
                  onPlus={() => setServings((n) => Math.min(50, n + 1))}
                />
              </View>
            </HubCard>
          </HubSection>

          {items.length > 0 && (
            <HubSection title={tx("ერთი პორცია", "One serving")}>
              <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
                <View style={s.row}>
                  <Text style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 34, lineHeight: 42, color: "#FFFFFF", flex: 1 }}>
                    {Math.round(total.calories / servings)}
                    <Text style={{ fontSize: 14, fontFamily: "NotoSansGeorgian_400Regular", color: BRAND.onHero }}>{tx(" კკალ", " kcal")} · {Math.round(grams / servings)} {tx("გ", "g")}</Text>
                  </Text>
                  <View style={{ backgroundColor: "#FFFFFF", borderRadius: 11 }}>
                    <ScoreBadge score={score} />
                  </View>
                </View>
                <MacroLine protein={per(total.protein)} carbs={per(total.carbs)} fat={per(total.fat)} color="#FFFFFF" />
                <Text style={[hubText.caption, { color: BRAND.onHero }]}>
                  {tx(
                    `მთლიანი: ${total.calories} კკალ · ${Math.round(grams)} გ · ${items.length} ინგრედიენტი`,
                    `Total: ${total.calories} kcal · ${Math.round(grams)} g · ${items.length} ${items.length === 1 ? "ingredient" : "ingredients"}`,
                  )}
                </Text>
              </LinearGradient>
              {score != null && <MedicalSourcesLink sourceIds={["mealQuality"]} />}
            </HubSection>
          )}

          <HubSection title={tx("ინგრედიენტები", "Ingredients")}>
            {items.length === 0 && (
              <HubCard>
                <View style={[s.row, { justifyContent: "center" }]}>
                  <View style={[s.bigTile, { backgroundColor: M.inkSoft }]}>
                    <ChefHat size={26} color={M.ink} strokeWidth={1.8} />
                  </View>
                </View>
                <Text style={[hubText.body, { color: c.text200, textAlign: "center" }]}>{tx("დაამატე ყველაფერი, რაც ქვაბში ჩადის — წონა მოუმზადებელი სახით. ზეთსაც ნუ დაივიწყებ.", "Add everything that goes into the pot — weights uncooked. Don't forget the oil.")}</Text>
              </HubCard>
            )}
            {items.map((item, index) => (
              <HubCard key={index} style={{ gap: 8 }}>
                <View style={s.row}>
                  <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{item.name}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx("ინგრედიენტის ამოშლა", "Remove ingredient")} onPress={() => setItems((list) => list.filter((_, n) => n !== index))} style={s.round}>
                    <X size={17} color={c.text200} />
                  </Pressable>
                </View>
                <Text style={[hubText.value, { color: c.text100 }]}>
                  {Math.round(item.calories)} {tx("კკალ", "kcal")} <Text style={[hubText.caption, { color: c.text300 }]}>· {item.grams} {tx("გ", "g")}</Text>
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
                ["search", tx("ძებნა", "Search"), Search],
                ["saved", tx("შენახული", "Saved"), Bookmark],
                ["describe", tx("ჩამოწერე", "Describe"), Sparkles],
                ["manual", tx("ხელით", "Manual"), PenLine],
              ].map(([key, label, Icon]) => {
                const I = Icon as typeof Search;
                return (
                  <Pressable key={key as string} accessibilityRole="button" accessibilityLabel={tx(`ინგრედიენტის დამატება: ${label}`, `Add ingredient: ${label}`)} disabled={items.length >= 40} onPress={() => { setSheetError(""); setDescribeNotice(""); setSheet(key as Sheet); }} style={[s.add, { backgroundColor: c.surface }]}>
                    <View style={[s.tile, { backgroundColor: M.inkSoft }]}>
                      <I size={18} color={M.ink} />
                    </View>
                    <Text style={[hubText.link, { color: c.text100 }]}>{label as string}</Text>
                  </Pressable>
                );
              })}
            </View>
          </HubSection>
          <Text style={[hubText.caption, { color: c.text300 }]}>{tx("რეცეპტი შენახულ საკვებში ჩნდება — დღიურში „შენახულიდან“ ან ძებნით ჩაწერ, პორციის არჩევით.", "The recipe appears in your saved foods — log it in the diary from Saved or by search, choosing a portion.")}</Text>
        </>
      )}

      <FoodSearchModal visible={sheet === "search" || sheet === "saved"} initialTab={sheet === "saved" ? "recent" : "search"} onClose={() => setSheet(null)} onPick={onPick} />
      <DescribeMealModal visible={sheet === "describe"} owner={owner} busy={busy} error={sheetError} consentNotice={describeNotice} onClose={() => setSheet(null)} onSubmit={(text) => void describe(text)} />
      <Modal visible={sheet === "manual"} {...APP_MODAL_PROPS} onRequestClose={() => setSheet(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={() => setSheet(null)} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
        <ManualSheet>
          <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17 }]}>{tx("ინგრედიენტი ხელით", "Add ingredient manually")}</Text>
          <Text style={[hubText.caption, { color: c.text300 }]}>{tx("მთლიანი რაოდენობის მნიშვნელობები (არა 100 გრამის).", "Values for the whole amount (not per 100 g).")}</Text>
          <TextInput accessibilityLabel={tx("სახელი", "Name")} placeholder={tx("სახელი", "Name")} placeholderTextColor={c.text300} value={manual.name} onChangeText={(v) => setManual({ ...manual, name: v })} maxLength={120} style={inputStyle} />
          <View style={s.fieldGrid}>
            {(
              [
                ["grams", tx("გრამი", "Grams")],
                ["calories", tx("კკალ", "kcal")],
                ["protein", tx("ცილა გ", "Protein g")],
                ["carbs", tx("ნახშ. გ", "Carbs g")],
                ["fat", tx("ცხიმი გ", "Fat g")],
              ] as const
            ).map(([key, label]) => (
              <View key={key} style={{ width: "31%", flexGrow: 1, gap: 4 }}>
                <Text style={[hubText.small, { color: c.text200 }]}>{label}</Text>
                <TextInput accessibilityLabel={label} value={manual[key]} onChangeText={(v) => setManual({ ...manual, [key]: v })} keyboardType="decimal-pad" maxLength={8} style={inputStyle} />
              </View>
            ))}
          </View>
          {!!sheetError && <Text accessibilityRole="alert" style={[hubText.body, { color: c.danger }]}>{sheetError}</Text>}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <NButton secondary label={tx("გაუქმება", "Cancel")} onPress={() => setSheet(null)} style={{ flex: 1 }} />
            <NButton label={tx("დამატება", "Add")} onPress={addManual} style={{ flex: 1 }} />
          </View>
        </ManualSheet>
      </Modal>
      <NConfirm
        visible={leave}
        title={tx("გამოსვლა შენახვის გარეშე?", "Leave without saving?")}
        message={tx("რეცეპტის ცვლილებები დაიკარგება.", "Your recipe changes will be lost.")}
        cancelLabel={tx("დარჩენა", "Stay")}
        confirmLabel={tx("გამოსვლა", "Leave")}
        danger
        onClose={() => setLeave(false)}
        onConfirm={() => {
          setLeave(false);
          if (router.canGoBack()) router.back();
          else router.replace("/nutrition/recipes");
        }}
      />
    </NScreen>
  );
}

/** The manual-ingredient sheet: its bottom padding follows the keyboard (KeyboardFormShell's measured pad). */
function ManualSheet({ children }: { children: React.ReactNode }) {
  const c = useThemeColors();
  const { frameRef, onLayout, pad } = useKeyboardPad(34);
  const padStyle = useAnimatedStyle(() => ({ paddingBottom: pad.value }));
  return (
    <View ref={frameRef} onLayout={onLayout} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
      <Animated.View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface }, padStyle]}>
        {children}
      </Animated.View>
    </View>
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
      <TextInput accessibilityLabel={tx("წონა გრამებში", "Weight in grams")} value={text} onChangeText={setText} onEndEditing={commit} onBlur={commit} keyboardType="decimal-pad" maxLength={7} style={[s.gramsInput, { color: c.text100 }]} />
      <Text style={[hubText.caption, { color: c.text300 }]}>{tx("გ", "g")}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 40, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
  hero: { borderRadius: HUB.cardRadius, padding: 16, gap: 8, overflow: "hidden" },
  glow: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -60, top: -80 },
  bigTile: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  step: { minWidth: 56, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, minHeight: 48, fontFamily: "NotoSansGeorgian_400Regular" },
  addGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  add: { width: "48%", flexGrow: 1, minHeight: 60, borderRadius: HUB.cardRadius, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gramsBox: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 4 },
  gramsInput: { flex: 1, fontSize: 16, minHeight: 44, fontFamily: "NotoSansGeorgian_400Regular" },
});
