import test from "node:test";
import assert from "node:assert/strict";
import { healthScore, estimateMessages, estimateRequest, mealInput } from "./nutrition.js";
import {
  computeStreak,
  activityKcal,
  stepsKcal,
  energyBudget,
  weightProjection,
  weekSummary,
  preferenceInput,
  measurementInput,
} from "./nutritionPlus.js";
import { normalizeOffProduct, searchCatalog, foodToItem, itemToFood, foodInput } from "./nutritionFoods.js";

const salad = { name: "სალათი", grams: 200, calories: 90, protein: 4, carbs: 10, fat: 4, fiber: 4, sugar: 3, sodium: 200 };
const cake = { name: "ნამცხვარი", grams: 120, calories: 420, protein: 5, carbs: 60, fat: 18, fiber: 1, sugar: 40, sodium: 300 };
const chips = { name: "ჩიფსი", grams: 100, calories: 536, protein: 7, carbs: 53, fat: 35, fiber: 4.8, sugar: 0.4, sodium: 525 };
const chicken = { name: "ქათამი", grams: 150, calories: 248, protein: 46, carbs: 0, fat: 5 };

test("health score rewards protein and fiber, penalises sugar, fat and sodium density; unknown micros are neutral", () => {
  assert.equal(healthScore([]), null);
  assert.ok(healthScore([salad]) >= 8, "salad scores high");
  assert.ok(healthScore([cake]) <= 4, "cake scores low");
  assert.ok(healthScore([chips]) <= 5, "chips score low");
  assert.ok(healthScore([chicken]) >= 7, "lean protein without micro data still scores well");
  for (const items of [[salad], [cake], [chips], [chicken], [salad, cake]]) {
    const s = healthScore(items);
    assert.ok(Number.isInteger(s) && s >= 1 && s <= 10);
  }
});

test("meal input accepts optional micronutrients, a title and the new sources", () => {
  const meal = { id: "43c17af3-cfe0-4e69-8976-58b34b08e270", date: "2026-09-26", type: "lunch", items: [salad], title: "სალათი", source: "barcode" };
  assert.equal(mealInput.safeParse(meal).success, true);
  assert.equal(mealInput.safeParse({ ...meal, source: "magic" }).success, false);
  assert.equal(mealInput.safeParse({ ...meal, items: [{ ...salad, sodium: -1 }] }).success, false);
});

test("estimate modes build the right provider messages and validate their preconditions", () => {
  const text = estimateRequest.parse({ mode: "text", description: "ორი ხინკალი" });
  const textMessages = estimateMessages(text, null);
  assert.equal(textMessages.length, 2);
  assert.match(textMessages[0].content, /written or spoken description/);
  assert.equal(textMessages[1].content.some((c) => c.type === "image_url"), false);
  const fix = estimateRequest.parse({ mode: "fix", previous: [salad], correction: "სოუსის გარეშე" });
  const fixMessages = estimateMessages(fix, "AAAA");
  assert.match(fixMessages[1].content[0].text, /User correction: სოუსის გარეშე/);
  assert.equal(fixMessages[1].content.some((c) => c.type === "image_url"), true);
  const label = estimateMessages(estimateRequest.parse({ mode: "label" }), "AAAA");
  assert.match(label[0].content, /nutrition facts label/);
  assert.equal(estimateRequest.safeParse({ mode: "video" }).success, false);
  assert.equal(estimateRequest.safeParse({ mode: "fix", previous: Array(26).fill(salad) }).success, false);
});

test("streak counts consecutive logged days, survives an unlogged today and tracks milestones", () => {
  const today = "2026-09-26";
  assert.deepEqual(computeStreak([], today), { current: 0, best: 0, loggedToday: false, nextMilestone: 3, reached: [] });
  const three = computeStreak(["2026-09-24", "2026-09-25", "2026-09-26"], today);
  assert.equal(three.current, 3);
  assert.equal(three.loggedToday, true);
  assert.deepEqual(three.reached, [3]);
  assert.equal(three.nextMilestone, 7);
  const yesterdayOnly = computeStreak(["2026-09-23", "2026-09-24", "2026-09-25"], today);
  assert.equal(yesterdayOnly.current, 3, "today not logged yet keeps yesterday's run alive");
  assert.equal(yesterdayOnly.loggedToday, false);
  const broken = computeStreak(["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-26"], today);
  assert.equal(broken.current, 1);
  assert.equal(broken.best, 3);
});

test("activity and step energy scale with weight and time, with sane fallbacks", () => {
  assert.equal(activityKcal("run", 30, 70), Math.round((9.8 * 3.5 * 70) / 200 * 30));
  assert.ok(activityKcal("walk", 30, 90) > activityKcal("walk", 30, 60));
  assert.equal(activityKcal("unknown", 10, NaN), Math.round((4 * 3.5 * 70) / 200 * 10));
  assert.equal(stepsKcal(10000, 70), 399);
  assert.equal(stepsKcal(-5, 70), 0);
});

test("energy budget adds burned calories and capped rollover only when enabled", () => {
  const preferences = preferenceInput.parse({});
  assert.deepEqual(energyBudget({ target: null, preferences, burned: 300, yesterday: null }), { budget: null, rollover: 0, burnedCounted: 0 });
  assert.deepEqual(energyBudget({ target: 2000, preferences, burned: 300, yesterday: { target: 2000, eaten: 1500, recorded: true } }), { budget: 2000, rollover: 0, burnedCounted: 0 });
  const on = preferenceInput.parse({ rollover: true, addBurned: true });
  assert.deepEqual(energyBudget({ target: 2000, preferences: on, burned: 300, yesterday: { target: 2000, eaten: 1500, recorded: true } }), { budget: 2500, rollover: 200, burnedCounted: 300 });
  assert.equal(energyBudget({ target: 2000, preferences: on, burned: 0, yesterday: { target: 2000, eaten: 2400, recorded: true } }).rollover, 0, "overeating never borrows");
  assert.equal(energyBudget({ target: 2000, preferences: on, burned: 0, yesterday: { target: 2000, eaten: 0, recorded: false } }).rollover, 0, "an unlogged day is unknown, not a surplus");
});

