import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The one-time coach mark on the pain row (brief §9 item 3 risk: a four-state re-tap is not obvious).
 * Per device, not per account: it teaches a gesture, not a health fact. Shown until the person taps it
 * (or uses the long press it teaches); storage failures only mean it may show once more.
 */
const KEY = 'medicard.cycle.painCoachSeen.v1';

let cached: boolean | null = null;
let reading: Promise<boolean> | null = null;
const listeners = new Set<(seen: boolean) => void>();

function readSeen(): Promise<boolean> {
  if (cached != null) return Promise.resolve(cached);
  if (!reading) {
    reading = AsyncStorage.getItem(KEY)
      .then((v) => v === '1')
      .catch(() => false)
      .then((seen) => {
        if (cached == null) cached = seen;
        return cached;
      });
  }
  return reading;
}

export function dismissPainCoachMark(): void {
  if (cached === true) return;
  cached = true;
  for (const fn of listeners) fn(true);
  AsyncStorage.setItem(KEY, '1').catch(() => undefined);
}

export function usePainCoachMark(enabled = true): { show: boolean; dismiss: () => void } {
  // Hidden until storage answers, so a person who already dismissed it never sees it flash.
  const [seen, setSeen] = useState<boolean>(cached ?? true);
  useEffect(() => {
    let alive = true;
    const on = (v: boolean) => {
      if (alive) setSeen(v);
    };
    listeners.add(on);
    readSeen().then(on);
    return () => {
      alive = false;
      listeners.delete(on);
    };
  }, []);
  return { show: enabled && !seen, dismiss: dismissPainCoachMark };
}
