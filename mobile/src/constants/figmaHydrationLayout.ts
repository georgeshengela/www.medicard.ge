import { useIsDark } from '@/theme/colors';

/** Figma 9283:202564 / 9017:196580 / 9017:209643 / 8852:117118 — hydration tokens. */
export const FIGMA_HYDRATION = {
  brand: '#14B8A6',
  brandLight: '#99F6E4',
  brandMuted: '#CCFBF1',
  brandQuaternary: '#F0FDFA',
  waterDeep: '#0EA5E9',
  waterMid: '#38BDF8',
  waterSoft: '#BAE6FD',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  cardBg: '#F9FAFB',
  pageBg: '#FFFFFF',
  tabTrack: '#F3F4F6',
  tabActive: '#FFFFFF',
  success: '#22C55E',
  successText: '#166534',
  destructive: '#F43F5E',
  warning: '#F59E0B',
  miss: '#F43F5E',
  shadowXs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shadowMd: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
} as const;

export const FIGMA_HYDRATION_DARK = {
  brandQuaternary: '#042F2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textTertiary: '#6B7280',
  border: '#374151',
  borderStrong: '#4B5563',
  cardBg: '#111827',
  pageBg: '#030712',
  tabTrack: '#1F2937',
  tabActive: '#111827',
  waterDeep: '#0284C7',
  waterMid: '#0EA5E9',
  waterSoft: '#164E63',
  successText: '#86EFAC',
} as const;

export function useFigmaHydration() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_HYDRATION, ...FIGMA_HYDRATION_DARK } : FIGMA_HYDRATION;
}
