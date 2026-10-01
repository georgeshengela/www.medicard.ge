import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  SocialAuthError,
  appleNonceValid,
  appleRevokeConfigured,
  issueAppleNonce,
  openSecret,
  readLinkToken,
  resetJwksCache,
  resolveSocialIdentity,
  revokeAppleToken,
  sealSecret,
  signLinkToken,
  socialConfig,
  socialDisplayName,
  syntheticAppleEmail,
  verifyAppleIdentity,
  verifyGoogleIdentity,
} from './socialAuth.js';
import { isDeliverableEmail } from './email/address.js';
import { isAuthWriteRequest } from './rateLimitKey.js';

const SECRET = 'test-secret-at-least-16-chars';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ keys: [jwk] }) });

const config = socialConfig({
  JWT_SECRET: SECRET,
  GOOGLE_CLIENT_IDS: 'web.apps.googleusercontent.com, ios.apps.googleusercontent.com',
  APPLE_BUNDLE_IDS: 'ge.medicard.app',
});

function sign(claims, { key = privateKey, kid = 'k1', expiresIn = '5m' } = {}) {
  return jwt.sign(claims, key, { algorithm: 'RS256', keyid: kid, expiresIn });
}

beforeEach(() => resetJwksCache());

test('google: a signed token for our client with a verified email is accepted', async () => {
  const token = sign({ iss: 'https://accounts.google.com', aud: 'web.apps.googleusercontent.com', sub: 'g-1', email: 'A@Gmail.com', email_verified: true, name: 'ნინო ბერიძე' });
  const identity = await verifyGoogleIdentity({ idToken: token }, { config, fetchImpl });
  assert.deepEqual(identity, { provider: 'google', subject: 'g-1', email: 'a@gmail.com', privateRelay: false, name: 'ნინო ბერიძე' });
});

test('google: foreign audience, other signer, expiry and unverified email are refused', async () => {
  const base = { iss: 'accounts.google.com', sub: 'g-1', email: 'a@gmail.com', email_verified: true };
  const cases = [
    [sign({ ...base, aud: 'someone-else.apps.googleusercontent.com' }), 'SOCIAL_TOKEN_INVALID'],
    [sign({ ...base, aud: 'web.apps.googleusercontent.com' }, { key: other.privateKey }), 'SOCIAL_TOKEN_INVALID'],
    [sign({ ...base, aud: 'web.apps.googleusercontent.com', iss: 'https://evil.example' }), 'SOCIAL_TOKEN_INVALID'],
    [sign({ ...base, aud: 'web.apps.googleusercontent.com' }, { expiresIn: -120 }), 'SOCIAL_TOKEN_EXPIRED'],
    [sign({ ...base, aud: 'web.apps.googleusercontent.com', email_verified: false }), 'SOCIAL_EMAIL_UNVERIFIED'],
    ['not.a.token', 'SOCIAL_TOKEN_INVALID'],
  ];
  for (const [idToken, code] of cases) {
    await assert.rejects(verifyGoogleIdentity({ idToken }, { config, fetchImpl }), (error) => error instanceof SocialAuthError && error.code === code, code);
  }
});

test('google: an HS256 token signed with a guessable secret is never accepted', async () => {
  const forged = jwt.sign({ iss: 'accounts.google.com', aud: 'web.apps.googleusercontent.com', sub: 'x', email: 'a@gmail.com', email_verified: true }, 'x', { keyid: 'k1' });
  await assert.rejects(verifyGoogleIdentity({ idToken: forged }, { config, fetchImpl }), { code: 'SOCIAL_TOKEN_INVALID' });
});

test('google: not configured answers 503 instead of accepting any audience', async () => {
  const bare = socialConfig({ JWT_SECRET: SECRET });
  await assert.rejects(verifyGoogleIdentity({ idToken: 'a.b.c' }, { config: bare, fetchImpl }), { code: 'SOCIAL_NOT_CONFIGURED', status: 503 });
});

test('apple: token must carry our server nonce and bundle audience', async () => {
  const nonce = issueAppleNonce({ secret: SECRET });
  const ok = sign({ iss: 'https://appleid.apple.com', aud: 'ge.medicard.app', sub: '001.abc', email: 'x@privaterelay.appleid.com', email_verified: 'true', is_private_email: 'true', nonce });
  const identity = await verifyAppleIdentity({ identityToken: ok, nonce }, { config, fetchImpl });
  assert.equal(identity.subject, '001.abc');
  assert.equal(identity.email, 'x@privaterelay.appleid.com');
  assert.equal(identity.privateRelay, true);

  const wrongNonce = sign({ iss: 'https://appleid.apple.com', aud: 'ge.medicard.app', sub: '001.abc', nonce: 'other' });
  await assert.rejects(verifyAppleIdentity({ identityToken: wrongNonce, nonce }, { config, fetchImpl }), { code: 'SOCIAL_NONCE_INVALID' });

  const wrongAud = sign({ iss: 'https://appleid.apple.com', aud: 'com.other.app', sub: '001.abc', nonce });
  await assert.rejects(verifyAppleIdentity({ identityToken: wrongAud, nonce }, { config, fetchImpl }), { code: 'SOCIAL_TOKEN_INVALID' });

  const noEmail = sign({ iss: 'https://appleid.apple.com', aud: 'ge.medicard.app', sub: '001.abc', nonce });
  assert.equal((await verifyAppleIdentity({ identityToken: noEmail, nonce }, { config, fetchImpl })).email, null);
});

