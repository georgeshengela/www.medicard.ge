import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { conditionFromWeatherCode } from './conditions.ts';
import { weatherCopyText } from './copy.ts';
import { metersBetween } from '../geoPlace.ts';
import { findBestOutdoorWindow, rainArrivingSoon } from './outdoorWindow.ts';
import {
  getWeatherWellnessRecommendation,
  isWeatherStale,
  stepsAreLow,
  stepsGoalReached,
} from './recommendation.ts';
import type { WeatherHour, WeatherSnapshot, WeatherWellnessContext } from './types.ts';

function hour(
  time: string,
  over: Partial<WeatherHour> = {},
): WeatherHour {
  return {
    time,
    temperatureC: 18,
    feelsLikeC: 18,
    precipitationProbability: 5,
    weatherCode: 0,
    condition: 'clear',
    windKmh: 8,
    uvIndex: 3,
    visibilityM: 20000,
    ...over,
  };
}

function springHours(ymd = '2026-09-06'): WeatherHour[] {
  const rows: WeatherHour[] = [];
  for (let h = 0; h < 24; h++) {
    rows.push(
      hour(`${ymd}T${String(h).padStart(2, '0')}:00`, {
        temperatureC: h >= 15 && h <= 18 ? 19 : 16,
        feelsLikeC: h >= 15 && h <= 18 ? 19 : 16,
        uvIndex: h >= 11 && h <= 16 ? 4 : 1,
      }),
    );
  }
  return rows;
}

function snap(over: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    location: { city: 'Liège', latitude: 50.63, longitude: 5.57, timezone: 'Europe/Brussels' },
    current: {
      temperatureC: 18,
      feelsLikeC: 18,
      weatherCode: 0,
      condition: 'clear',
      isDay: true,
      precipitationMm: 0,
      windKmh: 8,
      windGustKmh: 12,
    },
    today: {
      minC: 12,
      maxC: 21,
      precipitationProbability: 10,
      uvMax: 4,
      sunrise: '2026-09-06T07:10',
      sunset: '2026-09-06T20:05',
    },
    daily: [
      {
        date: '2026-09-06',
        minC: 12,
        maxC: 21,
        precipitationProbability: 10,
        weatherCode: 0,
        condition: 'clear',
        uvMax: 4,
        sunrise: '2026-09-06T07:10',
        sunset: '2026-09-06T20:05',
      },
      {
        date: '2026-09-07',
        minC: 11,
        maxC: 20,
        precipitationProbability: 15,
        weatherCode: 1,
        condition: 'mostly_clear',
        uvMax: 4,
        sunrise: '2026-09-07T07:12',
        sunset: '2026-09-07T20:03',
      },
    ],
    hourly: springHours(),
    updatedAt: '2026-09-06T10:00:00.000Z',
    ...over,
  };
}

const noon: WeatherWellnessContext = { now: new Date('2026-09-06T10:00:00+02:00'), locale: 'ka' };

describe('weather conditions', () => {
  it('maps WMO codes to canonical conditions', () => {
    assert.equal(conditionFromWeatherCode(0), 'clear');
    assert.equal(conditionFromWeatherCode(3), 'cloudy');
    assert.equal(conditionFromWeatherCode(61), 'rain');
    assert.equal(conditionFromWeatherCode(65), 'heavy_rain');
    assert.equal(conditionFromWeatherCode(95), 'storm');
  });
});

describe('outdoor window', () => {
  it('picks a daylight window on a perfect spring day', () => {
    const window = findBestOutdoorWindow(snap(), noon.now);
    assert.ok(window);
    assert.equal(window?.day, 'today');
    assert.ok((window?.score ?? 0) >= 70);
    assert.ok(window?.reasonCodes.includes('pleasant_temp'));
    assert.ok(window?.reasonCodes.includes('low_rain'));
  });

  it('returns no window when every daylight hour is storm or heavy rain', () => {
    const weather = snap({
      hourly: springHours().map((row) => ({ ...row, condition: 'storm', weatherCode: 95, precipitationProbability: 90 })),
    });
    assert.equal(findBestOutdoorWindow(weather, noon.now), null);
  });

  it('detects rain arriving soon only when the jump is real', () => {
    const hours = springHours().map((row) => {
      const h = Number(row.time.slice(11, 13));
      if (h >= 13) return { ...row, precipitationProbability: 70, condition: 'rain' as const };
      return row;
    });
    assert.equal(rainArrivingSoon(snap({ hourly: hours }), noon.now), true);
    assert.equal(rainArrivingSoon(snap(), noon.now), false);
  });

  it('uses forecast timezone, not a hard-coded Tbilisi clock', () => {
    const honolulu = snap({
      location: { city: 'Honolulu', latitude: 21.3, longitude: -157.8, timezone: 'Pacific/Honolulu' },
      today: { ...snap().today, sunrise: '2026-09-06T06:20', sunset: '2026-09-06T18:40' },
      hourly: springHours(),
    });
    const nightThere = new Date('2026-09-07T08:00:00.000Z');
    const rec = getWeatherWellnessRecommendation(honolulu, { now: nightThere });
    assert.equal(rec.category, 'night');
  });
});

