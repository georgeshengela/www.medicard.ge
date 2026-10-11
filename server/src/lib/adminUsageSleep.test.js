import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSleepOverview, hasThreeNightsInAWeek, loadSleepOverview, SLEEP_K_MIN } from './adminUsageSleep.js';
import { FEED_SOURCES, shapeFeed } from './adminFeed.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi, a Sunday
const at = (s) => new Date(s);
/** A night saved at 08:00 Tbilisi on the morning it ends. */
const night = (userId, day, extra = {}) => ({
  userId,
  night: day,
  timesSource: 'manual',
  checkedInAt: null,
  createdAt: at(`${day}T04:00:00Z`),
  updatedAt: at(`${day}T04:00:00Z`),
  inBedMinutes: null,
  asleepMinutes: null,
  latencyMinutes: null,
  quality: null,
  factors: [],
  hadSound: false,
  bedHour: null,
  ...extra,
});
const play = (userId, startedAt, soundIds, minutes, sleepMode = false) => ({
  userId, soundIds, startedAt: at(startedAt), minutes, sleepMode, createdAt: at(startedAt),
});
const user = (id, fullName, email, createdAt = '2026-09-01T08:00:00Z') => ({ id, fullName, email, phone: null, createdAt: at(createdAt), lastSeenAt: at('2026-10-11T08:00:00Z') });

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 21,
    people: [
      user('team', 'Demo', 'demo@medicard.ge'),
      user('u1', 'Nino', '995599123456@phone.medicard.ge'),
      user('u2', 'Giorgi', 'x@apple.medicard.ge', '2026-10-10T05:00:00Z'),
      user('u3', 'Ana', 'ana@example.com'),
      user('u4', 'Levan', 'levan@example.com'),
      user('u5', 'Mari', 'mari@example.com'),
      user('u6', 'Saba', 'saba@example.com'),
      user('u7', 'Eka', 'eka@example.com'),
    ],
    plans: [
      { userId: 'team', bedtimeReminder: true, checkinReminder: true, alarm: true, hideScore: false, createdAt: at('2026-09-01T08:00:00Z'), updatedAt: at('2026-09-01T08:00:00Z') },
      { userId: 'u1', bedtimeReminder: true, checkinReminder: false, alarm: true, hideScore: true, createdAt: at('2026-09-20T18:00:00Z'), updatedAt: at('2026-09-20T18:00:10Z') },
      { userId: 'u2', bedtimeReminder: false, checkinReminder: true, alarm: false, hideScore: false, createdAt: at('2026-10-10T05:10:00Z'), updatedAt: at('2026-10-10T05:10:00Z') },
    ],
    nights: [
      night('team', '2026-10-09', { timesSource: 'mode', asleepMinutes: 900, quality: 1, checkedInAt: at('2026-10-09T05:00:00Z'), factors: ['alcohol'], bedHour: 3 }),
      night('team', '2026-10-10', { timesSource: 'mode', asleepMinutes: 890, bedHour: 3 }),
      // u1: three nights inside a week, two check-ins, all from sleep mode.
      night('u1', '2026-10-05', { timesSource: 'mode', inBedMinutes: 480, latencyMinutes: 20, quality: 4, checkedInAt: at('2026-10-05T04:30:00Z'), factors: ['stress'], bedHour: 23 }),
      night('u1', '2026-10-06', { timesSource: 'mode', asleepMinutes: 420, quality: 5, checkedInAt: at('2026-10-06T04:30:00Z'), bedHour: 0 }),
      night('u1', '2026-10-08', { timesSource: 'mode', asleepMinutes: 395, bedHour: 23 }),
      // u4: two nights eight days apart (came back another week, not three in a week).
      night('u4', '2026-10-01', { asleepMinutes: 350, quality: 3, checkedInAt: at('2026-10-01T05:00:00Z'), factors: ['caffeine'] }),
      night('u4', '2026-10-09', { inBedMinutes: 500 }),
      // u5: a Health night where a sleep-mode sound played; u6: a sleep-mode night.
      night('u5', '2026-10-10', { timesSource: 'health', asleepMinutes: 530, hadSound: true }),
      night('u6', '2026-10-10', { timesSource: 'mode', asleepMinutes: 610, bedHour: 22 }),
      // u7: an old night, outside every window.
      night('u7', '2026-06-01', { asleepMinutes: 437, quality: 2 }),
    ],
    plays: [
      play('team', '2026-10-09T18:00:00Z', ['forest'], 10),
      play('u1', '2026-10-04T19:00:00Z', ['rain'], 30, true),
      play('u1', '2026-10-05T19:00:00Z', ['rain', 'brown'], 45, true),
      play('u3', '2026-10-09T18:00:00Z', ['rain'], 20),
      play('u3', '2026-10-09T18:30:00Z', ['brown'], 20),
      play('u3', '2026-10-09T19:00:00Z', ['old-sound'], 5),
    ],
    sounds: [
      { id: 'forest', category: 'nature', titleKa: 'ტყე', status: 'DRAFT', featured: false, sortOrder: 0, hasAudio: false },
      { id: 'rain', category: 'rain', titleKa: 'წვიმა სახურავზე', status: 'LIVE', featured: true, sortOrder: 10, hasAudio: true },
      { id: 'brown', category: 'noise', titleKa: 'ყავისფერი ხმაური', status: 'LIVE', featured: false, sortOrder: 20, hasAudio: true },
    ],
    signups: [
      { id: 'u2', createdAt: at('2026-10-10T05:00:00Z') },
      { id: 'u9', createdAt: at('2026-10-08T05:00:00Z') },
    ],
    flags: [{ key: 'sleep', enabled: true, effective: true }],
  };
}

