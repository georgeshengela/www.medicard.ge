import { useCallback, useEffect, useRef, useState } from 'react';
import { tx } from '@/i18n/locale';
import { useAuth } from '@/store/AuthContext';
import { localAccountId } from '@/lib/localAccount';
import { questApi, type QuestClaimResult, type QuestDashboard } from '@/lib/quest/api';
import { readQuestCache, subscribeMediCoinBalance, writeQuestCache, invalidateMediCoinBalance } from '@/lib/quest/cache';
import { deviceIanaTimezone } from '@/lib/quest/sync';
import { markQuestCelebration } from '@/lib/quest/socket';
import { beginClaimLock, endClaimLock, homeQuestMood } from '@/lib/quest/logic.js';
import { applyClaimToDashboard } from '@/lib/quest/hubPresentation';
import { applyQuestDevView, claimQuestDevFixture, getQuestDevScenario, isQuestDevEnabled, subscribeQuestDevScenario } from '@/lib/quest/devFixture';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { useDeviceSeed } from '@/hooks/queryFallback';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';

type QuestSnapshot = { dashboard: QuestDashboard; savedAt: number; fallback: boolean };

/** Shared cache key: `requestQuestRefresh()` (socket, health pushes, coins) invalidates everything under 'quest'. */
const DASH_KEY = ['quest', 'dashboard'] as const;

async function fetchDashboard(): Promise<QuestSnapshot> {
  const owner = localAccountId();
  try {
    const dashboard = await questApi.dashboard(deviceIanaTimezone() || undefined);
    if (owner && owner === localAccountId()) await writeQuestCache(dashboard, owner);
    return { dashboard, savedAt: Date.now(), fallback: false };
  } catch (error) {
    // Offline / server trouble: the last device copy for this account, shown as stale.
    const cached = owner ? await readQuestCache(owner) : null;
    if (cached) return { dashboard: cached.dashboard, savedAt: cached.savedAt, fallback: true };
    throw error;
  }
}

async function readSeed(owner: string): Promise<QuestSnapshot | null> {
  const cached = await readQuestCache(owner);
  return cached ? { dashboard: cached.dashboard, savedAt: cached.savedAt, fallback: true } : null;
}

const claimLocks = new Set<string>();
/**
 * `staleTime` defaults to LIVE (Quest screen, Profile). Home passes SHORT: Home remounts on every
 * tab return, and real changes already arrive as `requestQuestRefresh()` invalidations (health
 * pushes, socket events) or as coin patches, which refetch an active observer whatever its staleTime.
 */
export function useQuestDashboard(opts: { staleTime?: number } = {}) {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [claimError, setClaimError] = useState<{ id: string; message: string } | null>(null);
  const [devScenario, setDevScenario] = useState(() => isQuestDevEnabled() ? getQuestDevScenario() : 'LIVE');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setClaimError(null); }, [ownerId]);
  useEffect(() => {
    if (!isQuestDevEnabled()) return;
    const off = subscribeQuestDevScenario(setDevScenario);
    return () => { off(); };
  }, []);

  const devActive = isQuestDevEnabled() && devScenario !== 'LIVE';
  // Coins and mission progress change on their own (steps, socket events): always re-read on focus.
  const query = useAccountQuery<QuestSnapshot>({ key: [...DASH_KEY], fetch: fetchDashboard, staleTime: opts.staleTime ?? FRESH.LIVE, enabled: Boolean(ownerId) && !devActive });
  const seed = useDeviceSeed(readSeed, Boolean(ownerId) && !devActive && query.data === undefined);
  const snapshot = ownerId && ownerId === localAccountId() ? query.data ?? seed : null;

  // Same-device coin changes (redeem, achievement claim) show at once; the refresh signal reconciles.
  useEffect(() => subscribeMediCoinBalance((coins) => {
    if (coins == null) return;
    queryClient.setQueryData<QuestSnapshot>(accountKey(...DASH_KEY), (old) =>
      old?.dashboard?.profile ? { ...old, dashboard: { ...old.dashboard, profile: { ...old.dashboard.profile, coinBalance: coins } } } : old);
  }), []);

  const { refetch } = query;
  const refresh = useCallback(async (_silent = false) => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') return;
    await refetch();
  }, [refetch]);

  const loading = Boolean(ownerId) && !devActive && query.isPending && query.fetchStatus !== 'idle';
  const error = !snapshot && query.isError;
  const stale = Boolean(snapshot && (snapshot.fallback || query.isError));
  const presented = applyQuestDevView({ dashboard: snapshot?.dashboard ?? null, loading, error, stale, scenario: isQuestDevEnabled() ? devScenario : 'LIVE' });

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
      // A read that started before the claim must not repaint the pre-claim dashboard.
      const key = accountKey(...DASH_KEY);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (localAccountId() !== ownerId) return null;
      const current = queryClient.getQueryData<QuestSnapshot>(key);
      if (current) {
        const next = applyClaimToDashboard(current.dashboard, result);
        queryClient.setQueryData<QuestSnapshot>(key, { dashboard: next, savedAt: Date.now(), fallback: false });
        await writeQuestCache(next, ownerId);
      }
      if (!mounted.current || localAccountId() !== ownerId) return null;
      if (result.claimed) markQuestCelebration('claimed-http', id, result.quest.claimedAt || '');
      invalidateMediCoinBalance({ coins: result.profile.coinBalance });
      return result;
    } catch {
      if (mounted.current && localAccountId() === ownerId) setClaimError({ id, message: tx('ჯილდოს მიღება ვერ დადასტურდა. სცადე ხელახლა — ერთი მისიის ჯილდო მხოლოდ ერთხელ ირიცხება.', 'We couldn’t confirm your reward. Try again — each mission’s reward is credited only once.') });
      return null;
    } finally { endClaimLock(claimLocks, lock); }
  }, [ownerId]);
  const mood = homeQuestMood({ dailyTotal: presented.dashboard?.summary.dailyTotal, dailyCompleted: presented.dashboard?.summary.dailyCompleted, dailyClaimable: presented.dashboard?.summary.dailyClaimable,
    nearCompletion: (presented.dashboard as QuestDashboard | null)?.daily.quests.some(q => q.status === 'ACTIVE' && q.progressPercent >= 80) });
  return { dashboard: presented.dashboard, loading: presented.loading, error: presented.error, stale: presented.stale, savedAt: snapshot?.savedAt ?? null, refresh, claim, claimError, mood, fixtureOffline: presented.fixtureOffline };
}
