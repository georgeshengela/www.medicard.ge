import { useIsDark } from '@/theme/colors';

/** Figma 8846:137103 — subscription plans screen tokens. */
export const FIGMA_PLANS = {
  brand: '#14B8A6',
  brandQuaternary: '#F0FDFA',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  border: '#E5E7EB',
  borderTertiary: '#D1D5DB',
  cardRadius: 24,
  cardBg: '#F9FAFB',
  pageBg: '#FFFFFF',
  badgeBg: '#1F2937',
  badgeFg: '#FFFFFF',
  warning: '#F43F5E',
} as const;

export const FIGMA_PLANS_DARK = {
  brandQuaternary: '#042F2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  border: '#374151',
  borderTertiary: '#4B5563',
  cardBg: '#111827',
  pageBg: '#030712',
  badgeBg: '#FFFFFF',
  badgeFg: '#111827',
} as const;

export function useFigmaPlans() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_PLANS, ...FIGMA_PLANS_DARK } : FIGMA_PLANS;
}
