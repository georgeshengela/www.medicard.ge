const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// A reminder's „მივიღე ✓“ does not open the app. On Android a killed app's tap reaches no JS listener:
// expo-notifications 57 only runs a registered notification task, in a headless runtime that may end as
// soon as the task resolves, and it keeps the response for the next runtime of the same process, which
// replays it through getLastNotificationResponseAsync. These tests run the real task → runner →
// mediNotificationActions → medications.shared → productObservability → doseEventQueue chain in
// separate "runtimes" (fresh module instances) of one phone (shared storage).
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const readSource = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** One phone: storage and the server outlive any runtime. */
function phone({ os = 'android', account = 'u1' } = {}) {
  return { os, prefs: new Map(), server: { fail: null, received: [] }, snapshotUser: account, releases: [], registered: [] };
}

/** A JS runtime on `device`: its own module instances (claims in memory, timers), the device's storage. */
function runtime(device) {
  let accountId = null;
  const scoped = (base) => (accountId ? `${base}.${accountId}` : null);
  const tasks = new Map();
  const loads = new Map();
  const storage = {
    getToken: async () => null,
    getPreference: async (key) => device.prefs.get(key) ?? null,
    setPreference: async (key, value) => {
      device.prefs.set(key, value);
    },
    deletePreference: async (key) => {
      device.prefs.delete(key);
    },
  };
  const mocks = {
    'react-native': { Platform: { OS: device.os } },
    'expo-constants': { expoConfig: { version: 'test' } },
    expo: {
      requireOptionalNativeModule: (name) =>
        name === 'MedicardNotificationWake' && device.os === 'ios' ? { release: () => device.releases.push(device.server.received.length) } : null,
    },
    'expo-task-manager': {
      defineTask: (name, fn) => tasks.set(name, fn),
      isTaskRegisteredAsync: async (name) => device.registered.includes(name),
    },
    'expo-notifications': {
      registerTaskAsync: async (name) => {
        device.registered.push(name);
      },
    },
    '@/lib/api': {
      ApiError,
      api: {
        push: {
          syncDoseEvents: async (body) => {
            if (device.server.fail !== null) throw new ApiError('failed', device.server.fail);
            device.server.received.push(...body.events.map((row) => ({ ...row, account: accountId })));
            return { ok: true };
          },
        },
      },
    },
    '@/lib/localAccount': {
      localAccountId: () => accountId,
      setLocalAccountId: (id) => {
        accountId = id || null;
      },
      getScopedPreference: async (base) => (scoped(base) ? device.prefs.get(scoped(base)) ?? null : null),
      setScopedPreference: async (base, value) => {
        if (scoped(base)) device.prefs.set(scoped(base), value);
      },
      deleteScopedPreference: async (base) => {
        if (scoped(base)) device.prefs.delete(scoped(base));
      },
    },
    '@/lib/sessionSnapshot': {
      loadSessionSnapshot: async () => (device.snapshotUser ? { user: { id: device.snapshotUser } } : null),
    },
    '@/lib/storage': storage,
    '@/lib/jwtSubject': { jwtSubject: () => null },
    '@/lib/accountSync': { scheduleAccountSyncPush: () => {} },
    '@/lib/mediNotificationBrain': { requestEngageRefresh: () => {} },
    '@/lib/expoNotifications': {
      Notifications: {
        DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
        cancelScheduledNotificationAsync: async () => {},
        setNotificationCategoryAsync: async () => {},
      },
    },
    '@/lib/hydration': { addHydrationLog: async () => [], todayYmd: () => '2000-01-01' },
    '@/lib/mediEngagePrefs': { markEngageOpened: async () => {} },
    '@/types/hydration': { HYDRATION_DROP_ML: 250 },
    '../i18n/locale.js': { tx: (ka) => ka },
    '@/lib/queryClient': { invalidate: async () => {} },
  };
  const cache = new Map();
  function load(full) {
    if (cache.has(full)) return cache.get(full);
    const module = { exports: {} };
    cache.set(full, module.exports);
    const rel = path.relative(SRC, full).replace(/\\/g, '/');
    loads.set(rel, (loads.get(rel) || 0) + 1);
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(
      source,
      {
        module,
        exports: module.exports,
        require: (name) => {
          if (name in mocks) return mocks[name];
          const base = name.startsWith('@/') ? path.join(SRC, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(full), name) : null;
          const found = base && [base, `${base}.ts`, `${base}.js`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
          if (!found) throw Error(`Unmocked: ${name}`);
          const exports = load(found);
          cache.set(found, exports);
          return exports;
        },
        console,
        Date,
        JSON,
        Promise,
        Number,
        setTimeout,
        clearTimeout,
      },
      { filename: full },
    );
    cache.set(full, module.exports);
    return module.exports;
  }
  const mod = (rel) => load(path.join(SRC, rel));
  return {
    mod,
    loads,
    /** Android's TaskService: runs the defined task with the native payload and waits for it. */
    runTask: (payload) => tasks.get(mod('lib/notificationActionTask.ts').NOTIFICATION_ACTION_TASK)({ data: payload, executionInfo: {} }),
    hasTask: () => tasks.size > 0,
  };
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** „მივიღე ✓“ on med-1's reminder delivered a minute ago, as Android's task payload and as the listener's response. */
function takeTap(owner = 'u1', action = 'TAKE') {
  const delivered = new Date(Date.now() - 60_000);
  const data = { type: 'medication', medicationId: 'med-1', time: hm(delivered), owner };
  const request = { identifier: `med:med-1:${hm(delivered)}`, trigger: { type: 'daily' } };
  return {
    // NotificationSerializer.toBundle(response): the data travels as a JSON string, the date in ms.
    payload: {
      actionIdentifier: action,
      notification: { date: delivered.getTime(), request: { ...request, content: { title: 'წამალი', dataString: JSON.stringify(data) } } },
    },
    // mapNotificationResponse (the listener): `data` parsed.
    response: {
      actionIdentifier: action,
      notification: { date: delivered.getTime(), request: { ...request, content: { title: 'წამალი', data } } },
    },
    date: ymd(delivered),
    time: hm(delivered),
  };
}

const doseLog = (device, id = 'u1') => JSON.parse(device.prefs.get(`medicard.meds.doseLogs.${id}`) || '[]');

test('Android, app killed: the task marks the dose and has sent its event before it resolves', async () => {
  const device = phone();
  const headless = runtime(device);
  const tap = takeTap();
  assert.equal(headless.hasTask(), false);
  headless.mod('lib/notificationActionTask.ts');
  assert.equal(headless.hasTask(), true);
  await headless.runTask(tap.payload);
  // No settling: the headless runtime may be torn down right after the task resolves.
  assert.deepEqual(
    doseLog(device).map((row) => [row.medicationId, row.date, row.time, row.status]),
    [['med-1', tap.date, tap.time, 'taken']],
  );
  assert.deepEqual(
    device.server.received.map((row) => [row.source, row.status, row.date, row.time, row.account]),
    [['notification', 'taken', tap.date, tap.time, 'u1']],
  );
});

test('the response replayed to the next runtime (getLastNotificationResponseAsync) is not marked again', async () => {
  const device = phone();
  const tap = takeTap();
  await runtime(device).runTask(tap.payload);
  const first = doseLog(device)[0];

  // She opens the app and undoes the dose; expo hands the kept TAKE response to the new runtime.
  const app = runtime(device);
  await app.mod('lib/medications.shared.ts').saveDoseLog({
    medicationId: 'med-1',
    date: tap.date,
    time: tap.time,
    status: 'skipped',
    updatedAt: new Date(Date.parse(first.updatedAt) + 1_000).toISOString(),
  });
  await app.mod('lib/backgroundWork.ts').settleBackgroundWork();
  const result = await app.mod('lib/notificationActionRunner.ts').runBackgroundNotificationAction(tap.response);
  assert.equal(result, null);
  assert.equal(doseLog(device)[0].status, 'skipped');
  assert.deepEqual(device.server.received.map((row) => [row.source, row.status]), [
    ['notification', 'taken'],
    ['app', 'skipped'],
  ]);
});

test('app in the background: the task and the listener get the same tap; it is handled once', async () => {
  const device = phone();
  const app = runtime(device);
  const tap = takeTap();
  const runner = app.mod('lib/notificationActionRunner.ts');
  const [, fromListener, again] = await Promise.all([
    app.runTask(tap.payload),
    runner.runBackgroundNotificationAction(tap.response),
    runner.runBackgroundNotificationAction(tap.response),
  ]);
  assert.equal(fromListener?.navigate, false);
  assert.equal(again, null);
  assert.deepEqual(device.server.received.map((row) => row.source), ['notification']);
  assert.equal(doseLog(device).length, 1);
});

test('a received push and a button that opens the app return before anything else is loaded', async () => {
  const device = phone();
  const headless = runtime(device);
  headless.mod('lib/notificationActionTask.ts');
  // FirebaseMessagingDelegate.onMessageReceived → the remote message, no actionIdentifier.
  await headless.runTask({ data: { body: '{"type":"medi_engage"}' }, notification: { title: 'Medi' } });
  await headless.runTask({ ...takeTap().payload, actionIdentifier: 'CHAT' });
  await headless.runTask(null);
  assert.equal(headless.loads.has('lib/notificationActionRunner.ts'), false);
  assert.equal(headless.loads.has('lib/mediNotificationActions.ts'), false);
  assert.equal(headless.loads.has('lib/medications.shared.ts'), false);
  assert.equal(device.server.received.length, 0);
});

test('a locked or offline phone: the mark is kept and its event waits in the outbox', async () => {
  const device = phone();
  device.server.fail = 0;
  await runtime(device).runTask(takeTap().payload);
  assert.equal(doseLog(device)[0].status, 'taken');
  assert.deepEqual(JSON.parse(device.prefs.get('medicard.meds.pendingDoseEvents.u1')).map((row) => row.source), ['notification']);
});

test('another account’s reminder never marks the signed-in account', async () => {
  const device = phone({ account: 'u2' });
  await runtime(device).runTask(takeTap('u1').payload);
  assert.deepEqual(doseLog(device, 'u2'), []);
  assert.deepEqual(doseLog(device, 'u1'), []);
  assert.equal(device.server.received.length, 0);
});

test('iOS: no task; the listener path releases the native background time after the event was sent', async () => {
  const device = phone({ os: 'ios' });
  const app = runtime(device);
  app.mod('lib/notificationActionTask.ts');
  assert.equal(app.hasTask(), false);
  const tap = takeTap();
  const { runBackgroundNotificationAction } = app.mod('lib/notificationActionRunner.ts');
  // iOS reports the delivery date in seconds.
  const result = await runBackgroundNotificationAction({
    ...tap.response,
    notification: { ...tap.response.notification, date: tap.response.notification.date / 1000 },
  });
  assert.equal(result?.navigate, false);
  // Released once, after the server had the event.
  assert.deepEqual(device.releases, [1]);
  assert.deepEqual(device.server.received.map((row) => [row.source, row.date, row.time]), [['notification', tap.date, tap.time]]);
});

test('the task is registered once, on Android only, with the categories', async () => {
  const android = phone();
  const app = runtime(android);
  const task = app.mod('lib/notificationActionTask.ts');
  await task.registerNotificationActionTask();
  await task.registerNotificationActionTask();
  assert.deepEqual(android.registered, ['medicard-notification-action']);

  const ios = phone({ os: 'ios' });
  await runtime(ios).mod('lib/notificationActionTask.ts').registerNotificationActionTask();
  assert.deepEqual(ios.registered, []);

  const actions = readSource('src/lib/mediNotificationActions.ts');
  const categories = actions.slice(actions.indexOf('export async function registerNotificationCategories('));
  assert.match(categories.slice(0, categories.indexOf('\n}\n')), /registerNotificationActionTask\(\)/);
});

test('the background buttons are exactly the ones registered without opening the app', () => {
  const actions = readSource('src/lib/mediNotificationActions.ts');
  const ids = Object.fromEntries([...actions.matchAll(/(\w+): '([A-Z_]+)',/g)].map((m) => [m[1], m[2]]));
  const background = new Set(
    [...actions.matchAll(/identifier: NOTIF_ACTION\.(\w+),[^\n]*opensAppToForeground: false/g)].map((m) => ids[m[1]]),
  );
  const taps = runtime(phone()).mod('lib/notificationTaps.ts');
  assert.deepEqual([...taps.BACKGROUND_ACTIONS].sort(), [...background].sort());
});

test('the task is defined when the bundle loads, before expo-router; AppShell sends background buttons to the runner', () => {
  const entry = readSource('index.js');
  const task = entry.indexOf("import './src/lib/notificationActionTask';");
  assert.ok(task > 0);
  assert.ok(task < entry.indexOf("import 'expo-router/entry';"));
  const shell = readSource('app/_layout.tsx');
  const handleTap = shell.slice(shell.indexOf('const handleTap = (response: NotificationResponse) => {'));
  const body = handleTap.slice(0, handleTap.indexOf('\n    };\n'));
  assert.match(body, /isBackgroundAction\(response\.actionIdentifier\)/);
  assert.match(body, /if \(!background && !claimNotificationTap\(/);
  assert.match(body, /runBackgroundNotificationAction\(response\)/);
});

test('without a known person (headless task, background launch) a dose answer starts no Medi re-plan', () => {
  const brain = readSource('src/lib/mediNotificationBrain.ts');
  const refresh = brain.slice(brain.indexOf('export function requestEngageRefresh(): void {'));
  assert.match(refresh.slice(0, refresh.indexOf('\n}\n')), /if \(!lastActor\.user\) return;/);
});
