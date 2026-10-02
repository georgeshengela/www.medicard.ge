/**
 * Data for the „აქტიური“ Home sections that the Home root does not already load.
 * Every hook here has exactly one subscriber (its Home section) and adds no device health read.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { accountKey, FRESH, invalidate, queryClient } from '@/lib/queryClient';
import { getCachedHealthBundle } from '@/lib/healthDataSync';
import { outdoorView, stepsByDay, type OutdoorView, type WalkRow } from '@/lib/home/activeHome';
import { pulseApi } from '@/lib/medipulsi/client';
import type { GrandPrize } from '@/lib/medipulsi/grand';
import { loadRunHistory } from '@/lib/run/history';
import { peekWeatherMemory, readWeatherCache, subscribeWeatherCache } from '@/lib/weather/cache';
import { weatherCoordsFromProfile } from '@/lib/weather/context';
import type { WeatherCacheRecord } from '@/lib/weather/types';
import { useAuth } from '@/store/AuthContext';

const STEPS_WEEK_KEY = ['health', 'steps', 'week-home'] as const;
const RUN_WALKS_KEY = ['medirun', 'local-walks'] as const;
/** Shared with the MEDIRUN hub card and /run/grand (`useGrandPrize`). */
const GRAND_KEY = ['medirun', 'grand'] as const;

/**
 * The six completed days behind the movement hero's bars.
 *
 * The '1d' bundle Home already loads has no per-day totals (its chart is today's 2-hour buckets),
 * and a second `useStepsMetrics('1w')` would add a LIVE HealthKit / Health Connect read on every
 * visit. Instead this reads the stored daily rows from the device health cache — written by every
 * health pull (the '1d' fetch included) and merged after every device push — so it costs no
 * network and no device read. It re-reads when the Home steps bundle lands (`todayFetchedAt`),
 * because that fetch has just refreshed the cache. Today's bar always comes from the live bundle.
 */
export function useHomeStepsWeek(todayFetchedAt: string | null, enabled = true) {
  const query = useAccountQuery<Record<string, number>>({
    key: [...STEPS_WEEK_KEY],
    fetch: async () => stepsByDay((await getCachedHealthBundle())?.daily ?? []),
    staleTime: FRESH.SHORT,
    enabled,
  });
  const seen = useRef(todayFetchedAt);
  useEffect(() => {
    if (!enabled || !todayFetchedAt || todayFetchedAt === seen.current) return;
    seen.current = todayFetchedAt;
    void queryClient.invalidateQueries({ queryKey: accountKey(...STEPS_WEEK_KEY), exact: true });
  }, [todayFetchedAt, enabled]);
  return { rows: query.data ?? null, loading: enabled && !query.data && query.fetchStatus !== 'idle' };
}

/**
 * MEDIRUN walks from the on-device history (account-scoped, synced by accountSync), slimmed to
 * what the card shows. No network: never the MEDIRUN bootstrap, which writes a player row and can
 * pause a session. SHORT so a walk finished minutes ago is counted on the next Home visit.
 */
export function useHomeRunWeek(enabled = true) {
  const query = useAccountQuery<WalkRow[]>({
    key: [...RUN_WALKS_KEY],
    fetch: async () => (await loadRunHistory()).map((run) => ({ startedAt: run.startedAt, distanceM: run.distanceM })),
    staleTime: FRESH.SHORT,
    enabled,
  });
  return { walks: query.data ?? null, loading: enabled && !query.data && query.fetchStatus !== 'idle' };
}

/**
 * „გაანათე თბილისი“ progress. Same key and request as the MEDIRUN hub, but LONG on Home: the
 * endpoint sits behind a 20/min per-session limiter shared with /territory and Home
 * remounts on every tab switch, so Home asks at most once per 5 minutes and never retries.
 * On any error the campaign row simply stays hidden.
 */
export function useHomeGrand(enabled: boolean) {
  const query = useAccountQuery<GrandPrize>({
    key: [...GRAND_KEY],
    fetch: () => pulseApi<GrandPrize>('/grand'),
    staleTime: FRESH.LONG,
    retry: false,
    enabled,
  });
  return { grand: query.isError ? null : query.data ?? null };
}

/**
 * Best time outside, read-only from the weather device cache (20-min snapshot, memory first).
 *
 * The header pill already runs `useWeather()`, which fetches Open-Meteo when the cache is stale
 * and writes the result. A second `useWeather()` here would load the wellness context again on
 * every mount and, on a cold cache, fetch Open-Meteo in parallel (it has no in-flight dedupe).
 * So this never fetches: it reads the cache and listens for the pill's write.
 * `pending` is true until the first read settles (only on the first mount of a session).
 */
export function useHomeOutdoor(enabled: boolean): { view: OutdoorView | null; pending: boolean } {
  const { healthProfile } = useAuth();
  const coords = weatherCoordsFromProfile(healthProfile);
  const lat = coords?.lat ?? null;
  const lng = coords?.lng ?? null;
  const active = enabled && lat != null && lng != null;
  const [state, setState] = useState<{ record: WeatherCacheRecord | null; settled: boolean }>(() => {
    const memory = active ? peekWeatherMemory() : null;
    return { record: memory, settled: !active || Boolean(memory) };
  });

  useEffect(() => {
    if (!active) {
      setState({ record: null, settled: true });
      return undefined;
    }
    let alive = true;
    const read = () => {
      readWeatherCache()
        .then((record) => {
          if (alive) setState({ record, settled: true });
        })
        .catch(() => {
          if (alive) setState((prev) => ({ ...prev, settled: true }));
        });
    };
    read();
    const off = subscribeWeatherCache(read);
    return () => {
      alive = false;
      off();
    };
  }, [active]);

  const view = useMemo(
    () => (active && lat != null && lng != null ? outdoorView(state.record, { lat, lng }, new Date()) : null),
    [active, lat, lng, state.record],
  );
  return { view, pending: active && !state.settled };
}

/** Pull-to-refresh on the active layout: re-read what these sections own (the steps / water roots refresh themselves). */
export function refreshActiveHomeData(): Promise<unknown> {
  return Promise.allSettled([
    invalidate('quest', 'dashboard'),
    invalidate(...RUN_WALKS_KEY),
    invalidate(...STEPS_WEEK_KEY),
  ]);
}
