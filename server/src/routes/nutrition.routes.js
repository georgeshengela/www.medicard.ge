import { nutritionProgramRouter, adminNutritionProgramRouter } from './nutrition-program.routes.js';
import { nutritionPlusRouter } from './nutrition-plus.routes.js';
import { nutritionFastingRouter } from './nutrition-fasting.routes.js';
import { Router } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import sharp from "sharp";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { saveMeal, listMeals, deleteMeal } from "../lib/nutritionStore.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { aiDailyCap } from "../lib/aiDailyCap.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { requireAdminCapability } from "../lib/adminCapabilities.js";
import { asyncHandler as wrap } from "../middleware/error.js";
import { requireAiConsent, withAiAccount } from "../lib/aiConsent.js";
import { openRouterClient } from "../lib/aiEngine.js";
import { writeAdminAudit } from "../lib/adminAudit.js";
import { todayInTimeZone } from "../lib/cycle.js";
import { clientTimezoneFromReq } from "../lib/cycleCivilDate.js";
import { nutritionEnglish } from "../lib/nutritionMessages.js";
import {
  civilDate,
  mealInput,
  totals,
  healthScore,
  parseEstimate,
  estimateRequest,
  estimateMessages,
  foodItem,
} from "../lib/nutrition.js";

export const nutritionRouter = Router(),
  adminNutritionRouter = Router();
const r = nutritionRouter,
  a = adminNutritionRouter;
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const noCache = (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 6, fieldSize: 20000 },
});
const settings = async () =>
  (
    await prisma.$queryRaw`SELECT "photoEnabled", "programEnabled" FROM "NutritionSettings" WHERE id='main'`
  )[0] || { photoEnabled: false };
