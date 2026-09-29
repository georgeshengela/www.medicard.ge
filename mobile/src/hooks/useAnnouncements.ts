import { useCallback, useMemo, useState } from 'react';
import { api, type Announcement } from '@/lib/api';
import { trackAnnouncement } from '@/lib/announcements';
import { useFeature } from '@/lib/featureFlags';
import { localAccountId } from '@/lib/localAccount';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { FRESH } from '@/lib/queryClient';

/** Last answer per account, for the detail screen (`peekAnnouncement`). */
const cache = new Map<string, Announcement[]>();
const dismissed = new Set<string>();

export function peekAnnouncement(id: string): Announcement | null {
  const owner = localAccountId();
  return (owner && cache.get(owner)?.find((a) => a.id === id)) || null;
}

/** Live Home news cards for the signed-in person (cached app-wide, fresh 5 min). */
export function useAnnouncements() {
  const on = useFeature('news');
  const [hidden, setHidden] = useState(0);
  const query = useAccountQuery<Announcement[]>({
    key: ['announcements', 'home'],
    staleTime: FRESH.LONG,
    enabled: on,
    fetch: async () => {
      const owner = localAccountId();
      const { announcements } = await api.announcements.list('home');
      const list = announcements || [];
      if (owner && owner === localAccountId()) cache.set(owner, list);
      return list;
    },
  });

  const items = useMemo(
    () => (query.data ?? []).filter((a) => !dismissed.has(a.id)),
    // `hidden` re-filters after a dismiss.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, hidden],
  );

  const dismiss = useCallback((id: string) => {
    dismissed.add(id);
    setHidden((n) => n + 1);
    trackAnnouncement(id, 'dismiss');
  }, []);

  const { refetch } = query;
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return { items: on ? items : [], dismiss, reload };
}
