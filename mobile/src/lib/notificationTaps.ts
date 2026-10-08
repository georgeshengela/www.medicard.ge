/**
 * Process-wide memory of notification taps. It outlives any one root layout instance,
 * so a remounted shell never replays a tap that was already opened.
 */
const handledTaps = new Set<string>();
let pendingSince = 0;
let openedAt = 0;

/** True the first time a tap key is seen in this process. */
export function claimNotificationTap(key: string): boolean {
  if (handledTaps.has(key)) return false;
  handledTaps.add(key);
  return true;
}

export function noteNotificationRoutePending(): void {
  pendingSince = Date.now();
}

export function noteNotificationRouteOpened(): void {
  pendingSince = 0;
  openedAt = Date.now();
}

export function clearNotificationRoutePending(): void {
  pendingSince = 0;
}

/** Automatic screens wait while a tapped notification is opening its target. */
export function notificationNavigationBusy(now = Date.now(), settleMs = 4000): boolean {
  return pendingSince > 0 || (openedAt > 0 && now - openedAt < settleMs);
}
