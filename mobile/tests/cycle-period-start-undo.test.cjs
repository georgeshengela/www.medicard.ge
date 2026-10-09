const { test } = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const loader = require('./helpers/loadTs.cjs');
const { cyclePersistFeedback } = require('../src/lib/cycleOfflineCore.js');

// IR-8: she gave her last period start only in onboarding (stored, no logs), taps „მენსტრუაცია დაიწყო“
// and then „გაუქმება“ while online. The undo used to remove the day first: the server then had no start
// (the tap had moved it to today), and that view went to every cycle reader before the start was posted
// back — /cycle showed cycle setup, Home its setup card, reminders were planned against no start.
// Now the start goes back first, so no server answer and no published view is ever without it.
// The fake server below runs the server's own start rules (server/src/lib/cycle.js).

const USER = 'user-a';
const TODAY = '2026-10-09';
const ONBOARDING_START = '2026-09-20';

/**
 * `lastPeriod`: how each POST /last-period answers, in call order (then 'ok'):
 *   'ok' saves and answers the bundle · 'null' saves and answers `null` (the reload failed, CYC-06) ·
 *   'applied-408' saves, then the answer is lost (timeout) · 'refused-400' saves nothing ·
 *   'down-503' saves nothing (server down) · 'hang' never answers (a stalled network; `hung` resolves).
 * `platform: 'ios'` keeps the device queue in encrypted storage that outlives the app (`relaunch()`);
 * 'web' keeps it in memory for the session only.
 */
