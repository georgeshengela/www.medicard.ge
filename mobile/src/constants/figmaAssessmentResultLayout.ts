/** Figma 8845:313440 — Assessment Result layout tokens. */
export const FIGMA_ASSESSMENT_RESULT = {
  titleSize: 30,
  titleLineHeight: 38,
  titleColor: '#1F2937',
  gaugeHeight: 252,
  scoreSize: 48,
  scoreLineHeight: 56,
  labelSize: 20,
  labelLineHeight: 28,
  labelColor: '#4B5563',
  hintSize: 12,
  summaryTitleSize: 24,
  summaryTitleLineHeight: 32,
  summaryBodySize: 16,
  summaryBodyLineHeight: 26,
  sectionTitleSize: 16,
  sectionTitleLineHeight: 22,
  confidenceBadgeBg: '#F9FAFB',
  confidenceBadgeBorder: '#D1D5DB',
  rangeCardBg: '#F9FAFB',
  rangeCardBorder: '#E5E7EB',
  rangeCardRadius: 14,
  rangeGroupRadius: 16,
  bodyCardBg: '#F9FAFB',
  bodyCardRadius: 24,
  physiqueColor: '#166534',
  arcTrack: '#E5E7EB',
  arcActive: '#F97316',
  arcActiveEnd: '#FDBA74',
  knobSize: 20,
  knobBorder: '#F97316',
} as const;

export const SCORE_RANGE_DOT_COLORS = ['#22C55E', '#F43F5E', '#F59E0B', '#14B8A6'] as const;

export const FIGMA_ASSESSMENT_RESULT_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 2,
} as const;
