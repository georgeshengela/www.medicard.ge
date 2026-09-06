import { useIsDark } from '@/theme/colors';

/** Nightingale 8927:182138 / 182116 / 185344 — weight hub, history, goal. */
export const FIGMA_WEIGHT = {
  brand: '#14B8A6',
  brandLight: '#99F6E4',
  brandSoft: '#F0FDFA',
  brandBorder: '#5EEAD4',
  cta: '#14B8A6',
  ctaDark: '#0D9488',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  cardBg: '#F9FAFB',
  pageBg: '#FFFFFF',
  surface: '#FFFFFF',
  track: '#E5E7EB',
  destructive: '#F43F5E',
  success: '#22C55E',
  successSoft: '#F0FDF4',
  successBorder: '#BBF7D0',
  warning: '#F59E0B',
  flag: '#F43F5E',
  shadowXs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

export const FIGMA_WEIGHT_DARK = {
  brandSoft: '#042F2E',
  brandBorder: '#115E59',
  cta: '#0D9488',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textTertiary: '#6B7280',
  border: '#374151',
  cardBg: '#111827',
  pageBg: '#030712',
  surface: '#111827',
  track: '#374151',
  successSoft: '#052E16',
  successBorder: '#166534',
} as const;

export function useFigmaWeight() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_WEIGHT, ...FIGMA_WEIGHT_DARK } : FIGMA_WEIGHT;
}
