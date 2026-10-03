/**
 * „დაიწყო“ on the cycle widget / Live Activity opens `medicard://cycle?periodStart=1`.
 *
 * expo-router would open that URL by itself — on a cold start before the signed-in shell is mounted
 * (AGENTS „Navigation before the shell mounts“) and once per URL event, so a second tap could start
 * the period twice. `app/+native-intent.tsx` hands the link here instead: the tap is claimed once per
 * day and process (`claimNotificationTap`), queued, and the root layout opens it through the same
 * `canOpenNotificationRoute` gate as a notification tap. The cycle screen's privacy gate runs first;
 * the screen then performs the existing one-tap start with its undo toast.
 *
 * Pure apart from the tiny in-memory queue: node tests load it.
 */
import { claimNotificationTap } from './notificationTaps.ts';

export const CYCLE_WIDGET_START_ROUTE = '/cycle?periodStart=1';
export const CYCLE_WIDGET_OPEN_ROUTE = '/cycle';

/** `medicard://cycle?periodStart=1`, `medicard:///cycle?periodStart=1` or a bare `/cycle?periodStart=1`. */
export function isCycleWidgetStartLink(path: string | null | undefined): boolean {
  if (typeof path !== 'string' || !path) return false;
  const rest = path.replace(/^medicard:\/\//i, '').replace(/^\/+/, '');
  const [route, query = ''] = rest.split('?');
  if (route.replace(/\/+$/, '') !== 'cycle') return false;
  return query.split('&').some((pair) => pair === 'periodStart=1');
}

export function widgetStartClaimKey(day: string): string {
  return `widget:periodStart:${day}`;
}

function localDay(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

let pending: { route: string; at: number } | null = null;
const listeners = new Set<() => void>();

/**
 * Called from `+native-intent` for every incoming URL. Returns true when the link was the widget's
 * start link (the caller then keeps expo-router from opening it). The first tap of a day queues the
 * start; a repeat tap the same day only opens the cycle screen.
 */
export function noteCycleWidgetLink(path: string | null | undefined, now: Date = new Date()): boolean {
  if (!isCycleWidgetStartLink(path)) return false;
  const claimed = claimNotificationTap(widgetStartClaimKey(localDay(now)));
  pending = { route: claimed ? CYCLE_WIDGET_START_ROUTE : CYCLE_WIDGET_OPEN_ROUTE, at: now.getTime() };
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a listener never blocks the link */
    }
  });
  return true;
}

/** The queued route (once). */
export function takeCycleWidgetRoute(): { route: string; at: number } | null {
  const next = pending;
  pending = null;
  return next;
}

export function onCycleWidgetRoute(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** expo-router's `redirectSystemPath`: the start link never reaches the router. */
export function redirectCycleWidgetPath(path: string, initial: boolean): string | null {
  if (!noteCycleWidgetLink(path)) return path;
  return initial ? '/' : null;
}
