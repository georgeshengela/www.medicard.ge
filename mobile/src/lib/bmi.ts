import { computeBmi } from '@/lib/assessmentForm';

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export const BMI_ZONE_COLORS = {
  underweight: '#38BDF8',
  normal: '#14B8A6',
  overweight: '#F59E0B',
  obese: '#F43F5E',
} as const;

/** Display scale for the home gauge — WHO bands sit inside 15–40. */
export const BMI_GAUGE_MIN = 15;
export const BMI_GAUGE_MAX = 40;

export function bmiFromWeight(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (weightKg == null || heightCm == null) return null;
  return computeBmi(heightCm, weightKg);
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export function bmiGaugeT(bmi: number): number {
  return Math.min(1, Math.max(0, (bmi - BMI_GAUGE_MIN) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)));
}

export function healthyWeightRangeKg(heightCm: number): { min: number; max: number } {
  const m = heightCm / 100;
  return {
    min: Math.round(18.5 * m * m * 10) / 10,
    max: Math.round(24.9 * m * m * 10) / 10,
  };
}

export function weightDeltaKg(weekValues: (number | null)[], current: number): number | null {
  const filled = weekValues.filter((value): value is number => value != null);
  if (filled.length < 2) return null;
  const previous = filled[filled.length - 2];
  if (previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}
