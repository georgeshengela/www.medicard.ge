import { createContext, useContext } from 'react';
import { useIsDark } from '@/theme/colors';
import type { VelvetPalette } from '@/theme/velvet';

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
  tint: '#F0FDFA',
  tintStrong: '#CCFBF1',
  tintBorder: '#99F6E4',
  hairline: '#D1D5DB',
  rowLine: '#F3F4F6',
  brand: '#14B8A6',
  brandInk: '#0F766E',
  onBrand: '#FFFFFF',
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
  tint: '#042F2E',
  tintStrong: '#115E59',
  tintBorder: '#115E59',
  hairline: '#374151',
  rowLine: '#374151',
  brand: '#14B8A6',
  brandInk: '#99F6E4',
  onBrand: '#FFFFFF',
  track: '#1F2937',
} as const;

type AssessmentTokens = { [K in keyof typeof ASSESSMENT]: (typeof ASSESSMENT)[K] extends string ? string : (typeof ASSESSMENT)[K] };

/** The question pickers in the velvet registration pages: the page's own colours, teal for the choice. */
export function velvetAssessmentTokens(p: VelvetPalette): AssessmentTokens {
  return {
    ...ASSESSMENT,
    border: p.shade,
    borderActive: p.pulse,
    text: p.text,
    textPrimary: p.text,
    textSecondary: p.ink2,
    muted: p.ink2,
    faint: p.inkOff,
    surface: p.field,
    surfaceMuted: p.field,
    pageBg: p.surface,
    selectedSoft: p.field,
    tint: p.field,
    tintStrong: p.field,
    tintBorder: p.pulse,
    hairline: p.shade,
    rowLine: p.shade,
    brand: p.pulse,
    brandInk: p.ink,
    onBrand: '#FFFFFF',
    track: p.field,
  };
}

/** Set by a velvet page so every picker inside it follows the page (see `velvetAssessmentTokens`). */
export const AssessmentTokensContext = createContext<AssessmentTokens | null>(null);

export function useAssessment(): AssessmentTokens {
  const dark = useIsDark();
  const override = useContext(AssessmentTokensContext);
  if (override) return override;
  return dark ? { ...ASSESSMENT, ...ASSESSMENT_DARK } : ASSESSMENT;
}
