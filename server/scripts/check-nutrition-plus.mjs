// Read-mostly smoke check of the Cal AI parity layer against the configured main
// database, using only the retained synthetic QA account. Writes: one shared,
// non-personal barcode cache row. Never touches a real person's rows.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { nutritionDashboard } from "../src/lib/nutritionProgramStore.js";
import { searchFoods, lookupBarcode } from "../src/lib/nutritionFoods.js";

const email = process.env.NUTRITION_QA_EMAIL || "nutrition.qa.20260924@medicard.test";
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`synthetic account ${email} not found`);
  const today = new Date().toISOString().slice(0, 10);
  const d = await nutritionDashboard(user, today);
  console.log("dashboard", {
    date: d.date,
    targets: d.targets?.calories ?? null,
    budget: d.budget,
    rollover: d.rollover,
    burned: d.burned,
    streak: d.streak,
    week: d.week,
    water: d.water,
    steps: d.steps,
    projection: d.projection,
    preferences: d.preferences,
    measurements: d.measurements.length,
    todayMeals: d.todayMeals.length,
  });
  const search = await searchFoods(user.id, "ხაჭაპური", prisma);
  console.log("search", { saved: search.saved.length, catalog: search.catalog.map((f) => f.id), products: search.products.length });
  const product = await lookupBarcode("5449000000996", prisma);
  console.log("barcode", product ? { name: product.name, brand: product.brand, per100: product.per100, serving: product.serving } : null);
} finally {
  await prisma.$disconnect();
}
