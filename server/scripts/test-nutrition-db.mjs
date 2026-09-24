// Explicit integration test on configured MAIN database. All synthetic rows roll back.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { saveMeal, listMeals, deleteMeal } from "../src/lib/nutritionStore.js";
const db = new PrismaClient(),
  rollback = new Error("EXPECTED_TEST_ROLLBACK");
let checked = 0;
try {
  await db.$transaction(
    async (tx) => {
      const a = randomUUID(),
        b = randomUUID();
      for (const id of [a, b])
        await tx.user.create({
          data: {
            id,
            email: `nutrition-${id}@example.invalid`,
            fullName: "Synthetic Nutrition QA",
            passwordHash: "not-a-login-credential",
          },
        });
      const meal = {
        id: randomUUID(),
        date: "2026-09-24",
        type: "lunch",
        items: [
          {
            name: "Synthetic rice",
            grams: 100,
            calories: 130,
            protein: 3,
            carbs: 28,
            fat: 0.3,
          },
        ],
        note: "QA — rolls back",
        source: "manual",
      };
      await saveMeal(tx, a, meal);
      await saveMeal(tx, a, meal);
      assert.equal((await listMeals(tx, a, meal.date, meal.date)).length, 1);
      checked++;
      assert.equal((await listMeals(tx, b, meal.date, meal.date)).length, 0);
      checked++;
      assert.equal(await saveMeal(tx, b, meal), null);
      checked++;
      assert.equal(await deleteMeal(tx, b, meal.id), 0);
      checked++;
      await saveMeal(tx, a, {
        ...meal,
        items: [{ ...meal.items[0], calories: 140 }],
      });
      assert.equal(
        (await listMeals(tx, a, meal.date, meal.date))[0].items[0].calories,
        140,
      );
      checked++;
      assert.equal(
        (await listMeals(tx, a, "2026-09-23", "2026-09-23")).length,
        0,
      );
      checked++;
      assert.equal(await deleteMeal(tx, a, meal.id), 1);
      checked++;
      await saveMeal(tx, a, meal);
      await tx.user.delete({ where: { id: a } });
      assert.equal((await listMeals(tx, a, meal.date, meal.date)).length, 0);
      checked++;
      throw rollback;
    },
    { timeout: 45000 },
  );
} catch (error) {
  if (error !== rollback) throw error;
  console.log(
    `${checked} nutrition DB checks passed; all test rows rolled back.`,
  );
} finally {
  await db.$disconnect();
}
