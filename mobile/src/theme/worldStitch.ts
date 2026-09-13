import { useIsDark } from '@/theme/colors';

/**
 * Medi World visual tokens from Stitch project "Medi World Mobile Experience".
 * Scoped to World routes — do not change Home / clinical surfaces.
 */
export type WorldStitch = {
  surface: string;
  surfaceLow: string;
  surfaceHigh: string;
  surfaceHighest: string;
  lowest: string;
  on: string;
  onVariant: string;
  primary: string;
  cta: string;
  onCta: string;
  secondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  outline: string;
  outlineVariant: string;
  tertiary: string;
  tertiaryFixed: string;
  tertiaryDim: string;
  primaryFixed: string;
  primaryFixedDim: string;
  hydration: string;
  movement: string;
  calm: string;
  care: string;
  connection: string;
  shadow: string;
};

const LIGHT: WorldStitch = {
  surface: '#E8FEFA',
  surfaceLow: '#E3F8F4',
  surfaceHigh: '#D7EDE9',
  surfaceHighest: '#D2E7E3',
  lowest: '#FFFFFF',
  on: '#0C1F1D',
  onVariant: '#3C4947',
  primary: '#006A60',
  cta: '#00B7A6',
  onCta: '#FFFFFF',
  secondary: '#176A60',
  secondaryContainer: '#A6F1E4',
  onSecondaryContainer: '#207066',
  outline: '#6C7A77',
  outlineVariant: '#BBCAC6',
  tertiary: '#A53B29',
  tertiaryFixed: '#FFDAD4',
  tertiaryDim: '#FFB4A6',
  primaryFixed: '#6EF8E5',
  primaryFixedDim: '#4CDBC9',
  hydration: '#5AD8E6',
  movement: '#FFBF42',
  calm: '#9E8CF0',
  care: '#FF7E67',
  connection: '#00B7A6',
  shadow: 'rgba(11, 30, 28, 0.08)',
};

const DARK: WorldStitch = {
  surface: '#0B1E1C',
  surfaceLow: '#132D2A',
  surfaceHigh: '#1A3A36',
  surfaceHighest: '#1F4540',
  lowest: '#132D2A',
  on: '#E0F5F1',
  onVariant: '#BBCAC6',
  primary: '#4CDBC9',
  cta: '#00B7A6',
  onCta: '#FFFFFF',
  secondary: '#8AD4C8',
  secondaryContainer: '#005048',
  onSecondaryContainer: '#A6F1E4',
  outline: '#BBCAC6',
  outlineVariant: '#3C4947',
  tertiary: '#FFB4A6',
  tertiaryFixed: '#5C2218',
  tertiaryDim: '#842415',
  primaryFixed: '#005048',
  primaryFixedDim: '#006A60',
  hydration: '#5AD8E6',
  movement: '#FFBF42',
  calm: '#9E8CF0',
  care: '#FF7E67',
  connection: '#4CDBC9',
  shadow: 'rgba(0, 0, 0, 0.28)',
};

export function worldStitch(dark: boolean): WorldStitch {
  return dark ? DARK : LIGHT;
}

export function useWorldStitch(): WorldStitch {
  return worldStitch(useIsDark());
}

export const WORLD_SHADOW = {
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 16,
  elevation: 3,
} as const;
