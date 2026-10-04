// Shared helpers for lab.mjs, scan.mjs, medi.mjs and pharmacy.mjs. The leading underscore keeps
// mock-api.mjs from loading this file as a fixture module (it only imports fixtures/*.mjs without `_`).
import { createHash } from 'node:crypto';

export const REPO = process.env.MEDICARD_REPO || 'C:/Users/User/Desktop/www.medicard';

/** t(rq, ka, en) like server/src/lib/i18n.js t(req, …): the request's X-Medicard-Lang picks the copy. */
export const t = (rq, ka, en) => (rq?.lang === 'en' ? en : ka);

/** Stable UUID v4-looking id from a seed (fixtures must not change between resets). */
export function uuidFrom(seed) {
  const h = createHash('sha1').update(String(seed)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** requireAuth: every /api route these fixtures serve (except the public pharmacy catalogue) needs a Bearer token. */
export function unauthorized(rq) {
  if (/^Bearer\s+\S{8,}/.test(rq.auth || '')) return null;
  return rq.reply(401, { error: t(rq, 'ავტორიზაცია საჭიროა. შედი ანგარიშში.', 'Please sign in to continue.') });
}

/** The free plan's usage object (same shape core.mjs answers on /api/usage; server getUsage). */
export function usageFor(today) {
  return {
    date: today,
    periodKey: today.slice(0, 7),
    periodType: 'calendar',
    periodLabel: 'ეს თვე',
    periodStart: null,
    periodEnd: null,
    billingPeriod: 'monthly',
    used: 0,
    limit: -1,
    remaining: -1,
    exceeded: false,
    unlimited: true,
    resetsInMs: 0,
    resetAt: null,
    resetKind: null,
    refilled: false,
    refilledKey: null,
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

export const userIdOf = (state) => state.user?.id || (state.persona === 'man' ? 'mock-user-man-0001' : 'mock-user-women-0001');
