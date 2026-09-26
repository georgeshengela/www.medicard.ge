import { z } from "zod";
import { civilDate, foodItem, totals, NUTRIENT_KEYS, MICRO_KEYS } from "./nutrition.js";
import { ageOn, shiftCivil } from "./nutritionProgram.js";
import { todayInTimeZone } from "./cycle.js";

const round1 = (n) => Math.round(n * 10) / 10;
const mealType = z.enum(["breakfast", "lunch", "dinner", "snack"]);

/* ---------- macro split ---------- */
/** Energy shares in percent. The default mirrors the plan formula (20 / 50 / 30). */
export const MACRO_PRESETS = {
  balanced: { protein: 20, carbs: 50, fat: 30 },
  highProtein: { protein: 30, carbs: 40, fat: 30 },
  lowerCarb: { protein: 30, carbs: 25, fat: 45 },
  endurance: { protein: 20, carbs: 55, fat: 25 },
};
// Bounds keep a custom split inside a broad everyday range; no ketogenic or protein-only split.
export const MACRO_BOUNDS = { protein: [10, 40], carbs: [15, 65], fat: [15, 50] };
const share = (key) => z.number().int().min(MACRO_BOUNDS[key][0]).max(MACRO_BOUNDS[key][1]);
export const macroInput = z
  .object({ mode: z.enum(["auto", "custom"]), protein: share("protein"), carbs: share("carbs"), fat: share("fat") })
  .strict()
  .refine((v) => v.protein + v.carbs + v.fat === 100, "ცილის, ნახშირწყლებისა და ცხიმის ჯამი 100% უნდა იყოს.");
export const defaultMacros = () => ({ mode: "auto", ...MACRO_PRESETS.balanced });
/**
 * Grams from the day's calorie target and the person's split. Only the macro
 * distribution changes; the calorie target itself always comes from the plan.
 */
export function applyMacroSplit(targets, macros) {
  if (!targets?.calories || macros?.mode !== "custom") return targets;
  const kcal = targets.calories;
  return {
    ...targets,
    protein: Math.round((kcal * macros.protein) / 100 / 4),
    carbs: Math.round((kcal * macros.carbs) / 100 / 4),
    fat: Math.round((kcal * macros.fat) / 100 / 9),
    split: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
  };
}

/* ---------- personal recipes ---------- */
export const recipeInput = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    servings: z.number().int().min(1).max(50),
    items: z.array(foodItem).min(1).max(40),
    favorite: z.boolean().default(true),
  })
  .strict();
/**
 * A recipe is stored as a saved food: per-100 g facts of the whole pot and one
 * serving = total weight / servings, so every search, portion and repeat flow
 * already works. The ingredient list is kept for editing.
 */
export function recipeToFood(input) {
  const t = totals(input.items);
  const grams = input.items.reduce((s, i) => s + i.grams, 0);
  const per100 = {};
  for (const k of NUTRIENT_KEYS) per100[k] = Math.min(k === "calories" ? 1000 : 100, round1((t[k] * 100) / grams));
  for (const k of MICRO_KEYS)
    if (t[k] != null) per100[k] = Math.min(k === "sodium" ? 50000 : 100, round1((t[k] * 100) / grams));
  return {
    id: input.id,
    name: input.name,
    brand: "",
    per100,
    serving: { grams: round1(grams / input.servings), label: "პორცია" },
    source: "recipe",
    barcode: null,
    favorite: input.favorite,
    recipe: { servings: input.servings, items: input.items, totalGrams: round1(grams) },
  };
}

/* ---------- copy meals ---------- */
export const copyInput = z
  .object({
    date: civilDate,
    type: mealType.optional(),
    copies: z
      .array(z.object({ fromId: z.string().uuid(), id: z.string().uuid() }).strict())
      .min(1)
      .max(25),
  })
  .strict()
  .refine((v) => {
    const ids = v.copies.flatMap((c) => [c.fromId, c.id]);
    return new Set(ids).size === ids.length;
  }, "კოპირების ჩანაწერები ერთმანეთს ემთხვევა.");
