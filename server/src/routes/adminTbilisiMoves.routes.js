import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability, requireAnyAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { RATE_LIMIT_VALIDATE } from '../lib/rateLimitKey.js';
import { adminConfigView, adminDistrictsView, adminOverview, adminRoundDetail, adminRounds } from '../lib/tbilisiMoves/admin.js';
import { patchConfig } from '../lib/tbilisiMoves/config.js';
import { isTbilisiMovesSchemaMissing, schemaUnavailable } from '../lib/tbilisiMoves/errors.js';
import { finalizeRound, previewFinalize } from '../lib/tbilisiMoves/finalize.js';
import { archiveDistrict, patchDistrict } from '../lib/tbilisiMoves/membership.js';
import { listCredits, listIssuedAwards, listObservations, setCreditExclusion } from '../lib/tbilisiMoves/moderate.js';
import {
  adminListQuerySchema,
  configPatchSchema,
  correctBodySchema,
  districtPatchSchema,
  finalizeBodySchema,
  reasonBodySchema,
} from '../lib/tbilisiMoves/schema.js';
import { assertYmd } from '../lib/tbilisiMoves/time.js';

export const adminTbilisiMovesRouter = Router();
adminTbilisiMovesRouter.use(requireAdmin);

const mutateLimiter = rateLimit({
  windowMs: 60_000,
  limit: process.env.NODE_ENV === 'test' ? 2000 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  validate: RATE_LIMIT_VALIDATE,
  message: { error: 'ძალიან ბევრი მოთხოვნა.', code: 'RATE_LIMITED' },
});

function wrap(fn) {
  return asyncHandler(async (req, res) => {
    try {
      return await fn(req, res);
    } catch (error) {
      if (isTbilisiMovesSchemaMissing(error)) throw schemaUnavailable();
      throw error;
    }
  });
}

