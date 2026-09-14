/**
 * Request-count limiters are not mounted on /api or /api/auth (see server.js).
 * These helpers stay for cycle-share and for tests of key isolation.
 *
 * JWT access tokens share the same base64 header (`eyJhbGciOi…`). Never slice
 * the first 20 characters after "Bearer " — that collapsed every session into
 * one bucket and 429'd registration.
 *
 * Authenticated traffic is keyed by a hash of the full presented token (the
 * session), never a client-supplied user id and never an unverified JWT claim.
 * Guests stay per request IP.
 */

import { createHash } from 'node:crypto';

export function clientIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || '';
  return String(raw).replace(/^::ffff:/, '') || 'unknown';
}

function bearerToken(req) {
  const auth = String(req.headers?.authorization || '');
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex').slice(0, 24);
}

/** Authenticated traffic is per session. Guests stay per IP. */
export function apiTrafficKey(req) {
  const token = bearerToken(req);
  if (token.length >= 24) return `user:${hashToken(token)}`;
  return `ip:${clientIp(req)}`;
}

export function authWriteKey(req) {
  return `auth:${clientIp(req)}`;
}

const AUTH_WRITE_RE =
  /^\/api\/auth\/(register|login|password\/forgot|password\/reset|phone\/start|phone\/verify|phone\/link\/start|phone\/link\/verify)\/?$/i;

export function isAuthWriteRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return AUTH_WRITE_RE.test(path);
}

export function rateLimitPublicMessage(retryAfterSeconds = 60) {
  const seconds = Math.max(1, Math.min(3600, Number(retryAfterSeconds) || 60));
  return {
    error: `ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ${seconds} წამს.`,
    code: 'RATE_LIMITED',
    retryAfterSeconds: seconds,
  };
}

export function retryAfterSecondsFrom(req, windowMs = 60_000) {
  const reset = req?.rateLimit?.resetTime;
  const ms =
    reset instanceof Date ? Math.max(0, reset.getTime() - Date.now()) : Number(windowMs) || 60_000;
  return Math.max(1, Math.ceil(ms / 1000));
}

/** express-rate-limit handler: dynamic wait copy + Retry-After, never a static “one minute”. */
export function attachRateLimitHandler(limiterName) {
  return function rateLimitHandler(req, res, _next, options) {
    const seconds = retryAfterSecondsFrom(req, options.windowMs);
    res.setHeader('Retry-After', String(seconds));
    res.setHeader('X-Medicard-Limiter', String(limiterName || 'api'));
    res.status(options.statusCode || 429).json(rateLimitPublicMessage(seconds));
  };
}

/** express-rate-limit v8 throws 500s on proxy/IP validation — never take the API down for that. */
export const RATE_LIMIT_VALIDATE = false;
