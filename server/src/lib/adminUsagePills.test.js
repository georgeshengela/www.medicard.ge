import test from 'node:test';
import assert from 'node:assert/strict';
import { adherenceFor, buildPillsUsage, scheduleTimes, slotsOn } from './adminUsagePills.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi, a Sunday
const at = (s) => new Date(s);
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** A mark made `lagMin` minutes after its slot (Tbilisi = UTC+4). */
const mark = (userId, medicationId, date, time, status = 'taken', lagMin = 5, source = 'app') => ({
  userId, medicationId, date, time, status, source,
  occurredAt: new Date(new Date(`${date}T${time}:00+04:00`).getTime() + lagMin * 60_000),
});

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 11,
    people: [
      { id: 'team', fullName: 'Demo', email: 'demo@medicard.ge', phone: null, createdAt: at('2026-03-24T08:00:00Z'), lastSeenAt: at('2026-10-11T08:00:00Z') },
      { id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null, createdAt: at('2026-10-07T02:00:00Z'), lastSeenAt: at('2026-10-11T08:00:00Z') },
      { id: 'u2', fullName: 'Giorgi', email: 'x@apple.medicard.ge', phone: null, createdAt: at('2026-09-01T08:00:00Z'), lastSeenAt: null },
      { id: 'u3', fullName: 'Ana', email: 'ana@example.com', phone: null, createdAt: at('2026-10-05T03:00:00Z'), lastSeenAt: at('2026-10-06T10:00:00Z') },
    ],
    medications: [
      { id: 'mt', userId: 'team', active: true, createdAt: at('2026-10-01T05:00:00Z'), times: ['09:00'], form: 'pills', frequencyKind: 'daily', daysOfWeek: ALL_DAYS, startDate: '2026-10-01', endDate: '2026-12-31', mealTiming: null, linked: true, name: 'Aspirin', nameKey: 'aspirin' },
      // 07:00 Tbilisi on 7 Oct: both of that day's slots are due.
      { id: 'm1', userId: 'u1', active: true, createdAt: at('2026-10-07T03:00:00Z'), times: ['08:00', '20:00'], form: 'pills', frequencyKind: 'daily', daysOfWeek: ALL_DAYS, startDate: '2026-10-07', endDate: '2027-10-07', mealTiming: 'after', linked: true, name: 'Aspirin', nameKey: 'aspirin' },
      { id: 'm4', userId: 'u1', active: true, createdAt: at('2026-10-07T03:05:00Z'), times: ['12:00'], form: null, frequencyKind: 'as_needed', daysOfWeek: [], startDate: null, endDate: null, mealTiming: null, linked: false, name: 'Rare', nameKey: 'rare' },
      { id: 'm2', userId: 'u2', active: false, createdAt: at('2026-10-01T06:00:00Z'), times: ['10:00'], form: 'pills', frequencyKind: 'daily', daysOfWeek: ALL_DAYS, startDate: '2026-10-01', endDate: '2026-11-01', mealTiming: null, linked: false, name: 'aspirin ', nameKey: 'aspirin' },
      // Mondays only; added 08:00 Tbilisi on Monday 5 Oct, so that 09:00 is its one due dose so far.
      { id: 'm3', userId: 'u3', active: true, createdAt: at('2026-10-05T04:00:00Z'), times: ['09:00'], form: 'capsules', frequencyKind: 'daily', daysOfWeek: [0], startDate: '2026-10-01', endDate: '2026-10-31', mealTiming: null, linked: false, name: 'ASPIRIN', nameKey: 'aspirin' },
    ],
    marks: [
      mark('team', 'mt', '2026-10-10', '09:00', 'taken', 2, 'notification'),
      mark('u1', 'm1', '2026-10-07', '08:00', 'taken', -30),
      mark('u1', 'm1', '2026-10-07', '20:00'),
      mark('u1', 'm1', '2026-10-08', '08:00'),
      mark('u1', 'm1', '2026-10-08', '20:00', 'skipped', 270),
      mark('u1', 'm1', '2026-10-09', '08:00'),
      mark('u1', 'm1', '2026-10-09', '20:00'),
      mark('u1', 'm1', '2026-10-10', '08:00'),
      mark('u1', 'm1', '2026-10-10', '20:00'),
      mark('u1', 'm1', '2026-10-11', '08:00'),
      // Marked ahead of time: a mark, but not a due dose yet.
      mark('u1', 'm1', '2026-10-11', '20:00', 'taken', -450),
      // A medicine u2 deleted: the marks stay, adherence cannot use them.
      mark('u2', 'gone', '2026-10-02', '10:00'),
      mark('u2', 'gone', '2026-10-03', '10:00'),
      mark('u2', 'gone', '2026-10-04', '10:00'),
      // Filled in the next day.
      mark('u3', 'm3', '2026-10-05', '09:00', 'taken', 29 * 60),
    ],
    alerts: [
      { userId: 'team', state: 'SENT', createdAt: at('2026-10-06T08:00:00Z') },
      { userId: 'u1', state: 'SENT', createdAt: at('2026-10-09T08:00:00Z') },
      { userId: 'u1', state: 'SKIPPED', createdAt: at('2026-10-09T09:00:00Z') },
    ],
    alertOpens: [{ userId: 'u1', createdAt: at('2026-10-09T08:10:00Z') }],
    alertsOff: [],
    reviews: [{ userId: 'u1', status: 'OK', createdAt: at('2026-10-09T09:00:00Z') }],
    catalogProducts: 6700,
    permissions: [
      { userId: 'u1', status: 'enabled', platform: 'ios' },
      { userId: 'u2', status: 'disabled', platform: 'android' },
      { userId: 'team', status: 'enabled', platform: 'ios' },
    ],
    signups: [
      { id: 'u1', createdAt: at('2026-10-07T02:00:00Z') },
      { id: 'u3', createdAt: at('2026-10-05T03:00:00Z') },
      { id: 'u9', createdAt: at('2026-10-08T08:00:00Z') },
    ],
    appActivity: [
      { userId: 'u1', date: '2026-10-07' },
      { userId: 'u1', date: '2026-10-09' },
      { userId: 'u2', date: '2026-10-01' },
      { userId: 'u3', date: '2026-10-05' },
    ],
    orphanMarks: { marks: 71, accounts: 3 },
    flags: [{ key: 'medications', enabled: true, effective: true }, { key: 'pharmacy', enabled: false, effective: false }],
  };
}

