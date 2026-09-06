import { useCallback, useEffect, useState } from 'react';
import { questApi, type QuestClaimResult, type QuestDashboard } from '@/lib/quest/api';
import { readQuestCache, subscribeQuestRefresh, writeQuestCache } from '@/lib/quest/cache';
import { deviceIanaTimezone } from '@/lib/quest/sync';
import { markQuestCelebration } from '@/lib/quest/socket';
import { beginClaimLock, endClaimLock, homeQuestMood } from '@/lib/quest/logic.js';
import {
  applyQuestDevView,
  claimQuestDevFixture,
  getQuestDevScenario,
  isQuestDevEnabled,
  subscribeQuestDevScenario,
} from '@/lib/quest/devFixture';

const claimLocks = new Set<string>();

export function useQuestDashboard() {
  const [dashboard, setDashboard] = useState<QuestDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [devScenario, setDevScenario] = useState(() => (isQuestDevEnabled() ? getQuestDevScenario() : 'LIVE'));

  const apply = useCallback((next: QuestDashboard, fromCache: boolean, at: number) => {
    setDashboard(next);
    setStale(fromCache);
    setSavedAt(at);
    setError(false);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const tz = deviceIanaTimezone() || undefined;
      const next = await questApi.dashboard(tz);
      const at = Date.now();
      apply(next, false, at);
      await writeQuestCache(next);
    } catch {
      const cached = await readQuestCache();
      if (cached) apply(cached.dashboard, true, cached.savedAt);
      else setError(true);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (!isQuestDevEnabled()) return;
    const off = subscribeQuestDevScenario(setDevScenario);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void readQuestCache().then((cached) => {
      if (alive && cached) apply(cached.dashboard, true, cached.savedAt);
    });
    void refresh(true);
    const off = subscribeQuestRefresh(() => {
      void refresh(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, [apply, refresh]);

  const presented = applyQuestDevView({
    dashboard,
    loading,
    error,
    stale,
    scenario: isQuestDevEnabled() ? devScenario : 'LIVE',
  });

  const claim = useCallback(async (id: string): Promise<QuestClaimResult | null> => {
    if (!beginClaimLock(claimLocks, id)) return null;
    try {
      if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
        const fake = claimQuestDevFixture(null, id) as QuestClaimResult | null;
        if (fake) {
          markQuestCelebration('claimed-http', id, fake.quest.claimedAt || '');
          return fake;
        }
      }
      const result = await questApi.claim(id);
      markQuestCelebration('claimed-http', id, result.quest.claimedAt || '');
      await refresh(true);
      return result;
    } catch {
      return null;
    } finally {
      endClaimLock(claimLocks, id);
    }
  }, [apply, refresh]);

  const mood = homeQuestMood({
    dailyTotal: presented.dashboard?.summary.dailyTotal,
    dailyCompleted: presented.dashboard?.summary.dailyCompleted,
    dailyClaimable: presented.dashboard?.summary.dailyClaimable,
    nearCompletion: (presented.dashboard as QuestDashboard | null)?.daily.quests.some(
      (quest) => quest.status === 'ACTIVE' && quest.progressPercent >= 80,
    ),
  });

  return {
    dashboard: presented.dashboard,
    loading: presented.loading,
    error: presented.error,
    stale: presented.stale,
    savedAt,
    refresh,
    claim,
    mood,
    fixtureOffline: presented.fixtureOffline,
  };
}
