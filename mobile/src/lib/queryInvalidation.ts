/**
 * "Signal on change": after any successful write (POST/PUT/PATCH/DELETE) the API layer calls
 * `invalidateAfterWrite(path)`, which marks the cached reads that the write can change as stale,
 * so every screen showing them refreshes at once — no screen has to remember to reload.
 * Map a path prefix to the cache keys (first key part after the account id) it affects.
 */
export const WRITE_INVALIDATES: ReadonlyArray<readonly [prefix: string, keys: readonly string[]]> = [
  ['/api/medications', ['medications', 'home']],
  // Not /api/health-metrics: device syncs happen every ~20 s and the device already holds the new
  // value; invalidating on them would re-read → re-sync (the 2026-09-29 loop). Health hooks
  // refresh through subscribeHealthRefresh instead.
  ['/api/nutrition', ['nutrition', 'home', 'quest']],
  ['/api/cycle', ['cycle', 'home']],
  ['/api/announcements', ['announcements']],
  ['/api/trainer', ['coach']],
  ['/api/identity', ['coach', 'identity']],
  ['/api/quests', ['quest']],
  ['/api/rewards', ['quest', 'rewards']],
  ['/api/achievements', ['quest']],
  ['/api/check-in', ['quest', 'home']],
  ['/api/health-profile', ['home', 'profile']],
  ['/api/visits', ['visits', 'home']],
  ['/api/records', ['records']],
  ['/api/pets', ['pets']],
  // Medi answers, lab/image analyses and saved assistant chats create records and chat sessions.
  ['/api/ai', ['records']],
  ['/api/chats', ['records']],
];

/**
 * POSTs that only read or compute (nothing stored the screen shows). They must never invalidate:
 * a screen that calls one of them after its data loads would otherwise reload → call → reload …
 * (e.g. the cycle screen asks for insights once its view arrives).
 */
export const READ_ONLY_WRITES: readonly string[] = [
  '/api/cycle/insights',
  '/api/cycle/share',
  '/api/nutrition/estimate',
  '/api/nutrition/foods/used',
  '/api/quests/timezone',
  '/api/trainer/workouts/sync',
  '/api/ai/feedback',
];

/** Pure: which cache keys a successful write to `path` makes stale. */
export function keysForWrite(method: string, path: string): string[] {
  const m = String(method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD') return [];
  const bare = String(path || '').split('?')[0];
  if (READ_ONLY_WRITES.some((p) => bare === p || bare.startsWith(p + '/'))) return [];
  const out = new Set<string>();
  for (const [prefix, keys] of WRITE_INVALIDATES) {
    if (bare === prefix || bare.startsWith(prefix + '/')) keys.forEach((k) => out.add(k));
  }
  return [...out];
}

export function invalidateAfterWrite(method: string, path: string): void {
  const keys = keysForWrite(method, path);
  if (!keys.length) return;
  void import('@/lib/queryClient').then(({ invalidate }) => {
    for (const key of keys) void invalidate(key);
  });
}
