import { useIsDark } from '@/theme/colors';

/** Figma 11369:94062 — AI Symptom Checker tokens from SH Nightingale UI Kit v3. */
export const FIGMA_SYMPTOMS = {
  brand: '#14B8A6',
  brandDark: '#0D9488',
  brandSoft: '#F0FDFA',
  brandBorder: '#99F6E4',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textOnBrand: '#FFFFFF',
  border: '#E5E7EB',
  borderTertiary: '#D1D5DB',
  track: '#E5E7EB',
  sparkle: '#F59E0B',
  composerPrimary: '#99F6E4',
  cardBg: '#F9FAFB',
  white: '#FFFFFF',
  canvas: '#F9FAFB',
  inverse: '#1F2937',
  danger: '#F43F5E',
  warning: '#F59E0B',
  success: '#22C55E',
  highRisk: '#F43F5E',
  pad: 16,
  barH: 56,
  btnH: 48,
  btnRadius: 16,
  cardRadius: 24,
  itemRadius: 14,
  chipRadius: 12,
  iconBtn: 48,
  shadowXs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  shadowCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

export const FIGMA_SYMPTOMS_DARK = {
  brandSoft: '#042F2E',
  brandBorder: '#115E59',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  border: '#374151',
  borderTertiary: '#4B5563',
  track: '#374151',
  composerPrimary: '#5EEAD4',
  cardBg: '#111827',
  white: '#1F2937',
  canvas: '#030712',
  inverse: '#FFFFFF',
} as const;

export function useFigmaSymptoms() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_SYMPTOMS, ...FIGMA_SYMPTOMS_DARK } : FIGMA_SYMPTOMS;
}