const ladderOf = (d) => Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));

test('schedule times and course days follow the app (Monday = 0, empty weekdays = every day)', () => {
  assert.deepEqual(scheduleTimes('21:00, 09:00,09:00, 25:00'), ['09:00', '21:00']);
  const med = { times: ['09:00'], daysOfWeek: [0], startDate: '2026-10-01', endDate: '2026-10-31' };
  assert.deepEqual(slotsOn(med, '2026-10-05'), ['09:00']); // Monday
  assert.deepEqual(slotsOn(med, '2026-10-06'), []);
  assert.deepEqual(slotsOn({ ...med, daysOfWeek: [] }, '2026-10-06'), ['09:00']);
  assert.deepEqual(slotsOn(med, '2026-11-02'), []); // after the course
  assert.deepEqual(slotsOn({ ...med, frequencyKind: 'as_needed' }, '2026-10-05'), []);
});

test('adherence: due from the moment it was added, two hours of grace today, older times fill open slots', () => {
  const med = { id: 'a', active: true, createdAt: at('2026-10-09T10:00:00Z'), times: ['08:00', '20:00'], daysOfWeek: [], startDate: null, endDate: null };
  const now = at('2026-10-10T12:00:00Z'); // 16:00 Tbilisi: today's 08:00 is due, 20:00 is not
  const marks = [
    { medicationId: 'a', date: '2026-10-09', time: '08:00', status: 'taken' }, // before it was added — ignored
    { medicationId: 'a', date: '2026-10-09', time: '20:00', status: 'skipped' },
    { medicationId: 'a', date: '2026-10-10', time: '09:00', status: 'taken' }, // a time the schedule no longer has
    { medicationId: 'a', date: '2026-10-10', time: '20:00', status: 'taken' }, // ahead of time — not due yet
  ];
  const a = adherenceFor([med], marks, ['2026-10-09', '2026-10-10'], now);
  assert.deepEqual(a, { due: 2, taken: 1, skipped: 1, missed: 0, rate: 50 });
  const none = adherenceFor([{ ...med, active: false }], marks, ['2026-10-09', '2026-10-10'], now);
  assert.equal(none.due, 0);
  assert.equal(none.rate, null);
  const missed = adherenceFor([med], [], ['2026-10-09', '2026-10-10'], now);
  assert.deepEqual(missed, { due: 2, taken: 0, skipped: 0, missed: 2, rate: 0 });
});

