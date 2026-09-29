import { useEffect, useState } from 'react';
import { accountKey, queryClient } from '@/lib/queryClient';
import { localAccountId } from '@/lib/localAccount';

/**
 * A query that fell back to the device copy (request failed) must not count as fresh:
 * mark it stale without refetching, so the next focus / foreground / mount asks the server again.
 */
export function useStaleWhenFallback(key: unknown[], data: { fallback?: boolean } | undefined) {
  const hash = JSON.stringify(accountKey(...key));
  useEffect(() => {
    if (!data?.fallback) return;
    void queryClient.invalidateQueries({ queryKey: JSON.parse(hash), exact: true, refetchType: 'none' });
  }, [data, hash]);
}

/**
 * The device copy for the signed-in account, shown only until the first server answer lands.
 * `read` must be a stable (module-level) function; a late read after an account switch is dropped.
 */
export function useDeviceSeed<T>(read: (owner: string) => Promise<T | null>, needed: boolean): T | null {
  const owner = localAccountId();
  const [seed, setSeed] = useState<{ owner: string; value: T } | null>(null);
  useEffect(() => {
    if (!needed || !owner) return;
    let alive = true;
    void read(owner)
      .then((value) => {
        if (alive && value && localAccountId() === owner) setSeed({ owner, value });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, owner]);
  return seed && seed.owner === owner ? seed.value : null;
}
