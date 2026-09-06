import { metersBetween } from '@/lib/geoPlace';
import { getPreference, setPreference } from '@/lib/storage';
import { fetchOpenMeteoSnapshot } from './openMeteo.ts';
import {
  WEATHER_CACHE_TTL_MS,
  WEATHER_MOVE_INVALIDATE_M,
  type WeatherCacheRecord,
  type WeatherSnapshot,
} from './types.ts';

const CACHE_KEY = 'medicard.weather.cache.v2';

let memory: WeatherCacheRecord | null = null;

export function locationChangedMeaningfully(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  meters = WEATHER_MOVE_INVALIDATE_M,
): boolean {
  return metersBetween(a, b) >= meters;
}

export function isCacheFresh(record: WeatherCacheRecord | null, now = Date.now()): boolean {
  if (!record) return false;
  return now - record.fetchedAt < WEATHER_CACHE_TTL_MS;
}

export async function readWeatherCache(): Promise<WeatherCacheRecord | null> {
  if (memory) return memory;
  const raw = await getPreference(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WeatherCacheRecord;
    if (!parsed?.snapshot || !Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) {
      return null;
    }
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWeatherCache(record: WeatherCacheRecord): Promise<void> {
  memory = record;
  await setPreference(CACHE_KEY, JSON.stringify(record));
}

export function peekWeatherMemory(): WeatherCacheRecord | null {
  return memory;
}

export async function loadWeatherSnapshot(input: {
  latitude: number;
  longitude: number;
  city?: string | null;
  force?: boolean;
  now?: number;
}): Promise<{ snapshot: WeatherSnapshot; fromCache: boolean; stale: boolean }> {
  const now = input.now ?? Date.now();
  const cached = await readWeatherCache();
  const samePlace =
    cached &&
    !locationChangedMeaningfully(
      { lat: cached.latitude, lng: cached.longitude },
      { lat: input.latitude, lng: input.longitude },
    );
  if (samePlace && cached && (input.force ? false : isCacheFresh(cached, now))) {
    return {
      snapshot: {
        ...cached.snapshot,
        location: { ...cached.snapshot.location, city: input.city ?? cached.snapshot.location.city },
      },
      fromCache: true,
      stale: false,
    };
  }

  try {
    const snapshot = await fetchOpenMeteoSnapshot(input.latitude, input.longitude, input.city);
    await writeWeatherCache({
      latitude: input.latitude,
      longitude: input.longitude,
      snapshot,
      fetchedAt: now,
    });
    return { snapshot, fromCache: false, stale: false };
  } catch {
    if (samePlace && cached) {
      return {
        snapshot: {
          ...cached.snapshot,
          location: { ...cached.snapshot.location, city: input.city ?? cached.snapshot.location.city },
        },
        fromCache: true,
        stale: true,
      };
    }
    throw new Error('weather_unavailable');
  }
}
