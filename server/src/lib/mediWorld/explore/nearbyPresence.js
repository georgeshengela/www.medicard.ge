import {
  coarseAreaKey,
  destinationPoint,
  isValidLatitude,
  isValidLongitude,
} from './geo.js';

export const NEARBY_PRESENCE_SOURCE = 'nearby_presence';
export const NEARBY_MICRO_GRID = 0.0008;
export const NEARBY_SPARK_COUNT = 4;

const OFFSETS = Object.freeze([
  { bearing: 40, meters: 22, type: 'community_space', nameKa: 'ზრუნვის ნაპერწკალი', nameEn: 'Nearby care spark' },
  { bearing: 130, meters: 36, type: 'public_garden', nameKa: 'სიმშვიდის ნაპერწკალი', nameEn: 'Nearby calm spark' },
  { bearing: 220, meters: 48, type: 'park', nameKa: 'მოძრაობის ნაპერწკალი', nameEn: 'Nearby movement spark' },
  { bearing: 310, meters: 58, type: 'public_square', nameKa: 'წყლის ნაპერწკალი', nameEn: 'Nearby hydration spark' },
]);

export function nearbyMicroOrigin(latitude, longitude) {
  const glat = Math.floor(Number(latitude) / NEARBY_MICRO_GRID) * NEARBY_MICRO_GRID;
  const glng = Math.floor(Number(longitude) / NEARBY_MICRO_GRID) * NEARBY_MICRO_GRID;
  return { latitude: glat, longitude: glng };
}

export function nearbyMicroKey(latitude, longitude) {
  const origin = nearbyMicroOrigin(latitude, longitude);
  return `m${origin.latitude.toFixed(4)}_${origin.longitude.toFixed(4)}`;
}

export function nearbyPresencePlaceId(microKey, index) {
  return `place.nearby.${microKey}.${index}`;
}

/** Deterministic walkable sparks around a ~90m cell. Honest nearby sparks — not named real landmarks. */
export function nearbyPresenceRows(latitude, longitude, now = new Date()) {
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return [];
  const origin = nearbyMicroOrigin(latitude, longitude);
  const microKey = nearbyMicroKey(latitude, longitude);
  const cell = coarseAreaKey(latitude, longitude);
  const center = {
    latitude: origin.latitude + NEARBY_MICRO_GRID / 2,
    longitude: origin.longitude + NEARBY_MICRO_GRID / 2,
  };
  return OFFSETS.map((spec, index) => {
    const point = destinationPoint(center, spec.bearing, spec.meters);
    return {
      id: nearbyPresencePlaceId(microKey, index),
      nameKa: spec.nameKa,
      nameEn: spec.nameEn,
      placeType: spec.type,
      latitude: point.latitude,
      longitude: point.longitude,
      coarseAreaKey: cell,
      status: 'approved',
      active: true,
      source: NEARBY_PRESENCE_SOURCE,
      sourceIdentifier: `nearby:${microKey}:${index}`,
      accessibility: 'unknown',
      lastReviewedAt: now,
      updatedAt: now,
    };
  });
}

export async function ensureNearbyPresence(db, latitude, longitude, now = new Date()) {
  const rows = nearbyPresenceRows(latitude, longitude, now);
  const saved = [];
  for (const place of rows) {
    if (typeof db.worldPlace.upsert === 'function') {
      saved.push(
        await db.worldPlace.upsert({
          where: { id: place.id },
          create: place,
          update: {
            nameKa: place.nameKa,
            nameEn: place.nameEn,
            placeType: place.placeType,
            latitude: place.latitude,
            longitude: place.longitude,
            coarseAreaKey: place.coarseAreaKey,
            status: 'approved',
            active: true,
            source: NEARBY_PRESENCE_SOURCE,
            updatedAt: now,
          },
        }),
      );
    } else {
      const existing = await db.worldPlace.findUnique({ where: { id: place.id } });
      if (!existing) saved.push(await db.worldPlace.create({ data: place }));
      else saved.push(existing);
    }
  }
  return saved;
}
