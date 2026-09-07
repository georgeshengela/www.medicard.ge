import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';

/**
 * One shared ping for the whole app. A single missed `/health` (Render wake,
 * 5s blip, emulator DNS) used to flip every screen into "offline mode".
 * Need two failures in a row before we believe it.
 */
let offline = false;
let fails = 0;
let watching = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

async function ping() {
  try {
    await api.health();
    fails = 0;
    if (offline) {
      offline = false;
      emit();
    }
  } catch {
    fails += 1;
    if (fails >= 2 && !offline) {
      offline = true;
      emit();
    }
  }
}

function startWatch() {
  if (watching) return;
  watching = true;
  void ping();
  AppState.addEventListener('change', (next) => {
    if (next === 'active') void ping();
  });
  setInterval(() => void ping(), 20_000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True only after confirmed API unreachability — not a first-paint guess. */
export function useOffline(): boolean {
  useEffect(() => {
    startWatch();
  }, []);
  return useSyncExternalStore(subscribe, () => offline, () => false);
}
