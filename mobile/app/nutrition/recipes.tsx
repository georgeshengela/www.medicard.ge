import { brandHex } from '@/theme/brandTone';
import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChefHat, ChevronRight, Plus, Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { localDay, mealLabels, mealTypeForHour, newUuid, type FoodItem, type SavedFood } from "@/lib/nutrition";
import { syncMealsToHealth } from "@/lib/nutritionHealth";
import { useAuth } from "@/store/AuthContext";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { hubInk, hubText, hubTint } from "@/theme/hub";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { NButton, NError, NLoading, NScreen } from "@/components/nutrition/ProgramUI";
import { HubCard, HubSection } from "@/components/nutrition/NutritionUi";
import { PortionSheet } from "@/components/nutrition/PortionSheet";
import { tx } from '@/i18n/locale';

export default function RecipesScreen() {
  const { user } = useAuth();
  return <Recipes key={user?.id || "guest"} />;
}
function Recipes() {
  const c = useThemeColors(),
    dark = useIsDark(),
    router = useRouter();
  const [recipes, setRecipes] = useState<SavedFood[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [portion, setPortion] = useState<SavedFood | null>(null);
  const [removing, setRemoving] = useState<SavedFood | null>(null);
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
    try {
      const type = mealTypeForHour(new Date().getHours());
      const { meal } = await api.nutrition.save({ id: newUuid(), date: localDay(), type, items: [{ ...item, name: food.name }], note: "", title: food.name, source: "saved" });
      void import('@/lib/funnel').then(({ trackFirstHealthAction }) => trackFirstHealthAction('meal')).catch(() => undefined);
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
  const remove = async (food: SavedFood) => {
    setRemoving(null);
    try {
      await api.nutrition.recipes.remove(food.id);
      setRecipes((list) => list?.filter((r) => r.id !== food.id) || list);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const teal = hubInk("teal", dark);
  return (
    <NScreen title={tx("ჩემი რეცეპტები", "My recipes")} subtitle={tx("საკუთარი კერძები, ზუსტი პორციით", "Your own dishes, with exact portions")} footer={<NButton label={tx("ახალი რეცეპტი", "New recipe")} onPress={() => router.push("/nutrition/recipe")} />}>
      {!!error && <NError message={error} retry={() => void load()} />}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={[hubText.body, { color: c.success, textAlign: "center" }]}>
          {message}
        </Text>
      )}
      {!recipes && !error && <NLoading />}
      {recipes && recipes.length === 0 && (
        <HubSection first title={tx("როგორ მუშაობს", "How it works")}>
          <HubCard tone="spotlight">
            <ChefHat size={30} color="#8AD5C7" />
            <Text style={[hubText.cardTitle, { color: "#FFFFFF", fontSize: 17 }]}>{tx("დედის ლობიო, შენი სალათი, კვირის სუპი", "Mom's lobio, your salad, Sunday soup")}</Text>
            <Text style={[hubText.body, { color: "#B6D9D3" }]}>{tx("ჩაწერე ინგრედიენტები ერთხელ, მიუთითე რამდენ პორციას გამოდის — და შემდეგ ყოველ ჯერზე ერთი შეხებით ჩაიწერს ზუსტ კალორიას და მაკროებს.", "Enter the ingredients once and how many servings it makes — then every time, one tap logs the exact calories and macros.")}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/nutrition/recipe")} style={[s.cta, { backgroundColor: brandHex('#0D9488') }]}>
              <Plus size={17} color="#FFFFFF" />
              <Text style={[hubText.link, { color: "#FFFFFF" }]}>{tx("პირველი რეცეპტის შექმნა", "Create your first recipe")}</Text>
            </Pressable>
          </HubCard>
        </HubSection>
      )}
      {recipes && recipes.length > 0 && (
        <HubSection first title={tx(`${recipes.length} რეცეპტი`, `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`)}>
          <HubCard style={{ gap: 0, paddingVertical: 6 }}>
            {recipes.map((r, i) => {
              const serving = r.serving?.grams || 100;
              const kcal = Math.round((r.per100.calories * serving) / 100);
              return (
                <View key={r.id} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.bg300 }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx(`${r.name}, რედაქტირება`, `${r.name}, edit`)} onPress={() => router.push({ pathname: "/nutrition/recipe", params: { id: r.id } })} style={s.main}>
                    <View style={[s.tile, { backgroundColor: hubTint(teal, dark) }]}>
                      <ChefHat size={19} color={teal} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{r.name}</Text>
                      <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
                        {tx(`${kcal} კკალ / პორცია · ${r.recipe?.servings || 1} პორცია · ც ${Math.round((r.per100.protein * serving) / 100)} გ`, `${kcal} kcal / serving · ${r.recipe?.servings || 1} ${(r.recipe?.servings || 1) === 1 ? "serving" : "servings"} · P ${Math.round((r.per100.protein * serving) / 100)} g`)}
                      </Text>
                    </View>
                    <ChevronRight size={17} color={c.text300} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx(`${r.name} — პორციის ჩაწერა`, `${r.name} — log a serving`)} disabled={busy} onPress={() => setPortion(r)} style={[s.log, { backgroundColor: hubTint(teal, dark) }]}>
                    <Plus size={18} color={teal} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx(`${r.name} — წაშლა`, `${r.name} — delete`)} onPress={() => setRemoving(r)} style={s.icon}>
                    <Trash2 size={17} color={c.text300} />
                  </Pressable>
                </View>
              );
            })}
          </HubCard>
          <Text style={[hubText.caption, { color: c.text300 }]}>{tx("„+“ ერთ პორციას დღევანდელ დღიურში ჩაწერს. რეცეპტები ძებნასა და „შენახულში“ც ჩანს.", "“+” logs one serving in today's diary. Recipes also show up in search and “Saved”.")}</Text>
        </HubSection>
      )}
      <PortionSheet food={portion} onClose={() => setPortion(null)} onAdd={(item, food) => void logServing(item, food)} />
      <Modal visible={!!removing} {...APP_MODAL_PROPS} onRequestClose={() => setRemoving(null)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
          <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: 24, padding: 24, gap: 14 }}>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18 }]}>{tx(`„${removing?.name}“ წაიშალოს?`, `Delete “${removing?.name}”?`)}</Text>
            <Text style={[hubText.body, { color: c.text200 }]}>{tx("დღიურში უკვე ჩაწერილი კვებები არ შეიცვლება.", "Meals already logged in your diary won't change.")}</Text>
            <NButton secondary label={tx("გაუქმება", "Cancel")} onPress={() => setRemoving(null)} />
            <NButton label={tx("წაშლა", "Delete")} onPress={() => removing && void remove(removing)} />
          </View>
        </View>
      </Modal>
    </NScreen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 66 },
  main: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  tile: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  log: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  icon: { width: 40, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
  cta: { minHeight: 48, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
});
