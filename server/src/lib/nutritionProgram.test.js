import test from "node:test";
import assert from "node:assert/strict";
import {
  assessNutritionProgram,
  buildWeek,
  recipeAllowed,
  summarizeNutritionDays,
  shoppingList,
  shiftCivil,
} from "./nutritionProgram.js";
import { defaultNutritionRecipes } from "./nutritionRecipes.js";
import { totals } from "./nutrition.js";
import { programState, publicNutritionFacts } from "./nutritionProgramStore.js";
import { nativeAction } from "./assistantExecution.js";
import { assistantContextSelection } from "./assistantFlow.js";
import {
  profileNutritionAllergies,
  nutritionMealPlanning,
} from "./nutritionAllergies.js";
export const nutritionFixture = {
  mode: "lose",
  weightKg: 90,
  heightCm: 180,
  birthDate: "1990-05-21",
  sex: "male",
  targetKg: 80,
  activity: "light",
  pace: "gentle",
  diet: "balanced",
  allergens: [],
  avoidFoods: "",
  screening: {
    pregnancyOrBreastfeeding: false,
    eatingDisorder: false,
    medicalDiet: false,
  },
};
const day = "2026-09-24";
test("environmental allergy needs clarification only for recipes, not an energy target", () => {
  const facts = profileNutritionAllergies(["სეზონური მტვერი · დემო"]);
  const pending = assessNutritionProgram(nutritionFixture, facts, day);
  assert.equal(pending.eligible, true);
  assert.equal(pending.mealPlanning.eligible, false);
  assert.match(pending.mealPlanning.reasons[0], /სეზონური მტვერი/);
  const config = {
    ...nutritionFixture,
    allergyClarifications: [
      { label: "სეზონური მტვერი · დემო", kind: "non_food", allergens: [] },
    ],
  };
  assert.equal(
    assessNutritionProgram(config, facts, day).mealPlanning.eligible,
    true,
  );
  assert.equal(
    nutritionMealPlanning(config, profileNutritionAllergies(["სხვა ალერგია"]))
      .eligible,
    false,
  );
  assert.equal(
    nutritionMealPlanning(nutritionFixture, { unknownAllergies: true })
      .eligible,
    false,
  );
  assert.equal(
    assessNutritionProgram(
      config,
      { ...facts, sensitiveRestriction: true },
      day,
    ).eligible,
    false,
  );
});
test("known food allergies cannot be deselected; unknown food must be mapped explicitly", () => {
  const facts = profileNutritionAllergies([
    "milk",
    "ნიახური",
    "მდოგვი",
    "სულფიტები",
    "ლუპინი",
    "მოლუსკები",
  ]);
  assert.equal(facts.unknownAllergies, false);
  assert.equal(facts.requiredAllergens.length, 6);
  const review = assessNutritionProgram(nutritionFixture, facts, day);
  assert.ok(review.input.allergens.includes("milk"));
  assert.equal(review.mealPlanning.eligible, true);
  assert.equal(nutritionMealPlanning(nutritionFixture, facts).eligible, false);
  assert.deepEqual(profileNutritionAllergies(["peanuts"]).requiredAllergens, [
    "peanuts",
  ]);
  assert.equal(
    profileNutritionAllergies(["milk, strawberry"]).unknownAllergies,
    true,
  );
  const unknown = profileNutritionAllergies(["unknown trigger"]);
  const answer = {
    label: "unknown trigger",
    kind: "food",
    allergens: ["eggs"],
  };
  const resolved = assessNutritionProgram(
    { ...nutritionFixture, allergyClarifications: [answer] },
    unknown,
    day,
  );
  assert.equal(resolved.mealPlanning.eligible, true);
  assert.ok(resolved.input.allergens.includes("eggs"));
  for (const a of [
    { ...answer, kind: "unsure" },
    { ...answer, allergens: [] },
  ])
    assert.equal(
      assessNutritionProgram(
        { ...nutritionFixture, allergyClarifications: [a] },
        unknown,
        day,
      ).mealPlanning.eligible,
      false,
    );
  assert.equal(
    assessNutritionProgram(
      { ...nutritionFixture, avoidFoods: "strawberry" },
      {},
      day,
    ).mealPlanning.eligible,
    false,
  );
});
test("formula and macros derive from confirmed measurements; maintain and gain are explicit", () => {
  const r = assessNutritionProgram(nutritionFixture, {}, day);
  assert.equal(r.eligible, true);
  assert.equal(r.targets.maintenance, 2540);
  assert.equal(r.targets.calories, 2290);
  assert.equal(r.targets.protein, 115);
  assert.equal(
    assessNutritionProgram(
      { ...nutritionFixture, mode: "maintain", targetKg: 90 },
      {},
      day,
    ).targets.calories,
    2540,
  );
  assert.equal(
    assessNutritionProgram(
      { ...nutritionFixture, mode: "gain", targetKg: 95 },
      {},
      day,
    ).targets.calories,
    2740,
  );
});
test("unsafe or unknown screening cannot create an automatic target", () => {
  for (const key of [
    "pregnancyOrBreastfeeding",
    "eatingDisorder",
    "medicalDiet",
  ])
    assert.equal(
      assessNutritionProgram(
        {
          ...nutritionFixture,
          screening: { ...nutritionFixture.screening, [key]: true },
        },
        {},
        day,
      ).targets,
      null,
    );
  for (const facts of [
    { birthDate: "2010-01-01" },
    { sensitiveRestriction: true },
    { medicalRestriction: true },
  ])
    assert.equal(
      assessNutritionProgram(nutritionFixture, facts, day).targets,
      null,
    );
  for (const patch of [
    { targetKg: 40 },
    { targetKg: 95 },
    { birthDate: "2011-05-01" },
    { birthDate: "1930-05-01" },
    { weightKg: 50, heightCm: 180 },
    { weightKg: 150, heightCm: 160 },
    {
      weightKg: 60,
      heightCm: 160,
      sex: "female",
      activity: "sedentary",
      targetKg: 55,
    },
  ])
    assert.equal(
      assessNutritionProgram({ ...nutritionFixture, ...patch }, {}, day)
        .eligible,
      false,
    );
  assert.throws(() =>
    assessNutritionProgram({ ...nutritionFixture, screening: {} }, {}, day),
  );
  assert.throws(() =>
    assessNutritionProgram({ ...nutritionFixture, userId: "other" }, {}, day),
  );
});
test("week respects allergies/diet and reaches energy estimate without claiming consumed food", () => {
  const config = {
    ...nutritionFixture,
    diet: "vegan",
    allergens: ["gluten", "nuts", "milk"],
  };
  const week = buildWeek(
    config,
    { calories: 2000 },
    defaultNutritionRecipes,
    day,
  );
  assert.equal(week.length, 28);
  for (const m of week) {
    assert.ok(!m.allergens.some((a) => config.allergens.includes(a)));
    assert.equal(
      defaultNutritionRecipes.find((r) => r.id === m.recipeId).data.diet,
      "vegan",
    );
  }
  for (let n = 0; n < 7; n++) {
    assert.ok(
      Math.abs(
        totals(
          week
            .filter((m) => m.date === shiftCivil(day, n))
            .flatMap((m) => m.items),
        ).calories - 2000,
      ) <= 2,
    );
  }
  assert.throws(
    () =>
      buildWeek(
        { ...config, avoidFoods: "other allergy" },
        { calories: 2000 },
        defaultNutritionRecipes,
        day,
      ),
    (e) => e.status === 422,
  );
  assert.throws(
    () => buildWeek(config, { calories: 2000 }, [], day),
    (e) => e.status === 422,
  );
  assert.equal(
    recipeAllowed({ ...defaultNutritionRecipes[0], active: false }, config),
    false,
  );
  assert.ok(shoppingList(week).length > 0);
});
test("missing days are not zero intake and historical targets retain pause", () => {
  const days = summarizeNutritionDays(
    [{ date: day, items: defaultNutritionRecipes[0].data.items }],
    shiftCivil(day, -2),
    3,
    [
      { date: "2026-01-01", targets: { calories: 2000 } },
      { date: day, targets: null },
    ],
  );
  assert.equal(days[0].recorded, false);
  assert.equal(days[2].recorded, true);
  assert.equal(days[0].target.calories, 2000);
  assert.equal(days[2].target, null);
});
test("changed goal, weight or review date suspends recommendations, protected facts stay private", () => {
  const p = {
    active: true,
    config: nutritionFixture,
    targets: { calories: 2290 },
    goalLink: { id: "g", targetKg: 80 },
    startedOn: day,
  };
  const f = { weightGoal: { id: "g", targetKg: 80 }, current: { kg: 90 } };
  assert.equal(programState(p, f, day).needsReview, false);
  for (const facts of [
    { ...f, weightGoal: { id: "g", targetKg: 79 } },
    { ...f, current: { kg: 92 } },
    { ...f, sensitiveRestriction: true },
  ])
    assert.equal(programState(p, facts, day).targets, null);
  assert.equal(programState(p, f, "2026-10-24").needsReview, true);
  assert.deepEqual(
    publicNutritionFacts({
      sensitiveRestriction: true,
      medicalRestriction: false,
      heightCm: 180,
    }),
    { heightCm: 180, professionalReviewNeeded: true },
  );
});
test("Medi goal is a reviewed native handoff, weight delta is not a target", () => {
  assert.deepEqual(
    nativeAction({ tool: "nutrition_goal", args: { loseKg: 10 } }),
    { route: "/nutrition/goal", nutritionGoal: { loseKg: 10 } },
  );
  assert.deepEqual(
    nativeAction({
      tool: "weight_goal",
      args: { targetKg: 80, startKg: 90, deadlineYmd: "2026-12-01" },
    }),
    { route: "/nutrition/goal", nutritionGoal: { targetKg: 80 } },
  );
  assert.ok(
    assistantContextSelection({
      scope: "human",
      text: "მინდა 10 კილო დავიკლო",
    }).includes("nutrition"),
  );
  assert.deepEqual(
    assistantContextSelection({ scope: "pet", text: "კალორიები" }),
    ["pets"],
  );
});

test("menu selection approximates macro targets without rewriting food nutrients", () => {
  const target = { calories: 1920, protein: 96, carbs: 240, fat: 64 };
  const week = buildWeek(
    nutritionFixture,
    target,
    defaultNutritionRecipes,
    day,
  );
  const first = totals(
    week.filter((m) => m.date === day).flatMap((m) => m.items),
  );
  for (const key of ["protein", "carbs", "fat"])
    assert.ok(Math.abs(first[key] - target[key]) / target[key] < 0.15, key);
  assert.ok(new Set(week.map((m) => m.recipeId)).size > 4);
  const invalidPortion = {
    id: "tiny-dinner",
    data: {
      ...defaultNutritionRecipes[0].data,
      type: "dinner",
      items: [
        {
          name: "too small",
          grams: 1,
          calories: 1,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
      ],
    },
  };
  const valid = buildWeek(
    nutritionFixture,
    target,
    [invalidPortion, ...defaultNutritionRecipes],
    day,
  );
  assert.equal(valid.length, 28);
  assert.ok(!valid.some((m) => m.recipeId === "tiny-dinner"));
});
