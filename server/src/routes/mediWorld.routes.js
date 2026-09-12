import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import { clientTimezoneFromReq } from '../lib/cycleCivilDate.js';
import { getMediWorldLedger, getMediWorldProfile } from '../lib/mediWorld/service.js';
import {
  completeCareMoment,
  equipCosmetic,
  getCompanionWorldState,
  renameCompanion,
  selectEvolutionStage,
  unlockCosmetic,
} from '../lib/mediWorld/companion/service.js';

export const mediWorldRouter = Router();
mediWorldRouter.use(requireAuth);
mediWorldRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

function worldOptions(req) {
  const localeRaw = String(req.query?.locale || req.headers['x-medicard-locale'] || '').toLowerCase();
  return {
    user: req.user,
    timezone: req.user?.timezone,
    deviceTimezone: clientTimezoneFromReq(req),
    locale: localeRaw.startsWith('en') ? 'en' : 'ka',
  };
}

const exploreQaBody = z.object({
  scenario: z.enum(['arm_inaccurate', 'arm_map_fail', 'clear', 'expire_active', 'fill_daily_cap']),
  placeId: z.string().trim().min(1).max(80).optional(),
}).strict();

const exploreCollectLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'ძალიან ბევრი მოთხოვნა.', code: 'EXPLORE_RATE_LIMIT' },
});

const ledgerQuery = z.object({
  take: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().trim().min(1).max(64).optional(),
});

const renameBody = z.object({
  displayName: z.string().max(80),
}).strict();

const careMomentBody = z.object({
  interactionKey: z.enum(['greet', 'breathe', 'quiet', 'stretch', 'celebrate']),
}).strict();

const stageBody = z.object({
  stageKey: z.enum(['spark', 'glow', 'bloom', 'pulse', 'guardian', 'radiant']),
}).strict();

const equipmentBody = z.object({
  slot: z.enum(['aura', 'trail', 'charm', 'care_space_accent']),
  catalogKey: z.string().min(1).max(80).nullable(),
}).strict();

const unlockBody = z.object({
  idempotencyKey: z.string().trim().min(1).max(180),
}).strict();

mediWorldRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getMediWorldProfile(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/ledger',
  asyncHandler(async (req, res) => {
    const query = ledgerQuery.parse(req.query ?? {});
    res.json(await getMediWorldLedger(req.user.id, { ...query, ...worldOptions(req) }));
  }),
);

