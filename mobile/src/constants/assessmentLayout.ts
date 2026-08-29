import { useIsDark } from '@/theme/colors';

/** Figma Comprehensive Health Assessment — shared spacing & sizing. */
export const ASSESSMENT = {
  sectionGap: 28,
  cardGap: 10,
  cardRadius: 16,
  pillRadius: 18,
  inputRadius: 16,
  border: '#E5E7EB',
  borderActive: '#14b8a6',
  text: '#0F172A',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  muted: '#64748B',
  faint: '#94A3B8',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',
  pageBg: '#FFFFFF',
  selectedSoft: '#F0FDFA',
  track: '#F3F4F6',
  heroNumber: 56,
  displayNumber: 96,
  displayNumberLineHeight: 104,
  /** Figma 9217:164526 — weight ruler on a 375pt frame. */
  weightRulerH: 169,
  weightNeedleW: 4,
  weightNeedleH: 141,
  weightTickMinor: 36,
  weightTickMajor: 72,
  /** Figma 9217:164506 — body-type figures on a 375pt frame. */
  bodyFigureW: 115.556,
  bodyFigureH: 320,
  bodyFigureGap: 32,
  swipeIcon: 20,
} as const;

export const ASSESSMENT_DARK = {
  border: '#374151',
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  muted: '#9CA3AF',
  faint: '#6B7280',
  surface: '#111827',
  surfaceMuted: '#1F2937',
  pageBg: '#030712',
  selectedSoft: '#042F2E',
  track: '#374151',
} as const;

export function useAssessment() {
  const dark = useIsDark();
  return dark ? { ...ASSESSMENT, ...ASSESSMENT_DARK } : ASSESSMENT;
}
