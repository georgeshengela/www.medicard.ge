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
    { calories: 130, protein: 3, carbs: 28, fat: 0.3 },
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
