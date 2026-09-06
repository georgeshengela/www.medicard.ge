import type { AirQualityBand, WeatherCondition, WeatherRecommendation } from '@/lib/weather';

export const AIR_BAND_TINT: Record<AirQualityBand, { light: string; dark: string }> = {
  good: { light: '#0F766E', dark: '#5EEAD4' },
  fair: { light: '#0D9488', dark: '#99F6E4' },
  moderate: { light: '#B45309', dark: '#FCD34D' },
  poor: { light: '#C2410C', dark: '#FDBA74' },
  very_poor: { light: '#B91C1C', dark: '#FCA5A5' },
  extremely_poor: { light: '#7F1D1D', dark: '#F87171' },
};

export function airBandColor(band: AirQualityBand, isDark: boolean): string {
  return AIR_BAND_TINT[band][isDark ? 'dark' : 'light'];
}

export type WeatherMood = {
  accent: string;
  wash: string;
  washDark: string;
  ring: string;
  chip: string;
  chipDark: string;
};

export function weatherMood(
  condition: WeatherCondition | WeatherRecommendation['icon'],
  isDay: boolean,
): WeatherMood {
  if (condition === 'storm' || condition === 'heavy_rain') {
    return {
      accent: '#0F766E',
      wash: '#ECFDF5',
      washDark: '#042F2E',
      ring: '#0D9488',
      chip: '#CCFBF1',
      chipDark: '#115E59',
    };
  }
  if (condition === 'rain' || condition === 'drizzle' || condition === 'umbrella') {
    return {
      accent: '#0D9488',
      wash: '#F0FDFA',
      washDark: '#042F2E',
      ring: '#14B8A6',
      chip: '#CCFBF1',
      chipDark: '#115E59',
    };
  }
  if (condition === 'night' || !isDay) {
    return {
      accent: '#64748B',
      wash: '#F8FAFC',
      washDark: '#111827',
      ring: '#94A3B8',
      chip: '#E2E8F0',
      chipDark: '#1F2937',
    };
  }
  if (condition === 'snow' || condition === 'heavy_snow' || condition === 'fog') {
    return {
      accent: '#0E7490',
      wash: '#ECFEFF',
      washDark: '#083344',
      ring: '#22D3EE',
      chip: '#CFFAFE',
      chipDark: '#164E63',
    };
  }
  return {
    accent: '#14B8A6',
    wash: '#F0FDFA',
    washDark: '#042F2E',
    ring: '#14B8A6',
    chip: '#CCFBF1',
    chipDark: '#115E59',
  };
}
