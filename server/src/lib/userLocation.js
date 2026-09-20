import { prisma } from './prisma.js';
import { publicHealthProfile } from './patient.js';
import { metersBetween, resolveNominatimAddress } from './geoPlace.js';
import {
  didMoveFar,
  geocodeAppliesToRow,
  isStaleLocationFixAt,
  isHomePlaceWrite,
  isLiveLocationPing,
  isCachedCaucasusFix,
  shouldClearStoredPlace,
  PLACE_MOVE_METERS,
  resolveStoredPlace,
  snapshotFromRow,
} from './userLocationPlace.js';

export {
  didMoveFar,
  geocodeAppliesToRow,
  isCachedCaucasusFix,
  isStaleLocationFixAt,
  isHomePlaceWrite,
  isLiveLocationPing,
  MAX_LOCATION_FIX_AGE_MS,
  PLACE_MOVE_METERS,
  resolveStoredPlace,
  shouldClearStoredPlace,
  snapshotFromRow,
} from './userLocationPlace.js';

const NOMINATIM_GAP_MS = 1100;

let tableReady = false;
let lastNominatimAt = 0;
let nominatimSlot = Promise.resolve();
const upsertChains = new Map();

function withUserLocationLock(userId, fn) {
  const prev = upsertChains.get(userId) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.then(() => undefined, () => undefined);
  upsertChains.set(userId, tail);
  void tail.then(() => { if (upsertChains.get(userId) === tail) upsertChains.delete(userId); });
  return run;
}

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
  // Also enforce ownership in the database: a GPS request already in flight must
  // not recreate a location after its account has been deleted. NOT VALID leaves
  // historical orphan cleanup separate while enforcing every new write.
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserLocation_userId_fkey' AND conrelid = '"UserLocation"'::regclass) THEN
        ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE NOT VALID;
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
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
  const slot = nominatimSlot.then(async () => {
    const wait = NOMINATIM_GAP_MS - (Date.now() - lastNominatimAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastNominatimAt = Date.now();
  });
  nominatimSlot = slot.catch(() => undefined);
  await slot;

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '14');

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(6000),
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
  if (!isHomePlaceWrite(source)) return false;
  if (!row?.cityKa || !row?.countryCode) return true;
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
      "countryCode" = EXCLUDED."countryCode",
      "countryKa" = EXCLUDED."countryKa",
      "cityKa" = EXCLUDED."cityKa",
      "enabled" = EXCLUDED."enabled",
      "updatedAt" = EXCLUDED."updatedAt",
      "placeUpdatedAt" = EXCLUDED."placeUpdatedAt"
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
  return withUserLocationLock(userId, () => upsertUserLocationUnlocked(userId, input));
}

async function upsertUserLocationUnlocked(userId, input = {}) {
  const now = new Date();
  const row = await loadUserLocationRow(userId);
  const profile = await prisma.healthProfile.findUnique({ where: { userId } });
  const extra = profile?.extraAnswers && typeof profile.extraAnswers === 'object' ? profile.extraAnswers : {};
  const current = snapshotFromRow(row, extra);
  const source = input.source || null;

  if (isLiveLocationPing(source)) {
    return { location: current, profile: publicHealthProfile(profile) };
  }

  let hasCoords = Number.isFinite(input.lat) && Number.isFinite(input.lng)
    && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180;
  if (hasCoords && isStaleLocationFixAt(input.fixAt, now.getTime())) {
    hasCoords = false;
  }
  // A device timezone is a preference, not evidence that fresh GPS is wrong.
  if (hasCoords && !isHomePlaceWrite(source)) {
    hasCoords = false;
  }
  if (source === 'grant' && !hasCoords) {
    throw Object.assign(new Error('მდებარეობის ახალი მონაცემი ვერ მივიღეთ. ხელახლა სცადეთ.'), { status: 400, code: 'LOCATION_FIX_REQUIRED' });
  }

  const prompted = input.prompted === true || current.prompted || hasCoords || input.enabled === true;
  const enabled =
    input.enabled != null ? input.enabled : hasCoords ? true : current.enabled;
  const clearPlace = shouldClearStoredPlace(source, hasCoords);

  const movedFar = hasCoords ? didMoveFar(row, input.lat, input.lng) : false;
  const nextPlace = clearPlace
    ? { countryCode: null, countryKa: null, cityKa: null }
    : resolveStoredPlace({
        current,
        geocoded: hasCoords && isHomePlaceWrite(source) ? input.place : null,
        movedFar,
      });

  let countryCode = nextPlace.countryCode;
  let countryKa = nextPlace.countryKa;
  let cityKa = nextPlace.cityKa;
  let placeUpdatedAt = clearPlace || movedFar ? now : row?.placeUpdatedAt ? new Date(row.placeUpdatedAt) : null;

  const nextRow = {
    lat: clearPlace ? null : hasCoords ? input.lat : row?.lat ?? null,
    lng: clearPlace ? null : hasCoords ? input.lng : row?.lng ?? null,
    accuracy: clearPlace
      ? null
      : hasCoords
        ? Number.isFinite(input.accuracy)
          ? input.accuracy
          : null
        : row?.accuracy ?? null,
    countryCode,
    countryKa,
    cityKa,
    enabled,
    updatedAt: now,
    placeUpdatedAt,
  };

  if (hasCoords || row || enabled || prompted) {
    await persistRow(userId, nextRow);
  }

  if (hasCoords && enabled && (!countryCode || !cityKa) && shouldRefreshPlace(row, input.lat, input.lng, input.source)) {
    let geocoded = null;
    try {
      geocoded = await reverseGeocode(input.lat, input.lng);
    } catch {
      console.warn('[location] reverse geocode unavailable');
    }
    if (geocoded) {
      const latest = await loadUserLocationRow(userId);
      if (geocodeAppliesToRow(latest, input.lat, input.lng)) {
        const placed = resolveStoredPlace({
          current: { countryCode, countryKa, cityKa },
          geocoded,
          movedFar: false, // The old city's fields were already cleared/replaced above.
        });
        countryCode = placed.countryCode;
        countryKa = placed.countryKa;
        cityKa = placed.cityKa;
        if (geocoded?.countryCode || geocoded?.cityKa) placeUpdatedAt = new Date();
        await persistRow(userId, {
          ...nextRow,
          countryCode,
          countryKa,
          cityKa,
          placeUpdatedAt,
          updatedAt: new Date(),
        });
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
