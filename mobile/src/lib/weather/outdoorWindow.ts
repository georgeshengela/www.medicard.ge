/**
 * Best outdoor window scoring (daylight hours only).
 *
 * Hour score (feels-like °C, rain %, wind km/h, UV):
 *   temp 15–22 +30 · 10–25 +20 · 8–28 +8 · >30 −20 · >35 −35 · <5 −20 · <0 −35
 *   rain ≤10 +30 · ≤30 +15 · ≥60 −20 · ≥80 −40
 *   wind <15 +15 · 15–30 0 · >30 −20 · >50 −40
 *   UV ≤2 +5 · 3–5 0 · 6–7 −10 · ≥8 −20
 *   EAQI <20 +5 · 40–59 −8 · 60–79 −20 · 80–100 −40 · >100 disqualify
 * Storm / heavy precip: disqualify.
 * Night (before sunrise / after sunset): disqualify for walk windows.
 * Window = best contiguous 2h (fallback 1h). Valid if average ≥ WEATHER_WINDOW_MIN_SCORE.
 * If every slot is bad, return null — never invent a time.
 */
import { isHeavyPrecipCondition, isStormCondition } from './conditions.ts';
import { formatHourRange, localHourFromIso, localYmdFromIso, zonedParts } from './time.ts';
import {
  WEATHER_WINDOW_MIN_SCORE,
  type OutdoorWindow,
  type WeatherHour,
  type WeatherSnapshot,
} from './types.ts';

export type HourScore = {
  hour: WeatherHour;
  score: number;
  reasons: string[];
  disqualified: boolean;
};

function sunriseHour(iso: string | null | undefined): number {
  return localHourFromIso(iso) ?? 6;
}

function sunsetHour(iso: string | null | undefined): number {
  return localHourFromIso(iso) ?? 20;
}

function dayForYmd(weather: WeatherSnapshot, ymd: string) {
  return weather.daily.find((day) => day.date === ymd) ?? (weather.today.sunrise ? weather.daily[0] : null);
}

export function scoreOutdoorHour(
  hour: WeatherHour,
  bounds: { sunriseH: number; sunsetH: number },
  fallbackAqi?: number | null,
): HourScore {
  const reasons: string[] = [];
  if (isStormCondition(hour.condition) || isHeavyPrecipCondition(hour.condition)) {
    return { hour, score: -100, reasons: ['storm_or_heavy_precip'], disqualified: true };
  }
  const h = localHourFromIso(hour.time);
  if (h == null || h < bounds.sunriseH || h >= bounds.sunsetH) {
    return { hour, score: -80, reasons: ['not_daylight'], disqualified: true };
  }

  let score = 0;
  const temp = hour.feelsLikeC;
  if (temp >= 15 && temp <= 22) {
    score += 30;
    reasons.push('pleasant_temp');
  } else if (temp >= 10 && temp <= 25) {
    score += 20;
    reasons.push('comfortable_temp');
  } else if (temp >= 8 && temp <= 28) {
    score += 8;
    reasons.push('ok_temp');
  } else if (temp > 35) {
    score -= 35;
    reasons.push('extreme_heat');
  } else if (temp > 30) {
    score -= 20;
    reasons.push('hot');
  } else if (temp < 0) {
    score -= 35;
    reasons.push('extreme_cold');
  } else if (temp < 5) {
    score -= 20;
    reasons.push('cold');
  }

  const rain = hour.precipitationProbability;
  if (rain != null) {
    if (rain <= 10) {
      score += 30;
      reasons.push('low_rain');
    } else if (rain <= 30) {
      score += 15;
      reasons.push('mild_rain_risk');
    } else if (rain >= 80) {
      score -= 40;
      reasons.push('very_likely_rain');
    } else if (rain >= 60) {
      score -= 20;
      reasons.push('likely_rain');
    }
  }

  if (hour.windKmh < 15) {
    score += 15;
    reasons.push('low_wind');
  } else if (hour.windKmh > 50) {
    score -= 40;
    reasons.push('extreme_wind');
  } else if (hour.windKmh > 30) {
    score -= 20;
    reasons.push('strong_wind');
  }

  const uv = hour.uvIndex;
  if (uv != null) {
    if (uv <= 2) {
      score += 5;
      reasons.push('low_uv');
    } else if (uv >= 8) {
      score -= 20;
      reasons.push('very_high_uv');
    } else if (uv >= 6) {
      score -= 10;
      reasons.push('high_uv');
    }
  }

  const aqi = hour.europeanAqi ?? fallbackAqi;
  if (aqi != null) {
    if (aqi > 100) {
      return { hour, score: -90, reasons: ['extremely_poor_air'], disqualified: true };
    }
    if (aqi >= 80) {
      score -= 40;
      reasons.push('very_poor_air');
    } else if (aqi >= 60) {
      score -= 20;
      reasons.push('poor_air');
    } else if (aqi >= 40) {
      score -= 8;
      reasons.push('moderate_air');
    } else if (aqi < 20) {
      score += 5;
      reasons.push('good_air');
    }
  }

  reasons.push('daylight');
  return { hour, score, reasons, disqualified: false };
}

