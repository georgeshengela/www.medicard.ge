/**
 * Client-side circuit breaker (2026-09-29, after the health-sync loop incident).
 *
 * Any future request loop — a socket echo, a timer that never stops, a retry without back-off —
 * is stopped on the phone before it reaches the server: the same request fired more than
 * `perRouteLimit` times in `windowMs` is refused locally for `cooldownMs`; more than `globalLimit`
 * requests of any kind in the window pause every request. A normal session never gets close
 * (a cold start is ~40 requests, a busy screen a handful per route).
 *
 * The counting key is method + full path including the query, so typing in a search box or paging
 * through different ids never counts as a loop; the global limit catches loops whose URL varies.
 * Trips are reported once (see `reportRoute`), with ids and tokens replaced by `:id` and the query
 * dropped — never health values.
 */

export type BreakerTrip = {
  scope: 'route' | 'global';
  method: string;
  /** Route template for reporting: no query, id-like segments replaced by `:id`. */
  route: string;
  count: number;
  retryAfterMs: number;
};

export type BreakerDecision = { ok: true } | ({ ok: false } & BreakerTrip);

export type BreakerOptions = {
  windowMs?: number;
  perRouteLimit?: number;
  globalLimit?: number;
  cooldownMs?: number;
  now?: () => number;
  onTrip?: (trip: BreakerTrip) => void;
};

const ID_SEGMENT = /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|c[a-z0-9]{20,}|[A-Za-z0-9_-]{16,})$/;

/** `/api/pets/ckabc…/chat?x=1` → `/api/pets/:id/chat`. Never carries ids, tokens or query values. */
export function reportRoute(path: string): string {
  const bare = String(path || '').split(/[?#]/)[0] || '/';
  return bare
    .split('/')
    .map((segment) => (segment && ID_SEGMENT.test(segment) && /\d/.test(segment) ? ':id' : segment))
    .join('/')
    .slice(0, 160);
}

export function createRequestBreaker(options: BreakerOptions = {}) {
  const windowMs = options.windowMs ?? 10_000;
  const perRouteLimit = options.perRouteLimit ?? 30;
  const globalLimit = options.globalLimit ?? 300;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const now = options.now ?? Date.now;

  const hits = new Map<string, number[]>();
  const openUntil = new Map<string, number>();
  let global: number[] = [];
  let globalOpenUntil = 0;

  const prune = (list: number[], t: number) => {
    let i = 0;
    while (i < list.length && list[i] <= t - windowMs) i += 1;
    return i ? list.slice(i) : list;
  };

  function check(methodRaw: string, path: string): BreakerDecision {
    const t = now();
    const method = String(methodRaw || 'GET').toUpperCase();
    const key = `${method} ${path}`;
    const route = reportRoute(path);

    if (globalOpenUntil > t) {
      return { ok: false, scope: 'global', method, route, count: global.length, retryAfterMs: globalOpenUntil - t };
    }
    const routeOpen = openUntil.get(key) ?? 0;
    if (routeOpen > t) {
      return { ok: false, scope: 'route', method, route, count: hits.get(key)?.length ?? 0, retryAfterMs: routeOpen - t };
    }

    global = prune(global, t);
    global.push(t);
    const list = prune(hits.get(key) ?? [], t);
    list.push(t);
    hits.set(key, list);

    if (global.length > globalLimit) {
      globalOpenUntil = t + cooldownMs;
      const trip: BreakerTrip = { scope: 'global', method, route, count: global.length, retryAfterMs: cooldownMs };
      global = [];
      hits.clear();
      openUntil.clear();
      options.onTrip?.(trip);
      return { ok: false, ...trip };
    }
    if (list.length > perRouteLimit) {
      openUntil.set(key, t + cooldownMs);
      const trip: BreakerTrip = { scope: 'route', method, route, count: list.length, retryAfterMs: cooldownMs };
      hits.delete(key);
      options.onTrip?.(trip);
      return { ok: false, ...trip };
    }
    // Keep the maps small: forget keys that went quiet.
    if (hits.size > 500) {
      for (const [k, v] of hits) if (!v.length || v[v.length - 1] <= t - windowMs) hits.delete(k);
      for (const [k, until] of openUntil) if (until <= t) openUntil.delete(k);
    }
    return { ok: true };
  }

  function reset() {
    hits.clear();
    openUntil.clear();
    global = [];
    globalOpenUntil = 0;
  }

  return { check, reset };
}
