import { z } from "zod";
import { civilDate, totals } from "./nutrition.js";
import { shiftCivil } from "./nutritionProgram.js";

export const MILESTONES = [3, 7, 14, 30, 60, 100, 365];
/**
 * Consecutive days with at least one saved meal, ending today or yesterday.
 * A day without a log so far today does not break yesterday's run.
 */
export function computeStreak(dates, today) {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : shiftCivil(today, -1);
  let current = 0;
  while (set.has(cursor) && current < 3660) {
    current++;
    cursor = shiftCivil(cursor, -1);
  }
  const sorted = [...set].sort();
  let best = 0, run = 0, previous = null;
  for (const d of sorted) {
    run = previous && shiftCivil(previous, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    previous = d;
  }
  const next = MILESTONES.find((m) => m > current) || null;
  return {
    current,
    best: Math.max(best, current),
    loggedToday: set.has(today),
    nextMilestone: next,
    reached: MILESTONES.filter((m) => m <= Math.max(best, current)),
  };
}
export const ACTIVITY_KINDS = {
  walk: { met: 3.5, label: "სიარული" },
  run: { met: 9.8, label: "სირბილი" },
  cycle: { met: 7.5, label: "ველოსიპედი" },
  strength: { met: 5, label: "ძალოვანი ვარჯიში" },
  swim: { met: 7, label: "ცურვა" },
  yoga: { met: 2.5, label: "იოგა / სტრეჩინგი" },
  hiit: { met: 8, label: "HIIT" },
  sport: { met: 7, label: "სპორტული თამაში" },
  dance: { met: 5.5, label: "ცეკვა" },
  other: { met: 4, label: "სხვა აქტივობა" },
};
/** MET estimate: kcal = MET × 3.5 × kg / 200 × minutes. A guide, not a measurement. */
export function activityKcal(kind, minutes, weightKg = 70) {
  const met = ACTIVITY_KINDS[kind]?.met || 4;
  const kg = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70;
  return Math.round(((met * 3.5 * kg) / 200) * minutes);
}
/** Walking energy above rest, roughly 0.04 kcal per step at 70 kg. */
export function stepsKcal(steps, weightKg = 70) {
  const kg = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70;
  return Math.round(Math.max(0, steps || 0) * kg * 0.00057);
}
export const activityInput = z
  .object({
    id: z.string().uuid(),
    date: civilDate,
    kind: z.enum(Object.keys(ACTIVITY_KINDS)),
    minutes: z.number().int().min(1).max(600),
    kcal: z.number().int().min(0).max(5000).nullable().default(null),
    note: z.string().trim().max(200).default(""),
  })
  .strict();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const REMINDER_DEFAULTS = Object.freeze({ enabled: false, breakfast: "08:30", lunch: "13:30", dinner: "19:30" });
export const preferenceInput = z
  .object({
    rollover: z.boolean().default(false),
    addBurned: z.boolean().default(false),
    countSteps: z.boolean().default(true),
    reminders: z
      .object({
        enabled: z.boolean().default(false),
        breakfast: clock.default("08:30"),
        lunch: clock.default("13:30"),
        dinner: clock.default("19:30"),
      })
      .strict()
      .default(() => ({ ...REMINDER_DEFAULTS })),
  })
  .strict();
export const defaultPreferences = () => preferenceInput.parse({});
export const measurementInput = z
  .object({
    waistCm: z.number().min(30).max(250).nullable().default(null),
    hipsCm: z.number().min(30).max(250).nullable().default(null),
    chestCm: z.number().min(30).max(250).nullable().default(null),
    armCm: z.number().min(10).max(100).nullable().default(null),
    thighCm: z.number().min(20).max(150).nullable().default(null),
  })
  .strict()
  .refine((v) => Object.values(v).some((n) => n != null), "მიუთითე მინიმუმ ერთი ზომა.");
export const ROLLOVER_CAP = 200;
/**
 * Daily energy budget = target (+ burned when enabled) (+ unused kcal from
 * yesterday when rollover is enabled, capped). Deficit days never borrow.
 */
export function energyBudget({ target, preferences, burned, yesterday }) {
  if (!target) return { budget: null, rollover: 0, burnedCounted: 0 };
  const rollover =
    preferences.rollover && yesterday?.target && yesterday.recorded
      ? Math.max(0, Math.min(ROLLOVER_CAP, Math.round(yesterday.target - yesterday.eaten)))
      : 0;
  const burnedCounted = preferences.addBurned ? Math.max(0, Math.round(burned || 0)) : 0;
  return { budget: target + burnedCounted + rollover, rollover, burnedCounted };
}
/**
 * Straight-line trend through recent weights (least squares). Needs at least
 * three points spanning a week; otherwise the planned pace is the only guide.
 */
export function weightProjection(history, goal, today, pacePerWeek) {
  const points = (history || [])
    .filter((p) => Number.isFinite(p.weightKg) && p.date <= today)
    .slice(-28);
  const current = points.at(-1)?.weightKg ?? null;
  const target = goal?.targetKg ?? null;
  const out = { current, target, trendKgPerWeek: null, trendEta: null, planEta: null, direction: null, remainingKg: null };
  if (current == null || target == null) return out;
  out.remainingKg = Math.round((target - current) * 10) / 10;
  out.direction = out.remainingKg < 0 ? "down" : out.remainingKg > 0 ? "up" : "reached";
  if (out.direction !== "reached" && pacePerWeek > 0)
    out.planEta = shiftCivil(today, Math.min(730, Math.ceil((Math.abs(out.remainingKg) / pacePerWeek) * 7)));
  if (points.length >= 3) {
    const t0 = Date.parse(points[0].date);
    const xs = points.map((p) => (Date.parse(p.date) - t0) / 86400000);
    const ys = points.map((p) => p.weightKg);
    const span = xs.at(-1);
    if (span >= 7) {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1);
      out.trendKgPerWeek = Math.round(slope * 7 * 100) / 100;
      const toward = out.direction === "down" ? slope < -0.005 : slope > 0.005;
      if (toward && out.direction !== "reached") {
        const days = Math.abs(out.remainingKg / slope);
        out.trendEta = days <= 730 ? shiftCivil(today, Math.ceil(days)) : null;
      }
    }
  }
  return out;
}
/** Week at a glance: recorded days, days inside the target band, average intake. */
export function weekSummary(days) {
  const recorded = days.filter((d) => d.recorded);
  const withTarget = recorded.filter((d) => d.target?.calories);
  const onTarget = withTarget.filter((d) => d.totals.calories <= d.target.calories * 1.05 && d.totals.calories >= d.target.calories * 0.6);
  const average = recorded.length ? Math.round(recorded.reduce((s, d) => s + d.totals.calories, 0) / recorded.length) : null;
  const balance = withTarget.reduce((s, d) => s + (d.totals.calories - d.target.calories), 0);
  return {
    recordedDays: recorded.length,
    targetDays: withTarget.length,
    onTargetDays: onTarget.length,
    averageCalories: average,
    balanceCalories: withTarget.length ? Math.round(balance) : null,
    averageProtein: recorded.length ? Math.round(recorded.reduce((s, d) => s + d.totals.protein, 0) / recorded.length) : null,
  };
}
export function mealSummary(meal) {
  return { id: meal.id, date: meal.date, type: meal.type, title: meal.title || "", source: meal.source, names: meal.items.map((i) => i.name), totals: totals(meal.items) };
}
