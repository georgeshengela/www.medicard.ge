import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCycleUsage, logParts } from './adminUsageCycle.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi
const at = (s) => new Date(s);
const TEAM = 'acct-team-0001';
const U1 = 'acct-woman-0001';
const U2 = 'acct-woman-0002';
const U3 = 'acct-woman-0003';
const U4 = 'acct-woman-0004';
const U5 = 'acct-woman-0005';

const profile = (userId, extra = {}) => ({
  userId, mode: 'TRACK_PERIOD', createdAt: at('2026-10-01T08:00:00Z'), hasLastPeriod: false, isIrregular: false, customLengths: false,
  privacyEnabled: false, hasConditions: false, contraception: null, reminders: null, ...extra,
});
const log = (userId, date, flow, parts, createdAt, updatedAt = createdAt, extra = {}) => ({
  userId, date, flow, postpartum: false, imported: false, parts, createdAt: at(createdAt), updatedAt: at(updatedAt), ...extra,
});

function fixture() {
  return {
    teamUserIds: [TEAM],
    accountsTotal: 7,
    women: [
      { id: TEAM, createdAt: at('2026-03-24T08:00:00Z') },
      { id: U1, createdAt: at('2026-10-01T08:00:00Z') },
      { id: U2, createdAt: at('2026-10-08T08:00:00Z') },
      { id: U3, createdAt: at('2026-08-15T08:00:00Z') },
      { id: U4, createdAt: at('2026-09-20T08:00:00Z') },
      { id: U5, createdAt: at('2026-10-10T08:00:00Z') },
    ],
    profiles: [
      profile(TEAM, { hasLastPeriod: true, createdAt: at('2026-03-24T08:00:00Z') }),
      profile(U1, { mode: 'TRY_TO_CONCEIVE', hasLastPeriod: true, customLengths: true, contraception: 'NONE', reminders: { enabled: true, ovulation: true } }),
      profile(U2, { hasLastPeriod: true, isIrregular: true, contraception: 'METHOD', createdAt: at('2026-10-08T08:00:00Z') }),
      profile(U3, { createdAt: at('2026-08-15T08:00:00Z') }),
      profile(U4, { mode: 'PREGNANCY', createdAt: at('2026-09-20T08:00:00Z') }),
    ],
    logs: [
      log(TEAM, '2026-10-01', 'medium', ['flow'], '2026-10-01T08:00:00Z'),
      // U1 typed four past periods in one sitting (history), then a symptom day she edited the next day.
      log(U1, '2026-07-01', 'medium', ['flow'], '2026-10-02T08:00:00Z'),
      log(U1, '2026-07-29', 'medium', ['flow'], '2026-10-02T08:00:10Z'),
      log(U1, '2026-08-26', 'heavy', ['flow'], '2026-10-02T08:00:20Z'),
      log(U1, '2026-09-23', 'medium', ['flow'], '2026-10-02T08:00:30Z'),
      log(U1, '2026-10-05', null, ['symptoms', 'sex'], '2026-10-05T08:00:00Z', '2026-10-06T08:00:00Z'),
      log(U2, '2026-10-09', 'light', ['flow'], '2026-10-09T10:00:00Z'),
      // Only temperature imported from Health: not something she logged.
      log(U4, '2026-10-10', null, [], '2026-10-10T07:00:00Z', '2026-10-10T07:00:00Z', { imported: true }),
    ],
    pregnancyLogs: [{ userId: U4, date: '2026-10-10', createdAt: at('2026-10-10T08:00:00Z'), updatedAt: at('2026-10-10T08:00:00Z') }],
    tips: [
      { userId: TEAM, status: 'OK', latencyMs: 8000, cost: 0.01, createdAt: at('2026-10-02T09:00:00Z') },
      { userId: U1, status: 'OK', latencyMs: 12000, cost: 0.004, createdAt: at('2026-10-03T09:00:00Z') },
      { userId: U1, status: 'OK', latencyMs: 20000, cost: 0.006, createdAt: at('2026-10-07T09:00:00Z') },
      { userId: U3, status: 'ERROR', latencyMs: 30000, cost: null, createdAt: at('2026-09-01T09:00:00Z') },
    ],
    tipFeedback: [{ userId: U1, rating: 1 }],
    pregnancies: [{ userId: U4, status: 'ACTIVE', startedAt: at('2026-10-08T08:00:00Z'), endedAt: null }],
    postpartums: [],
    shares: [{ ownerUserId: U2, partnerUserId: 'acct-partner-0009', createdAt: at('2026-10-09T10:05:00Z'), expiresAt: at('2026-11-09T10:05:00Z'), revokedAt: null }],
    tags: [],
    events: [
      { name: 'cycle_log_saved', value: 'quick', day: '2026-10-09' },
      { name: 'cycle_log_saved', value: 'bogus', day: '2026-10-09' },
      { name: 'cycle_period_started', value: 'home', day: '2026-08-01' },
      { name: 'cycle_explain_opened', value: 'ring', day: '2026-10-10' },
    ],
    goalCycleUserIds: [U1, U3, TEAM],
    trackingPrefs: [{ userId: U2, expectsBleeding: true, fertilityDisplay: 'off', hiddenStarts: [] }],
    flags: [{ key: 'cycle', enabled: false, effective: false }],
  };
}

