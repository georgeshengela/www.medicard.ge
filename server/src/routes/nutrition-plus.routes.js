import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler as wrap } from "../middleware/error.js";
import { todayInTimeZone } from "../lib/cycle.js";
import { clientTimezoneFromReq } from "../lib/cycleCivilDate.js";
import { civilDate } from "../lib/nutrition.js";
import { shiftCivil } from "../lib/nutritionProgram.js";
import {
  foodInput,
  foodToItem,
  itemToFood,
  lookupBarcode,
  searchFoods,
  listSavedFoods,
  saveFood,
  touchFoods,
  setFoodFavorite,
  deleteFood,
  recentFoods,
} from "../lib/nutritionFoods.js";
import {
  ACTIVITY_KINDS,
  activityInput,
  activityKcal,
  preferenceInput,
  measurementInput,
} from "../lib/nutritionPlus.js";
import { nutritionFacts, readNutritionPreferences, nutritionError } from "../lib/nutritionProgramStore.js";
import { foodItem, totals, healthScore } from "../lib/nutrition.js";
import { recipeInput, recipeToFood, copyInput, copiedMeals } from "../lib/nutritionMore.js";

// Mounted only after the parent's authentication and no-cache middleware.
export const nutritionPlusRouter = Router();
const r = nutritionPlusRouter;
const today = (req) => todayInTimeZone(clientTimezoneFromReq(req) || "UTC");
const perUser = (limit, windowMs = 60000) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: "ძალიან ბევრი მოთხოვნაა. ცოტა ხანში სცადე ხელახლა." }),
  });

/* ---------- foods: search, saved, recent ---------- */
r.get(
  "/foods/search",
  perUser(30),
  wrap(async (req, res) => {
    const q = z.string().max(80).parse(String(req.query.q || ""));
    res.json(await searchFoods(req.user.id, q, prisma));
  }),
);
r.get(
  "/foods/recent",
  wrap(async (req, res) => {
    const day = today(req);
    res.json(await recentFoods(req.user.id, prisma, shiftCivil(day, -30), day));
  }),
);
r.get(
  "/foods",
  wrap(async (req, res) => {
    const favorite = req.query.favorite === "1" ? true : req.query.favorite === "0" ? false : null;
    res.json({ foods: await listSavedFoods(req.user.id, prisma, { favorite }) });
  }),
);
r.put(
  "/foods/:id",
  wrap(async (req, res) => {
    const input = foodInput.parse(req.body);
    if (input.id !== req.params.id) throw nutritionError("ჩანაწერის ნომერი არ ემთხვევა.");
    const [count] = await prisma.$queryRaw`SELECT count(*)::int n FROM "NutritionFood" WHERE "userId"=${req.user.id}`;
    if (count.n >= 500) throw nutritionError("შენახული საკვების ლიმიტი (500) ამოწურულია. წაშალე ძველი ჩანაწერები.");
    const row = await saveFood(req.user.id, input, prisma);
    if (!row) throw nutritionError("ჩანაწერი ვერ მოიძებნა.", 404);
    res.json({ food: row });
  }),
);
/** Save one diary item as a reusable food without logging it. */
r.post(
  "/foods/from-item",
  wrap(async (req, res) => {
    const { item, favorite } = z.object({ item: foodItem, favorite: z.boolean().default(true) }).strict().parse(req.body);
    const food = { ...itemToFood(item, "meal"), favorite };
    const row = await saveFood(req.user.id, food, prisma);
    res.json({ food: row });
  }),
);
r.patch(
  "/foods/:id",
  wrap(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { favorite } = z.object({ favorite: z.boolean() }).strict().parse(req.body);
    await setFoodFavorite(req.user.id, id, favorite, prisma);
    res.json({ ok: true });
  }),
);
r.post(
  "/foods/used",
  wrap(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).max(25) }).strict().parse(req.body);
    await touchFoods(req.user.id, ids, prisma);
    res.json({ ok: true });
  }),
);
r.delete(
  "/foods/:id",
  wrap(async (req, res) => {
    await deleteFood(req.user.id, z.string().uuid().parse(req.params.id), prisma);
    res.json({ ok: true });
  }),
);
/** Portion helper: per-100 g facts → one diary item. */
r.post(
  "/foods/portion",
  wrap(async (req, res) => {
    const { food, grams } = z
      .object({ food: foodInput.omit({ id: true, favorite: true, barcode: true, source: true }).extend({ name: z.string().trim().min(1).max(120) }), grams: z.number().finite().positive().max(10000) })
      .strict()
      .parse(req.body);
    res.json({ item: foodToItem(food, grams) });
  }),
);

