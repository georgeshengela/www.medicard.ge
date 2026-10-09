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
  const cancelled = [];
  const session = { snapshotUser, token };
  /** Runs once, while the next scoped read is in flight (an account switch landing mid-read). */
  let duringScopedRead = null;
  const localAccount = {
    localAccountId: () => accountId,
    setLocalAccountId: (id) => {
      accountId = id || null;
    },
    getScopedPreference: async (base) => {
      const value = accountId ? prefs.get(`${base}.${accountId}`) ?? null : null;
      const hook = duringScopedRead;
      duringScopedRead = null;
      if (hook) hook();
      return value;
    },
    setScopedPreference: async (base, value) => {
      if (accountId) prefs.set(`${base}.${accountId}`, value);
    },
  };
  const storage = {
    getToken: async () => session.token,
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
    '@/lib/sessionSnapshot': {
      loadSessionSnapshot: async () => (session.snapshotUser ? { user: { id: session.snapshotUser } } : null),
    },
    '@/lib/storage': storage,
    '@/lib/jwtSubject': { jwtSubject: (value) => (value ? `jwt-${value}` : null) },
    '@/lib/notificationDose': notificationDoseModule,
    '@/lib/accountSync': { scheduleAccountSyncPush: () => {} },
    '@/lib/mediNotificationBrain': { requestEngageRefresh: () => {} },
    '@/lib/productObservability': { syncDoseEvent: async (event) => events.push(event) },
    '@/lib/expoNotifications': {
      Notifications: { cancelScheduledNotificationAsync: async (id) => cancelled.push(id) },
    },
    '@/lib/notificationPlan': () => load(path.join(SRC, 'notificationPlan.ts'), {}),
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
    cancelled,
    signIn: (id) => localAccount.setLocalAccountId(id),
    onNextScopedRead: (fn) => {
      duringScopedRead = fn;
    },
    /** Sign-out: no account, no snapshot, no token (AuthContext signOut / deleteAccount). */
    signOut: () => {
      localAccount.setLocalAccountId(null);
      session.snapshotUser = null;
      session.token = null;
    },
    /** A fresh credential sign-in (AuthContext.adopt): the queue is pruned to `id` before the account is set. */
    freshSignIn: async (id) => {
      await shared.prunePendingDoseLogs(id);
      localAccount.setLocalAccountId(id);
      session.snapshotUser = id;
    },
    logsOf: (id) => JSON.parse(prefs.get(`medicard.meds.doseLogs.${id}`) || '[]'),
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function takeTap(deliveredSeconds, time = '08:00', extra = {}) {
  return {
    actionIdentifier: 'TAKE',
    notification: {
      date: deliveredSeconds,
      request: { identifier: 'med:med-1:' + time, content: { data: { type: 'medication', medicationId: 'med-1', time, ...extra } } },
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

// A shared phone. Her 09:00 MEDIPILL reminder stays in the notification centre after she signs out
// (or deletes the account); someone taps its „მივიღე ✓“ while nobody is signed in. The old code queued
// the mark for the device and the next account to sign in got her dose: in its log, on its calendar
// and as a dose event on the server under its session. A mark now belongs to the reminder's account.
const nowSeconds = () => Math.floor(Date.now() / 1000);

test('a mark from her reminder tapped after she signed out never lands in the next account', async () => {
  const phone = device({ snapshotUser: 'her' });
  phone.signIn('her');
  phone.signOut();
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '09:00', { owner: 'her' }));
  assert.ok(phone.prefs.get('medicard.meds.pendingDoseLogs'), 'nobody is signed in: the mark waits');

  // Even a session restored for someone else (no fresh sign-in in between) never gets it.
  phone.signIn('him');
  assert.equal((await phone.shared.loadDoseLogs()).length, 0);
  await flush();
  assert.deepEqual(phone.logsOf('him'), []);
  assert.equal(phone.events.length, 0, 'no dose event under his session');
  assert.equal(phone.prefs.get('medicard.meds.pendingDoseLogs'), undefined, 'the queue is gone');
});

test('a fresh sign-in drops a mark queued before it, even one from an older reminder without an owner', async () => {
  const phone = device();
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '09:00'));
  assert.ok(phone.prefs.get('medicard.meds.pendingDoseLogs'));
  await phone.freshSignIn('him');
  assert.equal((await phone.shared.loadDoseLogs()).length, 0);
  await flush();
  assert.equal(phone.events.length, 0);
  assert.equal(phone.prefs.get('medicard.meds.pendingDoseLogs'), undefined);
});

