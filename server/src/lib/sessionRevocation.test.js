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
  /** IR2-6: the next N passwordChangedAt reads throw a pooler error (the column exists, the read failed). */
  readFails: 0,
  executed: [],
  resetCodeHash: null,
  /** PushToken updateMany calls (IR-11); `pushFails` makes the next one throw. */
  pushOff: [],
  pushFails: false,
  pushToken: {
    updateMany: async ({ where, data }) => {
      if (db.pushFails) throw new Error('push table unavailable');
      db.pushOff.push({ where, data });
      return { count: 2 };
    },
  },
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
  // GET /api/auth/me reads these; `duringMe` runs while the handler awaits them (IR-15's race).
  duringMe: null,
  medicalRecord: { count: async () => 0 },
  chatSession: { count: async () => 0 },
  medicationSchedule: { count: async () => 0 },
  healthProfile: {
    findUnique: async () => {
      if (db.duringMe) await db.duringMe();
      return null;
    },
  },
  async $transaction(work) {
    return typeof work === 'function' ? work(db) : Promise.all(work);
  },
  async $queryRaw(strings, ...values) {
    const sql = strings.join('?');
    if (/passwordChangedAt/.test(sql)) {
      if (db.readFails > 0) {
        db.readFails -= 1;
        throw Object.assign(new Error('Server has closed the connection.'), { code: 'P1017' });
      }
      if (db.changedAt === undefined) throw Object.assign(new Error('column "passwordChangedAt" does not exist'), { code: 'P2010', meta: { code: '42703' } });
      return [{ passwordChangedAt: db.changedAt }];
    }
    // The /community socket handshake: USER is an active member.
    if (/"CommunityMember"/.test(sql)) return values[0] === USER.id ? [{ userId: USER.id }] : [];
    return [];
  },
  // GET /me's activity log (appActivity.js, fire-and-forget) creates its table lazily.
  async $executeRawUnsafe() { return 0; },
  async $queryRawUnsafe() { return []; },
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
  db.pushOff = [];
  db.pushFails = false;
  db.duringMe = null;
  db.readFails = 0;
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

// IR-13: a delete whose answer was lost — the retry must be able to tell „this account is gone“
// from any other 401 (expired, password changed), so that 401 carries its own code.
describe('requireAuth for an account that no longer exists', () => {
  it('answers 401 ACCOUNT_NOT_FOUND, and only there', async () => {
    const gone = await authorize(jwt.sign({ sub: 'deleted-user', email: 'gone@example.com' }, env.JWT_SECRET, { expiresIn: '30d' }));
    assert.equal(gone.status, 401);
    assert.equal(gone.body.code, 'ACCOUNT_NOT_FOUND');
    assert.match(gone.body.error, /ვერ მოიძებნა/);
    const noSubject = await authorize(jwt.sign({ email: 'x@example.com' }, env.JWT_SECRET, { expiresIn: '30d' }));
    assert.equal(noSubject.status, 401);
    assert.equal(noSubject.body.code, 'ACCOUNT_NOT_FOUND');
    db.changedAt = new Date((NOW - 60) * 1000);
    assert.equal((await authorize(tokenAt(NOW - 3600))).body.code, 'TOKEN_EXPIRED');
    assert.equal((await authorize('not-a-token')).body.code, 'TOKEN_INVALID');
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
    // Older sessions stay valid without the column, so their pushes stay too.
    assert.deepEqual(db.pushOff, []);
  });

  // IR-11: the phone she locked out cannot unregister itself (its session is refused), so the reset
  // switches the account's push tokens off; each device registers again when it signs in.
  it('a reset switches off the account’s push tokens', async () => {
    assert.equal(await mod.markPasswordChanged(USER.id), true);
    assert.deepEqual(db.pushOff, [{ where: { userId: USER.id, active: true }, data: { active: false } }]);
  });

  it('a failed push-token update never fails the reset', async () => {
    db.pushFails = true;
    const at = new Date();
    assert.equal(await mod.markPasswordChanged(USER.id, at), true);
    assert.equal(db.changedAt, at);
  });

  it('the email reset ends older sessions', async () => {
    db.resetCodeHash = await bcrypt.hash('123456', 4);
    const before = tokenAt(NOW - 3600);
    assert.equal((await authorize(before)).passed, true);
    const result = await resetPasswordWithCode({ email: USER.email, code: '123456', password: 'new-password-1' });
    assert.equal(result.ok, true);
    assert.equal(db.executed.length, 1);
    assert.equal(db.pushOff.length, 1);
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
    assert.equal(db.pushOff.length, 1, 'push tokens are switched off before the resetting device registers again');
    assert.equal((await authorize(before)).passed, false);
    assert.equal((await authorize(body.token)).passed, true);
  });
});