const ladderOf = (d) => Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));

test('logParts: kinds of field only; imported temperature is not a logged sign', () => {
  assert.deepEqual(logParts({ flow: 'none' }), []);
  assert.deepEqual(logParts({ flow: 'heavy', symptoms: ['cramps'], moods: [], sexualActivity: false }), ['flow', 'symptoms', 'sex']);
  assert.deepEqual(logParts({ bbt: 36.6, observations: { bbtSource: 'health' } }), []);
  assert.deepEqual(logParts({ bbt: 36.6, observations: {} }), ['signs']);
  assert.deepEqual(logParts({ observations: { ovulationMarked: true } }), ['signs']);
  assert.deepEqual(logParts({ observations: { energy: 'low' }, customTagIds: ['t1'] }, { hasNote: true }), ['notes', 'tags', 'other']);
  assert.deepEqual(logParts({ painEntries: [{ type: 'back', severity: 2 }], stressLevel: 'high' }), ['symptoms', 'lifestyle']);
});

test('team accounts are left out by default: totals, ladder, Medi, settings', () => {
  const d = buildCycleUsage(fixture(), { days: 30, now: NOW });
  assert.equal(d.totals.accounts, 6);
  assert.equal(d.totals.women, 5);
  assert.equal(d.totals.profiles, 4);
  assert.equal(d.totals.profileRate, 80);
  assert.deepEqual(d.team, { accounts: 1, profiles: 1, loggers: 1, logs: 1 });
  // U1 + U2 gave a period; U1, U2 and U4 (pregnancy diary) wrote a day; U4's imported-only day does not count.
  assert.deepEqual(ladderOf(d), { profile: 4, started: 2, logged: 3, details: 2, multiDay: 1, returned: 2 });
  assert.equal(d.ladder[2].rate, 75);
  assert.equal(d.totals.onlyProfile, 1);
  assert.equal(d.totals.startedOnly, 0);
  assert.equal(d.totals.logs, 7);
  assert.equal(d.totals.medianDays, 1);
  assert.equal(d.totals.goalCycle, 2);
  assert.equal(d.totals.goalCycleLogged, 1);
  assert.equal(d.medi.tips, 3);
  assert.equal(d.medi.ok, 2);
  assert.equal(d.medi.errors, 1);
  assert.equal(d.medi.users, 1);
  assert.equal(d.medi.costUsd, 0.01);
  assert.equal(d.medi.feedback.up, 1);
  assert.deepEqual(d.settings.reminders, { saved: 1, off: 0, ovulation: 1, dailyLog: 0, pms: 0, opk: 0, bbt: 0 });
  assert.deepEqual(d.settings.share, { owners: 1, active: 1, accepted: 1 });
  assert.equal(d.settings.fertilityOff, 1);
  assert.equal(d.settings.temperatureImport, 1);
  assert.equal(d.flags.cycle.effective, false);
  assert.equal(d.items.some((it) => it.team), false);
});

