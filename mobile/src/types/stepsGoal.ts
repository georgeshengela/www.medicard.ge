export type StepsGoal = {
  id: string;
  targetSteps: number;
  deadlineYmd: string;
  startedYmd: string;
  reminderEnabled: boolean;
  /** 0 = Monday … 6 = Sunday */
  reminderDays: number[];
  reminderHour: number;
  reminderMinute: number;
  completedSeen?: boolean;
  pointsClaimed?: boolean;
};

export type StepsGoalProgress = {
  goal: StepsGoal;
  current: number;
  remaining: number;
  percent: number;
  daysLeft: number;
  completed: boolean;
};

export type StepsGoalRecord = {
  id: string;
  targetSteps: number;
  startedYmd: string;
  deadlineYmd: string;
  completedYmd: string;
  currentSteps: number;
};
