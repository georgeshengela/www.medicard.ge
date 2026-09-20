import { metersBetween } from '@/lib/geoPlace';
import { deletePreference, getPreference, setPreference } from '@/lib/storage';
import { localAccountId } from '@/lib/localAccount';
import { fetchOpenMeteoSnapshot } from './openMeteo.ts';
import {
  WEATHER_CACHE_TTL_MS,
  WEATHER_MOVE_INVALIDATE_M,
  type WeatherCacheRecord,
  type WeatherSnapshot,
} from './types.ts';

const CACHE_KEY = 'medicard.weather.cache.v2';

let memory: { owner: string; record: WeatherCacheRecord } | null = null;
let generation = 0;

export function locationChangedMeaningfully(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  meters = WEATHER_MOVE_INVALIDATE_M,
): boolean {
  return metersBetween(a, b) >= meters;
}

export function isCacheFresh(record: WeatherCacheRecord | null, now = Date.now()): boolean {
  if (!record) return false;
  return Number.isFinite(record.fetchedAt) && now >= record.fetchedAt && now - record.fetchedAt < WEATHER_CACHE_TTL_MS;
}

export async function readWeatherCache(owner = localAccountId()): Promise<WeatherCacheRecord | null> {
  if (!owner || owner !== localAccountId()) return null;
  if (memory?.owner === owner) return memory.record;
  const ticket = generation;
  const raw = await getPreference(`${CACHE_KEY}.${owner}`);
  if (owner !== localAccountId() || ticket !== generation) return null;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WeatherCacheRecord;
    if (!parsed?.snapshot || !Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) {
      return null;
    }
    memory = { owner, record: parsed };
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWeatherCache(record: WeatherCacheRecord, owner = localAccountId()): Promise<void> {
  if (!owner || owner !== localAccountId()) return;
  memory = { owner, record };
  await setPreference(`${CACHE_KEY}.${owner}`, JSON.stringify(record));
}

export async function clearWeatherCache(owner = localAccountId()): Promise<void> {
  generation++;
  if (memory?.owner === owner) memory = null;
  if (owner) await deletePreference(`${CACHE_KEY}.${owner}`);
}

export function peekWeatherMemory(): WeatherCacheRecord | null {
  return memory?.owner === localAccountId() ? memory.record : null;
}

export async function loadWeatherSnapshot(input: {
  latitude: number;
  longitude: number;
  city?: string | null;
  force?: boolean;
  now?: number;
}): Promise<{ snapshot: WeatherSnapshot; fromCache: boolean; stale: boolean }> {
  const now = input.now ?? Date.now();
  const owner = localAccountId(), ticket = generation;
  const cached = await readWeatherCache(owner);
  if (owner !== localAccountId() || ticket !== generation) throw new Error('weather_request_superseded');
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
    if (owner !== localAccountId() || ticket !== generation) throw new Error('weather_request_superseded');
    if (owner === localAccountId() && ticket === generation) await writeWeatherCache({
      latitude: input.latitude,
      longitude: input.longitude,
      snapshot,
      fetchedAt: now,
    }, owner);
    return { snapshot, fromCache: false, stale: false };
  } catch {
    if (owner !== localAccountId() || ticket !== generation) throw new Error('weather_request_superseded');
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
