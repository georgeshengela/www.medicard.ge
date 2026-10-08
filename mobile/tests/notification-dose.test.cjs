const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// A notification's „მივიღე ✓“ (TAKE) on a cold start: iOS launched the app for the tap, the account
// id is only set once /api/auth/me answers, and the old code saved into no account at all — the dose
// stayed „late“ on every screen. Runs the real medications.shared.ts + mediNotificationActions.ts with
// storage/session boundaries replaced by an in-memory device.
const SRC = path.resolve(__dirname, '../src/lib');

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
      setTimeout,
      clearTimeout,
    },
    { filename: file },
  );
  return module.exports;
}

function device({ snapshotUser = null, token = null } = {}) {
  const prefs = new Map();
  let accountId = null;
  const events = [];
  const invalidated = [];
  const localAccount = {
    localAccountId: () => accountId,
    setLocalAccountId: (id) => {
      accountId = id || null;
    },
    getScopedPreference: async (base) => (accountId ? prefs.get(`${base}.${accountId}`) ?? null : null),
    setScopedPreference: async (base, value) => {
      if (accountId) prefs.set(`${base}.${accountId}`, value);
    },
  };
  const storage = {
    getToken: async () => token,
    getPreference: async (key) => prefs.get(key) ?? null,
    setPreference: async (key, value) => {
      prefs.set(key, value);
    },
    deletePreference: async (key) => {
      prefs.delete(key);
    },
  };
  const tx = { tx: (ka) => ka };
  let notificationDose;
  const notificationDoseModule = () =>
    (notificationDose ??= load(path.join(SRC, 'notificationDose.ts'), {}));
  const shared = load(path.join(SRC, 'medications.shared.ts'), {
    '../i18n/locale.js': tx,
    '@/lib/localAccount': localAccount,
    '@/lib/sessionSnapshot': { loadSessionSnapshot: async () => (snapshotUser ? { user: { id: snapshotUser } } : null) },
    '@/lib/storage': storage,
    '@/lib/jwtSubject': { jwtSubject: (value) => (value ? `jwt-${value}` : null) },
    '@/lib/notificationDose': notificationDoseModule,
    '@/lib/accountSync': { scheduleAccountSyncPush: () => {} },
    '@/lib/mediNotificationBrain': { requestEngageRefresh: () => {} },
    '@/lib/productObservability': { syncDoseEvent: async (event) => events.push(event) },
  });
  const actions = load(path.join(SRC, 'mediNotificationActions.ts'), {
    'react-native': { Platform: { OS: 'ios' } },
    '@/lib/expoNotifications': { Notifications: { DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT' } },
    '@/lib/hydration': { addHydrationLog: async () => [], todayYmd: () => '2000-01-01' },
    '@/lib/medications.shared': shared,
    '@/lib/notificationDose': notificationDoseModule,
    '@/lib/mediEngagePrefs': { markEngageOpened: async () => {} },
    '@/types/hydration': { HYDRATION_DROP_ML: 250 },
    '../i18n/locale.js': tx,
    '@/lib/queryClient': { invalidate: async (...key) => invalidated.push(key.join('/')) },
    '@/lib/productObservability': { syncNotificationOutcome: async () => {}, syncInsightOutcome: async () => {} },
  });
  return {
    shared,
    actions,
    prefs,
    events,
    invalidated,
    signIn: (id) => localAccount.setLocalAccountId(id),
    logsOf: (id) => JSON.parse(prefs.get(`medicard.meds.doseLogs.${id}`) || '[]'),
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function takeTap(deliveredSeconds, time = '08:00') {
  return {
    actionIdentifier: 'TAKE',
    notification: {
      date: deliveredSeconds,
      request: { identifier: 'med:med-1:' + time, content: { data: { type: 'medication', medicationId: 'med-1', time } } },
    },
  };
}

const localSeconds = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).getTime() / 1000;

test('a cold-start „მივიღე ✓“ is saved to the signed-in account and keeps its history', async () => {
  const phone = device({ snapshotUser: 'u1' });
  const history = [{ medicationId: 'med-1', date: '2026-10-07', time: '08:00', status: 'taken', updatedAt: '2026-10-07T04:00:00.000Z' }];
  phone.prefs.set('medicard.meds.doseLogs.u1', JSON.stringify(history));

  const result = await phone.actions.handleNotificationAction(takeTap(localSeconds(2026, 10, 8, 8, 0)));
  await flush();

  assert.equal(result.navigate, false);
  const logs = phone.logsOf('u1');
  assert.equal(logs.length, 2, 'yesterday stays, today is added');
  assert.deepEqual(
    logs.map((row) => [row.date, row.time, row.status]).sort(),
    [['2026-10-07', '08:00', 'taken'], ['2026-10-08', '08:00', 'taken']],
  );
  assert.deepEqual(phone.invalidated, ['medications']);
  assert.equal(phone.events.length, 1);
});

test('without a snapshot the token names the account', async () => {
  const phone = device({ token: 'abc' });
  await phone.actions.handleNotificationAction(takeTap(localSeconds(2026, 10, 8, 8, 0)));
  assert.equal(phone.logsOf('jwt-abc').length, 1);
});

test('a 23:30 reminder answered after midnight marks that evening’s dose', async () => {
  const phone = device({ snapshotUser: 'u1' });
  await phone.actions.handleNotificationAction(takeTap(localSeconds(2026, 10, 8, 23, 30), '23:30'));
  assert.deepEqual(phone.logsOf('u1').map((row) => [row.date, row.time]), [['2026-10-08', '23:30']]);
});

test('with no readable session the mark waits on the device and lands once she is signed in', async () => {
  const phone = device();
  await phone.actions.handleNotificationAction(takeTap(Math.floor(Date.now() / 1000)));
  assert.equal(phone.events.length, 0, 'nothing is sent without a session');
  assert.ok(phone.prefs.get('medicard.meds.pendingDoseLogs'), 'queued, not dropped');

  phone.signIn('u2');
  phone.prefs.set(
    'medicard.meds.doseLogs.u2',
    JSON.stringify([{ medicationId: 'med-9', date: '2026-01-01', time: '09:00', status: 'skipped', updatedAt: '2026-01-01T05:00:00.000Z' }]),
  );
  const logs = await phone.shared.loadDoseLogs();
  await flush();
  assert.equal(logs.length, 2);
  assert.ok(logs.some((row) => row.medicationId === 'med-1' && row.status === 'taken'));
  assert.equal(phone.prefs.get('medicard.meds.pendingDoseLogs'), undefined, 'the queue is applied once');
  assert.equal(phone.events.length, 1, 'the dose event goes out with the session');
  assert.equal((await phone.shared.loadDoseLogs()).length, 2);
});
