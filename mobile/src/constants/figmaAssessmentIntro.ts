import { useIsDark } from '@/theme/colors';

/** Figma node 9217:164373 — Comprehensive Health Assessment intro. */
export const FIGMA_ASSESSMENT_INTRO = {
  cardWidth: 229,
  cardHeight: 312,
  cardRadius: 24,
  pageBg: '#FFFFFF',
  selectedSoft: '#F0FDF4',
  cardBg: '#F9FAFB',
  cardBorder: '#E5E7EB',
  heroHeight: 346,
  contentPaddingX: 16,
  contentPaddingY: 24,
  textGap: 16,
  blockGap: 24,
  titleSize: 30,
  titleLineHeight: 38,
  titleColor: '#1F2937',
  bodySize: 16,
  bodyLineHeight: 26,
  bodyColor: '#4B5563',
  stepperDotSize: 20,
  stepperInnerDot: 8,
  stepperLineHeight: 2,
  stepperLabelSize: 14,
  stepperLabelLineHeight: 20,
  stepperGap: 10,
  brandTeal: '#14B8A6',
  inactiveBorder: '#9CA3AF',
  inactiveDot: '#9CA3AF',
  trackGrey: '#E5E7EB',
  focusRing: 'rgba(20, 184, 166, 0.3)',
} as const;

export const FIGMA_ASSESSMENT_INTRO_DARK = {
  pageBg: '#030712',
  selectedSoft: '#042F2E',
  cardBg: '#111827',
  cardBorder: '#374151',
  titleColor: '#FFFFFF',
  bodyColor: '#D1D5DB',
  inactiveBorder: '#6B7280',
  inactiveDot: '#6B7280',
  trackGrey: '#374151',
} as const;

export function useFigmaAssessmentIntro() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_ASSESSMENT_INTRO, ...FIGMA_ASSESSMENT_INTRO_DARK } : FIGMA_ASSESSMENT_INTRO;
}

export const FIGMA_ASSESSMENT_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 2,
} as const;
