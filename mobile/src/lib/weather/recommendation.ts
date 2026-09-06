import { airQualityIsHeavy } from './airQuality.ts';
import { isStormCondition, isWetCondition } from './conditions.ts';
import { pickWeatherCopyKeys } from './copy.ts';
import { findBestOutdoorWindow, rainArrivingSoon } from './outdoorWindow.ts';
import { localHourFromIso, localYmdFromIso, weatherAgeMs, zonedParts } from './time.ts';
import {
  WEATHER_STALE_ADVICE_MS,
  type OutdoorWindow,
  type WeatherCategory,
  type WeatherPushCandidate,
  type WeatherRecommendation,
  type WeatherSeverity,
  type WeatherSnapshot,
  type WeatherWellnessContext,
} from './types.ts';

export function isWeatherStale(weather: WeatherSnapshot, now = Date.now()): boolean {
  return weatherAgeMs(weather.updatedAt, now) > WEATHER_STALE_ADVICE_MS;
}

export function stepsAreLow(ctx: WeatherWellnessContext): boolean {
  if (ctx.todaySteps == null) return false;
  if (ctx.stepsDailyTarget != null && ctx.stepsDailyTarget > 0) {
    return ctx.todaySteps < ctx.stepsDailyTarget * 0.35;
  }
  return ctx.todaySteps < 1800;
}

export function stepsGoalReached(ctx: WeatherWellnessContext): boolean {
  if (ctx.todaySteps == null || ctx.stepsDailyTarget == null || ctx.stepsDailyTarget <= 0) return false;
  return ctx.todaySteps >= ctx.stepsDailyTarget;
}

export function hydrationBehind(ctx: WeatherWellnessContext): boolean {
  const goal = ctx.hydrationGoalMl ?? 0;
  const ml = ctx.hydrationMl ?? 0;
  return goal > 0 && ml < goal * 0.55;
}

function partOfDay(hour: number): 'night' | 'morning' | 'day' | 'evening' {
  if (hour < 6 || hour >= 21) return 'night';
  if (hour < 11) return 'morning';
  if (hour >= 18) return 'evening';
  return 'day';
}

function visibilityPoor(weather: WeatherSnapshot): boolean {
  if (weather.current.condition === 'fog') return true;
  const hour = weather.hourly[0];
  return hour?.visibilityM != null && hour.visibilityM < 1000;
}

function classifyCategory(
  weather: WeatherSnapshot,
  now: Date,
  window: OutdoorWindow | null,
  stale: boolean,
): { category: WeatherCategory; severity: WeatherSeverity; reasons: string[] } {
  const feels = weather.current.feelsLikeC;
  const wind = Math.max(weather.current.windKmh, weather.current.windGustKmh ?? 0);
  const uv = weather.today.uvMax;
  const parts = zonedParts(now, weather.location.timezone || 'UTC');
  const tod = partOfDay(parts.hour);
  const reasons: string[] = [];

  if (isStormCondition(weather.current.condition)) {
    return { category: 'storm', severity: 'avoid', reasons: ['storm'] };
  }
  if (feels >= 35 || weather.current.temperatureC >= 36) {
    return { category: 'very_hot', severity: 'avoid', reasons: ['extreme_heat', 'feels_like'] };
  }
  if (feels <= -5 || weather.current.temperatureC <= -8) {
    return { category: 'very_cold', severity: 'avoid', reasons: ['extreme_cold', 'feels_like'] };
  }
  if (weather.current.condition === 'heavy_rain' || weather.current.precipitationMm >= 4) {
    return { category: 'heavy_rain', severity: 'avoid', reasons: ['heavy_rain'] };
  }
  if (wind > 50) {
    return { category: 'very_windy', severity: 'avoid', reasons: ['extreme_wind'] };
  }
  if (!stale && uv != null && uv >= 8 && weather.current.isDay) {
    reasons.push('very_high_uv');
    if (window && window.day === 'today' && window.score >= 40) reasons.push('otherwise_pleasant');
    return { category: 'high_uv', severity: 'caution', reasons };
  }
  if (isWetCondition(weather.current.condition) || (weather.today.precipitationProbability ?? 0) >= 60) {
    return { category: 'rainy', severity: 'caution', reasons: ['rain'] };
  }
  if (wind > 32) {
    return { category: 'very_windy', severity: 'caution', reasons: ['strong_wind'] };
  }
  if (feels >= 30) {
    return { category: 'hot', severity: 'caution', reasons: ['hot', 'feels_like'] };
  }
  if (feels <= 4) {
    return { category: 'cold', severity: 'caution', reasons: ['cold', 'feels_like'] };
  }
  if (!stale && rainArrivingSoon(weather, now)) {
    return { category: 'rain_soon', severity: 'caution', reasons: ['rain_arriving_soon'] };
  }
  if (visibilityPoor(weather)) {
    return { category: 'poor_visibility', severity: 'caution', reasons: ['poor_visibility'] };
  }
  if (tod === 'night' || !weather.current.isDay) {
    return { category: 'night', severity: 'calm', reasons: ['night'] };
  }
  if (tod === 'evening' && window && window.day === 'today') {
    return { category: 'evening', severity: 'calm', reasons: ['evening', ...window.reasonCodes] };
  }
  if (tod === 'morning' && window && window.day === 'today') {
    return { category: 'morning', severity: 'calm', reasons: ['morning', ...window.reasonCodes] };
  }
  if (window && window.day === 'today') {
    if (window.score >= 70) {
      return { category: 'excellent_outdoor', severity: 'calm', reasons: window.reasonCodes };
    }
    if (window.score >= 45) {
      return { category: 'good_outdoor', severity: 'calm', reasons: window.reasonCodes };
    }
    if (window.score >= 28) {
      return { category: 'okay_outdoor', severity: 'calm', reasons: window.reasonCodes };
    }
  }
  if (!window) reasons.push('no_valid_window');
  return { category: 'mixed', severity: 'calm', reasons: reasons.length ? reasons : ['neutral'] };
}

