/**
 * Rate-limit buckets must not collapse every user onto one key.
 * Shared IP (CGNAT, cafe Wi-Fi, a misread proxy) used to 429 the second signup.
 */

export function clientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || '';
  return String(raw).replace(/^::ffff:/, '') || 'unknown';
}

/** Authenticated traffic is per session. Guests stay per IP. */
export function apiTrafficKey(req) {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ') && auth.length > 20) {
    return `user:${auth.slice(7, 27)}`;
  }
  return `ip:${clientIp(req)}`;
}

export function authWriteKey(req) {
  return `auth:${clientIp(req)}`;
}

/** express-rate-limit v8 throws 500s on proxy/IP validation — never take the API down for that. */
export const RATE_LIMIT_VALIDATE = false;