// IR-15: GET /api/auth/me renews a token past half its life. requireAuth read passwordChangedAt at the
// start of the request; a reset that commits while the handler runs (or up to the 5 s skew before the
// signing) used to get a renewal whose fresh iat survived it. Renewals now carry the value read.
describe('a /me renewal racing a password reset', () => {
  const meHandler = () => authRouter.stack.find((l) => l.route?.path === '/me' && l.route.methods.get).route.stack.at(-1).handle;
  /** requireAuth, then the real GET /me handler → the JSON body. */
  async function getMe(token) {
    const auth = await authorize(token);
    assert.equal(auth.passed, true, 'requireAuth lets the request through');
    const req = { ...auth.req, body: {}, headers: { ...auth.req.headers }, get: () => undefined, ip: '127.0.0.1' };
    return new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        set() { return this; },
        setHeader() {},
        status(code) { this.statusCode = code; return this; },
        json(body) { resolve({ status: this.statusCode, ...body }); return this; },
      };
      Promise.resolve(meHandler()(req, res, reject)).catch(reject);
    });
  }

  it('the claim is compared exactly; without a stored value it fails open; tokens without it keep the iat rule', () => {
    const changed = new Date('2026-10-08T12:00:00.000Z');
    const after = Math.floor(changed.getTime() / 1000) + 2;
    assert.equal(mod.tokenPredatesPasswordChange({ iat: after, pwc: 0 }, changed), true);
    assert.equal(mod.tokenPredatesPasswordChange({ iat: after, pwc: changed.getTime() - 1 }, changed), true);
    assert.equal(mod.tokenPredatesPasswordChange({ iat: after, pwc: changed.getTime() }, changed), false);
    assert.equal(mod.tokenPredatesPasswordChange({ iat: after, pwc: 0 }, null), false);
    assert.equal(mod.tokenPredatesPasswordChange({ iat: after, pwc: 0 }, undefined), false);
    assert.equal(mod.tokenPredatesPasswordChange({ iat: after }, changed), false);
    assert.equal(mod.tokenPredatesPasswordChange({ iat: after, pwc: 'x' }, changed), false);
  });

  it('a renewal stamped before a reset is refused even when it was signed after it', async () => {
    const renewal = signToken(USER, mod.passwordChangeClaim({ known: true, at: null }));
    db.changedAt = new Date(Date.now() - 1000);
    // The iat rule alone would keep it (signed after the reset).
    assert.equal(mod.tokenPredatesPasswordChange({ iat: jwt.decode(renewal).iat }, db.changedAt), false);
    const result = await authorize(renewal);
    assert.equal(result.status, 401);
    assert.equal(result.body.code, 'TOKEN_EXPIRED');
  });

  it('a reset that commits while /me runs ends the renewal it hands out', async () => {
    const old = tokenAt(NOW - 20 * 86400);
    db.duringMe = async () => { db.changedAt = new Date(); };
    const body = await getMe(old);
    assert.equal(body.status, 200);
    assert.equal(typeof body.token, 'string', 'the old token was due for renewal');
    assert.equal(jwt.decode(body.token).pwc, 0);
    const result = await authorize(body.token);
    assert.equal(result.passed, false);
    assert.equal(result.body.code, 'TOKEN_EXPIRED');
  });

  it('a renewal after the reset keeps working and keeps sliding until the next reset', async () => {
    db.changedAt = new Date((NOW - 30 * 86400) * 1000);
    const body = await getMe(tokenAt(NOW - 20 * 86400));
    assert.equal(jwt.decode(body.token).pwc, db.changedAt.getTime());
    const renewed = await authorize(body.token);
    assert.equal(renewed.passed, true);
    assert.deepEqual(renewed.req.authPasswordChange, { known: true, at: db.changedAt });
    db.changedAt = new Date();
    assert.equal((await authorize(body.token)).passed, false);
  });

  // IR2-6: the request still fails open, but a fresh token is only signed when the reset check ran.
  it('before db:install (column unreadable) /me still answers but hands out no renewal', async () => {
    db.changedAt = undefined;
    const old = tokenAt(NOW - 20 * 86400);
    assert.equal(renewal.sessionRenewalDue(jwt.decode(old)), true);
    const body = await getMe(old);
    assert.equal(body.status, 200);
    assert.equal(body.user.id, USER.id);
    assert.equal(body.token, undefined);
    assert.equal((await authorize(old)).passed, true, 'the token itself keeps working (fail open)');
    assert.deepEqual(mod.passwordChangeClaim({ known: false, at: null }), {});
  });

  it('a failed read never renews a token the reset ended; the next working read refuses it', async () => {
    // Lost phone: its token is 20 days old (due for renewal); the owner reset the password a minute ago.
    const lost = tokenAt(NOW - 20 * 86400);
    db.changedAt = new Date((NOW - 60) * 1000);
    db.readFails = 1;
    const body = await getMe(lost);
    assert.equal(body.status, 200, 'the request itself fails open');
    assert.equal(body.token, undefined, 'no fresh session while the reset could not be checked');
    const next = await authorize(lost);
    assert.equal(next.passed, false);
    assert.equal(next.status, 401);
    assert.equal(next.body.code, 'TOKEN_EXPIRED');
  });

  it('a session that is still valid is renewed by the next /me whose read works', async () => {
    db.changedAt = null;
    const token = tokenAt(NOW - 20 * 86400);
    db.readFails = 1;
    assert.equal((await getMe(token)).token, undefined);
    const body = await getMe(token);
    assert.equal(typeof body.token, 'string');
    assert.equal(jwt.decode(body.token).pwc, 0);
    assert.equal((await authorize(body.token)).passed, true);
  });

  it('a token that is not due for renewal gets none', async () => {
    const body = await getMe(signToken(USER));
    assert.equal(body.status, 200);
    assert.equal(body.token, undefined);
  });
});
