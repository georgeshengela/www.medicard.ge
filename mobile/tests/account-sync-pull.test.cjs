const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// pullAccountState right after a cold start: a dose marked while GET /api/account/app-state is in
// flight (a notification's „მივიღე ✓“, a tap on Home) must survive the merge, and an answer for one
// account must never be written into another that signed in meanwhile. Runs the real accountSync.ts
// with storage and the API replaced by an in-memory device.
const FILE = path.resolve(__dirname, '../src/lib/accountSync.ts');
const notificationDose = require('./helpers/loadTs.cjs')({})('src/lib/notificationDose.ts');

function load(modules) {
  const source = ts.transpileModule(fs.readFileSync(FILE, 'utf8'), {
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
        return modules[name];
      },
      console,
      Date,
      JSON,
      Promise,
      setTimeout,
      clearTimeout,
    },
    { filename: FILE },
  );
  return module.exports;
}

const dose = (medicationId, date, updatedAt) => ({ medicationId, date, time: '08:00', status: 'taken', updatedAt });

function device(accountId) {
  const prefs = new Map();
  let account = accountId;
  let answer;
  const remote = new Promise((resolve) => {
    answer = resolve;
  });
  const puts = [];
  const cancelled = [];
  const sync = load({
    '@/lib/labMerge': { mergeLabPanelLists: (a, b) => [...a, ...b] },
    '@/lib/labStore': { loadCanonicalLabPanels: async () => [], replaceLabPanels: async () => {} },
    '@/lib/medications.shared': {
      loadDoseLogs: async () => JSON.parse(prefs.get(`medicard.meds.doseLogs.${account}`) || '[]'),
      cancelMovedDoseReminder: (row) => cancelled.push(`med:${row.medicationId}:moved:${row.date}:${row.time}`),
    },
    '@/lib/notificationDose': notificationDose,
    '@/lib/localAccount': {
      localAccountId: () => account,
      setScopedPreference: async (base, value) => {
        if (account) prefs.set(`${base}.${account}`, value);
      },
    },
    '@/lib/api': {
      api: { account: { getAppState: () => remote, putAppState: async (state) => puts.push(state) } },
      assistantRequest: async () => ({}),
    },
    '@/lib/run/history': { loadRunHistory: async () => [] },
    '@/lib/stepsGoal': { loadStepsGoal: async () => null },
    '@/lib/stepsGoalHistory': { loadReachedStepsGoals: async () => [] },
    '@/lib/symptomResultStorage': { loadSymptomHistory: async () => [] },
    '@/lib/weightGoal': { loadWeightGoal: async () => null, loadWeightLogs: async () => [] },
    '@/lib/storage': { setPreference: async (key, value) => prefs.set(key, value) },
  });
  return {
    sync,
    prefs,
    puts,
    cancelled,
    answer: (state) => answer({ state }),
    switchTo: (id) => {
      account = id;
    },
    logsOf: (id) => JSON.parse(prefs.get(`medicard.meds.doseLogs.${id}`) || '[]'),
    setLogs: (id, rows) => prefs.set(`medicard.meds.doseLogs.${id}`, JSON.stringify(rows)),
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('a dose marked while the account pull is in flight is merged, not overwritten', async () => {
  const phone = device('u1');
  const yesterday = dose('med-1', '2026-10-07', '2026-10-07T04:00:00.000Z');
  phone.setLogs('u1', [yesterday]);

  const pulling = phone.sync.pullAccountState();
  await flush();
  // The tap lands while GET /api/account/app-state is still on its way.
  const today = dose('med-1', '2026-10-08', '2026-10-08T04:00:00.000Z');
  phone.setLogs('u1', [yesterday, today]);
  phone.answer({ doseLogs: [yesterday], updatedAt: '2026-10-07T05:00:00.000Z' });
  await pulling;

  assert.deepEqual(phone.logsOf('u1').map((row) => row.date).sort(), ['2026-10-07', '2026-10-08']);
  assert.ok(phone.puts.at(-1).doseLogs.some((row) => row.date === '2026-10-08'), 'the server copy gets it too');
});

test('an answer for one account is never written into another that signed in meanwhile', async () => {
  const phone = device('u1');
  phone.setLogs('u1', [dose('med-a', '2026-10-07', '2026-10-07T04:00:00.000Z')]);
  phone.setLogs('u2', [dose('med-b', '2026-10-07', '2026-10-07T04:00:00.000Z')]);

  const pulling = phone.sync.pullAccountState();
  await flush();
  phone.switchTo('u2');
  phone.answer({ doseLogs: [dose('med-a', '2026-10-06', '2026-10-06T04:00:00.000Z')], updatedAt: '2026-10-07T05:00:00.000Z' });
  await pulling;

  assert.deepEqual(phone.logsOf('u2').map((row) => row.medicationId), ['med-b']);
  assert.equal(phone.puts.length, 0, 'nothing is pushed for the wrong account');
});

// The 09:00 dose was moved to 14:00 on the phone and then marked taken on the web. Opening Records pulls
// the account: the taken row wins the merge, and the old code left the 14:00 one-off scheduled — it
// rang in the background for a dose already taken.
test('a moved dose answered on another device loses its moved reminder after the pull', async () => {
  const phone = device('u1');
  const moved = { medicationId: 'med-1', date: '2026-10-08', time: '09:00', status: 'pending', rescheduledTo: '14:00', updatedAt: '2026-10-08T05:00:00.000Z' };
  const stillMoved = { ...moved, medicationId: 'med-2' };
  phone.setLogs('u1', [moved, stillMoved]);

  const pulling = phone.sync.pullAccountState();
  await flush();
  phone.answer({
    doseLogs: [{ medicationId: 'med-1', date: '2026-10-08', time: '09:00', status: 'taken', updatedAt: '2026-10-08T07:00:00.000Z' }],
    updatedAt: '2026-10-08T07:00:00.000Z',
  });
  await pulling;

  assert.equal(phone.logsOf('u1').find((row) => row.medicationId === 'med-1').status, 'taken');
  assert.deepEqual(phone.cancelled, ['med:med-1:moved:2026-10-08:09:00'], 'only the answered dose loses its moved reminder');
});