async function phone({ failStartFlush = false, onboardingStart = ONBOARDING_START, lastPeriod = [], platform = 'web' } = {}) {
  const rules = await import(pathToFileURL(join(__dirname, '../../server/src/lib/cycle.js')).href);
  const server = { stored: onboardingStart, logs: new Map(), starts: [] };
  const calls = [];
  const published = [];
  const invalidated = [];
  const lastPeriodScript = [...lastPeriod];
  let markHung;
  const hung = new Promise((resolve) => {
    markHung = resolve;
  });

  const fullLog = (date, fields) => ({
    id: `log-${date}`,
    userId: USER,
    date,
    flow: null,
    symptoms: [],
    moods: [],
    sexualActivity: null,
    libido: null,
    bbt: null,
    cervicalMucus: null,
    ovulationTest: null,
    pregnancyTest: null,
    notes: null,
    painEntries: [],
    customTagIds: [],
    observations: {},
    observationAssessments: {},
    ...fields,
  });
  const logList = () => [...server.logs.values()].sort((a, b) => a.date.localeCompare(b.date));
  const bundle = () => {
    const logs = logList();
    const inferred = rules.inferCycleStats(logs, 28, 5);
    const lastPeriodStart = rules.resolveLastPeriodStart(server.stored, inferred.lastPeriodStart, rules.lastLoggedBleedDay(inferred));
    return JSON.parse(JSON.stringify({
      meta: { today: TODAY },
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart },
      logs,
      periodRanges: inferred.periodRanges || [],
      predictions: { calendar: {} },
    }));
  };
  // Every state the server passes through (any GET or refetch could read one of them).
  const settle = (touched) => {
    server.stored = rules.pickLastPeriodStart(server.stored, logList(), undefined, undefined, touched);
    server.starts.push(bundle().profile.lastPeriodStart);
  };

  let startFailures = failStartFlush ? 1 : 0;
  const api = {
    cycle: {
      get: async () => (calls.push('get'), bundle()),
      applyPeriod: async (body) => {
        if (body.action !== 'start') {
          // Only the start is modelled; „end“ / „fill“ are recorded with what they ask for.
          calls.push(`period:${body.action}:${JSON.stringify(body)}`);
          return bundle();
        }
        calls.push(`period:${body.action}`);
        if (startFailures > 0) {
          startFailures -= 1;
          throw Object.assign(new Error('offline'), { status: 0 });
        }
        server.logs.set(body.date, fullLog(body.date, { ...(server.logs.get(body.date) || {}), flow: body.flow }));
        settle([]);
        return bundle();
      },
      removeLog: async (date) => {
        calls.push('removeLog');
        const before = server.logs.get(date);
        server.logs.delete(date);
        settle(rules.lastPeriodTouches(date, before?.flow, null));
        return bundle();
      },
      upsertLog: async (date, body) => {
        calls.push(`upsertLog:${JSON.stringify(Object.keys(body).sort())}`);
        const before = server.logs.get(date);
        const patch = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
        server.logs.set(date, fullLog(date, { ...(before || {}), ...patch }));
        settle(rules.lastPeriodTouches(date, before?.flow, body.flow));
        return { log: server.logs.get(date), bundle: bundle() };
      },
      setLastPeriod: async (date, opts) => {
        calls.push(`setLastPeriod:${date}:${opts?.timeoutMs ?? 'default'}`);
        const how = lastPeriodScript.shift() ?? 'ok';
        if (how === 'hang') {
          markHung();
          return new Promise(() => undefined);
        }
        if (how === 'refused-400') throw Object.assign(new Error('refused'), { status: 400 });
        if (how === 'down-503') throw Object.assign(new Error('down'), { status: 503 });
        server.stored = date;
        server.starts.push(bundle().profile.lastPeriodStart);
        if (how === 'applied-408') throw Object.assign(new Error('timeout'), { status: 408 });
        return how === 'null' ? null : bundle();
      },
    },
  };

  // The phone's storage: SecureStore (the queue's key) and the app's preference store survive a relaunch.
  const secure = new Map();
  const prefs = new Map();
  const launch = () => {
    const load = loader({
      'react-native': { Platform: { OS: platform } },
      'expo-secure-store': {
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
        getItemAsync: async (key) => secure.get(key) ?? null,
        setItemAsync: async (key, value) => void secure.set(key, value),
      },
      '../i18n/locale.js': { tx: (ka) => ka },
      '@/lib/api': { api, ApiError: class ApiError extends Error {} },
      '@/lib/storage': {
        getPreference: async (key) => prefs.get(key) ?? null,
        setPreferenceStrict: async (key, value) => void prefs.set(key, value),
        deletePreference: async (key) => void prefs.delete(key),
        withNativeStorageLock: (fn) => fn(),
      },
      './cycleOfflineCore': require('../src/lib/cycleOfflineCore.js'),
      './cycleOfflineCrypto': require('../src/lib/cycleOfflineCrypto.js'),
      '@/lib/queryClient': { invalidate: (scope) => invalidated.push(scope) },
      '@/lib/cycleViewCache': { putCycleView: (_userId, view) => published.push(view.display.profile.lastPeriodStart) },
    });
    return { offline: load('src/lib/cycleOffline.ts'), status: load('src/lib/cyclePeriodStatus.ts') };
  };
  const { offline, status } = launch();
  const flushPublishes = () => new Promise((resolve) => setTimeout(resolve, 0));
  /** The app was killed and opened again: a fresh JS runtime over the same device storage and server. */
  const relaunch = () => launch().offline;
  /** Resolves once a 'hang' request has started; fails (never hangs the run) if none starts within 5 s. */
  const waitHung = () => {
    let timer;
    const limit = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('the restore request never started')), 5000);
    });
    return Promise.race([hung, limit]).finally(() => clearTimeout(timer));
  };
  return { server, calls, published, invalidated, offline, status, flushPublishes, relaunch, waitHung, secure, prefs };
}

/** Runs `fn` with the clock `ms` ahead (past a queue cooldown). */
async function later(ms, fn) {
  const realNow = Date.now;
  Date.now = () => realNow() + ms;
  try {
    return await fn();
  } finally {
    Date.now = realNow;
  }
}

const queueOf = async (offline) => (await offline.loadCycleAccount(USER)).queue.map((item) => `${item.operation}:${item.payload.date}`);

test('IR-8: undo of the one-tap start never leaves her without a start, on the server or on screen', async () => {
  const { server, calls, published, offline, status, flushPublishes } = await phone();
  const shown = await offline.loadCycleView(USER);
  assert.equal(shown.display.profile.lastPeriodStart, ONBOARDING_START);

  // The tap: today is day 1, the server moves the start to today.
  const undo = status.periodStartUndo(shown.display.logs.find((l) => l.date === TODAY) ?? null, shown.display.profile.lastPeriodStart);
  const started = await offline.queueApplyPeriod(USER, { action: 'start', date: TODAY });
  assert.equal(started.synced, true);
  assert.equal(started.view.display.profile.lastPeriodStart, TODAY);
  await flushPublishes();

  // „გაუქმება“.
  server.starts.length = 0;
  published.length = 0;
  calls.length = 0;
  const current = started.view.display.logs.find((l) => l.date === TODAY);
  const result = await offline.undoQueuedPeriodStart(USER, TODAY, undo, current);
  await flushPublishes();

  assert.equal(result.synced, true);
  assert.equal(result.view.display.profile.lastPeriodStart, ONBOARDING_START);
  assert.equal(server.logs.has(TODAY), false, 'the day the tap created is gone');
  assert.equal(server.stored, ONBOARDING_START);
  // The start went back before the day did, with a short timeout.
  assert.ok(calls[0].startsWith(`setLastPeriod:${ONBOARDING_START}:`), calls.join(' '));
  assert.ok(calls.indexOf('removeLog') > 0, calls.join(' '));
  // Never „no start“ — not in any server state, not in any view she was shown.
  assert.ok(!server.starts.includes(null), `server states: ${server.starts.join(', ')}`);
  assert.ok(published.length > 0);
  assert.ok(!published.includes(null), `published starts: ${published.join(', ')}`);
  assert.equal(published[published.length - 1], ONBOARDING_START);
});

