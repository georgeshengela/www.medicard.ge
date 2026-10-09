// Route-level checks for two sign-in flows, run against an in-memory Prisma stand-in:
//   auth-07 — adding an email that sits on another (empty) account, then „move it here“, keeps the
//             password the person typed with the code;
//   auth-10 — phone sign-in respects the admin „registrations closed“ switch for new numbers only.
// src/lib/prisma.js reuses globalThis.__medicardPrisma; node --test runs each file in its own process.
import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

const state = {
  users: new Map(),
  created: [],
  allowRegistrations: true,
  emailCodeHash: null,
  phoneCodeHash: null,
};

const withPackage = (user) => (user ? { ...user, package: null } : null);
function findUser(where) {
  for (const user of state.users.values()) {
    if (where.id !== undefined && user.id === where.id) return user;
    if (where.email !== undefined && user.email === where.email) return user;
  }
  return null;
}

const MODEL = {
  'user.findUnique': ({ where }) => withPackage(findUser(where)),
  'user.findFirst': ({ where }) => {
    const numbers = where.phone?.in ?? [];
    for (const user of state.users.values()) {
      if (where.id?.not && user.id === where.id.not) continue;
      if (numbers.includes(user.phone)) return { ...user };
    }
    return null;
  },
  'user.update': ({ where, data }) => {
    const user = state.users.get(where.id);
    Object.assign(user, data);
    return withPackage(user);
  },
  'user.create': ({ data }) => {
    const user = { id: `new-${state.created.length + 1}`, createdAt: new Date(), ...data };
    state.users.set(user.id, user);
    state.created.push(user.id);
    return user;
  },
  'appSettings.findUnique': () => ({ id: 'default', allowRegistrations: state.allowRegistrations, qaOtpEnabled: false, maintenanceMode: false, minAppVersion: '1.0.0.21.0' }),
  'package.findFirst': () => ({ id: 'free' }),
  'phoneVerification.findFirst': () => (state.phoneCodeHash ? { id: 'pv-1', codeHash: state.phoneCodeHash, attempts: 0, usedAt: null, userId: null, reference: 'r', expiresAt: new Date(Date.now() + 60_000) } : null),
};

function model(name) {
  return new Proxy({}, {
    get: (_target, method) => async (args) => {
      const own = MODEL[`${name}.${String(method)}`];
      if (own) return own(args);
      if (method === 'findMany' || method === 'groupBy') return [];
      if (method === 'count') return 0;
      if (method === 'deleteMany' || method === 'updateMany') return { count: 0 };
      if (String(method).startsWith('find')) return null;
      return {};
    },
  });
}

const db = new Proxy({
  async $queryRaw(strings) {
    const sql = strings.join('?');
    if (sql.includes('"EmailVerification"') && sql.includes('codeHash')) {
      return state.emailCodeHash ? [{ id: 'ev-1', codeHash: state.emailCodeHash, attempts: 0, usedAt: null, expiresAt: new Date(Date.now() + 60_000) }] : [];
    }
    if (sql.includes('passwordChangedAt')) return [{ passwordChangedAt: null }];
    return [];
  },
  async $executeRaw() { return 1; },
  async $queryRawUnsafe() { return []; },
  async $executeRawUnsafe() { return 0; },
  async $transaction(work) { return typeof work === 'function' ? work(db) : Promise.all(work); },
}, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    if (typeof prop !== 'string' || prop === 'then' || prop.startsWith('$')) return undefined;
    return model(prop);
  },
});

let authRouter;
let invalidateAppSettings;

before(async () => {
  globalThis.__medicardPrisma = db;
  ({ authRouter } = await import('../routes/auth.routes.js'));
  ({ invalidateAppSettings } = await import('./settings.js'));
});

beforeEach(() => {
  state.users.clear();
  state.created = [];
  state.allowRegistrations = true;
  state.emailCodeHash = null;
  state.phoneCodeHash = null;
  invalidateAppSettings();
});

/** Calls a route's own handler (after requireAuth) like Express → { status, body }. */
function call(method, path, { body, user } = {}) {
  const layer = authRouter.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  assert.ok(layer, `${method} ${path} exists`);
  const handler = layer.route.stack.at(-1).handle;
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      status(code) { this.statusCode = code; return this; },
      set(name, value) { this.headers[name] = value; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    handler({ body, user: user ? withPackage(user) : undefined, lang: 'ka', headers: {} }, res, reject);
  });
}

