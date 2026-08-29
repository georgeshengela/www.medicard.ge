import { useIsDark } from '@/theme/colors';

/** Figma 8911:62026 — Home dashboard top tokens. */
export const FIGMA_HOME_DASHBOARD = {
  brand: '#14B8A6',
  brandQuaternary: '#F0FDFA',
  brandBorder: '#99F6E4',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  border: '#E5E7EB',
  borderTertiary: '#D1D5DB',
  cardRadius: 24,
  scoreBoxRadius: 16,
  scoreBoxSize: 64,
  setupCardBg: '#F9FAFB',
  cardBg: '#FFFFFF',
  badgeBg: '#FFFFFF',
  badgeBgExhausted: '#FFF1F2',
  badgeBorderExhausted: '#FECDD3',
  avatarBg: '#FFFFFF',
  avatarRing: '#FFFFFF',
  checkboxBg: '#FFFFFF',
  chevron: '#9CA3AF',
  warning: '#F59E0B',
  success: '#22C55E',
} as const;

/** Dark home dashboard — Figma 11413:249017. */
export const FIGMA_HOME_DASHBOARD_DARK = {
  brandQuaternary: '#042F2E',
  brandBorder: '#115E59',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  border: '#374151',
  borderTertiary: '#4B5563',
  setupCardBg: '#111827',
  cardBg: '#111827',
  badgeBg: '#1F2937',
  badgeBgExhausted: '#4C0519',
  badgeBorderExhausted: '#9F1239',
  avatarBg: '#1F2937',
  avatarRing: '#111827',
  checkboxBg: '#111827',
  chevron: '#6B7280',
} as const;

export function useFigmaHomeDashboard() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_HOME_DASHBOARD, ...FIGMA_HOME_DASHBOARD_DARK } : FIGMA_HOME_DASHBOARD;
}
