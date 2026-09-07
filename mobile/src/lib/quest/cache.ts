import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import type { QuestDashboard } from './api';
import type { AchievementsOverview } from './achievements';

const DASH_KEY = 'medicard.quest.dashboard.v1';
const SYNC_KEY = 'medicard.quest.sync.v1';
const ACH_KEY = 'medicard.quest.achievements.v1';

export async function readQuestCache(): Promise<{ dashboard: QuestDashboard; savedAt: number } | null> {
  const raw = await getScopedPreference(DASH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { dashboard: QuestDashboard; savedAt: number };
    return parsed?.dashboard ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeQuestCache(dashboard: QuestDashboard): Promise<void> {
  let prevDash: QuestDashboard | null = null;
  try {
    const prev = await readQuestCache();
    prevDash = prev?.dashboard ?? null;
  } catch {
    prevDash = null;
  }
  await setScopedPreference(DASH_KEY, JSON.stringify({ dashboard, savedAt: Date.now() }));
  try {
    const { crossedQuestProgressThreshold } = await import('./questSmartEngage.js');
    const prevMove = prevDash?.daily?.quests?.find(
      (q) => q.progressType === 'STEPS' && q.key !== 'weekly_steps',
    );
    const nextMove = dashboard?.daily?.quests?.find(
      (q) => q.progressType === 'STEPS' && q.key !== 'weekly_steps',
    );
    const prevWeekly = prevDash?.weekly?.quests?.find((q) => q.key === 'weekly_steps' || q.progressType === 'STEPS');
    const nextWeekly = dashboard?.weekly?.quests?.find((q) => q.key === 'weekly_steps' || q.progressType === 'STEPS');
    const statusChanged =
      (prevMove?.status || null) !== (nextMove?.status || null) ||
      (prevMove?.periodKey || null) !== (nextMove?.periodKey || null) ||
      (prevWeekly?.status || null) !== (nextWeekly?.status || null);
    const progressCrossed =
      Boolean(
        prevMove &&
          nextMove &&
          crossedQuestProgressThreshold(prevMove.progressPercent, nextMove.progressPercent),
      ) ||
      Boolean(
        prevWeekly &&
          nextWeekly &&
          crossedQuestProgressThreshold(prevWeekly.progressPercent, nextWeekly.progressPercent),
      );
    const firstAssignment = !prevDash && Boolean(dashboard?.daily?.quests?.length);
    if (statusChanged || progressCrossed || firstAssignment) {
      void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
    }
  } catch {
    /* engagement is optional — never block quest cache */
  }
}

export type QuestSyncStamp = {
  timezone?: string;
  timezoneAt?: number;
  goalMl?: number;
  goalAt?: number;
  capability?: string;
  capabilityAt?: number;
};

export async function readQuestSyncStamp(): Promise<QuestSyncStamp> {
  const raw = await getScopedPreference(SYNC_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as QuestSyncStamp;
  } catch {
    return {};
  }
}

export async function writeQuestSyncStamp(next: QuestSyncStamp): Promise<void> {
  const prev = await readQuestSyncStamp();
  await setScopedPreference(SYNC_KEY, JSON.stringify({ ...prev, ...next }));
}

const listeners = new Set<() => void>();

export function subscribeQuestRefresh(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestQuestRefresh() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export type QuestLevelUpShow = {
  level: number;
  previousLevel?: number;
  rankKey?: string;
  coins?: number;
  xp?: number;
};

const levelUpListeners = new Set<(payload: QuestLevelUpShow) => void>();

export function presentQuestLevelUp(payload: QuestLevelUpShow) {
  levelUpListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeQuestLevelUp(listener: (payload: QuestLevelUpShow) => void) {
  levelUpListeners.add(listener);
  return () => levelUpListeners.delete(listener);
}

/* ── Phase 7.2: Medi Coin balance bus (same-device immediate consistency) ─ */

let mediCoinHint: number | null = null;
const coinListeners = new Set<(coins: number | null) => void>();

async function patchQuestCacheCoins(coins: number) {
  try {
    const cached = await readQuestCache();
    if (!cached?.dashboard?.profile) return;
    const next = {
      ...cached.dashboard,
      profile: { ...cached.dashboard.profile, coinBalance: coins },
    };
    await setScopedPreference(DASH_KEY, JSON.stringify({ dashboard: next, savedAt: Date.now() }));
  } catch {
    /* cache patch is best-effort */
  }
}

/** Last authoritative Medi Coin balance published on this device (may be null). */
export function getMediCoinBalanceHint(): number | null {
  return mediCoinHint;
}

/**
 * Publish authoritative balance from a server response (redeem / claim).
 * Patches Quest cache + notifies Hub / Store / Wallet subscribers, then
 * schedules a silent dashboard refresh for full reconcile.
 */
export function publishMediCoinBalance(coins: number) {
  const n = Math.floor(Number(coins));
  if (!Number.isFinite(n) || n < 0) return;
  mediCoinHint = n;
  void patchQuestCacheCoins(n);
  coinListeners.forEach((fn) => {
    try {
      fn(n);
    } catch {
      /* ignore */
    }
  });
  requestQuestRefresh();
}

/**
 * Canonical invalidation path after any balance-changing operation.
 * Prefer passing `{ coins }` from the authoritative API response.
 */
export function invalidateMediCoinBalance(options?: { coins?: number }) {
  if (options && Number.isFinite(Number(options.coins))) {
    publishMediCoinBalance(Number(options.coins));
    return;
  }
  mediCoinHint = null;
  coinListeners.forEach((fn) => {
    try {
      fn(null);
    } catch {
      /* ignore */
    }
  });
  requestQuestRefresh();
}

export function subscribeMediCoinBalance(listener: (coins: number | null) => void) {
  coinListeners.add(listener);
  return () => coinListeners.delete(listener);
}

const entitlementRefreshListeners = new Set<() => void>();

export function requestEntitlementRefresh() {
  entitlementRefreshListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeEntitlementRefresh(listener: () => void) {
  entitlementRefreshListeners.add(listener);
  return () => entitlementRefreshListeners.delete(listener);
}

/* ── Phase 4: achievements ─────────────────────────────────────────── */

export async function readAchievementsCache(): Promise<{ overview: AchievementsOverview; savedAt: number } | null> {
  const raw = await getScopedPreference(ACH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { overview: AchievementsOverview; savedAt: number };
    return parsed?.overview ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeAchievementsCache(overview: AchievementsOverview): Promise<void> {
  await setScopedPreference(ACH_KEY, JSON.stringify({ overview, savedAt: Date.now() }));
}

const achievementRefreshListeners = new Set<() => void>();

export function subscribeAchievementsRefresh(listener: () => void) {
  achievementRefreshListeners.add(listener);
  return () => achievementRefreshListeners.delete(listener);
}

export function requestAchievementsRefresh() {
  achievementRefreshListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export type AchievementUnlockShow = {
  achievementId: string;
  key: string | null;
  rarity: string;
  secret?: boolean;
  rewardCoins?: number;
  rewardXp?: number;
};

const unlockListeners = new Set<(payload: AchievementUnlockShow) => void>();

export function presentAchievementUnlock(payload: AchievementUnlockShow) {
  unlockListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeAchievementUnlock(listener: (payload: AchievementUnlockShow) => void) {
  unlockListeners.add(listener);
  return () => unlockListeners.delete(listener);
}
