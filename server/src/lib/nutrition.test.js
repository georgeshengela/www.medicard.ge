import test from "node:test";
import assert from "node:assert/strict";
import { civilDate, mealInput, totals, parseEstimate } from "./nutrition.js";
const item = {
  name: "ბრინჯი",
  grams: 150,
  calories: 195,
  protein: 4,
  carbs: 42,
  fat: 0.4,
};
const meal = {
  id: "43c17af3-cfe0-4e69-8976-58b34b08e270",
  date: "2026-09-24",
  type: "lunch",
  items: [item],
};
test("civil dates reject rollover and timestamps", () => {
  assert.equal(civilDate.safeParse("2026-02-30").success, false);
  assert.equal(civilDate.safeParse("2024-02-29").success, true);
  assert.equal(civilDate.safeParse("2026-09-24T00:00:00Z").success, false);
});
test("meal rejects missing nutrients, negative and nonfinite values", () => {
  for (const calories of [-1, NaN, Infinity, 10001])
    assert.equal(
      mealInput.safeParse({ ...meal, items: [{ ...item, calories }] }).success,
      false,
    );
  assert.equal(
    mealInput.safeParse({ ...meal, items: [{ name: "x", grams: 1 }] }).success,
    false,
  );
});
test("meal limits portions and item counts; ignores no injected ownership", () => {
  assert.equal(
    mealInput.safeParse({ ...meal, userId: "someone-else" }).success,
    false,
  );
  assert.equal(mealInput.safeParse({ ...meal, items: [] }).success, false);
  assert.equal(
    mealInput.safeParse({ ...meal, items: Array(26).fill(item) }).success,
    false,
  );
  assert.equal(mealInput.safeParse(meal).success, true);
});
test("totals use portion values once", () =>
  assert.deepEqual(totals([item, item]), {
    calories: 390,
    protein: 8,
    carbs: 84,
    fat: 0.8,
  }));
test("AI nonfood and structured food are handled", () => {
  assert.equal(
    parseEstimate(
      JSON.stringify({
        foodDetected: false,
        items: [],
        uncertainty: "high",
        explanation: "არ არის საკვები",
      }),
    ).foodDetected,
    false,
  );
  assert.equal(
    parseEstimate(
      "```json\n" +
        JSON.stringify({
          foodDetected: true,
          items: [item],
          uncertainty: "medium",
          explanation: "პორცია სავარაუდოა",
        }) +
        "\n```",
    ).items[0].grams,
    150,
  );
});
test("AI malformed output never becomes a saved meal", () => {
  for (const v of [
    "not JSON",
    "{}",
    JSON.stringify({
      foodDetected: true,
      items: [],
      uncertainty: "low",
      explanation: "",
    }),
  ])
    assert.throws(() => parseEstimate(v), { status: 502 });
});