mediWorldRouter.get(
  '/companion',
  asyncHandler(async (req, res) => {
    res.json(await getCompanionWorldState(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.patch(
  '/companion',
  asyncHandler(async (req, res) => {
    const body = renameBody.parse(req.body ?? {});
    res.json(await renameCompanion(req.user.id, body.displayName, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/companion/care-moment',
  asyncHandler(async (req, res) => {
    const body = careMomentBody.parse(req.body ?? {});
    res.json(await completeCareMoment(req.user.id, body.interactionKey, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/companion/stage',
  asyncHandler(async (req, res) => {
    const body = stageBody.parse(req.body ?? {});
    res.json(await selectEvolutionStage(req.user.id, body.stageKey, worldOptions(req)));
  }),
);

mediWorldRouter.put(
  '/companion/equipment',
  asyncHandler(async (req, res) => {
    const body = equipmentBody.parse(req.body ?? {});
    res.json(await equipCosmetic(req.user.id, body.slot, body.catalogKey, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/companion/cosmetics/:catalogKey/unlock',
  asyncHandler(async (req, res) => {
    const params = z.object({ catalogKey: z.string().trim().min(1).max(80) }).parse(req.params);
    const body = unlockBody.parse(req.body ?? {});
    res.json(await unlockCosmetic(req.user.id, params.catalogKey, body.idempotencyKey, worldOptions(req)));
  }),
);

const preferenceBody = z.object({
  intensity: z.enum(['gentle', 'balanced', 'active']).optional(),
  enabledCategories: z.array(z.enum(['movement', 'hydration', 'calm', 'care', 'connection'])).max(5).optional(),
  allowVariety: z.boolean().optional(),
  preferredRestWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  reducedPressureLanguage: z.boolean().optional(),
  showTargets: z.boolean().optional(),
  movementMode: z.enum(['default', 'wheelchair', 'low_mobility']).optional(),
}).strict();

const choiceBody = z.object({
  optionKey: z.enum(['a', 'b']),
}).strict();

const swapBody = z.object({
  slotKey: z.enum(['anchor', 'balance']),
  idempotencyKey: z.string().trim().min(1).max(180),
}).strict();

const restDayBody = z.object({}).strict();

mediWorldRouter.get(
  '/adventure/today',
  asyncHandler(async (req, res) => {
    const { getTodayAdventure } = await import('../lib/mediWorld/adventure/service.js');
    res.json(await getTodayAdventure(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/adventure/preferences',
  asyncHandler(async (req, res) => {
    const { getAdventurePreferences } = await import('../lib/mediWorld/adventure/service.js');
    res.json(await getAdventurePreferences(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.put(
  '/adventure/preferences',
  asyncHandler(async (req, res) => {
    const { updateAdventurePreferences } = await import('../lib/mediWorld/adventure/service.js');
    const body = preferenceBody.parse(req.body ?? {});
    res.json(await updateAdventurePreferences(req.user.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/adventure/today/choice',
  asyncHandler(async (req, res) => {
    const { selectAdventureChoice } = await import('../lib/mediWorld/adventure/service.js');
    const body = choiceBody.parse(req.body ?? {});
    res.json(await selectAdventureChoice(req.user.id, body.optionKey, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/adventure/today/swap',
  asyncHandler(async (req, res) => {
    const { swapAdventureSlot } = await import('../lib/mediWorld/adventure/service.js');
    const body = swapBody.parse(req.body ?? {});
    res.json(await swapAdventureSlot(req.user.id, body.slotKey, body.idempotencyKey, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/adventure/today/rest-day',
  asyncHandler(async (req, res) => {
    restDayBody.parse(req.body ?? {});
    const { activateRestDay } = await import('../lib/mediWorld/adventure/service.js');
    res.json(await activateRestDay(req.user.id, worldOptions(req)));
  }),
);

const exploreAreaParams = z.object({
  coarseKey: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

const exploreSparkQuery = z.object({
  coarseKey: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._:-]+$/),
  locale: z.enum(['ka', 'en']).optional(),
}).strict();

const exploreCollectBody = z.object({
  idempotencyKey: z.string().trim().min(1).max(180),
  latitude: z.number(),
  longitude: z.number(),
  horizontalAccuracy: z.number(),
  locationTimestamp: z.union([z.string(), z.number(), z.coerce.date()]),
  mockLocation: z.boolean().optional(),
  speedMps: z.number().optional(),
}).strict();

const exploreHistoryQuery = z.object({
  take: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().trim().min(1).max(64).optional(),
  locale: z.enum(['ka', 'en']).optional(),
}).strict();

mediWorldRouter.get(
  '/explore/config',
  asyncHandler(async (req, res) => {
    const { getExploreConfig } = await import('../lib/mediWorld/explore/service.js');
    res.json(await getExploreConfig(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/explore/area/:coarseKey',
  asyncHandler(async (req, res) => {
    const params = exploreAreaParams.parse(req.params);
    const query = z.object({ locale: z.enum(['ka', 'en']).optional() }).strict().parse(req.query ?? {});
    const { getExploreArea } = await import('../lib/mediWorld/explore/service.js');
    res.json(await getExploreArea(req.user.id, params.coarseKey, { ...worldOptions(req), locale: query.locale || worldOptions(req).locale }));
  }),
);

mediWorldRouter.get(
  '/explore/sparks',
  asyncHandler(async (req, res) => {
    const query = exploreSparkQuery.parse(req.query ?? {});
    const { getExploreSparks } = await import('../lib/mediWorld/explore/service.js');
    res.json(await getExploreSparks(req.user.id, query.coarseKey, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/explore/sparks/:spawnId/collect',
  exploreCollectLimiter,
  asyncHandler(async (req, res) => {
    const params = z.object({ spawnId: z.string().trim().min(1).max(180) }).parse(req.params);
    const body = exploreCollectBody.parse(req.body ?? {});
    const sample = {
      idempotencyKey: body.idempotencyKey,
      latitude: body.latitude,
      longitude: body.longitude,
      horizontalAccuracy: body.horizontalAccuracy,
      locationTimestamp: body.locationTimestamp,
      mockLocation: body.mockLocation,
      speedMps: body.speedMps,
    };
    if (req.body && typeof req.body === 'object') {
      delete req.body.latitude;
      delete req.body.longitude;
      delete req.body.horizontalAccuracy;
      delete req.body.speedMps;
    }
    const { collectSpark } = await import('../lib/mediWorld/explore/service.js');
    res.json(await collectSpark(req.user.id, params.spawnId, sample, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/explore/collections',
  asyncHandler(async (req, res) => {
    const query = exploreHistoryQuery.parse(req.query ?? {});
    const { getExploreCollections } = await import('../lib/mediWorld/explore/service.js');
    res.json(await getExploreCollections(req.user.id, { ...worldOptions(req), ...query }));
  }),
);

mediWorldRouter.post(
  '/explore/qa/scenario',
  asyncHandler(async (req, res) => {
    const body = exploreQaBody.parse(req.body ?? {});
    const { ensureExploreCatalog } = await import('../lib/mediWorld/explore/service.js');
    const { applyExploreQaScenario } = await import('../lib/mediWorld/explore/qa.js');
    await ensureExploreCatalog(worldOptions(req));
    res.json(await applyExploreQaScenario(req.user.id, body.scenario, {
      ...worldOptions(req),
      placeId: body.placeId,
    }));
  }),
);

const movementSampleFields = {
  latitude: z.number(),
  longitude: z.number(),
  horizontalAccuracy: z.number(),
  locationTimestamp: z.union([z.string(), z.number(), z.coerce.date()]),
  mockLocation: z.boolean().optional(),
  speedMps: z.number().optional(),
  appState: z.enum(['active', 'background', 'inactive']).optional(),
};

const movementPrefBody = z.object({
  movementMode: z.enum(['walk', 'run', 'gentle_move']),
  targetMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
}).strict();

const movementStartBody = z.object({
  idempotencyKey: z.string().trim().min(1).max(180),
  movementMode: z.enum(['walk', 'run', 'gentle_move']),
  targetMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  ...movementSampleFields,
}).strict();

const movementSegmentBody = z.object({
  idempotencyKey: z.string().trim().min(1).max(180),
  continuationToken: z.string().trim().min(16).max(4000),
  ...movementSampleFields,
}).strict();

const movementResumeBody = z.object({
  idempotencyKey: z.string().trim().min(1).max(180),
  ...movementSampleFields,
}).strict();

const movementActionBody = z.object({
  idempotencyKey: z.string().trim().min(1).max(180),
}).strict();

const movementHistoryQuery = z.object({
  take: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().trim().min(1).max(64).optional(),
}).strict();

const movementSessionParams = z.object({
  id: z.string().uuid(),
}).strict();

const movementSegmentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'ძალიან ბევრი მოთხოვნა.', code: 'MOVEMENT_RATE_LIMIT' },
});

async function takeMovementSample(req) {
  const { stripMovementSecrets } = await import('../lib/mediWorld/movement/privacy.js');
  const body = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  stripMovementSecrets(req.body);
  return body;
}

mediWorldRouter.get(
  '/movement/preferences',
  asyncHandler(async (req, res) => {
    const { getMovementPreferences } = await import('../lib/mediWorld/movement/service.js');
    res.json(await getMovementPreferences(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.put(
  '/movement/preferences',
  asyncHandler(async (req, res) => {
    const body = movementPrefBody.parse(req.body ?? {});
    const { updateMovementPreferences } = await import('../lib/mediWorld/movement/service.js');
    res.json(await updateMovementPreferences(req.user.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/movement/current',
  asyncHandler(async (req, res) => {
    const { getCurrentMovementSession } = await import('../lib/mediWorld/movement/service.js');
    res.json(await getCurrentMovementSession(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/movement/sessions',
  asyncHandler(async (req, res) => {
    const parsed = movementStartBody.parse(req.body ?? {});
    const body = await takeMovementSample(req);
    Object.assign(body, parsed);
    const { startMovementSession } = await import('../lib/mediWorld/movement/service.js');
    res.json(await startMovementSession(req.user.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/movement/sessions/:id/segments',
  movementSegmentLimiter,
  asyncHandler(async (req, res) => {
    const params = movementSessionParams.parse(req.params);
    const parsed = movementSegmentBody.parse(req.body ?? {});
    const body = await takeMovementSample(req);
    Object.assign(body, parsed);
    const { submitMovementSegment } = await import('../lib/mediWorld/movement/service.js');
    res.json(await submitMovementSegment(req.user.id, params.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/movement/sessions/:id/pause',
  asyncHandler(async (req, res) => {
    const params = movementSessionParams.parse(req.params);
    const body = movementActionBody.parse(req.body ?? {});
    const { pauseMovementSession } = await import('../lib/mediWorld/movement/service.js');
    res.json(await pauseMovementSession(req.user.id, params.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/movement/sessions/:id/resume',
  asyncHandler(async (req, res) => {
    const params = movementSessionParams.parse(req.params);
    const parsed = movementResumeBody.parse(req.body ?? {});
    const body = await takeMovementSample(req);
    Object.assign(body, parsed);
    const { resumeMovementSession } = await import('../lib/mediWorld/movement/service.js');
    res.json(await resumeMovementSession(req.user.id, params.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/movement/sessions/:id/finish',
  asyncHandler(async (req, res) => {
    const params = movementSessionParams.parse(req.params);
    const body = movementActionBody.parse(req.body ?? {});
    const { finishMovementSession } = await import('../lib/mediWorld/movement/service.js');
    res.json(await finishMovementSession(req.user.id, params.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/movement/sessions/:id/abandon',
  asyncHandler(async (req, res) => {
    const params = movementSessionParams.parse(req.params);
    const body = movementActionBody.parse(req.body ?? {});
    const { abandonMovementSession } = await import('../lib/mediWorld/movement/service.js');
    res.json(await abandonMovementSession(req.user.id, params.id, body, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/movement/history',
  asyncHandler(async (req, res) => {
    const query = movementHistoryQuery.parse(req.query ?? {});
    const { getMovementHistory } = await import('../lib/mediWorld/movement/service.js');
    res.json(await getMovementHistory(req.user.id, { ...worldOptions(req), ...query }));
  }),
);

const gardenPlotParams = z.object({
  plotIndex: z.coerce.number().int(),
}).strict();

const gardenPlantParams = z.object({
  plantId: z.string().uuid(),
}).strict();

const gardenPlantBody = z.object({
  catalogKey: z.string().trim().min(1).max(80),
  idempotencyKey: z.string().trim().min(8).max(180),
}).strict();

const gardenMoveBody = z.object({
  plotIndex: z.number().int(),
  idempotencyKey: z.string().trim().min(8).max(180),
}).strict();

const gardenStoreBody = z.object({
  idempotencyKey: z.string().trim().min(8).max(180),
}).strict();

const gardenHistoryQuery = z.object({
  take: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().trim().min(1).max(120).optional(),
}).strict();

const gardenQaBody = z.object({
  plantId: z.string().uuid(),
  stage: z.enum(['seed', 'sprout', 'bloom', 'radiant']).optional(),
  nurtureDays: z.number().int().min(0).max(30).optional(),
}).strict();

mediWorldRouter.get(
  '/garden',
  asyncHandler(async (req, res) => {
    const { getGarden } = await import('../lib/mediWorld/garden/service.js');
    res.json(await getGarden(req.user.id, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/garden/catalog',
  asyncHandler(async (req, res) => {
    const { getGardenCatalog } = await import('../lib/mediWorld/garden/service.js');
    res.json(getGardenCatalog(worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/garden/plots/:plotIndex/plant',
  asyncHandler(async (req, res) => {
    const params = gardenPlotParams.parse(req.params);
    const body = gardenPlantBody.parse(req.body ?? {});
    const { plantInPlot } = await import('../lib/mediWorld/garden/service.js');
    res.json(await plantInPlot(req.user.id, params.plotIndex, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/garden/plants/:plantId/move',
  asyncHandler(async (req, res) => {
    const params = gardenPlantParams.parse(req.params);
    const body = gardenMoveBody.parse(req.body ?? {});
    const { movePlant } = await import('../lib/mediWorld/garden/service.js');
    res.json(await movePlant(req.user.id, params.plantId, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/garden/plants/:plantId/store',
  asyncHandler(async (req, res) => {
    const params = gardenPlantParams.parse(req.params);
    const body = gardenStoreBody.parse(req.body ?? {});
    const { storePlant } = await import('../lib/mediWorld/garden/service.js');
    res.json(await storePlant(req.user.id, params.plantId, body, worldOptions(req)));
  }),
);

mediWorldRouter.post(
  '/garden/plants/:plantId/restore',
  asyncHandler(async (req, res) => {
    const params = gardenPlantParams.parse(req.params);
    const body = gardenMoveBody.parse(req.body ?? {});
    const { restorePlant } = await import('../lib/mediWorld/garden/service.js');
    res.json(await restorePlant(req.user.id, params.plantId, body, worldOptions(req)));
  }),
);

mediWorldRouter.get(
  '/garden/history',
  asyncHandler(async (req, res) => {
    const query = gardenHistoryQuery.parse(req.query ?? {});
    const { getGardenHistory } = await import('../lib/mediWorld/garden/service.js');
    res.json(await getGardenHistory(req.user.id, { ...worldOptions(req), ...query }));
  }),
);

mediWorldRouter.post(
  '/garden/qa/stage',
  asyncHandler(async (req, res) => {
    const body = gardenQaBody.parse(req.body ?? {});
    const { applyGardenQaStage } = await import('../lib/mediWorld/garden/qa.js');
    res.json(await applyGardenQaStage(req.user.id, body, worldOptions(req)));
  }),
);