/* ---------- personal recipes (stored as saved foods) ---------- */
const recipeRow = (row) => ({ ...row, kind: "saved" });
r.get(
  "/recipes",
  wrap(async (req, res) => {
    const rows = await prisma.$queryRaw`SELECT * FROM "NutritionFood" WHERE "userId"=${req.user.id} AND source='recipe' ORDER BY favorite DESC,"lastUsedAt" DESC LIMIT 200`;
    res.json({ recipes: rows.map(recipeRow) });
  }),
);
r.get(
  "/recipes/:id",
  wrap(async (req, res) => {
    const [row] = await prisma.$queryRaw`SELECT * FROM "NutritionFood" WHERE id=${z.string().uuid().parse(req.params.id)} AND "userId"=${req.user.id} AND source='recipe'`;
    if (!row) throw nutritionError("რეცეპტი ვერ მოიძებნა.", 404);
    res.json({ recipe: recipeRow(row) });
  }),
);
r.put(
  "/recipes/:id",
  wrap(async (req, res) => {
    const input = recipeInput.parse(req.body);
    if (input.id !== req.params.id) throw nutritionError("ჩანაწერის ნომერი არ ემთხვევა.");
    const food = recipeToFood(input);
    // A new recipe counts toward the saved-food cap; an edit of an existing one does not.
    const [count] = await prisma.$queryRaw`SELECT count(*)::int n, count(*) FILTER (WHERE id=${input.id})::int own FROM "NutritionFood" WHERE "userId"=${req.user.id}`;
    if (!count.own && count.n >= 500) throw nutritionError("შენახული საკვების ლიმიტი (500) ამოწურულია. წაშალე ძველი ჩანაწერები.");
    const rows = await prisma.$queryRaw`INSERT INTO "NutritionFood" (id,"userId",name,brand,per100,serving,source,barcode,favorite,recipe) VALUES (${food.id},${req.user.id},${food.name},'',${JSON.stringify(food.per100)}::jsonb,${JSON.stringify(food.serving)}::jsonb,'recipe',NULL,${food.favorite},${JSON.stringify(food.recipe)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,per100=EXCLUDED.per100,serving=EXCLUDED.serving,favorite=EXCLUDED.favorite,recipe=EXCLUDED.recipe,"updatedAt"=NOW() WHERE "NutritionFood"."userId"=${req.user.id} AND "NutritionFood".source='recipe' RETURNING *`;
    if (!rows[0]) throw nutritionError("რეცეპტი ვერ მოიძებნა.", 404);
    const t = totals(input.items);
    res.json({
      recipe: recipeRow(rows[0]),
      totals: t,
      perServing: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v == null ? null : Math.round((v / input.servings) * 10) / 10])),
      healthScore: healthScore(input.items),
    });
  }),
);

/* ---------- copy meals ---------- */
/** Repeat one meal or a whole day on another date. Client ids make a retry safe. */
r.post(
  "/meals/copy",
  wrap(async (req, res) => {
    const input = copyInput.parse(req.body);
    if (input.date > today(req)) throw nutritionError("მომავალი დღის კვება ვერ ჩაიწერება.");
    const fromIds = input.copies.map((c) => c.fromId);
    const sources = await prisma.$queryRaw`SELECT * FROM "NutritionMeal" WHERE "userId"=${req.user.id} AND id = ANY(${fromIds}::text[])`;
    const meals = copiedMeals(sources, input);
    if (!meals.length) throw nutritionError("დასაკოპირებელი კვება ვერ მოიძებნა.", 404);
    await prisma.$transaction(
      meals.map(
        (m) => prisma.$executeRaw`INSERT INTO "NutritionMeal" (id,"userId",date,type,items,note,title,source) VALUES (${m.id},${req.user.id},${m.date},${m.type},${JSON.stringify(m.items)}::jsonb,${m.note},${m.title},${m.source}) ON CONFLICT (id) DO NOTHING`,
      ),
    );
    const ids = meals.map((m) => m.id);
    const rows = await prisma.$queryRaw`SELECT * FROM "NutritionMeal" WHERE "userId"=${req.user.id} AND id = ANY(${ids}::text[])`;
    res.json({ meals: rows.map((row) => ({ ...row, totals: totals(row.items), healthScore: healthScore(row.items) })) });
  }),
);

/* ---------- barcode ---------- */
r.get(
  "/barcode/:code",
  perUser(40),
  wrap(async (req, res) => {
    const code = z.string().regex(/^\d{6,14}$/).parse(req.params.code);
    const [own] = await prisma.$queryRaw`SELECT * FROM "NutritionFood" WHERE "userId"=${req.user.id} AND barcode=${code} ORDER BY "updatedAt" DESC LIMIT 1`;
    const product = own ? { ...own, kind: "saved", quality: "label" } : await lookupBarcode(code, prisma);
    if (!product) return res.status(404).json({ error: "ეს პროდუქტი ბაზაში ვერ მოიძებნა. გადაიღე ეტიკეტი ან შეავსე ხელით — შემდეგ ჯერზე შტრიხკოდიც იმუშავებს.", code });
    res.json({ product, code });
  }),
);

