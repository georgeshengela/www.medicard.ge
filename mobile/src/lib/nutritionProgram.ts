import { nutritionProgramRequest as request } from "./api";
import { isEn, tx } from "../i18n/locale.js";
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
  /** Present when the person chose their own macro split (energy shares, %). */
  split?: MacroShares;
};
export type MacroShares = { protein: number; carbs: number; fat: number };
export type MacroPreference = MacroShares & { mode: "auto" | "custom" };
export const MACRO_PRESETS: { key: string; label: string; detail: string; shares: MacroShares }[] = [
  { key: "balanced", label: tx("ბალანსი", "Balanced"), detail: tx("გეგმის ნაგულისხმევი", "Plan default"), shares: { protein: 20, carbs: 50, fat: 30 } },
  { key: "highProtein", label: tx("მეტი ცილა", "More protein"), detail: tx("ძალოვანი ვარჯიში, გაჯერება", "Strength training, fullness"), shares: { protein: 30, carbs: 40, fat: 30 } },
  { key: "lowerCarb", label: tx("ნაკლები ნახშირწყალი", "Fewer carbs"), detail: tx("ზომიერად დაბალი", "Moderately low"), shares: { protein: 30, carbs: 25, fat: 45 } },
  { key: "endurance", label: tx("გამძლეობა", "Endurance"), detail: tx("სირბილი, ველოსიპედი", "Running, cycling"), shares: { protein: 20, carbs: 55, fat: 25 } },
];
export const MACRO_BOUNDS: Record<keyof MacroShares, [number, number]> = { protein: [10, 40], carbs: [15, 65], fat: [15, 50] };
/** Grams for a calorie target and a split: 4 kcal per gram of protein and carbs, 9 for fat. */
export function macroGrams(calories: number, shares: MacroShares): MacroShares {
  return {
    protein: Math.round((calories * shares.protein) / 100 / 4),
    carbs: Math.round((calories * shares.carbs) / 100 / 4),
    fat: Math.round((calories * shares.fat) / 100 / 9),
  };
}
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
export type NutritionActivity = {
  id: string;
  date: string;
  kind: string;
  minutes: number;
  kcal: number;
  note: string;
  source: "manual" | "steps";
};
export type NutritionPreferences = {
  rollover: boolean;
  addBurned: boolean;
  countSteps: boolean;
  reminders: { enabled: boolean; breakfast: string; lunch: string; dinner: string };
  macros: MacroPreference;
};
export const defaultNutritionPreferences = (): NutritionPreferences => ({
  rollover: false,
  addBurned: false,
  countSteps: true,
  reminders: { enabled: false, breakfast: "08:30", lunch: "13:30", dinner: "19:30" },
  macros: { mode: "auto", protein: 20, carbs: 50, fat: 30 },
});
export type BodyMeasurement = {
  date: string;
  waistCm: number | null;
  hipsCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
};
export type NutritionStreak = {
  current: number;
  best: number;
  loggedToday: boolean;
  nextMilestone: number | null;
  reached: number[];
};
export type WeightProjection = {
  current: number | null;
  target: number | null;
  trendKgPerWeek: number | null;
  trendEta: string | null;
  planEta: string | null;
  direction: "down" | "up" | "reached" | null;
  remainingKg: number | null;
};
export type NutritionWeekSummary = {
  recordedDays: number;
  targetDays: number;
  onTargetDays: number;
  averageCalories: number | null;
  balanceCalories: number | null;
  averageProtein: number | null;
};
export type MealSummary = {
  id: string;
  date: string;
  type: Meal["type"];
  title: string;
  source: Meal["source"];
  names: string[];
  totals: NutritionTotals;
};
export type NutritionDashboard = {
  program: NutritionProgram | null;
  targets: NutritionTargets | null;
  needsReview: boolean;
  mealPlanning?: MealPlanningAvailability;
  reasons: string[];
  date: string;
  today: NutritionTotals & { fiber?: number | null; sugar?: number | null; sodium?: number | null };
  remaining: number | null;
  budget: number | null;
  rollover: number;
  burned: { activities: number; steps: number; total: number; counted: number };
  week: NutritionWeekSummary;
  mealCount: number;
  todayMeals: MealSummary[];
  activities: NutritionActivity[];
  steps: number;
  water: { ml: number; goalMl: number | null };
  streak: NutritionStreak;
  projection: WeightProjection;
  preferences: NutritionPreferences;
  /** Optional: older servers do not send it. */
  fasting?: { active: import("./fasting").Fast | null };
  measurements: BodyMeasurement[];
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
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Explicit Georgian labels also work on runtimes without ka-GE Intl data.
export function nutritionDateLabel(date: string, weekday = false) {
  const d = new Date(date + "T12:00:00");
  if (weekday)
    return (isEn() ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"])[d.getDay()];
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
  if (isEn()) return `${d.getDate()} ${EN_MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
export const allergenLabels: Record<string, string> = {
  milk: tx("რძე", "Milk"),
  eggs: tx("კვერცხი", "Eggs"),
  fish: tx("თევზი", "Fish"),
  shellfish: tx("კიბოსნაირები", "Crustaceans"),
  nuts: tx("თხილეული", "Tree nuts"),
  peanuts: tx("მიწის თხილი", "Peanuts"),
  soy: tx("სოია", "Soy"),
  gluten: tx("გლუტენი", "Gluten"),
  sesame: tx("სეზამი", "Sesame"),
  celery: tx("ნიახური", "Celery"),
  mustard: tx("მდოგვი", "Mustard"),
  sulphites: tx("სულფიტები", "Sulphites"),
  lupin: tx("ლუპინი", "Lupin"),
  molluscs: tx("მოლუსკები", "Molluscs"),
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