function pickPushCandidate(
  category: WeatherCategory,
  ctx: WeatherWellnessContext,
  window: OutdoorWindow | null,
  now: Date,
  stale: boolean,
  weatherTz: string,
): WeatherPushCandidate | null {
  if (stale) return null;
  if (category === 'storm' || category === 'very_hot' || category === 'very_cold') return null;
  if (ctx.loggedPain && category !== 'weather_hot_hydration') {
    /* walk pushes stay off when pain is present */
  }
  if (category === 'rain_soon') return 'weather_rain_soon';
  if ((category === 'hot' || category === 'very_hot') && hydrationBehind(ctx)) {
    return 'weather_hot_hydration';
  }
  if (category === 'high_uv' && !ctx.loggedPain) return 'weather_high_uv';
  const walkish =
    category === 'excellent_outdoor' ||
    category === 'good_outdoor' ||
    category === 'okay_outdoor' ||
    category === 'morning' ||
    category === 'evening' ||
    category === 'rain_soon';
  if (
    walkish &&
    !ctx.loggedPain &&
    !stepsGoalReached(ctx) &&
    stepsAreLow(ctx) &&
    window &&
    window.day === 'today'
  ) {
    const startH = localHourFromIso(window.startIso);
    if (startH != null) {
      const hoursUntil = startH - zonedParts(now, weatherTz).hour;
      if (hoursUntil >= 0 && hoursUntil <= 2) return 'weather_good_walk';
    }
  }
  return null;
}

export function getWeatherWellnessRecommendation(
  weather: WeatherSnapshot,
  context: WeatherWellnessContext = {},
): WeatherRecommendation {
  const now = context.now ?? new Date();
  const stale = isWeatherStale(weather, now.getTime());
  const window = findBestOutdoorWindow(weather, now);
  const { category, severity, reasons } = classifyCategory(weather, now, window, stale);
  const walkish =
    category === 'excellent_outdoor' ||
    category === 'good_outdoor' ||
    category === 'okay_outdoor' ||
    category === 'morning' ||
    category === 'evening';

  let flavor: 'default' | 'pain' | 'steps_low' | 'steps_done' | 'hydration' = 'default';
  if (context.loggedPain && walkish) {
    flavor = 'pain';
    reasons.push('pain_context');
  } else if (stepsGoalReached(context) && walkish) {
    flavor = 'steps_done';
    reasons.push('steps_goal_reached');
  } else if (stepsAreLow(context) && walkish && !context.loggedPain) {
    flavor = 'steps_low';
    reasons.push('low_steps');
  } else if (hydrationBehind(context) && (category === 'hot' || category === 'very_hot')) {
    flavor = 'hydration';
    reasons.push('hydration_behind');
  }

  const shownWindow = stale && window?.day === 'today' ? window : window;
  const keys = pickWeatherCopyKeys({
    category,
    flavor,
    locale: context.locale ?? 'ka',
    seed: `${localYmdFromIso(weather.updatedAt) || zonedParts(now, weather.location.timezone).ymd}|${category}|${flavor}|${context.userKey || 'anon'}`,
  });

  const icon =
    category === 'night' || category === 'evening'
      ? 'night'
      : category === 'rainy' || category === 'rain_soon' || category === 'heavy_rain'
        ? 'umbrella'
        : category === 'very_windy'
          ? 'wind'
          : category === 'high_uv' || category === 'hot' || category === 'very_hot'
            ? 'sun'
            : weather.current.condition;

  let push = pickPushCandidate(category, context, window, now, stale, weather.location.timezone || 'UTC');
  if (flavor === 'pain' && push === 'weather_good_walk') push = null;
  if (flavor === 'steps_done' && push === 'weather_good_walk') push = null;
  if (airQualityIsHeavy(weather.airQuality?.europeanAqi)) {
    if (!reasons.includes('poor_air')) reasons.push('poor_air');
    if (push === 'weather_good_walk') push = null;
  }
  if (stale) push = null;

  return {
    category,
    severity,
    titleKey: keys.titleKey,
    bodyKey: keys.bodyKey,
    icon,
    bestOutdoorWindow: shownWindow,
    reasonCodes: reasons,
    adviceKind: stale ? 'cached' : 'live',
    pushCandidate: push,
  };
}

export function weatherWindowFireAt(window: OutdoorWindow | null, now: Date): Date | null {
  if (!window || window.day !== 'today') return null;
  const hour = localHourFromIso(window.startIso);
  if (hour == null) return null;
  const fire = new Date(now);
  fire.setHours(Math.max(0, hour), 0, 0, 0);
  fire.setMinutes(fire.getMinutes() - 30);
  if (fire.getTime() <= now.getTime() + 60_000) {
    fire.setTime(now.getTime() + 20 * 60_000);
  }
  return fire;
}
