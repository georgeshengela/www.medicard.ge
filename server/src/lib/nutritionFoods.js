import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { NUTRIENT_KEYS, MICRO_KEYS } from "./nutrition.js";

/** Curated Georgian and everyday foods per 100 g; composite dishes are marked as estimates. */
export const nutritionCatalog = JSON.parse(
  readFileSync(new URL("../data/nutrition-catalog.json", import.meta.url), "utf8"),
);
const per100Schema = z
  .object({
    calories: z.number().finite().min(0).max(1000),
    protein: z.number().finite().min(0).max(100),
    carbs: z.number().finite().min(0).max(100),
    fat: z.number().finite().min(0).max(100),
    fiber: z.number().finite().min(0).max(100).optional(),
    sugar: z.number().finite().min(0).max(100).optional(),
    sodium: z.number().finite().min(0).max(50000).optional(),
  })
  .strict();
export const servingSchema = z
  .object({ grams: z.number().finite().positive().max(5000), label: z.string().trim().max(60).default("") })
  .strict();
export const FOOD_SOURCES = ["custom", "photo", "barcode", "catalog", "label", "text", "meal"];
export const foodInput = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    brand: z.string().trim().max(80).default(""),
    per100: per100Schema,
    serving: servingSchema.nullable().default(null),
    source: z.enum(FOOD_SOURCES).default("custom"),
    barcode: z.string().regex(/^\d{6,14}$/).nullable().default(null),
    favorite: z.boolean().default(false),
  })
  .strict();
