import type { WeatherCondition } from './types.ts';

/** WMO weather interpretation codes → one canonical condition. */
export function conditionFromWeatherCode(code: number | null | undefined): WeatherCondition {
  const n = Number(code);
  if (!Number.isFinite(n)) return 'partly_cloudy';
  if (n === 0) return 'clear';
  if (n === 1) return 'mostly_clear';
  if (n === 2) return 'partly_cloudy';
  if (n === 3) return 'cloudy';
  if (n === 45 || n === 48) return 'fog';
  if (n === 51 || n === 53 || n === 55 || n === 56 || n === 57) return 'drizzle';
  if (n === 61 || n === 63 || n === 66 || n === 80 || n === 81) return 'rain';
  if (n === 65 || n === 67 || n === 82) return 'heavy_rain';
  if (n === 71 || n === 73 || n === 85) return 'snow';
  if (n === 75 || n === 77 || n === 86) return 'heavy_snow';
  if (n === 95 || n === 96 || n === 99) return 'storm';
  return 'partly_cloudy';
}

export function isStormCondition(condition: WeatherCondition): boolean {
  return condition === 'storm';
}

export function isHeavyPrecipCondition(condition: WeatherCondition): boolean {
  return condition === 'heavy_rain' || condition === 'heavy_snow' || condition === 'storm';
}

export function isWetCondition(condition: WeatherCondition): boolean {
  return condition === 'drizzle' || condition === 'rain' || condition === 'heavy_rain' || condition === 'storm';
}
