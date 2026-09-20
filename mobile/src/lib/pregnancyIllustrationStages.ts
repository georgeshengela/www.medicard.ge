/** Representative educational artwork, separate from the weekly measurement catalog. */
export const PREGNANCY_ILLUSTRATION_WEEKS = [6, 8, 12, 16, 20, 24, 32, 38] as const;
export function pregnancyIllustrationWeek(week: number): number | null {
  if (!Number.isFinite(week) || week < 6 || week > 40) return null;
  return [...PREGNANCY_ILLUSTRATION_WEEKS].reverse().find(stage => stage <= Math.floor(week)) ?? null;
}