const round1 = (n) => Math.round(n * 10) / 10;
/** Scales per-100 g facts to one portion; unknown micronutrients stay absent. */
export function foodToItem(food, grams, name = food.name) {
  const ratio = grams / 100;
  const item = { name: (food.brand ? `${name} · ${food.brand}` : name).slice(0, 120), grams: round1(grams) };
  for (const k of NUTRIENT_KEYS) item[k] = round1((food.per100[k] || 0) * ratio);
  for (const k of MICRO_KEYS)
    if (Number.isFinite(food.per100[k])) item[k] = round1(food.per100[k] * ratio);
  return item;
}
/** One meal item (portion totals) back to per-100 g facts, so it can be saved for reuse. */
export function itemToFood(item, source = "meal") {
  const ratio = 100 / item.grams;
  const per100 = {};
  for (const k of NUTRIENT_KEYS) per100[k] = round1((item[k] || 0) * ratio);
  for (const k of MICRO_KEYS) if (Number.isFinite(item[k])) per100[k] = round1(item[k] * ratio);
  return { id: randomUUID(), name: item.name, brand: "", per100, serving: { grams: item.grams, label: "პორცია" }, source, barcode: null, favorite: false };
}
const fold = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[·,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function searchCatalog(query, limit = 12) {
  const q = fold(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ").filter(Boolean);
  return nutritionCatalog
    .map((food, index) => {
      const hay = fold([food.name, ...(food.aliases || [])].join(" "));
      const first = fold(food.name).startsWith(q) ? 2 : 0;
      const hits = tokens.filter((t) => hay.includes(t)).length;
      return { food, index, score: hits === tokens.length ? 3 + first : hits > 0 && tokens.length > 1 ? 1 : 0 };
    })
    .filter((v) => v.score > 0)
    // Ties keep catalog order, so the common form of a dish comes first.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ food }) => ({ ...food, kind: "catalog" }));
}
const OFF_HEADERS = { "User-Agent": "MedicardGE/1.0 (support@medicard.ge)", Accept: "application/json" };
const OFF_FIELDS = "code,product_name,product_name_ka,product_name_en,product_name_ru,brands,nutriments,serving_size,serving_quantity,quantity,nutriscore_grade";
/** Open Food Facts nutriments are per 100 g; sodium arrives in grams. */
export function normalizeOffProduct(p) {
  const n = p?.nutriments || {};
  const kcal = Number(n["energy-kcal_100g"] ?? (Number.isFinite(Number(n.energy_100g)) ? Number(n.energy_100g) / 4.184 : NaN));
  const name = p.product_name_ka || p.product_name || p.product_name_en || p.product_name_ru;
  if (!name || !Number.isFinite(kcal)) return null;
  const num = (k) => (Number.isFinite(Number(n[k])) ? Math.max(0, Number(n[k])) : undefined);
  const per100 = {
    calories: Math.min(1000, Math.round(kcal)),
    protein: Math.min(100, num("proteins_100g") ?? 0),
    carbs: Math.min(100, num("carbohydrates_100g") ?? 0),
    fat: Math.min(100, num("fat_100g") ?? 0),
  };
  if (num("fiber_100g") != null) per100.fiber = Math.min(100, num("fiber_100g"));
  if (num("sugars_100g") != null) per100.sugar = Math.min(100, num("sugars_100g"));
  const sodium = num("sodium_100g") != null ? num("sodium_100g") * 1000 : num("salt_100g") != null ? num("salt_100g") * 400 : undefined;
  if (sodium != null) per100.sodium = Math.min(50000, Math.round(sodium));
  const servingGrams = Number(p.serving_quantity);
  return {
    name: String(name).trim().slice(0, 120),
    brand: String(p.brands || "").split(",")[0].trim().slice(0, 80),
    per100,
    serving: Number.isFinite(servingGrams) && servingGrams > 0 && servingGrams <= 5000 ? { grams: servingGrams, label: String(p.serving_size || "ულუფა").slice(0, 60) } : null,
    barcode: String(p.code || ""),
    nutriscore: typeof p.nutriscore_grade === "string" && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : null,
    quality: "label",
    kind: "product",
    source: "openfoodfacts",
  };
}
async function offFetch(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: OFF_HEADERS, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw Object.assign(new Error("off_status_" + response.status), { status: response.status });
  return response.json();
}
/** Product facts only; the barcode is the only value that leaves the server. */
export async function lookupBarcode(code, db, fetchImpl = fetch) {
  const [cached] = await db.$queryRaw`SELECT data,"fetchedAt" FROM "NutritionProduct" WHERE barcode=${code}`;
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < 30 * 86400000) {
    await db.$executeRaw`UPDATE "NutritionProduct" SET hits=hits+1 WHERE barcode=${code}`.catch(() => {});
    return cached.data;
  }
  let product = null;
  try {
    const body = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, fetchImpl);
    if (body?.status === 1 || body?.product) product = normalizeOffProduct(body.product);
  } catch (error) {
    if (error.status !== 404) throw Object.assign(new Error("პროდუქტების ბაზა ამჟამად მიუწვდომელია. სცადე ეტიკეტის სკანი ან ხელით შეყვანა."), { status: 503 });
  }
  if (product)
    await db.$executeRaw`INSERT INTO "NutritionProduct" (barcode,data,source,hits) VALUES (${code},${JSON.stringify(product)}::jsonb,'openfoodfacts',1) ON CONFLICT (barcode) DO UPDATE SET data=EXCLUDED.data,"fetchedAt"=NOW(),hits="NutritionProduct".hits+1`.catch(() => {});
  return product;
}
export async function searchOff(query, fetchImpl = fetch, limit = 8) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}&fields=${OFF_FIELDS}`;
  const body = await offFetch(url, fetchImpl);
  return (body?.products || []).map(normalizeOffProduct).filter(Boolean);
}
const USDA_IDS = { 1008: "calories", 1003: "protein", 1005: "carbs", 1004: "fat", 1079: "fiber", 2000: "sugar", 1093: "sodium" };
export async function searchUsda(query, fetchImpl = fetch, limit = 8) {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key) return [];
  const response = await fetchImpl(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Foundation,SR%20Legacy`, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) return [];
  const body = await response.json();
  return (body?.foods || [])
    .map((f) => {
      const per100 = {};
      for (const nutrient of f.foodNutrients || []) {
        const k = USDA_IDS[nutrient.nutrientId];
        if (k && Number.isFinite(nutrient.value)) per100[k] = Math.round(nutrient.value * 10) / 10;
      }
      if (!Number.isFinite(per100.calories)) return null;
      for (const k of ["protein", "carbs", "fat"]) per100[k] = per100[k] ?? 0;
      return { name: String(f.description || "").slice(0, 120), brand: "", per100, serving: null, barcode: null, quality: "reference", kind: "usda", source: "usda" };
    })
    .filter(Boolean);
}
/** Saved-first search: the person's foods, then the curated catalog, then external products. */
export async function searchFoods(userId, query, db, fetchImpl = fetch) {
  const q = String(query || "").trim().slice(0, 80);
  if (q.length < 2) return { saved: [], catalog: [], products: [] };
  const like = "%" + q.toLowerCase().replace(/[%_]/g, "") + "%";
  const savedRows = await db.$queryRaw`SELECT * FROM "NutritionFood" WHERE "userId"=${userId} AND (lower(name) LIKE ${like} OR lower(brand) LIKE ${like}) ORDER BY favorite DESC,"lastUsedAt" DESC LIMIT 10`;
  const saved = savedRows.map((r) => ({ ...r, kind: "saved" }));
  const catalog = searchCatalog(q);
  let products = [];
  if (q.length >= 3 && env.NODE_ENV !== "test")
    products = (await Promise.allSettled([searchOff(q, fetchImpl), searchUsda(q, fetchImpl)])).flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { saved, catalog, products: products.slice(0, 12) };
}
export async function listSavedFoods(userId, db, { favorite = null, limit = 60 } = {}) {
  const rows = favorite == null
    ? await db.$queryRaw`SELECT * FROM "NutritionFood" WHERE "userId"=${userId} ORDER BY favorite DESC,"lastUsedAt" DESC LIMIT ${limit}`
    : await db.$queryRaw`SELECT * FROM "NutritionFood" WHERE "userId"=${userId} AND favorite=${favorite} ORDER BY "lastUsedAt" DESC LIMIT ${limit}`;
  return rows;
}
export async function saveFood(userId, input, db) {
  const rows = await db.$queryRaw`INSERT INTO "NutritionFood" (id,"userId",name,brand,per100,serving,source,barcode,favorite) VALUES (${input.id},${userId},${input.name},${input.brand},${JSON.stringify(input.per100)}::jsonb,${input.serving ? JSON.stringify(input.serving) : null}::jsonb,${input.source},${input.barcode},${input.favorite})
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,brand=EXCLUDED.brand,per100=EXCLUDED.per100,serving=EXCLUDED.serving,source=EXCLUDED.source,barcode=EXCLUDED.barcode,favorite=EXCLUDED.favorite,"updatedAt"=NOW() WHERE "NutritionFood"."userId"=${userId} RETURNING *`;
  return rows[0] || null;
}
export async function touchFoods(userId, ids, db) {
  if (!ids.length) return;
  await db.$executeRaw`UPDATE "NutritionFood" SET "useCount"="useCount"+1,"lastUsedAt"=NOW() WHERE "userId"=${userId} AND id = ANY(${ids}::text[])`;
}
export async function setFoodFavorite(userId, id, favorite, db) {
  return db.$executeRaw`UPDATE "NutritionFood" SET favorite=${favorite},"updatedAt"=NOW() WHERE id=${id} AND "userId"=${userId}`;
}
export async function deleteFood(userId, id, db) {
  return db.$executeRaw`DELETE FROM "NutritionFood" WHERE id=${id} AND "userId"=${userId}`;
}
/** Recent meals (for "same as yesterday") and recently used saved foods. */
export async function recentFoods(userId, db, from, to) {
  const [foods, meals] = await Promise.all([
    db.$queryRaw`SELECT * FROM "NutritionFood" WHERE "userId"=${userId} ORDER BY favorite DESC,"lastUsedAt" DESC LIMIT 20`,
    db.$queryRaw`SELECT id,date,type,title,items,source FROM "NutritionMeal" WHERE "userId"=${userId} AND date>=${from} AND date<=${to} ORDER BY date DESC,"createdAt" DESC LIMIT 40`,
  ]);
  const seen = new Set();
  const unique = meals.filter((m) => {
    const key = (m.title || m.items.map((i) => i.name).join("|")).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { foods, meals: unique.slice(0, 20) };
}
