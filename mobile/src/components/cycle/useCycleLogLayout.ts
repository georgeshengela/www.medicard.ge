import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LOG_LAYOUT,
  logLayoutKey,
  normalizeLogLayout,
  type CycleLogLayout,
} from '@/lib/cycleLogLayout';
import { useAuth } from '@/store/AuthContext';

/**
 * The person's „კატეგორიების მორგება“ layout for the full and the quick log: per device and account
 * (AsyncStorage, `logLayoutKey`), shared live between every mounted log (the sheet changes the full log
 * behind it at once). Storage failures fall back to the default layout and never block logging.
 */
const cache = new Map<string, CycleLogLayout>();
const listeners = new Map<string, Set<(layout: CycleLogLayout) => void>>();
const reads = new Map<string, Promise<CycleLogLayout>>();

function read(key: string): Promise<CycleLogLayout> {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  let pending = reads.get(key);
  if (!pending) {
    pending = AsyncStorage.getItem(key)
      .then((raw) => (raw ? normalizeLogLayout(JSON.parse(raw)) : DEFAULT_LOG_LAYOUT))
      .catch(() => DEFAULT_LOG_LAYOUT)
      .then((layout) => {
        if (!cache.has(key)) cache.set(key, layout);
        return cache.get(key) as CycleLogLayout;
      });
    reads.set(key, pending);
  }
  return pending;
}

export function useCycleLogLayout(): {
  layout: CycleLogLayout;
  setLayout: (next: CycleLogLayout) => void;
  ready: boolean;
} {
  const { user } = useAuth();
  const key = logLayoutKey(user?.id);
  const [layout, setLocal] = useState<CycleLogLayout>(() => cache.get(key) ?? DEFAULT_LOG_LAYOUT);
  const [ready, setReady] = useState(() => cache.has(key));

  useEffect(() => {
    let alive = true;
    const on = (next: CycleLogLayout) => {
      if (alive) setLocal(next);
    };
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(on);
    read(key).then((stored) => {
      if (!alive) return;
      setLocal(stored);
      setReady(true);
    });
    return () => {
      alive = false;
      listeners.get(key)?.delete(on);
    };
  }, [key]);

  const setLayout = useCallback(
    (next: CycleLogLayout) => {
      const clean = normalizeLogLayout(next);
      cache.set(key, clean);
      for (const fn of listeners.get(key) ?? []) fn(clean);
      AsyncStorage.setItem(key, JSON.stringify(clean)).catch(() => undefined);
    },
    [key],
  );

  return { layout, setLayout, ready };
}
