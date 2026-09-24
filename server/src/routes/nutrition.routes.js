import { Router } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import sharp from "sharp";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { saveMeal, listMeals, deleteMeal } from "../lib/nutritionStore.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { requireAdminCapability } from "../lib/adminCapabilities.js";
import { asyncHandler as wrap } from "../middleware/error.js";
import { requireAiConsent } from "../lib/aiConsent.js";
import { openRouterClient } from "../lib/aiEngine.js";
import { writeAdminAudit } from "../lib/adminAudit.js";
import {
  civilDate,
  mealInput,
  totals,
  parseEstimate,
  NUTRITION_PROMPT,
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
  limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 1, fieldSize: 2000 },
});
const settings = async () =>
  (
    await prisma.$queryRaw`SELECT "photoEnabled" FROM "NutritionSettings" WHERE id='main'`
  )[0] || { photoEnabled: false };
const publicMeal = (row) => ({ ...row, totals: totals(row.items) });
r.use(requireAuth, noCache);
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
r.post(
  "/estimate",
  requireAiConsent,
  rateLimit({
    windowMs: 60000,
    limit: 6,
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json({
          error: "ძალიან ბევრი შეფასებაა მოთხოვნილი. ცოტა ხანში სცადე ხელახლა.",
        }),
  }),
  upload.single("photo"),
  wrap(async (req, res) => {
    if (!(await settings()).photoEnabled)
      fail(503, "ფოტოს შეფასება დროებით გამორთულია. ჩანაწერი ხელით დაამატე.");
    if (!req.file) fail(400, "აირჩიე საკვების ფოტო.");
    if (!openRouterClient)
      fail(503, "ფოტოს შეფასების სერვისი ჯერ არ არის ჩართული.");
    const description = z
      .string()
      .max(500)
      .parse(req.body.description || "");
    let bytes;
    try {
      bytes = await sharp(req.file.buffer, { limitInputPixels: 25000000 })
        .rotate()
        .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      fail(400, "ფოტო ვერ გაიხსნა. აირჩიე JPEG, PNG ან HEIC ფოტო.");
    }
    const started = Date.now();
    let success = false;
    try {
      const response = await openRouterClient.chat.completions.create(
        {
          model: "google/gemini-3.8-flash",
          temperature: 0.1,
          max_tokens: 2200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: NUTRITION_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: description || "შეაფასე საკვები და პორცია.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: "data:image/jpeg;base64," + bytes.toString("base64"),
                  },
                },
              ],
            },
          ],
        },
        { timeout: 45000, maxRetries: 0 },
      );
      const estimate = parseEstimate(
        response.choices?.[0]?.message?.content || "",
      );
      success = true;
      res.json({ ...estimate, totals: totals(estimate.items) });
    } catch (error) {
      if (error.code === "AI_CONSENT_REQUIRED" || error.status === 502)
        throw error;
      fail(503, "შეფასება ვერ დასრულდა. სცადე ხელახლა ან შეავსე ხელით.");
    } finally {
      bytes = null;
      req.file.buffer = null;
      await prisma.$executeRaw`INSERT INTO "NutritionScanMetric" (id,success,"durationMs") VALUES (${randomUUID()},${success},${Date.now() - started})`.catch(
        () => {},
      );
    }
  }),
);
a.use(requireAdmin, noCache, requireAdminCapability("NUTRITION_VIEW"));
a.get(
  "/overview",
  wrap(async (_req, res) => {
    const [usage] =
      await prisma.$queryRaw`SELECT count(*)::int meals,count(DISTINCT "userId")::int users,count(*) FILTER (WHERE "createdAt">NOW()-INTERVAL '7 days')::int "weekMeals" FROM "NutritionMeal"`;
    const [scans] =
      await prisma.$queryRaw`SELECT count(*)::int total,count(*) FILTER (WHERE NOT success)::int failed,COALESCE(round(avg("durationMs")),0)::int "averageMs" FROM "NutritionScanMetric" WHERE "createdAt">NOW()-INTERVAL '7 days'`;
    res.json({ usage, scans, settings: await settings() });
  }),
);
a.patch(
  "/settings",
  requireAdminCapability("NUTRITION_MANAGE"),
  wrap(async (req, res) => {
    const previousValue = await settings();
    const { photoEnabled } = z
      .object({ photoEnabled: z.boolean() })
      .strict()
      .parse(req.body);
    await prisma.$executeRaw`UPDATE "NutritionSettings" SET "photoEnabled"=${photoEnabled},"updatedAt"=NOW() WHERE id='main'`;
    await writeAdminAudit({
      admin: req.admin,
      action: "NUTRITION_SETTINGS",
      targetType: "NutritionSettings",
      targetId: "main",
      previousValue,
      newValue: { photoEnabled },
    });
    res.json(await settings());
  }),
);
