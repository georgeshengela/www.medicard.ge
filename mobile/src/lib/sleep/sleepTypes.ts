/** MEDISLEEP API shapes (server/src/routes/sleep.routes.js, lib/sleep.js, lib/sleepInsights.js). */

export type SleepPlan = {
  goalMinutes: number;
  /** HH:MM */
  wakeTime: string;
  weekendWakeTime: string | null;
  windDownMinutes: number;
  bedtimeReminder: boolean;
  checkinReminder: boolean;
  alarm: boolean;
  hideScore: boolean;
};

export type SleepFactor =
  | 'caffeine' | 'alcohol' | 'late_meal' | 'screens' | 'stress' | 'exercise' | 'nap'
  | 'noise' | 'pain' | 'illness' | 'period' | 'kids' | 'heat' | 'travel';

export type SleepTimesSource = 'mode' | 'manual' | 'health';

export type SleepNight = {
  id: string;
  /** YYYY-MM-DD — the morning the night ends. */
  night: string;
  bedAt: string | null;
  wakeAt: string | null;
  inBedMinutes: number | null;
  asleepMinutes: number | null;
  sleptMinutes: number | null;
  stages: { deep: number; rem: number; core: number; awake: number } | null;
  latencyMinutes: number | null;
  wakeups: number | null;
  quality: number | null;
  factors: SleepFactor[];
  sounds: string[];
  timesSource: SleepTimesSource;
  checkedIn: boolean;
};

export type SleepScoreBand = 'great' | 'good' | 'fair' | 'low';
export type SleepRegularityBand = 'steady' | 'regular' | 'variable' | 'irregular';

export type SleepFactorEffect = {
  factor: SleepFactor;
  nightsWith: number;
  nightsWithout: number;
  sleptDiff: number;
  qualityDiff: number | null;
};

export type SleepSummary = {
  window: { start: string; end: string; days: number };
  nightsLogged: number;
  goalMinutes: number;
  avgSleptMinutes: number | null;
  previousAvgSleptMinutes: number | null;
  nightsOnGoal: number;
  /** Minutes after midnight. */
  avgBedtime: number | null;
  avgWake: number | null;
  bedtimeVsPlanMinutes: number | null;
  regularity: { spreadMinutes: number | null; band: SleepRegularityBand | null };
  debtMinutes: number | null;
  socialJetlagMinutes: number | null;
  avgQuality: number | null;
  avgWakeups: number | null;
  avgLatencyMinutes: number | null;
  score: number | null;
  scoreBand: SleepScoreBand | null;
  nightScores: { night: string; score: number | null }[];
  factorCounts: Partial<Record<SleepFactor, number>>;
  factorEffects: SleepFactorEffect[];
  stepsEffect: { stepsCut: number; nights: number; sleptDiff: number; qualityDiff: number | null } | null;
  bestBedtime: { bedtime: number; nights: number } | null;
  /** Average slept minutes by weekday of the night (0 = Sunday). */
  weekday: (number | null)[];
};

export type SleepTip = { id: string; trigger: string; title: string; body: string };

export type SleepConfig = {
  defaultTimerMinutes: number;
  timerOptions: number[];
  fadeSeconds: number;
  maxLayers: number;
  checkinFactors: SleepFactor[];
  breathing: boolean;
  defaultVolume: number;
};

export type SleepSuggestion = {
  plan: SleepPlan;
  basis: {
    age: number | null;
    usualHours: number | null;
    usualBand: string | null;
    feel: 'very-good' | 'fairly-good' | 'fairly-bad' | 'very-bad' | null;
    rangeMinutes: [number, number];
  };
};

export type SleepHub = {
  today: string;
  plan: SleepPlan | null;
  suggested: SleepSuggestion;
  nights: SleepNight[];
  summary: SleepSummary;
  tips: SleepTip[];
  config: SleepConfig;
};

export type SleepInsights = {
  today: string;
  plan: SleepPlan | null;
  nights: SleepNight[];
  summary: SleepSummary;
};

export type SleepCategory = 'rain' | 'nature' | 'noise' | 'music';

export type SleepFileRef = { id: string; url: string; size: number | null };

export type SleepSound = {
  id: string;
  category: SleepCategory;
  title: string;
  subtitle: string;
  tint: string;
  loop: boolean;
  featured: boolean;
  durationMs: number | null;
  audio: SleepFileRef | null;
  tail: SleepFileRef | null;
  art: { id: string; url: string } | null;
};

export type SleepCatalog = {
  categories: { id: SleepCategory; title: string }[];
  sounds: SleepSound[];
  config: SleepConfig;
};

export type SleepNightWrite = {
  id?: string;
  kind: 'mode' | 'manual' | 'health' | 'checkin';
  bedAt?: string | null;
  wakeAt?: string | null;
  asleepMinutes?: number | null;
  awakeMinutes?: number | null;
  deepMinutes?: number | null;
  remMinutes?: number | null;
  coreMinutes?: number | null;
  latencyMinutes?: number | null;
  wakeups?: number | null;
  quality?: number | null;
  factors?: SleepFactor[];
  sounds?: string[];
};

export type SleepPlayWrite = {
  id: string;
  soundIds: string[];
  startedAt: string;
  minutes: number;
  timerMinutes?: number | null;
  sleepMode?: boolean;
};
