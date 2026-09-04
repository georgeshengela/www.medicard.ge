import { useIsDark } from '@/theme/colors';

/** Figma 8852:143210 — Nightingale history list chrome. */
export const FIGMA_LAB = {
  pageBg: '#FFFFFF',
  cardBg: '#F9FAFB',
  border: '#E5E7EB',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  brand: '#14B8A6',
  brandLight: '#99F6E4',
  brandSoft: '#F0FDFA',
  destructive: '#F43F5E',
  destructiveSoft: '#FFF1F2',
  destructiveBorder: '#FECDD3',
  iconWell: '#F3E8FF',
  iconWellInk: '#7C3AED',
  shadowXs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

export const FIGMA_LAB_DARK = {
  pageBg: '#030712',
  cardBg: '#111827',
  border: '#374151',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  brandSoft: '#042F2E',
  destructiveSoft: '#4C0519',
  destructiveBorder: '#9F1239',
  iconWell: '#1F2937',
  iconWellInk: '#C4B5FD',
} as const;

export function useFigmaLab() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_LAB, ...FIGMA_LAB_DARK } : FIGMA_LAB;
}
