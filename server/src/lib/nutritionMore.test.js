import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMacroSplit,
  macroInput,
  MACRO_PRESETS,
  recipeInput,
  recipeToFood,
  copyInput,
  copiedMeals,
  fastingEligibility,
  fastingSettingsInput,
  fastStartInput,
  fastTimesProblem,
  fastingStats,
  publicFast,
} from "./nutritionMore.js";
import { preferenceInput } from "./nutritionPlus.js";
import { foodToItem } from "./nutritionFoods.js";

const targets = { calories: 2000, protein: 100, carbs: 250, fat: 67, maintenance: 2400, adjustment: -400, method: "Mifflin–St Jeor" };
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("macro split re-divides the plan calories and never changes the calorie target", () => {
  assert.equal(applyMacroSplit(targets, { mode: "auto", protein: 30, carbs: 40, fat: 30 }), targets);
  const custom = applyMacroSplit(targets, { mode: "custom", ...MACRO_PRESETS.highProtein });
  assert.equal(custom.calories, 2000);
  assert.deepEqual([custom.protein, custom.carbs, custom.fat], [150, 200, 67]);
  assert.deepEqual(custom.split, { protein: 30, carbs: 40, fat: 30 });
  assert.equal(applyMacroSplit(null, { mode: "custom", ...MACRO_PRESETS.highProtein }), null);
});
test("macro split must sum to 100 and stay inside everyday bounds", () => {
  for (const preset of Object.values(MACRO_PRESETS)) assert.ok(macroInput.safeParse({ mode: "custom", ...preset }).success);
  assert.ok(!macroInput.safeParse({ mode: "custom", protein: 30, carbs: 40, fat: 25 }).success);
  assert.ok(!macroInput.safeParse({ mode: "custom", protein: 20, carbs: 10, fat: 70 }).success, "no ketogenic split");
  assert.ok(!macroInput.safeParse({ mode: "custom", protein: 50, carbs: 30, fat: 20 }).success);
});
test("preferences default the new keys and keep old payloads valid", () => {
  const old = preferenceInput.parse({ rollover: true, addBurned: false, countSteps: true, reminders: { enabled: false, breakfast: "08:30", lunch: "13:30", dinner: "19:30" } });
  assert.equal(old.macros.mode, "auto");
  assert.equal(old.fasting.screening, null);
  assert.equal(old.fasting.targetMinutes, 16 * 60);
});

const rice = { name: "ბრინჯი", grams: 300, calories: 390, protein: 8, carbs: 84, fat: 1, fiber: 1.2 };
const chicken = { name: "ქათამი", grams: 500, calories: 825, protein: 155, carbs: 0, fat: 18, fiber: 0 };
test("a recipe becomes a saved food whose serving reproduces the per-serving totals", () => {
  const input = recipeInput.parse({ id: id(1), name: "ქათამი ბრინჯით", servings: 4, items: [rice, chicken] });
  const food = recipeToFood(input);
  assert.equal(food.source, "recipe");
  assert.equal(food.serving.grams, 200);
  assert.equal(food.recipe.totalGrams, 800);
  const serving = foodToItem(food, food.serving.grams);
  assert.ok(Math.abs(serving.calories - (390 + 825) / 4) < 1);
  assert.ok(Math.abs(serving.protein - (8 + 155) / 4) < 0.5);
  assert.ok(Number.isFinite(food.per100.fiber), "fiber kept when every ingredient reports it");
  assert.equal(food.per100.sugar, undefined, "unknown sugar stays unknown");
  assert.ok(!recipeInput.safeParse({ id: id(1), name: "x", servings: 0, items: [rice] }).success);
  assert.ok(!recipeInput.safeParse({ id: id(1), name: "x", servings: 2, items: [] }).success);
});

test("copying keeps items, title and source and can change the meal type", () => {
  const source = { id: id(1), date: "2026-09-26", type: "breakfast", items: [rice], note: "n", title: "საუზმე", source: "photo" };
  const input = copyInput.parse({ date: "2026-09-27", copies: [{ fromId: id(1), id: id(2) }, { fromId: id(9), id: id(3) }] });
  const meals = copiedMeals([source], input);
  assert.deepEqual(meals, [{ id: id(2), date: "2026-09-27", type: "breakfast", items: [rice], note: "n", title: "საუზმე", source: "photo" }]);
  assert.equal(copiedMeals([source], { ...input, type: "snack" })[0].type, "snack");
  assert.ok(!copyInput.safeParse({ date: "2026-09-27", copies: [{ fromId: id(1), id: id(1) }] }).success, "a copy cannot overwrite its source");
});

