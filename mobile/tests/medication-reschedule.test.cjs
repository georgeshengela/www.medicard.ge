const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const loader = require('./helpers/loadTs.cjs');

// She opens the 09:00 dose and taps „გადატანა“ → 14:00 because she has not taken it yet. The old code
// saved {time:'14:00', status:'taken'} and sent a „taken“ dose event: an orphan taken dose at 14:00
// (or a real 14:00 dose marked taken), the 09:00 dose still open and late, and no reminder at 14:00.
// Now the dose stays open on its own slot with `rescheduledTo`, a one-off reminder fires at 14:00 and
// its „მივიღე ✓“ marks the 09:00 dose; Home counts it due at 14:00, not late since 09:00.
const root = join(__dirname, '..');

function phone() {
  const prefs = new Map();
  let accountId = 'u1';
  const events = [];
  const scheduled = [];
  const cancelled = [];
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
  const expoNotifications = {
    Notifications: {
      DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
      cancelScheduledNotificationAsync: async (id) => {
        cancelled.push(id);
      },
    },
  };
  const load = loader({
    '@/lib/localAccount': localAccount,
    '@/lib/sessionSnapshot': { loadSessionSnapshot: async () => null },
    '@/lib/storage': {
      getToken: async () => null,
      getPreference: async (key) => prefs.get(key) ?? null,
      setPreference: async (key, value) => {
        prefs.set(key, value);
      },
      deletePreference: async (key) => {
        prefs.delete(key);
      },
    },
    '@/lib/jwtSubject': { jwtSubject: () => null },
    '@/lib/accountSync': { scheduleAccountSyncPush: () => {} },
    '@/lib/mediNotificationBrain': { requestEngageRefresh: () => {} },
    '@/lib/productObservability': {
      syncDoseEvent: async (event) => events.push(event),
      syncNotificationOutcome: async () => {},
      syncInsightOutcome: async () => {},
    },
    '@/lib/expoNotifications': expoNotifications,
    '@/lib/notifications': {
      scheduleMovedDoseReminder: async (dose, date, to) => {
        scheduled.push({ medicationId: dose.medicationId, time: dose.time, date, to });
        return true;
      },
    },
    'react-native': { Platform: { OS: 'ios' } },
    '@/lib/hydration': { addHydrationLog: async () => [], todayYmd: () => '2000-01-01' },
    '@/lib/mediEngagePrefs': { markEngageOpened: async () => {} },
    '@/types/hydration': { HYDRATION_DROP_ML: 250 },
    '@/lib/queryClient': { invalidate: async () => {} },
  });
  return {
    load,
    prefs,
    events,
    scheduled,
    cancelled,
    /** null: no account can be read (a lock-screen tap before the phone was unlocked after a restart). */
    setAccount: (id) => localAccount.setLocalAccountId(id),
    logs: () => JSON.parse(prefs.get('medicard.meds.doseLogs.u1') || '[]'),
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const DOSE = { medicationId: 'med-1', medName: 'Aspirin', dosage: '1', notes: null, time: '09:00' };

test('„გადატანა“ keeps the dose open on its own slot and marks nothing taken', async () => {
  const p = phone();
  const { moveDose } = p.load('src/lib/doseReschedule.ts');
  const entry = await moveDose(DOSE, '2026-10-08', '14:00');
  await flush();

  assert.equal(entry.status, 'pending');
  const logs = p.logs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].medicationId, 'med-1');
  assert.equal(logs[0].date, '2026-10-08');
  assert.equal(logs[0].time, '09:00', 'the dose keeps its own slot');
  assert.equal(logs[0].status, 'pending');
  assert.equal(logs[0].rescheduledTo, '14:00');
  assert.ok(!logs.some((row) => row.status === 'taken'), 'nothing is marked taken');
  assert.equal(p.events.length, 0, 'no „taken“ dose event goes to the server');
  assert.equal(p.scheduled.length, 1);
  assert.equal(JSON.stringify(p.scheduled[0]), JSON.stringify({ medicationId: 'med-1', time: '09:00', date: '2026-10-08', to: '14:00' }));
});

