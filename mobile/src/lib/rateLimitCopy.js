'use strict';

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
  const wait = Math.max(1, Math.min(3600, Number(seconds) || 0));
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) {
    return fallback || 'ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ერთ წუთს.';
  }
  return `ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ${wait} წამს.`;
}

function publicApiErrorMessage(status, payload, retryRaw, fallback) {
  const serverError =
    (typeof payload?.error === 'string' && payload.error) ||
    (typeof payload?.detail === 'string' && payload.detail) ||
    fallback;
  if (status !== 429) return serverError;
  const seconds = parseRetryAfterSeconds(retryRaw, payload);
  if (seconds == null) {
    if (typeof serverError === 'string' && /წამს|წუთ/.test(serverError)) return serverError;
    return formatRateLimitMessage(60, serverError);
  }
  return formatRateLimitMessage(seconds, serverError);
}

module.exports = { parseRetryAfterSeconds, formatRateLimitMessage, publicApiErrorMessage };