// IR2-1: she is signed out (signOut, or a password reset on the web ended this phone's session) and
// her 20:00 reminder is still in the notification centre. She taps „მივიღე ✓“, then signs in again
// with her password. The old adopt() deleted the whole queue, so her own mark was lost and the dose
// showed as missed. A fresh sign-in now keeps her own marks and drops everyone else's.
test('her own mark tapped while signed out lands when she signs in again', async () => {
  const phone = device({ snapshotUser: 'her' });
  phone.signIn('her');
  phone.signOut();
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '20:00', { owner: 'her' }));
  assert.equal(phone.events.length, 0, 'nothing is sent while signed out');

  await phone.freshSignIn('her');
  const logs = await phone.shared.loadDoseLogs();
  await flush();
  assert.deepEqual(logs.map((row) => [row.medicationId, row.time, row.status]), [['med-1', '20:00', 'taken']]);
  assert.equal(phone.events.length, 1, 'the dose event goes out with her session');
  assert.equal(phone.prefs.get('medicard.meds.pendingDoseLogs'), undefined, 'the queue is applied once');
  assert.equal((await phone.shared.loadDoseLogs()).length, 1);
});

test('her mark tapped while signed out never lands when someone else signs in', async () => {
  const phone = device({ snapshotUser: 'her' });
  phone.signIn('her');
  phone.signOut();
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '20:00', { owner: 'her' }));

  await phone.freshSignIn('him');
  assert.equal((await phone.shared.loadDoseLogs()).length, 0);
  await flush();
  assert.deepEqual(phone.logsOf('him'), []);
  assert.equal(phone.events.length, 0, 'no dose event under his session');
  assert.equal(phone.prefs.get('medicard.meds.pendingDoseLogs'), undefined, 'dropped at his sign-in');
});

test('a fresh sign-in keeps only its own marks of a mixed queue', async () => {
  const phone = device();
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '08:00', { owner: 'her' }));
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '14:00', { owner: 'him' }));
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '20:00'));
  assert.equal(JSON.parse(phone.prefs.get('medicard.meds.pendingDoseLogs')).length, 3);

  await phone.freshSignIn('her');
  const kept = JSON.parse(phone.prefs.get('medicard.meds.pendingDoseLogs'));
  assert.deepEqual(kept.map((row) => [row.time, row.owner]), [['08:00', 'her']], 'his and the owner-less mark are dropped');
  const logs = await phone.shared.loadDoseLogs();
  await flush();
  assert.deepEqual(logs.map((row) => row.time), ['08:00']);
  assert.equal(phone.events.length, 1);
  assert.deepEqual(phone.logsOf('him'), []);
});

// The drain skips storage once this process saw the queue empty. The stored queue is what counts: when
// the prune keeps her marks it must re-arm the drain itself, even if no tap in this process did.
test('her kept marks drain even after this process saw the queue empty', async () => {
  const phone = device();
  phone.signIn('her');
  assert.equal((await phone.shared.loadDoseLogs()).length, 0, 'the drain finds no queue');
  phone.signOut();
  const updatedAt = new Date().toISOString();
  phone.prefs.set(
    'medicard.meds.pendingDoseLogs',
    JSON.stringify([{ medicationId: 'med-1', date: updatedAt.slice(0, 10), time: '20:00', status: 'taken', updatedAt, queuedAt: Date.now(), owner: 'her' }]),
  );

  await phone.freshSignIn('her');
  const logs = await phone.shared.loadDoseLogs();
  await flush();
  assert.deepEqual(logs.map((row) => [row.medicationId, row.time, row.status]), [['med-1', '20:00', 'taken']]);
  assert.equal(phone.events.length, 1);
  assert.equal(phone.prefs.get('medicard.meds.pendingDoseLogs'), undefined);
});

test('a broken queue never fails the sign-in', async () => {
  const phone = device();
  phone.prefs.set('medicard.meds.pendingDoseLogs', '{not json');
  await phone.freshSignIn('her');
  assert.equal(phone.prefs.get('medicard.meds.pendingDoseLogs'), undefined);
  assert.equal((await phone.shared.loadDoseLogs()).length, 0);
});