function boolQuery(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

adminTbilisiMovesRouter.get(
  '/overview',
  requireAdminCapability('TBILISI_MOVES_VIEW'),
  wrap(async (_req, res) => {
    res.json(await adminOverview());
  }),
);

adminTbilisiMovesRouter.get(
  '/config',
  requireAdminCapability('TBILISI_MOVES_VIEW'),
  wrap(async (_req, res) => {
    res.json(await adminConfigView());
  }),
);

adminTbilisiMovesRouter.patch(
  '/config',
  mutateLimiter,
  requireAdminCapability('TBILISI_MOVES_MANAGE'),
  wrap(async (req, res) => {
    const body = configPatchSchema.parse(req.body);
    res.json(await patchConfig({ admin: req.admin, body }));
  }),
);

adminTbilisiMovesRouter.get(
  '/districts',
  requireAdminCapability('TBILISI_MOVES_VIEW'),
  wrap(async (_req, res) => {
    res.json(await adminDistrictsView());
  }),
);

adminTbilisiMovesRouter.patch(
  '/districts/:id',
  mutateLimiter,
  requireAdminCapability('TBILISI_MOVES_MANAGE'),
  wrap(async (req, res) => {
    const body = districtPatchSchema.parse(req.body);
    res.json({
      district: await patchDistrict({
        admin: req.admin,
        districtId: req.params.id,
        body,
      }),
    });
  }),
);

adminTbilisiMovesRouter.post(
  '/districts/:id/archive',
  mutateLimiter,
  requireAdminCapability('TBILISI_MOVES_MANAGE'),
  wrap(async (req, res) => {
    const body = districtPatchSchema.parse({
      revision: req.body?.revision,
      status: 'ARCHIVED',
      reason: req.body?.reason,
    });
    res.json({
      district: await archiveDistrict({
        admin: req.admin,
        districtId: req.params.id,
        reason: body.reason,
        revision: body.revision,
      }),
    });
  }),
);

adminTbilisiMovesRouter.get(
  '/rounds',
  requireAdminCapability('TBILISI_MOVES_VIEW'),
  wrap(async (req, res) => {
    const query = adminListQuerySchema.parse(req.query);
    res.json(await adminRounds({ limit: query.limit, before: query.date }));
  }),
);

adminTbilisiMovesRouter.get(
  '/rounds/:date',
  requireAdminCapability('TBILISI_MOVES_VIEW'),
  wrap(async (req, res) => {
    res.json(await adminRoundDetail(assertYmd(req.params.date)));
  }),
);

adminTbilisiMovesRouter.post(
  '/rounds/:date/finalize/preview',
  requireAnyAdminCapability('TBILISI_MOVES_VIEW', 'TBILISI_MOVES_MANAGE'),
  wrap(async (req, res) => {
    res.json(await previewFinalize({ date: assertYmd(req.params.date) }));
  }),
);

adminTbilisiMovesRouter.post(
  '/rounds/:date/finalize',
  mutateLimiter,
  requireAdminCapability('TBILISI_MOVES_MANAGE'),
  wrap(async (req, res) => {
    const body = finalizeBodySchema.parse(req.body);
    res.json(
      await finalizeRound({
        date: assertYmd(req.params.date),
        kind: 'INITIAL',
        previewHash: body.previewHash,
        expectedRevision: body.revision,
        admin: req.admin,
        actor: 'admin',
      }),
    );
  }),
);

adminTbilisiMovesRouter.post(
  '/rounds/:date/correct/preview',
  requireAdminCapability('TBILISI_MOVES_CORRECT'),
  wrap(async (req, res) => {
    const preview = await previewFinalize({ date: assertYmd(req.params.date) });
    if (preview.round.status !== 'FINALIZED') {
      return res.status(409).json({
        error: 'კორექცია მხოლოდ დაფიქსირებულ რაუნდზეა.',
        code: 'NOT_FINALIZED',
      });
    }
    res.json(preview);
  }),
);

adminTbilisiMovesRouter.post(
  '/rounds/:date/correct',
  mutateLimiter,
  requireAdminCapability('TBILISI_MOVES_CORRECT'),
  wrap(async (req, res) => {
    const body = correctBodySchema.parse(req.body);
    res.json(
      await finalizeRound({
        date: assertYmd(req.params.date),
        kind: 'CORRECTION',
        previewHash: body.previewHash,
        fromRevision: body.fromRevision,
        reason: body.reason,
        admin: req.admin,
        actor: 'admin',
      }),
    );
  }),
);

adminTbilisiMovesRouter.get(
  '/credits',
  requireAnyAdminCapability('TBILISI_MOVES_VIEW', 'TBILISI_MOVES_REVIEW'),
  wrap(async (req, res) => {
    const query = adminListQuerySchema.parse(req.query);
    res.json(
      await listCredits({
        date: query.date,
        districtId: query.districtId,
        excluded: boolQuery(query.excluded),
        flagged: boolQuery(query.flagged),
        limit: query.limit,
        offset: query.offset,
      }),
    );
  }),
);

adminTbilisiMovesRouter.get(
  '/observations',
  requireAnyAdminCapability('TBILISI_MOVES_VIEW', 'TBILISI_MOVES_REVIEW'),
  wrap(async (req, res) => {
    const query = adminListQuerySchema.parse(req.query);
    res.json(
      await listObservations({
        creditId: query.creditId,
        date: query.date,
        userId: query.userId,
        limit: query.limit,
        offset: query.offset,
      }),
    );
  }),
);

adminTbilisiMovesRouter.post(
  '/credits/:id/exclude',
  mutateLimiter,
  requireAdminCapability('TBILISI_MOVES_REVIEW'),
  wrap(async (req, res) => {
    const body = reasonBodySchema.parse(req.body);
    res.json(
      await setCreditExclusion({
        admin: req.admin,
        creditId: req.params.id,
        excluded: true,
        reason: body.reason,
      }),
    );
  }),
);

adminTbilisiMovesRouter.post(
  '/credits/:id/reinstate',
  mutateLimiter,
  requireAdminCapability('TBILISI_MOVES_REVIEW'),
  wrap(async (req, res) => {
    const body = reasonBodySchema.parse(req.body);
    res.json(
      await setCreditExclusion({
        admin: req.admin,
        creditId: req.params.id,
        excluded: false,
        reason: body.reason,
      }),
    );
  }),
);

adminTbilisiMovesRouter.get(
  '/rewards',
  requireAdminCapability('TBILISI_MOVES_VIEW'),
  wrap(async (_req, res) => {
    const config = await adminConfigView();
    res.json({
      live: config.live,
      currentRound: config.currentRound,
      policy: {
        rewardsEnabled: config.live.rewardsEnabled,
        leaderRecognitionEnabled: config.live.leaderRecognitionEnabled,
        leaderRewardedRanks: config.live.leaderRewardedRanks,
        districtGoalBadgeEnabled: config.live.districtGoalBadgeEnabled,
        note: 'წესები snapshotted რაუნდის გახსნაზე. ძველ რაუნდს rewards ობიექტი თუ არ აქვს, ჯილდო არ გაიცემა.',
      },
    });
  }),
);

adminTbilisiMovesRouter.get(
  '/awards',
  requireAdminCapability('TBILISI_MOVES_VIEW'),
  wrap(async (req, res) => {
    const query = adminListQuerySchema.parse(req.query);
    res.json(await listIssuedAwards({ date: query.date, status: query.status, limit: query.limit, offset: query.offset }));
  }),
);