/** New diary rows from the person's own meals; the copy keeps items, title and source. */
export function copiedMeals(sources, input) {
  const byId = new Map(sources.map((m) => [m.id, m]));
  return input.copies
    .filter((c) => byId.has(c.fromId))
    .map((c) => {
      const m = byId.get(c.fromId);
      return { id: c.id, date: input.date, type: input.type || m.type, items: m.items, note: m.note || "", title: m.title || "", source: m.source };
    });
}

/* ---------- intermittent fasting ---------- */
export const FASTING_PROTOCOLS = {
  "12:12": 12 * 60,
  "14:10": 14 * 60,
  "16:8": 16 * 60,
  "18:6": 18 * 60,
  "20:4": 20 * 60,
};
// A daily eating window only: no multi-day or water fasts, which need medical supervision.
export const FAST_MIN_MINUTES = 10 * 60;
export const FAST_MAX_MINUTES = 20 * 60;
export const FAST_MAX_RECORD_MINUTES = 48 * 60;
const iso = z.string().datetime({ offset: true });
export const fastingScreeningInput = z
  .object({
    eatingDisorder: z.boolean(),
    pregnancy: z.boolean(),
    diabetesMedication: z.boolean(),
    doctorApproved: z.boolean().default(false),
  })
  .strict();
export const fastingSettingsSchema = z
  .object({
    screening: fastingScreeningInput.extend({ answeredAt: iso }).nullable().default(null),
    protocol: z.enum([...Object.keys(FASTING_PROTOCOLS), "custom"]).default("16:8"),
    targetMinutes: z.number().int().min(FAST_MIN_MINUTES).max(FAST_MAX_MINUTES).default(16 * 60),
    notify: z.boolean().default(true),
  })
  .strict();
export const defaultFastingSettings = () => ({ screening: null, protocol: "16:8", targetMinutes: 16 * 60, notify: true });
export const fastingSettingsInput = z
  .object({
    protocol: z.enum([...Object.keys(FASTING_PROTOCOLS), "custom"]),
    targetMinutes: z.number().int().min(FAST_MIN_MINUTES).max(FAST_MAX_MINUTES),
    notify: z.boolean(),
  })
  .strict()
  .refine((v) => v.protocol === "custom" || FASTING_PROTOCOLS[v.protocol] === v.targetMinutes, "რეჟიმი და ხანგრძლივობა არ ემთხვევა.");
/**
 * Who should not use a fasting timer in a consumer app. Hard stops: under 18,
 * pregnancy or breastfeeding, an eating-disorder history. Glucose-lowering
 * medication or a chronic condition needs the person's confirmation that a
 * doctor agreed, because fasting can cause dangerous low blood sugar.
 */
export function fastingEligibility({ facts, screening, programConfig, today }) {
  const blocks = [];
  const age = facts?.birthDate ? ageOn(facts.birthDate, today) : null;
  if (age != null && age < 18)
    blocks.push("18 წლამდე შიმშილის ფანჯრებს არ გირჩევთ — ზრდის პერიოდში რეგულარული კვება მნიშვნელოვანია.");
  if (facts?.sensitiveRestriction || screening?.pregnancy || programConfig?.screening?.pregnancyOrBreastfeeding)
    blocks.push("ორსულობისა და ძუძუთი კვების პერიოდში შიმშილის ტაიმერი არ გამოიყენება.");
  if (screening?.eatingDisorder || programConfig?.screening?.eatingDisorder)
    blocks.push("კვებითი ქცევის სირთულის ისტორიისას შიმშილის ფანჯრები შეიძლება ზიანის მომტანი იყოს. ტაიმერს არ ვთავაზობთ — სჯობს სპეციალისტის მხარდაჭერა.");
  const needsDoctor = !!(screening?.diabetesMedication || facts?.medicalRestriction || programConfig?.screening?.medicalDiet);
  const doctorReasons = [];
  if (screening?.diabetesMedication)
    doctorReasons.push("ინსულინი ან შაქრის დამწევი წამალი შიმშილისას საშიშად დაბალი შაქრის რისკს ზრდის.");
  else if (needsDoctor) doctorReasons.push("ჯანმრთელობის პროფილში ქრონიკული მდგომარეობა ან სამკურნალო დიეტაა მონიშნული.");
  const answered = !!screening?.answeredAt;
  const doctorOk = !needsDoctor || !!screening?.doctorApproved;
  return {
    eligible: answered && blocks.length === 0 && doctorOk,
    needsScreening: !answered,
    blocked: blocks.length > 0,
    reasons: blocks,
    needsDoctor: needsDoctor && blocks.length === 0,
    doctorReasons,
    maxMinutes: FAST_MAX_MINUTES,
  };
}
export const fastStartInput = z
  .object({
    id: z.string().uuid(),
    protocol: z.enum([...Object.keys(FASTING_PROTOCOLS), "custom"]),
    targetMinutes: z.number().int().min(FAST_MIN_MINUTES).max(FAST_MAX_MINUTES),
    startedAt: iso.optional(),
  })
  .strict();
