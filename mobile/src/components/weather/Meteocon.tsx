import React from 'react';
import LottieView from 'lottie-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { AirQualityBand, WeatherCondition, WeatherRecommendation } from '@/lib/weather';

/**
 * [Meteocons](https://meteocons.com/) fill-style Lottie animations.
 * Metro only bundles the files we require here — keep this list tight.
 */
const FILL = {
  'clear-day': require('@meteocons/lottie/fill/clear-day.json'),
  'clear-night': require('@meteocons/lottie/fill/clear-night.json'),
  'partly-cloudy-day': require('@meteocons/lottie/fill/partly-cloudy-day.json'),
  'partly-cloudy-night': require('@meteocons/lottie/fill/partly-cloudy-night.json'),
  'overcast-day': require('@meteocons/lottie/fill/overcast-day.json'),
  'overcast-night': require('@meteocons/lottie/fill/overcast-night.json'),
  'overcast': require('@meteocons/lottie/fill/overcast.json'),
  'fog-day': require('@meteocons/lottie/fill/fog-day.json'),
  'fog-night': require('@meteocons/lottie/fill/fog-night.json'),
  drizzle: require('@meteocons/lottie/fill/drizzle.json'),
  'partly-cloudy-day-drizzle': require('@meteocons/lottie/fill/partly-cloudy-day-drizzle.json'),
  rain: require('@meteocons/lottie/fill/rain.json'),
  'extreme-rain': require('@meteocons/lottie/fill/extreme-rain.json'),
  'overcast-rain': require('@meteocons/lottie/fill/overcast-rain.json'),
  snow: require('@meteocons/lottie/fill/snow.json'),
  'extreme-snow': require('@meteocons/lottie/fill/extreme-snow.json'),
  'thunderstorms-day-rain': require('@meteocons/lottie/fill/thunderstorms-day-rain.json'),
  'thunderstorms-night-rain': require('@meteocons/lottie/fill/thunderstorms-night-rain.json'),
  'thunderstorms-rain': require('@meteocons/lottie/fill/thunderstorms-rain.json'),
  wind: require('@meteocons/lottie/fill/wind.json'),
  umbrella: require('@meteocons/lottie/fill/umbrella.json'),
  'uv-index': require('@meteocons/lottie/fill/uv-index.json'),
  thermometer: require('@meteocons/lottie/fill/thermometer.json'),
  'thermometer-celsius': require('@meteocons/lottie/fill/thermometer-celsius.json'),
  'thermometer-warmer': require('@meteocons/lottie/fill/thermometer-warmer.json'),
  'thermometer-colder': require('@meteocons/lottie/fill/thermometer-colder.json'),
  sunrise: require('@meteocons/lottie/fill/sunrise.json'),
  sunset: require('@meteocons/lottie/fill/sunset.json'),
  'starry-night': require('@meteocons/lottie/fill/starry-night.json'),
  smoke: require('@meteocons/lottie/fill/smoke.json'),
  haze: require('@meteocons/lottie/fill/haze.json'),
  'haze-day': require('@meteocons/lottie/fill/haze-day.json'),
  humidity: require('@meteocons/lottie/fill/humidity.json'),
  barometer: require('@meteocons/lottie/fill/barometer.json'),
  'time-morning': require('@meteocons/lottie/fill/time-morning.json'),
  'not-available': require('@meteocons/lottie/fill/not-available.json'),
} as const;

export type MeteoconSlug = keyof typeof FILL;

export function meteoconSlugFor(
  condition: WeatherCondition | WeatherRecommendation['icon'],
  isDay = true,
): MeteoconSlug {
  if (condition === 'night') return 'starry-night';
  if (condition === 'umbrella') return 'umbrella';
  if (condition === 'wind') return 'wind';
  if (condition === 'sun') return 'clear-day';
  switch (condition) {
    case 'clear':
      return isDay ? 'clear-day' : 'clear-night';
    case 'mostly_clear':
      return isDay ? 'clear-day' : 'clear-night';
    case 'partly_cloudy':
      return isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
    case 'cloudy':
      return isDay ? 'overcast-day' : 'overcast-night';
    case 'fog':
      return isDay ? 'fog-day' : 'fog-night';
    case 'drizzle':
      return isDay ? 'partly-cloudy-day-drizzle' : 'drizzle';
    case 'rain':
      return isDay ? 'rain' : 'overcast-rain';
    case 'heavy_rain':
      return 'extreme-rain';
    case 'snow':
      return 'snow';
    case 'heavy_snow':
      return 'extreme-snow';
    case 'storm':
      return isDay ? 'thunderstorms-day-rain' : 'thunderstorms-night-rain';
    default:
      return isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
  }
}

export function airMeteoconSlug(band: AirQualityBand): MeteoconSlug {
  if (band === 'good') return 'wind';
  if (band === 'fair') return 'haze-day';
  if (band === 'moderate') return 'haze';
  return 'smoke';
}

export function Meteocon({
  slug,
  size,
  loop = true,
}: {
  slug: MeteoconSlug;
  size: number;
  loop?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <LottieView
      source={FILL[slug] ?? FILL['not-available']}
      autoPlay={!reduce}
      loop={!reduce && loop}
      progress={reduce ? 0 : undefined}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