test('apple nonce: forged, tampered and expired nonces fail', () => {
  const now = Date.now();
  const nonce = issueAppleNonce({ secret: SECRET, now });
  assert.equal(appleNonceValid(nonce, { secret: SECRET, now }), true);
  assert.equal(appleNonceValid(nonce, { secret: 'another-secret-value', now }), false);
  assert.equal(appleNonceValid(nonce.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), { secret: SECRET, now }), false);
  assert.equal(appleNonceValid(nonce, { secret: SECRET, now: now + 11 * 60 * 1000 }), false);
  assert.equal(appleNonceValid('abc', { secret: SECRET, now }), false);
});

test('refresh token sealing round-trips and fails closed', () => {
  const sealed = sealSecret('r.abc', SECRET);
  assert.notEqual(sealed, 'r.abc');
  assert.equal(openSecret(sealed, SECRET), 'r.abc');
  assert.equal(openSecret(sealed, 'different-secret-value'), null);
  assert.equal(openSecret('garbage', SECRET), null);
});

test('link token carries the identity for 10 minutes and nothing else verifies as one', () => {
  const token = signLinkToken({ provider: 'google', subject: 'g-1', email: 'a@gmail.com' }, { secret: SECRET });
  assert.deepEqual(readLinkToken(token, { secret: SECRET }), {
    identity: { provider: 'google', subject: 'g-1', email: 'a@gmail.com' },
    sealedRefresh: null,
  });
  assert.equal(readLinkToken(token, { secret: 'different-secret-value' }), null);
  // A normal session JWT is not a link token.
  assert.equal(readLinkToken(jwt.sign({ sub: 'u1', email: 'a@gmail.com' }, SECRET), { secret: SECRET }), null);
});

test('resolve: known identity signs in; verified-elsewhere links; password account asks for its password', async () => {
  const db = (identities, users, emailIdentities = []) => ({
    $queryRaw: async (strings) => (strings.join('?').includes('email =') ? emailIdentities : identities),
    user: { findUnique: async ({ where }) => users[where.email] ?? null },
  });
  const identity = { provider: 'google', subject: 'g-1', email: 'a@gmail.com' };
  assert.deepEqual(await resolveSocialIdentity(identity, db([{ userId: 'u1' }], {})), { kind: 'existing', userId: 'u1' });
  assert.deepEqual(await resolveSocialIdentity(identity, db([], { 'a@gmail.com': { id: 'u2' } })), { kind: 'link', userId: 'u2', email: 'a@gmail.com' });
  assert.deepEqual(
    await resolveSocialIdentity(identity, db([], { 'a@gmail.com': { id: 'u2' } }, [{ provider: 'apple' }])),
    { kind: 'existing', userId: 'u2', linkNow: true },
  );
  assert.deepEqual(await resolveSocialIdentity(identity, db([], {})), { kind: 'create', email: 'a@gmail.com' });
  const hidden = { provider: 'apple', subject: '001.x', email: null };
  assert.deepEqual(await resolveSocialIdentity(hidden, db([], {})), { kind: 'create', email: syntheticAppleEmail('001.x') });
});

test('names, synthetic addresses and rate limits', () => {
  assert.equal(socialDisplayName('  ნინო   ბერიძე ', 'x'), 'ნინო ბერიძე');
  assert.equal(socialDisplayName('', null), 'Medicard მომხმარებელი');
  assert.match(syntheticAppleEmail('001.x'), /^apple\.[0-9a-f]{20}@apple\.medicard\.ge$/);
  assert.equal(isDeliverableEmail(syntheticAppleEmail('001.x')), false);
  assert.equal(isDeliverableEmail('x@privaterelay.appleid.com'), true);
  for (const path of ['/api/auth/apple', '/api/auth/google', '/api/auth/social/link']) {
    assert.equal(isAuthWriteRequest({ method: 'POST', originalUrl: path }), true, path);
  }
});

test('apple revoke is skipped without keys and posts a signed client secret with them', async () => {
  assert.equal(appleRevokeConfigured(config), false);
  assert.equal(await revokeAppleToken('r.abc', { config }), false);
  const { privateKey: ecKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const withKeys = { ...config, appleTeamId: 'TEAM123456', appleKeyId: 'KEY1234567', applePrivateKey: ecKey.export({ format: 'pem', type: 'pkcs8' }) };
  let sent;
  const ok = await revokeAppleToken('r.abc', {
    config: withKeys,
    fetchImpl: async (url, init) => {
      sent = { url, body: new URLSearchParams(init.body) };
      return { ok: true, status: 200, text: async () => '' };
    },
  });
  assert.equal(ok, true);
  assert.equal(sent.url, 'https://appleid.apple.com/auth/revoke');
  assert.equal(sent.body.get('token'), 'r.abc');
  const secret = jwt.decode(sent.body.get('client_secret'), { complete: true });
  assert.equal(secret.header.alg, 'ES256');
  assert.equal(secret.header.kid, 'KEY1234567');
  assert.equal(secret.payload.sub, 'ge.medicard.app');
});
