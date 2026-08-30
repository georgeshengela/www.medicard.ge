import { darkColors, lightColors, useIsDark, useThemeColors, type Palette } from '@/theme/colors';

/**
 * Cycle chrome follows the app (navy / teal / flat cards).
 * Rose / purple stay on period, fertile, ovulation — data only.
 */
const PHASE_LIGHT = {
  blush: '#F8BBD0',
  blushDeep: '#E11D48',
  rose: '#E11D48',
  roseSoft: '#FCE8EE',
  lavender: '#C026D3',
  lavenderSoft: '#F5E8FA',
  peach: '#FCE8EE',
  mint: '#F9A8D4',
  period: '#E11D48',
  fertile: '#C026D3',
  ovulation: '#A21CAF',
  todayRing: '#14B8A6',
};

const PHASE_DARK = {
  blush: '#9F1239',
  blushDeep: '#FB7185',
  rose: '#FB7185',
  roseSoft: '#3A1A24',
  lavender: '#E879F9',
  lavenderSoft: '#3B1A40',
  peach: '#3A1A24',
  mint: '#F9A8D4',
  period: '#FB7185',
  fertile: '#E879F9',
  ovulation: '#E879F9',
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
    cream: theme.bg100,
    creamDeep: theme.bg200,
    ink: theme.text100,
    muted: theme.text200,
    mutedSoft: theme.text300,
    card: theme.surface,
    cardSoft: theme.bg200,
    fab: dark ? '#0D9488' : theme.primary200,
    brand: theme.primary200,
    cta: dark ? '#0D9488' : theme.primary200,
    border: theme.bg300,
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
