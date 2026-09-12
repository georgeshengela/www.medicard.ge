export type HealthScoreBand = {
  min: number;
  max: number;
  label: string;
  labelKa: string;
  color: string;
  detailKa: string;
};

/** Canonical Asklepios scale: worse → better. Used on Home, results header, and legend. */
export const HEALTH_SCORE_BANDS: HealthScoreBand[] = [
  {
    min: 0,
    max: 20,
    label: 'Critical',
    labelKa: 'კრიტიკული',
    color: '#F43F5E',
    detailKa: 'საჭიროა სასწრაფოდ ექიმს მიმართო და ერთად შეადგინო გეგმა.',
  },
  {
    min: 21,
    max: 50,
    label: 'Suboptimal',
    labelKa: 'არაოპტიმალური',
    color: '#F97316',
    detailKa: 'რამდენიმე მაჩვენებელი ჩვეულ ნორმაზე დაბალია — ყოველდღიური ჩვევების შეცვლა დაგეხმარება.',
  },
  {
    min: 51,
    max: 70,
    label: 'Mild Risk',
    labelKa: 'მსუბუქი რისკი',
    color: '#EAB308',
    detailKa: 'მცირე გადახრები ოპტიმალური ჯანმრთელობისგან — პრევენცია და თვალყური დაგეხმარება.',
  },
  {
    min: 71,
    max: 100,
    label: 'Normal',
    labelKa: 'ნორმალური',
    color: '#14B8A6',
    detailKa: 'ძირითადი მაჩვენებლები ნორმალურ დიაპაზონშია — გააგრძელეთ ჯანსაღი ჩვევები.',
  },
];

export function clampHealthScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function bandForScore(score: number): HealthScoreBand {
  const n = clampHealthScore(score);
  return HEALTH_SCORE_BANDS.find((b) => n >= b.min && n <= b.max) ?? HEALTH_SCORE_BANDS[HEALTH_SCORE_BANDS.length - 1];
}

export function healthScoreLabelKa(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '';
  return bandForScore(score).labelKa;
}

/**
 * Assessment confidence as a 0–100 percent, or null when the value is not credible.
 * 0–1 values are treated as fractions (0.8 → 80). Sub-5% results are hidden.
 */
export function displayConfidencePercent(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  const pct = raw <= 1 ? raw * 100 : raw;
  if (pct < 5) return null;
  return Math.min(100, Math.round(pct * 10) / 10);
}
