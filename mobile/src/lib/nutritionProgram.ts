import { nutritionProgramRequest as request } from "./api";
import type { FoodItem, Meal } from "./nutrition";
import type { WeightGoal, WeightLog } from "@/types/weightGoal";
export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
export type NutritionTargets = NutritionTotals & {
  maintenance: number;
  adjustment: number;
  method: string;
};
export type ProgramConfig = {
  mode: "lose" | "maintain" | "gain";
  weightKg: number;
  heightCm: number;
  birthDate: string;
  sex: "female" | "male";
  targetKg: number;
  activity: "sedentary" | "light" | "moderate" | "active";
  pace: "gentle" | "steady";
  diet: "balanced" | "vegetarian" | "vegan";
  allergens: string[];
  avoidFoods: string;
  allergyClarifications?: AllergyClarification[];
  screening: {
    pregnancyOrBreastfeeding: boolean;
    eatingDisorder: boolean;
    medicalDiet: boolean;
  };
};
export type AllergyClarification = {
  label: string;
  kind: "non_food" | "food" | "unsure";
  allergens: string[];
};
export type MealPlanningAvailability = {
  eligible: boolean;
  reasons: string[];
  unresolvedAllergies: string[];
};
export type NutritionProgram = {
  revision: string;
  active: boolean;
  config: ProgramConfig;
  targets: NutritionTargets;
  startedOn: string;
};
export type PlannedMeal = {
  id: string;
  date: string;
  type: Meal["type"];
  recipeId: string;
  programRevision: string;
  eaten: boolean;
  data: {
    title: string;
    items: FoodItem[];
    instructions: string;
    minutes: number;
    allergens: string[];
    source: string;
    totals: NutritionTotals;
  };
};
export type Recipe = PlannedMeal["data"] & { id: string };
export type NutritionDay = {
  date: string;
  recorded: boolean;
  mealCount: number;
  totals: NutritionTotals;
  target: NutritionTargets | null;
};
export type NutritionDashboard = {
  program: NutritionProgram | null;
  targets: NutritionTargets | null;
  needsReview: boolean;
  mealPlanning?: MealPlanningAvailability;
  reasons: string[];
  date: string;
  today: NutritionTotals;
  remaining: number | null;
  mealCount: number;
  days: NutritionDay[];
  planned: PlannedMeal[];
  facts: {
    requiredAllergens: string[];
    unknownAllergies: boolean;
    unclassifiedAllergies?: string[];
    birthDate: string | null;
    sex: "female" | "male" | null;
    heightCm: number | null;
    current: { kg: number; date: string | null; source: string } | null;
    weightGoal: WeightGoal | null;
    weightHistory: { date: string; weightKg: number }[];
    activity: ProgramConfig["activity"] | null;
    diet: ProgramConfig["diet"];
    professionalReviewNeeded: boolean;
  };
};
export type NutritionWeek = {
  from: string;
  to: string;
  meals: PlannedMeal[];
  shopping: { name: string; grams: number }[];
};
export type NutritionPreview = {
  eligible: boolean;
  reasons: string[];
  targets: NutritionTargets | null;
  explanation: string;
  mealPlanning?: MealPlanningAvailability;
};
// Explicit Georgian labels also work on runtimes without ka-GE Intl data.
export function nutritionDateLabel(date: string, weekday = false) {
  const d = new Date(date + "T12:00:00");
  if (weekday)
    return ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"][d.getDay()];
  const months = [
    "იანვარი",
    "თებერვალი",
    "მარტი",
    "აპრილი",
    "მაისი",
    "ივნისი",
    "ივლისი",
    "აგვისტო",
    "სექტემბერი",
    "ოქტომბერი",
    "ნოემბერი",
    "დეკემბერი",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
export const allergenLabels: Record<string, string> = {
  milk: "რძე",
  eggs: "კვერცხი",
  fish: "თევზი",
  shellfish: "კიბოსნაირები",
  nuts: "თხილეული",
  peanuts: "მიწის თხილი",
  soy: "სოია",
  gluten: "გლუტენი",
  sesame: "სეზამი",
  celery: "ნიახური",
  mustard: "მდოგვი",
  sulphites: "სულფიტები",
  lupin: "ლუპინი",
  molluscs: "მოლუსკები",
};
export const nutritionProgramApi = {
  dashboard: () => request<NutritionDashboard>("/program/dashboard"),
  preview: (config: ProgramConfig) =>
    request<NutritionPreview>("/program/preview", "POST", config),
  save: (config: ProgramConfig, expectedRevision: string | null) =>
    request<{
      program: NutritionProgram;
      goal: WeightGoal;
      weightLog: WeightLog;
    }>("/program", "PUT", { config, expectedRevision }),
  pause: (expectedRevision: string) =>
    request("/program/pause", "POST", { expectedRevision }),
  week: (from: string) =>
    request<NutritionWeek>("/plan?from=" + encodeURIComponent(from)),
  generate: (from: string, expectedRevision: string, variant = 0) =>
    request<NutritionWeek>("/plan/generate", "POST", {
      from,
      expectedRevision,
      variant,
    }),
  eat: (id: string) =>
    request("/plan/" + encodeURIComponent(id) + "/eat", "POST", {}),
  swap: (id: string, recipeId: string) =>
    request("/plan/" + encodeURIComponent(id) + "/swap", "PUT", { recipeId }),
  recipes: (type: Meal["type"]) =>
    request<{ recipes: Recipe[] }>("/recipes?type=" + type),
};

/** Apply the acknowledged canonical result without resubmitting a stale local goal. */
export async function applyNutritionSavedState(
  owner: string,
  saved: { goal: WeightGoal; weightLog: WeightLog },
) {
  const { localAccountId } = await import("./localAccount");
  const { getPreference, setPreference } = await import("./storage");
  if (localAccountId() !== owner) return;
  const key = `medicard.weight.logs.v1.${owner}`;
  const raw = await getPreference(key);
  let logs: WeightLog[] = [];
  try {
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) logs = parsed;
  } catch {}
  if (localAccountId() !== owner) return;
  const newer = logs.some(
    (v) => v.date === saved.weightLog.date && v.at > saved.weightLog.at,
  );
  await Promise.all([
    setPreference(
      `medicard.weight.goal.v1.${owner}`,
      JSON.stringify(saved.goal),
    ),
    setPreference(
      key,
      JSON.stringify(
        newer
          ? logs
          : [
              saved.weightLog,
              ...logs.filter((v) => v.date !== saved.weightLog.date),
            ],
      ),
    ),
  ]);
  const { resetHealthPullCache, requestHealthRefresh } =
    await import("./healthDataSync");
  if (localAccountId() === owner) {
    resetHealthPullCache();
    requestHealthRefresh();
  }
}
