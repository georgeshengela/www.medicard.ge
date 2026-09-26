import { useEffect, useState } from 'react';
import { communityRequest } from '@/lib/api';

/**
 * Women's space launch gate (product freeze 2026-09-26). While the admin keeps the
 * space closed, only existing members see the entry. Cached per account for a few
 * minutes so Home and Explore do not refetch on every focus.
 */
type Membership = { canJoin?: boolean; member: unknown | null };

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; visible: boolean }>();

/** Servers older than the gate send no `canJoin`: keep their previous open behavior. */
export function communityEntryVisible(data: Membership): boolean {
  return data.canJoin ?? true;
}

export function useCommunityEntry(userId: string | undefined, female: boolean): boolean {
  const cached = userId ? cache.get(userId) : undefined;
  const [visible, setVisible] = useState(!!cached?.visible);
  useEffect(() => {
    if (!userId || !female) {
      setVisible(false);
      return;
    }
    const hit = cache.get(userId);
    setVisible(!!hit?.visible);
    if (hit && Date.now() - hit.at < TTL_MS) return;
    let active = true;
    communityRequest<Membership>('/membership')
      .then((data) => {
        const next = communityEntryVisible(data);
        cache.set(userId, { at: Date.now(), visible: next });
        if (active) setVisible(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, female]);
  return visible;
}
