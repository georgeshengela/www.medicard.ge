import { useIsDark } from '@/theme/colors';
import { cycleDark, cycleLight, type CyclePalette } from './cyclePalette';
export { cycleDark, cycleLight, type CyclePalette } from './cyclePalette';

/** Convert #RRGGBB + alpha 0-1 to a native-safe color. */
export function cycleHexAlpha(hex: string, alpha: number) {
  const raw = String(hex || '').replace('#', '');
  if (raw.length !== 6) return hex;
  return `rgba(${parseInt(raw.slice(0, 2), 16)},${parseInt(raw.slice(2, 4), 16)},${parseInt(raw.slice(4, 6), 16)},${alpha})`;
}

export function useCycleColors(): CyclePalette {
  return useIsDark() ? cycleDark : cycleLight;
}

const FLAT = {
  shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 }, elevation: 0,
} as const;
export const cycleShadow = { soft: FLAT, fab: FLAT, card: FLAT } as const;
