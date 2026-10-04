import React, { useEffect, useState } from "react";
import { useMedifood } from "./ProgramUI";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Copy } from "lucide-react-native";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from "@/components/ui/appModal";
import { foodTotals, localDay, mealLabels, shiftDay, type Meal } from "@/lib/nutrition";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { hubText, hubTint } from "@/theme/hub";
import { tx } from '@/i18n/locale';

/**
 * Copy one meal or a whole day to another date (never the future). A single
 * meal can also change its meal type; a day keeps each meal's own type.
 */
export function CopyMealsSheet({
  meals,
  busy,
  error,
  onClose,
  onCopy,
}: {
  meals: Meal[] | null;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCopy: (date: string, type?: Meal["type"]) => void;
}) {
  const c = useThemeColors(),
    dark = useIsDark(),
    safe = useSafeAreaInsets();
  const M = useMedifood();
  const today = localDay();
  const source = meals?.[0]?.date || today;
  const [date, setDate] = useState(today);
  const [type, setType] = useState<Meal["type"] | null>(null);
  useEffect(() => {
    if (meals) {
      setDate(today);
      setType(null);
    }
  }, [meals, today]);
  if (!meals?.length) return null;
  const single = meals.length === 1;
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today, -i));
  const t = foodTotals(meals.flatMap((m) => m.items));
  const teal = M.ink;
  const chip = (selected: boolean) => [s.chip, { backgroundColor: selected ? hubTint(teal, dark) : c.bg200, borderColor: selected ? teal : "transparent" }];
  return (
    <Modal visible {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={tx("დახურვა", "Close")} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(safe.bottom, 16) + 8 }]}>
          <View style={s.row}>
            <Copy size={19} color={teal} />
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17, flex: 1 }]}>{single ? tx("კვების კოპირება", "Copy meal") : tx("მთელი დღის კოპირება", "Copy whole day")}</Text>
          </View>
          <Text numberOfLines={2} style={[hubText.body, { color: c.text200 }]}>
            {single ? meals[0].title || meals[0].items.map((i) => i.name).join(", ") : tx(`${nutritionDateLabel(source)} · ${meals.length} კვება`, `${nutritionDateLabel(source)} · ${meals.length} ${meals.length === 1 ? "meal" : "meals"}`)} · {t.calories} {tx("კკალ", "kcal")}
          </Text>
          <Text style={[hubText.small, { color: c.text300 }]}>{tx("რომელ დღეს?", "Which day?")}</Text>
          <View style={s.wrap}>
            {days.map((d, i) => (
              <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: date === d }} onPress={() => setDate(d)} style={chip(date === d)}>
                <Text style={[hubText.link, { color: date === d ? teal : c.text100 }]}>{i === 0 ? tx("დღეს", "Today") : i === 1 ? tx("გუშინ", "Yesterday") : nutritionDateLabel(d)}</Text>
              </Pressable>
            ))}
          </View>
          {single && (
            <>
              <Text style={[hubText.small, { color: c.text300 }]}>{tx("კვების ტიპი", "Meal type")}</Text>
              <View style={s.wrap}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: type === null }} onPress={() => setType(null)} style={chip(type === null)}>
                  <Text style={[hubText.link, { color: type === null ? teal : c.text100 }]}>{tx("იგივე", "Same")} ({mealLabels[meals[0].type]})</Text>
                </Pressable>
                {(Object.keys(mealLabels) as Meal["type"][])
                  .filter((k) => k !== meals[0].type)
                  .map((k) => (
                    <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: type === k }} onPress={() => setType(k)} style={chip(type === k)}>
                      <Text style={[hubText.link, { color: type === k ? teal : c.text100 }]}>{mealLabels[k]}</Text>
                    </Pressable>
                  ))}
              </View>
            </>
          )}
          {!!error && <Text accessibilityRole="alert" style={[hubText.body, { color: c.danger }]}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => onCopy(date, type || undefined)} style={[s.primary, { opacity: busy ? 0.6 : 1, backgroundColor: M.ink }]}>
            {busy ? <ActivityIndicator color={M.onInk} /> : <Text style={[hubText.link, { color: M.onInk, fontSize: 15 }]}>{date === today ? tx("დღევანდელში დამატება", "Add to today") : tx(`${nutritionDateLabel(date)}-ში დამატება`, `Add to ${nutritionDateLabel(date)}`)}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={[s.secondary, { backgroundColor: c.bg200 }]}>
            <Text style={[hubText.link, { color: c.text100 }]}>{tx("გაუქმება", "Cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  primary: { minHeight: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 4 },
  secondary: { minHeight: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
