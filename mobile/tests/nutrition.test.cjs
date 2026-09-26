const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../src/lib/nutrition.ts");
test("portion changes scale all nutrients, not only energy", async () => {
  const { scaleFood } = await load();
  const item = {
    name: "Rice",
    grams: 100,
    calories: 130,
    protein: 3,
    carbs: 28,
    fat: 0.3,
  };
  assert.deepEqual(scaleFood(item, 200), {
    name: "Rice",
    grams: 200,
    calories: 260,
    protein: 6,
    carbs: 56,
    fat: 0.6,
  });
  assert.deepEqual(scaleFood(scaleFood(item, 200), 100), item);
});
test("daily totals keep fractional nutrients", async () => {
  const { foodTotals } = await load();
  assert.deepEqual(
    foodTotals([
      {
        name: "Rice",
        grams: 100,
        calories: 130,
        protein: 3,
        carbs: 28,
        fat: 0.3,
      },
    ]),
    { calories: 130, protein: 3, carbs: 28, fat: 0.3, fiber: null, sugar: null, sodium: null },
  );
});
test("history navigation crosses month and year boundaries", async () => {
  const { shiftDay } = await load();
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDay("2024-03-01", -1), "2024-02-29");
});

test("opening an existing meal does not count as editing; actual edits and reverting are detected", async () => {
  const { mealEditSnapshot } = await load();
  const meal = {
    id: "m",
    date: "2026-09-24",
    type: "lunch",
    source: "plan",
    note: "Lunch",
    items: [
      {
        name: "Rice",
        grams: 100,
        calories: 130,
        protein: 3,
        carbs: 28,
        fat: 0.3,
      },
    ],
  };
  const baseline = mealEditSnapshot(meal);
  assert.equal(
    mealEditSnapshot({ ...meal, updatedAt: "later", note: " Lunch " }),
    baseline,
  );
  for (const edited of [
    { ...meal, note: "New note" },
    { ...meal, type: "dinner" },
    { ...meal, items: [] },
    { ...meal, items: [{ ...meal.items[0], grams: 200 }] },
    { ...meal, source: "photo" },
  ])
    assert.notEqual(mealEditSnapshot(edited), baseline);
  assert.equal(mealEditSnapshot(structuredClone(meal)), baseline);
  const empty = { ...meal, source: "manual", note: "", items: [] };
  assert.equal(mealEditSnapshot({ ...empty }), mealEditSnapshot(empty));
  assert.notEqual(
    mealEditSnapshot({ ...empty, items: meal.items, source: "photo" }),
    mealEditSnapshot(empty),
  );
});
test("item editor compares numeric meaning and preserves incomplete unsaved input", async () => {
  const { foodFields, foodEditSnapshot } = await load();
  const fields = foodFields({
    name: "Rice",
    grams: 100,
    calories: 130,
    protein: 3,
    carbs: 28,
    fat: 0.3,
  });
  const baseline = foodEditSnapshot(fields);
  assert.equal(
    foodEditSnapshot({
      ...fields,
      grams: "100.0",
      fat: "0,30",
      name: " Rice ",
    }),
    baseline,
  );
  assert.notEqual(foodEditSnapshot({ ...fields, fat: "" }), baseline);
  assert.notEqual(foodEditSnapshot({ ...fields, grams: "-" }), baseline);
  assert.notEqual(foodEditSnapshot({ ...fields, name: "Beans" }), baseline);
  assert.equal(foodEditSnapshot(foodFields()), foodEditSnapshot(foodFields()));
  assert.notEqual(
    foodEditSnapshot({ ...foodFields(), calories: "0" }),
    foodEditSnapshot(foodFields()),
  );
});
test("health score mirrors the server heuristic and stays within 1–10", async () => {
  const { healthScore, healthScoreLabel } = await load();
  const salad = { name: "სალათი", grams: 200, calories: 90, protein: 4, carbs: 10, fat: 4, fiber: 4, sugar: 3, sodium: 200 };
  const cake = { name: "ნამცხვარი", grams: 120, calories: 420, protein: 5, carbs: 60, fat: 18, fiber: 1, sugar: 40, sodium: 300 };
  assert.equal(healthScore([]), null);
  assert.ok(healthScore([salad]) >= 8);
  assert.ok(healthScore([cake]) <= 4);
  assert.equal(healthScoreLabel(9), "დაბალანსებული");
  assert.equal(healthScoreLabel(null), "");
});
test("portions scale per-100 g facts, including micronutrients when known", async () => {
  const { portionFromFood, foodTotals } = await load();
  const banana = { id: "x", name: "ბანანი", brand: "", per100: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6 }, serving: { grams: 120, label: "ერთი" }, source: "catalog", barcode: null, favorite: false };
  const item = portionFromFood(banana, 120);
  assert.deepEqual(item, { name: "ბანანი", grams: 120, calories: 106.8, protein: 1.3, carbs: 27.4, fat: 0.4, fiber: 3.1 });
  const totals = foodTotals([item, { ...item, fiber: undefined }]);
  assert.equal(totals.fiber, null, "a micronutrient total needs every item to report it");
  assert.equal(totals.calories, 214);
});
test("manual fields validate required nutrients and optional micronutrients", async () => {
  const { itemFromFields, foodFields, mealTypeForHour } = await load();
  const fields = { ...foodFields(), name: "ხაჭაპური", grams: "150", calories: "435", protein: "18", carbs: "45", fat: "19.5", fiber: "", sugar: "3", sodium: "780" };
  const ok = itemFromFields(fields);
  assert.equal(ok.error, "");
  assert.deepEqual(ok.item, { name: "ხაჭაპური", grams: 150, calories: 435, protein: 18, carbs: 45, fat: 19.5, sugar: 3, sodium: 780 });
  assert.ok(itemFromFields({ ...fields, calories: "" }).error);
  assert.ok(itemFromFields({ ...fields, sodium: "-5" }).error);
  assert.equal(mealTypeForHour(8), "breakfast");
  assert.equal(mealTypeForHour(13), "lunch");
  assert.equal(mealTypeForHour(19), "dinner");
  assert.equal(mealTypeForHour(23), "snack");
});