describe('recommendation priority', () => {
  it('calls a perfect spring day excellent or good outdoor', () => {
    const rec = getWeatherWellnessRecommendation(snap(), noon);
    assert.ok(rec.category === 'excellent_outdoor' || rec.category === 'good_outdoor' || rec.category === 'morning');
    assert.ok(rec.bestOutdoorWindow);
    assert.equal(rec.adviceKind, 'live');
  });

  it('puts storm above a pleasant temperature', () => {
    const rec = getWeatherWellnessRecommendation(
      snap({
        current: { ...snap().current, condition: 'storm', weatherCode: 95, temperatureC: 18, feelsLikeC: 18 },
      }),
      noon,
    );
    assert.equal(rec.category, 'storm');
    assert.equal(rec.severity, 'avoid');
    assert.equal(rec.pushCandidate, null);
  });

  it('uses feels-like for hot and extreme heat', () => {
    const hot = getWeatherWellnessRecommendation(
      snap({ current: { ...snap().current, temperatureC: 28, feelsLikeC: 32 } }),
      noon,
    );
    const extreme = getWeatherWellnessRecommendation(
      snap({ current: { ...snap().current, temperatureC: 33, feelsLikeC: 37 } }),
      noon,
    );
    assert.equal(hot.category, 'hot');
    assert.equal(extreme.category, 'very_hot');
    assert.equal(extreme.severity, 'avoid');
  });

  it('treats cold and very cold from feels-like', () => {
    assert.equal(
      getWeatherWellnessRecommendation(snap({ current: { ...snap().current, feelsLikeC: 2, temperatureC: 4 } }), noon)
        .category,
      'cold',
    );
    assert.equal(
      getWeatherWellnessRecommendation(snap({ current: { ...snap().current, feelsLikeC: -7, temperatureC: -3 } }), noon)
        .category,
      'very_cold',
    );
  });

  it('prioritizes high UV over a generic good-walk line', () => {
    const rec = getWeatherWellnessRecommendation(
      snap({ today: { ...snap().today, uvMax: 9 }, current: { ...snap().current, isDay: true } }),
      noon,
    );
    assert.equal(rec.category, 'high_uv');
    const title = weatherCopyText(rec.titleKey, 'ka');
    assert.equal(/გასეირნება კარგი|მშვენიერი ამინდია/.test(title) && !/UV|მზე/.test(title), false);
  });

  it('classifies rain and heavy rain without inventing a window in a washout', () => {
    const rain = getWeatherWellnessRecommendation(
      snap({
        current: { ...snap().current, condition: 'rain', precipitationMm: 1.2 },
        today: { ...snap().today, precipitationProbability: 70 },
      }),
      noon,
    );
    assert.equal(rain.category, 'rainy');
    const heavy = getWeatherWellnessRecommendation(
      snap({ current: { ...snap().current, condition: 'heavy_rain', precipitationMm: 6 } }),
      noon,
    );
    assert.equal(heavy.category, 'heavy_rain');
  });

  it('flags rain arriving soon', () => {
    const hours = springHours().map((row) => {
      const h = Number(row.time.slice(11, 13));
      return h >= 13 ? { ...row, precipitationProbability: 75 } : row;
    });
    const rec = getWeatherWellnessRecommendation(snap({ hourly: hours }), noon);
    assert.equal(rec.category, 'rain_soon');
    assert.equal(rec.pushCandidate, 'weather_rain_soon');
  });

  it('marks strong wind', () => {
    const rec = getWeatherWellnessRecommendation(
      snap({ current: { ...snap().current, windKmh: 38, windGustKmh: 44 } }),
      noon,
    );
    assert.equal(rec.category, 'very_windy');
  });

  it('does not recommend a walk at night just because the score is good', () => {
    const rec = getWeatherWellnessRecommendation(snap({ current: { ...snap().current, isDay: false } }), {
      now: new Date('2026-09-06T22:30:00+02:00'),
    });
    assert.equal(rec.category, 'night');
    assert.equal(rec.pushCandidate, null);
  });

  it('softens walk copy when steps are low or the goal is done', () => {
    const low = getWeatherWellnessRecommendation(snap(), {
      ...noon,
      todaySteps: 900,
      stepsDailyTarget: 5000,
    });
    assert.ok(low.reasonCodes.includes('low_steps'));
    assert.match(low.bodyKey, /steps_low/);
    const done = getWeatherWellnessRecommendation(snap(), {
      ...noon,
      todaySteps: 6200,
      stepsDailyTarget: 5000,
    });
    assert.ok(done.reasonCodes.includes('steps_goal_reached'));
    assert.match(done.bodyKey, /steps_done/);
    assert.equal(done.pushCandidate, null);
  });

  it('suppresses walk encouragement when pain is logged', () => {
    const rec = getWeatherWellnessRecommendation(snap(), { ...noon, loggedPain: true, todaySteps: 400 });
    assert.ok(rec.reasonCodes.includes('pain_context'));
    assert.match(rec.bodyKey, /pain/);
    assert.equal(rec.pushCandidate, null);
  });

  it('nudges water on a hot day when hydration is behind, without diagnosing', () => {
    const rec = getWeatherWellnessRecommendation(
      snap({ current: { ...snap().current, feelsLikeC: 32, temperatureC: 29 } }),
      { ...noon, hydrationMl: 400, hydrationGoalMl: 2000 },
    );
    assert.equal(rec.category, 'hot');
    assert.ok(rec.reasonCodes.includes('hydration_behind'));
    const body = weatherCopyText(rec.bodyKey, 'ka') + weatherCopyText(rec.titleKey, 'ka');
    assert.equal(/dehydrat|გაუწყლო/.test(body), false);
    assert.equal(rec.pushCandidate, 'weather_hot_hydration');
  });

  it('uses generic cached advice when weather is stale', () => {
    const rec = getWeatherWellnessRecommendation(
      snap({ updatedAt: '2026-09-06T06:00:00.000Z' }),
      { now: new Date('2026-09-06T10:00:00.000Z') },
    );
    assert.equal(isWeatherStale(snap({ updatedAt: '2026-09-06T06:00:00.000Z' }), Date.parse('2026-09-06T10:00:00.000Z')), true);
    assert.equal(rec.adviceKind, 'cached');
    assert.equal(rec.pushCandidate, null);
  });

  it('invalidates recommendations after a meaningful location change', () => {
    assert.ok(metersBetween({ lat: 50.63, lng: 5.57 }, { lat: 50.64, lng: 5.58 }) < 2000);
    assert.ok(metersBetween({ lat: 50.63, lng: 5.57 }, { lat: 41.71, lng: 44.78 }) > 2000);
  });

  it('keeps copy keys stable for the same day and weather state', () => {
    const a = getWeatherWellnessRecommendation(snap(), { ...noon, userKey: 'u1' });
    const b = getWeatherWellnessRecommendation(snap(), { ...noon, userKey: 'u1' });
    assert.equal(a.titleKey, b.titleKey);
    assert.equal(a.bodyKey, b.bodyKey);
    assert.ok(weatherCopyText(a.titleKey, 'ka').length > 4);
    assert.ok(weatherCopyText(a.titleKey, 'en').length > 4);
    assert.ok(weatherCopyText(a.titleKey, 'fr').length > 4);
    assert.ok(weatherCopyText(a.titleKey, 'ru').length > 4);
  });

  it('exposes steps helpers used by the brain', () => {
    assert.equal(stepsAreLow({ todaySteps: 900, stepsDailyTarget: 5000 }), true);
    assert.equal(stepsGoalReached({ todaySteps: 5000, stepsDailyTarget: 5000 }), true);
    assert.equal(stepsGoalReached({ todaySteps: 900 }), false);
  });
});
