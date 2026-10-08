// auth-04: a password reset ends every older session. requireAuth is the one gate every app and web
// request passes, so it is tested here on its own (the live RA-01 auth test needs a database).
// The Prisma client is replaced before anything imports it: src/lib/prisma.js reuses
// globalThis.__medicardPrisma, and node --test runs each file in its own process.
import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const USER = { id: 'user-reset-1', email: 'nino@example.com', phone: '+995555123456', fullName: 'Nino', status: 'ACTIVE', passwordHash: 'old', createdAt: new Date('2026-09-01T00:00:00Z') };
const db = {
  /** undefined → column missing (Postgres 42703, before db:install); null → never reset; Date → last reset. */
  changedAt: null,
  executed: [],
  resetCodeHash: null,
  user: {
    findUnique: async ({ where }) => {
      if (where.id === USER.id || where.email === USER.email) return { ...USER, package: null };
      return null;
    },
    findFirst: async () => ({ ...USER }),
    update: async ({ data }) => ({ ...USER, ...data, package: null }),
  },
  passwordReset: {
    findFirst: async () => (db.resetCodeHash ? { id: 'pr-1', userId: USER.id, codeHash: db.resetCodeHash, attempts: 0, usedAt: null, expiresAt: new Date(Date.now() + 60_000) } : null),
    update: async () => ({}),
    updateMany: async () => ({ count: 0 }),
  },
  appSettings: { findUnique: async () => ({ id: 'default', allowRegistrations: true, qaOtpEnabled: false, minAppVersion: '1.0.0' }) },
  async $transaction(work) {
    return typeof work === 'function' ? work(db) : Promise.all(work);
  },
  async $queryRaw(strings, ...values) {
    const sql = strings.join('?');
    if (/passwordChangedAt/.test(sql)) {
      if (db.changedAt === undefined) throw Object.assign(new Error('column "passwordChangedAt" does not exist'), { code: 'P2010', meta: { code: '42703' } });
      return [{ passwordChangedAt: db.changedAt }];
    }
    // The /community socket handshake: USER is an active member.
    if (/"CommunityMember"/.test(sql)) return values[0] === USER.id ? [{ userId: USER.id }] : [];
    return [];
  },
  async $executeRaw(strings, ...values) {
    const sql = strings.join('?');
    if (/passwordChangedAt/.test(sql)) {
      if (db.changedAt === undefined) throw Object.assign(new Error('column "passwordChangedAt" does not exist'), { code: 'P2010' });
      db.executed.push({ sql, values });
      db.changedAt = values[0];
    }
    return 1;
  },
};

let requireAuth;
let signToken;
let mod;
let renewal;
let seal;
let resetPasswordWithCode;
let authRouter;
let env;

before(async () => {
  process.env.APP_REVIEW_PHONE = '+995555123456';
  process.env.APP_REVIEW_OTP = '4321';
  globalThis.__medicardPrisma = db;
  ({ env } = await import('../config/env.js'));
  ({ requireAuth, signToken } = await import('../middleware/auth.js'));
  mod = await import('./sessionRevocation.js');
  renewal = await import('./sessionRenewal.js');
  seal = await import('./assistantExecution.js');
  ({ resetPasswordWithCode } = await import('./passwordReset.js'));
  ({ authRouter } = await import('../routes/auth.routes.js'));
});

beforeEach(() => {
  db.changedAt = null;
  db.executed = [];
  db.resetCodeHash = null;
});

const NOW = Math.floor(Date.now() / 1000);
const tokenAt = (iat, extra = {}) => jwt.sign({ sub: USER.id, email: USER.email, iat, ...extra }, env.JWT_SECRET, { expiresIn: '30d' });

/** Runs requireAuth like Express does → { status, body, passed, req }. */
function authorize(token) {
  return new Promise((resolve, reject) => {
    const req = { headers: { authorization: `Bearer ${token}` }, lang: 'ka' };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body, passed: false, req }); return this; },
    };
    Promise.resolve(requireAuth(req, res, (error) => (error ? reject(error) : resolve({ status: 200, passed: true, req })))).catch(reject);
  });
}

describe('tokenPredatesPasswordChange', () => {
  const changed = new Date('2026-10-08T12:00:00.000Z');
  const at = (ms) => ({ iat: Math.floor(ms / 1000) });

  it('fails open without a value or without iat', () => {
    assert.equal(mod.tokenPredatesPasswordChange(at(0), null), false);
    assert.equal(mod.tokenPredatesPasswordChange(at(0), undefined), false);
    assert.equal(mod.tokenPredatesPasswordChange(at(0), 'not a date'), false);
    assert.equal(mod.tokenPredatesPasswordChange({}, changed), false);
    assert.equal(mod.tokenPredatesPasswordChange({ iat: null }, changed), false);
    assert.equal(mod.tokenPredatesPasswordChange(null, changed), false);
  });

  it('refuses a token signed clearly before the change', () => {
    assert.equal(mod.tokenPredatesPasswordChange(at(changed.getTime() - 60_000), changed), true);
    assert.equal(mod.tokenPredatesPasswordChange(at(changed.getTime() - 6_000), changed), true);
    assert.equal(mod.tokenPredatesPasswordChange(at(changed.getTime() - 60_000), changed.toISOString()), true);
  });

  it('keeps a token signed after the change or within the clock skew', () => {
    assert.equal(mod.tokenPredatesPasswordChange(at(changed.getTime() + 1_000), changed), false);
    // iat is floored to the second: a token signed 0.9 s after the write reads as up to 1 s older.
    assert.equal(mod.tokenPredatesPasswordChange(at(changed.getTime() - 999), changed), false);
    assert.equal(mod.tokenPredatesPasswordChange(at(changed.getTime() - 4_000), changed), false);
  });
});

