import type { QuestClaimResult, QuestDashboard, QuestItem } from './api';
import type { CompanionCosmetic, CompanionJourney, CompanionOverview } from '@/lib/companion/api';
import { visualKeyForCosmetic } from '@/lib/companion/cosmeticVisuals';
import { rankKeyFromLevel } from './logic.js';

export type QuestHubTab = 'missions' | 'progress' | 'rewards';
export function questHubTab(value: unknown): QuestHubTab {
  return value === 'progress' || value === 'rewards' ? value : 'missions';
}

/** Reward-ready missions come first; completed rewards remain visible at the end. */
export function orderedMissions(quests: QuestItem[]) {
  const weight = (q: QuestItem) => q.claimable && q.status === 'COMPLETED' ? 0 : q.status === 'ACTIVE' ? 1 : 2;
  return [...quests].sort((a, b) => weight(a) - weight(b));
}

export function applyClaimToDashboard(dashboard: QuestDashboard, result: QuestClaimResult): QuestDashboard {
  const update = (rows: QuestItem[]) => rows.map(q => q.id === result.quest.id ? {
    ...q, status: result.quest.status, claimable: false,
    claimedAt: result.quest.claimedAt, completedAt: result.quest.completedAt,
  } : q);
  const daily = update(dashboard.daily.quests), weekly = update(dashboard.weekly.quests);
  return {
    ...dashboard,
    profile: dashboard.profile ? {
      ...dashboard.profile, level: result.profile.currentLevel, rankKey: rankKeyFromLevel(result.profile.currentLevel),
      totalXp: result.profile.totalXp, coinBalance: result.profile.coinBalance,
      currentStreak: result.profile.currentStreak, longestStreak: result.profile.longestStreak,
      levelProgress: result.profile.levelProgress,
    } : null,
    daily: { ...dashboard.daily, quests: daily }, weekly: { ...dashboard.weekly, quests: weekly },
    summary: {
      ...dashboard.summary,
      dailyClaimable: daily.filter(q => q.claimable).length,
      unclaimedRewards: [...daily, ...weekly].filter(q => q.claimable).length,
    },
  };
}

/** Thresholds describe completed missions, not XP, coins, or GPS distance. */
export function journeyPresentation(journey: CompanionJourney) {
  const milestones = [...journey.milestones].sort((a, b) => a.at - b.at);
  const next = milestones.find(m => m.key === journey.nextMilestoneKey) ?? null;
  const previous = next ? [...milestones].reverse().find(m => m.at < next.at && m.unlocked) : null;
  const start = previous?.at ?? 0;
  const percent = next ? Math.max(0, Math.min(100, ((journey.units - start) / Math.max(1, next.at - start)) * 100)) : milestones.length ? 100 : 0;
  return { milestones, next, remaining: next ? Math.max(0, next.at - journey.units) : 0, percent,
    unlocked: milestones.filter(m => m.unlocked).length };
}

/** The API returns owned items; upcoming milestones provide the locked previews. */
export function questCollection(overview: CompanionOverview): CompanionCosmetic[] {
  const items = [...overview.collection];
  const known = new Set(items.map(item => item.key));
  for (const milestone of overview.journey.milestones) {
    const key = milestone.cosmeticKey;
    if (!key || known.has(key)) continue;
    const assetKey = visualKeyForCosmetic(key);
    if (!assetKey) continue;
    const slot = assetKey.startsWith('bg.') ? 'background' : assetKey.startsWith('decor.') ? 'decoration' : assetKey.startsWith('accent.') ? 'accent' : 'accessory';
    items.push({ key, assetKey, slot, type: 'JOURNEY_PREVIEW', styleTier: milestone.major ? 'SPECIAL' : 'COMMON', titleKey: `companion.cosmetic.${key.toLowerCase()}.title`, descriptionKey: '', unlocked: false });
    known.add(key);
  }
  return items;
}
