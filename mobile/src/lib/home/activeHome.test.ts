import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  barHeight,
  buildStepsWeek,
  campaignRow,
  conditionText,
  dropDayEndMs,
  groupThousands,
  isTbilisiPlace,
  kaDative,
  kmText,
  lastWalkLine,
  localYmd,
  outdoorCopy,
  outdoorView,
  questSummary,
  stepsByDay,
  summarizeRunWeek,
  walkDayLabel,
  weeklyLine,
} from './activeHome.ts';
import type { GrandPrize } from '../medipulsi/grand.ts';
import type { WeatherCacheRecord, WeatherSnapshot } from '../weather/types.ts';
import type { QuestDashboard } from '../quest/api.ts';

const NB = ' ';
// Thursday 15 Oct 2026, 18:40 local.
const NOW = new Date(2026, 9, 15, 18, 40);

test('thousands are grouped with a no-break space, never a locale call', () => {
  assert.equal(groupThousands(7842), `7${NB}842`);
  assert.equal(groupThousands(10000), `10${NB}000`);
  assert.equal(groupThousands(999), '999');
  assert.equal(groupThousands(1234567.6), `1${NB}234${NB}568`);
  assert.equal(groupThousands(-5), '0');
  assert.equal(groupThousands(Number.NaN), '0');
});

test('km keep one decimal like the MEDIRUN hub', () => {
  assert.equal(kmText(12.43), '12.4');
  assert.equal(kmText(0), '0.0');
  assert.equal(kmText(Number.NaN), '0.0');
});