test('team accounts are left out by default: totals, ladder, list', () => {
  const d = buildPillsUsage(fixture(), { days: 30, now: NOW });
  assert.equal(d.totals.accounts, 10);
  assert.equal(d.totals.people, 3);
  assert.equal(d.totals.peopleActive, 2);
  assert.equal(d.totals.medications, 4);
  assert.equal(d.totals.medicationsActive, 3);
  assert.equal(d.totals.medicationsPaused, 1);
  assert.equal(d.totals.marks, 14);
  assert.equal(d.totals.taken, 13);
  assert.equal(d.totals.skipped, 1);
  assert.equal(d.totals.neverMarked, 0);
  assert.deepEqual(d.team, { accounts: 1, people: 1, medications: 1, marks: 1 });
  assert.equal(d.items.some((it) => it.person.team), false);
  assert.equal(d.itemsTotal, 3);
  assert.equal(d.marks.sources.notification, 0);
  assert.equal(d.flags.pharmacy.effective, false);
  assert.equal(d.flags.medications.effective, true);

  const t = buildPillsUsage(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(t.totals.accounts, 11);
  assert.equal(t.totals.people, 4);
  assert.equal(t.marks.sources.notification, 1);
  assert.equal(t.items.find((it) => it.id === 'team').person.team, true);
});

test('ladder: added → active → marked → 3+ days → 80%+ → came back another day', () => {
  const d = buildPillsUsage(fixture(), { days: 30, now: NOW });
  assert.deepEqual(ladderOf(d), { added: 3, active: 2, marked: 3, regular: 2, adherent: 1, returned: 3 });
  assert.equal(d.ladder[0].rate, 100);
  assert.equal(d.ladder[4].rate, 33.3);
});

test('one person: counts only, 14-day adherence, no names or times', () => {
  const d = buildPillsUsage(fixture(), { days: 30, now: NOW });
  const u1 = d.items.find((it) => it.id === 'u1');
  assert.deepEqual(u1.meds, { active: 2, ended: 0, paused: 0, deleted: 0 });
  assert.deepEqual(u1.marks, { total: 10, taken: 9, skipped: 1, days: 5 });
  assert.deepEqual(u1.adherence, { due: 9, taken: 8, skipped: 1, missed: 0, rate: 88.9, bucket: 'high' });
  assert.equal(u1.permission, 'enabled');
  assert.deepEqual(u1.price, { linked: 1, alerts: 1, opened: 1, off: false });
  assert.equal(u1.medi, 1);
  assert.equal(u1.person.name, 'Nino');
  assert.equal(u1.person.contact, '+995 599 12 34 56');

  const u3 = d.items.find((it) => it.id === 'u3');
  assert.deepEqual(u3.adherence, { due: 1, taken: 1, skipped: 0, missed: 0, rate: 100, bucket: null });
  assert.equal(u3.permission, 'unknown');
  const u2 = d.items.find((it) => it.id === 'u2');
  assert.deepEqual(u2.meds, { active: 0, ended: 0, paused: 1, deleted: 1 });
  assert.equal(u2.adherence.due, 0);

  const wire = JSON.stringify(d.items);
  for (const secret of ['Aspirin', 'aspirin', 'Rare', '"08:00"', '"20:00"', '"09:00"', 'times', 'dosage']) assert.equal(wire.includes(secret), false, secret);
  assert.equal(JSON.stringify(d).includes('Rare'), false);
});

test('aggregates: names only with 3+ people, adherence buckets, mark timing, deleted and orphaned marks', () => {
  const d = buildPillsUsage(fixture(), { days: 30, now: NOW });
  assert.deepEqual(d.schedules.names, [{ label: 'Aspirin', people: 3, medications: 3 }]);
  assert.deepEqual(d.schedules.namesOther, { people: 1, medications: 1 });
  assert.equal(d.schedules.forms.pills, 1);
  assert.equal(d.schedules.forms.capsules, 1);
  assert.equal(d.schedules.forms.unknown, 1);
  assert.equal(d.schedules.timesPerDay.two, 1);
  assert.equal(d.schedules.weekdays.someDays, 1);
  assert.equal(d.schedules.linked, 1);
  assert.deepEqual(d.adherence.buckets, { high: 1, mid: 0, low: 0, none: 0 });
  assert.equal(d.adherence.due, 10);
  assert.equal(d.adherence.rate, 90);
  assert.equal(d.adherence.people, 2);
  assert.deepEqual(d.marks.timing, { before: 1, onTime: 11, late: 1, backfill: 1 });
  assert.deepEqual(d.marks.deleted, { marks: 3, people: 1 });
  assert.deepEqual(d.marks.orphaned, { marks: 71, accounts: 3 });
  assert.deepEqual(d.reminders.active, { enabled: 1, disabled: 0, unknown: 1 });
  assert.equal(d.price.alerts.SENT, 1);
  assert.equal(d.price.alerts.SKIPPED, 1);
  assert.equal(d.price.openedPeople, 1);
  assert.equal(d.medi.reviews, 1);
  assert.equal(d.firstMed.sameDay, 2);
  assert.equal(d.firstMed.later, 1);
  assert.equal(d.totals.appReturned, 1);

  // With the team's medicine the name is still one row — four people now.
  const t = buildPillsUsage(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.deepEqual(t.schedules.names, [{ label: 'Aspirin', people: 4, medications: 4 }]);
});

test('period: new medicines, marks by dose day, signups that added one', () => {
  const d = buildPillsUsage(fixture(), { days: 30, now: NOW });
  assert.equal(d.period.newMedications, 4);
  assert.equal(d.period.newPeople, 3);
  assert.equal(d.period.activePeople, 3);
  assert.equal(d.period.marks, 14);
  assert.equal(d.period.signups, 3);
  assert.equal(d.period.signupsWithMed, 2);
  assert.equal(d.period.signupMedRate, 66.7);
  assert.equal(d.period.trend.marks.length, 30);
  assert.equal(d.period.trend.marks.find((p) => p.day === '2026-10-07').count, 2);

  const week = buildPillsUsage(fixture(), { days: 7, now: NOW });
  assert.equal(week.period.from, '2026-10-05');
  assert.equal(week.period.newMedications, 3);
  assert.equal(week.period.marks, 11);
  assert.equal(week.period.trend.active.length, 7);
});

test('empty data: no crash, zeros and nulls', () => {
  const d = buildPillsUsage({}, { days: 30, now: NOW });
  assert.equal(d.installed, true);
  assert.equal(d.totals.people, 0);
  assert.equal(d.totals.peopleRate, null);
  assert.equal(d.adherence.rate, null);
  assert.deepEqual(d.items, []);
  assert.equal(d.itemsTotal, 0);
  assert.ok(d.ladder.every((s) => s.count === 0 && s.rate === null));
  assert.equal(d.period.trend.medications.length, 30);
  assert.deepEqual(d.schedules.names, []);
  assert.deepEqual(d.marks.orphaned, { marks: 0, accounts: 0 });
  assert.equal(d.flags.medications.effective, true);
});
