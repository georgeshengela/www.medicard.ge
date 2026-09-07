/**
 * Deduped Journey unlock celebrations (HTTP aggregate + socket).
 */
type Listener = (payload: { count: number; keys: string[] }) => void;

const seen = new Set<string>();
const listeners = new Set<Listener>();
let pendingKeys: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function identity(milestoneKey: string, unlockedAt?: string) {
  return `${milestoneKey}:${unlockedAt || 'na'}`;
}

export function markJourneyUnlockSeen(milestoneKey: string, unlockedAt?: string): boolean {
  const id = identity(milestoneKey, unlockedAt);
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 400) {
    const drop = [...seen].slice(0, 100);
    drop.forEach((k) => seen.delete(k));
  }
  return true;
}

export function presentJourneyUnlocks(keys: string[], unlockedAt?: string) {
  const fresh = keys.filter((k) => markJourneyUnlockSeen(k, unlockedAt));
  if (!fresh.length) return;
  pendingKeys.push(...fresh);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    const batch = [...new Set(pendingKeys)];
    pendingKeys = [];
    flushTimer = null;
    if (!batch.length) return;
    const payload = { count: batch.length, keys: batch };
    listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        /* ignore */
      }
    });
  }, 120);
}

export function subscribeJourneyUnlockCelebration(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper */
export function __resetJourneyUnlockDedupeForTests() {
  seen.clear();
  pendingKeys = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}
