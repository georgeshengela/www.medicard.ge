export type FoodItem = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** grams */
  fiber?: number;
  /** grams */
  sugar?: number;
  /** milligrams */
  sodium?: number;
};
export type MealSource =
  | "manual"
  | "photo"
  | "plan"
  | "text"
  | "label"
  | "barcode"
  | "search"
  | "saved"
  | "voice";
export type Meal = {
  id: string;
  date: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  items: FoodItem[];
  note: string;
  title?: string;
  source: MealSource;
  healthScore?: number | null;
};
export type EstimateMode = "photo" | "label" | "text" | "fix";
export type FoodEstimate = {
  foodDetected: boolean;
  dishName?: string;
  items: FoodItem[];
  uncertainty: "low" | "medium" | "high";
  explanation: string;
  mode?: EstimateMode;
  healthScore?: number | null;
};
export type Per100 = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
};
export type SavedFood = {
  id: string;
  name: string;
  brand: string;
  per100: Per100;
  serving: { grams: number; label: string } | null;
  source: string;
  barcode: string | null;
  favorite: boolean;
  useCount?: number;
  lastUsedAt?: string;
  kind?: "saved" | "catalog" | "product" | "usda";
  quality?: "reference" | "estimate" | "label";
  nutriscore?: string | null;
};
export const mealLabels = {
  breakfast: "საუზმე",
  lunch: "სადილი",
  dinner: "ვახშამი",
  snack: "წახემსება",
};
export const sourceLabels: Record<MealSource, string> = {
  manual: "ხელით დამატებული",
  photo: "ფოტოდან შეფასებული",
  plan: "რაციონის მიხედვით",
  text: "აღწერიდან შეფასებული",
  voice: "ხმით ჩაწერილი",
  label: "ეტიკეტიდან",
  barcode: "შტრიხკოდით",
  search: "ბაზიდან",
  saved: "შენახულიდან",
};
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDay(day: string, count: number) {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + count);
  return localDay(d);
}
/** Meal type by local hour, the way a person would file it. */
export function mealTypeForHour(hour: number): Meal["type"] {
  return hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 21 ? "dinner" : "snack";
}
const round1 = (n: number) => Math.round(n * 10) / 10;
export function foodTotals(items: FoodItem[]) {
  const micro = (key: "fiber" | "sugar" | "sodium") => {
    const known = items.filter((i) => Number.isFinite(i[key]));
    return known.length && known.length === items.length
      ? round1(known.reduce((s, i) => s + (i[key] as number), 0))
      : null;
  };
  return {
    calories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
    protein: round1(items.reduce((s, i) => s + i.protein, 0)),
    carbs: round1(items.reduce((s, i) => s + i.carbs, 0)),
    fat: round1(items.reduce((s, i) => s + i.fat, 0)),
    fiber: micro("fiber"),
    sugar: micro("sugar"),
    sodium: micro("sodium"),
  };
}
export function scaleFood(item: FoodItem, grams: number): FoodItem {
  const ratio = grams / item.grams;
  const next: FoodItem = {
    ...item,
    grams,
    calories: round1(item.calories * ratio),
    protein: round1(item.protein * ratio),
    carbs: round1(item.carbs * ratio),
    fat: round1(item.fat * ratio),
  };
  for (const key of ["fiber", "sugar", "sodium"] as const)
    if (Number.isFinite(item[key])) next[key] = round1((item[key] as number) * ratio);
  return next;
}
/** Per-100 g facts → one portion, mirroring the server helper. */
export function portionFromFood(food: SavedFood, grams: number, name = food.name): FoodItem {
  const ratio = grams / 100;
  const item: FoodItem = {
    name: (food.brand ? `${name} · ${food.brand}` : name).slice(0, 120),
    grams: round1(grams),
    calories: round1(food.per100.calories * ratio),
    protein: round1(food.per100.protein * ratio),
    carbs: round1(food.per100.carbs * ratio),
    fat: round1(food.per100.fat * ratio),
  };
  for (const key of ["fiber", "sugar", "sodium"] as const)
    if (Number.isFinite(food.per100[key])) item[key] = round1((food.per100[key] as number) * ratio);
  return item;
}
/**
 * Same deterministic 1–10 meal quality heuristic as the server, so a manual
 * entry shows its score before it is saved. Never a medical judgement.
 */
