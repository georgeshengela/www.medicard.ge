import { useIsDark } from '@/theme/colors';

/** Figma 11425:139549 — daily streak / login bonus. */
export const FIGMA_STREAK = {
  brand: '#14B8A6',
  warning: '#F59E0B',
  warningSoft: '#FCD34D',
  destructive: '#F43F5E',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  weekday: '#6B7280',
  pageBg: '#FFFFFF',
  cardBg: '#F9FAFB',
  border: '#E5E7EB',
  emptyDot: '#E5E7EB',
  onFlame: '#FFFFFF',
  cardRadius: 24,
  daySize: 32,
  completedHeight: 40.6552,
  flameWidth: 109,
  flameHeight: 133.913,
  highlightWidth: 55,
  highlightHeight: 76.3586,
  glowOuter: 343,
  glowMid: 253,
  glowInner: 169,
  heroHeight: 148,
} as const;

export const FIGMA_STREAK_DARK = {
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  weekday: '#9CA3AF',
  pageBg: '#030712',
  cardBg: '#111827',
  border: '#374151',
  emptyDot: '#374151',
} as const;

export function useFigmaStreak() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_STREAK, ...FIGMA_STREAK_DARK } : FIGMA_STREAK;
}
