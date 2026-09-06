import { attachAirQuality, fetchOpenMeteoAirQuality } from './airQuality.ts';
import { conditionFromWeatherCode } from './conditions.ts';
import type { WeatherDay, WeatherHour, WeatherSnapshot } from './types.ts';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

type OpenMeteoResponse = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    precipitation?: number;
    rain?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    apparent_temperature?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
    uv_index?: number[];
    visibility?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: number[];
  };
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildOpenMeteoUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'precipitation',
      'rain',
      'wind_speed_10m',
      'wind_gusts_10m',
      'is_day',
    ].join(','),
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'precipitation_probability',
      'weather_code',
      'wind_speed_10m',
      'uv_index',
      'visibility',
    ].join(','),
    daily: [
      'temperature_2m_min',
      'temperature_2m_max',
      'precipitation_probability_max',
      'weather_code',
      'sunrise',
      'sunset',
      'uv_index_max',
    ].join(','),
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });
  return `${OPEN_METEO_URL}?${params.toString()}`;
}

export function normalizeOpenMeteo(
  raw: OpenMeteoResponse,
  input: { latitude: number; longitude: number; city?: string | null },
  updatedAt = new Date().toISOString(),
): WeatherSnapshot {
  const current = raw.current ?? {};
  const hourly = raw.hourly ?? {};
  const daily = raw.daily ?? {};
  const timezone = raw.timezone || 'UTC';
  const weatherCode = num(current.weather_code);
  const hours: WeatherHour[] = [];
  const times = hourly.time ?? [];
  for (let i = 0; i < times.length; i++) {
    const code = num(hourly.weather_code?.[i]);
    hours.push({
      time: times[i],
      temperatureC: num(hourly.temperature_2m?.[i]),
      feelsLikeC: num(hourly.apparent_temperature?.[i], num(hourly.temperature_2m?.[i])),
      precipitationProbability: numOrNull(hourly.precipitation_probability?.[i]),
      weatherCode: code,
      condition: conditionFromWeatherCode(code),
      windKmh: num(hourly.wind_speed_10m?.[i]),
      uvIndex: numOrNull(hourly.uv_index?.[i]),
      visibilityM: numOrNull(hourly.visibility?.[i]),
    });
  }

  const days: WeatherDay[] = [];
  const dayTimes = daily.time ?? [];
  for (let i = 0; i < dayTimes.length; i++) {
    const code = num(daily.weather_code?.[i]);
    days.push({
      date: dayTimes[i],
      minC: num(daily.temperature_2m_min?.[i]),
      maxC: num(daily.temperature_2m_max?.[i]),
      precipitationProbability: numOrNull(daily.precipitation_probability_max?.[i]),
      weatherCode: code,
      condition: conditionFromWeatherCode(code),
      uvMax: numOrNull(daily.uv_index_max?.[i]),
      sunrise: daily.sunrise?.[i] ?? null,
      sunset: daily.sunset?.[i] ?? null,
    });
  }

  const today = days[0] ?? {
    date: String(current.time || '').slice(0, 10),
    minC: num(current.temperature_2m),
    maxC: num(current.temperature_2m),
    precipitationProbability: null,
    weatherCode,
    condition: conditionFromWeatherCode(weatherCode),
    uvMax: null,
    sunrise: null,
    sunset: null,
  };

  return {
    location: {
      city: input.city ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      timezone,
    },
    current: {
      temperatureC: num(current.temperature_2m),
      feelsLikeC: num(current.apparent_temperature, num(current.temperature_2m)),
      weatherCode,
      condition: conditionFromWeatherCode(weatherCode),
      isDay: current.is_day !== 0,
      precipitationMm: num(current.precipitation ?? current.rain),
      windKmh: num(current.wind_speed_10m),
      windGustKmh: numOrNull(current.wind_gusts_10m),
    },
    today: {
      minC: today.minC,
      maxC: today.maxC,
      precipitationProbability: today.precipitationProbability,
      uvMax: today.uvMax,
      sunrise: today.sunrise,
      sunset: today.sunset,
    },
    daily: days,
    hourly: hours,
    airQuality: null,
    updatedAt,
  };
}

export async function fetchOpenMeteoSnapshot(
  lat: number,
  lng: number,
  city?: string | null,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const [weatherRes, aqRes] = await Promise.allSettled([
    fetch(buildOpenMeteoUrl(lat, lng), { signal }),
    fetchOpenMeteoAirQuality(lat, lng, signal),
  ]);
  if (weatherRes.status !== 'fulfilled') throw weatherRes.reason;
  if (!weatherRes.value.ok) throw new Error(`open_meteo_${weatherRes.value.status}`);
  const raw = (await weatherRes.value.json()) as OpenMeteoResponse;
  const snapshot = normalizeOpenMeteo(raw, { latitude: lat, longitude: lng, city });
  if (aqRes.status !== 'fulfilled') return snapshot;
  return attachAirQuality(snapshot, aqRes.value);
}
