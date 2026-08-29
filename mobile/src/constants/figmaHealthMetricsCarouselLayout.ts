import { useIsDark } from '@/theme/colors';

/** Figma 8911:174697 — home Health Metrics carousel tokens. */
export const FIGMA_HEALTH_METRICS_CAROUSEL = {
  cardWidth: 160,
  cardGap: 8,
  cardRadius: 20,
  cardBg: '#F9FAFB',
  cardBorder: '#E5E7EB',
  cardPadding: 16,
  cardGapInner: 16,
  iconSize: 40,
  valueSize: 20,
  valueLine: 28,
  unitSize: 14,
  labelSize: 14,
  titleSize: 16,
  seeAllSize: 14,
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  brand: '#14B8A6',
  dotInactive: '#E5E7EB',
  dotActive: '#14B8A6',
  dotHeight: 8,
  dotInactiveWidth: 16,
  dotActiveWidth: 32,
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

export const FIGMA_HEALTH_METRICS_CAROUSEL_DARK = {
  cardBg: '#111827',
  cardBorder: '#374151',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  dotInactive: '#374151',
} as const;

export function useFigmaHealthMetricsCarousel() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_HEALTH_METRICS_CAROUSEL, ...FIGMA_HEALTH_METRICS_CAROUSEL_DARK } : FIGMA_HEALTH_METRICS_CAROUSEL;
}
