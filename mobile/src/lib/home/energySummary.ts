/**
 * Pure view-models for the „კვება და წონა“ Home layout: the day's energy budget, today's meals and
 * the next planned meal. No React Native, so node tests load it.
 *
 * Home never computes a calorie target. The number shown is the server's `budget ?? targets.calories`
 * — the same rule as `HomeNutritionCard` and the nutrition hub — and a missing target (no plan, plan
 * to review, or a plan the server withholds for safety) simply means no budget on Home.
 */
import type { MealSummary, NutritionDashboard, NutritionStreak, PlannedMeal } from '../nutritionProgram.ts';

/** `7842` → `7 842` (Hermes has no ka-GE grouping). Negative numbers keep their sign. */
export function groupDigits(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export type EnergyKind = 'budget' | 'noPlan' | 'review';
export type MacroKey = 'protein' | 'carbs' | 'fat';

export type EnergyView = {
  /** budget = a target exists; noPlan = no program; review = a program without a target today. */
  kind: EnergyKind;
  logged: boolean;
  mealCount: number;
  eaten: number;
  /** `budget ?? targets.calories`, null without a target. */
  target: number | null;
  /** Server `remaining` (target − eaten); negative = over. Null without a target. */
  remaining: number | null;
  over: boolean;
  /** Ring fill 0…1; 0 without a target (the ring is then neutral, never "full"). */
  progress: number;
  /** Ring centre; null = nothing to count (the empty state is shown instead). */
  centre: { value: number; unit: 'left' | 'over' | 'kcal' } | null;
  macros: { key: MacroKey; value: number; target: number | null; ratio: number }[];
  /** „სამიზნე … + დამწვარი … + გუშინდელი … = …“, only when the budget differs from the plan target. */
  breakdown: { target: number; burned: number; rollover: number; budget: number } | null;
  /** The program exists but the server asks for a review. Its reasons are never shown on Home. */
  needsReview: boolean;
  /** The empty state (art + one goal CTA) instead of the ring. */
  empty: boolean;
};

const finite = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function energyView(d: NutritionDashboard): EnergyView {
  const eaten = finite(d.today?.calories);
  const mealCount = finite(d.mealCount);
  const logged = mealCount > 0;
  const target = d.budget ?? d.targets?.calories ?? null;
  const remaining = target != null ? (d.remaining ?? target - eaten) : null;
  const over = remaining != null && remaining < 0;
  const kind: EnergyKind = target != null ? 'budget' : d.program ? 'review' : 'noPlan';
  const progress = target ? clamp01(eaten / target) : 0;
  const centre =
    target != null && remaining != null
      ? { value: Math.abs(remaining), unit: over ? ('over' as const) : ('left' as const) }
      : logged
        ? { value: eaten, unit: 'kcal' as const }
        : null;
  const macroTarget = (key: MacroKey) => {
    const t = d.targets?.[key];
    return typeof t === 'number' && t > 0 ? t : null;
  };
  const macros = (['protein', 'carbs', 'fat'] as const).map((key) => {
    const value = finite(d.today?.[key]);
    const t = macroTarget(key);
    return { key, value, target: t, ratio: t ? clamp01(value / t) : 0 };
  });
  const burned = finite(d.burned?.counted);
  const rollover = finite(d.rollover);
  const breakdown =
    d.targets && d.budget != null && (burned > 0 || rollover > 0)
      ? { target: d.targets.calories, burned, rollover, budget: d.budget }
      : null;
  return {
    kind,
    logged,
    mealCount,
    eaten,
    target,
    remaining,
    over,
    progress,
    centre,
    macros,
    breakdown,
    needsReview: Boolean(d.program && d.needsReview),
    empty: kind !== 'budget' && !logged,
  };
}

/** Up to `max` of today's meals (the most recent ones, in the order they were eaten) and how many more. */
export function recentMeals(meals: readonly MealSummary[] | null | undefined, max = 3): { shown: MealSummary[]; more: number } {
  const all = Array.isArray(meals) ? meals : [];
  const shown = all.length > max ? all.slice(all.length - max) : [...all];
  return { shown, more: all.length - shown.length };
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = (typeof MEAL_ORDER)[number];

/** Same hours as `mealTypeForHour` in `src/lib/nutrition.ts` (kept local so node tests need no api import). */
export function mealTypeAt(hour: number): MealType {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack';
}

/**
 * The one planned meal worth showing on Home: not eaten yet, for the current meal slot or a later one,
 * and not a slot the person already logged something for (they ate something else — no nagging).
 */
export function nextPlannedMeal(
  planned: readonly PlannedMeal[] | null | undefined,
  loggedToday: readonly Pick<MealSummary, 'type'>[] | null | undefined,
  hour: number,
): PlannedMeal | null {
  if (!Array.isArray(planned) || !planned.length) return null;
  const now = MEAL_ORDER.indexOf(mealTypeAt(hour));
  const loggedTypes = new Set((loggedToday ?? []).map((m) => m.type));
  const candidates = planned
    .filter((p) => !p.eaten && p.data && MEAL_ORDER.includes(p.type as MealType))
    .filter((p) => MEAL_ORDER.indexOf(p.type as MealType) >= now && !loggedTypes.has(p.type))
    .sort((a, b) => MEAL_ORDER.indexOf(a.type as MealType) - MEAL_ORDER.indexOf(b.type as MealType));
  return candidates[0] ?? null;
}

/** Meal-logging streak footer; `best` only when it is above the current run. Null = no footer. */
export function streakFooter(streak: NutritionStreak | null | undefined): { current: number; best: number | null } | null {
  const current = finite(streak?.current);
  if (current <= 0) return null;
  const best = finite(streak?.best);
  return { current, best: best > current ? best : null };
}