test('IR-8: cramps saved after the tap stay, and the start still never disappears', async () => {
  const { server, published, offline, status, flushPublishes } = await phone();
  const shown = await offline.loadCycleView(USER);
  const undo = status.periodStartUndo(null, shown.display.profile.lastPeriodStart);
  await offline.queueApplyPeriod(USER, { action: 'start', date: TODAY });
  // The quick log saves the whole day (cramps and a note) while the toast is still up.
  const saved = await offline.saveCycleObservation(USER, TODAY, {
    flow: 'medium',
    symptoms: ['cramps'],
    moods: [],
    sexualActivity: null,
    notes: 'დილით',
  });
  await flushPublishes();
  server.starts.length = 0;
  published.length = 0;

  const current = saved.view.display.logs.find((l) => l.date === TODAY);
  const result = await offline.undoQueuedPeriodStart(USER, TODAY, undo, current);
  await flushPublishes();

  const row = server.logs.get(TODAY);
  assert.equal(row.flow, null);
  assert.equal(JSON.stringify(row.symptoms), JSON.stringify(['cramps']));
  assert.equal(row.notes, 'დილით');
  assert.equal(server.stored, ONBOARDING_START);
  assert.equal(result.view.display.profile.lastPeriodStart, ONBOARDING_START);
  assert.ok(!server.starts.includes(null), `server states: ${server.starts.join(', ')}`);
  assert.ok(!published.includes(null), `published starts: ${published.join(', ')}`);
});

test('IR-8: while the tap is still queued (offline) the undo does not wait on the start', async () => {
  const { server, calls, published, offline, status, flushPublishes } = await phone({ failStartFlush: true });
  const shown = await offline.loadCycleView(USER);
  const undo = status.periodStartUndo(null, shown.display.profile.lastPeriodStart);
  const started = await offline.queueApplyPeriod(USER, { action: 'start', date: TODAY });
  assert.equal(started.synced, false);
  await flushPublishes();
  calls.length = 0;
  published.length = 0;

  const result = await offline.undoQueuedPeriodStart(USER, TODAY, undo, started.view.display.logs.find((l) => l.date === TODAY));
  await flushPublishes();

  assert.equal(result.synced, false);
  assert.ok(!calls.some((call) => call.startsWith('setLastPeriod')), calls.join(' '));
  // The day is restored in the queue; the screen keeps the start the cached bundle has.
  assert.equal(result.view.display.logs.some((l) => l.date === TODAY), false);
  assert.ok(!published.includes(null), `published starts: ${published.join(', ')}`);
  // IR2-5: the start is restored too, queued between the tap and the day (it used to be lost offline).
  assert.deepEqual(await queueOf(offline), [`START_PERIOD:${TODAY}`, `SET_LAST_PERIOD:${ONBOARDING_START}`, `REMOVE_LOG:${TODAY}`]);

  // Back online after the cooldown: the queue plays in that order and the start never disappears.
  server.starts.length = 0;
  calls.length = 0;
  const flushed = await later(10 * 60_000, () => offline.flushCycleQueue(USER));
  assert.equal(flushed.remaining, 0);
  assert.deepEqual(calls, ['period:start', `setLastPeriod:${ONBOARDING_START}:30000`, 'removeLog']);
  assert.ok(!server.starts.includes(null), `server states: ${server.starts.join(', ')}`);
  assert.equal(server.stored, ONBOARDING_START);
  assert.equal(server.logs.has(TODAY), false);
});

