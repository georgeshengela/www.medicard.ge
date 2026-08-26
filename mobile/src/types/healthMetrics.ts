export type HealthMetricKey =
  | 'weight'
  | 'bloodPressure'
  | 'heartRate'
  | 'sleep'
  | 'nutrition'
  | 'hydration';

export type HealthMetricPoint = {
  date: string;
  value: number;
  valueSecondary?: number;
};

export type HealthMetricSnapshot = {
  key: HealthMetricKey;
  value: number | null;
  valueSecondary?: number | null;
  unit: string;
  statusKa: string;
  updatedLabel: string;
  weekValues: (number | null)[];
  source: 'device' | 'profile' | 'none';
};

export type HealthMetricsBundle = {
  connected: boolean;
  platform: 'apple' | 'google' | null;
  metrics: HealthMetricSnapshot[];
  fetchedAt: string;
};

export const HEALTH_METRIC_ORDER: HealthMetricKey[] = [
  'weight',
  'bloodPressure',
  'heartRate',
  'sleep',
  'nutrition',
  'hydration',
];
