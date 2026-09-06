import type { HealthProfile } from '@/lib/api';
import { isCacheFresh, loadWeatherSnapshot, locationChangedMeaningfully, readWeatherCache } from './cache.ts';
import { loadWeatherWellnessContext, weatherCityFromProfile, weatherCoordsFromProfile } from './context.ts';
import { getWeatherWellnessRecommendation, stepsGoalReached, weatherWindowFireAt } from './recommendation.ts';
import type { WeatherPushCandidate, WeatherSnapshot } from './types.ts';

export type WeatherEngageSignal = {
  candidate: WeatherPushCandidate;
  category: string;
  windowStartIso: string | null;
  stale: boolean;
  stepsGoalReached?: boolean;
};

export const WEATHER_PUSH_KEYS: Record<WeatherPushCandidate, string> = {
  weather_good_walk: 'engage-weather-walk',
  weather_rain_soon: 'engage-weather-rain-soon',
  weather_hot_hydration: 'engage-weather-hot',
  weather_high_uv: 'engage-weather-uv',
};

export function weatherKeyToCandidate(key: string): WeatherPushCandidate | null {
  const hit = (Object.entries(WEATHER_PUSH_KEYS) as Array<[WeatherPushCandidate, string]>).find(([, value]) => value === key);
  return hit?.[0] ?? null;
}

export async function loadWeatherEngageSignal(input: {
  profile?: HealthProfile | null;
  userKey?: string | null;
  loggedPain?: boolean;
  now?: Date;
}): Promise<WeatherEngageSignal | null> {
  const coords = weatherCoordsFromProfile(input.profile);
  if (!coords) return null;
  const city = weatherCityFromProfile(input.profile);
  try {
    const cached = await readWeatherCache();
    const samePlace =
      cached &&
      !locationChangedMeaningfully(
        { lat: cached.latitude, lng: cached.longitude },
        coords,
      );
    let snapshot: WeatherSnapshot | null = samePlace && cached && isCacheFresh(cached) ? cached.snapshot : null;
    if (!snapshot) {
      const loaded = await Promise.race([
        loadWeatherSnapshot({ latitude: coords.lat, longitude: coords.lng, city }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('weather_timeout')), 5000)),
      ]);
      snapshot = loaded.snapshot;
    }
    const ctx = await loadWeatherWellnessContext({
      profile: input.profile,
      userKey: input.userKey,
      loggedPain: input.loggedPain,
      now: input.now,
    });
    const rec = getWeatherWellnessRecommendation(snapshot, ctx);
    if (!rec.pushCandidate || rec.adviceKind === 'cached') return null;
    return {
      candidate: rec.pushCandidate,
      category: rec.category,
      windowStartIso: rec.bestOutdoorWindow?.startIso ?? null,
      stale: false,
      stepsGoalReached: stepsGoalReached(ctx),
    };
  } catch {
    return null;
  }
}

export async function recheckWeatherForDelivery(input: {
  profile?: HealthProfile | null;
  userKey?: string | null;
  loggedPain?: boolean;
  expected?: WeatherPushCandidate | null;
  now?: Date;
}): Promise<{
  candidate: WeatherPushCandidate | null;
  windowGone: boolean;
  rainChanged: boolean;
  stale: boolean;
  stepsGoalReached: boolean;
  hydrationBehindNow: boolean;
}> {
  const live = await loadWeatherEngageSignal(input);
  const expected = input.expected ?? null;
  const rainChanged = expected === 'weather_rain_soon' && live?.candidate !== 'weather_rain_soon';
  const windowGone = expected === 'weather_good_walk' && live?.candidate !== 'weather_good_walk';
  return {
    candidate: live?.candidate ?? null,
    windowGone,
    rainChanged,
    stale: !live,
    stepsGoalReached: Boolean(live?.stepsGoalReached),
    hydrationBehindNow: live?.candidate === 'weather_hot_hydration',
  };
}

export { weatherWindowFireAt };
