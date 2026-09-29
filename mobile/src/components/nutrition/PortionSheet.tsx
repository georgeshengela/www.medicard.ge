import React, { useEffect, useMemo, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, BookmarkCheck, X } from "lucide-react-native";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { useThemeColors } from "@/theme/colors";
import { hubText } from "@/theme/hub";
import { healthScore, healthScoreLabel, portionFromFood, type FoodItem, type SavedFood } from "@/lib/nutrition";
import { tx } from '@/i18n/locale';

/**
 * Portion picker for a food with per-100 g facts: serving chips, quick
 * multipliers and a grams field. Shows the resulting item before adding.
 */
export function PortionSheet({
  food,
  onAdd,
  onClose,
  onToggleFavorite,
}: {
  food: SavedFood | null;
  onAdd: (item: FoodItem, food: SavedFood, grams: number) => void;
  onClose: () => void;
  onToggleFavorite?: (food: SavedFood) => void;
}) {
  const c = useThemeColors();
  const safe = useSafeAreaInsets();
  const [grams, setGrams] = useState("100");
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (food) setGrams(String(food.serving?.grams || 100));
  }, [food]);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  const amount = Number(grams.replace(",", "."));
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 10000;
  const item = useMemo(() => (food && valid ? portionFromFood(food, amount) : null), [food, valid, amount]);
  const score = item ? healthScore([item]) : null;
  const serving = food?.serving?.grams || 100;
  const chips: { label: string; grams: number }[] = [
    { label: `½ ${food?.serving?.label || tx("ულუფა", "serving")}`, grams: serving / 2 },
    { label: `1 ${food?.serving?.label || tx("ულუფა", "serving")}`, grams: serving },
    { label: `2 ${food?.serving?.label || tx("ულუფა", "servings")}`, grams: serving * 2 },
    { label: tx("100 გ", "100 g"), grams: 100 },
  ];
  const txt = { color: c.text100, fontFamily: "NotoSansGeorgian_400Regular" };
  return (
    <Modal visible={!!food} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        {food && (
          <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface, paddingBottom: keyboard ? 12 : Math.max(safe.bottom, 16) }]}>
            <View style={s.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, fontSize: 17 }]}>{food.name}</Text>
                <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
                  {[food.brand, food.kind === "product" ? "Open Food Facts" : food.kind === "usda" ? "USDA" : food.kind === "catalog" ? (food.quality === "estimate" ? tx("ქართული კერძი · შეფასება", "Georgian dish · estimate") : tx("საცნობარო ბაზა", "Reference database")) : tx("შენახული", "Saved")].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {onToggleFavorite && (
                <Pressable accessibilityRole="button" accessibilityLabel={food.favorite ? tx("რჩეულიდან ამოღება", "Remove from favorites") : tx("რჩეულებში დამატება", "Add to favorites")} onPress={() => onToggleFavorite(food)} style={s.iconButton}>
                  {food.favorite ? <BookmarkCheck size={22} color={c.primary100} /> : <Bookmark size={22} color={c.text200} />}
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={s.iconButton}>
                <X size={20} color={c.text200} />
              </Pressable>
            </View>
            <View style={s.chips}>
              {chips.map((chip) => {
                const active = valid && Math.abs(amount - chip.grams) < 0.01;
                return (
                  <Pressable key={chip.label} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setGrams(String(Math.round(chip.grams * 10) / 10))} style={[s.chip, { backgroundColor: active ? c.accent100 : c.bg200, borderColor: active ? c.primary100 : c.bg300 }]}>
                    <Text numberOfLines={1} style={[txt, { fontSize: 12 }]}>{chip.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={s.row}>
              <TextInput
                accessibilityLabel={tx("პორცია გრამებში", "Portion in grams")}
                value={grams}
                onChangeText={setGrams}
                keyboardType="decimal-pad"
                maxLength={7}
                selectTextOnFocus
                style={[s.input, { backgroundColor: c.bg200, color: c.text100, borderColor: valid ? c.bg300 : c.danger }]}
              />
              <Text style={[txt, { color: c.text200 }]}>{tx("გრამი", "grams")}</Text>
              <View style={{ flex: 1 }} />
              {item && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[hubText.value, { color: c.text100, fontSize: 22, lineHeight: 28 }]}>{Math.round(item.calories)} <Text style={[hubText.small, { color: c.text200 }]}>{tx("კკალ", "kcal")}</Text></Text>
                  <Text style={[hubText.small, { color: c.text200 }]}>{tx(`ც ${item.protein} · ნ ${item.carbs} · ცხ ${item.fat} გ`, `P ${item.protein} · C ${item.carbs} · F ${item.fat} g`)}</Text>
                </View>
              )}
            </View>
            {item && (
              <View style={s.row}>
                <Text style={[hubText.small, { color: c.text200, flex: 1 }]}>
                  {item.fiber != null ? tx(`ბოჭკო ${item.fiber} გ`, `Fiber ${item.fiber} g`) : tx("ბოჭკო —", "Fiber —")} · {item.sugar != null ? tx(`შაქარი ${item.sugar} გ`, `Sugar ${item.sugar} g`) : tx("შაქარი —", "Sugar —")} · {item.sodium != null ? tx(`ნატრიუმი ${Math.round(item.sodium)} მგ`, `Sodium ${Math.round(item.sodium)} mg`) : tx("ნატრიუმი —", "Sodium —")}
                </Text>
                {score != null && <Text style={[hubText.small, { color: c.primary100 }]}>{score}/10 · {healthScoreLabel(score)}</Text>}
              </View>
            )}
            {score != null && <MedicalSourcesLink sourceIds={["mealQuality"]} />}
            <Pressable
              accessibilityRole="button"
              disabled={!item}
              onPress={() => item && onAdd(item, food, amount)}
              style={[s.primary, { backgroundColor: "#0F766E", opacity: item ? 1 : 0.45 }]}
            >
              <Text style={[hubText.link, { color: "#fff", fontSize: 14 }]}>{tx("დამატება", "Add")}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, gap: 14 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, minHeight: 40, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { width: 96, borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 18, minHeight: 48, textAlign: "center", fontFamily: "NotoSansGeorgian_600SemiBold" },
  primary: { minHeight: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
