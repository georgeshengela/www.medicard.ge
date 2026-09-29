const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../src/lib/nutrition.ts");
const meal = (id, date, title = "") => ({ id, date, type: "lunch", items: [], note: "", title, source: "manual" });

test("a saved meal replaces its old copy in the cached day and new meals are appended", async () => {
  const { upsertDayMeals } = await load();
  const day = [meal("a", "2026-09-29", "old"), meal("b", "2026-09-29")];
  const next = upsertDayMeals(day, [meal("a", "2026-09-29", "new"), meal("c", "2026-09-29")], "2026-09-29");
  assert.deepEqual(next.map((m) => [m.id, m.title]), [["a", "new"], ["b", ""], ["c", ""]]);
  assert.equal(day[0].title, "old", "the cached list is never mutated");
});

test("meals saved on another day never enter this day's cached list", async () => {
  const { upsertDayMeals } = await load();
  assert.deepEqual(upsertDayMeals([], [meal("x", "2026-09-28")], "2026-09-29"), []);
});

test("a deleted meal leaves the cached day", async () => {
  const { withoutMeal } = await load();
  assert.deepEqual(withoutMeal([meal("a", "d"), meal("b", "d")], "a").map((m) => m.id), ["b"]);
});
