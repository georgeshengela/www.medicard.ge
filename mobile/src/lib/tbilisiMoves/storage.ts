import { deleteScopedPreference, localAccountId, getScopedPreference, setScopedPreference } from '@/lib/localAccount';

const INSTALL_KEY = 'medicard.tbilisiMoves.installId';
const QUEUE_KEY = 'medicard.tbilisiMoves.queue';
const CACHE_KEY = 'medicard.tbilisiMoves.cache';
const HISTORY_KEY = 'medicard.tbilisiMoves.history';
const AWARDS_KEY = 'medicard.tbilisiMoves.awards';
const CONFLICT_KEY = 'medicard.tbilisiMoves.sourceConflict';
const LAST_SYNC_KEY = 'medicard.tbilisiMoves.lastSyncOk';
const SEQ_KEY = 'medicard.tbilisiMoves.sequence';

function newTbilisiUuid() {
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return id;
  } catch {
    // Hermes / Expo Go often has no crypto.randomUUID.
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function newInstallId() {
  return newTbilisiUuid();
}

export { newTbilisiUuid };

export async function getOrCreateInstallationId(): Promise<string | null> {
  if (!localAccountId()) return null;
  const existing = await getScopedPreference(INSTALL_KEY);
  if (existing && existing.length >= 8 && existing.length <= 80) return existing;
  const created = newInstallId().replace(/-/g, '').slice(0, 32);
  await setScopedPreference(INSTALL_KEY, created);
  return created;
}

export async function nextClientSequence(): Promise<number> {
  const raw = await getScopedPreference(SEQ_KEY);
  const current = Number(raw) || 0;
  const next = current + 1;
  await setScopedPreference(SEQ_KEY, String(next));
  return next;
}

export async function loadQueue(): Promise<unknown | null> {
  const raw = await getScopedPreference(QUEUE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveQueue(payload: unknown | null): Promise<void> {
  if (!localAccountId()) return;
  if (payload == null) {
    await deleteScopedPreference(QUEUE_KEY);
    return;
  }
  await setScopedPreference(QUEUE_KEY, JSON.stringify(payload));
}

export async function loadCache<T>(): Promise<T | null> {
  const raw = await getScopedPreference(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveCache(value: unknown): Promise<void> {
  if (!localAccountId()) return;
  await setScopedPreference(CACHE_KEY, JSON.stringify(value));
}

export async function loadHistoryCache<T>(): Promise<T | null> {
  const raw = await getScopedPreference(HISTORY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveHistoryCache(value: unknown): Promise<void> {
  if (!localAccountId()) return;
  await setScopedPreference(HISTORY_KEY, JSON.stringify(value));
}

export async function loadAwardsCache<T>(): Promise<T | null> {
  const raw = await getScopedPreference(AWARDS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveAwardsCache(value: unknown): Promise<void> {
  if (!localAccountId()) return;
  await setScopedPreference(AWARDS_KEY, JSON.stringify(value));
}

export async function saveSourceConflict(value: unknown | null): Promise<void> {
  if (!localAccountId()) return;
  if (value == null) {
    await deleteScopedPreference(CONFLICT_KEY);
    return;
  }
  await setScopedPreference(CONFLICT_KEY, JSON.stringify(value));
}

export async function loadSourceConflict<T>(): Promise<T | null> {
  const raw = await getScopedPreference(CONFLICT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveLastSyncOk(iso: string): Promise<void> {
  if (!localAccountId()) return;
  await setScopedPreference(LAST_SYNC_KEY, iso);
}

export async function loadLastSyncOk(): Promise<string | null> {
  return getScopedPreference(LAST_SYNC_KEY);
}

export async function quarantineAccountWork(): Promise<void> {
  /* Scoped keys stay with the previous userId. Clearing localAccountId is enough
     to prevent submitting them under a new token. In-memory generation is reset
     by the sync module. */
}
