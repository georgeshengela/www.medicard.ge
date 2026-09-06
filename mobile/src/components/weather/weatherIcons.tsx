import React from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  ShieldAlert,
  Sparkles,
  Sun,
  TriangleAlert,
  Umbrella,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import type { AirQualityBand, WeatherCondition, WeatherRecommendation } from '@/lib/weather';

export function weatherIconFor(
  condition: WeatherCondition | WeatherRecommendation['icon'],
  isDay = true,
): LucideIcon {
  if (condition === 'night') return Moon;
  if (condition === 'umbrella') return Umbrella;
  if (condition === 'wind') return Wind;
  if (condition === 'sun') return Sun;
  switch (condition) {
    case 'clear':
    case 'mostly_clear':
      return isDay ? Sun : Moon;
    case 'partly_cloudy':
      return CloudSun;
    case 'cloudy':
      return Cloud;
    case 'fog':
      return CloudFog;
    case 'drizzle':
      return CloudDrizzle;
    case 'rain':
    case 'heavy_rain':
      return CloudRain;
    case 'snow':
    case 'heavy_snow':
      return CloudSnow;
    case 'storm':
      return CloudLightning;
    default:
      return CloudSun;
  }
}

export function airQualityIconFor(band: AirQualityBand): LucideIcon {
  if (band === 'good') return Wind;
  if (band === 'fair') return Sparkles;
  if (band === 'moderate') return CloudFog;
  if (band === 'poor') return TriangleAlert;
  return ShieldAlert;
}

export function weatherAccent(condition: WeatherCondition | WeatherRecommendation['icon']): string {
  if (condition === 'storm' || condition === 'heavy_rain') return '#0F766E';
  if (condition === 'rain' || condition === 'drizzle' || condition === 'umbrella') return '#0D9488';
  if (condition === 'night') return '#64748B';
  return '#14B8A6';
}