function pickWindow(
  scored: HourScore[],
  ymd: string,
  day: OutdoorWindow['day'],
): OutdoorWindow | null {
  const usable = scored.filter((row) => !row.disqualified && localYmdFromIso(row.hour.time) === ymd);
  if (!usable.length) return null;

  let best: { start: HourScore; end: HourScore; score: number } | null = null;
  for (let i = 0; i < usable.length; i++) {
    const a = usable[i];
    const b = usable[i + 1];
    const twoHour =
      b && localHourFromIso(b.hour.time) === (localHourFromIso(a.hour.time) ?? -1) + 1
        ? { start: a, end: b, score: (a.score + b.score) / 2 }
        : { start: a, end: a, score: a.score };
    if (!best || twoHour.score > best.score) best = twoHour;
  }
  if (!best || best.score < WEATHER_WINDOW_MIN_SCORE) return null;

  const endIso =
    best.start === best.end
      ? best.start.hour.time.replace(/T\d{2}:\d{2}.*/, (m) => {
          const h = Number(m.slice(1, 3)) + 1;
          return `T${String(Math.min(23, h)).padStart(2, '0')}:00`;
        })
      : best.end.hour.time.replace(/T\d{2}:\d{2}.*/, (m) => {
          const h = Number(m.slice(1, 3)) + 1;
          return `T${String(Math.min(23, h)).padStart(2, '0')}:00`;
        });
  const range = formatHourRange(best.start.hour.time, endIso);
  return {
    start: range.start,
    end: range.end,
    startIso: best.start.hour.time,
    endIso,
    score: Math.round(best.score),
    reasonCodes: [...new Set([...best.start.reasons, ...best.end.reasons])],
    day,
    label: best.score >= 70 ? 'best' : 'good',
  };
}

export function findBestOutdoorWindow(
  weather: WeatherSnapshot,
  now = new Date(),
): OutdoorWindow | null {
  const tz = weather.location.timezone || 'UTC';
  const parts = zonedParts(now, tz);
  const todayMeta = dayForYmd(weather, parts.ymd);
  const tomorrowYmd = (() => {
    const d = new Date(`${parts.ymd}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const tomorrowMeta = dayForYmd(weather, tomorrowYmd);

  const todayBounds = {
    sunriseH: sunriseHour(todayMeta?.sunrise ?? weather.today.sunrise),
    sunsetH: sunsetHour(todayMeta?.sunset ?? weather.today.sunset),
  };
  const tomorrowBounds = {
    sunriseH: sunriseHour(tomorrowMeta?.sunrise),
    sunsetH: sunsetHour(tomorrowMeta?.sunset),
  };

  const upcoming = weather.hourly.filter((hour) => {
    const ymd = localYmdFromIso(hour.time);
    const h = localHourFromIso(hour.time);
    if (!ymd || h == null) return false;
    if (ymd === parts.ymd) return h >= parts.hour;
    return ymd === tomorrowYmd;
  });

  const fallbackAqi = weather.airQuality?.europeanAqi ?? null;
  const todayScored = upcoming
    .filter((hour) => localYmdFromIso(hour.time) === parts.ymd)
    .map((hour) => scoreOutdoorHour(hour, todayBounds, fallbackAqi));
  const todayWindow = pickWindow(todayScored, parts.ymd, 'today');
  if (todayWindow) return todayWindow;

  const tomorrowScored = upcoming
    .filter((hour) => localYmdFromIso(hour.time) === tomorrowYmd)
    .map((hour) => scoreOutdoorHour(hour, tomorrowBounds, fallbackAqi));
  return pickWindow(tomorrowScored, tomorrowYmd, 'tomorrow');
}

export function rainArrivingSoon(
  weather: WeatherSnapshot,
  now = new Date(),
  withinHours = 3,
): boolean {
  const tz = weather.location.timezone || 'UTC';
  const parts = zonedParts(now, tz);
  const currentRain = weather.current.precipitationMm > 0.4 || weather.current.condition === 'rain';
  const currentProb = weather.today.precipitationProbability;
  if (currentRain || (currentProb != null && currentProb >= 60)) return false;
  if (weather.current.condition === 'heavy_rain' || weather.current.condition === 'storm') return false;

  const upcoming = weather.hourly.filter((hour) => {
    const ymd = localYmdFromIso(hour.time);
    const h = localHourFromIso(hour.time);
    if (ymd !== parts.ymd || h == null) return false;
    return h > parts.hour && h <= parts.hour + withinHours;
  });
  const nowHour = weather.hourly.find((hour) => {
    const ymd = localYmdFromIso(hour.time);
    const h = localHourFromIso(hour.time);
    return ymd === parts.ymd && h === parts.hour;
  });
  const nowProb = nowHour?.precipitationProbability ?? 15;
  return upcoming.some((hour) => {
    const next = hour.precipitationProbability;
    return next != null && next >= 60 && next - nowProb >= 30;
  });
}
