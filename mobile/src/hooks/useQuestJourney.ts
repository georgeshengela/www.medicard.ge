import { useCallback, useEffect, useRef, useState } from 'react';
import { tx } from '@/i18n/locale';
import { useAuth } from '@/store/AuthContext';
import { localAccountId } from '@/lib/localAccount';
import { companionApi, type CompanionCosmetic, type CompanionOverview } from '@/lib/companion/api';
import { readCompanionCache, requestCompanionRefresh, writeCompanionCache } from '@/lib/companion/cache';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { useDeviceSeed, useStaleWhenFallback } from '@/hooks/queryFallback';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { useOffline } from './useOffline';

type JourneySnapshot = { overview: CompanionOverview; fallback: boolean };

/** Invalidated by `requestQuestRefresh()` ('quest') and `requestCompanionRefresh()` ('quest', 'journey'). */
const JOURNEY_KEY = ['quest', 'journey'] as const;

async function fetchJourney(): Promise<JourneySnapshot> {
  const owner = localAccountId();
  try {
    const overview = await companionApi.overview({ reducedMotion: true });
    if (owner && owner === localAccountId()) await writeCompanionCache(overview, owner);
    return { overview, fallback: false };
  } catch (error) {
    const cached = owner ? await readCompanionCache(owner) : null;
    if (cached) return { overview: cached.overview, fallback: true };
    throw error;
  }
}

async function readSeed(owner: string): Promise<JourneySnapshot | null> {
  const cached = await readCompanionCache(owner);
  return cached ? { overview: cached.overview, fallback: true } : null;
}

export function useQuestJourney(enabled: boolean) {
  const { user } = useAuth(), offline = useOffline();
  const ownerId = user?.id ?? null;
  const [busyKey, setBusyKey] = useState<string | null>(null), [equipError, setEquipError] = useState<string | null>(null);
  const mounted = useRef(true), busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setEquipError(null); setBusyKey(null); busy.current = false; }, [ownerId]);

  // Progress moves with missions; the Quest refresh signal invalidates it, so 30 s is safe.
  const query = useAccountQuery<JourneySnapshot>({ key: [...JOURNEY_KEY], fetch: fetchJourney, staleTime: FRESH.SHORT, enabled: enabled && Boolean(ownerId) });
  useStaleWhenFallback([...JOURNEY_KEY], query.data);
  const seed = useDeviceSeed(readSeed, enabled && Boolean(ownerId) && query.data === undefined);
  const snapshot = ownerId && ownerId === localAccountId() ? query.data ?? seed : null;
  const overview = snapshot?.overview ?? null;
  const stale = Boolean(snapshot && (snapshot.fallback || query.isError));
  const error = query.isError || Boolean(query.data?.fallback);

  const { refetch } = query;
  const refresh = useCallback(async () => {
    if (!enabled) return;
    await refetch();
  }, [enabled, refetch]);

  const equip = useCallback(async (item: CompanionCosmetic, clear = false) => {
    if (!ownerId || !overview || !item.unlocked || offline || stale || busy.current) return;
    busy.current = true; setBusyKey(item.key); setEquipError(null);
    const key = accountKey(...JOURNEY_KEY);
    try {
      const result = await companionApi.putEquipment({ [item.slot]: clear ? null : item.key });
      if (!mounted.current || localAccountId() !== ownerId) return;
      // In-flight reads must not repaint an older selection after this mutation.
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (localAccountId() !== ownerId) return;
      const base = queryClient.getQueryData<JourneySnapshot>(key)?.overview ?? overview;
      const next = { ...base, equipment: result.equipment };
      queryClient.setQueryData<JourneySnapshot>(key, { overview: next, fallback: false });
      await writeCompanionCache(next, ownerId);
      if (localAccountId() === ownerId) requestCompanionRefresh();
    } catch {
      if (mounted.current && localAccountId() === ownerId) setEquipError(tx('სტილი ვერ შეინახა. შეამოწმე კავშირი და ხელახლა აირჩიე.', 'Couldn’t save your style. Check your connection and choose again.'));
    } finally {
      if (mounted.current && localAccountId() === ownerId) { busy.current = false; setBusyKey(null); }
    }
  }, [ownerId, overview, offline, stale]);

  const loading = enabled && Boolean(ownerId) && query.isPending && query.fetchStatus !== 'idle';
  return { overview, loading, error, stale, refresh, equip, busyKey, equipError };
}
