import { darkColors, lightColors, useIsDark, useThemeColors, type Palette } from '@/theme/colors';

/**
 * Cycle chrome — Nightingale 9001:283189 rose wash on light.
 * Dark stays navy. Fertile/ovulation stay violet so estimates ≠ period.
 */
const PHASE_LIGHT = {
  blush: '#FECDD3',
  blushDeep: '#F43F5E',
  rose: '#F43F5E',
  roseSoft: '#FFF1F2',
  lavender: '#7C3AED',
  lavenderSoft: '#F3E8FF',
  peach: '#FFF1F2',
  mint: '#F9A8D4',
  period: '#F43F5E',
  fertile: '#7C3AED',
  ovulation: '#7C3AED',
  todayRing: '#0D9488',
};

const PHASE_DARK = {
  blush: '#9F1239',
  blushDeep: '#FB7185',
  rose: '#FB7185',
  roseSoft: '#3A1A24',
  lavender: '#A78BFA',
  lavenderSoft: '#2E1B4A',
  peach: '#3A1A24',
  mint: '#F9A8D4',
  period: '#FB7185',
  fertile: '#A78BFA',
  ovulation: '#A78BFA',
  todayRing: '#14B8A6',
};

export type CyclePhaseTokens = {
  blush: string;
  blushDeep: string;
  rose: string;
  roseSoft: string;
  lavender: string;
  lavenderSoft: string;
  peach: string;
  mint: string;
  period: string;
  fertile: string;
  ovulation: string;
  todayRing: string;
};

export type CycleChromeTokens = {
  cream: string;
  creamDeep: string;
  ink: string;
  muted: string;
  mutedSoft: string;
  card: string;
  cardSoft: string;
  fab: string;
  brand: string;
  cta: string;
  border: string;
  shadow: string;
  danger: string;
  success: string;
  white: string;
  overlay: string;
  heroFrom: string;
  heroTo: string;
  accentGlow: string;
};

export type CyclePalette = CyclePhaseTokens & CycleChromeTokens;

function chrome(theme: Palette, dark: boolean): CycleChromeTokens {
  return {
    cream: dark ? theme.bg100 : '#FFF7F8',
    creamDeep: dark ? theme.bg200 : '#FFF1F2',
    ink: dark ? theme.text100 : '#1F2937',
    muted: dark ? theme.text200 : '#4B5563',
    mutedSoft: dark ? theme.text300 : '#9CA3AF',
    card: dark ? theme.surface : '#FFFFFF',
    cardSoft: dark ? theme.bg200 : '#FFF1F2',
    fab: dark ? '#F43F5E' : '#F43F5E',
    brand: dark ? '#FB7185' : '#F43F5E',
    cta: dark ? '#F43F5E' : '#F43F5E',
    border: dark ? theme.bg300 : '#FECDD3',
    shadow: 'transparent',
    danger: theme.danger,
    success: theme.success,
    white: theme.white,
    overlay: dark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 26, 28, 0.40)',
    heroFrom: theme.surface,
    heroTo: theme.surface,
    accentGlow: 'transparent',
  };
}

export const cycleLight: CyclePalette = {
  ...PHASE_LIGHT,
  ...chrome(lightColors, false),
};

export const cycleDark: CyclePalette = {
  ...PHASE_DARK,
  ...chrome(darkColors, true),
};

/** Convert #RRGGBB + alpha 0-1 → rgba() for reliable RN colors. */
export function cycleHexAlpha(hex: string, alpha: number) {
  const raw = String(hex || '').replace('#', '');
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function useCycleColors(): CyclePalette {
  const theme = useThemeColors();
  const dark = useIsDark();
  return {
    ...(dark ? PHASE_DARK : PHASE_LIGHT),
    ...chrome(theme, dark),
  };
}

const FLAT = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

export const cycleShadow = {
  soft: FLAT,
  fab: FLAT,
  card: FLAT,
} as const;
