export type WeightPace = 'slow' | 'moderate' | 'fast';

export type WeightLog = {
  id: string;
  kg: number;
  at: string;
  date: string;
};

export type WeightGoal = {
  id: string;
  targetKg: number;
  startKg: number;
  startedYmd: string;
  deadlineYmd: string;
  paceKgPerWeek: number;
  pace: WeightPace;
  reminderEnabled: boolean;
  reminderDays: number[];
  reminderHour: number;
  reminderMinute: number;
  completedSeen?: boolean;
};

export type WeightGoalDraft = Partial<WeightGoal> & {
  targetKg: number;
  startKg: number;
  /** `medi` = auto from profile; `user` = they moved the slider. */
  paceSource?: 'medi' | 'user';
};

export type WeightGoalProgress = {
  goal: WeightGoal;
  current: number;
  remaining: number;
  percent: number;
  daysLeft: number;
  completed: boolean;
  onTrack: boolean;
};