export const fastEditInput = z
  .object({
    startedAt: iso,
    endedAt: iso.nullable(),
    targetMinutes: z.number().int().min(FAST_MIN_MINUTES).max(FAST_MAX_MINUTES),
    note: z.string().trim().max(200).default(""),
  })
  .strict();
const minutesBetween = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
/** Validates a fast's times against the clock; returns an error message or null. */
export function fastTimesProblem(startedAt, endedAt, now = new Date()) {
  const start = new Date(startedAt).getTime(), clock = now.getTime();
  if (!Number.isFinite(start)) return "დაწყების დრო არასწორია.";
  if (start > clock + 60000) return "დაწყების დრო მომავალში ვერ იქნება.";
  if (clock - start > 7 * 86400000 && endedAt == null) return "დაწყება ერთ კვირაზე ძველი ვერ იქნება.";
  if (endedAt != null) {
    const end = new Date(endedAt).getTime();
    if (!Number.isFinite(end) || end <= start) return "დასრულება დაწყების შემდეგ უნდა იყოს.";
    if (end > clock + 60000) return "დასრულების დრო მომავალში ვერ იქნება.";
    if (minutesBetween(startedAt, endedAt) > FAST_MAX_RECORD_MINUTES) return "ჩანაწერი 48 საათზე გრძელი ვერ იქნება. მიუთითე, როდის დაასრულე სინამდვილეში.";
  }
  return null;
}
export function publicFast(row, now = new Date()) {
  const end = row.endedAt ? new Date(row.endedAt) : now;
  const minutes = Math.max(0, minutesBetween(row.startedAt, end));
  return {
    id: row.id,
    startedAt: new Date(row.startedAt).toISOString(),
    endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : null,
    targetMinutes: row.targetMinutes,
    protocol: row.protocol,
    note: row.note || "",
    minutes,
    completed: minutes >= row.targetMinutes,
    goalAt: new Date(new Date(row.startedAt).getTime() + row.targetMinutes * 60000).toISOString(),
  };
}
/** Week totals and a streak of days (by the day a fast ended) with a completed fast. */
export function fastingStats(fasts, timeZone = "UTC", now = new Date()) {
  const done = fasts.filter((f) => f.endedAt).map((f) => publicFast(f, now));
  const today = todayInTimeZone(timeZone, now);
  const dayOf = (d) => todayInTimeZone(timeZone, new Date(d));
  const weekFrom = shiftCivil(today, -6);
  const week = done.filter((f) => dayOf(f.endedAt) >= weekFrom);
  const completedDays = new Set(done.filter((f) => f.completed).map((f) => dayOf(f.endedAt)));
  let cursor = completedDays.has(today) ? today : shiftCivil(today, -1);
  let streak = 0;
  while (completedDays.has(cursor) && streak < 3660) {
    streak++;
    cursor = shiftCivil(cursor, -1);
  }
  return {
    total: done.length,
    completed: done.filter((f) => f.completed).length,
    week: {
      count: week.length,
      completed: week.filter((f) => f.completed).length,
      averageMinutes: week.length ? Math.round(week.reduce((s, f) => s + f.minutes, 0) / week.length) : null,
    },
    longestMinutes: done.reduce((m, f) => Math.max(m, f.minutes), 0) || null,
    streak,
  };
}