export function healthScore(items: FoodItem[]): number | null {
  if (!items.length) return null;
  const t = foodTotals(items);
  if (t.calories <= 0) return null;
  const grams = items.reduce((s, i) => s + i.grams, 0) || 1;
  const proteinShare = (t.protein * 4) / t.calories;
  const fatShare = (t.fat * 9) / t.calories;
  const density = t.calories / grams;
  let score = 6;
  score += Math.min(2, proteinShare * 6);
  if (fatShare > 0.45) score -= (fatShare - 0.45) * 5;
  if (density > 2.5) score -= Math.min(2, (density - 2.5) * 1.2);
  else if (density < 1.2) score += 0.5;
  if (t.fiber != null) score += Math.min(1.5, (t.fiber / t.calories) * 400);
  if (t.sugar != null) {
    const sugarShare = (t.sugar * 4) / t.calories;
    if (sugarShare > 0.15) score -= Math.min(2.5, (sugarShare - 0.15) * 10);
  }
  if (t.sodium != null) {
    const perKcal = t.sodium / t.calories;
    if (perKcal > 1.2) score -= Math.min(2, (perKcal - 1.2) * 1.5);
  }
  return Math.max(1, Math.min(10, Math.round(score)));
}
export function healthScoreLabel(score: number | null | undefined) {
  if (score == null) return "";
  return score >= 8 ? "დაბალანსებული" : score >= 5 ? "საშუალო" : "მძიმე კერძი";
}
export function newUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}

/** Compare persisted values, not API metadata or object identity. */
export function mealEditSnapshot(meal: Meal): string {
  return JSON.stringify({
    date: meal.date,
    type: meal.type,
    source: meal.source,
    title: (meal.title || "").trim(),
    note: (meal.note || "").trim(),
    items: meal.items.map(({ name, grams, calories, protein, carbs, fat, fiber, sugar, sodium }) => ({
      name: name.trim(),
      grams,
      calories,
      protein,
      carbs,
      fat,
      fiber: fiber ?? null,
      sugar: sugar ?? null,
      sodium: sodium ?? null,
    })),
  });
}
export type FoodFields = Record<"name" | "grams" | "calories" | "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sodium", string>;
const text = (v: number | undefined) => (Number.isFinite(v) ? String(v) : "");
export function foodFields(item?: FoodItem): FoodFields {
  return item
    ? {
        name: item.name,
        grams: String(item.grams),
        calories: String(item.calories),
        protein: String(item.protein),
        carbs: String(item.carbs),
        fat: String(item.fat),
        fiber: text(item.fiber),
        sugar: text(item.sugar),
        sodium: text(item.sodium),
      }
    : { name: "", grams: "100", calories: "", protein: "", carbs: "", fat: "", fiber: "", sugar: "", sodium: "" };
}
export function foodEditSnapshot(fields: FoodFields): string {
  return JSON.stringify(
    Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const text = value.trim();
        const number = Number(text.replace(",", "."));
        // Empty or incomplete input is not equivalent to a recorded zero.
        return [
          key,
          key !== "name" && text && Number.isFinite(number) ? number : text,
        ];
      }),
  );
}
/** Fields → item; returns null with a message when a required value is missing. */
export function itemFromFields(fields: FoodFields): { item: FoodItem | null; error: string } {
  const number = (key: keyof FoodFields) => Number(fields[key].replace(",", "."));
  const item: FoodItem = {
    name: fields.name.trim(),
    grams: number("grams"),
    calories: number("calories"),
    protein: number("protein"),
    carbs: number("carbs"),
    fat: number("fat"),
  };
  const required: (keyof FoodFields)[] = ["grams", "calories", "protein", "carbs", "fat"];
  const bad = required.some((k) => !fields[k].trim() || !Number.isFinite(number(k)) || number(k) < 0 || number(k) > 10000);
  if (!item.name || item.name.length > 120 || bad || item.grams <= 0)
    return { item: null, error: "შეავსე სახელი და ყველა რიცხვი. უცნობი მონაცემის ნაცვლად ვარაუდი არ შეინახო." };
  for (const key of ["fiber", "sugar", "sodium"] as const) {
    const raw = fields[key].trim();
    if (!raw) continue;
    const value = number(key);
    if (!Number.isFinite(value) || value < 0 || value > 100000) return { item: null, error: "ბოჭკო, შაქარი და ნატრიუმი დადებითი რიცხვები უნდა იყოს." };
    item[key] = value;
  }
  return { item, error: "" };
}
