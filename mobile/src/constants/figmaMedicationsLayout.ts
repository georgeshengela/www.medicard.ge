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
  destructive: '#F43F5E',
  warning: '#F59E0B',
  success: '#22C55E',
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
