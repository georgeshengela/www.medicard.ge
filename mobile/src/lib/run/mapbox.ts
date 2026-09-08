import Constants from 'expo-constants';
import {
  candidateBearings,
  crowFliesRadiusM,
  destinationPoint,
  haversineM,
  type LatLng,
} from '@/lib/run/geo';
import { API_BASE_URL } from '@/lib/api';
import { getPreference, setPreference } from '@/lib/storage';

const CACHE_KEY = 'medicard.mapbox.token';

/** Public `pk.*` token. Prefer the bundle, then a cached/runtime copy from the API. */
const BUNDLE_TOKEN: string = (process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '').trim();
let runtimeToken = BUNDLE_TOKEN.startsWith('pk.') ? BUNDLE_TOKEN : '';
let resolving: Promise<string> | null = null;

function takeToken(raw?: string | null): string {
  const token = String(raw ?? '').trim();
  return token.startsWith('pk.') ? token : '';
}

export function rememberMapboxToken(raw?: string | null): string {
  const token = takeToken(raw);
  if (!token) return peekMapboxToken();
  runtimeToken = token;
  void setPreference(CACHE_KEY, token);
  return token;
}

export function peekMapboxToken(): string {
  if (runtimeToken.startsWith('pk.')) return runtimeToken;
  return BUNDLE_TOKEN.startsWith('pk.') ? BUNDLE_TOKEN : '';
}

/** @deprecated Use peekMapboxToken / resolveMapboxToken — production builds often omit the env token. */
export const MAPBOX_TOKEN: string = BUNDLE_TOKEN;

export const hasMapboxToken = () => peekMapboxToken().startsWith('pk.');

export async function resolveMapboxToken(): Promise<string> {
  const known = peekMapboxToken();
  if (known.startsWith('pk.')) return known;
  if (resolving) return resolving;

  resolving = (async () => {
    try {
      const cached = takeToken(await getPreference(CACHE_KEY));
      if (cached) return rememberMapboxToken(cached);
      const version = Constants.expoConfig?.version ?? '0.0.0';
      const res = await fetch(`${API_BASE_URL}/api/app/status?version=${encodeURIComponent(version)}`);
      if (!res.ok) return peekMapboxToken();
      const json = (await res.json()) as { mapboxToken?: string };
      return rememberMapboxToken(json.mapboxToken);
    } catch {
      return peekMapboxToken();
    } finally {
      resolving = null;
    }
  })();

  return resolving;
}

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
  const token = await resolveMapboxToken();
  if (!token.startsWith('pk.')) return null;
  const path = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${path}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`;
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
