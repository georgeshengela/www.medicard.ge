import {
  candidateBearings,
  crowFliesRadiusM,
  destinationPoint,
  haversineM,
  type LatLng,
} from '@/lib/run/geo';

/** Public `pk.*` token — shipped in the bundle by design. Set in `mobile/.env`. */
export const MAPBOX_TOKEN: string = (process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '').trim();

export const hasMapboxToken = () => MAPBOX_TOKEN.startsWith('pk.');

export type RunRoute = {
  /** [lng, lat] pairs — GeoJSON order, ready for the map. */
  coords: [number, number][];
  distanceM: number;
  durationS: number;
};

type DirectionsResponse = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
};

/** Walking route between two points via Mapbox Directions. Null on any failure. */
export async function fetchWalkingRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RunRoute | null> {
  if (!hasMapboxToken()) return null;
  const path = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${path}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as DirectionsResponse;
    const route = json.routes?.[0];
    if (!route || json.code !== 'Ok' || !route.geometry?.coordinates?.length) return null;
    return {
      coords: route.geometry.coordinates,
      distanceM: route.distance,
      durationS: route.duration,
    };
  } catch {
    return null;
  }
}

export type GeneratedPin = {
  pin: LatLng;
  route: RunRoute | null;
  /** Route distance when a route exists, otherwise the straight-line estimate ×1.25. */
  expectedDistanceM: number;
  /** True when the pin was snapped to a walkable road via Directions. */
  routed: boolean;
};

/**
 * Drop a random pin so the walking route from `origin` is close to `targetM`.
 * Tries several compass bearings, scores each by |route − target|, keeps the best.
 * Falls back to a straight-line pin when Directions is unavailable (no token / offline).
 */
export async function generateTargetPin(
  origin: LatLng,
  targetM: number,
  opts: { attempts?: number; signal?: AbortSignal } = {},
): Promise<GeneratedPin> {
  const attempts = opts.attempts ?? 6;
  const radius = crowFliesRadiusM(targetM);
  const bearings = candidateBearings(attempts);

  const candidates = await Promise.all(
    bearings.map(async (bearing) => {
      const guess = destinationPoint(origin, bearing, radius);
      const route = await fetchWalkingRoute(origin, guess, opts.signal);
      if (!route) return null;
      const end = route.coords[route.coords.length - 1];
      const pin = { lat: end[1], lng: end[0] };
      // Directions may snap far away (e.g. into a park edge) — reject pins that drifted a lot.
      if (haversineM(guess, pin) > Math.max(250, radius * 0.5)) return null;
      return { pin, route, score: Math.abs(route.distanceM - targetM) };
    }),
  );

  const best = candidates
    .filter((c): c is NonNullable<typeof c> => c != null)
    .sort((a, b) => a.score - b.score)[0];

  if (best) {
    return { pin: best.pin, route: best.route, expectedDistanceM: best.route.distanceM, routed: true };
  }

  const fallbackBearing = bearings[0] ?? Math.random() * 360;
  const pin = destinationPoint(origin, fallbackBearing, radius);
  return { pin, route: null, expectedDistanceM: Math.round(radius * 1.25), routed: false };
}
