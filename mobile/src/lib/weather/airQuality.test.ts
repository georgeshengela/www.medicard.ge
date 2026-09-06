import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attachAirQuality, bandFromEuropeanAqi } from './airQuality.ts';
import { scoreOutdoorHour } from './outdoorWindow.ts';
import type { WeatherHour, WeatherSnapshot } from './types.ts';

describe('european AQI bands', () => {
  it('uses EEA 2024 thresholds', () => {
    assert.equal(bandFromEuropeanAqi(12), 'good');
    assert.equal(bandFromEuropeanAqi(36), 'fair');
    assert.equal(bandFromEuropeanAqi(48), 'moderate');
    assert.equal(bandFromEuropeanAqi(72), 'poor');
    assert.equal(bandFromEuropeanAqi(90), 'very_poor');
    assert.equal(bandFromEuropeanAqi(120), 'extremely_poor');
  });
});

describe('air quality attach', () => {
  it('keeps weather usable when AQI is missing', () => {
    const snapshot = {
      hourly: [{ time: '2026-09-06T15:00' } as WeatherHour],
      airQuality: null,
    } as WeatherSnapshot;
    const next = attachAirQuality(snapshot, { current: {}, hourly: { time: [], european_aqi: [] } });
    assert.equal(next.airQuality, null);
  });

  it('maps current pollutants and hourly EAQI', () => {
    const snapshot = {
      hourly: [{ time: '2026-09-06T18:00' } as WeatherHour],
      airQuality: null,
    } as WeatherSnapshot;
    const next = attachAirQuality(snapshot, {
      current: { european_aqi: 36.4, pm2_5: 7.8, pm10: 10.5, nitrogen_dioxide: 1.9, ozone: 92, sulphur_dioxide: 1.6 },
      hourly: { time: ['2026-09-06T18:00'], european_aqi: [38] },
    });
    assert.equal(next.airQuality?.europeanAqi, 36);
    assert.equal(next.airQuality?.band, 'fair');
    assert.equal(next.airQuality?.pm25, 7.8);
    assert.equal(next.hourly[0].europeanAqi, 38);
  });
});

describe('outdoor hour air penalty', () => {
  const hour: WeatherHour = {
    time: '2026-09-06T15:00',
    temperatureC: 18,
    feelsLikeC: 18,
    precipitationProbability: 5,
    weatherCode: 0,
    condition: 'clear',
    windKmh: 8,
    uvIndex: 3,
    visibilityM: 20000,
  };
  const bounds = { sunriseH: 7, sunsetH: 20 };

  it('adds a small bonus when air is good', () => {
    const scored = scoreOutdoorHour({ ...hour, europeanAqi: 12 }, bounds);
    assert.ok(scored.reasons.includes('good_air'));
    assert.equal(scored.disqualified, false);
  });

  it('disqualifies an hour when EAQI is extremely poor', () => {
    const scored = scoreOutdoorHour({ ...hour, europeanAqi: 110 }, bounds);
    assert.equal(scored.disqualified, true);
    assert.ok(scored.reasons.includes('extremely_poor_air'));
  });
});
