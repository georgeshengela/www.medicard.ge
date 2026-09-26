import Constants from "expo-constants";
import { Platform } from "react-native";
import { getPreference, setPreference } from "@/lib/storage";
import { localAccountId } from "@/lib/localAccount";
import { mealHealthTime, type HealthConnectResult, type HealthMeal } from "@/lib/healthSync.shared";
import { foodTotals, localDay, shiftDay, type Meal } from "@/lib/nutrition";

/**
 * Optional write-back of confirmed diary meals to Apple Health / Health
 * Connect. Off by default, per account and per device (each phone has its own
 * health store). Health writes never block or fail a diary save.
 */
const key = (owner: string) => `medicard.nutrition.healthWrite.v1.${owner}`;

async function impl() {
  if (Constants.appOwnership === "expo") return null;
  if (Platform.OS === "ios") return import("@/lib/healthSyncPlatform.ios");
  if (Platform.OS === "android") return import("@/lib/healthSyncPlatform.android");
  return null;
}
export function nutritionHealthName() {
  return Platform.OS === "ios" ? "Apple Health" : Platform.OS === "android" ? "Health Connect" : null;
}
export async function isNutritionHealthWriteEnabled(owner = localAccountId()) {
  if (!owner || !nutritionHealthName()) return false;
  return (await getPreference(key(owner))) === "1";
}
/** Must be called from a button press: it shows the system permission sheet. */
export async function enableNutritionHealthWrite(owner = localAccountId()): Promise<HealthConnectResult> {
  if (!owner) return { ok: false, reason: "error" };
  if (Constants.appOwnership === "expo") return { ok: false, reason: "expo_go" };
  const native = await impl();
  if (!native) return { ok: false, reason: "unavailable" };
  const result = await native.connectNutritionWriteNative();
  if (result.ok && localAccountId() === owner) await setPreference(key(owner), "1");
  return result;
}
export async function disableNutritionHealthWrite(owner = localAccountId()) {
  if (owner) await setPreference(key(owner), "0");
}
export function toHealthMeal(meal: Meal): HealthMeal {
  const t = foodTotals(meal.items);
  return {
    id: meal.id,
    at: mealHealthTime(meal.date, meal.type).toISOString(),
    type: meal.type,
    name: meal.title || meal.items.map((i) => i.name).join(", "),
    calories: t.calories,
    protein: t.protein,
    carbs: t.carbs,
    fat: t.fat,
    fiber: t.fiber,
    sugar: t.sugar,
    sodium: t.sodium,
  };
}
export async function syncMealsToHealth(meals: Meal[]) {
  const owner = localAccountId();
  if (!meals.length || !(await isNutritionHealthWriteEnabled(owner))) return 0;
  const native = await impl();
  if (!native) return 0;
  let written = 0;
  for (const meal of meals) {
    if (localAccountId() !== owner) break;
    try {
      await native.writeMealNative(toHealthMeal(meal));
      written++;
    } catch {
      // Best-effort only; the diary is the source of truth.
    }
  }
  return written;
}
export async function removeMealFromHealth(mealId: string) {
  if (!(await isNutritionHealthWriteEnabled())) return;
  const native = await impl();
  await native?.deleteMealNative(mealId).catch(() => undefined);
}
/** After enabling: write the last week so Health is not empty until the next meal. */
export async function backfillNutritionToHealth(days = 7) {
  const { api } = await import("@/lib/api");
  const to = localDay();
  const { meals } = await api.nutrition.range(shiftDay(to, -(days - 1)), to);
  return syncMealsToHealth(meals);
}
