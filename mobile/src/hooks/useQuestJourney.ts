import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/store/AuthContext';
import { localAccountId } from '@/lib/localAccount';
import { companionApi, type CompanionCosmetic, type CompanionOverview } from '@/lib/companion/api';
import { readCompanionCache, requestCompanionRefresh, subscribeCompanionRefresh, writeCompanionCache } from '@/lib/companion/cache';
import { subscribeQuestRefresh } from '@/lib/quest/cache';
import { useOffline } from './useOffline';

export function useQuestJourney(enabled: boolean) {
  const { user } = useAuth(), offline = useOffline();
  const ownerId = user?.id ?? null;
  const [stateOwner, setStateOwner] = useState(ownerId);
  const [overview, setOverview] = useState<CompanionOverview | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [stale, setStale] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null), [equipError, setEquipError] = useState<string | null>(null);
  const generation = useRef(0), mounted = useRef(true), busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => { generation.current++; setStateOwner(ownerId); setOverview(null); setError(false); setStale(false); setLoading(true); setEquipError(null); setBusyKey(null); busy.current = false; }, [ownerId]);
  const refresh = useCallback(async () => {
    if (!ownerId || !enabled) return;
    const sequence = ++generation.current;
    const current = () => mounted.current && sequence === generation.current && localAccountId() === ownerId;
    setLoading(true);
    const cached = await readCompanionCache(ownerId);
    if (!current()) return;
    if (cached) { setOverview(prev => prev ?? cached.overview); setStale(true); }
    try {
      const next = await companionApi.overview({ reducedMotion: true });
      if (!current()) return;
      setOverview(next); setStale(false); setError(false);
      await writeCompanionCache(next, ownerId);
    } catch {
      if (current()) { setError(true); setStale(true); }
    } finally { if (current()) setLoading(false); }
  }, [ownerId, enabled]);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    void refresh();
    const off = subscribeCompanionRefresh(() => void refresh());
    const offQuest = subscribeQuestRefresh(() => void refresh());
    return () => { generation.current++; off(); offQuest(); };
  }, [enabled, refresh]));
  const equip = useCallback(async (item: CompanionCosmetic, clear = false) => {
    if (!ownerId || !overview || !item.unlocked || offline || stale || busy.current) return;
    busy.current = true; setBusyKey(item.key); setEquipError(null);
    // In-flight refreshes must not repaint an older selection after this mutation.
    ++generation.current;
    try {
      const result = await companionApi.putEquipment({ [item.slot]: clear ? null : item.key });
      if (!mounted.current || localAccountId() !== ownerId) return;
      ++generation.current;
      const next = { ...overview, equipment: result.equipment };
      setOverview(next);
      await writeCompanionCache(next, ownerId);
      if (localAccountId() === ownerId) requestCompanionRefresh();
    } catch {
      if (mounted.current && localAccountId() === ownerId) setEquipError('სტილი ვერ შეინახა. შეამოწმე კავშირი და ხელახლა აირჩიე.');
    } finally {
      if (mounted.current && localAccountId() === ownerId) { busy.current = false; setBusyKey(null); setLoading(false); }
    }
  }, [ownerId, overview, offline, stale]);
  return { overview: stateOwner === ownerId ? overview : null, loading: stateOwner !== ownerId || loading, error, stale, refresh, equip, busyKey, equipError };
}
