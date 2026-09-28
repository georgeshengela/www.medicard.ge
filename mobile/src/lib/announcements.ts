import { Linking } from 'react-native';
import { API_BASE_URL, api, type Announcement } from '@/lib/api';
import { isHrefAvailable } from '@/lib/featureFlags';
import { isSafeExternalHref } from '@/lib/safeExternalHref';
import { isAllowedAppRoute } from '@/lib/announcementRules';

/** Home news cards (admin „სიახლეები“, server `server/src/lib/announcements.js`). */
export { ROUTE_ROOTS, detailParagraphs, isAllowedAppRoute } from '@/lib/announcementRules';

/** Server paths (`/api/announcements/image/…`) become absolute; https URLs pass; anything else is dropped. */
export function announcementImageUri(image: string | null | undefined): string | null {
  if (!image) return null;
  if (image.startsWith('/api/')) return `${API_BASE_URL}${image}`;
  return image.startsWith('https://') ? image : null;
}

/** The button is shown only when it can actually go somewhere — not into a paused module. */
export function usableCta(card: Pick<Announcement, 'cta'>): Announcement['cta'] {
  const cta = card.cta;
  if (!cta?.label || !cta.target) return null;
  if (cta.kind === 'route') return isAllowedAppRoute(cta.target) && isHrefAvailable(cta.target) ? cta : null;
  if (cta.kind === 'url') return cta.target.startsWith('https://') && isSafeExternalHref(cta.target) ? cta : null;
  return null;
}

type Pushable = { push: (href: never) => void };

export function openAnnouncementCta(router: Pushable, card: Announcement) {
  const cta = usableCta(card);
  if (!cta) return;
  trackAnnouncement(card.id, 'click');
  if (cta.kind === 'route') router.push(cta.target as never);
  else void Linking.openURL(cta.target).catch(() => undefined);
}

const sent = new Set<string>();

/** View / tap / dismiss, at most once per card and kind per app run. Never throws. */
export function trackAnnouncement(id: string, type: 'view' | 'click' | 'dismiss') {
  const key = `${type}:${id}`;
  if (sent.has(key)) return;
  sent.add(key);
  void api.announcements.event(id, type).catch(() => sent.delete(key));
}