describe('requireAuth after a password reset', () => {
  it('before db:install (no column) every valid token passes exactly as before', async () => {
    db.changedAt = undefined;
    const result = await authorize(tokenAt(NOW - 20 * 86400));
    assert.equal(result.passed, true);
    assert.equal(result.req.user.id, USER.id);
  });

  it('an account that never reset keeps every session', async () => {
    db.changedAt = null;
    assert.equal((await authorize(tokenAt(NOW - 20 * 86400))).passed, true);
    assert.equal((await authorize(signToken(USER))).passed, true);
  });

  it('a session signed before the reset is refused with a 401 the apps already sign out on', async () => {
    db.changedAt = new Date((NOW - 60) * 1000);
    const result = await authorize(tokenAt(NOW - 3600));
    assert.equal(result.passed, false);
    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'TOKEN_EXPIRED');
    assert.match(result.body.error, /პაროლი შეიცვალა/);
    assert.equal(result.req.user, undefined);
  });

  it('a session signed after the reset passes', async () => {
    db.changedAt = new Date((NOW - 3600) * 1000);
    assert.equal((await authorize(signToken(USER))).passed, true);
  });

  it('a token due for renewal but older than the reset never reaches GET /me, so it is never renewed', async () => {
    const old = tokenAt(NOW - 20 * 86400);
    const claims = jwt.decode(old);
    assert.equal(renewal.sessionRenewalDue(claims), true);
    db.changedAt = new Date((NOW - 60) * 1000);
    const result = await authorize(old);
    assert.equal(result.passed, false);
    assert.equal(result.status, 401);
  });

  it('a Medi action seal minted after the reset still passes; its own check is untouched', async () => {
    db.changedAt = new Date((NOW - 3600) * 1000);
    const sealed = seal.sealAssistantPlan(USER.id, { id: 'p1', tool: 'water_log', args: {} });
    assert.equal((await authorize(sealed)).passed, true);
    // The seal's own check (verifyAssistantPlan) is jwt-only and was not changed.
    assert.equal(jwt.verify(sealed, env.JWT_SECRET, { audience: 'medi-assistant-action', issuer: 'medicard', subject: USER.id }).id, 'p1');
    assert.equal(renewal.sessionRenewalDue(jwt.decode(sealed)), false);
  });
});

describe('the /community socket after a password reset', () => {
  /** Runs the namespace middleware like socket.io does → { error, socket }. */
  async function handshake(token) {
    const { communityHandshake } = await import('./communityRealtime.js');
    return new Promise((resolve) => {
      const socket = { handshake: { auth: { token } }, data: {} };
      communityHandshake(socket, (error) => resolve({ error, socket }));
    });
  }

  it('refuses a socket signed before the reset; a newer one and a missing column pass', async () => {
    db.changedAt = new Date((NOW - 60) * 1000);
    assert.equal((await handshake(tokenAt(NOW - 3600))).error?.message, 'unauthorized');
    const fresh = await handshake(signToken(USER));
    assert.equal(fresh.error, undefined);
    assert.equal(fresh.socket.data.userId, USER.id);
    db.changedAt = undefined;
    assert.equal((await handshake(tokenAt(NOW - 3600))).error, undefined);
  });
});

describe('where the reset is recorded', () => {
  it('markPasswordChanged never fails the reset before db:install', async () => {
    db.changedAt = undefined;
    assert.equal(await mod.markPasswordChanged(USER.id), false);
  });

  it('the email reset ends older sessions', async () => {
    db.resetCodeHash = await bcrypt.hash('123456', 4);
    const before = tokenAt(NOW - 3600);
    assert.equal((await authorize(before)).passed, true);
    const result = await resetPasswordWithCode({ email: USER.email, code: '123456', password: 'new-password-1' });
    assert.equal(result.ok, true);
    assert.equal(db.executed.length, 1);
    assert.equal((await authorize(before)).passed, false);
  });

  it('the SMS reset ends older sessions but the token it hands out works', async () => {
    const layer = authRouter.stack.find((l) => l.route?.path === '/password/sms/reset' && l.route.methods.post);
    const handler = layer.route.stack.at(-1).handle;
    const before = tokenAt(NOW - 3600);
    const body = await new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { resolve({ status: this.statusCode, ...payload }); return this; },
      };
      handler({ body: { phone: '+995555123456', code: '4321', password: 'new-password-1', confirmPassword: 'new-password-1' }, lang: 'ka' }, res, reject);
    });
    assert.equal(body.status, 200);
    assert.equal(typeof body.token, 'string');
    assert.equal(db.executed.length, 1);
    assert.equal((await authorize(before)).passed, false);
    assert.equal((await authorize(body.token)).passed, true);
  });
});
