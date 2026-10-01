/**
 * Sign in with Apple / Google (2026-10-01).
 *
 * The app gets an ID token from the native Apple / Google sheet and sends it here; we verify the
 * signature against the provider's published keys (JWKS), the issuer, the audience (our own client
 * ids only) and expiry. The identity is keyed by the provider's stable `sub`, never by the email.
 *
 * Linking rule (pre-account-takeover guard): email sign-up does not verify addresses, so a
 * provider-verified email that matches an existing password account is NOT linked automatically —
 * the person proves the account with its password once (`linkToken` → POST /social/link). An
 * account that already carries another provider identity with the same verified email is linked
 * at once (both sides were verified by Apple / Google).
 *
 * Apple: a server-issued nonce (HMAC, 10 min) is bound into the identity token. When the Apple key
 * env vars are set, the one-time authorization code is exchanged for a refresh token (encrypted at
 * rest) so account deletion can revoke the grant (App Review 5.1.1(v)).
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

export const APPLE_ISSUER = 'https://appleid.apple.com';
export const GOOGLE_ISSUERS = Object.freeze(['https://accounts.google.com', 'accounts.google.com']);
export const APPLE_SYNTHETIC_DOMAIN = 'apple.medicard.ge';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const NONCE_TTL_MS = 10 * 60 * 1000;
const LINK_TTL = '10m';
const FETCH_TIMEOUT_MS = 8000;

export class SocialAuthError extends Error {
  constructor(code, status = 401) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function list(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * MEDICARD's own Google OAuth clients (project medicard-d6ea0, created 2026-10-01) — public ids, the
 * same values ship inside the app (mobile/google-oauth.json). Web = the token audience on Android and
 * iOS (webClientId); iOS is listed too in case a token is minted for it. `GOOGLE_CLIENT_IDS` overrides.
 */
export const DEFAULT_GOOGLE_CLIENT_IDS = Object.freeze([
  '535295295288-av02tceeve5s8cs1gpe1b4t43faltjku.apps.googleusercontent.com',
  '535295295288-9bg6olin1230i5qg2k0q4dpvbrv312qb.apps.googleusercontent.com',
]);

