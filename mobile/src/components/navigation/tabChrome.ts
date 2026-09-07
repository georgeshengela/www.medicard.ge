import { useSyncExternalStore } from 'react';

/**
 * AppChromeOverlay sits above native screens *and* RN Modals (iOS FullWindowOverlay /
 * Android elevation). Sheets on tab/run-hub screens must hide the pill so it
 * cannot cover CTAs.
 */
let hiddenCount = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function hideFloatingTabBar(): () => void {
  hiddenCount += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    hiddenCount = Math.max(0, hiddenCount - 1);
    emit();
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return hiddenCount > 0;
}

export function useTabChromeHidden() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
