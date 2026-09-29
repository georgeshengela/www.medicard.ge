/**
 * App-wide server-data cache (TanStack Query, 2026-09-29): stale-while-revalidate.
 *
 * - A screen shows the last answer at once (no spinner on every visit) and refreshes in the
 *   background only when that answer is older than its `staleTime` (FRESH).
 * - Live values (steps, water, today's doses) use `LIVE`: always re-read on focus / foreground,
 *   but the old number stays on screen until the new one arrives — it never sticks at 400.
 * - Writes and socket events call `invalidate…` so the affected data refreshes immediately.
 * - Every key starts with the account id and the whole cache is dropped when the account
 *   changes, so one person's data can never appear for another.
 * - Memory only; nothing health-related is written to disk by the cache.
 */
import { AppState } from 'react-native';
import { QueryClient, focusManager, type QueryKey } from '@tanstack/react-query';
import { localAccountId, onLocalAccountChange } from '@/lib/localAccount';
import { onReturnToForeground } from '@/lib/appForeground';

/** How long an answer counts as fresh (no request at all while fresh). */
export const FRESH = {
  /** Values that change on their own (steps, water, today's doses, coins). */
  LIVE: 0,
  /** Lists the person edits (medications, meals, cycle): writes invalidate them anyway. */
  SHORT: 30_000,
  /** Rarely changing (news, coach status, catalog). */
  LONG: 5 * 60_000,
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FRESH.SHORT,
      gcTime: 30 * 60_000,
      // One retry with back-off; never hammer a struggling server (the request breaker is the last line).
      retry: 1,
      retryDelay: (attempt) => Math.min(30_000, 2_000 * 2 ** attempt),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Our own reachability + request breaker decide; never park queries as "offline" forever.
      networkMode: 'always',
    },
    mutations: { retry: 0 },
  },
});

// "Window focus" in React Native = in the background → back (not iOS inactive → active from
// Face ID or permission sheets). Stale queries on screen refetch when the app comes back.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'background') setFocused(false);
  });
  const off = onReturnToForeground(() => setFocused(true));
  return () => {
    sub.remove();
    off();
  };
});

onLocalAccountChange(() => {
  queryClient.cancelQueries();
  queryClient.clear();
});

/** `['acct', accountId, ...parts]` — every cached server answer is scoped to the signed-in account. */
export function accountKey(...parts: unknown[]): QueryKey {
  return ['acct', localAccountId() ?? 'signed-out', ...parts];
}

/** Marks data stale and refetches whatever is on screen (after a write, a socket event, a pull-to-refresh). */
export function invalidate(...parts: unknown[]): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: accountKey(...parts) });
}
