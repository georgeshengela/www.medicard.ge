import { api, API_BASE_URL } from '@/lib/api';

export type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED';

export type QuestItem = {
  id: string;
  key: string | null;
  category: string | null;
  cadence: string | null;
  titleKey: string | null;
  descriptionKey: string | null;
  progressType: string | null;
  target: number;
  progress: number;
  progressPercent: number;
  status: QuestStatus;
  periodKey: string;
  assignedAt: string | null;
  completedAt: string | null;
  claimedAt: string | null;
  expiresAt: string | null;
  rewardCoins: number;
  rewardXp: number;
  claimable: boolean;
  /** Phase 5 — safe Smart Quest presentation metadata (movement quests only). */
  targetSource?: 'DEFAULT' | 'PERSONALIZED' | 'COMEBACK' | null;
  difficulty?: 'EASY' | 'NORMAL' | 'STRETCH' | null;
  reasonKey?: 'PERSONAL_BASELINE' | 'COMEBACK_EASY' | 'STRUGGLING_ADJUSTED' | 'DEFAULT_TARGET' | null;
};

export type QuestProfile = {
  level: number;
  rankKey: string;
  totalXp: number;
  coinBalance: number;
  currentStreak: number;
  longestStreak: number;
  levelProgress: {
    level: number;
    levelStartXp?: number;
    nextLevelXp?: number | null;
    xpIntoLevel?: number;
    xpNeededForNextLevel?: number | null;
    progressPercent?: number;
  };
  timezone?: string;
};

export type QuestDashboard = {
  /** `null` when the server answers with `unavailable: true` (quest tables missing / profile not created yet). */
  profile: QuestProfile | null;
  daily: { periodKey: string; timezone: string; quests: QuestItem[] };
  weekly: { periodKey: string; quests: QuestItem[] };
  summary: {
    dailyCompleted: number;
    dailyTotal: number;
    dailyClaimable: number;
    weeklyCompleted: number;
    unclaimedRewards: number;
  };
  unavailable?: boolean;
};

export type QuestClaimResult = {
  ok: boolean;
  claimed: boolean;
  alreadyClaimed: boolean;
  quest: { id: string; key: string | null; status: QuestStatus; completedAt: string | null; claimedAt: string | null };
  reward: { coinsAwarded: number; xpAwarded: number };
  profile: {
    coinBalance: number;
    totalXp: number;
    previousLevel: number;
    currentLevel: number;
    leveledUp: boolean;
    levelProgress: QuestProfile['levelProgress'];
    currentStreak: number;
    longestStreak: number;
  };
};

export const questApi = {
  dashboard: (timezone?: string) => api.quests.dashboard(timezone),
  history: (params?: { take?: number; cursor?: string }) => api.quests.history(params),
  rewards: () => api.quests.rewards(),
  claim: (id: string) => api.quests.claim(id),
  timezone: (timezone: string) => api.quests.timezone(timezone),
  hydrationGoalGet: () => api.healthMetrics.hydrationGoalGet(),
  hydrationGoalPut: (goalMl: number) => api.healthMetrics.hydrationGoalPut(goalMl),
  stepCapabilityGet: () => api.healthMetrics.stepCapabilityGet(),
  stepCapabilityPut: (body: { status: string; source?: string }) => api.healthMetrics.stepCapabilityPut(body),
};

export const QUEST_SOCKET_URL = API_BASE_URL;
