import { useCallback, useRef } from 'react';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { localAccountId } from '@/lib/localAccount';

type Options<T> = {
  /** Key parts after the account id, e.g. ['medications']. */
  key: unknown[];
  fetch: () => Promise<T>;
  /** FRESH.LIVE / SHORT / LONG (see queryClient.ts). */
  staleTime?: number;
  enabled?: boolean;
} & Pick<UseQueryOptions<T>, 'placeholderData' | 'select' | 'refetchInterval' | 'retry'>;

/**
 * Server data for the signed-in account, cached app-wide (stale-while-revalidate):
 * - shows the last answer immediately on every visit;
 * - when the screen gains focus again, refetches only if the answer is stale (LIVE = always);
 * - screens hidden in the stack stay quiet (no background refetches while not focused).
 */
export function useAccountQuery<T>({ key, fetch, staleTime = FRESH.SHORT, enabled = true, ...rest }: Options<T>) {
  const focused = useIsFocused();
  const signedIn = Boolean(localAccountId());
  const queryKey = accountKey(...key);
  const query = useQuery<T>({
    queryKey,
    queryFn: fetch,
    staleTime,
    enabled: enabled && signedIn,
    subscribed: focused,
    ...rest,
  });

  const first = useRef(true);
  const keyHash = JSON.stringify(queryKey);
  useFocusEffect(
    useCallback(() => {
      // The first focus is the mount itself, which useQuery already handles.
      if (first.current) {
        first.current = false;
        return;
      }
      if (!enabled || !signedIn) return;
      // cancelRefetch: false — join a refetch already in flight (re-subscribing on focus starts one
      // too); cancelling it would send the same GET twice on every stale return.
      void queryClient.refetchQueries({ queryKey: JSON.parse(keyHash), stale: true, exact: true }, { cancelRefetch: false });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyHash, enabled, signedIn]),
  );

  return query;
}
