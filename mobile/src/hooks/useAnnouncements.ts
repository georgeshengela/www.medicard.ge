import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, type Announcement } from '@/lib/api';
import { trackAnnouncement } from '@/lib/announcements';
import { useFeature } from '@/lib/featureFlags';
import { localAccountId } from '@/lib/localAccount';

/** Last answer per account, so returning to Home paints the cards at once. */
const cache = new Map<string, Announcement[]>();
const dismissed = new Set<string>();

export function peekAnnouncement(id: string): Announcement | null {
  const owner = localAccountId();
  return (owner && cache.get(owner)?.find((a) => a.id === id)) || null;
}

/** Live Home news cards for the signed-in person; refreshed every time Home gains focus. */
export function useAnnouncements() {
  const on = useFeature('news');
  const [items, setItems] = useState<Announcement[]>(() => {
    const owner = localAccountId();
    return (owner && cache.get(owner)) || [];
  });

  const load = useCallback(async () => {
    const owner = localAccountId();
    if (!owner) return;
    try {
      const { announcements } = await api.announcements.list('home');
      if (owner !== localAccountId()) return;
      const list = (announcements || []).filter((a) => !dismissed.has(a.id));
      cache.set(owner, list);
      setItems(list);
    } catch {
      /* Home renders without news; next focus retries */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (on) void load();
    }, [on, load]),
  );

  const dismiss = useCallback((id: string) => {
    dismissed.add(id);
    const owner = localAccountId();
    setItems((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (owner) cache.set(owner, next);
      return next;
    });
    trackAnnouncement(id, 'dismiss');
  }, []);

  return { items: on ? items : [], dismiss, reload: load };
}
