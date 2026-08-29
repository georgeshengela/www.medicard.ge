import { useIsDark } from '@/theme/colors';

/** Figma 11405:99213 — Medication Tracker design tokens. */
export const FIGMA_MEDS = {
  brand: '#14B8A6',
  brandDark: '#0D9488',
  brandQuaternary: '#F0FDFA',
  brandBorder: '#14B8A6',
  brandTertiary: '#99F6E4',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textOnBrand: '#FFFFFF',
  border: '#E5E7EB',
  borderTertiary: '#D1D5DB',
  cardBg: '#F9FAFB',
  cardBgTertiary: '#F3F4F6',
  white: '#FFFFFF',
  /** Figma `bg/default/primary` — cards, time chips, unselected day pills. */
  surface: '#FFFFFF',
  headerBg: '#FFFFFF',
  pageBg: '#F9FAFB',
  destructive: '#F43F5E',
  warning: '#F59E0B',
  success: '#22C55E',
  /** Filled CTA — dark uses `#0D9488`, not bright teal. */
  ctaBg: '#14B8A6',
  dangerSoft: '#FEE2E2',
  dangerText: '#E11D48',
  paddingH: 16,
  sectionPy: 8,
  cardRadius: 24,
  cardRadiusSm: 20,
  cardRadiusMd: 16,
  inputRadius: 14,
  inputHeight: 48,
  daySize: 40,
  iconBtn: 48,
  shadowCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  shadowInput: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pillColors: [
    '#14B8A6',
    '#1E3A8A',
    '#E5E7EB',
    '#F43F5E',
    '#F97316',
    '#22C55E',
    '#0EA5E9',
    '#6366F1',
    '#334155',
    '#111827',
  ] as const,
  popularCategories: [
    { key: 'diabetes', label: 'დიაბეტი' },
    { key: 'heart', label: ' გული' },
    { key: 'pain', label: 'ტკივილი' },
  ] as const,
} as const;

export const FIGMA_MEDS_DARK = {
  brandQuaternary: '#042F2E',
  brandTertiary: '#115E59',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  border: '#374151',
  borderTertiary: '#4B5563',
  cardBg: '#111827',
  cardBgTertiary: '#1F2937',
  white: '#1F2937',
  surface: '#111827',
  headerBg: '#030712',
  pageBg: '#030712',
  ctaBg: '#0D9488',
  dangerSoft: '#4C0519',
  dangerText: '#F43F5E',
  shadowCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  shadowInput: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

export function useFigmaMeds() {
  const dark = useIsDark();
  return dark ? { ...FIGMA_MEDS, ...FIGMA_MEDS_DARK } : FIGMA_MEDS;
}

export const MED_POPULAR_CHIPS = ['ibuprofen', 'amoxicillin', 'atorvastatin'] as const;

export const MED_DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export const ALL_PILL_SHAPES = [
  'long',
  'diamond',
  'rectangle',
  'triangle',
  'hexagon',
  'pentagon',
  'circle',
  'shield',
  'teardrop',
  'trapezoid',
  'square',
] as const;

export const FREQUENCY_OPTIONS = [
  { id: 'daily', labelKey: 'frequencyDaily' as const },
  { id: 'one_time', labelKey: 'frequencyOneTime' as const },
  { id: 'weekly', labelKey: 'frequencyWeekly' as const },
  { id: 'as_needed', labelKey: 'frequencyAsNeeded' as const },
] as const;
