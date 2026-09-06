import type { AirQualityBand, AirQualitySnapshot, WeatherSnapshot } from './types.ts';

const OPEN_METEO_AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

type OpenMeteoAirQuality = {
  current?: {
    european_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
    sulphur_dioxide?: number;
  };
  hourly?: {
    time?: string[];
    european_aqi?: number[];
  };
};

function numOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** EEA European AQI bands (2024). */
export function bandFromEuropeanAqi(aqi: number): AirQualityBand {
  if (aqi > 100) return 'extremely_poor';
  if (aqi >= 80) return 'very_poor';
  if (aqi >= 60) return 'poor';
  if (aqi >= 40) return 'moderate';
  if (aqi >= 20) return 'fair';
  return 'good';
}

export function airQualityIsHeavy(aqi: number | null | undefined): boolean {
  return aqi != null && aqi >= 60;
}

export function buildOpenMeteoAirQualityUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: ['european_aqi', 'pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'sulphur_dioxide'].join(','),
    hourly: 'european_aqi',
    timezone: 'auto',
    forecast_days: '2',
  });
  return `${OPEN_METEO_AQ_URL}?${params.toString()}`;
}

export function normalizeOpenMeteoAirQuality(raw: OpenMeteoAirQuality): {
  current: AirQualitySnapshot | null;
  hourly: Map<string, number>;
} {
  const aqi = numOrNull(raw.current?.european_aqi);
  const hourly = new Map<string, number>();
  const times = raw.hourly?.time ?? [];
  for (let i = 0; i < times.length; i++) {
    const value = numOrNull(raw.hourly?.european_aqi?.[i]);
    if (value != null) hourly.set(times[i], value);
  }
  if (aqi == null) return { current: null, hourly };
  return {
    current: {
      europeanAqi: Math.round(aqi),
      band: bandFromEuropeanAqi(aqi),
      pm25: numOrNull(raw.current?.pm2_5),
      pm10: numOrNull(raw.current?.pm10),
      no2: numOrNull(raw.current?.nitrogen_dioxide),
      o3: numOrNull(raw.current?.ozone),
      so2: numOrNull(raw.current?.sulphur_dioxide),
    },
    hourly,
  };
}

export function attachAirQuality(snapshot: WeatherSnapshot, raw: OpenMeteoAirQuality): WeatherSnapshot {
  const { current, hourly } = normalizeOpenMeteoAirQuality(raw);
  return {
    ...snapshot,
    airQuality: current,
    hourly: snapshot.hourly.map((hour) => ({
      ...hour,
      europeanAqi: hourly.get(hour.time) ?? hour.europeanAqi ?? null,
    })),
  };
}

export async function fetchOpenMeteoAirQuality(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<OpenMeteoAirQuality> {
  const response = await fetch(buildOpenMeteoAirQualityUrl(lat, lng), { signal });
  if (!response.ok) throw new Error(`open_meteo_aq_${response.status}`);
  return (await response.json()) as OpenMeteoAirQuality;
}