/** Audiences we accept. Google: our web + iOS client ids; Apple: the bundle id(s). */
export function socialConfig(env = process.env) {
  const googleOverride = list(env.GOOGLE_CLIENT_IDS);
  return {
    googleClientIds: googleOverride.length ? googleOverride : [...DEFAULT_GOOGLE_CLIENT_IDS],
    appleAudiences: list(env.APPLE_BUNDLE_IDS || 'ge.medicard.app'),
    appleTeamId: String(env.APPLE_TEAM_ID || '').trim(),
    appleKeyId: String(env.APPLE_KEY_ID || '').trim(),
    // Render env vars keep "\n" literally when the PEM is pasted on one line.
    applePrivateKey: String(env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim(),
    secret: String(env.JWT_SECRET || ''),
  };
}

export function appleRevokeConfigured(config = socialConfig()) {
  return Boolean(config.appleTeamId && config.appleKeyId && config.applePrivateKey && config.appleAudiences[0]);
}

/* ───────── JWKS ───────── */

const jwksCache = new Map(); // url → { keys: Map<kid, KeyObject>, fetchedAt, lastMissFetch }

async function fetchJson(url, init = {}, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function loadJwks(url, fetchImpl) {
  const { ok, body } = await fetchJson(url, {}, fetchImpl);
  if (!ok || !Array.isArray(body?.keys)) throw new SocialAuthError('SOCIAL_KEYS_UNAVAILABLE', 503);
  const keys = new Map();
  for (const jwk of body.keys) {
    if (!jwk?.kid || jwk.kty !== 'RSA') continue;
    try {
      keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      /* skip a malformed key */
    }
  }
  const entry = { keys, fetchedAt: Date.now(), lastMissFetch: 0 };
  jwksCache.set(url, entry);
  return entry;
}

/** Signing key for `kid`: cached for an hour, re-fetched at most once a minute for an unknown kid (rotation). */
export async function signingKey(url, kid, { fetchImpl = fetch, now = Date.now() } = {}) {
  let entry = jwksCache.get(url);
  if (!entry || now - entry.fetchedAt > 60 * 60 * 1000) entry = await loadJwks(url, fetchImpl);
  let key = entry.keys.get(kid);
  if (!key && now - entry.lastMissFetch > 60 * 1000) {
    entry.lastMissFetch = now;
    entry = await loadJwks(url, fetchImpl);
    entry.lastMissFetch = now;
    key = entry.keys.get(kid);
  }
  if (!key) throw new SocialAuthError('SOCIAL_TOKEN_INVALID');
  return key;
}

export function resetJwksCache() {
  jwksCache.clear();
}

async function verifyIdToken(token, { jwksUrl, issuers, audiences, fetchImpl }) {
  if (typeof token !== 'string' || token.split('.').length !== 3 || token.length > 8192) {
    throw new SocialAuthError('SOCIAL_TOKEN_INVALID');
  }
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid || decoded.header.alg !== 'RS256') throw new SocialAuthError('SOCIAL_TOKEN_INVALID');
  const key = await signingKey(jwksUrl, decoded.header.kid, { fetchImpl });
  try {
    return jwt.verify(token, key, {
      algorithms: ['RS256'],
      issuer: issuers,
      audience: audiences,
      clockTolerance: 60,
    });
  } catch (error) {
    throw new SocialAuthError(error?.name === 'TokenExpiredError' ? 'SOCIAL_TOKEN_EXPIRED' : 'SOCIAL_TOKEN_INVALID');
  }
}

function verifiedFlag(value) {
  return value === true || value === 'true';
}

/* ───────── Apple nonce ───────── */

function hmac(secret, value) {
  return crypto.createHmac('sha256', `apple-nonce:${secret}`).update(value).digest('base64url');
}

/** Stateless nonce `<random>.<expiresAt>.<hmac>`; the app hands it to Apple, the token carries it back. */
export function issueAppleNonce({ secret = socialConfig().secret, now = Date.now() } = {}) {
  const body = `${crypto.randomBytes(18).toString('base64url')}.${now + NONCE_TTL_MS}`;
  return `${body}.${hmac(secret, body)}`;
}

export function appleNonceValid(nonce, { secret = socialConfig().secret, now = Date.now() } = {}) {
  if (typeof nonce !== 'string' || nonce.length > 200) return false;
  const parts = nonce.split('.');
  if (parts.length !== 3) return false;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = hmac(secret, body);
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const expiresAt = Number(parts[1]);
  return Number.isFinite(expiresAt) && expiresAt >= now;
}

/* ───────── Provider verification ───────── */

export async function verifyAppleIdentity({ identityToken, nonce }, { config = socialConfig(), fetchImpl } = {}) {
  if (!appleNonceValid(nonce, { secret: config.secret })) throw new SocialAuthError('SOCIAL_NONCE_INVALID');
  const claims = await verifyIdToken(identityToken, {
    jwksUrl: APPLE_JWKS_URL,
    issuers: [APPLE_ISSUER],
    audiences: config.appleAudiences,
    fetchImpl,
  });
  // The SDK passes our nonce through unchanged (or its SHA-256, depending on the platform layer).
  const hashed = crypto.createHash('sha256').update(nonce).digest('hex');
  if (claims.nonce !== nonce && claims.nonce !== hashed) throw new SocialAuthError('SOCIAL_NONCE_INVALID');
  if (!claims.sub) throw new SocialAuthError('SOCIAL_TOKEN_INVALID');
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null;
  return {
    provider: 'apple',
    subject: String(claims.sub),
    // Apple only issues addresses it has verified (including private relay ones).
    email: email && verifiedFlag(claims.email_verified ?? true) ? email : null,
    privateRelay: verifiedFlag(claims.is_private_email) || Boolean(email?.endsWith('@privaterelay.appleid.com')),
    name: null,
  };
}

export async function verifyGoogleIdentity({ idToken }, { config = socialConfig(), fetchImpl } = {}) {
  if (!config.googleClientIds.length) throw new SocialAuthError('SOCIAL_NOT_CONFIGURED', 503);
  const claims = await verifyIdToken(idToken, {
    jwksUrl: GOOGLE_JWKS_URL,
    issuers: GOOGLE_ISSUERS,
    audiences: config.googleClientIds,
    fetchImpl,
  });
  if (!claims.sub) throw new SocialAuthError('SOCIAL_TOKEN_INVALID');
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : null;
  if (!email || !verifiedFlag(claims.email_verified)) throw new SocialAuthError('SOCIAL_EMAIL_UNVERIFIED');
  return {
    provider: 'google',
    subject: String(claims.sub),
    email,
    privateRelay: false,
    name: typeof claims.name === 'string' ? claims.name : null,
  };
}

/* ───────── Apple token exchange / revoke ───────── */

function appleClientSecret(config, now = Math.floor(Date.now() / 1000)) {
  return jwt.sign(
    { iss: config.appleTeamId, iat: now, exp: now + 300, aud: APPLE_ISSUER, sub: config.appleAudiences[0] },
    config.applePrivateKey,
    { algorithm: 'ES256', keyid: config.appleKeyId },
  );
}

/** One-time authorization code → refresh token (only used to revoke later). Best-effort: null on any failure. */
export async function exchangeAppleCode(code, { config = socialConfig(), fetchImpl = fetch } = {}) {
  if (!code || typeof code !== 'string' || code.length > 2048 || !appleRevokeConfigured(config)) return null;
  try {
    const { ok, body } = await fetchJson(`${APPLE_ISSUER}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.appleAudiences[0],
        client_secret: appleClientSecret(config),
        code,
        grant_type: 'authorization_code',
      }).toString(),
    }, fetchImpl);
    if (!ok || typeof body?.refresh_token !== 'string') {
      console.warn('[social-auth] apple code exchange failed', body?.error || 'no refresh token');
      return null;
    }
    return body.refresh_token;
  } catch (error) {
    console.warn('[social-auth] apple code exchange error', error?.name || error?.message);
    return null;
  }
}

export async function revokeAppleToken(refreshToken, { config = socialConfig(), fetchImpl = fetch } = {}) {
  if (!refreshToken || !appleRevokeConfigured(config)) return false;
  try {
    const { ok, status } = await fetchJson(`${APPLE_ISSUER}/auth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.appleAudiences[0],
        client_secret: appleClientSecret(config),
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }).toString(),
    }, fetchImpl);
    if (!ok) console.warn('[social-auth] apple revoke failed', status);
    return ok;
  } catch (error) {
    console.warn('[social-auth] apple revoke error', error?.name || error?.message);
    return false;
  }
}