// IR2-4: her stored start was already today (onboarding said „today“), so removing today's bleeding drops
// it on the server whatever was posted before — the start can only go back after the day. When that
// write is saved but its answer carries no bundle, or the answer is lost, the day's view without the
// start used to be published as synced: /cycle showed cycle setup, Home its setup card, and Home planned
// its reminders from it and never re-planned when the refetch brought the start back.
async function undoAfterStartToday(lastPeriod) {
  const p = await phone({ onboardingStart: TODAY, lastPeriod });
  const shown = await p.offline.loadCycleView(USER);
  assert.equal(shown.display.profile.lastPeriodStart, TODAY);
  const undo = p.status.periodStartUndo(null, shown.display.profile.lastPeriodStart);
  const started = await p.offline.queueApplyPeriod(USER, { action: 'start', date: TODAY });
  assert.equal(started.synced, true);
  await p.flushPublishes();
  p.published.length = 0;
  p.invalidated.length = 0;
  const result = await p.offline.undoQueuedPeriodStart(USER, TODAY, undo, started.view.display.logs.find((l) => l.date === TODAY));
  await p.flushPublishes();
  return { ...p, result };
}

test('IR2-4: a restored start whose answer carries no bundle publishes nothing; the views refetch', async () => {
  const { server, published, invalidated, result, offline } = await undoAfterStartToday(['null', 'null']);
  assert.equal(server.stored, TODAY, 'the start is back on the server');
  assert.equal(server.logs.has(TODAY), false);
  assert.equal(result.view, null, 'nothing to show: the callers refetch (Home re-plans reminders from it)');
  assert.equal(result.synced, true, 'no false „not saved“ error');
  assert.ok(!published.includes(null), `published starts: ${published.join(', ')}`);
  assert.ok(invalidated.includes('cycle'), 'the cycle views are fetched again');
  // A refetch shows the start the server holds.
  assert.equal((await offline.loadCycleView(USER)).display.profile.lastPeriodStart, TODAY);
});

test('IR2-4: a lost answer (timeout after the server saved the start) publishes nothing; the views refetch', async () => {
  const { server, published, invalidated, result, offline, flushPublishes } = await undoAfterStartToday(['applied-408', 'applied-408']);
  assert.equal(server.stored, TODAY);
  assert.equal(result.view, null);
  assert.notEqual(cyclePersistFeedback(result), 'fail', 'no false „not saved“ error');
  assert.ok(!published.includes(null), `published starts: ${published.join(', ')}`);
  assert.ok(invalidated.includes('cycle'), 'the cycle views are fetched again');
  const after = await offline.loadCycleView(USER);
  await flushPublishes();
  assert.equal(after.canonical.profile.lastPeriodStart, TODAY);
});

test('IR2-4: only a refused restore (4xx) shows the server state without the start', async () => {
  const { server, published, result } = await undoAfterStartToday(['refused-400', 'refused-400']);
  assert.equal(server.stored, null);
  assert.ok(result.view, 'the day is back; she sets the start again in cycle settings');
  assert.equal(result.view.canonical.profile.lastPeriodStart, null);
  assert.ok(published.includes(null));
});

test('IR2-4/IR2-5: a start that was already today is queued after the day and comes back with it', async () => {
  const { server, calls, published, result, offline } = await undoAfterStartToday([]);
  assert.equal(result.synced, true);
  assert.equal(result.view.display.profile.lastPeriodStart, TODAY);
  assert.equal(server.stored, TODAY);
  assert.equal(server.logs.has(TODAY), false);
  // The day first (removing today's bleeding would drop a start written before it), then the start.
  assert.deepEqual(calls.slice(-2), ['removeLog', `setLastPeriod:${TODAY}:30000`]);
  assert.ok(!published.includes(null), `published starts: ${published.join(', ')}`);
  assert.deepEqual(await queueOf(offline), []);
});

test('IR2-4/IR2-5: a start restore that fails after the day stays queued; nothing without the start is published', async () => {
  const { server, published, result, offline } = await undoAfterStartToday(['down-503']);
  assert.equal(server.stored, null, 'the server lost it for now');
  assert.equal(result.view, null, 'the server view without the start is not published');
  assert.notEqual(cyclePersistFeedback(result), 'fail');
  assert.ok(!published.includes(null), `published starts: ${published.join(', ')}`);
  assert.deepEqual(await queueOf(offline), [`SET_LAST_PERIOD:${TODAY}`]);
  // The queue sends it again after the cooldown.
  const flushed = await later(10 * 60_000, () => offline.flushCycleQueue(USER));
  assert.equal(flushed.remaining, 0);
  assert.equal(server.stored, TODAY);
});

