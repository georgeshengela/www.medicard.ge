import { api } from '@/lib/api';
import type { QuestProfile } from './api';

export type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export type AchievementItem = {
  id: string;
  /** `null` while a secret achievement is still locked (masked by the server). */
  key: string | null;
  family: string | null;
  category: string;
  rarity: AchievementRarity;
  secret: boolean;
  threshold: number | null;
  rewardCoins: number | null;
  rewardXp: number | null;
  unlocked: boolean;
  claimed: boolean;
  claimable: boolean;
  unlockedAt: string | null;
  claimedAt: string | null;
  progress: number | null;
  progressPercent: number | null;
  userAchievementId: string | null;
  sortOrder: number;
};

export type AchievementsSummary = {
  total: number;
  unlocked: number;
  claimable: number;
  claimed: number;
  secretsLocked: number;
  byRarity: Partial<Record<AchievementRarity, number>>;
};

export type AchievementsOverview = {
  items: AchievementItem[];
  summary: AchievementsSummary;
  unavailable?: boolean;
};

export type AchievementClaimResult = {
  ok: boolean;
  claimed: boolean;
  alreadyClaimed: boolean;
  achievement: AchievementItem;
  reward: { coinsAwarded: number; xpAwarded: number };
  profile: {
    coinBalance: number;
    totalXp: number;
    previousLevel: number;
    currentLevel: number;
    leveledUp: boolean;
    levelProgress: QuestProfile['levelProgress'];
    rankKey?: string;
  };
};

export const achievementApi = {
  overview: () => api.achievements.overview(),
  claim: (id: string) => api.achievements.claim(id),
};
