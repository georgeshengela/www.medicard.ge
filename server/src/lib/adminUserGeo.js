import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { ensureUserLocationTable } from './userLocation.js';
import {
  sanitizeMapboxPublicToken,
  shapeGeoCountries,
  userCountry,
} from './adminUserGeoShape.js';

export {
  COUNTRY_CENTROIDS,
  countryCentroid,
  sanitizeMapboxPublicToken,
  shapeGeoCountries,
} from './adminUserGeoShape.js';

const CACHE_MS = 30_000;
let cache = { at: 0, value: null };
let pending = null;

export function mapboxPublicToken() {
  return sanitizeMapboxPublicToken(env.MAPBOX_PUBLIC_TOKEN || process.env.EXPO_PUBLIC_MAPBOX_TOKEN);
}

function isMissingTable(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}

export function clearUserGeoCache() {
  cache = { at: 0, value: null };
  pending = null;
}

export async function getUserGeoAnalytics() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (pending) return pending;

  pending = (async () => {
    await ensureUserLocationTable();
    // Every account, with what we know about where it is (see userCountry for the order of trust).
    let rows = [];
    try {
      rows = await prisma.$queryRaw`
      SELECT u.phone, u.email, qp.timezone,
             CASE WHEN ul."enabled" = true THEN UPPER(TRIM(ul."countryCode")) END AS "locationCode",
             CASE WHEN ul."enabled" = true THEN NULLIF(TRIM(ul."cityKa"), '') END AS "cityKa"
      FROM "User" u
      LEFT JOIN "UserLocation" ul ON ul."userId" = u.id
      LEFT JOIN "UserQuestProfile" qp ON qp."userId" = u.id
    `;
    } catch (error) {
      if (!isMissingTable(error)) throw error;
      rows = (await prisma.user.findMany({ select: { phone: true, email: true } }));
    }

    const byCountry = new Map();
    const sources = { location: 0, phone: 0, timezone: 0 };
    const cities = new Map();
    for (const row of rows) {
      const hit = userCountry(row);
      if (!hit) continue;
      sources[hit.source] += 1;
      byCountry.set(hit.code, (byCountry.get(hit.code) || 0) + 1);
      if (hit.source === 'location' && row.cityKa) cities.set(row.cityKa, (cities.get(row.cityKa) || 0) + 1);
    }
    const countries = shapeGeoCountries([...byCountry].map(([countryCode, users]) => ({ countryCode, users })));
    const located = countries.reduce((sum, row) => sum + row.users, 0);
    const totalUsers = rows.length;
    const payload = {
      token: mapboxPublicToken(),
      countries,
      located,
      unknown: Math.max(0, totalUsers - located),
      totalUsers,
      sources,
      cities: [...cities].map(([nameKa, users]) => ({ nameKa, users })).sort((x, y) => y.users - x.users).slice(0, 8),
      refreshedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), value: payload };
    return payload;
  })().finally(() => {
    pending = null;
  });

  return pending;
}
