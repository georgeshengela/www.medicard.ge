import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { ensureUserLocationTable } from './userLocation.js';
import {
  sanitizeMapboxPublicToken,
  shapeGeoCountries,
} from './adminUserGeoShape.js';

export {
  COUNTRY_CENTROIDS,
  countryCentroid,
  sanitizeMapboxPublicToken,
  shapeGeoCountries,
} from './adminUserGeoShape.js';

const CACHE_MS = 8_000;
let cache = { at: 0, value: null };

export function mapboxPublicToken() {
  return sanitizeMapboxPublicToken(env.MAPBOX_PUBLIC_TOKEN || process.env.EXPO_PUBLIC_MAPBOX_TOKEN);
}

function isMissingTable(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}

export function clearUserGeoCache() {
  cache = { at: 0, value: null };
}

export async function getUserGeoAnalytics() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;

  await ensureUserLocationTable();
  let rows = [];
  try {
    rows = await prisma.$queryRaw`
      SELECT UPPER(TRIM(ul."countryCode")) AS "countryCode",
             MIN(NULLIF(TRIM(ul."countryKa"), '')) AS "countryKa",
             COUNT(*)::int AS users
      FROM "UserLocation" ul
      INNER JOIN "User" u ON u.id = ul."userId"
      WHERE ul."enabled" = true
        AND ul."countryCode" IS NOT NULL
        AND length(trim(ul."countryCode")) = 2
      GROUP BY 1
      ORDER BY users DESC
    `;
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    rows = [];
  }

  const countries = shapeGeoCountries(rows);
  const located = countries.reduce((sum, row) => sum + row.users, 0);
  const totalUsers = await prisma.user.count();
  const payload = {
    token: mapboxPublicToken(),
    countries,
    located,
    unknown: Math.max(0, totalUsers - located),
    totalUsers,
    refreshedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), value: payload };
  return payload;
}
