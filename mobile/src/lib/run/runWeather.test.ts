import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUN_WEATHER_MAX_AGE_MS, runWeatherFx, sameRunWeatherFx } from './runWeather.ts';
import { WEATHER_FX_JS } from './weatherFx.ts';
import type { WeatherCondition, WeatherSnapshot } from '../weather/types.ts';

const NOW = Date.parse('2026-10-05T12:00:00Z');

function snap(condition: WeatherCondition, extra: Partial<WeatherSnapshot['current']> = {}, updatedAt = new Date(NOW - 60_000).toISOString()): WeatherSnapshot {
  return {
    location: { city: null, latitude: 41.7, longitude: 44.8, timezone: 'Asia/Tbilisi' },
    current: { temperatureC: 12, feelsLikeC: 11, weatherCode: 0, condition, isDay: true, precipitationMm: 0, windKmh: 9, windGustKmh: null, ...extra },
    today: { minC: 8, maxC: 15, precipitationProbability: 0, uvMax: 2, sunrise: null, sunset: null },
    daily: [],
    hourly: [],
    airQuality: null,
    updatedAt,
  };
}

test('rain, snow, storm and fog in the city become the same on the map', () => {
  assert.equal(runWeatherFx(snap('rain'), NOW)?.kind, 'rain');
  assert.equal(runWeatherFx(snap('heavy_rain'), NOW)?.kind, 'heavy_rain');
  assert.equal(runWeatherFx(snap('drizzle'), NOW)?.kind, 'drizzle');
  assert.equal(runWeatherFx(snap('storm'), NOW)?.kind, 'storm');
  assert.equal(runWeatherFx(snap('snow'), NOW)?.kind, 'snow');
  assert.equal(runWeatherFx(snap('heavy_snow'), NOW)?.kind, 'heavy_snow');
  assert.equal(runWeatherFx(snap('fog'), NOW)?.kind, 'fog');
  assert.equal(runWeatherFx(snap('cloudy'), NOW)?.kind, 'clouds');
});

test('a clear sky draws nothing over the night city', () => {
  for (const c of ['clear', 'mostly_clear', 'partly_cloudy'] as const) assert.equal(runWeatherFx(snap(c), NOW)?.kind, 'none');
});

test('measured precipitation wins over a dry weather code', () => {
  assert.equal(runWeatherFx(snap('cloudy', { precipitationMm: 0.6 }), NOW)?.kind, 'rain');
  assert.equal(runWeatherFx(snap('partly_cloudy', { precipitationMm: 0.4, temperatureC: -1 }), NOW)?.kind, 'snow');
  assert.equal(runWeatherFx(snap('cloudy', { precipitationMm: 0.1 }), NOW)?.kind, 'clouds');
});

test('old weather is never drawn, wind is carried', () => {
  assert.equal(runWeatherFx(snap('rain', {}, new Date(NOW - RUN_WEATHER_MAX_AGE_MS - 1000).toISOString()), NOW), null);
  assert.equal(runWeatherFx(null, NOW), null);
  assert.equal(runWeatherFx(snap('rain', { windKmh: 31.6 }), NOW)?.wind, 32);
  assert.ok(sameRunWeatherFx({ kind: 'rain', wind: 10 }, { kind: 'rain', wind: 12 }));
  assert.ok(!sameRunWeatherFx({ kind: 'rain', wind: 10 }, { kind: 'snow', wind: 10 }));
});

test('the map script is injectable as-is and knows every kind', () => {
  assert.ok(!WEATHER_FX_JS.includes('</script'));
  assert.ok(!WEATHER_FX_JS.includes('`'));
  assert.doesNotThrow(() => new Function(WEATHER_FX_JS));
  for (const kind of ['drizzle', 'rain', 'heavy_rain', 'storm', 'snow', 'heavy_snow', 'fog', 'clouds']) assert.match(WEATHER_FX_JS, new RegExp(`\\b${kind}:\\{`));
  // Lightning never runs under reduced motion.
  assert.match(WEATHER_FX_JS, /cfg\.flash&&!reduced/);
});
