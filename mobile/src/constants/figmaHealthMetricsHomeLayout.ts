import { useIsDark } from '@/theme/colors';

/** Figma 8911:62668 — home Health Metrics section (empty + filled shell). */
export const FIGMA_HEALTH_METRICS_HOME = {
  cardBg: '#F9FAFB',
  cardBorder: '#E5E7EB',
  cardRadius: 24,
  cardPadding: 16,
  cardGap: 16,
  illustrationHeight: 180,
  titleSize: 16,
  bodySize: 14,
  bodyLine: 22,
  actionSize: 14,
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  brand: '#14B8A6',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

export const FIGMA_HEALTH_METRICS_HOME_DARK = {
  cardBg: '#111827',
  cardBorder: '#374151',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
} as const;

export function useFigmaHealthMetricsHome() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_HEALTH_METRICS_HOME, ...FIGMA_HEALTH_METRICS_HOME_DARK } : FIGMA_HEALTH_METRICS_HOME;
}
