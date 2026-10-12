import test from "node:test";
import assert from "node:assert/strict";
import {
  assessNutritionProgram,
  CALORIE_FLOOR,
  LOSE_NO_ROOM_REASON,
  buildWeek,
  recipeAllowed,
  summarizeNutritionDays,
  shoppingList,
  shiftCivil,
} from "./nutritionProgram.js";
import { defaultNutritionRecipes } from "./nutritionRecipes.js";
import { totals } from "./nutrition.js";
import { programState, publicNutritionFacts, PROGRAM_REVIEW_NOTE } from "./nutritionProgramStore.js";
import { nativeAction } from "./assistantExecution.js";
import { estimateDailyTarget, CALORIE_FLOOR as APP_FLOOR } from "../../../mobile/src/lib/nutritionTarget.js";
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
    { birthDate: "2008-09-25" },
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
const woman = {
  ...nutritionFixture,
  sex: "female",
  weightKg: 60,
  heightCm: 160,
  targetKg: 55,
  activity: "sedentary",
};
test("women of average height get a target: 1 200 floor, a slower pace instead of a refusal", () => {
  const gentle = assessNutritionProgram(woman, {}, day);
  assert.equal(gentle.eligible, true);
  assert.equal(gentle.targets.calories, 1260);
  assert.equal(gentle.targets.paceLimited, false);
  const steady = assessNutritionProgram({ ...woman, pace: "steady" }, {}, day);
  assert.equal(steady.eligible, true);
  assert.equal(steady.targets.calories, 1200);
  assert.equal(steady.targets.paceLimited, true);
  assert.ok(steady.targets.weeklyKg < 0 && steady.targets.weeklyKg > -0.4);
  // Men keep the 1 500 floor.
  assert.equal(CALORIE_FLOOR.male, 1500);
  const man = assessNutritionProgram(
    { ...nutritionFixture, weightKg: 62, heightCm: 168, targetKg: 58, activity: "sedentary", pace: "steady" },
    {},
    day,
  );
  assert.ok(!man.eligible || man.targets.calories >= 1500);
});
test("no room to lose offers keeping the weight; health screening refusals offer nothing", () => {
  const small = { ...woman, weightKg: 48, heightCm: 152, targetKg: 46, birthDate: "1956-01-01" };
  const r = assessNutritionProgram(small, {}, day);
  assert.equal(r.eligible, false);
  assert.deepEqual(r.reasons, [LOSE_NO_ROOM_REASON]);
  assert.equal(r.fallback.mode, "maintain");
  assert.ok(r.fallback.calories >= 1200);
  const keep = assessNutritionProgram({ ...small, mode: "maintain", targetKg: 48 }, {}, day);
  assert.equal(keep.eligible, true);
  assert.equal(keep.targets.calories, 1200);
  const screened = assessNutritionProgram(
    { ...small, screening: { ...small.screening, eatingDisorder: true } },
    {},
    day,
  );
  assert.equal(screened.fallback, null);
});
test("the wizard's live estimate (mobile nutritionTarget.js) gives the server's numbers", () => {
  assert.deepEqual(APP_FLOOR, CALORIE_FLOOR);
  for (const sex of ["female", "male"])
    for (const activity of ["sedentary", "light", "moderate", "active"])
      for (const [mode, pace] of [["lose", "gentle"], ["lose", "steady"], ["maintain", "gentle"], ["gain", "gentle"]])
        for (const [weightKg, heightCm] of [[48, 152], [60, 160], [70, 165], [85, 178], [110, 185]]) {
          const targetKg = mode === "lose" ? weightKg - 3 : mode === "gain" ? weightKg + 3 : weightKg;
          const server = assessNutritionProgram({ ...nutritionFixture, sex, activity, mode, pace, weightKg, heightCm, targetKg, birthDate: "1980-01-01" }, {}, day);
          const app = estimateDailyTarget({ sex, activity, mode, pace, weightKg, heightCm, age: 46 });
          const label = `${sex} ${activity} ${mode}/${pace} ${weightKg}/${heightCm}`;
          if (server.targets) {
            assert.equal(app.calories, server.targets.calories, label);
            assert.equal(app.paceLimited, server.targets.paceLimited, label);
            assert.equal(app.weeklyKg, server.targets.weeklyKg, label);
          } else if (server.fallback) assert.equal(app.noRoom, true, label);
        }
});
test("accounts are 18+: an 18-year-old gets a target", () => {
  assert.equal(assessNutritionProgram({ ...nutritionFixture, birthDate: "2008-09-24" }, {}, day).eligible, true);
});
test("a new weight or goal recalculates the target instead of switching it off", () => {
  const p = {
    active: true,
    config: nutritionFixture,
    targets: { calories: 2290 },
    goalLink: { id: "g", targetKg: 80 },
    startedOn: day,
  };
  const f = { weightGoal: { id: "g", targetKg: 80 }, current: { kg: 90 } };
  const same = programState(p, f, day);
  assert.equal(same.needsReview, false);
  assert.equal(same.adjusted, null);
  assert.equal(same.targets.calories, 2290);
  const lighter = programState(p, { ...f, current: { kg: 86 } }, day);
  assert.equal(lighter.needsReview, false);
  assert.equal(lighter.adjusted, "weight");
  assert.ok(lighter.targets.calories < 2290);
  assert.equal(lighter.currentConfig.weightKg, 86);
  const newGoal = programState(p, { ...f, weightGoal: { id: "g", targetKg: 75 } }, day);
  assert.equal(newGoal.adjusted, "goal");
  assert.equal(newGoal.currentConfig.targetKg, 75);
  const reached = programState(p, { ...f, current: { kg: 79.5 } }, day);
  assert.equal(reached.adjusted, "goal_reached");
  assert.equal(reached.currentConfig.mode, "maintain");
  assert.ok(reached.targets.calories >= reached.targets.maintenance);
  assert.equal(programState(p, { ...f, sensitiveRestriction: true }, day).targets, null);
  const later = programState(p, f, "2026-10-24");
  assert.equal(later.needsReview, false);
  assert.equal(later.reviewNote, PROGRAM_REVIEW_NOTE);
  assert.equal(later.targets.calories, 2290);
  assert.deepEqual(
    publicNutritionFacts({
      sensitiveRestriction: true,
      medicalRestriction: false,
      heightCm: 180,
    }),
    { heightCm: 180, professionalReviewNeeded: true },
  );
});
test("Medi's food log opens the diary review on capable apps; older apps keep the one-step save", () => {
  const plan = { tool: "nutrition_log", args: { description: "ორი ხინკალი", mealType: "lunch" } };
  assert.equal(nativeAction(plan), null);
  assert.equal(nativeAction(plan, "weekly-medi"), null);
  assert.deepEqual(nativeAction(plan, "weekly-medi, nutrition-review"), {
    route: "/nutrition/diary",
    nutritionLog: { description: "ორი ხინკალი", mealType: "lunch" },
  });
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
