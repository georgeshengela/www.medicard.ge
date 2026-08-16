import { Router } from 'express';
import { getAppSettings, publicAppSettings, compareSemver } from '../lib/settings.js';
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
    const needsUpdate = compareSemver(clientVersion, settings.minAppVersion) < 0;

    const packages = await prisma.package.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      settings: publicAppSettings(settings),
      packages: packages.map(publicPackage),
      client: {
        version: clientVersion,
        needsUpdate,
        blockedByForceUpdate: settings.forceUpdate && needsUpdate,
      },
    });
  }),
);
