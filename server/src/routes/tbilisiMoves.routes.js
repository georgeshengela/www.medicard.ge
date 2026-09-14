import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getPublicStatus } from '../lib/tbilisiMoves/config.js';
import { isTbilisiMovesSchemaMissing, schemaUnavailable } from '../lib/tbilisiMoves/errors.js';
import { putObservation } from '../lib/tbilisiMoves/ingest.js';
import {
  cancelDistrictChange,
  enrollUser,
  getMembershipView,
  leaveCompetition,
  patchMembershipIdentity,
  requestDistrictChange,
} from '../lib/tbilisiMoves/membership.js';
import {
  getCatalog,
  getDayResults,
  getDistrictBoard,
  getDistrictDetail,
  getHistory,
  getMyAwards,
  getPeopleBoard,
  getRoundView,
  getTodayOverview,
} from '../lib/tbilisiMoves/read.js';
import {
  awardsQuerySchema,
  districtChangeBodySchema,
  enrollBodySchema,
  historyQuerySchema,
  observationBodySchema,
  patchMeBodySchema,
  peopleQuerySchema,
} from '../lib/tbilisiMoves/schema.js';
import { RATE_LIMIT_VALIDATE } from '../lib/rateLimitKey.js';

export const tbilisiMovesRouter = Router();

const writeLimiter = rateLimit({
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

tbilisiMovesRouter.get(
  '/status',
  wrap(async (_req, res) => {
    res.json(await getPublicStatus());
  }),
);

tbilisiMovesRouter.use(requireAuth);

tbilisiMovesRouter.get(
  '/catalog',
  wrap(async (_req, res) => {
    res.json(await getCatalog());
  }),
);

tbilisiMovesRouter.get(
  '/me',
  wrap(async (req, res) => {
    const membership = await getMembershipView(req.user.id);
    const overview = await getTodayOverview(req.user.id);
    res.json({ ...membership, overview });
  }),
);

tbilisiMovesRouter.patch(
  '/me',
  writeLimiter,
  wrap(async (req, res) => {
    const body = patchMeBodySchema.parse(req.body);
    res.json({ membership: await patchMembershipIdentity({ userId: req.user.id, ...body }) });
  }),
);

tbilisiMovesRouter.post(
  '/enroll',
  writeLimiter,
  wrap(async (req, res) => {
    const body = enrollBodySchema.parse(req.body);
    res.status(201).json({
      membership: await enrollUser({
        userId: req.user.id,
        districtId: body.districtId,
        publicHandle: body.publicHandle,
        publicAvatarId: body.publicAvatarId,
      }),
    });
  }),
);

tbilisiMovesRouter.post(
  '/district-change',
  writeLimiter,
  wrap(async (req, res) => {
    const body = districtChangeBodySchema.parse(req.body);
    res.json({
      membership: await requestDistrictChange({
        userId: req.user.id,
        districtId: body.districtId,
      }),
    });
  }),
);

tbilisiMovesRouter.post(
  '/district-change/cancel',
  writeLimiter,
  wrap(async (req, res) => {
    res.json({ membership: await cancelDistrictChange({ userId: req.user.id }) });
  }),
);

tbilisiMovesRouter.post(
  '/leave',
  writeLimiter,
  wrap(async (req, res) => {
    res.json({ membership: await leaveCompetition({ userId: req.user.id }) });
  }),
);

tbilisiMovesRouter.put(
  '/observations',
  writeLimiter,
  wrap(async (req, res) => {
    const body = observationBodySchema.parse(req.body);
    const result = await putObservation({ userId: req.user.id, body });
    if (result.reason === 'SOURCE_CONFLICT') {
      return res.status(409).json({
        error: 'ამ დღეს უკვე დაფიქსირებულია სხვა წყარო. წყაროები არ ჯამდება.',
        code: 'SOURCE_CONFLICT',
        accepted: false,
        credit: result.credit,
      });
    }
    res.json(result);
  }),
);

tbilisiMovesRouter.get(
  '/history',
  wrap(async (req, res) => {
    const query = historyQuerySchema.parse(req.query);
    res.json(await getHistory(req.user.id, query));
  }),
);

tbilisiMovesRouter.get(
  '/awards',
  wrap(async (req, res) => {
    const query = awardsQuerySchema.parse(req.query);
    res.json(await getMyAwards(req.user.id, query));
  }),
);

tbilisiMovesRouter.get(
  '/results/:date',
  wrap(async (req, res) => {
    res.json(await getDayResults(req.params.date, req.user.id));
  }),
);

tbilisiMovesRouter.get(
  '/rounds/:date',
  wrap(async (req, res) => {
    res.json(await getRoundView(req.params.date));
  }),
);

tbilisiMovesRouter.get(
  '/rounds/:date/districts',
  wrap(async (req, res) => {
    res.json(await getDistrictBoard(req.params.date));
  }),
);

tbilisiMovesRouter.get(
  '/rounds/:date/districts/:id',
  wrap(async (req, res) => {
    res.json(await getDistrictDetail(req.params.date, req.params.id, req.user.id));
  }),
);

tbilisiMovesRouter.get(
  '/rounds/:date/districts/:id/people',
  wrap(async (req, res) => {
    const query = peopleQuerySchema.parse(req.query);
    res.json(await getPeopleBoard(req.params.date, req.params.id, req.user.id, query));
  }),
);
