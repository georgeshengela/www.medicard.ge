import { localAccountId } from '@/lib/localAccount';
import { getPreference, setPreference } from '@/lib/storage';
import type { CompanionOverview } from './api';

const OVERVIEW_KEY = 'medicard.companion.overview.v1';

let memory: { overview: CompanionOverview; savedAt: number; ownerId: string } | null = null;

export async function readCompanionCache(ownerId = localAccountId()): Promise<{ overview: CompanionOverview; savedAt: number } | null> {
  if (!ownerId || ownerId !== localAccountId()) return null;
  if (memory?.overview && memory.ownerId === ownerId) return memory;
  const raw = await getPreference(`${OVERVIEW_KEY}.${ownerId}`);
  if (!raw || ownerId !== localAccountId()) return null;
  try {
    const parsed = JSON.parse(raw) as { overview: CompanionOverview; savedAt: number };
    if (!parsed?.overview) return null;
    memory = { ...parsed, ownerId };
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCompanionCache(overview: CompanionOverview, ownerId = localAccountId()): Promise<void> {
  if (!ownerId || ownerId !== localAccountId()) return;
  const next = { overview, savedAt: Date.now(), ownerId };
  memory = next;
  await setPreference(`${OVERVIEW_KEY}.${ownerId}`, JSON.stringify(next));
}

export function peekCompanionCache(): CompanionOverview | null {
  return memory?.ownerId === localAccountId() ? memory.overview : null;
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
