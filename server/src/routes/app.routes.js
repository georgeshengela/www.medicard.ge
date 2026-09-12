import { Router } from 'express';
import { getAppSettings, publicAppSettings } from '../lib/settings.js';
import { isAppVersionBelow } from '../lib/appVersion.js';
import { mapboxPublicToken } from '../lib/adminUserGeo.js';
import { publicPackage } from '../lib/packages.js';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';

export const appRouter = Router();

/** Public bootstrap payload for mobile / web clients. */
appRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    const settings = await getAppSettings();
    const clientVersion = String(req.query.version ?? '0.0.0');
    const needsUpdate = isAppVersionBelow(clientVersion, settings.minAppVersion) === true;

    const packages = await prisma.package.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      settings: publicAppSettings(settings),
      packages: packages.map(publicPackage),
      mapboxToken: mapboxPublicToken(),
      client: {
        version: clientVersion,
        needsUpdate,
        blockedByForceUpdate: settings.forceUpdate && needsUpdate,
      },
    });
  }),
);