describe('add email → „move it here“ keeps the new password (auth-07)', () => {
  it('the email signs in with the password typed with the code, not the other account’s', async () => {
    const phoneAccount = { id: 'phone-acc', email: '995555123456@phone.medicard.ge', phone: '+995555123456', fullName: 'Nino', status: 'ACTIVE', createdAt: new Date(), passwordHash: await bcrypt.hash('phone:x', 4) };
    const emptyAccount = { id: 'empty-acc', email: 'nino@example.com', phone: null, fullName: 'Nino', status: 'ACTIVE', createdAt: new Date(), passwordHash: await bcrypt.hash('old-password', 4) };
    state.users.set(phoneAccount.id, phoneAccount);
    state.users.set(emptyAccount.id, emptyAccount);
    state.emailCodeHash = await bcrypt.hash('123456', 4);

    const added = await call('post', '/email/add/verify', { user: phoneAccount, body: { email: 'nino@example.com', code: '123456', password: 'chosen-password-1' } });
    assert.equal(added.status, 409);
    assert.equal(added.body.code, 'EMAIL_TAKEN');
    assert.equal(added.body.conflict.canMoveHere, true);
    // Old builds read the same fields; the chosen password is sealed inside the token, never readable.
    assert.deepEqual(Object.keys(added.body), ['error', 'code', 'conflict']);
    const claims = JSON.parse(Buffer.from(added.body.conflict.token.split('.')[1], 'base64url').toString('utf8'));
    assert.doesNotMatch(JSON.stringify(claims), /\$2[aby]\$/);

    const moved = await call('post', '/account-conflict/resolve', { user: phoneAccount, body: { token: added.body.conflict.token, action: 'move_here' } });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.action, 'move_here');
    const kept = state.users.get('phone-acc');
    assert.equal(kept.email, 'nino@example.com');
    assert.equal(kept.phone, '+995555123456');
    assert.equal(await bcrypt.compare('chosen-password-1', kept.passwordHash), true);
    assert.equal(await bcrypt.compare('old-password', kept.passwordHash), false);
  });

  it('a conflict token without a password (phone, social, issued before this change) still moves the old one', async () => {
    const { signConflictToken, readConflictToken } = await import('./accountLogins.js');
    const key = 'conflict-test-key-0123456789abcdef';
    assert.deepEqual(readConflictToken(signConflictToken({ kind: 'email', from: 'a', to: 'b' }, key), key), { kind: 'email', from: 'a', to: 'b' });
    assert.deepEqual(readConflictToken(signConflictToken({ kind: 'phone', from: 'a', to: 'b', passwordHash: 'x' }, key), key), { kind: 'phone', from: 'a', to: 'b' });
    const hash = await bcrypt.hash('chosen', 4);
    assert.equal(readConflictToken(signConflictToken({ kind: 'email', from: 'a', to: 'b', passwordHash: hash }, key), key).passwordHash, hash);
  });
});

describe('phone sign-in while registrations are closed (auth-10)', () => {
  const existing = { id: 'phone-user', email: '995555111111@phone.medicard.ge', phone: '+995555111111', fullName: 'Giorgi', status: 'ACTIVE', createdAt: new Date(), passwordHash: 'x' };

  it('a new number gets the same 403 as email sign-up and no account is created', async () => {
    state.allowRegistrations = false;
    state.phoneCodeHash = await bcrypt.hash('2468', 4);
    const result = await call('post', '/phone/verify', { body: { phone: '+995555222222', code: '2468' } });
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'REGISTRATIONS_CLOSED');
    assert.match(result.body.error, /რეგისტრაცია/);
    assert.deepEqual(state.created, []);
  });

  it('an existing phone account still signs in', async () => {
    state.allowRegistrations = false;
    state.users.set(existing.id, { ...existing });
    state.phoneCodeHash = await bcrypt.hash('2468', 4);
    const result = await call('post', '/phone/verify', { body: { phone: '+995555111111', code: '2468' } });
    assert.equal(result.status, 200);
    assert.equal(typeof result.body.token, 'string');
    assert.equal(result.body.user.id, existing.id);
  });

  it('with registrations open a new number still creates its account', async () => {
    state.phoneCodeHash = await bcrypt.hash('2468', 4);
    const result = await call('post', '/phone/verify', { body: { phone: '+995555333333', code: '2468' } });
    assert.equal(result.status, 200);
    assert.equal(state.created.length, 1);
  });
});
