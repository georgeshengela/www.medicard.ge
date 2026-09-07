'use strict';

/**
 * DEV-only Weather Wellness context override for Phase 6 Quest Smart QA.
 * Never persists into LIVE weather cache. Never alters production weather.
 */

const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

/** @typedef {'GOOD_WINDOW'|'RAIN'|'HIGH_UV'|'WIND'|'SEVERE'|'UNAVAILABLE'|null} DevWeatherScenario */

/** @type {DevWeatherScenario} */
let scenario = null;

const SCENARIOS = {
  GOOD_WINDOW: {
    category: 'good_outdoor',
    severity: 'calm',
    stale: false,
    bestOutdoorWindow: {
      start: '17:00',
      end: '18:30',
      startIso: null,
      endIso: null,
    },
  },
  RAIN: {
    category: 'rainy',
    severity: 'caution',
    stale: false,
    bestOutdoorWindow: null,
  },
  HIGH_UV: {
    category: 'high_uv',
    severity: 'caution',
    stale: false,
    bestOutdoorWindow: null,
  },
  WIND: {
    category: 'very_windy',
    severity: 'caution',
    stale: false,
    bestOutdoorWindow: null,
  },
  SEVERE: {
    category: 'storm',
    severity: 'avoid',
    stale: false,
    bestOutdoorWindow: null,
  },
  UNAVAILABLE: null,
};

export const DEV_WEATHER_SCENARIOS = Object.keys(SCENARIOS);

export function setDevWeatherScenario(next) {
  if (!DEV) return;
  scenario = next && SCENARIOS[next] !== undefined ? next : null;
}

export function getDevWeatherScenario() {
  return DEV ? scenario : null;
}

export function clearDevWeatherScenario() {
  scenario = null;
}

/**
 * Apply ISO timestamps relative to `now` for GOOD_WINDOW so scheduling works.
 * @returns {import('./types').WeatherRecommendation-like | null | undefined}
 *   undefined = no override; null = explicitly unavailable
 */
export function readDevWeatherOverride(now = new Date()) {
  if (!DEV || !scenario) return undefined;
  if (scenario === 'UNAVAILABLE') return null;
  const base = SCENARIOS[scenario];
  if (!base) return null;
  if (scenario === 'GOOD_WINDOW') {
    const start = new Date(now);
    start.setHours(17, 0, 0, 0);
    if (start.getTime() <= now.getTime()) start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setHours(start.getHours() + 1, 30, 0, 0);
    return {
      category: base.category,
      severity: base.severity,
      stale: false,
      bestOutdoorWindow: {
        start: `${String(start.getHours()).padStart(2, '0')}:00`,
        end: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      },
    };
  }
  return { ...base };
}

/**
 * Shape for Quest Smart engage snapshot weather field.
 */
export function readDevQuestWeather(now = new Date()) {
  const override = readDevWeatherOverride(now);
  if (override === undefined) return undefined;
  if (override === null) return null;
  return override;
}