test('moving it again replaces the moved time; picking its own time moves it back and clears the moved reminder', async () => {
  const p = phone();
  const { moveDose } = p.load('src/lib/doseReschedule.ts');
  await moveDose(DOSE, '2026-10-08', '14:00');
  await moveDose(DOSE, '2026-10-08', '16:00');
  await flush();
  assert.equal(p.logs().length, 1);
  assert.equal(p.logs()[0].rescheduledTo, '16:00');
  assert.equal(p.scheduled.length, 2);

  await moveDose(DOSE, '2026-10-08', '09:00');
  await flush();
  const logs = p.logs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'pending');
  assert.equal(logs[0].rescheduledTo, undefined);
  assert.equal(p.scheduled.length, 2, 'no reminder for the dose’s own time (its daily one remains)');
  assert.ok(p.cancelled.includes('med:med-1:moved:2026-10-08:09:00'));
  assert.equal(p.events.length, 0);
});

test('the moved reminder’s „მივიღე ✓“ marks the 09:00 dose of that day, and answering clears the moved reminder', async () => {
  const p = phone();
  const { moveDose } = p.load('src/lib/doseReschedule.ts');
  const actions = p.load('src/lib/mediNotificationActions.ts');
  await moveDose(DOSE, '2026-10-08', '14:00');
  const delivered = new Date(2026, 9, 8, 14, 0).getTime() / 1000;
  const result = await actions.handleNotificationAction({
    actionIdentifier: 'TAKE',
    notification: {
      date: delivered,
      request: {
        identifier: 'med:med-1:moved:2026-10-08:09:00',
        content: { data: { type: 'medication', medicationId: 'med-1', time: '09:00', date: '2026-10-08' } },
      },
    },
  });
  await flush();
  assert.equal(result.navigate, false);
  const logs = p.logs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].time, '09:00');
  assert.equal(logs[0].date, '2026-10-08');
  assert.equal(logs[0].status, 'taken');
  assert.equal(logs[0].rescheduledTo, undefined);
  assert.equal(p.events.length, 1);
  assert.equal(p.events[0].time, '09:00');
  assert.ok(p.cancelled.includes('med:med-1:moved:2026-10-08:09:00'));
});

// The 09:00 dose moved to 14:00; the phone restarts and is still locked when the 09:00 daily reminder
// arrives, and she taps its „მივიღე ✓“. No session can be read, so the mark waits in the device queue
// — and the old code left the 14:00 one-off scheduled: it rang in the background for a dose she took.
test('a queued „მივიღე ✓“ (no readable session) cancels the moved reminder right away', async () => {
  const p = phone();
  const { moveDose } = p.load('src/lib/doseReschedule.ts');
  const actions = p.load('src/lib/mediNotificationActions.ts');
  const { loadDoseLogs } = p.load('src/lib/medications.shared.ts');
  await moveDose(DOSE, '2026-10-08', '14:00');
  await flush();
  assert.equal(p.cancelled.length, 0);

  p.setAccount(null);
  await actions.handleNotificationAction({
    actionIdentifier: 'TAKE',
    notification: {
      date: new Date(2026, 9, 8, 9, 0).getTime() / 1000,
      request: {
        identifier: 'med:med-1:daily:09:00',
        content: { data: { type: 'medication', medicationId: 'med-1', time: '09:00', owner: 'u1' } },
      },
    },
  });
  await flush();
  assert.ok(p.prefs.get('medicard.meds.pendingDoseLogs'), 'the mark waits on the device');
  assert.ok(p.cancelled.includes('med:med-1:moved:2026-10-08:09:00'), 'the 14:00 reminder will not ring');

  // Her session is readable again: the dose is taken and no longer moved.
  p.setAccount('u1');
  const logs = await loadDoseLogs();
  await flush();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'taken');
  assert.equal(logs[0].rescheduledTo, undefined);
  assert.equal(p.events.length, 1);
});

