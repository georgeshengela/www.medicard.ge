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
 *   'applied-408' saves, then the answer is lost (timeout) · 'refused-400' saves nothing.
 */
async function phone({ failStartFlush = false, onboardingStart = ONBOARDING_START, lastPeriod = [] } = {}) {
  const rules = await import(pathToFileURL(join(__dirname, '../../server/src/lib/cycle.js')).href);
  const server = { stored: onboardingStart, logs: new Map(), starts: [] };
  const calls = [];
  const published = [];
  const invalidated = [];
  const lastPeriodScript = [...lastPeriod];

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
        if (how === 'refused-400') throw Object.assign(new Error('refused'), { status: 400 });
        server.stored = date;
        server.starts.push(bundle().profile.lastPeriodStart);
        if (how === 'applied-408') throw Object.assign(new Error('timeout'), { status: 408 });
        return how === 'null' ? null : bundle();
      },
    },
  };

  const load = loader({
    'react-native': { Platform: { OS: 'web' } },
    'expo-secure-store': {},
    '../i18n/locale.js': { tx: (ka) => ka },
    '@/lib/api': { api, ApiError: class ApiError extends Error {} },
    '@/lib/storage': {
      getPreference: async () => null,
      setPreferenceStrict: async () => undefined,
      deletePreference: async () => undefined,
      withNativeStorageLock: (fn) => fn(),
    },
    './cycleOfflineCore': require('../src/lib/cycleOfflineCore.js'),
    './cycleOfflineCrypto': require('../src/lib/cycleOfflineCrypto.js'),
    '@/lib/queryClient': { invalidate: (scope) => invalidated.push(scope) },
    '@/lib/cycleViewCache': { putCycleView: (_userId, view) => published.push(view.display.profile.lastPeriodStart) },
  });
  const offline = load('src/lib/cycleOffline.ts');
  const status = load('src/lib/cyclePeriodStatus.ts');
  const flushPublishes = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { server, calls, published, invalidated, offline, status, flushPublishes };
}

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
  const { calls, published, offline, status, flushPublishes } = await phone({ failStartFlush: true });
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