test('day keys are zero-padded local YYYY-MM-DD (health rows), not insights YYYY-M-D', () => {
  assert.equal(localYmd(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(localYmd(new Date(2026, 9, 15)), '2026-10-15');
});

test('stepsByDay keeps the last 7 days with real steps and normalises ISO dates', () => {
  const rows = stepsByDay(
    [
      { date: '2026-10-14', steps: 11305 },
      { date: '2026-10-13T00:00:00.000Z', steps: 6480.4 },
      { date: '2026-10-12', steps: 0 },
      { date: '2026-10-11', steps: null },
      { date: '2026-10-08', steps: 5000 }, // 7 days back = outside the window
      { date: '2026-10-09', steps: 8410 },
    ],
    NOW,
  );
  assert.deepEqual(rows, { '2026-10-14': 11305, '2026-10-13': 6480, '2026-10-09': 8410 });
  assert.deepEqual(stepsByDay(null, NOW), {});
});

test('week: six stored days + today live, missing days are null (stubs), Sunday-first labels', () => {
  const week = buildStepsWeek({
    rows: { '2026-10-09': 8410, '2026-10-10': 12040, '2026-10-11': 3980, '2026-10-12': 9120, '2026-10-13': 6480, '2026-10-14': 11305 },
    todayTotal: 7842,
    goal: 10000,
    now: NOW,
  });
  assert.equal(week.bars.length, 7);
  assert.deepEqual(week.bars.map((b) => b.label), ['პარ', 'შაბ', 'კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ']);
  assert.deepEqual(week.bars.map((b) => b.value), [8410, 12040, 3980, 9120, 6480, 11305, 7842]);
  assert.equal(week.bars[6].isToday, true);
  assert.equal(week.bars[6].key, '2026-10-15');
  assert.equal(week.pastDays, 6);
  // (8410+12040+3980+9120+6480+11305)/6 = 8555.8 — today's partial count is not in the average.
  assert.equal(week.average, 8556);
  assert.equal(week.scaleMax, 12642);
});

test('week: average only from 3 days with data; empty days never count as 0', () => {
  const two = buildStepsWeek({ rows: { '2026-10-14': 9000, '2026-10-13': 3000 }, todayTotal: 0, goal: 10000, now: NOW });
  assert.equal(two.pastDays, 2);
  assert.equal(two.average, null);
  assert.equal(two.bars[6].value, null);
  assert.equal(two.scaleMax, 12500);
  const three = buildStepsWeek({ rows: { '2026-10-14': 9000, '2026-10-13': 3000, '2026-10-10': 6000 }, todayTotal: 100, goal: 10000, now: NOW });
  assert.equal(three.average, 6000);
  const none = buildStepsWeek({ rows: {}, todayTotal: 0, goal: 0, now: NOW });
  assert.equal(none.scaleMax, 1);
  assert.ok(none.bars.every((b) => b.value == null));
});

test('bar heights stay inside the chart and a real value stays visible', () => {
  assert.equal(barHeight(null, 12500, 64), 0);
  assert.equal(barHeight(12500, 12500, 64), 64);
  assert.equal(barHeight(20000, 12500, 64), 64);
  assert.equal(barHeight(10, 12500, 64), 6);
  assert.equal(barHeight(6250, 12500, 64), 32);
});

test('MEDIRUN week: last 7 local days, active days, newest walk', () => {
  const walks = [
    { startedAt: new Date(2026, 9, 14, 19, 0).toISOString(), distanceM: 4100 },
    { startedAt: new Date(2026, 9, 12, 8, 0).toISOString(), distanceM: 5300 },
    { startedAt: new Date(2026, 9, 12, 18, 0).toISOString(), distanceM: 1000 },
    { startedAt: new Date(2026, 9, 10, 9, 0).toISOString(), distanceM: 2000 },
    { startedAt: new Date(2026, 9, 1, 9, 0).toISOString(), distanceM: 9000 }, // older than the week
    { startedAt: 'not a date', distanceM: 500 },
  ];
  const week = summarizeRunWeek(walks, NOW);
  assert.equal(kmText(week.weekKm), '12.4');
  assert.equal(week.activeDays, 3);
  assert.equal(week.hasHistory, true);
  assert.equal(week.last?.distanceM, 4100);
  const empty = summarizeRunWeek([], NOW);
  assert.deepEqual(empty, { weekKm: 0, activeDays: 0, hasHistory: false, last: null });
  const old = summarizeRunWeek([{ startedAt: new Date(2026, 8, 1).toISOString(), distanceM: 3000 }], NOW);
  assert.equal(old.weekKm, 0);
  assert.equal(old.hasHistory, true);
});

test('last walk reads today / yesterday / a Georgian date, never ISO', () => {
  assert.equal(walkDayLabel(new Date(2026, 9, 15, 7).toISOString(), NOW), 'დღეს');
  assert.equal(walkDayLabel(new Date(2026, 9, 14, 23, 50).toISOString(), NOW), 'გუშინ');
  assert.equal(walkDayLabel(new Date(2026, 8, 28, 10).toISOString(), NOW), '28 სექტემბერი');
  assert.equal(walkDayLabel(new Date(2025, 11, 30, 10).toISOString(), NOW), '30 დეკემბერი 2025');
  assert.equal(walkDayLabel('nope', NOW), '');
  assert.equal(lastWalkLine({ startedAt: new Date(2026, 9, 14, 19).toISOString(), distanceM: 4100 }, NOW), 'ბოლო გასეირნება · გუშინ, 4.1 კმ');
});

test('Tbilisi is recognised in either language', () => {
  assert.equal(isTbilisiPlace({ cityKa: 'თბილისი' }), true);
  assert.equal(isTbilisiPlace({ cityName: 'Tbilisi' }), true);
  assert.equal(isTbilisiPlace({ cityKa: 'ბათუმი', cityName: 'Batumi' }), false);
  assert.equal(isTbilisiPlace(null), false);
});

test('Georgian dative for the drop day', () => {
  assert.equal(kaDative('31 დეკემბერი'), '31 დეკემბერს');
  assert.equal(kaDative('5 აგვისტო'), '5 აგვისტოს');
  assert.equal(kaDative(''), '');
});

const DROP = '2026-12-31T08:00:00.000Z'; // 12:00 Tbilisi
function grand(over: { status?: 'upcoming' | 'live' | 'ended'; percent?: number; eligible?: boolean; me?: null } = {}): GrandPrize {
  const percent = over.percent ?? 0.23;
  return {
    campaign: { id: 'medirun-glow-2026', name: 'გაანათე თბილისი', status: over.status ?? 'upcoming', dropAt: DROP, prize: 'iPhone', prizeDetail: '', rulesUrl: 'https://medicard.ge/medirun#rules' },
    requirement: { areaId: 'r1996871', city: 'თბილისი', percent: 1, areaKm2: 503.93 },
    me: over.me === null ? null : { percent, paintedKm2: 1.2, eligible: over.eligible ?? false, remainingPercent: 1 - percent, remainingKm2: 3.9, remainingStreetKm: 39 },
    levels: [],
    next: null,
  };
}

test('campaign row: upcoming, Tbilisi walker → progress toward 1% and the drop day', () => {
  const row = campaignRow(grand(), { tbilisiProfile: false, now: Date.parse('2026-10-15T12:00:00Z') });
  assert.ok(row);
  assert.equal(row.name, 'გაანათე თბილისი');
  assert.equal(row.percentLabel, '0,23% / 1%');
  assert.equal(Math.round(row.progress * 100), 23);
  assert.equal(row.caption, '1%-დან 31 დეკემბერს დიდი საჩუქარი გამოჩნდება');
});

test('campaign row hides for non-Tbilisi people, after the drop day, when ended or unanswered', () => {
  const oct = Date.parse('2026-10-15T12:00:00Z');
  assert.equal(campaignRow(grand({ percent: 0 }), { tbilisiProfile: false, now: oct }), null);
  assert.ok(campaignRow(grand({ percent: 0 }), { tbilisiProfile: true, now: oct }));
  assert.equal(campaignRow(grand({ status: 'ended' }), { tbilisiProfile: true, now: oct }), null);
  assert.equal(campaignRow(grand({ me: null }), { tbilisiProfile: true, now: oct }), null);
  assert.equal(campaignRow(null, { tbilisiProfile: true, now: oct }), null);
  // Still on the drop day (live), gone from 1 Jan 00:00 Tbilisi even if a stale answer says live.
  assert.ok(campaignRow(grand({ status: 'live' }), { tbilisiProfile: true, now: Date.parse('2026-12-31T19:59:00Z') }));
  assert.equal(campaignRow(grand({ status: 'live' }), { tbilisiProfile: true, now: Date.parse('2026-12-31T20:00:00Z') }), null);
  assert.equal(dropDayEndMs(DROP), Date.parse('2026-12-31T20:00:00Z'));
});

test('campaign row captions for eligible and live', () => {
  const oct = Date.parse('2026-10-15T12:00:00Z');
  assert.equal(campaignRow(grand({ percent: 1.2, eligible: true }), { tbilisiProfile: true, now: oct })?.caption, 'შენ დაინახავ დიდ საჩუქარს');
  const dec31 = Date.parse('2026-12-31T09:00:00Z');
  assert.equal(campaignRow(grand({ status: 'live', percent: 1.2, eligible: true }), { tbilisiProfile: true, now: dec31 })?.caption, 'შენ ხედავ დიდ საჩუქარს');
  assert.equal(campaignRow(grand({ status: 'live' }), { tbilisiProfile: true, now: dec31 })?.caption, 'დაგრჩა ≈ 39 კმ ახალი ქუჩა');
});

function snapshot(hours: Array<[string, number]>): WeatherSnapshot {
  return {
    location: { city: 'თბილისი', latitude: 41.7151, longitude: 44.8271, timezone: 'Asia/Tbilisi' },
    current: { temperatureC: 20.6, feelsLikeC: 20, weatherCode: 0, condition: 'clear', isDay: true, precipitationMm: 0, windKmh: 6, windGustKmh: null },
    today: { minC: 12, maxC: 23, precipitationProbability: 0, uvMax: 4, sunrise: '2026-10-15T07:30', sunset: '2026-10-15T18:50' },
    daily: [{ date: '2026-10-15', minC: 12, maxC: 23, precipitationProbability: 0, weatherCode: 0, condition: 'clear', uvMax: 4, sunrise: '2026-10-15T07:30', sunset: '2026-10-15T18:50' }],
    hourly: hours.map(([time, temperatureC]) => ({
      time,
      temperatureC,
      feelsLikeC: temperatureC,
      precipitationProbability: 0,
      weatherCode: 0,
      condition: 'clear' as const,
      windKmh: 6,
      uvIndex: 2,
      visibilityM: 20000,
    })),
    airQuality: null,
    updatedAt: '2026-10-15T10:00:00Z',
  };
}

test('outdoor view uses the weather module window and refuses another place or an old cache', () => {
  const now = new Date('2026-10-15T10:05:00Z'); // 14:05 Tbilisi
  const record: WeatherCacheRecord = {
    latitude: 41.7151,
    longitude: 44.8271,
    fetchedAt: now.getTime() - 10 * 60_000,
    snapshot: snapshot([
      ['2026-10-15T14:00', 19],
      ['2026-10-15T15:00', 20],
      ['2026-10-15T16:00', 19],
      ['2026-10-15T17:00', 18],
    ]),
  };
  const here = { lat: 41.7152, lng: 44.8272 };
  const view = outdoorView(record, here, now);
  assert.ok(view);
  assert.equal(view.temperatureC, 21);
  assert.equal(view.window?.day, 'today');
  const copy = outdoorCopy(view);
  assert.match(copy.value, /^\d\d:00–\d\d:00$/);
  assert.equal(copy.detail, 'მზიანი · 21°');
  assert.equal(outdoorView(record, { lat: 41.65, lng: 41.64 }, now), null); // Batumi
  assert.equal(outdoorView({ ...record, fetchedAt: now.getTime() - 2 * 3600_000 }, here, now), null);
  assert.equal(outdoorView(record, null, now), null);
  assert.equal(outdoorView(null, here, now), null);
});

test('outdoor copy without a window shows the temperature and the weather screen sentence', () => {
  const copy = outdoorCopy({ window: null, condition: 'rain', isDay: true, temperatureC: 9 });
  assert.deepEqual(copy, { value: '9°', caption: 'დღეს კარგი ფანჯარა ვერ ვიპოვე', detail: 'წვიმა' });
  assert.equal(conditionText('clear', false), 'მოწმენდილი');
  assert.equal(conditionText('clear', true), 'მზიანი');
});

function dashboard(over: Partial<QuestDashboard> = {}): QuestDashboard {
  return {
    profile: { level: 4, rankKey: 'r', totalXp: 900, coinBalance: 1240, currentStreak: 3, longestStreak: 5, levelProgress: { level: 4 } },
    daily: { periodKey: '2026-10-15', timezone: 'Asia/Tbilisi', quests: [] },
    weekly: {
      periodKey: '2026-W42',
      quests: [
        {
          id: 'w1', key: 'weekly_steps', category: 'MOVEMENT', cadence: 'WEEKLY', titleKey: null, descriptionKey: null, progressType: 'STEPS',
          target: 35000, progress: 32205, progressPercent: 92, status: 'ACTIVE', periodKey: '2026-W42', assignedAt: null, completedAt: null,
          claimedAt: null, expiresAt: null, rewardCoins: 150, rewardXp: 200, claimable: false,
        },
      ],
    },
    summary: { dailyCompleted: 1, dailyTotal: 3, dailyClaimable: 1, weeklyCompleted: 0, unclaimedRewards: 1 },
    ...over,
  };
}

test('quest summary: coins, level, daily a / b, rewards waiting, weekly steps mission', () => {
  const s = questSummary(dashboard());
  assert.ok(s);
  assert.equal(s.coins, 1240);
  assert.equal(s.level, 4);
  assert.equal(s.dailyDone, 1);
  assert.equal(s.dailyTotal, 3);
  assert.equal(s.claimable, 1);
  assert.equal(s.weekly?.title, 'კვირის ნაბიჯების მისია');
  assert.equal(Math.round((s.weekly?.ratio ?? 0) * 100), 92);
  assert.equal(weeklyLine(s.weekly!), `32${NB}205 / 35${NB}000 · +150 მონეტა`);
});

test('quest summary: unavailable → null; over-target is capped; claimed and expired missions', () => {
  assert.equal(questSummary(dashboard({ unavailable: true })), null);
  assert.equal(questSummary(dashboard({ profile: null })), null);
  assert.equal(questSummary(null), null);
  const base = dashboard();
  const over = questSummary({ ...base, weekly: { ...base.weekly, quests: [{ ...base.weekly.quests[0], progress: 41000, status: 'CLAIMED' }] } });
  assert.equal(over?.weekly?.progress, 35000);
  assert.equal(over?.weekly?.ratio, 1);
  assert.equal(weeklyLine(over!.weekly!), `35${NB}000 / 35${NB}000 · ჯილდო მიღებულია`);
  const expired = questSummary({ ...base, weekly: { ...base.weekly, quests: [{ ...base.weekly.quests[0], status: 'EXPIRED' }] } });
  assert.equal(expired?.weekly, null);
  const fresh = questSummary(dashboard({ profile: { level: 0, rankKey: 'r', totalXp: 0, coinBalance: 0, currentStreak: 0, longestStreak: 0, levelProgress: { level: 1 } }, summary: { dailyCompleted: 5, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 } }));
  assert.equal(fresh?.level, 1);
  assert.equal(fresh?.dailyDone, 3);
});