test('Home’s undo after taking a moved dose puts it back at its moved time with its reminder', async () => {
  const p = phone();
  const { moveDose, reopenDose } = p.load('src/lib/doseReschedule.ts');
  const { saveDoseLog } = p.load('src/lib/medications.shared.ts');
  await moveDose(DOSE, '2026-10-08', '14:00');
  // „მივიღე“ on the Home card: the dose is taken and its moved reminder is cancelled.
  await saveDoseLog({ medicationId: 'med-1', date: '2026-10-08', time: '09:00', status: 'taken', updatedAt: 'x' });
  await flush();
  assert.ok(p.cancelled.includes('med:med-1:moved:2026-10-08:09:00'));
  assert.equal(p.scheduled.length, 1);

  // The undo: open again, still moved to 14:00, and the 14:00 reminder is scheduled again.
  const entry = await reopenDose({ ...DOSE, dueTime: '14:00' }, '2026-10-08');
  await flush();
  assert.equal(entry.status, 'pending');
  assert.equal(entry.rescheduledTo, '14:00');
  const logs = p.logs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].time, '09:00');
  assert.equal(logs[0].status, 'pending');
  assert.equal(logs[0].rescheduledTo, '14:00');
  assert.equal(p.scheduled.length, 2);
  assert.equal(JSON.stringify(p.scheduled[1]), JSON.stringify({ medicationId: 'med-1', time: '09:00', date: '2026-10-08', to: '14:00' }));
});

test('Home’s undo of a dose that was not moved is a plain „pending“ with no extra reminder', async () => {
  const p = phone();
  const { reopenDose } = p.load('src/lib/doseReschedule.ts');
  const entry = await reopenDose({ ...DOSE, dueTime: '09:00' }, '2026-10-08');
  await flush();
  assert.equal(entry.status, 'pending');
  assert.equal(entry.rescheduledTo, undefined);
  assert.equal(p.logs()[0].rescheduledTo, undefined);
  assert.equal(p.scheduled.length, 0);
  assert.equal(p.events.length, 0);
  const home = readFileSync(join(root, 'src/components/home/HomeNextDoseSection.tsx'), 'utf8');
  assert.match(home, /keep\(await reopenDose\(dose, today\)\)/, 'the Home undo goes through reopenDose');
});

