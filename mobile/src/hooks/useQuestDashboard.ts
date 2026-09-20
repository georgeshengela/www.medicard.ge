import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { localAccountId } from '@/lib/localAccount';
import { questApi, type QuestClaimResult, type QuestDashboard } from '@/lib/quest/api';
import { readQuestCache, subscribeQuestRefresh, writeQuestCache, invalidateMediCoinBalance } from '@/lib/quest/cache';
import { deviceIanaTimezone } from '@/lib/quest/sync';
import { markQuestCelebration } from '@/lib/quest/socket';
import { beginClaimLock, endClaimLock, homeQuestMood } from '@/lib/quest/logic.js';
import { applyClaimToDashboard } from '@/lib/quest/hubPresentation';
import { applyQuestDevView, claimQuestDevFixture, getQuestDevScenario, isQuestDevEnabled, subscribeQuestDevScenario } from '@/lib/quest/devFixture';

const claimLocks = new Set<string>();
export function useQuestDashboard() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [stateOwner, setStateOwner] = useState(ownerId);
  const [dashboard, setDashboard] = useState<QuestDashboard | null>(null);
  const dashboardRef = useRef<QuestDashboard | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [stale, setStale] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<{ id: string; message: string } | null>(null);
  const [devScenario, setDevScenario] = useState(() => isQuestDevEnabled() ? getQuestDevScenario() : 'LIVE');
  const generation = useRef(0), mounted = useRef(true);
  const apply = useCallback((next: QuestDashboard, fromCache: boolean, at: number) => {
    dashboardRef.current = next; setDashboard(next); setStale(fromCache); setSavedAt(at); setError(false);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => {
    generation.current++; setStateOwner(ownerId); dashboardRef.current = null; setDashboard(null); setLoading(true); setError(false); setClaimError(null); setStale(false);
  }, [ownerId]);
  const refresh = useCallback(async (silent = false) => {
    if (!ownerId) { setLoading(false); return; }
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') { setLoading(false); return; }
    const sequence = ++generation.current;
    const current = () => mounted.current && sequence === generation.current && localAccountId() === ownerId;
    if (!silent) setLoading(true);
    if (!dashboardRef.current) {
      const cached = await readQuestCache(ownerId);
      if (!current()) return;
      if (cached) apply(cached.dashboard, true, cached.savedAt);
    }
    try {
      const next = await questApi.dashboard(deviceIanaTimezone() || undefined);
      if (!current()) return;
      apply(next, false, Date.now());
      await writeQuestCache(next, ownerId);
    } catch {
      if (!current()) return;
      const cached = await readQuestCache(ownerId);
      if (!current()) return;
      if (!dashboardRef.current && cached) apply(cached.dashboard, true, cached.savedAt);
      setStale(true); setError(!dashboardRef.current);
    } finally { if (current()) setLoading(false); }
  }, [ownerId, apply]);
  useEffect(() => {
    if (!isQuestDevEnabled()) return;
    const off = subscribeQuestDevScenario(setDevScenario);
    return () => { off(); };
  }, []);
  useFocusEffect(useCallback(() => {
    void refresh(true);
    const off = subscribeQuestRefresh(() => void refresh(true));
    return () => { generation.current++; off(); };
  }, [refresh, devScenario]));
  const presented = applyQuestDevView({ dashboard: stateOwner === ownerId ? dashboard : null, loading, error, stale, scenario: isQuestDevEnabled() ? devScenario : 'LIVE' });
  const claim = useCallback(async (id: string): Promise<QuestClaimResult | null> => {
    if (!ownerId) return null;
    const lock = ownerId + ':' + id;
    if (!beginClaimLock(claimLocks, lock)) return null;
    setClaimError(null);
    try {
      if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
        return claimQuestDevFixture(null, id) as QuestClaimResult | null;
      }
      const result = await questApi.claim(id);
      if (!mounted.current || localAccountId() !== ownerId) return null;
      if (!result.ok) throw new Error('claim_failed');
      ++generation.current;
      setLoading(false);
      const current = dashboardRef.current;
      if (current) {
        const next = applyClaimToDashboard(current, result);
        apply(next, false, Date.now());
        await writeQuestCache(next, ownerId);
      }
      if (!mounted.current || localAccountId() !== ownerId) return null;
      if (result.claimed) markQuestCelebration('claimed-http', id, result.quest.claimedAt || '');
      invalidateMediCoinBalance({ coins: result.profile.coinBalance });
      return result;
    } catch {
      if (mounted.current && localAccountId() === ownerId) setClaimError({ id, message: 'ჯილდოს მიღება ვერ დადასტურდა. სცადე ხელახლა — ერთი მისიის ჯილდო მხოლოდ ერთხელ ირიცხება.' });
      return null;
    } finally { endClaimLock(claimLocks, lock); }
  }, [ownerId, apply]);
  const mood = homeQuestMood({ dailyTotal: presented.dashboard?.summary.dailyTotal, dailyCompleted: presented.dashboard?.summary.dailyCompleted, dailyClaimable: presented.dashboard?.summary.dailyClaimable,
    nearCompletion: (presented.dashboard as QuestDashboard | null)?.daily.quests.some(q => q.status === 'ACTIVE' && q.progressPercent >= 80) });
  return { dashboard: presented.dashboard, loading: presented.loading, error: presented.error, stale: presented.stale, savedAt, refresh, claim, claimError, mood, fixtureOffline: presented.fixtureOffline };
}