/* ---------- activities ---------- */
r.get(
  "/activities",
  wrap(async (req, res) => {
    const to = civilDate.parse(String(req.query.to || today(req)));
    const from = civilDate.parse(String(req.query.from || to));
    if (to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 31) throw nutritionError("აირჩიე მაქსიმუმ 31 დღე.");
    const rows = await prisma.$queryRaw`SELECT id,date,kind,minutes,kcal,note,source FROM "NutritionActivity" WHERE "userId"=${req.user.id} AND date>=${from} AND date<=${to} ORDER BY date DESC,"createdAt" DESC LIMIT 500`;
    res.json({ activities: rows, kinds: ACTIVITY_KINDS });
  }),
);
r.put(
  "/activities/:id",
  wrap(async (req, res) => {
    const input = activityInput.parse(req.body);
    if (input.id !== req.params.id) throw nutritionError("ჩანაწერის ნომერი არ ემთხვევა.");
    if (input.date > today(req)) throw nutritionError("მომავალი დღის ვარჯიში ჯერ ვერ ჩაიწერება.");
    const facts = await nutritionFacts(req.user, prisma, today(req));
    const kcal = input.kcal ?? activityKcal(input.kind, input.minutes, facts.current?.kg);
    const rows = await prisma.$queryRaw`INSERT INTO "NutritionActivity" (id,"userId",date,kind,minutes,kcal,note,source) VALUES (${input.id},${req.user.id},${input.date},${input.kind},${input.minutes},${kcal},${input.note},'manual')
      ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date,kind=EXCLUDED.kind,minutes=EXCLUDED.minutes,kcal=EXCLUDED.kcal,note=EXCLUDED.note,"updatedAt"=NOW() WHERE "NutritionActivity"."userId"=${req.user.id} RETURNING id,date,kind,minutes,kcal,note,source`;
    if (!rows[0]) throw nutritionError("ჩანაწერი ვერ მოიძებნა.", 404);
    res.json({ activity: rows[0], estimated: input.kcal == null });
  }),
);
r.delete(
  "/activities/:id",
  wrap(async (req, res) => {
    await prisma.$executeRaw`DELETE FROM "NutritionActivity" WHERE id=${z.string().uuid().parse(req.params.id)} AND "userId"=${req.user.id}`;
    res.json({ ok: true });
  }),
);

/* ---------- preferences ---------- */
r.get(
  "/preferences",
  wrap(async (req, res) => {
    const { fasting: _fasting, ...preferences } = await readNutritionPreferences(req.user.id, prisma);
    res.json({ preferences });
  }),
);
r.put(
  "/preferences",
  wrap(async (req, res) => {
    // Older app versions send only the keys they know; newer keys keep their stored value.
    // Fasting settings belong to the fasting endpoints and are never replaced here.
    const body = z.record(z.string(), z.unknown()).parse(req.body);
    const stored = await readNutritionPreferences(req.user.id, prisma);
    const input = preferenceInput.parse({ ...stored, ...body, fasting: stored.fasting });
    await prisma.$executeRaw`INSERT INTO "NutritionPreference" ("userId",data) VALUES (${req.user.id},${JSON.stringify(input)}::jsonb) ON CONFLICT ("userId") DO UPDATE SET data=EXCLUDED.data,"updatedAt"=NOW()`;
    const { fasting: _fasting, ...publicPreferences } = input;
    res.json({ preferences: publicPreferences });
  }),
);

/* ---------- body measurements ---------- */
r.get(
  "/measurements",
  wrap(async (req, res) => {
    const rows = await prisma.$queryRaw`SELECT date,"waistCm","hipsCm","chestCm","armCm","thighCm" FROM "BodyMeasurement" WHERE "userId"=${req.user.id} ORDER BY date DESC LIMIT 120`;
    res.json({ measurements: rows });
  }),
);
r.put(
  "/measurements/:date",
  wrap(async (req, res) => {
    const date = civilDate.parse(req.params.date);
    if (date > today(req)) throw nutritionError("მომავალი თარიღი ვერ ჩაიწერება.");
    const m = measurementInput.parse(req.body);
    await prisma.$executeRaw`INSERT INTO "BodyMeasurement" ("userId",date,"waistCm","hipsCm","chestCm","armCm","thighCm") VALUES (${req.user.id},${date},${m.waistCm},${m.hipsCm},${m.chestCm},${m.armCm},${m.thighCm})
      ON CONFLICT ("userId",date) DO UPDATE SET "waistCm"=EXCLUDED."waistCm","hipsCm"=EXCLUDED."hipsCm","chestCm"=EXCLUDED."chestCm","armCm"=EXCLUDED."armCm","thighCm"=EXCLUDED."thighCm","updatedAt"=NOW()`;
    res.json({ ok: true, measurement: { date, ...m } });
  }),
);
r.delete(
  "/measurements/:date",
  wrap(async (req, res) => {
    await prisma.$executeRaw`DELETE FROM "BodyMeasurement" WHERE "userId"=${req.user.id} AND date=${civilDate.parse(req.params.date)}`;
    res.json({ ok: true });
  }),
);
