import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler as wrap } from "../middleware/error.js";
import { todayInTimeZone } from "../lib/cycle.js";
import { clientTimezoneFromReq } from "../lib/cycleCivilDate.js";
import { nutritionFacts, readNutritionPreferences, readNutritionProgram, nutritionError } from "../lib/nutritionProgramStore.js";
import { preferenceInput } from "../lib/nutritionPlus.js";
import {
  fastingEligibility,
  fastingScreeningInput,
  fastingSettingsInput,
  fastStartInput,
  fastEditInput,
  fastTimesProblem,
  fastingStats,
  publicFast,
} from "../lib/nutritionMore.js";

// Mounted at /api/nutrition/fasting after the parent's authentication and no-cache middleware.
export const nutritionFastingRouter = Router();
const r = nutritionFastingRouter;
const zone = (req) => clientTimezoneFromReq(req) || "UTC";
const uuid = z.string().uuid();

async function savePreferences(userId, preferences) {
  const input = preferenceInput.parse(preferences);
  await prisma.$executeRaw`INSERT INTO "NutritionPreference" ("userId",data) VALUES (${userId},${JSON.stringify(input)}::jsonb) ON CONFLICT ("userId") DO UPDATE SET data=EXCLUDED.data,"updatedAt"=NOW()`;
  return input;
}
async function fastingState(req) {
  const day = todayInTimeZone(zone(req));
  const [facts, program, preferences, rows] = await Promise.all([
    nutritionFacts(req.user, prisma, day),
    readNutritionProgram(req.user.id, prisma),
    readNutritionPreferences(req.user.id, prisma),
    prisma.$queryRaw`SELECT * FROM "NutritionFast" WHERE "userId"=${req.user.id} ORDER BY "startedAt" DESC LIMIT 120`,
  ]);
  const settings = preferences.fasting;
  const eligibility = fastingEligibility({ facts, screening: settings.screening, programConfig: program?.config, today: day });
  return { preferences, settings, eligibility, rows };
}
function respond(state) {
  const active = state.rows.find((f) => !f.endedAt);
  return {
    eligibility: state.eligibility,
    settings: { protocol: state.settings.protocol, targetMinutes: state.settings.targetMinutes, notify: state.settings.notify, screened: !!state.settings.screening },
    screening: state.settings.screening,
    active: active ? publicFast(active) : null,
    history: state.rows.filter((f) => f.endedAt).slice(0, 30).map((f) => publicFast(f)),
  };
}

