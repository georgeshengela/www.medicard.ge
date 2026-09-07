import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import type { CompanionOverview } from './api';

const OVERVIEW_KEY = 'medicard.companion.overview.v1';

let memory: { overview: CompanionOverview; savedAt: number } | null = null;

export async function readCompanionCache(): Promise<{ overview: CompanionOverview; savedAt: number } | null> {
  if (memory?.overview) return memory;
  const raw = await getScopedPreference(OVERVIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { overview: CompanionOverview; savedAt: number };
    if (!parsed?.overview) return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCompanionCache(overview: CompanionOverview): Promise<void> {
  const next = { overview, savedAt: Date.now() };
  memory = next;
  await setScopedPreference(OVERVIEW_KEY, JSON.stringify(next));
}

export function peekCompanionCache(): CompanionOverview | null {
  return memory?.overview ?? null;
}

const listeners = new Set<() => void>();

export function subscribeCompanionRefresh(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestCompanionRefresh() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}
