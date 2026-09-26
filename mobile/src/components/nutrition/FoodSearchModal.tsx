import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, BookmarkCheck, ChevronRight, Clock3, Copy, Search, Trash2, X } from "lucide-react-native";
import { APP_MODAL_PROPS } from "@/components/ui/appModal";
import { api } from "@/lib/api";
import { foodTotals, mealLabels, type FoodItem, type Meal, type SavedFood } from "@/lib/nutrition";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import { useThemeColors } from "@/theme/colors";
import { hubText } from "@/theme/hub";
import { PortionSheet } from "./PortionSheet";

type Tab = "search" | "recent" | "saved";
export type FoodPick = { items: FoodItem[]; source: "search" | "saved"; foodIds: string[]; title?: string };

/**
 * Search the person's foods, the Georgian catalog and open product databases;
 * reuse recent meals in one tap; manage favourites. Everything is per account.
 */
export function FoodSearchModal({
  visible,
  initialTab = "search",
  onClose,
  onPick,
}: {
  visible: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onPick: (pick: FoodPick) => void;
}) {
  const c = useThemeColors();
  const safe = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ saved: SavedFood[]; catalog: SavedFood[]; products: SavedFood[] } | null>(null);
  const [recent, setRecent] = useState<{ foods: SavedFood[]; meals: Meal[] } | null>(null);
  const [saved, setSaved] = useState<SavedFood[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [portion, setPortion] = useState<SavedFood | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const seq = useRef(0);
  const input = useRef<TextInput>(null);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      setError("");
      if (initialTab === "search") setTimeout(() => input.current?.focus(), 250);
    } else {
      setQuery("");
      setResults(null);
      setPortion(null);
    }
  }, [visible, initialTab]);
  const loadTab = useCallback(async (which: Tab) => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    try {
      if (which === "recent") {
        const data = await api.nutrition.foods.recent();
        if (n === seq.current) setRecent(data);
      } else if (which === "saved") {
        const data = await api.nutrition.foods.list();
        if (n === seq.current) setSaved(data.foods);
      }
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (visible && tab !== "search") void loadTab(tab);
  }, [visible, tab, loadTab]);
  useEffect(() => {
    if (!visible || tab !== "search") return;
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.nutrition.foods.search(q);
        if (n === seq.current) setResults(data);
      } catch (e) {
        if (n === seq.current) setError((e as Error).message);
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, visible, tab]);
  const toggleFavorite = async (food: SavedFood) => {
    try {
      if (food.kind && food.kind !== "saved") {
        const created = await api.nutrition.foods.save({ ...food, id: newId(), favorite: true, source: food.kind === "catalog" ? "catalog" : "barcode", barcode: food.barcode || null, kind: "saved" });
        setPortion((current) => (current && current.name === food.name ? { ...created.food, kind: "saved" } : current));
        setSaved((list) => (list ? [created.food, ...list] : list));
      } else {
        await api.nutrition.foods.favorite(food.id, !food.favorite);
        const update = (f: SavedFood) => (f.id === food.id ? { ...f, favorite: !food.favorite } : f);
        setSaved((list) => list?.map(update) || list);
        setRecent((r) => (r ? { ...r, foods: r.foods.map(update) } : r));
        setResults((r) => (r ? { ...r, saved: r.saved.map(update) } : r));
        setPortion((current) => (current && current.id === food.id ? { ...current, favorite: !food.favorite } : current));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const removeSaved = async (food: SavedFood) => {
    try {
      await api.nutrition.foods.remove(food.id);
      setSaved((list) => list?.filter((f) => f.id !== food.id) || list);
      setRecent((r) => (r ? { ...r, foods: r.foods.filter((f) => f.id !== food.id) } : r));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const txt = { color: c.text100, fontFamily: "NotoSansGeorgian_400Regular" };
  const foodRow = (food: SavedFood, index: number, showDelete = false) => (
    <Pressable
      key={(food.id || food.barcode || food.name) + index}
      accessibilityRole="button"
      accessibilityLabel={`${food.name} · პორციის არჩევა`}
      onPress={() => setPortion(food)}
      style={[s.row, { backgroundColor: c.surface }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 15 }]}>{food.name}</Text>
        <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
          {Math.round(food.per100.calories)} კკალ / 100 გ · ც {food.per100.protein} · ნ {food.per100.carbs} · ცხ {food.per100.fat}
          {food.brand ? ` · ${food.brand}` : ""}
          {food.kind === "catalog" && food.quality === "estimate" ? " · შეფასება" : ""}
          {food.source === "recipe" ? ` · რეცეპტი, ${Math.round((food.per100.calories * (food.serving?.grams || 100)) / 100)} კკალ/პორცია` : ""}
        </Text>
      </View>
      {food.favorite ? <BookmarkCheck size={18} color={c.primary100} /> : null}
      {showDelete ? (
        <Pressable accessibilityRole="button" accessibilityLabel="შენახულის წაშლა" onPress={() => void removeSaved(food)} style={s.iconButton}>
          <Trash2 size={18} color={c.text200} />
        </Pressable>
      ) : (
        <ChevronRight size={18} color={c.text300} />
      )}
    </Pressable>
  );
  const mealRow = (meal: Meal) => {
    const t = foodTotals(meal.items);
    return (
      <Pressable
        key={meal.id}
        accessibilityRole="button"
        accessibilityLabel="ამ კვების გამეორება"
        onPress={() => onPick({ items: meal.items.map((i) => ({ ...i })), source: "saved", foodIds: [], title: meal.title })}
        style={[s.row, { backgroundColor: c.surface }]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 15 }]}>{meal.title || meal.items.map((i) => i.name).join(" · ")}</Text>
          <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
            {nutritionDateLabel(meal.date)} · {mealLabels[meal.type]} · {t.calories} კკალ · {meal.items.length} საკვები
          </Text>
        </View>
        <Copy size={18} color={c.primary100} />
      </Pressable>
    );
  };
  const section = (title: string, children: React.ReactNode) => (
    <View style={{ gap: 8 }}>
      <Text style={[hubText.small, { color: c.text300, textTransform: "uppercase", letterSpacing: 0.6 }]}>{title}</Text>
      {children}
    </View>
  );
  const empty = (message: string) => <Text style={[txt, { color: c.text200, textAlign: "center", paddingVertical: 24, lineHeight: 22 }]}>{message}</Text>;
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: c.bg100, paddingTop: safe.top }}>
        <View style={s.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={onClose} style={s.iconButton}>
            <X size={22} color={c.text100} />
          </Pressable>
          <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18, flex: 1 }]}>საკვების არჩევა</Text>
        </View>
        <View style={s.tabs}>
          {(
            [
              ["search", "ძებნა", Search],
              ["recent", "ბოლო", Clock3],
              ["saved", "შენახული", Bookmark],
            ] as const
          ).map(([key, label, Icon]) => (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={[s.tab, { backgroundColor: tab === key ? c.accent100 : c.bg200 }]}>
              <Icon size={15} color={tab === key ? c.primary100 : c.text200} />
              <Text style={[hubText.link, { color: tab === key ? c.primary100 : c.text200 }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {tab === "search" && (
          <View style={s.searchRow}>
            <Search size={18} color={c.text300} />
            <TextInput
              ref={input}
              accessibilityLabel="საკვების ძებნა"
              placeholder="ხაჭაპური, მაწონი, banana…"
              placeholderTextColor={c.text300}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              style={[s.input, { color: c.text100 }]}
            />
            {!!query && (
              <Pressable accessibilityRole="button" accessibilityLabel="გასუფთავება" onPress={() => setQuery("")} style={s.iconButton}>
                <X size={18} color={c.text300} />
              </Pressable>
            )}
          </View>
        )}
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 18, paddingBottom: keyboard ? 12 : Math.max(safe.bottom, 20) }}>
          {!!error && <Text accessibilityRole="alert" style={[txt, { color: c.danger }]}>{error}</Text>}
          {loading && <ActivityIndicator color={c.primary200} />}
          {tab === "search" && !results && !loading && empty(query.trim().length < 2 ? "დაწერე მინიმუმ ორი ასო. ქართული კერძები, ბრენდები და შენი შენახული საკვები ერთ სიაშია." : "")}
          {tab === "search" && results && (
            <>
              {results.saved.length > 0 && section("შენი შენახული", results.saved.map((f, i) => foodRow(f, i)))}
              {results.catalog.length > 0 && section("ქართული და საერთაშორისო კერძები", results.catalog.map((f, i) => foodRow(f, i)))}
              {results.products.length > 0 && section("პროდუქტები · Open Food Facts / USDA", results.products.map((f, i) => foodRow(f, i)))}
              {!loading && !results.saved.length && !results.catalog.length && !results.products.length && empty("ვერ ვიპოვე. სცადე სხვა სახელი, გადაიღე ეტიკეტი ან შეიყვანე ხელით — შემდეგ ჯერზე შენახულებში იქნება.")}
            </>
          )}
          {tab === "recent" && recent && (
            <>
              {recent.meals.length > 0 && section("ბოლო კვებები · ერთი შეხებით გამეორება", recent.meals.map(mealRow))}
              {recent.foods.length > 0 && section("ბოლოს გამოყენებული საკვები", recent.foods.map((f, i) => foodRow(f, i)))}
              {!recent.meals.length && !recent.foods.length && !loading && empty("ჯერ ჩანაწერები არ გაქვს. პირველი კვების შემდეგ აქ გამეორება ერთი შეხებით იქნება.")}
            </>
          )}
          {tab === "saved" && saved && (
            <>
              {saved.length > 0 && section("რჩეული და საკუთარი საკვები", saved.map((f, i) => foodRow(f, i, true)))}
              {!saved.length && !loading && empty("შენახული საკვები ჯერ არ არის. შედეგის ეკრანზე „შენახვა“ ან ძებნაში სანიშნე — და აქ გამოჩნდება.")}
            </>
          )}
        </ScrollView>
        <PortionSheet
          food={portion}
          onClose={() => setPortion(null)}
          onToggleFavorite={(food) => void toggleFavorite(food)}
          onAdd={(item, food) => {
            setPortion(null);
            onPick({ items: [item], source: food.kind === "saved" || !food.kind ? "saved" : "search", foodIds: food.kind === "saved" || !food.kind ? [food.id] : [] });
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
function newId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  tab: { flex: 1, minHeight: 42, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, paddingLeft: 14, borderRadius: 16, backgroundColor: "rgba(20,184,166,0.08)", minHeight: 50 },
  input: { flex: 1, fontSize: 16, minHeight: 48, fontFamily: "NotoSansGeorgian_400Regular" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 18, minHeight: 64 },
});
