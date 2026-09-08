import { prisma } from './prisma.js';
import { publicHealthProfile } from './patient.js';
import { metersBetween, resolveNominatimAddress } from './geoPlace.js';

const PLACE_MOVE_METERS = 2000;
const NOMINATIM_GAP_MS = 1100;

let tableReady = false;
let lastNominatimAt = 0;

export function emptyLocationSnapshot() {
  return {
    prompted: false,
    enabled: false,
    countryCode: null,
    countryKa: null,
    cityKa: null,
    lat: null,
    lng: null,
    accuracy: null,
    updatedAt: null,
  };
}

export function snapshotFromRow(row, extra = {}) {
  if (!row && !extra.location && extra.locationPrompted !== true) return emptyLocationSnapshot();
  const stored = extra.location && typeof extra.location === 'object' ? extra.location : {};
  return {
    prompted: extra.locationPrompted === true || stored.prompted === true || Boolean(row),
    enabled: row ? row.enabled !== false : stored.enabled === true,
    countryCode: row?.countryCode ?? stored.countryCode ?? null,
    countryKa: row?.countryKa ?? stored.countryKa ?? null,
    cityKa: row?.cityKa ?? stored.cityKa ?? null,
    lat: row?.lat ?? stored.lat ?? null,
    lng: row?.lng ?? stored.lng ?? null,
    accuracy: row?.accuracy ?? stored.accuracy ?? null,
    updatedAt: (row?.updatedAt ? new Date(row.updatedAt).toISOString() : null) || stored.updatedAt || null,
  };
}

export async function ensureUserLocationTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserLocation" (
      "userId" TEXT NOT NULL,
      "lat" DOUBLE PRECISION,
      "lng" DOUBLE PRECISION,
      "accuracy" DOUBLE PRECISION,
      "countryCode" TEXT,
      "countryKa" TEXT,
      "cityKa" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "placeUpdatedAt" TIMESTAMP(3),
      CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("userId")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserLocation_updatedAt_idx" ON "UserLocation"("updatedAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserLocation_countryCode_idx" ON "UserLocation"("countryCode")
  `);
  tableReady = true;
}

export async function loadUserLocationRow(userId) {
  if (!userId) return null;
  await ensureUserLocationTable();
  try {
    const rows = await prisma.$queryRaw`
      SELECT "userId", "lat", "lng", "accuracy", "countryCode", "countryKa", "cityKa",
             "enabled", "updatedAt", "placeUpdatedAt"
      FROM "UserLocation"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (error) {
    if (isMissingTable(error)) {
      tableReady = false;
      return null;
    }
    throw error;
  }
}

async function reverseGeocode(lat, lng) {
  const wait = NOMINATIM_GAP_MS - (Date.now() - lastNominatimAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimAt = Date.now();

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '14');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ka,en',
      'User-Agent': 'Medicard.GE/1.0 (live location; contact@medicard.ge)',
    },
  });
  if (!response.ok) return null;
  const body = await response.json();
  return resolveNominatimAddress(body?.address || {});
}

function shouldRefreshPlace(row, lat, lng, source) {
  if (source === 'grant' && (!row?.cityKa || !row?.countryCode)) return true;
  if (!row?.cityKa || !row?.countryKa || !row?.countryCode) return true;
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return true;
  return metersBetween({ lat: row.lat, lng: row.lng }, { lat, lng }) >= PLACE_MOVE_METERS;
}

