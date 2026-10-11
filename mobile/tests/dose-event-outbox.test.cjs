const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// No MedicationDoseEvent row on the main DB ever said `notification` (2026-10-11). A reminder's „მივიღე ✓“
// is a background action: expo-notifications reports it handled to iOS before any JS runs, so iOS suspends
// the app while the handler works, often on a locked phone whose Keychain token cannot be read. The dose
// event was one fire-and-forget POST from there — a 401 or a request cut by the suspension was swallowed
// and never sent again. Runs the real mediNotificationActions.ts → medications.shared.ts →
// productObservability.ts → doseEventQueue.ts chain against a server that first fails, then answers.
const SRC = path.resolve(__dirname, '../src/lib');
const readSource = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function load(file, modules) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    source,
    {
      module,
      exports: module.exports,
      require: (name) => {
        if (!(name in modules)) throw Error('Unmocked: ' + name);
        return typeof modules[name] === 'function' ? modules[name]() : modules[name];
      },
      console,
      Date,
      JSON,
      Promise,
      Number,
      setTimeout,
      clearTimeout,
    },
    { filename: file },
  );
  return module.exports;
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function once(factory) {
  let value;
  return () => (value ??= factory());
}

/** A phone with an in-memory store and a server whose answer the test sets (`server.fail = 401`). */
function phone({ snapshotUser = 'u1' } = {}) {
  const prefs = new Map();
  let accountId = null;
  const session = { snapshotUser, token: null };
  const server = { fail: null, received: [], attempts: 0 };
  const scoped = (base) => (accountId ? `${base}.${accountId}` : null);
  const localAccount = {
    localAccountId: () => accountId,
    setLocalAccountId: (id) => {
      accountId = id || null;
    },
    getScopedPreference: async (base) => (scoped(base) ? prefs.get(scoped(base)) ?? null : null),
    setScopedPreference: async (base, value) => {
      if (scoped(base)) prefs.set(scoped(base), value);
    },
    deleteScopedPreference: async (base) => {
      if (scoped(base)) prefs.delete(scoped(base));
    },
  };
  const api = {
    push: {
      syncDoseEvents: async (body) => {
        server.attempts += 1;
        if (server.fail !== null) throw new ApiError('failed', server.fail);
        server.received.push(...body.events.map((row) => ({ ...row, account: accountId })));
        return { ok: true, upserted: body.events.length };
      },
    },
  };
  const tx = { tx: (ka) => ka };
  const notificationDose = once(() => load(path.join(SRC, 'notificationDose.ts'), {}));
  const observability = once(() =>
    load(path.join(SRC, 'productObservability.ts'), {
      'react-native': { Platform: { OS: 'ios' } },
      'expo-constants': { expoConfig: { version: 'test' } },
      '@/lib/api': { api, ApiError },
      '@/lib/doseEventQueue': once(() => load(path.join(SRC, 'doseEventQueue.ts'), {})),
      '@/lib/localAccount': localAccount,
    }),
  );
  const shared = load(path.join(SRC, 'medications.shared.ts'), {
    '../i18n/locale.js': tx,
    '@/lib/localAccount': localAccount,
    '@/lib/sessionSnapshot': {
      loadSessionSnapshot: async () => (session.snapshotUser ? { user: { id: session.snapshotUser } } : null),
    },
    '@/lib/storage': {
      getToken: async () => session.token,
      getPreference: async (key) => prefs.get(key) ?? null,
      setPreference: async (key, value) => {
        prefs.set(key, value);
      },
      deletePreference: async (key) => {
        prefs.delete(key);
      },
    },
    '@/lib/jwtSubject': { jwtSubject: (value) => (value ? `jwt-${value}` : null) },
    '@/lib/notificationDose': notificationDose,
    '@/lib/accountSync': { scheduleAccountSyncPush: () => {} },
    '@/lib/mediNotificationBrain': { requestEngageRefresh: () => {} },
    '@/lib/productObservability': observability,
    '@/lib/expoNotifications': { Notifications: { cancelScheduledNotificationAsync: async () => {} } },
    '@/lib/notificationPlan': () => load(path.join(SRC, 'notificationPlan.ts'), {}),
  });
  const actions = load(path.join(SRC, 'mediNotificationActions.ts'), {
    'react-native': { Platform: { OS: 'ios' } },
    '@/lib/expoNotifications': { Notifications: { DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT' } },
    '@/lib/hydration': { addHydrationLog: async () => [], todayYmd: () => '2000-01-01' },
    '@/lib/medications.shared': shared,
    '@/lib/notificationDose': notificationDose,
    '@/lib/mediEngagePrefs': { markEngageOpened: async () => {} },
    '@/types/hydration': { HYDRATION_DROP_ML: 250 },
    '../i18n/locale.js': tx,
    '@/lib/queryClient': { invalidate: async () => {} },
    '@/lib/productObservability': observability,
  });
  return {
    shared,
    actions,
    server,
    prefs,
    flushDoseEvents: () => observability().flushDoseEvents(),
    signIn: (id) => {
      accountId = id;
      session.snapshotUser = id;
    },
    signOut: () => {
      accountId = null;
      session.snapshotUser = null;
    },
    outbox: (id) => JSON.parse(prefs.get(`medicard.meds.pendingDoseEvents.${id}`) || '[]'),
  };
}

/** Lets the handler's fire-and-forget chain (dynamic imports, storage, request) run to its end. */
async function settle() {
  for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** „მივიღე ✓“ on a reminder delivered a minute ago, for `owner`'s medication med-1. */
function takeTap(owner = 'u1') {
  const delivered = new Date(Date.now() - 60_000);
  return {
    response: {
      actionIdentifier: 'TAKE',
      notification: {
        date: delivered.getTime() / 1000,
        request: {
          identifier: `med:med-1:${hm(delivered)}`,
          content: { data: { type: 'medication', medicationId: 'med-1', time: hm(delivered), owner } },
        },
      },
    },
    date: ymd(delivered),
    time: hm(delivered),
  };
}

test('a „მივიღე ✓“ from a locked phone (no token → 401) reaches the server as notification once it can', async () => {
  const device = phone();
  device.server.fail = 401;
  const tap = takeTap();
  const result = await device.actions.handleNotificationAction(tap.response);
  await settle();
  assert.equal(result.navigate, false);
  assert.equal(device.server.received.length, 0);
  assert.equal(device.server.attempts, 1);
  // The dose is marked on the phone and its answer waits in her outbox.
  assert.equal(JSON.parse(device.prefs.get('medicard.meds.doseLogs.u1'))[0].status, 'taken');
  assert.deepEqual(device.outbox('u1').map((row) => row.source), ['notification']);

  // Unlocked, back in the foreground: the outbox is sent.
  device.server.fail = null;
  await device.flushDoseEvents();
  assert.equal(device.server.received.length, 1);
  const [sent] = device.server.received;
  assert.equal(sent.source, 'notification');
  assert.equal(sent.status, 'taken');
  assert.equal(sent.medicationId, 'med-1');
  assert.equal(sent.date, tap.date);
  assert.equal(sent.time, tap.time);
  assert.equal(sent.account, 'u1');
  assert.deepEqual(device.outbox('u1'), []);
  // Nothing is sent twice.
  await device.flushDoseEvents();
  assert.equal(device.server.received.length, 1);
});

test('a request cut by iOS suspending the app (no answer) is sent on the next foreground', async () => {
  const device = phone();
  device.server.fail = 0;
  await device.actions.handleNotificationAction(takeTap().response);
  await settle();
  assert.equal(device.server.received.length, 0);
  device.server.fail = null;
  await device.flushDoseEvents();
  assert.deepEqual(device.server.received.map((row) => row.source), ['notification']);
});

test('with a working connection the reminder answer goes out at once as notification', async () => {
  const device = phone();
  device.signIn('u1');
  await device.actions.handleNotificationAction(takeTap().response);
  await settle();
  assert.deepEqual(device.server.received.map((row) => [row.source, row.status]), [['notification', 'taken']]);
  assert.deepEqual(device.outbox('u1'), []);
});

test('undone in the app before the outbox was sent: only the newer answer goes out', async () => {
  const device = phone();
  device.server.fail = 0;
  const tap = takeTap();
  await device.actions.handleNotificationAction(tap.response);
  await settle();
  await device.shared.saveDoseLog({
    medicationId: 'med-1',
    date: tap.date,
    time: tap.time,
    status: 'skipped',
    updatedAt: new Date(Date.now() + 1_000).toISOString(),
  });
  await settle();
  device.server.fail = null;
  await device.flushDoseEvents();
  assert.deepEqual(device.server.received.map((row) => [row.source, row.status]), [['app', 'skipped']]);
});

test('a refused answer (400) is dropped instead of retried forever', async () => {
  const device = phone();
  device.server.fail = 400;
  await device.actions.handleNotificationAction(takeTap().response);
  await settle();
  assert.deepEqual(device.outbox('u1'), []);
  device.server.fail = null;
  await device.flushDoseEvents();
  assert.equal(device.server.received.length, 0);
});

test('her queued answer is never sent with another account’s session', async () => {
  const device = phone();
  device.server.fail = 401;
  await device.actions.handleNotificationAction(takeTap('u1').response);
  await settle();
  device.server.fail = null;
  device.signOut();
  device.signIn('u2');
  await device.flushDoseEvents();
  assert.equal(device.server.received.length, 0);
  device.signOut();
  device.signIn('u1');
  await device.flushDoseEvents();
  assert.deepEqual(device.server.received.map((row) => [row.account, row.source]), [['u1', 'notification']]);
});

test('the outbox is sent on return to the foreground and after sign-in', () => {
  const auth = readSource(path.resolve(SRC, '../store/AuthContext.tsx'));
  const foreground = auth.slice(auth.indexOf('return onReturnToForeground(() => {'));
  assert.match(foreground.slice(0, foreground.indexOf('}, [user, healthProfile]);')), /flushDoseEvents\(\)/);
  const startup = readSource(path.join(SRC, 'safeStartup.js'));
  const postLogin = startup.slice(startup.indexOf('export function runPostLoginSideEffects('));
  assert.match(postLogin.slice(0, postLogin.indexOf('\n}\n')), /schedulePostLoginWork\('dose-events'[\s\S]*?flushDoseEvents\(\)/);
});