test('including the team brings its profile, day and tips back', () => {
  const d = buildCycleUsage(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(d.totals.accounts, 7);
  assert.equal(d.totals.profiles, 5);
  assert.equal(ladderOf(d).logged, 4);
  assert.equal(d.medi.tips, 4);
  assert.equal(d.totals.goalCycle, 3);
  assert.equal(d.items.filter((it) => it.team).length, 1);
});

test('logging, modes and forecast readiness are counts only', () => {
  const d = buildCycleUsage(fixture(), { days: 30, now: NOW });
  const parts = Object.fromEntries(d.logging.parts.map((p) => [p.key, p.people]));
  assert.equal(parts.flow, 2);
  assert.equal(parts.symptoms, 1);
  assert.equal(parts.sex, 1);
  assert.equal(parts.pregnancy, 1);
  assert.deepEqual(d.logging.perPerson, { one: 2, few: 0, several: 1, many: 0 });
  assert.equal(d.profile.modes.TRY_TO_CONCEIVE, 1);
  assert.equal(d.profile.modes.PREGNANCY, 1);
  assert.deepEqual(d.profile.contraception, { answered: 2, none: 1, method: 1 });
  // U1: four logged starts 28 days apart = 3 completed cycles; U2: one start; U3 / U4: none logged.
  assert.deepEqual(d.profile.forecast, { none: 2, first: 1, learning: 0, ready: 1 });
  assert.deepEqual(d.profile.pregnancy, { total: 1, people: 1, active: 1 });
});

test('the wall is anonymous: no ids, no dates, buckets only, ordered by what the card shows', () => {
  const d = buildCycleUsage(fixture(), { days: 30, now: NOW });
  assert.equal(d.itemsTotal, 4);
  for (const it of d.items) {
    assert.deepEqual(Object.keys(it).sort(), ['activeDays', 'days', 'detailDays', 'last', 'mark', 'mode', 'since', 'started', 'team', 'tips']);
  }
  assert.deepEqual(d.items.map((it) => [it.mark, it.mode, it.last]), [
    ['#1', 'TRY_TO_CONCEIVE', 'week'],
    ['#2', 'PREGNANCY', 'week'],
    ['#3', 'TRACK_PERIOD', 'week'],
    ['#4', 'TRACK_PERIOD', 'earlier'],
  ]);
  const [u1, u4, u2, u3] = d.items;
  assert.deepEqual(u1.since, { kind: 'use', bucket: 'twoWeeks' });
  assert.equal(u1.days, 5);
  assert.equal(u1.detailDays, 1);
  assert.equal(u1.tips, 2);
  assert.equal(u1.activeDays, 5); // 2 Oct history, 3 Oct tips, 5 Oct day, 6 Oct edit, 7 Oct tips
  assert.equal(u4.activeDays, 2);
  assert.equal(u2.started, true);
  assert.deepEqual(u3.since, { kind: 'use', bucket: 'quarter' });
  assert.equal(u3.days, 0);
  const json = JSON.stringify(d);
  for (const secret of [TEAM, U1, U2, U3, U4, U5, 'acct-partner-0009', '2026-07-01', '2026-07-29', '2026-08-26', '"medium"', '"heavy"', '"light"', 'cramps']) {
    assert.equal(json.includes(secret), false, `payload leaks ${secret}`);
  }
});

test('period: logs, active women, tips, new women who started, anonymous events by source', () => {
  const d = buildCycleUsage(fixture(), { days: 30, now: NOW });
  const p = d.period;
  assert.equal(p.from, '2026-09-12');
  assert.equal(p.logs, 7);
  assert.equal(p.loggers, 3);
  assert.equal(p.newLoggers, 3);
  assert.equal(p.active, 3);
  assert.equal(p.tips, 2);
  assert.equal(p.tipUsers, 1);
  assert.equal(p.signups, 4);
  assert.equal(p.signupsLogged, 3);
  assert.equal(p.signupRate, 75);
  assert.deepEqual(p.events.logSources, { quick: 1, other: 1 });
  assert.deepEqual(p.events.periodStarts, {});
  assert.deepEqual(p.events.explain, { ring: 1 });
  assert.equal(p.trend.logs.length, 30);
  assert.equal(p.trend.logs.find((r) => r.day === '2026-10-02').count, 4);
  assert.equal(p.trend.active.find((r) => r.day === '2026-10-09').count, 1);
  const wide = buildCycleUsage(fixture(), { days: 90, now: NOW });
  assert.equal(wide.period.active, 4);
  assert.deepEqual(wide.period.events.periodStarts, { home: 1 });
  const week = buildCycleUsage(fixture(), { days: 7, now: NOW });
  assert.equal(week.period.logs, 3); // U1's 5 Oct day, U2's day, U4's pregnancy diary
});

test('empty data: sensible zeros, no crash', () => {
  const d = buildCycleUsage({}, { days: 30, now: NOW });
  assert.equal(d.installed, true);
  assert.equal(d.totals.profiles, 0);
  assert.equal(d.totals.loggers, 0);
  assert.equal(d.totals.profileRate, null);
  assert.equal(d.totals.medianDays, null);
  assert.deepEqual(ladderOf(d), { profile: 0, started: 0, logged: 0, details: 0, multiDay: 0, returned: 0 });
  assert.equal(d.items.length, 0);
  assert.equal(d.medi.avgMs, null);
  assert.equal(d.period.trend.active.length, 30);
  assert.equal(d.flags.cycle.effective, true);
});