async function persistRow(userId, next) {
  await ensureUserLocationTable();
  await prisma.$executeRaw`
    INSERT INTO "UserLocation" (
      "userId", "lat", "lng", "accuracy", "countryCode", "countryKa", "cityKa",
      "enabled", "updatedAt", "placeUpdatedAt"
    )
    VALUES (
      ${userId}, ${next.lat}, ${next.lng}, ${next.accuracy}, ${next.countryCode},
      ${next.countryKa}, ${next.cityKa}, ${next.enabled}, ${next.updatedAt}, ${next.placeUpdatedAt}
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "lat" = EXCLUDED."lat",
      "lng" = EXCLUDED."lng",
      "accuracy" = EXCLUDED."accuracy",
      "countryCode" = COALESCE(EXCLUDED."countryCode", "UserLocation"."countryCode"),
      "countryKa" = COALESCE(EXCLUDED."countryKa", "UserLocation"."countryKa"),
      "cityKa" = COALESCE(EXCLUDED."cityKa", "UserLocation"."cityKa"),
      "enabled" = EXCLUDED."enabled",
      "updatedAt" = EXCLUDED."updatedAt",
      "placeUpdatedAt" = COALESCE(EXCLUDED."placeUpdatedAt", "UserLocation"."placeUpdatedAt")
  `;
}

async function mergeHealthProfileLocation(userId, snapshot) {
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  const extra = profile.extraAnswers && typeof profile.extraAnswers === 'object' ? profile.extraAnswers : {};
  const updated = await prisma.healthProfile.update({
    where: { userId },
    data: {
      extraAnswers: {
        ...extra,
        locationPrompted: snapshot.prompted,
        location: snapshot,
      },
    },
  });
  return publicHealthProfile(updated);
}

export async function getUserLocationSnapshot(userId) {
  const [row, profile] = await Promise.all([
    loadUserLocationRow(userId),
    prisma.healthProfile.findUnique({ where: { userId } }),
  ]);
  const extra = profile?.extraAnswers && typeof profile.extraAnswers === 'object' ? profile.extraAnswers : {};
  return {
    location: snapshotFromRow(row, extra),
    profile: publicHealthProfile(profile),
  };
}

export async function upsertUserLocation(userId, input = {}) {
  const now = new Date();
  const row = await loadUserLocationRow(userId);
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  const extra = profile?.extraAnswers && typeof profile.extraAnswers === 'object' ? profile.extraAnswers : {};
  const current = snapshotFromRow(row, extra);

  const hasCoords = Number.isFinite(input.lat) && Number.isFinite(input.lng);
  const prompted = input.prompted === true || current.prompted || hasCoords || input.enabled === true;
  const enabled =
    input.enabled != null ? input.enabled : hasCoords ? true : current.enabled;

  let countryCode = current.countryCode;
  let countryKa = current.countryKa;
  let cityKa = current.cityKa;
  let placeUpdatedAt = row?.placeUpdatedAt ? new Date(row.placeUpdatedAt) : null;

  if (hasCoords && enabled && shouldRefreshPlace(row, input.lat, input.lng, input.source)) {
    try {
      const place = await reverseGeocode(input.lat, input.lng);
      if (place?.countryCode || place?.cityKa) {
        countryCode = place.countryCode || countryCode;
        countryKa = place.countryKa || countryKa;
        cityKa = place.cityKa || cityKa;
        placeUpdatedAt = now;
      }
    } catch (error) {
      console.warn('[location] reverse geocode failed', error?.message);
    }
  }

  const nextRow = {
    lat: hasCoords ? input.lat : row?.lat ?? null,
    lng: hasCoords ? input.lng : row?.lng ?? null,
    accuracy: hasCoords ? (Number.isFinite(input.accuracy) ? input.accuracy : null) : row?.accuracy ?? null,
    countryCode,
    countryKa,
    cityKa,
    enabled,
    updatedAt: now,
    placeUpdatedAt,
  };

  if (hasCoords || row || enabled || prompted) {
    try {
      await persistRow(userId, nextRow);
    } catch (error) {
      if (isMissingTable(error)) {
        tableReady = false;
      } else {
        console.warn('[location] upsert failed', error?.message);
      }
    }
  }

  const snapshot = {
    prompted,
    enabled,
    countryCode,
    countryKa,
    cityKa,
    lat: nextRow.lat,
    lng: nextRow.lng,
    accuracy: nextRow.accuracy,
    updatedAt: now.toISOString(),
  };

  const nextProfile = await mergeHealthProfileLocation(userId, snapshot);
  return { location: snapshot, profile: nextProfile };
}

function isMissingTable(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}