test('her reminder tapped while someone else is signed in marks nothing', async () => {
  const phone = device({ snapshotUser: 'him' });
  const result = await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '09:00', { owner: 'her' }));
  await flush();
  assert.equal(result.navigate, false);
  assert.deepEqual(phone.logsOf('him'), []);
  assert.deepEqual(phone.logsOf('her'), []);
  assert.equal(phone.events.length, 0);
});

test('a cold-start „მივიღე ✓“ on her own reminder still lands in her account once her session is back', async () => {
  const phone = device();
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '09:00', { owner: 'her' }));
  assert.ok(phone.prefs.get('medicard.meds.pendingDoseLogs'));
  // The phone was unlocked: the saved session (snapshot / token) restores her, no new sign-in.
  phone.signIn('her');
  const logs = await phone.shared.loadDoseLogs();
  await flush();
  assert.deepEqual(logs.map((row) => [row.medicationId, row.time, row.status]), [['med-1', '09:00', 'taken']]);
  assert.equal(phone.events.length, 1);
});

test('her own reminder marks her dose while she is signed in', async () => {
  const phone = device({ snapshotUser: 'her' });
  await phone.actions.handleNotificationAction(takeTap(nowSeconds(), '09:00', { owner: 'her' }));
  await flush();
  assert.equal(phone.logsOf('her').length, 1);
  assert.equal(phone.events.length, 1);
});

// Her session is restored (or she is signed in) and the dose log is being read when another account
// signs in on the phone (switch account). The scoped key follows the account at write time, so the old
// code wrote her whole dose log, with the mark, into the account that had just signed in.
test('an account switch while her dose log is read never writes her log into the next account', async () => {
  const her = { medicationId: 'med-0', date: '2026-10-07', time: '08:00', status: 'taken', updatedAt: '2026-10-07T05:00:00.000Z' };

  // The queued mark, applied when her session is back.
  const queued = device();
  await queued.actions.handleNotificationAction(takeTap(nowSeconds(), '09:00', { owner: 'her' }));
  queued.prefs.set('medicard.meds.doseLogs.her', JSON.stringify([her]));
  queued.signIn('her');
  queued.onNextScopedRead(() => queued.signIn('him'));
  await queued.shared.loadDoseLogs();
  await flush();
  assert.deepEqual(queued.logsOf('him'), [], 'nothing of hers lands in his log');
  assert.deepEqual(queued.logsOf('her'), [her]);
  assert.equal(queued.events.length, 0, 'no dose event under his session');

  // A „მივიღე ✓“ while she is signed in.
  const signedIn = device({ snapshotUser: 'her' });
  signedIn.prefs.set('medicard.meds.doseLogs.her', JSON.stringify([her]));
  signedIn.onNextScopedRead(() => signedIn.signIn('him'));
  await signedIn.actions.handleNotificationAction(takeTap(nowSeconds(), '09:00', { owner: 'her' }));
  await flush();
  assert.deepEqual(signedIn.logsOf('him'), []);
  assert.deepEqual(signedIn.logsOf('her'), [her]);
  assert.equal(signedIn.events.length, 0);
});

test('every medication reminder names the account it was scheduled for', () => {
  const source = fs.readFileSync(path.join(SRC, 'notifications.ts'), 'utf8');
  const content = source.slice(source.indexOf('function medicationReminderContent('));
  const data = content.slice(content.indexOf('data: {'), content.indexOf('route:'));
  assert.match(data, /\n\s*owner,\n/);
  // Slot reminders and the moved one-offs both pass the owner they were scheduled for.
  assert.match(source, /content: medicationReminderContent\(dose, expectedOwner\)/);
  assert.match(source, /content: medicationReminderContent\(dose, owner, moved\.date\)/);
  assert.equal((source.match(/scheduleMovedDose\(dose, (moved|item), expectedOwner\)/g) || []).length, 2);
  assert.doesNotMatch(source, /medicationReminderContent\(dose\)/);
});