test('a taken dose is not offered „გადატანა“ on the dose screen (it would open it again)', () => {
  const screen = readFileSync(join(root, 'src/components/medications/MedicationDoseScreen.tsx'), 'utf8');
  assert.match(screen, /\{log\?\.status === 'taken' \? null : \(\s*<DoseAction label=\{ka\.meds\.actionReschedule\}/);
});

test('a moved dose tapped open goes to its own slot and day', async () => {
  const p = phone();
  const actions = p.load('src/lib/mediNotificationActions.ts');
  const result = await actions.handleNotificationAction({
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: new Date(2026, 9, 9, 0, 30).getTime() / 1000,
      request: { identifier: 'x', content: { data: { type: 'medication', medicationId: 'med-1', time: '09:00', date: '2026-10-08' } } },
    },
  });
  assert.equal(result.route, '/medications/med-1?time=09:00&date=2026-10-08');
});

test('moved reminders are planned from the dose logs, only for open doses still in the schedule', () => {
  const p = phone();
  const plan = p.load('src/lib/notificationPlan.ts');
  const now = new Date(2026, 9, 8, 10, 0);
  const row = (over) => ({ medicationId: 'med-1', date: '2026-10-08', time: '09:00', status: 'pending', rescheduledTo: '14:00', updatedAt: 'x', ...over });
  const hasSlot = (id, time) => id === 'med-1' && (time === '09:00' || time === '20:00');
  const planned = plan.planMovedDoseReminders(
    [
      row({}),
      row({ time: '20:00', rescheduledTo: '22:00' }),
      row({ status: 'taken' }),
      row({ rescheduledTo: undefined }),
      row({ rescheduledTo: '08:00', date: '2026-10-08', time: '20:00' }),
      row({ medicationId: 'gone' }),
      row({ date: '2026-10-07' }),
      row({ rescheduledTo: '25:00' }),
    ],
    hasSlot,
    now,
  );
  assert.equal(
    JSON.stringify(planned.map((item) => [item.identifier, item.time, item.date, item.at.getHours()])),
    JSON.stringify([
      ['med:med-1:moved:2026-10-08:09:00', '09:00', '2026-10-08', 14],
      ['med:med-1:moved:2026-10-08:20:00', '20:00', '2026-10-08', 22],
    ]),
  );
  assert.ok(planned[0].identifier.startsWith(plan.medicationReminderPrefix('med-1')), 'deleting the medication clears it too');
});

test('Home counts a moved dose due at its new time, not late since its old one', () => {
  const p = phone();
  const { computeTodayDoses } = p.load('src/lib/home/todayDoses.ts');
  const meds = [{ id: 'med-1', medName: 'A', dosage: '1', frequency: '09:00, 12:00', notes: null, active: true, createdAt: '2026-01-01' }];
  const schedule = [
    { medicationId: 'med-1', medName: 'A', dosage: '1', notes: null, time: '09:00' },
    { medicationId: 'med-1', medName: 'A', dosage: '1', notes: null, time: '12:00' },
  ];
  const logs = [{ medicationId: 'med-1', date: '2026-10-08', time: '09:00', status: 'pending', rescheduledTo: '14:00', updatedAt: 'x' }];
  const view = computeTodayDoses(meds, schedule, logs, '2026-10-08', new Date(2026, 9, 8, 10, 0));
  assert.equal(JSON.stringify(view.pending.map((d) => [d.time, d.dueTime])), JSON.stringify([['12:00', '12:00'], ['09:00', '14:00']]));
  assert.equal(view.taken, 0, 'moving is not taking');

  const undone = computeTodayDoses(meds, schedule, [{ ...logs[0], rescheduledTo: undefined }], '2026-10-08', new Date(2026, 9, 8, 10, 0));
  assert.equal(JSON.stringify(undone.pending.map((d) => [d.time, d.dueTime])), JSON.stringify([['09:00', '09:00'], ['12:00', '12:00']]));
});

test('the web /app shows a moved dose as upcoming, then due at its new time — not missed since 09:00', () => {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseDate = (v) => {
    if (v instanceof Date) return v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(v);
  };
  const load = loader({
    '../ui.js': new Proxy({ ymd: (d = new Date()) => iso(parseDate(d)), parseDate, KA_DAYS_SHORT: [] }, { get: (t, k) => (k in t ? t[k] : () => null) }),
    '../api.js': { get: async () => null, put: async () => null, post: async () => null, patch: async () => null, del: async () => null, ApiError: Error },
    '../charts.js': { ring: () => null, barChart: () => null, heatmap: () => null },
    '../aiConsent.js': { withAiConsent: async () => null, aiDeclinedSlot: () => null },
    '../i18n.js': { t: (ka) => ka, isEn: false },
    '../brand.js': { wordmark: () => null },
  });
  const page = load('../server/public/app/js/pages/medications.js');
  const med = { id: 'med-1', medName: 'A', dosage: '1', frequency: '09:00', active: true, config: {}, createdAt: '2026-01-01' };
  const bundle = () => ({
    medications: [med],
    logs: [{ medicationId: 'med-1', date: '2026-10-08', time: '09:00', status: 'pending', rescheduledTo: '14:00', updatedAt: '2026-10-08T06:00:00.000Z' }],
  });
  const at = (h, m = 0) => page.dosesForDate(bundle(), '2026-10-08', new Date(2026, 9, 8, h, m))[0];
  assert.equal(at(11).status, 'upcoming');
  assert.equal(at(11).movedTo, '14:00');
  assert.equal(at(14, 20).status, 'due');
  assert.equal(at(16).status, 'missed', 'still not taken an hour after the new time');
});

test('both reschedule sheets move the dose; neither marks it taken', () => {
  const screen = readFileSync(join(root, 'src/components/medications/MedicationDoseScreen.tsx'), 'utf8');
  assert.match(screen, /onPick=\{\(option\) => void reschedule\(option\)\}/);
  assert.doesNotMatch(screen, /markDose\('taken', option\)/);
  const list = readFileSync(join(root, 'app/medications/reminders/index.tsx'), 'utf8');
  assert.match(list, /void moveTo\(reschedule, time\);/);
  assert.doesNotMatch(list, /'taken', time\)/);
});

test('every medication reminder sync puts the moved reminders back after its cancel-and-rewrite', () => {
  const source = readFileSync(join(root, 'src/lib/notifications.ts'), 'utf8');
  const sync = source.slice(source.indexOf('export async function syncMedicationReminders'));
  const body = sync.slice(0, sync.indexOf('\nexport '));
  const cancelAt = body.indexOf('cancelNotificationsByPrefix(NOTIF_PREFIX.med)');
  const readAt = body.indexOf('planMovedDoseReminders(await loadDoseLogs()');
  assert.ok(cancelAt > 0 && readAt > cancelAt, 'the dose logs are read after the cancel');
  assert.match(body, /scheduleMovedDose\(dose, item, expectedOwner\)/);
});
