import { useColorScheme } from 'nativewind';

/**
 * Cycle palette — Material pink / magenta (no brown cream).
 * Light: soft pink canvas · Dark: deep rose night.
 */
export const cycleLight = {
  blush: '#F8BBD0',
  blushDeep: '#EC407A',
  rose: '#E91E63',
  roseSoft: '#FCE4EC',
  lavender: '#CE93D8',
  lavenderSoft: '#F3E5F5',
  peach: '#F8BBD0',
  mint: '#F48FB1',
  cream: '#FFF5F8',
  creamDeep: '#FFE0EC',
  ink: '#3D0A24',
  muted: '#9C2760',
  mutedSoft: '#C2185B88',
  period: '#E91E63',
  fertile: '#AB47BC',
  ovulation: '#8E24AA',
  todayRing: '#00BFA5',
  card: '#FFFFFF',
  cardSoft: '#FFF0F5',
  fab: '#E91E63',
  border: 'rgba(233, 30, 99, 0.10)',
  shadow: '#C2185B',
  danger: '#D50000',
  success: '#00C853',
  white: '#FFFFFF',
  overlay: 'rgba(74, 20, 140, 0.42)',
  heroFrom: '#FCE4EC',
  heroTo: '#F8BBD0',
  accentGlow: '#FF80AB',
};

export const cycleDark = {
  blush: '#880E4F',
  blushDeep: '#F06292',
  rose: '#FF4081',
  roseSoft: '#3D1528',
  lavender: '#CE93D8',
  lavenderSoft: '#2A1630',
  peach: '#4A1830',
  mint: '#F48FB1',
  cream: '#140A10',
  creamDeep: '#1F1018',
  ink: '#FCE4EC',
  muted: '#F8BBD0',
  mutedSoft: '#F48FB1AA',
  period: '#FF4081',
  fertile: '#CE93D8',
  ovulation: '#EA80FC',
  todayRing: '#1DE9B6',
  card: '#1E1218',
  cardSoft: '#26151E',
  fab: '#FF4081',
  border: 'rgba(255, 64, 129, 0.16)',
  shadow: '#000000',
  danger: '#FF5252',
  success: '#69F0AE',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.55)',
  heroFrom: '#3D1528',
  heroTo: '#4A1830',
  accentGlow: '#FF80AB',
};

export type CyclePalette = typeof cycleLight;

export function useCycleColors(): CyclePalette {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? cycleDark : cycleLight;
}

export const cycleShadow = {
  soft: {
    shadowColor: '#E91E63',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  fab: {
    shadowColor: '#E91E63',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  card: {
    shadowColor: '#AD1457',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;