test('a fresh sign-in prunes the queue to its own account before the account is set; a restored session does not', () => {
  const auth = fs.readFileSync(path.resolve(SRC, '../store/AuthContext.tsx'), 'utf8');
  const adopt = auth.slice(auth.indexOf('const adopt = useCallback('));
  const pruneAt = adopt.indexOf('prunePendingDoseLogs(result.user.id)');
  assert.ok(pruneAt > 0 && pruneAt < adopt.indexOf('setLocalAccountId(result.user.id)'));
  assert.doesNotMatch(auth, /clearPendingDoseLogs/, 'no blanket clear of her own marks');
  const hydrate = auth.slice(auth.indexOf('const hydrate = useCallback('), auth.indexOf('const refreshSession'));
  assert.doesNotMatch(hydrate, /prunePendingDoseLogs/);
});

// Tapping the reminder itself (not „მივიღე ✓“): a medicine taken at 08:00, 14:00 and 20:00. The 20:00
// banner opened the dose screen with no slot, which fell back to 08:00 — „მიღება“ there re-marked 08:00
// and left 20:00 open. The tap now opens the reminded slot and day.
function openTap(deliveredSeconds, data) {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { date: deliveredSeconds, request: { identifier: 'med:med-1:' + data.time, content: { data } } },
  };
}

test('tapping a 20:00 reminder opens the 20:00 dose of that day', async () => {
  const phone = device({ snapshotUser: 'u1' });
  const data = { type: 'medication', medicationId: 'med-1', time: '20:00', route: '/medications/med-1?time=20:00' };
  const result = await phone.actions.handleNotificationAction(openTap(localSeconds(2026, 10, 8, 20, 0), data));
  assert.equal(result.navigate, true);
  assert.equal(result.route, '/medications/med-1?time=20:00&date=2026-10-08');
  assert.deepEqual(phone.logsOf('u1'), [], 'opening marks nothing');
});

test('a reminder scheduled by an older version (route without a slot) still opens its own dose', async () => {
  const phone = device({ snapshotUser: 'u1' });
  const data = { type: 'medication', medicationId: 'med-1', time: '14:00', route: '/medications/med-1' };
  const result = await phone.actions.handleNotificationAction(openTap(localSeconds(2026, 10, 8, 14, 5), data));
  assert.equal(result.route, '/medications/med-1?time=14:00&date=2026-10-08');
});

test('a 23:30 reminder opened after midnight opens that evening’s dose', async () => {
  const phone = device({ snapshotUser: 'u1' });
  const data = { type: 'medication', medicationId: 'med-1', time: '23:30' };
  const result = await phone.actions.handleNotificationAction(openTap(localSeconds(2026, 10, 9, 0, 40), data));
  assert.equal(result.route, '/medications/med-1?time=23:30&date=2026-10-08');
});

test('a payload without a slot keeps the old fallback route', async () => {
  const phone = device({ snapshotUser: 'u1' });
  const result = await phone.actions.handleNotificationAction(openTap(localSeconds(2026, 10, 8, 9, 0), { type: 'medication', medicationId: 'med-1' }));
  assert.equal(result.navigate, true);
  assert.equal(result.route, undefined);
});

test('the scheduled reminder names its slot and the fallback route keeps it', () => {
  const source = fs.readFileSync(path.join(SRC, 'notifications.ts'), 'utf8');
  assert.match(source, /route: `\/medications\/\$\{dose\.medicationId\}\?time=\$\{dose\.time\}/);
  const plan = load(path.join(SRC, 'notificationPlan.ts'), {});
  assert.ok(plan.isNotificationRoute('/medications/med-1?time=20:00&date=2026-10-08'));
  assert.equal(
    plan.routeFromNotificationData({ type: 'medication', medicationId: 'med-1', time: '20:00', route: '/medications/med-1' }),
    '/medications/med-1?time=20:00',
  );
  assert.equal(plan.routeFromNotificationData({ type: 'medication', medicationId: 'med-1', time: '20:00' }), '/medications/med-1?time=20:00');
  assert.equal(
    plan.routeFromNotificationData({ type: 'medication', medicationId: 'med-1', time: '20:00', route: '/medications/med-1?time=20:00' }),
    '/medications/med-1?time=20:00',
  );
  assert.equal(plan.routeFromNotificationData({ type: 'medication', medicationId: 'med-1' }), '/medications/med-1');
  assert.equal(plan.routeFromNotificationData({ type: 'cycle_reminder', time: '20:00', route: '/cycle/log' }), '/cycle/log');
});
