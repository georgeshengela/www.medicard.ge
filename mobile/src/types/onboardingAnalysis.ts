export type OnboardingScoreRange = {
  min: number;
  max: number;
  label: string;
  labelKa: string;
  color: string;
  detailKa: string;
};

export type OnboardingSpecialist = {
  nameKa: string;
  specialtyKa: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  remote: boolean;
};

export type OnboardingMedication = {
  nameKa: string;
  typeKa: string;
  scheduleKa: string;
  tagsKa: string[];
};

export type OnboardingAnalysis = {
  score: number;
  label: string;
  labelKa: string;
  confidence: number;
  summaryTitleKa: string;
  summaryBodyKa: string;
  scoreRanges: OnboardingScoreRange[];
  bodyComposition: {
    fatPct: number;
    weightKg: number;
    musclePct: number;
    physiqueLabelKa: string;
  };
  recommendations: {
    specialists: OnboardingSpecialist[];
    medications: OnboardingMedication[];
    bloodPressure: { systolic: number; diastolic: number; summaryKa: string };
    sleep: {
      personaKa: string;
      adviceKa: string;
      currentHours: number[];
      optimalHours: number[];
    };
    pharmacies: {
      nameKa: string;
      addressKa: string;
      rating: number;
      freeDelivery: boolean;
      tagKa: string;
    }[];
    products: {
      nameKa: string;
      priceGel: number;
      originalPriceGel: number;
      discountPct: number;
      rating: number;
      rxNeeded: boolean;
      inStock: number;
    }[];
    articles: { titleKa: string; readMinutes: number }[];
  };
  engine?: string;
  model?: string | null;
  previousScore?: number | null;
  scoreDelta?: number | null;
  analyzedAt?: string | null;
};

export function analysisFromProfile(extra: Record<string, unknown> | null | undefined): OnboardingAnalysis | null {
  const raw = extra?.onboardingAnalysis;
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as OnboardingAnalysis;
  if (typeof a.score !== 'number') return null;
  return a;
}
