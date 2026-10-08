/**
 * Sliding sessions. A user JWT lives JWT_EXPIRES_IN (30 days by default) and nothing renewed it,
 * so even a daily user was signed out on day 31. GET /api/auth/me now hands back a fresh token
 * once the presented one has used up half of its own lifetime; builds that do not know the field
 * ignore it, newer ones store it.
 */

/** Share of the token's lifetime after which /me renews it. */
export const SESSION_RENEW_AFTER = 0.5;

/**
 * `claims` are the verified JWT claims (`iat` / `exp`, seconds). Measured against the token's own
 * span, so a different JWT_EXPIRES_IN on the server needs no code change.
 */
export function sessionRenewalDue(claims, nowMs = Date.now()) {
  const iat = Number(claims?.iat);
  const exp = Number(claims?.exp);
  if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp <= iat) return false;
  const now = nowMs / 1000;
  if (now >= exp) return false;
  return now - iat >= (exp - iat) * SESSION_RENEW_AFTER;
}

/** Extra /me fields: `{}` (the response stays exactly as before) or `{ token }`. */
export function sessionRenewalFields(claims, sign, nowMs = Date.now()) {
  return sessionRenewalDue(claims, nowMs) ? { token: sign() } : {};
}
