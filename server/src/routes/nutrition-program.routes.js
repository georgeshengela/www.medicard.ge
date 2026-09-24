import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler as wrap } from "../middleware/error.js";
import { requireAdminCapability } from "../lib/adminCapabilities.js";
import { writeAdminAudit } from "../lib/adminAudit.js";
import { todayInTimeZone } from "../lib/cycle.js";
import { clientTimezoneFromReq } from "../lib/cycleCivilDate.js";
import { civilDate, totals } from "../lib/nutrition.js";
import {
  programInput,
  recipeInput,
  assessNutritionProgram,
  recipeAllowed,
  shiftCivil,
  portionRecipe,
} from "../lib/nutritionProgram.js";
import {
  nutritionDashboard,
  nutritionFacts,
  readNutritionProgram,
  programState,
  saveNutritionProgram,
  getNutritionWeek,
  generateNutritionWeek,
  eatPlannedMeal,
  swapPlannedMeal,
  nutritionError,
} from "../lib/nutritionProgramStore.js";

// Mounted only after the parent's authentication and no-cache middleware.
export const nutritionProgramRouter = Router(),
  adminNutritionProgramRouter = Router();
const r = nutritionProgramRouter,
  a = adminNutritionProgramRouter;
const today = (req) => todayInTimeZone(clientTimezoneFromReq(req) || "UTC");
const revision = z.string().uuid().nullable();
async function enabled() {
  const [s] =
    await prisma.$queryRaw`SELECT "programEnabled" FROM "NutritionSettings" WHERE id='main'`;
  if (!s?.programEnabled)
    throw nutritionError(
      "რაციონის შედგენა დროებით შეჩერებულია. კვების დღიური კვლავ ხელმისაწვდომია.",
      503,
    );
}
function weekFrom(req, raw) {
  const from = civilDate.parse(raw || today(req));
  if (from < shiftCivil(today(req), -90) || from > shiftCivil(today(req), 28))
    throw nutritionError("აირჩიე ახლო პერიოდი.");
  return from;
}
r.get(
  "/program/dashboard",
  wrap(async (req, res) =>
    res.json(await nutritionDashboard(req.user, today(req))),
  ),
);
r.post(
  "/program/preview",
  wrap(async (req, res) => {
    await enabled();
    const input = programInput.parse(req.body);
    res.json(
      assessNutritionProgram(
        input,
        await nutritionFacts(req.user, prisma, today(req)),
        today(req),
      ),
    );
  }),
);
r.put(
  "/program",
  wrap(async (req, res) => {
    await enabled();
    const input = z
      .object({ config: programInput, expectedRevision: revision })
      .strict()
      .parse(req.body);
    res.json(
      await saveNutritionProgram(
        req.user,
        input.config,
        today(req),
        input.expectedRevision,
      ),
    );
  }),
);
r.post(
  "/program/pause",
  wrap(async (req, res) => {
    const input = z
        .object({ expectedRevision: revision })
        .strict()
        .parse(req.body),
      day = today(req);
    await prisma.$transaction(async (tx) => {
      const changed =
        await tx.$executeRaw`UPDATE "NutritionProgram" SET active=FALSE,revision=${randomUUID()},"updatedAt"=NOW() WHERE "userId"=${req.user.id} AND revision=${input.expectedRevision}`;
      if (!changed)
        throw nutritionError("გეგმა შეიცვალა. განაახლე გვერდი.", 409);
      await tx.$executeRaw`INSERT INTO "NutritionTargetHistory" ("userId",date,targets) VALUES (${req.user.id},${day},NULL) ON CONFLICT ("userId",date) DO UPDATE SET targets=NULL`;
    });
    res.json({ ok: true });
  }),
);
r.get(
  "/plan",
  wrap(async (req, res) =>
    res.json(
      await getNutritionWeek(req.user.id, weekFrom(req, req.query.from)),
    ),
  ),
);
r.post(
  "/plan/generate",
  wrap(async (req, res) => {
    await enabled();
    const input = z
      .object({
        from: civilDate,
        variant: z.number().int().min(0).max(1000).default(0),
        expectedRevision: z.string().uuid(),
      })
      .strict()
      .parse(req.body);
    const from = weekFrom(req, input.from);
    if (from < today(req))
      throw nutritionError(
        "ახალი რაციონი დღევანდელი ან მომავალი დღიდან შეადგინე.",
      );
    res.json(
      await generateNutritionWeek(
        req.user,
        from,
        today(req),
        input.variant,
        input.expectedRevision,
      ),
    );
  }),
);
r.post(
  "/plan/:id/eat",
  wrap(async (req, res) =>
    res.json(
      await eatPlannedMeal(
        req.user.id,
        z.string().uuid().parse(req.params.id),
        today(req),
      ),
    ),
  ),
);
r.put(
  "/plan/:id/swap",
  wrap(async (req, res) => {
    await enabled();
    const { recipeId } = z
      .object({ recipeId: z.string().min(1).max(80) })
      .strict()
      .parse(req.body);
    res.json(
      await swapPlannedMeal(
        req.user,
        z.string().uuid().parse(req.params.id),
        recipeId,
        today(req),
      ),
    );
  }),
);
r.get(
  "/recipes",
  wrap(async (req, res) => {
    const type = z
      .enum(["breakfast", "lunch", "dinner", "snack"])
      .parse(req.query.type);
    const p = await readNutritionProgram(req.user.id);
    const state = programState(
      p,
      await nutritionFacts(req.user, prisma, today(req)),
      today(req),
    );
    if (!state.targets)
      throw nutritionError("ჯერ მოქმედი კვების გეგმა შეარჩიე.", 409);
    const rows =
      await prisma.$queryRaw`SELECT * FROM "NutritionRecipe" WHERE active=TRUE ORDER BY id`;
    const fractions = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
    res.json({
      recipes: rows
        .filter((row) => row.data.type === type && recipeAllowed(row, p.config))
        .flatMap((row) => {
          try {
            return [
              {
                id: row.id,
                ...portionRecipe(row, state.targets.calories * fractions[type]),
              },
            ];
          } catch (error) {
            if (error.status === 400) return [];
            throw error;
          }
        }),
    });
  }),
);
a.get(
  "/programs",
  wrap(async (_req, res) => {
    const [usage] =
      await prisma.$queryRaw`SELECT count(*)::int total,count(*) FILTER (WHERE active)::int active FROM "NutritionProgram"`;
    const [plans] =
      await prisma.$queryRaw`SELECT count(*)::int meals,count(DISTINCT "userId")::int users FROM "NutritionPlannedMeal"`;
    const recipes =
      await prisma.$queryRaw`SELECT * FROM "NutritionRecipe" ORDER BY id`;
    res.json({
      usage,
      plans,
      recipes: recipes.map((row) => ({
        ...row,
        totals: totals(row.data.items),
      })),
    });
  }),
);
a.put(
  "/recipes/:id",
  requireAdminCapability("NUTRITION_MANAGE"),
  wrap(async (req, res) => {
    const id = z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,80}$/)
      .parse(req.params.id);
    const input = z
      .object({ data: recipeInput, active: z.boolean() })
      .strict()
      .parse(req.body);
    const [previousValue] =
      await prisma.$queryRaw`SELECT * FROM "NutritionRecipe" WHERE id=${id}`;
    await prisma.$executeRaw`INSERT INTO "NutritionRecipe" (id,data,active) VALUES (${id},${JSON.stringify(input.data)}::jsonb,${input.active}) ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data,active=EXCLUDED.active,"updatedAt"=NOW()`;
    await writeAdminAudit({
      admin: req.admin,
      action: "NUTRITION_RECIPE",
      targetType: "NutritionRecipe",
      targetId: id,
      previousValue: previousValue || null,
      newValue: input,
    });
    res.json({ ok: true });
  }),
);
