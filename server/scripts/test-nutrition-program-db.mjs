// Main database only. Synthetic accounts and all test mutations roll back together.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  saveNutritionProgram,
  generateNutritionWeek,
  eatPlannedMeal,
  swapPlannedMeal,
  nutritionDashboard,
  getNutritionWeek,
} from "../src/lib/nutritionProgramStore.js";
import { saveMeal, deleteMeal } from "../src/lib/nutritionStore.js";
const db = new PrismaClient(),
  rollback = new Error("EXPECTED_ROLLBACK");
let checked = 0;
const check = (condition) => {
  assert.ok(condition);
  checked++;
};
const input = {
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
try {
  await db.$transaction(
    async (tx) => {
      const proxy = new Proxy(tx, {
        get(target, key) {
          if (key === "$transaction") return async (fn) => fn(proxy);
          return Reflect.get(target, key);
        },
      });
      const a = await tx.user.create({
        data: {
          id: randomUUID(),
          email: `nutrition-plan-${randomUUID()}@example.invalid`,
          fullName: "Synthetic Nutrition QA",
          passwordHash: "not-a-login-credential",
          gender: "MALE",
          birthDate: new Date("1990-05-21"),
        },
      });
      const b = await tx.user.create({
        data: {
          id: randomUUID(),
          email: `nutrition-plan-${randomUUID()}@example.invalid`,
          fullName: "Synthetic Nutrition QA",
          passwordHash: "not-a-login-credential",
        },
      });
      const saved = await saveNutritionProgram(a, input, day, null, proxy);
      const profile = await tx.healthProfile.findUnique({
        where: { userId: a.id },
      });
      check(profile.extraAnswers.appState.weightGoal.targetKg === 80);
      check(
        (await nutritionDashboard(a, day, proxy)).targets.calories === 2290,
      );
      check((await nutritionDashboard(b, day, proxy)).program === null);
      await assert.rejects(
        () => saveNutritionProgram(a, input, day, null, proxy),
        (e) => e.status === 409,
      );
      checked++;
      const week = await generateNutritionWeek(
        a,
        day,
        day,
        0,
        saved.program.revision,
        proxy,
      );
      check(week.meals.length === 28);
      const meal = week.meals.find((m) => m.date === day);
      check((await nutritionDashboard(a, day, proxy)).today.calories === 0);
      await assert.rejects(
        () => eatPlannedMeal(b.id, meal.id, day, proxy),
        (e) => e.status === 404,
      );
      checked++;
      await assert.rejects(
        () => swapPlannedMeal(b, meal.id, meal.recipeId, day, proxy),
        (e) => e.status === 404,
      );
      checked++;
      await assert.rejects(
        () =>
          eatPlannedMeal(
            a.id,
            week.meals.find((m) => m.date > day).id,
            day,
            proxy,
          ),
        (e) => e.status === 400,
      );
      checked++;
      await eatPlannedMeal(a.id, meal.id, day, proxy);
      await eatPlannedMeal(a.id, meal.id, day, proxy);
      check((await nutritionDashboard(a, day, proxy)).mealCount === 1);
      await saveMeal(tx, a.id, {
        id: meal.id,
        date: day,
        type: meal.type,
        items: [
          {
            name: "QA portion correction",
            grams: 100,
            calories: 99,
            protein: 3,
            carbs: 15,
            fat: 3,
          },
        ],
        note: "test",
        source: "plan",
      });
      await eatPlannedMeal(a.id, meal.id, day, proxy);
      check((await nutritionDashboard(a, day, proxy)).today.calories === 99);
      await generateNutritionWeek(
        a,
        day,
        day,
        1,
        saved.program.revision,
        proxy,
      );
      check(
        (await getNutritionWeek(a.id, day, proxy)).meals.find(
          (m) => m.id === meal.id,
        ).recipeId === meal.recipeId,
      );
      await assert.rejects(
        () => swapPlannedMeal(a, meal.id, meal.recipeId, day, proxy),
        (e) => e.status === 409,
      );
      checked++;
      const other = week.meals.find((m) => m.date === day && m.id !== meal.id);
      await assert.rejects(
        () => swapPlannedMeal(a, other.id, "not-a-recipe", day, proxy),
        (e) => e.status === 400,
      );
      checked++;
      await deleteMeal(tx, a.id, meal.id);
      check(
        !(await getNutritionWeek(a.id, day, proxy)).meals.find(
          (m) => m.id === meal.id,
        ).eaten,
      );
      const revised = await saveNutritionProgram(
        a,
        { ...input, weightKg: 89 },
        day,
        saved.program.revision,
        proxy,
      );
      check(revised.goal.startKg === 90);
      check((await nutritionDashboard(a, day, proxy)).facts.current.kg === 89);
      throw rollback;
    },
    { timeout: 60000 },
  );
} catch (e) {
  if (e !== rollback) throw e;
  console.log(
    `${checked} nutrition program DB checks passed; every synthetic row rolled back.`,
  );
} finally {
  await db.$disconnect();
}
