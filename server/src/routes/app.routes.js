import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { attachRateLimitHandler, clientIp, RATE_LIMIT_VALIDATE } from '../lib/rateLimitKey.js';
import { loopNotifier, parseClientGuardReport } from '../lib/loopGuard.js';
import { buildEvent, errorRecorder, parseClientErrorReport, tokenUserId } from '../lib/errorMonitor.js';
import { env } from '../config/env.js';
import { getAppSettings, publicAppSettings } from '../lib/settings.js';
import { isAppVersionBelow } from '../lib/appVersion.js';
import { mapboxPublicToken } from '../lib/adminUserGeo.js';
import { publicPackage } from '../lib/packages.js';
import { FREE_CONSUMER_RELEASE, freeConsumerPackage } from '../lib/consumerAccess.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { publicFeatureFlags, publicFeatureMessages } from '../lib/featureFlags.js';
import { getUpdatePrompt, updatePromptForClient } from '../lib/updatePrompt.js';

export const appRouter = Router();

/** Public bootstrap payload for mobile / web clients. */
appRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    const settings = await getAppSettings();
    const clientVersion = String(req.query.version ?? '0.0.0');
    const needsUpdate = isAppVersionBelow(clientVersion, settings.minAppVersion) === true;

    const packages = FREE_CONSUMER_RELEASE ? [] : await prisma.package.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      settings: publicAppSettings(settings, req.lang),
      features: await publicFeatureFlags(),
      featureMessages: await publicFeatureMessages(undefined, req.lang),
      packages: FREE_CONSUMER_RELEASE ? [freeConsumerPackage()] : packages.map(publicPackage),
      accessMode: FREE_CONSUMER_RELEASE ? 'free' : 'paid',
      mapboxToken: mapboxPublicToken(),
      client: {
        version: clientVersion,
        needsUpdate,
        blockedByForceUpdate: settings.forceUpdate && needsUpdate,
        // Soft update card (no blocking): `auto` = show it when an OTA is ready, `ask` = look for it now.
        updatePrompt: updatePromptForClient(await getUpdatePrompt(), clientVersion),
      },
    });
  }),
);

/** The app's circuit breaker stopped a request loop on the phone (mobile/src/lib/requestBreaker.ts). */
appRouter.post(
  '/client-guard',
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: RATE_LIMIT_VALIDATE,
    keyGenerator: (req) => `client-guard:${clientIp(req)}`,
    handler: attachRateLimitHandler('client-guard'),
  }),
  (req, res) => {
    const report = parseClientGuardReport(req.body);
    if (!report) return res.status(400).json({ error: 'invalid report' });
    loopNotifier.clientReport(req, report);
    res.status(202).json({ ok: true });
  },
);

/**
 * App crash / error reports (lib/errorMonitor.js). No auth required; a valid user token only
 * attributes the events (hashed) — a user id in the body is never read. Answers before recording.
 */
appRouter.post(
  '/client-error',
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: RATE_LIMIT_VALIDATE,
    keyGenerator: (req) => `client-error:${clientIp(req)}`,
    handler: attachRateLimitHandler('client-error'),
  }),
  (req, res) => {
    const events = parseClientErrorReport(req.body);
    if (!events) return res.status(400).json({ error: 'invalid report' });
    res.status(202).json({ ok: true });
    try {
      const meta = {
        source: 'app',
        platform: req.headers['x-medicard-platform'],
        appVersion: req.headers['x-medicard-app-version'],
        userId: tokenUserId(req, env.JWT_SECRET),
      };
      for (const raw of events) void errorRecorder.record(buildEvent(raw, meta));
    } catch (error) {
      console.warn('[errors] client report skipped:', error?.message || error);
    }
  },
);
