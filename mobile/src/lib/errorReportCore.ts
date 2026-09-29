/**
 * Pure part of the app error reporter (2026-09-29, self-hosted instead of Sentry): turns thrown
 * values into small, scrubbed events and decides what to send. The server scrubs again; this side
 * only keeps payloads small and never ships obvious personal data.
 */

export type ErrorKind = 'crash' | 'error' | 'unhandled_rejection' | 'render';

export type ErrorEvent = {
  kind: ErrorKind;
  name: string;
  message: string;
  stack?: string;
  route?: string;
  fatal?: boolean;
  at: string;
};

const MAX_MESSAGE = 300;
const MAX_STACK = 2000;

/** Emails, phone numbers / long digit runs, tokens and ids never leave the phone. */
export function scrubText(text: string): string {
  return String(text ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, ':id')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[num]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[token]');
}

/** Screen path without ids or query: `pets/ck…/chat` → `pets/:id/chat`. */
export function scrubRoute(route: string | undefined): string | undefined {
  if (!route) return undefined;
  return String(route)
    .split(/[?#]/)[0]
    .split('/')
    .map((s) => (/^(?:\d+|[0-9a-f-]{16,}|c[a-z0-9]{20,}|[A-Za-z0-9_-]{16,})$/i.test(s) && /\d/.test(s) ? ':id' : s))
    .join('/')
    .slice(0, 120);
}

export function toErrorEvent(kind: ErrorKind, error: unknown, opts: { fatal?: boolean; route?: string; now?: number } = {}): ErrorEvent {
  const err = error instanceof Error ? error : null;
  const name = (err?.name || (typeof error === 'object' && error && 'name' in error ? String((error as { name: unknown }).name) : '') || 'Error').slice(0, 80);
  const rawMessage = err?.message ?? (typeof error === 'string' ? error : (() => { try { return JSON.stringify(error); } catch { return String(error); } })());
  const stack = err?.stack ? scrubText(err.stack).slice(0, MAX_STACK) : undefined;
  return {
    kind,
    name: scrubText(name),
    message: scrubText(String(rawMessage ?? '')).slice(0, MAX_MESSAGE) || '(no message)',
    ...(stack ? { stack } : {}),
    ...(opts.route ? { route: scrubRoute(opts.route) } : {}),
    ...(opts.fatal ? { fatal: true } : {}),
    at: new Date(opts.now ?? Date.now()).toISOString(),
  };
}

/** Same error in a loop is sent once per session window; bounded queue. */
export function createErrorQueue({ maxQueue = 20, repeatWindowMs = 5 * 60_000, now = Date.now } = {}) {
  const seen = new Map<string, number>();
  let queue: ErrorEvent[] = [];
  const keyOf = (e: ErrorEvent) => `${e.kind}|${e.name}|${e.message.replace(/\d+/g, '#')}|${e.route ?? ''}`;

  return {
    add(event: ErrorEvent): boolean {
      const key = keyOf(event);
      const t = now();
      const last = seen.get(key);
      if (last !== undefined && t - last < repeatWindowMs) return false;
      seen.set(key, t);
      if (seen.size > 200) seen.clear();
      if (queue.length >= maxQueue) queue = queue.slice(1);
      queue.push(event);
      return true;
    },
    take(max = 10): ErrorEvent[] {
      const batch = queue.slice(0, max);
      queue = queue.slice(batch.length);
      return batch;
    },
    putBack(events: ErrorEvent[]) {
      queue = [...events, ...queue].slice(0, maxQueue);
    },
    size: () => queue.length,
  };
}