test("weight projection uses the trend only with enough spread and only when moving toward the goal", () => {
  const today = "2026-09-26";
  const goal = { targetKg: 76 };
  const down = [
    { date: "2026-09-05", weightKg: 82 },
    { date: "2026-09-12", weightKg: 81.4 },
    { date: "2026-09-19", weightKg: 80.9 },
    { date: "2026-09-26", weightKg: 80.2 },
  ];
  const p = weightProjection(down, goal, today, 0.4);
  assert.equal(p.direction, "down");
  assert.equal(p.remainingKg, -4.2);
  assert.ok(p.trendKgPerWeek < 0);
  assert.ok(p.trendEta > today);
  assert.ok(p.planEta > today);
  const up = weightProjection(down.map((v) => ({ ...v, weightKg: 90 - v.weightKg + 80 })), goal, today, 0.4);
  assert.equal(up.trendEta, null, "gaining while the goal is lower gives no ETA");
  const few = weightProjection(down.slice(-2), goal, today, 0);
  assert.equal(few.trendKgPerWeek, null);
  assert.equal(few.planEta, null);
  assert.equal(weightProjection([], goal, today, 0.4).current, null);
});

test("week summary counts on-target days inside the band", () => {
  const target = { calories: 2000 };
  const days = [
    { date: "a", recorded: true, totals: { calories: 1900, protein: 80 }, target },
    { date: "b", recorded: true, totals: { calories: 2300, protein: 90 }, target },
    { date: "c", recorded: true, totals: { calories: 900, protein: 40 }, target },
    { date: "d", recorded: false, totals: { calories: 0, protein: 0 }, target },
    { date: "e", recorded: true, totals: { calories: 1500, protein: 60 }, target: null },
  ];
  assert.deepEqual(weekSummary(days), { recordedDays: 4, targetDays: 3, onTargetDays: 1, averageCalories: 1650, balanceCalories: -900, averageProtein: 68 });
});

test("preferences and measurements validate strictly", () => {
  assert.deepEqual(preferenceInput.parse({}).reminders, { enabled: false, breakfast: "08:30", lunch: "13:30", dinner: "19:30" });
  assert.equal(preferenceInput.safeParse({ reminders: { breakfast: "25:00" } }).success, false);
  assert.equal(preferenceInput.safeParse({ extra: true }).success, false);
  assert.equal(measurementInput.safeParse({}).success, false);
  assert.equal(measurementInput.safeParse({ waistCm: 82 }).success, true);
});

test("Open Food Facts products normalise to per-100 g facts with sodium in milligrams", () => {
  const product = normalizeOffProduct({
    code: "4860001234567",
    product_name: "Natakhtari Lemonade",
    product_name_ka: "ნატახტარი ლიმონათი",
    brands: "Natakhtari, Efes",
    serving_quantity: "330",
    serving_size: "330 ml",
    nutriscore_grade: "e",
    nutriments: { "energy-kcal_100g": 42, proteins_100g: 0, carbohydrates_100g: 10.5, fat_100g: 0, sugars_100g: 10.5, salt_100g: 0.025 },
  });
  assert.equal(product.name, "ნატახტარი ლიმონათი");
  assert.equal(product.brand, "Natakhtari");
  assert.deepEqual(product.per100, { calories: 42, protein: 0, carbs: 10.5, fat: 0, sugar: 10.5, sodium: 10 });
  assert.deepEqual(product.serving, { grams: 330, label: "330 ml" });
  assert.equal(product.nutriscore, "e");
  assert.equal(normalizeOffProduct({ product_name: "x", nutriments: {} }), null);
  assert.equal(normalizeOffProduct({ product_name: "kJ only", nutriments: { energy_100g: 418 } }).per100.calories, 100);
});

test("catalog search matches Georgian names and Latin aliases, saved-first ordering is left to the route", () => {
  const khachapuri = searchCatalog("khachapuri");
  assert.ok(khachapuri.length >= 2);
  assert.ok(khachapuri.every((f) => f.kind === "catalog"));
  assert.equal(searchCatalog("ხინკალი")[0].id, "khinkali_meat");
  assert.equal(searchCatalog("x").length, 0);
  assert.ok(searchCatalog("ყველი").some((f) => f.id === "sulguni"));
});

test("portion maths round-trips between per-100 g facts and a diary item", () => {
  const food = foodInput.parse({ id: "43c17af3-cfe0-4e69-8976-58b34b08e270", name: "ბანანი", per100: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2, sodium: 1 } });
  const item = foodToItem(food, 120);
  assert.deepEqual(item, { name: "ბანანი", grams: 120, calories: 106.8, protein: 1.3, carbs: 27.4, fat: 0.4, fiber: 3.1, sugar: 14.6, sodium: 1.2 });
  const back = itemToFood(item, "meal");
  assert.equal(back.per100.calories, 89);
  assert.equal(back.serving.grams, 120);
  assert.equal(foodInput.safeParse({ ...food, barcode: "abc" }).success, false);
});
