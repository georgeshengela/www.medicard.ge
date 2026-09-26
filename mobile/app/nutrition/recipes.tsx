import React, { useCallback, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ChefHat, ChevronRight, Plus, Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { localDay, mealLabels, mealTypeForHour, newUuid, type FoodItem, type SavedFood } from "@/lib/nutrition";
import { syncMealsToHealth } from "@/lib/nutritionHealth";
import { useAuth } from "@/store/AuthContext";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { hubInk, hubText, hubTint } from "@/theme/hub";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from "@/components/ui/appModal";
import { NButton, NError, NLoading, NScreen } from "@/components/nutrition/ProgramUI";
import { HubCard, HubSection } from "@/components/nutrition/NutritionUi";
import { PortionSheet } from "@/components/nutrition/PortionSheet";

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
      void api.nutrition.foods.used([food.id]).catch(() => {});
      void syncMealsToHealth([meal]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMessage(`${food.name} ჩაიწერა · ${mealLabels[type]} · ${Math.round(item.calories)} კკალ`);
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
    <NScreen title="ჩემი რეცეპტები" subtitle="საკუთარი კერძები, ზუსტი პორციით" footer={<NButton label="ახალი რეცეპტი" onPress={() => router.push("/nutrition/recipe")} />}>
      {!!error && <NError message={error} retry={() => void load()} />}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={[hubText.body, { color: c.success, textAlign: "center" }]}>
          {message}
        </Text>
      )}
      {!recipes && !error && <NLoading />}
      {recipes && recipes.length === 0 && (
        <HubSection first title="როგორ მუშაობს">
          <HubCard tone="spotlight">
            <ChefHat size={30} color="#8AD5C7" />
            <Text style={[hubText.cardTitle, { color: "#FFFFFF", fontSize: 17 }]}>დედის ლობიო, შენი სალათი, კვირის სუპი</Text>
            <Text style={[hubText.body, { color: "#B6D9D3" }]}>ჩაწერე ინგრედიენტები ერთხელ, მიუთითე რამდენ პორციას გამოდის — და შემდეგ ყოველ ჯერზე ერთი შეხებით ჩაიწერს ზუსტ კალორიას და მაკროებს.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/nutrition/recipe")} style={[s.cta, { backgroundColor: "#0D9488" }]}>
              <Plus size={17} color="#FFFFFF" />
              <Text style={[hubText.link, { color: "#FFFFFF" }]}>პირველი რეცეპტის შექმნა</Text>
            </Pressable>
          </HubCard>
        </HubSection>
      )}
      {recipes && recipes.length > 0 && (
        <HubSection first title={`${recipes.length} რეცეპტი`}>
          <HubCard style={{ gap: 0, paddingVertical: 6 }}>
            {recipes.map((r, i) => {
              const serving = r.serving?.grams || 100;
              const kcal = Math.round((r.per100.calories * serving) / 100);
              return (
                <View key={r.id} style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.bg300 }]}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${r.name}, რედაქტირება`} onPress={() => router.push({ pathname: "/nutrition/recipe", params: { id: r.id } })} style={s.main}>
                    <View style={[s.tile, { backgroundColor: hubTint(teal, dark) }]}>
                      <ChefHat size={19} color={teal} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{r.name}</Text>
                      <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
                        {kcal} კკალ / პორცია · {r.recipe?.servings || 1} პორცია · ც {Math.round((r.per100.protein * serving) / 100)} გ
                      </Text>
                    </View>
                    <ChevronRight size={17} color={c.text300} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${r.name} — პორციის ჩაწერა`} disabled={busy} onPress={() => setPortion(r)} style={[s.log, { backgroundColor: hubTint(teal, dark) }]}>
                    <Plus size={18} color={teal} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${r.name} — წაშლა`} onPress={() => setRemoving(r)} style={s.icon}>
                    <Trash2 size={17} color={c.text300} />
                  </Pressable>
                </View>
              );
            })}
          </HubCard>
          <Text style={[hubText.caption, { color: c.text300 }]}>„+“ ერთ პორციას დღევანდელ დღიურში ჩაწერს. რეცეპტები ძებნასა და „შენახულში“ც ჩანს.</Text>
        </HubSection>
      )}
      <PortionSheet food={portion} onClose={() => setPortion(null)} onAdd={(item, food) => void logServing(item, food)} />
      <Modal visible={!!removing} {...APP_MODAL_PROPS} onRequestClose={() => setRemoving(null)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
          <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: 24, padding: 24, gap: 14 }}>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18 }]}>„{removing?.name}“ წაიშალოს?</Text>
            <Text style={[hubText.body, { color: c.text200 }]}>დღიურში უკვე ჩაწერილი კვებები არ შეიცვლება.</Text>
            <NButton secondary label="გაუქმება" onPress={() => setRemoving(null)} />
            <NButton label="წაშლა" onPress={() => removing && void remove(removing)} />
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