test('three nights inside any seven days', () => {
  assert.equal(hasThreeNightsInAWeek(['2026-10-01', '2026-10-04', '2026-10-07']), true);
  assert.equal(hasThreeNightsInAWeek(['2026-10-01', '2026-10-04', '2026-10-08']), false);
  assert.equal(hasThreeNightsInAWeek(['2026-10-01', '2026-10-01', '2026-10-02']), false, 'the same night twice is one night');
  assert.equal(hasThreeNightsInAWeek([]), false);
});

test('team accounts are left out by default: totals, team summary, people list', () => {
  const d = buildSleepOverview(fixture(), { days: 30, now: NOW });
  assert.equal(d.installed, true);
  assert.deepEqual(d.team, { accounts: 1, people: 1, nights: 2, plays: 1 });
  assert.equal(d.totals.accounts, 20);
  assert.equal(d.totals.people, 7);
  assert.equal(d.totals.plans, 2);
  assert.equal(d.totals.nights, 8);
  assert.equal(d.totals.plays, 5);
  assert.equal(d.totals.onlyPlan, 1);
  assert.equal(d.totals.onlySounds, 1);
  assert.ok(d.people.every((p) => p.id !== 'team' && !p.person.team));
  assert.deepEqual(d.flag, { enabled: true, effective: true, blockedBy: null });

  const all = buildSleepOverview(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(all.totals.people, 8);
  assert.equal(all.totals.accounts, 21);
  assert.equal(all.totals.plans, 3);
  assert.equal(all.people.find((p) => p.id === 'team').person.team, true);
  assert.equal(all.reminders.alarm, 2);
});

test('ladder: plan → sound → night → check-in → 3+ nights a week → back another week', () => {
  const d = buildSleepOverview(fixture(), { days: 30, now: NOW });
  const L = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
  assert.deepEqual(d.ladder.map((s) => s.key), ['plan', 'listened', 'logged', 'checkin', 'week3', 'returned']);
  assert.deepEqual(L, { plan: 2, listened: 2, logged: 5, checkin: 2, week3: 1, returned: 2 });
  assert.equal(d.ladder.find((s) => s.key === 'logged').rate, 71.4, 'rates are against everyone in MEDISLEEP (7)');
  const u1 = d.people.find((p) => p.id === 'u1');
  assert.equal(u1.week3, true);
  assert.equal(u1.returned, true);
  assert.equal(d.people.find((p) => p.id === 'u4').week3, false);
  assert.equal(d.people.find((p) => p.id === 'u4').returned, true);
});

test('period: nights by the morning they end, split by where the times came from', () => {
  const d = buildSleepOverview(fixture(), { days: 30, now: NOW });
  const p = d.period;
  assert.equal(p.from, '2026-09-12');
  assert.equal(p.to, '2026-10-11');
  assert.deepEqual(p.nights, { total: 7, mode: 4, manual: 2, health: 1 });
  assert.equal(p.nightPeople, 4);
  assert.equal(p.checkins, 3);
  assert.equal(p.modeNights, 5, 'sleep-mode times or a sleep-mode sound that night');
  assert.equal(p.plays, 5);
  assert.equal(p.listenMinutes, 120);
  assert.equal(p.listeners, 2);
  assert.equal(p.sleepModePlays, 2);
  assert.deepEqual(p.plans, { total: 2, new: 2 });
  assert.equal(p.activePeople, 6, 'u7 was active only in June');
  assert.equal(p.signups, 2);
  assert.equal(p.signupsWithSleep, 1);
  assert.equal(p.trend.nights.length, 30);
  assert.equal(p.trend.nights.find((x) => x.day === '2026-10-10').count, 2);
  assert.equal(p.trend.plays.find((x) => x.day === '2026-10-09').count, 3);
  assert.ok(p.trend.active.find((x) => x.day === '2026-10-05').count >= 1);

  const week = buildSleepOverview(fixture(), { days: 7, now: NOW });
  assert.equal(week.period.nights.total, 6, 'u4’s night of 1 Oct is outside the 7 days');
});

test('sounds: every catalogue sound ranked by plays in the window, layers count for each sound', () => {
  const d = buildSleepOverview(fixture(), { days: 30, now: NOW });
  assert.deepEqual(d.sounds.rows.map((s) => [s.id, s.plays, s.minutes, s.listeners]), [
    ['rain', 3, 95, 2],
    ['brown', 2, 65, 2],
    ['forest', 0, 0, 0],
  ]);
  const rain = d.sounds.rows[0];
  assert.equal(rain.title, 'წვიმა სახურავზე');
  assert.equal(rain.categoryLabel, 'წვიმა');
  assert.equal(rain.statusLabel, 'აპში ჩანს');
  assert.equal(d.sounds.rows[2].statusLabel, 'მონახაზი');
  assert.deepEqual(d.sounds.unknown, { plays: 1, minutes: 5, listeners: 1 });
  assert.deepEqual({ ...d.sounds.library, byCategory: undefined }, { total: 3, live: 2, draft: 1, hidden: 0, noAudio: 1, byCategory: undefined });

  const all = buildSleepOverview(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(all.sounds.rows.find((s) => s.id === 'forest').plays, 1);
});

test(`k-anonymity: the sleep picture and bedtimes need ${SLEEP_K_MIN} different real people`, () => {
  const d = buildSleepOverview(fixture(), { days: 30, now: NOW });
  assert.deepEqual(d.picture, { hidden: true, people: 4, min: SLEEP_K_MIN });
  assert.deepEqual(d.bedtimes, { hidden: true, people: 2, min: SLEEP_K_MIN });
  // Team nights never help a group reach the threshold.
  const withTeam = buildSleepOverview(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(withTeam.picture.hidden, true);
  assert.equal(withTeam.picture.people, 4);

  const raw = fixture();
  raw.people.push(user('u8', 'Tako', 'tako@example.com'));
  raw.nights.push(night('u8', '2026-10-10', { asleepMinutes: 300, quality: 2, checkedInAt: at('2026-10-10T05:00:00Z'), factors: ['caffeine', 'stress'] }));
  const shown = buildSleepOverview(raw, { days: 30, now: NOW }).picture;
  assert.equal(shown.hidden, false);
  assert.equal(shown.people, 5);
  assert.equal(shown.nights, 8);
  assert.equal(shown.sleptNights, 8);
  assert.equal(shown.avgSleptMinutes, 446);
  assert.deepEqual(shown.buckets.map((b) => [b.key, b.count]), [['under5', 0], ['h5to6', 2], ['h6to7', 1], ['h7to8', 2], ['h8to9', 2], ['over9', 1]]);
  assert.equal(shown.buckets.find((b) => b.key === 'h5to6').share, 25);
  assert.equal(shown.avgQuality, 3.5);
  assert.equal(shown.checkins, 4);
  assert.deepEqual(shown.factors.map((f) => [f.id, f.count, f.share]).sort(), [['caffeine', 2, 50], ['stress', 2, 50]]);
  assert.equal(shown.factors.find((f) => f.id === 'stress').label, 'სტრესი');
});

test('bedtimes: Tbilisi start hour of sleep-mode nights, only with enough people', () => {
  const raw = { teamUserIds: [], people: [], plans: [], plays: [], sounds: [], nights: [] };
  for (const id of ['a', 'b', 'c', 'd']) raw.nights.push(night(id, '2026-10-10', { timesSource: 'mode', bedHour: 23 }));
  // No hour from the loader: read from the bed time (19:30 UTC = 23:30 in Tbilisi).
  raw.nights.push(night('e', '2026-10-10', { timesSource: 'mode', bedAt: at('2026-10-09T19:30:00Z') }));
  raw.nights.push(night('e', '2026-10-09', { timesSource: 'manual', bedHour: 2 }));
  const d = buildSleepOverview(raw, { days: 30, now: NOW });
  assert.equal(d.bedtimes.hidden, false);
  assert.equal(d.bedtimes.nights, 5);
  assert.equal(d.bedtimes.hours.length, 24);
  assert.equal(d.bedtimes.hours[23], 5);
  assert.equal(d.bedtimes.hours[2], 0, 'hand-entered nights are not sleep-mode bedtimes');
});

test('people: counts only — no sleep duration, times, rating or factors on a person', () => {
  const raw = fixture();
  raw.people.push(user('u8', 'Tako', 'tako@example.com'));
  raw.nights.push(night('u8', '2026-10-10', { asleepMinutes: 389, quality: 2, checkedInAt: at('2026-10-10T05:00:00Z'), factors: ['alcohol'] }));
  const d = buildSleepOverview(raw, { days: 30, now: NOW });
  const allowed = ['id', 'plan', 'nights', 'checkins', 'plays', 'listenMinutes', 'activeDays', 'periodDays', 'week3', 'returned', 'firstDay', 'lastDay', 'person'];
  for (const row of d.people) {
    assert.deepEqual(Object.keys(row).sort(), [...allowed].sort());
    assert.deepEqual(Object.keys(row.person).sort(), ['contact', 'id', 'lastSeenAt', 'name', 'signupAt', 'team']);
    assert.match(row.lastDay, /^\d{4}-\d{2}-\d{2}$/, 'a day, never the time a night was saved');
  }
  const text = JSON.stringify(d.people);
  for (const secret of ['389', '437', '610', '530', 'alcohol', 'caffeine', 'stress', 'quality', 'factors', 'asleep', 'bedHour', 'timesSource']) {
    assert.ok(!text.includes(secret), `people rows leak ${secret}`);
  }
  const u1 = d.people.find((p) => p.id === 'u1');
  assert.deepEqual({ nights: u1.nights, checkins: u1.checkins, plays: u1.plays, listenMinutes: u1.listenMinutes, plan: u1.plan }, { nights: 3, checkins: 2, plays: 2, listenMinutes: 75, plan: true });
  assert.equal(u1.person.contact, '+995 599 12 34 56');
  assert.equal(d.people[0].periodDays >= d.people[d.people.length - 1].periodDays, true, 'most active first');
  assert.equal(d.peopleTotal, 8);
});

test('empty data: zeros, nulls and hidden aggregates, no crash', () => {
  const d = buildSleepOverview({}, { now: NOW });
  assert.equal(d.totals.people, 0);
  assert.equal(d.totals.peopleRate, null);
  assert.ok(d.ladder.every((s) => s.count === 0 && s.rate === null));
  assert.deepEqual(d.picture, { hidden: true, people: 0, min: SLEEP_K_MIN });
  assert.equal(d.bedtimes.hidden, true);
  assert.deepEqual(d.sounds.rows, []);
  assert.deepEqual(d.people, []);
  assert.equal(d.period.days, 30);
});

test('loadSleepOverview: tables not installed yet → installed: false', async () => {
  const missing = () => Promise.reject(Object.assign(new Error('relation "SleepPlan" does not exist'), { code: 'P2010' }));
  const db = {
    user: { findMany: async () => [], count: async () => 0 },
    appActivity: { groupBy: async () => [], findMany: async () => [] },
    $queryRaw: missing,
  };
  const out = await loadSleepOverview({ db, now: NOW });
  assert.deepEqual(out, { installed: false, generatedAt: NOW.toISOString() });
});

test('live feed: a saved night and a sound, linked to the person on #/sleep — no times or lengths', () => {
  assert.ok(FEED_SOURCES.includes('sleepNight') && FEED_SOURCES.includes('sleepPlay'));
  const people = [{ id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null }];
  const out = shapeFeed([
    { source: 'sleepNight', row: { id: 'n1', userId: 'u1', at: '2026-10-11T04:00:00Z', timesSource: 'mode', asleepMinutes: 433, quality: 2, bedAt: '2026-10-10T19:10:00Z' } },
    { source: 'sleepPlay', row: { id: 'p1', userId: 'u1', at: '2026-10-10T19:00:00Z', sleepMode: true, layers: 2, minutes: 47 } },
  ], people);
  assert.deepEqual(out.map((e) => [e.id, e.module, e.text, e.meta, e.href]), [
    ['sleepNight:n1', 'sleep', 'ჩაწერა ძილის ღამე', 'ძილის რეჟიმით', '#/sleep?pane=usage&focus=u1'],
    ['sleepPlay:p1', 'sleep', 'ჩართო ძილის ხმა', 'ძილის რეჟიმში · 2 ხმა ერთად', '#/sleep?pane=usage&focus=u1'],
  ]);
  const text = JSON.stringify(out);
  assert.ok(!/433|47|19:10|quality/.test(text.replace(/"at":"[^"]+"/g, '')), 'only the event time itself');
});
