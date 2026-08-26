export type StepSample = {
  at: string;
  count: number;
  /** Daily total from HealthKit statistics — used for totals, not hourly charts. */
  daily?: boolean;
};

export type StepChartPeriod = '1d' | '1w' | '1m' | '1y' | 'all';

export type StepLogEntry = {
  id: string;
  at: string;
  count: number;
};

export type StepsChartBar = {
  label: string;
  value: number;
};

export type StepsInsights = {
  activeMinutes: number;
  mostActiveTime: string;
  streakDays: number;
  distanceKm: number;
};

export type StepsDayGroup = {
  title: string;
  ymd: string;
  logs: StepLogEntry[];
};

export type StepsMetricsBundle = {
  connected: boolean;
  todayTotal: number;
  goal: number;
  statusKa: string;
  remaining: number;
  peakHourly: number;
  logCount: number;
  chartBars: StepsChartBar[];
  chartPeriod: StepChartPeriod;
  insights: StepsInsights;
  historyPreview: StepLogEntry[];
  historyByDay: StepsDayGroup[];
  fetchedAt: string;
};
