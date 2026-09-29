/**
 * Loop guard (2026-09-29, after one phone sent 3 354 requests/min in the health-sync incident).
 *
 * Two safety nets that catch request loops we do not know about yet:
 *  - a per-session ceiling on all of /api (USER_CEILING_PER_MIN). It is not the old per-IP /api
 *    limiter that 429'd real onboarding: guests are never counted, the key is the signed-in
 *    session, and the ceiling is ~10× what the busiest real session sends. Hitting it means a bug.
 *  - POST /api/app/client-guard, where the app reports a loop its own breaker stopped
 *    (mobile/src/lib/requestBreaker.ts).
 * Both tell the owner on Director Telegram, throttled. Reports carry a route template, platform and
 * app version only — never ids, query values or health data.
 */
import { createHash } from 'node:crypto';

export const USER_CEILING_PER_MIN = 600;
const NOTICE_GAP_MS = 30 * 60_000;

const ID_SEGMENT = /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|c[a-z0-9]{20,}|[A-Za-z0-9_-]{16,})$/;

/** `/api/pets/ck…/chat?x=1` → `/api/pets/:id/chat` (same rule as the app). */
export function routeTemplate(path) {
  const bare = String(path || '').split(/[?#]/)[0] || '/';
  return bare
    .split('/')
    .map((segment) => (segment && ID_SEGMENT.test(segment) && /\d/.test(segment) ? ':id' : segment))
    .join('/')
    .slice(0, 160);
}

function bearerToken(req) {
  const auth = String(req.headers?.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

/** The ceiling counts signed-in sessions only; guests and auth writes have their own limits. */
export function isCeilingExempt(req) {
  return bearerToken(req).length < 24;
}

export function sessionTag(req) {
  const token = bearerToken(req);
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 8) : 'guest';
}

function clientMeta(req) {
  const platform = String(req.headers?.['x-medicard-platform'] || '').replace(/[^a-z]/gi, '').slice(0, 10) || '?';
  const version = String(req.headers?.['x-medicard-app-version'] || '').replace(/[^0-9.]/g, '').slice(0, 20) || '?';
  return { platform, version };
}

/**
 * Throttled owner notices. `notify` is injectable for tests; the default sends through the Director.
 * Returns true when a notice was sent.
 */
export function createLoopNotifier({ notify, now = Date.now, gapMs = NOTICE_GAP_MS } = {}) {
  const last = new Map();
  const send = notify || (async (text) => {
    const { notifyOwner } = await import('./director/service.js');
    return notifyOwner(text, { direction: 'system' });
  });

  function shouldSend(kind) {
    const t = now();
    if (t - (last.get(kind) ?? -Infinity) < gapMs) return false;
    last.set(kind, t);
    return true;
  }

  function ceilingHit(req) {
    const route = routeTemplate(req.originalUrl || req.url);
    const { platform, version } = clientMeta(req);
    console.warn('[loop-guard] user ceiling', { session: sessionTag(req), method: req.method, route, platform, version });
    if (!shouldSend('ceiling')) return false;
    void Promise.resolve(send([
      '🛑 ერთმა სესიამ წუთში ' + USER_CEILING_PER_MIN + '+ მოთხოვნა გაგზავნა — სერვერის ჭერმა შეაჩერა.',
      `ბოლო მოთხოვნა: ${req.method} ${route}`,
      `აპი: ${platform} ${version}`,
      'სავარაუდოდ აპში მარყუჟია. სერვერი დაცულია; Render-ის ლოგებში ძებნა: [loop-guard].',
    ].join('\n'))).catch(() => {});
    return true;
  }

  function clientReport(req, report) {
    const { platform, version } = clientMeta(req);
    console.warn('[loop-guard] client breaker', { session: sessionTag(req), ...report, platform, version });
    if (!shouldSend(`client:${report.route}`)) return false;
    void Promise.resolve(send([
      '🧯 აპმა თავად შეაჩერა მოთხოვნების მარყუჟი.',
      `${report.scope === 'global' ? 'ყველა მოთხოვნა' : 'მისამართი'}: ${report.method} ${report.route}`,
      `10 წამში: ${report.count}`,
      `აპი: ${platform} ${version}`,
      'სერვერამდე არ მივიდა; ეს აპის შეცდომაა და გასასწორებელია.',
    ].join('\n'))).catch(() => {});
    return true;
  }

  function aiCapHit(req, name, limit) {
    const { platform, version } = clientMeta(req);
    console.warn('[loop-guard] ai daily cap', { session: sessionTag(req), name, limit, platform, version });
    if (!shouldSend(`ai:${name}`)) return false;
    void Promise.resolve(send([
      `💸 ერთმა მომხმარებელმა AI-ის დღიურ ჭერს მიაღწია: ${name} (${limit}/დღე).`,
      `აპი: ${platform} ${version}`,
      'შემდეგი მოთხოვნები 24 საათით შეჩერებულია. სავარაუდოდ მარყუჟი ან ბოროტად გამოყენებაა.',
    ].join('\n'))).catch(() => {});
    return true;
  }

  return { ceilingHit, clientReport, aiCapHit };
}

/** Validates the app's breaker report. Returns null for anything malformed. */
export function parseClientGuardReport(body) {
  const scope = body?.scope === 'global' ? 'global' : body?.scope === 'route' ? 'route' : null;
  const method = String(body?.method || '').toUpperCase();
  const count = Math.floor(Number(body?.count));
  const rawRoute = String(body?.route || '');
  if (!scope || !['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null;
  if (!rawRoute.startsWith('/api/') || !Number.isFinite(count) || count < 1) return null;
  return { scope, method, route: routeTemplate(rawRoute), count: Math.min(count, 100_000) };
}

export const loopNotifier = createLoopNotifier();
