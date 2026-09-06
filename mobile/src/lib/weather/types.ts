export const WEATHER_CONDITIONS = [
  'clear',
  'mostly_clear',
  'partly_cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'heavy_rain',
  'snow',
  'heavy_snow',
  'storm',
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export const WEATHER_CATEGORIES = [
  'excellent_outdoor',
  'good_outdoor',
  'okay_outdoor',
  'rainy',
  'heavy_rain',
  'rain_soon',
  'very_hot',
  'hot',
  'cold',
  'very_cold',
  'high_uv',
  'very_windy',
  'storm',
  'poor_visibility',
  'evening',
  'night',
  'morning',
  'mixed',
] as const;

export type WeatherCategory = (typeof WEATHER_CATEGORIES)[number];

export type WeatherSeverity = 'calm' | 'caution' | 'avoid';

export type WeatherLang = 'ka' | 'en' | 'fr' | 'ru';

export type WeatherHour = {
  time: string;
  temperatureC: number;
  feelsLikeC: number;
  precipitationProbability: number | null;
  weatherCode: number;
  condition: WeatherCondition;
  windKmh: number;
  uvIndex: number | null;
  visibilityM: number | null;
};

export type WeatherDay = {
  date: string;
  minC: number;
  maxC: number;
  precipitationProbability: number | null;
  weatherCode: number;
  condition: WeatherCondition;
  uvMax: number | null;
  sunrise: string | null;
  sunset: string | null;
};

export type WeatherSnapshot = {
  location: {
    city: string | null;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    temperatureC: number;
    feelsLikeC: number;
    weatherCode: number;
    condition: WeatherCondition;
    isDay: boolean;
    precipitationMm: number;
    windKmh: number;
    windGustKmh: number | null;
  };
  today: {
    minC: number;
    maxC: number;
    precipitationProbability: number | null;
    uvMax: number | null;
    sunrise: string | null;
    sunset: string | null;
  };
  daily: WeatherDay[];
  hourly: WeatherHour[];
  updatedAt: string;
};

export type OutdoorWindow = {
  start: string;
  end: string;
  startIso: string;
  endIso: string;
  score: number;
  reasonCodes: string[];
  day: 'today' | 'tomorrow';
  label: 'best' | 'good';
};

export type WeatherWellnessContext = {
  now?: Date;
  todaySteps?: number | null;
  stepsDailyTarget?: number | null;
  hydrationMl?: number | null;
  hydrationGoalMl?: number | null;
  loggedPain?: boolean;
  locale?: WeatherLang;
  userKey?: string | null;
};

export type WeatherPushCandidate =
  | 'weather_good_walk'
  | 'weather_rain_soon'
  | 'weather_hot_hydration'
  | 'weather_high_uv';

export type WeatherRecommendation = {
  category: WeatherCategory;
  severity: WeatherSeverity;
  titleKey: string;
  bodyKey: string;
  icon: WeatherCondition | 'night' | 'umbrella' | 'sun' | 'wind';
  bestOutdoorWindow: OutdoorWindow | null;
  reasonCodes: string[];
  adviceKind: 'live' | 'cached';
  pushCandidate: WeatherPushCandidate | null;
};

export type WeatherCacheRecord = {
  latitude: number;
  longitude: number;
  snapshot: WeatherSnapshot;
  fetchedAt: number;
};

export const WEATHER_CACHE_TTL_MS = 20 * 60_000;
export const WEATHER_STALE_ADVICE_MS = 90 * 60_000;
export const WEATHER_MOVE_INVALIDATE_M = 2000;
export const WEATHER_WINDOW_MIN_SCORE = 28;
