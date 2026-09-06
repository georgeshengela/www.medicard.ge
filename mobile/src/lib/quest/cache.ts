import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import type { QuestDashboard } from './api';

const DASH_KEY = 'medicard.quest.dashboard.v1';
const SYNC_KEY = 'medicard.quest.sync.v1';

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
  await setScopedPreference(DASH_KEY, JSON.stringify({ dashboard, savedAt: Date.now() }));
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