r.get(
  "/",
  wrap(async (req, res) => {
    const state = await fastingState(req);
    res.json({ ...respond(state), stats: fastingStats(state.rows, zone(req)) });
  }),
);
/** The short safety check is answered by the person before the timer is offered. */
r.put(
  "/screening",
  wrap(async (req, res) => {
    const answers = fastingScreeningInput.parse(req.body);
    const state = await fastingState(req);
    const fasting = { ...state.settings, screening: { ...answers, answeredAt: new Date().toISOString() } };
    await savePreferences(req.user.id, { ...state.preferences, fasting });
    const next = await fastingState(req);
    res.json({ ...respond(next), stats: fastingStats(next.rows, zone(req)) });
  }),
);
r.put(
  "/settings",
  wrap(async (req, res) => {
    const input = fastingSettingsInput.parse(req.body);
    const state = await fastingState(req);
    await savePreferences(req.user.id, { ...state.preferences, fasting: { ...state.settings, ...input } });
    res.json({ settings: { ...input, screened: !!state.settings.screening } });
  }),
);
r.post(
  "/start",
  wrap(async (req, res) => {
    const input = fastStartInput.parse(req.body);
    const state = await fastingState(req);
    const [existing] = await prisma.$queryRaw`SELECT * FROM "NutritionFast" WHERE id=${input.id} AND "userId"=${req.user.id}`;
    // A retried start returns the fast it already created.
    if (existing) return res.json({ fast: publicFast(existing) });
    if (!state.eligibility.eligible)
      throw nutritionError(state.eligibility.reasons[0] || (state.eligibility.needsScreening ? "ჯერ უპასუხე უსაფრთხოების მოკლე კითხვებს." : "ამ ეტაპზე შიმშილის ტაიმერი ექიმთან შეთანხმების გარეშე არ ირთვება."), 403);
    if (state.rows.some((f) => !f.endedAt)) throw nutritionError("შიმშილი უკვე მიმდინარეობს. ჯერ დაასრულე ის.", 409);
    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    if (Date.now() - startedAt.getTime() > 24 * 3600000) throw nutritionError("დაწყება 24 საათზე ძველი ვერ იქნება.");
    const problem = fastTimesProblem(startedAt.toISOString(), null);
    if (problem) throw nutritionError(problem);
    try {
      const [row] = await prisma.$queryRaw`INSERT INTO "NutritionFast" (id,"userId","startedAt","targetMinutes",protocol) VALUES (${input.id},${req.user.id},${startedAt},${input.targetMinutes},${input.protocol}) RETURNING *`;
      res.json({ fast: publicFast(row) });
    } catch (error) {
      // The partial unique index allows one open fast per account.
      if (/NutritionFast_one_open_idx|23505/.test(String(error?.message || "")))
        throw nutritionError("შიმშილი უკვე მიმდინარეობს. ჯერ დაასრულე ის.", 409);
      throw error;
    }
  }),
);
r.post(
  "/:id/end",
  wrap(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { endedAt } = z.object({ endedAt: z.string().datetime({ offset: true }).optional() }).strict().parse(req.body || {});
    const [row] = await prisma.$queryRaw`SELECT * FROM "NutritionFast" WHERE id=${id} AND "userId"=${req.user.id}`;
    if (!row) throw nutritionError("ჩანაწერი ვერ მოიძებნა.", 404);
    if (row.endedAt) return res.json({ fast: publicFast(row) });
    const end = endedAt ? new Date(endedAt) : new Date();
    const problem = fastTimesProblem(new Date(row.startedAt).toISOString(), end.toISOString());
    if (problem) throw nutritionError(problem);
    const [saved] = await prisma.$queryRaw`UPDATE "NutritionFast" SET "endedAt"=${end},"updatedAt"=NOW() WHERE id=${id} AND "userId"=${req.user.id} RETURNING *`;
    res.json({ fast: publicFast(saved) });
  }),
);
r.put(
  "/:id",
  wrap(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const input = fastEditInput.parse(req.body);
    const problem = fastTimesProblem(input.startedAt, input.endedAt);
    if (problem) throw nutritionError(problem);
    const [row] = await prisma.$queryRaw`SELECT * FROM "NutritionFast" WHERE id=${id} AND "userId"=${req.user.id}`;
    if (!row) throw nutritionError("ჩანაწერი ვერ მოიძებნა.", 404);
    // An open fast cannot be reopened after it ended, and a finished one cannot be emptied.
    if (row.endedAt && input.endedAt == null) throw nutritionError("დასრულებული შიმშილისთვის მიუთითე დასრულების დრო.");
    const [saved] = await prisma.$queryRaw`UPDATE "NutritionFast" SET "startedAt"=${new Date(input.startedAt)},"endedAt"=${input.endedAt ? new Date(input.endedAt) : null},"targetMinutes"=${input.targetMinutes},note=${input.note},"updatedAt"=NOW() WHERE id=${id} AND "userId"=${req.user.id} RETURNING *`;
    res.json({ fast: publicFast(saved) });
  }),
);
r.delete(
  "/:id",
  wrap(async (req, res) => {
    await prisma.$executeRaw`DELETE FROM "NutritionFast" WHERE id=${uuid.parse(req.params.id)} AND "userId"=${req.user.id}`;
    res.json({ ok: true });
  }),
);
