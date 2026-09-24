// Additive only; uses the existing configured main database. Never resets data.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { defaultNutritionRecipes } from "../src/lib/nutritionRecipes.js";
const db = new PrismaClient();
try {
  for (const file of [
    "20260924-nutrition.sql",
    "20260924-nutrition-program.sql",
  ]) {
    const sql = readFileSync(
      new URL("../prisma/" + file, import.meta.url),
      "utf8",
    );
    const statements = sql
      .split(/;\s*(?=\r?\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s && s !== "BEGIN" && s !== "COMMIT");
    await db.$transaction(
      async (tx) => {
        for (const s of statements) await tx.$executeRawUnsafe(s);
      },
      { timeout: 60000 },
    );
  }
  for (const recipe of defaultNutritionRecipes)
    await db.$executeRaw`INSERT INTO "NutritionRecipe" (id,data) VALUES (${recipe.id},${JSON.stringify(recipe.data)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  console.log(
    "Nutrition schema and recipe catalog ready. Existing records preserved.",
  );
} finally {
  await db.$disconnect();
}
