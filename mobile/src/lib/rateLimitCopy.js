'use strict';

const { tx } = require('../i18n/locale.js');

function parseRetryAfterSeconds(retryRaw, payload) {
  const fromPayload = Number(payload?.retryAfterSeconds);
  if (Number.isFinite(fromPayload) && fromPayload >= 0) return Math.floor(fromPayload);
  if (retryRaw == null || retryRaw === '') return undefined;
  const asNumber = Number(retryRaw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.floor(asNumber);
  const when = Date.parse(String(retryRaw));
  if (!Number.isNaN(when)) return Math.max(0, Math.ceil((when - Date.now()) / 1000));
  return undefined;
}

function formatRateLimitMessage(seconds, fallback) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) {
    return fallback || tx('ძალიან ბევრი მოთხოვნა. დაელოდე ერთ წუთს.', 'Too many requests. Please wait a minute.');
  }
  const wait = Math.max(1, Math.ceil(Number(seconds)));
  // Long waits in minutes or hours: „დაელოდე 3600 წამს“ reads like a bug.
  if (wait >= 3600) {
    const hours = Math.ceil(wait / 3600);
    return tx(`ძალიან ბევრი მოთხოვნა. ისევ სცადე დაახლოებით ${hours} საათში.`, `Too many requests. Try again in about ${hours} ${hours === 1 ? 'hour' : 'hours'}.`);
  }
  if (wait >= 120) {
    const minutes = Math.ceil(wait / 60);
    return tx(`ძალიან ბევრი მოთხოვნა. დაელოდე ${minutes} წუთს.`, `Too many requests. Please wait ${minutes} minutes.`);
  }
  return tx(`ძალიან ბევრი მოთხოვნა. დაელოდე ${wait} წამს.`, `Too many requests. Please wait ${wait} ${wait === 1 ? 'second' : 'seconds'}.`);
}

/**
 * AI limits the server words itself, in the person's language (an analysis already running, too many AI
 * starts, the daily fuse, the quota): its own text, never a made-up „wait N seconds“.
 */
const SERVER_WORDED_LIMITS = new Set(['AI_BUSY', 'RATE_LIMITED', 'AI_DAILY_CAP', 'DAILY_LIMIT_REACHED', 'MONTHLY_LIMIT_REACHED']);

function publicApiErrorMessage(status, payload, retryRaw, fallback) {
  const serverError =
    (typeof payload?.error === 'string' && payload.error) ||
    (typeof payload?.detail === 'string' && payload.detail) ||
    fallback;
  if (status !== 429) return serverError;
  if (SERVER_WORDED_LIMITS.has(payload?.code) && typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
  const seconds = parseRetryAfterSeconds(retryRaw, payload);
  if (seconds == null) {
    if (typeof serverError === 'string' && /წამს|წუთ|second|minute/i.test(serverError)) return serverError;
    return formatRateLimitMessage(60, serverError);
  }
  return formatRateLimitMessage(seconds, serverError);
}

module.exports = { parseRetryAfterSeconds, formatRateLimitMessage, publicApiErrorMessage };
