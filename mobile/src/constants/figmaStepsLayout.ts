import { useIsDark } from '@/theme/colors';

/** Figma 8851:166841 / 8850:134246 — steps detail & history tokens. */
export const FIGMA_STEPS = {
  brand: '#14B8A6',
  brandLight: '#99F6E4',
  brandQuaternary: '#F0FDFA',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  border: '#E5E7EB',
  cardBg: '#F9FAFB',
  pageBg: '#FFFFFF',
  cardRadius: 14,
  destructive: '#F43F5E',
  barActive: '#14B8A6',
  barMuted: '#CCFBF1',
  barDim: '#E5E7EB',
  tooltipBg: '#FFFFFF',
  pointRing: '#FFFFFF',
  trendUp: '#166534',
  trendDown: '#B91C1C',
  shadowXs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

export const FIGMA_STEPS_DARK = {
  brandQuaternary: '#042F2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  border: '#374151',
  cardBg: '#111827',
  pageBg: '#030712',
  barMuted: '#115E59',
  barDim: '#374151',
  tooltipBg: '#1F2937',
  pointRing: '#111827',
  trendUp: '#22C55E',
  trendDown: '#F43F5E',
} as const;

export function useFigmaSteps() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_STEPS, ...FIGMA_STEPS_DARK } : FIGMA_STEPS;
}

export const DEFAULT_STEPS_GOAL = 10_000;
