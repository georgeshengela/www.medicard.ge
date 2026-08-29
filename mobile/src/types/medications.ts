export type MedicationForm = 'pills' | 'capsules' | 'liquid' | 'injection';

export type MedicationFrequencyKind = 'daily' | 'one_time' | 'weekly' | 'as_needed';

export type MealTiming = 'any' | 'before' | 'after' | 'with';

export type PillShape =
  | 'long'
  | 'diamond'
  | 'square'
  | 'triangle'
  | 'hexagon'
  | 'rectangle'
  | 'teardrop'
  | 'pentagon'
  | 'trapezoid'
  | 'shield'
  | 'circle';

export type MedicationConfig = {
  genericName?: string;
  form?: MedicationForm;
  amount?: number;
  frequencyKind?: MedicationFrequencyKind;
  timesPerDay?: number;
  daysOfWeek?: number[];
  startDate?: string;
  endDate?: string;
  pillColor?: string;
  pillShape?: PillShape;
  refillReminder?: boolean;
  refillThreshold?: number;
  mealTiming?: MealTiming;
  category?: string;
  remainingCount?: number;
  imageUrl?: string;
  catalogProductId?: string;
  manufacturer?: string;
  strength?: string;
};

export type DoseStatus = 'pending' | 'taken' | 'skipped';

export type MedicationDoseLog = {
  medicationId: string;
  date: string;
  time: string;
  status: DoseStatus;
  updatedAt: string;
};