// IR2-5: the undo used to wait up to 10 s on its first request before anything was saved on the phone.
// On a stalled network, „გაუქმება“ and then swiping the app away lost the undo: the next launch still
// showed the period started today and kept the reminders planned for it.
test('IR2-5: the undo is on the device from the tap — an app kill on a stalled network loses neither the day nor the start', async () => {
  const p = await phone({ platform: 'ios', lastPeriod: ['hang'] });
  const shown = await p.offline.loadCycleView(USER);
  const undo = p.status.periodStartUndo(null, shown.display.profile.lastPeriodStart);
  const started = await p.offline.queueApplyPeriod(USER, { action: 'start', date: TODAY });
  assert.equal(started.synced, true);
  assert.equal(p.prefs.size, 1, 'the queue lives in the encrypted device store');
  p.calls.length = 0;
  p.server.starts.length = 0;

  // „გაუქმება“; the first request never answers, and the app is swiped away while it waits.
  void p.offline.undoQueuedPeriodStart(USER, TODAY, undo, started.view.display.logs.find((l) => l.date === TODAY));
  await p.waitHung();
  assert.ok(!p.calls.includes('removeLog'), `the day never goes before the start (IR-8): ${p.calls.join(' ')}`);

  const next = p.relaunch();
  assert.deepEqual(await queueOf(next), [`SET_LAST_PERIOD:${ONBOARDING_START}`, `REMOVE_LOG:${TODAY}`]);
  const flushed = await next.flushCycleQueue(USER);
  assert.equal(flushed.remaining, 0);
  assert.equal(p.server.stored, ONBOARDING_START);
  assert.equal(p.server.logs.has(TODAY), false, 'the day the tap created is gone');
  assert.ok(!p.server.starts.includes(null), `server states: ${p.server.starts.join(', ')}`);
  assert.deepEqual(await queueOf(next), []);
  assert.equal((await next.loadCycleView(USER)).display.profile.lastPeriodStart, ONBOARDING_START);
});

test('IR2-5: a start restore that fails is retried first; the day waits for it (never sent before the start)', async () => {
  const p = await phone({ lastPeriod: ['down-503'] });
  const shown = await p.offline.loadCycleView(USER);
  const undo = p.status.periodStartUndo(null, shown.display.profile.lastPeriodStart);
  const started = await p.offline.queueApplyPeriod(USER, { action: 'start', date: TODAY });
  await p.flushPublishes();
  p.calls.length = 0;
  p.published.length = 0;
  p.server.starts.length = 0;

  const result = await p.offline.undoQueuedPeriodStart(USER, TODAY, undo, started.view.display.logs.find((l) => l.date === TODAY));
  await p.flushPublishes();
  assert.equal(result.synced, false);
  assert.notEqual(cyclePersistFeedback(result), 'fail', 'kept on the phone: no „not saved“ error');
  assert.deepEqual(p.calls, [`setLastPeriod:${ONBOARDING_START}:30000`]);
  const account = await p.offline.loadCycleAccount(USER);
  assert.deepEqual(account.queue.map((item) => [item.operation, item.attemptCount, item.status]), [
    ['SET_LAST_PERIOD', 1, 'pending'],
    ['REMOVE_LOG', 0, 'pending'],
  ]);
  assert.ok(account.cooldownUntil > Date.now(), 'backs off like any queued write');
  // The day is shown restored (pending), with the start the phone has — never none.
  assert.equal(result.view.display.logs.some((l) => l.date === TODAY), false);
  assert.ok(!p.published.includes(null), `published starts: ${p.published.join(', ')}`);

  // Nothing is sent during the cooldown; after it the start goes first, then the day.
  await p.offline.flushCycleQueue(USER);
  assert.equal(p.calls.length, 1);
  await later(10 * 60_000, () => p.offline.flushCycleQueue(USER));
  assert.deepEqual(p.calls.slice(1), [`setLastPeriod:${ONBOARDING_START}:30000`, 'removeLog']);
  assert.equal(p.server.stored, ONBOARDING_START);
  assert.ok(!p.server.starts.includes(null), `server states: ${p.server.starts.join(', ')}`);
  assert.deepEqual(await queueOf(p.offline), []);
});