const publicMeal = (row) => ({ ...row, totals: totals(row.items), healthScore: healthScore(row.items) });
const today = (req) => todayInTimeZone(clientTimezoneFromReq(req) || "UTC");
// Estimate and quick-log share one daily fuse.
const nutritionDailyCap = aiDailyCap("nutritionEstimate");
const estimateLimiter = rateLimit({
  windowMs: 60000,
  limit: 8,
  keyGenerator: (req) => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res
      .status(429)
      .json({
        error: "ძალიან ბევრი შეფასებაა მოთხოვნილი. ცოტა ხანში სცადე ხელახლა.",
      }),
});
// English requests: known Georgian copy (errors, reasons, labels, recipes, catalog foods) → English.
r.use(requireAuth, noCache, nutritionEnglish);
r.use(nutritionProgramRouter);
r.use("/fasting", nutritionFastingRouter);
r.use(nutritionPlusRouter);
r.get(
  "/settings",
  wrap(async (_req, res) => res.json(await settings())),
);
r.get(
  "/meals",
  wrap(async (req, res) => {
    const from = civilDate.parse(req.query.from),
      to = civilDate.parse(req.query.to || from);
    if (to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 31)
      fail(400, "აირჩიე მაქსიმუმ 31 დღე.");
    const rows = await listMeals(prisma, req.user.id, from, to);
    res.json({
      meals: rows.slice(0, 1000).map(publicMeal),
      truncated: rows.length > 1000,
    });
  }),
);
// A stable client UUID makes retries safe; another account can never replace a row.
r.put(
  "/meals/:id",
  wrap(async (req, res) => {
    const input = mealInput.parse(req.body);
    if (input.id !== req.params.id) fail(400, "ჩანაწერის ნომერი არ ემთხვევა.");
    const row = await saveMeal(prisma, req.user.id, input);
    if (!row) fail(404, "ჩანაწერი ვერ მოიძებნა.");
    res.json({ meal: publicMeal(row) });
  }),
);
r.delete(
  "/meals/:id",
  wrap(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await deleteMeal(prisma, req.user.id, id);
    res.json({ ok: true });
  }),
);
/** Multipart fields arrive as strings; JSON bodies arrive typed. Both map to one request shape. */
function parseEstimateRequest(body) {
  const raw = body || {};
  let previous = raw.previous ?? [];
  if (typeof previous === "string") {
    try {
      previous = JSON.parse(previous);
    } catch {
      previous = null;
    }
  }
  if (!Array.isArray(previous)) fail(400, "წინა შეფასება ვერ წავიკითხე.");
  return estimateRequest.parse({
    mode: raw.mode || "photo",
    description: raw.description || "",
    correction: raw.correction || "",
    previous,
  });
}
async function runEstimate(req, request, photoBuffer) {
  const config = await settings();
  if (!config.photoEnabled)
    fail(503, "AI შეფასება დროებით გამორთულია. ჩანაწერი ხელით დაამატე.");
  if (!openRouterClient)
    fail(503, "შეფასების სერვისი ჯერ არ არის ჩართული.");
  if ((request.mode === "photo" || request.mode === "label") && !photoBuffer)
    fail(400, request.mode === "label" ? "გადაიღე ეტიკეტის ფოტო." : "აირჩიე საკვების ფოტო.");
  if (request.mode === "text" && request.description.length < 3)
    fail(400, "აღწერე რა მიირთვი — მაგ. „ორი ხინკალი და სალათი“.");
  if (request.mode === "fix" && (!request.previous.length || request.correction.length < 2))
    fail(400, "დაწერე რა უნდა შესწორდეს.");
  let bytes = null;
  if (photoBuffer) {
    try {
      bytes = await sharp(photoBuffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      fail(400, "ფოტო ვერ გაიხსნა. აირჩიე JPEG, PNG ან HEIC ფოტო.");
    }
  }
  const started = Date.now();
  let success = false;
  try {
    // Multipart callbacks can leave the authentication AsyncLocalStorage scope.
    // Rebind the already-authenticated account; the transport still rechecks consent.
    const response = await withAiAccount(req.user.id, () => openRouterClient.chat.completions.create(
      {
        model: "google/gemini-3.8-flash",
        temperature: 0.1,
        max_tokens: 2600,
        response_format: { type: "json_object" },
        messages: estimateMessages(request, bytes ? bytes.toString("base64") : null),
      },
      { timeout: 45000, maxRetries: 0 },
    ), req.lang);
    const estimate = parseEstimate(response.choices?.[0]?.message?.content || "");
    success = true;
    return { ...estimate, mode: request.mode, totals: totals(estimate.items), healthScore: healthScore(estimate.items) };
  } catch (error) {
    // The SDK wraps fetch errors. Keep a revoked consent distinct from downtime.
    let cause = error;
    for (let depth = 0; cause && depth < 5; depth++, cause = cause.cause) {
      if (cause.code === "AI_CONSENT_REQUIRED") throw cause;
    }
    console.warn("[nutrition] estimate failed", {
      mode: request.mode,
      kind: error.status === 502 ? "invalid_output" : "provider_unavailable",
      status: Number.isInteger(error.status) ? error.status : null,
      durationMs: Date.now() - started,
    });
    if (error.status === 502) throw error;
    fail(503, "შეფასება ვერ დასრულდა. სცადე ხელახლა ან შეავსე ხელით.");
  } finally {
    bytes = null;
    await prisma.$executeRaw`INSERT INTO "NutritionScanMetric" (id,success,"durationMs") VALUES (${randomUUID()},${success},${Date.now() - started})`.catch(
      () => {},
    );
  }
}
/**
 * One endpoint, four modes: photo (dish), label (nutrition facts), text
 * (typed or dictated description, no photo) and fix (correct a previous
 * estimate). Only the chosen photo, the note and the previous estimate travel.
 */
r.post(
  "/estimate",
  requireAiConsent,
  estimateLimiter,
  nutritionDailyCap,
  upload.single("photo"),
  wrap(async (req, res) => {
    const request = parseEstimateRequest(req.body);
    const buffer = req.file?.buffer || null;
    try {
      res.json(await runEstimate(req, request, buffer));
    } finally {
      if (req.file) req.file.buffer = null;
    }
  }),
);
/** Medi and voice: describe a meal in words, estimate it and save it in one confirmed step. */
r.post(
  "/quick-log",
  requireAiConsent,
  estimateLimiter,
  nutritionDailyCap,
  wrap(async (req, res) => {
    const input = z
      .object({
        description: z.string().trim().min(3).max(500),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
        date: civilDate.optional(),
        id: z.string().uuid().optional(),
        source: z.enum(["text", "voice"]).default("text"),
      })
      .strict()
      .parse(req.body);
    const day = input.date || today(req);
    if (day > today(req)) fail(400, "მომავალი დღის კვება ვერ ჩაიწერება.");
    const estimate = await runEstimate(req, { mode: "text", description: input.description, correction: "", previous: [] }, null);
    if (!estimate.foodDetected || !estimate.items.length)
      fail(422, "აღწერიდან საკვები ვერ ამოვიცანი. სცადე უფრო კონკრეტულად, მაგ. „ერთი ხაჭაპური და ჭიქა მაწონი“.");
    const hour = Number(new Date().toLocaleString("en-US", { timeZone: clientTimezoneFromReq(req) || "UTC", hour: "numeric", hour12: false }));
    const type = input.mealType || (hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 21 ? "dinner" : "snack");
    const meal = mealInput.parse({
      id: input.id || randomUUID(),
      date: day,
      type,
      items: estimate.items.map((i) => foodItem.parse(i)),
      note: input.description,
      title: estimate.dishName || "",
      source: input.source,
    });
    const row = await saveMeal(prisma, req.user.id, meal);
    res.json({ meal: publicMeal(row), uncertainty: estimate.uncertainty, explanation: estimate.explanation });
  }),
);
a.use(requireAdmin, noCache, requireAdminCapability("NUTRITION_VIEW"));
a.use(adminNutritionProgramRouter);
a.get(
  "/overview",
  wrap(async (_req, res) => {
    const [usage] =
      await prisma.$queryRaw`SELECT count(*)::int meals,count(DISTINCT "userId")::int users,count(*) FILTER (WHERE "createdAt">NOW()-INTERVAL '7 days')::int "weekMeals" FROM "NutritionMeal"`;
    const [scans] =
      await prisma.$queryRaw`SELECT count(*)::int total,count(*) FILTER (WHERE NOT success)::int failed,COALESCE(round(avg("durationMs")),0)::int "averageMs" FROM "NutritionScanMetric" WHERE "createdAt">NOW()-INTERVAL '7 days'`;
    const [sources] =
      await prisma.$queryRaw`SELECT count(*) FILTER (WHERE source='photo')::int photo,count(*) FILTER (WHERE source='barcode')::int barcode,count(*) FILTER (WHERE source='label')::int label,count(*) FILTER (WHERE source IN ('text','voice'))::int text,count(*) FILTER (WHERE source IN ('search','saved'))::int search,count(*) FILTER (WHERE source='manual')::int manual,count(*) FILTER (WHERE source='plan')::int plan FROM "NutritionMeal" WHERE "createdAt">NOW()-INTERVAL '30 days'`.catch(() => [null]);
    const [extras] =
      await prisma.$queryRaw`SELECT (SELECT count(*)::int FROM "NutritionFood") foods,(SELECT count(*)::int FROM "NutritionProduct") products,(SELECT count(*)::int FROM "NutritionActivity") activities`.catch(() => [null]);
    res.json({ usage, scans, sources, extras, settings: await settings() });
  }),
);
a.patch(
  "/settings",
  requireAdminCapability("NUTRITION_MANAGE"),
  wrap(async (req, res) => {
    const previousValue = await settings();
    const { photoEnabled, programEnabled } = z
      .object({ photoEnabled: z.boolean(), programEnabled: z.boolean().optional() })
      .strict()
      .parse(req.body);
    await prisma.$executeRaw`UPDATE "NutritionSettings" SET "photoEnabled"=${photoEnabled},"programEnabled"=${programEnabled ?? previousValue.programEnabled},"updatedAt"=NOW() WHERE id='main'`;
    await writeAdminAudit({
      admin: req.admin,
      action: "NUTRITION_SETTINGS",
      targetType: "NutritionSettings",
      targetId: "main",
      previousValue,
      newValue: { photoEnabled, programEnabled: programEnabled ?? previousValue.programEnabled },
    });
    res.json(await settings());
  }),
);
