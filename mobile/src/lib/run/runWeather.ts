import type { WeatherCondition, WeatherSnapshot } from '../weather/types.ts';

/** What the MEDIRUN map draws over the city (`WEATHER_FX_JS`). The Glow city is always night, so clear sky draws nothing. */
export type RunWeatherKind = 'none' | 'clouds' | 'fog' | 'drizzle' | 'rain' | 'heavy_rain' | 'storm' | 'snow' | 'heavy_snow';
export type RunWeatherFx = { kind: RunWeatherKind; wind: number };

/** Weather older than this is not drawn: an old shower on the map would be a lie. */
export const RUN_WEATHER_MAX_AGE_MS = 3 * 60 * 60_000;
/** Re-read the weather this often during a session, and when the runner moved this far. */
export const RUN_WEATHER_REFRESH_MS = 15 * 60_000;
export const RUN_WEATHER_MOVE_M = 2500;

const BY_CONDITION: Record<WeatherCondition, RunWeatherKind> = {
  clear: 'none',
  mostly_clear: 'none',
  partly_cloudy: 'none',
  cloudy: 'clouds',
  fog: 'fog',
  drizzle: 'drizzle',
  rain: 'rain',
  heavy_rain: 'heavy_rain',
  snow: 'snow',
  heavy_snow: 'heavy_snow',
  storm: 'storm',
};

export function runWeatherFx(snapshot: WeatherSnapshot | null | undefined, now = Date.now()): RunWeatherFx | null {
  if (!snapshot?.current) return null;
  const at = Date.parse(snapshot.updatedAt);
  if (Number.isFinite(at) && now - at > RUN_WEATHER_MAX_AGE_MS) return null;
  const cur = snapshot.current;
  let kind = BY_CONDITION[cur.condition] ?? 'none';
  // The code says cloudy but it is measurably falling right now: show it.
  const falling = Number(cur.precipitationMm) >= 0.2;
  if (falling && (kind === 'none' || kind === 'clouds' || kind === 'fog')) kind = cur.temperatureC <= 0.5 ? 'snow' : 'rain';
  const wind = Number.isFinite(cur.windKmh) ? Math.max(0, Math.round(cur.windKmh)) : 0;
  return { kind, wind };
}

export function sameRunWeatherFx(a: RunWeatherFx | null, b: RunWeatherFx | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && Math.abs(a.wind - b.wind) < 5;
}