const adult = { birthDate: "1990-01-01", sensitiveRestriction: false, medicalRestriction: false };
const answered = (extra = {}) => ({ eatingDisorder: false, pregnancy: false, diabetesMedication: false, doctorApproved: false, answeredAt: "2026-09-27T08:00:00.000Z", ...extra });
test("fasting needs the safety answers first", () => {
  const e = fastingEligibility({ facts: adult, screening: null, today: "2026-09-27" });
  assert.equal(e.eligible, false);
  assert.equal(e.needsScreening, true);
  assert.equal(fastingEligibility({ facts: adult, screening: answered(), today: "2026-09-27" }).eligible, true);
});
test("fasting is never offered to minors, in pregnancy or with an eating-disorder history", () => {
  const minor = fastingEligibility({ facts: { ...adult, birthDate: "2010-05-01" }, screening: answered(), today: "2026-09-27" });
  assert.equal(minor.eligible, false);
  assert.equal(minor.blocked, true);
  assert.ok(fastingEligibility({ facts: { ...adult, sensitiveRestriction: true }, screening: answered(), today: "2026-09-27" }).blocked);
  assert.ok(fastingEligibility({ facts: adult, screening: answered({ eatingDisorder: true }), today: "2026-09-27" }).blocked);
  assert.ok(fastingEligibility({ facts: adult, screening: answered(), programConfig: { screening: { eatingDisorder: true } }, today: "2026-09-27" }).blocked);
  const blockedEvenIfApproved = fastingEligibility({ facts: adult, screening: answered({ pregnancy: true, doctorApproved: true }), today: "2026-09-27" });
  assert.equal(blockedEvenIfApproved.eligible, false);
});
test("glucose-lowering medication or a chronic condition needs the doctor's agreement", () => {
  const meds = fastingEligibility({ facts: adult, screening: answered({ diabetesMedication: true }), today: "2026-09-27" });
  assert.equal(meds.eligible, false);
  assert.equal(meds.needsDoctor, true);
  assert.equal(fastingEligibility({ facts: adult, screening: answered({ diabetesMedication: true, doctorApproved: true }), today: "2026-09-27" }).eligible, true);
  assert.equal(fastingEligibility({ facts: { ...adult, medicalRestriction: true }, screening: answered(), today: "2026-09-27" }).needsDoctor, true);
});
test("fasting windows stay between 10 and 20 hours", () => {
  assert.ok(fastStartInput.safeParse({ id: id(1), protocol: "16:8", targetMinutes: 960 }).success);
  assert.ok(!fastStartInput.safeParse({ id: id(1), protocol: "custom", targetMinutes: 24 * 60 }).success);
  assert.ok(!fastStartInput.safeParse({ id: id(1), protocol: "custom", targetMinutes: 8 * 60 }).success);
  assert.ok(!fastingSettingsInput.safeParse({ protocol: "16:8", targetMinutes: 18 * 60, notify: true }).success, "a preset must match its length");
  assert.ok(fastingSettingsInput.safeParse({ protocol: "custom", targetMinutes: 13 * 60, notify: false }).success);
});
test("fast times cannot be in the future, reversed or longer than 48 hours", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  assert.equal(fastTimesProblem("2026-09-26T20:00:00Z", "2026-09-27T12:00:00Z", now), null);
  assert.ok(fastTimesProblem("2026-09-27T13:00:00Z", null, now));
  assert.ok(fastTimesProblem("2026-09-27T10:00:00Z", "2026-09-27T09:00:00Z", now));
  assert.ok(fastTimesProblem("2026-09-24T10:00:00Z", "2026-09-27T11:00:00Z", now));
  assert.ok(fastTimesProblem("2026-09-26T20:00:00Z", "2026-09-27T14:00:00Z", now));
});
test("a fast is completed when it reaches its target; stats count a daily streak", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const row = (start, end, target = 960) => ({ id: id(Math.random() * 1e6 | 0), startedAt: new Date(start), endedAt: end ? new Date(end) : null, targetMinutes: target, protocol: "16:8", note: "" });
  const open = publicFast(row("2026-09-27T02:00:00Z", null), now);
  assert.equal(open.minutes, 600);
  assert.equal(open.completed, false);
  assert.equal(open.goalAt, "2026-09-27T18:00:00.000Z");
  const fasts = [
    row("2026-09-26T20:00:00Z", "2026-09-27T12:00:00Z"),
    row("2026-09-25T20:00:00Z", "2026-09-26T12:30:00Z"),
    row("2026-09-24T20:00:00Z", "2026-09-25T09:00:00Z"),
    row("2026-09-22T20:00:00Z", "2026-09-23T13:00:00Z"),
    row("2026-09-27T11:00:00Z", null),
  ];
  const stats = fastingStats(fasts, "Asia/Tbilisi", now);
  assert.equal(stats.total, 4);
  assert.equal(stats.completed, 3);
  assert.equal(stats.streak, 2, "the 13-hour fast on 25 September breaks the run");
  assert.equal(stats.week.count, 4);
  assert.equal(stats.longestMinutes, 17 * 60);
});
