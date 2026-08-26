/** Figma 8848:112415 — health metrics screen tokens. */
export const FIGMA_HEALTH_METRICS = {
  brand: '#14B8A6',
  brandQuaternary: '#F0FDFA',
  textPrimary: '#1F2937',
  textSecondary: '#4B5563',
  border: '#E5E7EB',
  cardBg: '#F9FAFB',
  cardRadius: 24,
  weight: '#F97316',
  bloodPressure: '#8B5CF6',
  heartRate: '#F43F5E',
  sleep: '#1E3A8A',
  nutrition: '#22C55E',
  hydration: '#14B8A6',
} as const;

export const METRIC_COLORS = {
  weight: FIGMA_HEALTH_METRICS.weight,
  bloodPressure: FIGMA_HEALTH_METRICS.bloodPressure,
  heartRate: FIGMA_HEALTH_METRICS.heartRate,
  sleep: FIGMA_HEALTH_METRICS.sleep,
  nutrition: FIGMA_HEALTH_METRICS.nutrition,
  hydration: FIGMA_HEALTH_METRICS.hydration,
} as const;
