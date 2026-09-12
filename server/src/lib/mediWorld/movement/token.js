import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../../config/env.js';
import { MOVEMENT_RULESET_ID, TOKEN_TTL_MS } from './rules.js';

const PREFIX = 'mw1';

/**
 * Domain-separated from JWT signing. Production never accepts a caller override
 * and never falls back to a short/missing secret.
 */
export function resolveMovementTokenMaterial(secret, nodeEnv = env.NODE_ENV, jwtSecret = env.JWT_SECRET) {
  const production = nodeEnv === 'production';
  const raw = String((production ? jwtSecret : secret || jwtSecret) || '');
  if (raw.length < 16) {
    const error = new Error('Movement continuation secret is unavailable.');
    error.status = 503;
    error.code = 'MOVEMENT_TOKEN_SECRET';
    throw error;
  }
  return raw;
}

function movementKey(secret) {
  return createHash('sha256').update(`${MOVEMENT_RULESET_ID}:${resolveMovementTokenMaterial(secret)}`).digest();
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(text) {
  const padded = String(text).replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

/**
 * AES-256-GCM continuation token. Payload includes the prior sample so the
 * server can verify the next geodesic without persisting coordinates.
 * JWT_SECRET is never used as the raw key — it is hashed with the ruleset id.
 */
export function sealMovementToken(payload, options = {}) {
  const key = movementKey(options.secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}.${b64url(iv)}.${b64url(tag)}.${b64url(encrypted)}`;
}

export function openMovementToken(token, options = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  try {
    const key = movementKey(options.secret);
    const iv = fromB64url(parts[1]);
    const tag = fromB64url(parts[2]);
    const encrypted = fromB64url(parts[3]);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function issueMovementToken({ session, userId, sample, sequence, accM = 0, now = new Date() }, options = {}) {
  const stamped = sample.locationTimestamp instanceof Date
    ? sample.locationTimestamp.getTime()
    : Number(sample.locationTimestamp) < 1e12
      ? Number(sample.locationTimestamp) * 1000
      : Number(sample.locationTimestamp);
  return sealMovementToken(
    {
      v: 1,
      sid: session.id,
      uid: userId,
      seq: sequence,
      ts: stamped,
      lat: sample.latitude,
      lng: sample.longitude,
      acc: sample.horizontalAccuracy,
      accM: Math.max(0, Number(accM) || 0),
      exp: now.getTime() + TOKEN_TTL_MS,
      rs: MOVEMENT_RULESET_ID,
    },
    options,
  );
}

export function readMovementToken(token, { userId, sessionId, now = new Date() }, options = {}) {
  const payload = openMovementToken(token, options);
  if (!payload) return { ok: false, reason: 'SEGMENT_TOKEN_INVALID' };
  if (payload.rs !== MOVEMENT_RULESET_ID) return { ok: false, reason: 'SEGMENT_TOKEN_INVALID' };
  if (payload.uid !== userId || payload.sid !== sessionId) return { ok: false, reason: 'SEGMENT_TOKEN_INVALID' };
  if (!Number.isFinite(payload.exp) || payload.exp <= now.getTime()) {
    return { ok: false, reason: 'SEGMENT_TOKEN_EXPIRED' };
  }
  return { ok: true, payload };
}

export function tokenLooksLikeMovement(value) {
  return String(value || '').startsWith(`${PREFIX}.`);
}
