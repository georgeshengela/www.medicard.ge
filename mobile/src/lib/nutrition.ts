export type FoodItem = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type Meal = {
  id: string;
  date: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  items: FoodItem[];
  note: string;
  source: "manual" | "photo" | "plan";
};
export type FoodEstimate = {
  foodDetected: boolean;
  items: FoodItem[];
  uncertainty: "low" | "medium" | "high";
  explanation: string;
};
export const mealLabels = {
  breakfast: "საუზმე",
  lunch: "სადილი",
  dinner: "ვახშამი",
  snack: "წახემსება",
};
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDay(day: string, count: number) {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + count);
  return localDay(d);
}
export function foodTotals(items: FoodItem[]) {
  return {
    calories: Math.round(items.reduce((s, i) => s + i.calories, 0)),
    protein: Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10,
    carbs: Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10,
    fat: Math.round(items.reduce((s, i) => s + i.fat, 0) * 10) / 10,
  };
}
export function scaleFood(item: FoodItem, grams: number): FoodItem {
  const ratio = grams / item.grams;
  return {
    ...item,
    grams,
    calories: Math.round(item.calories * ratio * 10) / 10,
    protein: Math.round(item.protein * ratio * 10) / 10,
    carbs: Math.round(item.carbs * ratio * 10) / 10,
    fat: Math.round(item.fat * ratio * 10) / 10,
  };
}