test('IR2-5: a refused start restore is set aside like any refused write; the day still goes back', async () => {
  const p = await phone({ lastPeriod: ['refused-400', 'refused-400'] });
  const shown = await p.offline.loadCycleView(USER);
  const undo = p.status.periodStartUndo(null, shown.display.profile.lastPeriodStart);
  const started = await p.offline.queueApplyPeriod(USER, { action: 'start', date: TODAY });
  const result = await p.offline.undoQueuedPeriodStart(USER, TODAY, undo, started.view.display.logs.find((l) => l.date === TODAY));
  assert.equal(result.synced, false);
  assert.deepEqual(result.view.attention.map((item) => [item.operation, item.date]), [['SET_LAST_PERIOD', ONBOARDING_START]]);
  assert.equal(result.view.syncState, 'sync_failed');
  // A refusal sets no cooldown: the next flush restores the day.
  await p.offline.flushCycleQueue(USER);
  assert.equal(p.server.logs.has(TODAY), false);
  const account = await p.offline.loadCycleAccount(USER);
  assert.deepEqual(account.queue.map((item) => [item.operation, item.status]), [['SET_LAST_PERIOD', 'failed_permanent']]);
  // She can discard it from the cycle banner, like any write the server refused.
  await p.offline.discardCycleMutation(USER, account.queue[0].id);
  assert.deepEqual(await queueOf(p.offline), []);
});

test('IR2-5: writes queued by older app JS still play exactly as before', async () => {
  const p = await phone({ platform: 'ios' });
  const core = require('../src/lib/cycleOfflineCore.js');
  const crypto = require('../src/lib/cycleOfflineCrypto.js');
  // The encrypted queue as an older build left it on the phone (same store schema, same item shape).
  const legacy = (operation, payload, n) => ({
    id: `legacy-${n}`,
    userScope: USER,
    operation,
    date: payload.date || payload.start || null,
    payload,
    createdAt: '2026-10-08T10:00:00.000Z',
    attemptCount: 0,
    status: 'pending',
  });
  const queue = [
    legacy('UPSERT_LOG', { date: '2026-10-01', flow: 'none', notes: 'note' }, 1),
    legacy('START_PERIOD', { date: TODAY, flow: 'heavy' }, 2),
    legacy('END_PERIOD', { date: TODAY }, 3),
    legacy('FILL_PERIOD', { start: '2026-09-20', end: '2026-09-22', flow: 'light' }, 4),
    legacy('REMOVE_LOG', { date: '2026-10-01' }, 5),
  ];
  const dek = crypto.generateDekBytes();
  p.secure.set(core.CYCLE_OFFLINE_DEK_KEY, crypto.bytesToB64(dek));
  const root = core.writeAccount(core.emptyStore(), USER, { ...core.emptyAccount(USER), queue });
  p.prefs.set(core.CYCLE_OFFLINE_STORAGE_KEY, await crypto.encryptStore(root, dek));

  const next = p.relaunch();
  const flushed = await next.flushCycleQueue(USER);
  assert.equal(flushed.flushed, 5);
  assert.deepEqual(p.calls, [
    'upsertLog:["flow","notes"]',
    'period:start',
    `period:end:${JSON.stringify({ action: 'end', date: TODAY })}`,
    `period:fill:${JSON.stringify({ action: 'fill', start: '2026-09-20', end: '2026-09-22', flow: 'light' })}`,
    'removeLog',
  ]);
  assert.deepEqual(await queueOf(next), []);
});

test('IR2-5: a build that cannot play the start restore sends nothing that writes', async () => {
  // Older JS sends an operation it does not know through its last branch, „fill“ with `start` and `end`
  // from the payload. The restore carries only `date`, so that request is `start: ''`, which the server
  // refuses (400) — kept as a refused write, never a filled period.
  const core = require('../src/lib/cycleOfflineCore.js');
  const item = core.createMutation(USER, 'SET_LAST_PERIOD', { date: ONBOARDING_START });
  assert.deepEqual(Object.keys(item.payload), ['date']);
  const { assertCycleDateKey } = await import(pathToFileURL(join(__dirname, '../../server/src/lib/cyclePeriod.js')).href);
  assert.throws(() => assertCycleDateKey(String(item.payload.start || ''), TODAY), (err) => err.status === 400);
  assert.equal(core.classifyCycleFailure({ status: 400 }), 'permanent');
});
