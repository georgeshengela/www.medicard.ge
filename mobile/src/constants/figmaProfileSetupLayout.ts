import { useIsDark } from '@/theme/colors';

/** Nightingale profile setup — phone + OTP (Figma 8845:310502, 8845:310664). */
export const FIGMA_PROFILE_SETUP = {
  titleSize: 30,
  titleLineHeight: 38,
  titleColor: '#1F2937',
  bodySize: 16,
  bodyLineHeight: 26,
  bodyColor: '#4B5563',
  brand: '#14B8A6',
  pageBg: '#FFFFFF',
  inputBg: '#FFFFFF',
  cardBg: '#F9FAFB',
  inputRadius: 14,
  inputMinHeight: 48,
  inputBorder: '#D1D5DB',
  otpBoxSize: 80,
  otpBoxRadius: 20,
  otpGap: 8,
  phoneIllustrationSize: 256,
} as const;

export const FIGMA_PROFILE_SETUP_DARK = {
  titleColor: '#FFFFFF',
  bodyColor: '#D1D5DB',
  pageBg: '#030712',
  inputBg: '#111827',
  cardBg: '#111827',
  inputBorder: '#4B5563',
} as const;

export function useFigmaProfileSetup() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_PROFILE_SETUP, ...FIGMA_PROFILE_SETUP_DARK } : FIGMA_PROFILE_SETUP;
}

export const FIGMA_PROFILE_SETUP_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 2,
} as const;
