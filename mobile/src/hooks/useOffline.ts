import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';
import { isOffline, lastServerAnswerAt, subscribeReachability } from '@/lib/reachability';

/**
 * One shared /health ping for the whole app. The request layer reports every
 * answer and every transport failure to `reachability`, so a working Medi call
 * clears the chip too; the ping only covers quiet screens.
 */
let watching = false;

function ping() {
  // Other requests already prove the server is reachable: ping only quiet, online sessions.
  if (!isOffline() && Date.now() - lastServerAnswerAt() < 20_000) return;
  // `request` records the outcome; an HTTP error still means the server answered.
  void api.health().catch(() => undefined);
}

function startWatch() {
  if (watching) return;
  watching = true;
  ping();
  AppState.addEventListener('change', (next) => {
    if (next === 'active') ping();
  });
  setInterval(() => {
    if (AppState.currentState === 'active') ping();
  }, 20_000);
}

/** True only after confirmed API unreachability — not a first-paint guess. */
export function useOffline(): boolean {
  useEffect(() => {
    startWatch();
  }, []);
  return useSyncExternalStore(subscribeReachability, isOffline, () => false);
}