/* ───────── Refresh-token encryption ───────── */

function cipherKey(secret) {
  return crypto.createHash('sha256').update(`apple-refresh:${secret}`).digest();
}

export function sealSecret(value, secret = socialConfig().secret) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
}

export function openSecret(sealed, secret = socialConfig().secret) {
  const parts = String(sealed || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(parts[1], 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/* ───────── Link token (existing password account) ───────── */

export function signLinkToken(identity, { secret = socialConfig().secret, sealedRefresh = null } = {}) {
  return jwt.sign(
    {
      typ: 'social-link',
      provider: identity.provider,
      sub: identity.subject,
      email: identity.email,
      ...(sealedRefresh ? { rt: sealedRefresh } : {}),
    },
    secret,
    { expiresIn: LINK_TTL },
  );
}

export function readLinkToken(token, { secret = socialConfig().secret } = {}) {
  try {
    const payload = jwt.verify(String(token || ''), secret, { algorithms: ['HS256'] });
    if (payload?.typ !== 'social-link' || !payload.sub || !payload.email || !['apple', 'google'].includes(payload.provider)) {
      return null;
    }
    return {
      identity: { provider: payload.provider, subject: String(payload.sub), email: String(payload.email) },
      sealedRefresh: typeof payload.rt === 'string' ? payload.rt : null,
    };
  } catch {
    return null;
  }
}

/* ───────── Storage ───────── */

function isMissingTable(error) {
  return error?.code === 'P2010' && /AuthIdentity/.test(String(error?.meta?.message || error?.message))
    || /relation "AuthIdentity" does not exist/i.test(String(error?.message || ''));
}

export async function findIdentity(provider, subject, db = prisma) {
  const rows = await db.$queryRaw`
    SELECT id, "userId", email FROM "AuthIdentity" WHERE provider = ${provider} AND subject = ${subject} LIMIT 1`;
  return rows[0] ?? null;
}

async function identitiesWithEmail(userId, email, db = prisma) {
  const rows = await db.$queryRaw`
    SELECT provider FROM "AuthIdentity" WHERE "userId" = ${userId} AND email = ${email}`;
  return rows;
}

/** Insert or refresh (provider, subject) → user. A newer Apple refresh token replaces the stored one. */
export async function saveIdentity({ userId, identity, sealedRefresh = null }, db = prisma) {
  await db.$executeRaw`
    INSERT INTO "AuthIdentity" (id, "userId", provider, subject, email, "appleRefreshToken")
    VALUES (${crypto.randomUUID()}, ${userId}, ${identity.provider}, ${identity.subject}, ${identity.email}, ${sealedRefresh})
    ON CONFLICT (provider, subject) DO UPDATE SET
      "lastUsedAt" = NOW(),
      email = COALESCE(EXCLUDED.email, "AuthIdentity".email),
      "appleRefreshToken" = COALESCE(EXCLUDED."appleRefreshToken", "AuthIdentity"."appleRefreshToken")`;
}

/** Revoke every Apple grant of a user before the account is deleted. Never throws, never blocks deletion for long. */
export async function revokeAppleGrantsForUser(userId, { db = prisma, config = socialConfig(), fetchImpl = fetch } = {}) {
  let rows = [];
  try {
    rows = await db.$queryRaw`
      SELECT "appleRefreshToken" FROM "AuthIdentity"
      WHERE "userId" = ${userId} AND provider = 'apple' AND "appleRefreshToken" IS NOT NULL`;
  } catch (error) {
    if (!isMissingTable(error)) console.warn('[social-auth] revoke lookup failed', error?.code || error?.message);
    return 0;
  }
  let revoked = 0;
  for (const row of rows) {
    const token = openSecret(row.appleRefreshToken, config.secret);
    if (token && (await revokeAppleToken(token, { config, fetchImpl }))) revoked += 1;
  }
  return revoked;
}

/* ───────── Sign-in resolution ───────── */

export const DEFAULT_SOCIAL_NAME = 'Medicard მომხმარებელი';

/** Name for a new account: what the person typed on the Apple sheet, else Google's profile name. */
export function socialDisplayName(...candidates) {
  for (const value of candidates) {
    const name = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (name.length >= 2) return name;
  }
  return DEFAULT_SOCIAL_NAME;
}

export function syntheticAppleEmail(subject) {
  return `apple.${crypto.createHash('sha256').update(String(subject)).digest('hex').slice(0, 20)}@${APPLE_SYNTHETIC_DOMAIN}`;
}

/**
 * Decide what a verified identity signs into.
 * → { kind: 'existing', userId } | { kind: 'link', email } | { kind: 'create', email }
 */
export async function resolveSocialIdentity(identity, db = prisma) {
  const known = await findIdentity(identity.provider, identity.subject, db);
  if (known) return { kind: 'existing', userId: known.userId };

  if (identity.email) {
    const user = await db.user.findUnique({ where: { email: identity.email }, select: { id: true } });
    if (user) {
      const verifiedElsewhere = await identitiesWithEmail(user.id, identity.email, db);
      if (verifiedElsewhere.length) return { kind: 'existing', userId: user.id, linkNow: true };
      return { kind: 'link', userId: user.id, email: identity.email };
    }
    return { kind: 'create', email: identity.email };
  }
  // Apple without an address (the person hid it and Apple sends it only on the first authorization).
  const synthetic = syntheticAppleEmail(identity.subject);
  const user = await db.user.findUnique({ where: { email: synthetic }, select: { id: true } });
  if (user) return { kind: 'existing', userId: user.id, linkNow: true };
  return { kind: 'create', email: synthetic };
}

/** A password nobody knows: social-only accounts can set a real one later with "forgot password". */
export async function unusablePasswordHash() {
  return bcrypt.hash(`social:${crypto.randomBytes(32).toString('base64url')}`, 12);
}
