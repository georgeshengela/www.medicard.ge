import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFoodUsage } from './adminUsageFood.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi
const at = (s) => new Date(s);
const meal = (userId, date, type, source, created, extra = {}) => ({
  userId, date, type, source, createdAt: at(created), updatedAt: at(extra.updated || created), itemCount: extra.items ?? 1,
  // Fields the real loader never selects — here to prove the builder never passes them on.
  title: 'ხაჭაპური აჭარული', note: 'secret note',
});

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 10,
    people: [
      { id: 'team', fullName: 'Demo', email: 'demo@medicard.ge', phone: null, createdAt: at('2026-03-24T08:00:00Z'), lastSeenAt: at('2026-10-11T08:00:00Z') },
      { id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null, createdAt: at('2026-10-01T08:00:00Z'), lastSeenAt: at('2026-10-10T08:00:00Z') },
      { id: 'u2', fullName: 'Giorgi', email: 'x@apple.medicard.ge', phone: null, createdAt: at('2026-10-08T08:00:00Z'), lastSeenAt: null },
      { id: 'u3', fullName: 'Ana', email: 'ana@example.com', phone: null, createdAt: at('2026-09-01T08:00:00Z'), lastSeenAt: null },
    ],
    meals: [
      meal('u1', '2026-10-01', 'breakfast', 'photo', '2026-10-01T09:00:00Z', { items: 2 }),
      meal('u1', '2026-10-01', 'lunch', 'text', '2026-10-01T10:00:00Z', { items: 3, updated: '2026-10-01T12:00:00Z' }),
      meal('u1', '2026-10-09', 'dinner', 'search', '2026-10-09T15:00:00Z'),
      meal('u1', '2026-10-10', 'lunch', 'plan', '2026-10-10T09:00:00Z'),
      meal('u2', '2026-10-07', 'snack', 'manual', '2026-10-08T10:00:00Z'), // written a day later
      meal('team', '2026-10-10', 'lunch', 'photo', '2026-10-10T10:00:00Z'),
      meal('team', '2026-10-10', 'dinner', 'photo', '2026-10-10T16:00:00Z'),
    ],
    programs: [
      { userId: 'u1', active: true, mode: 'lose', pace: 'steady', diet: 'balanced', activity: 'light', updatedAt: at('2026-10-02T08:00:00Z') },
      { userId: 'u3', active: false, mode: 'maintain', pace: 'gentle', diet: 'vegan', activity: 'active', updatedAt: at('2026-09-20T08:00:00Z') },
      { userId: 'team', active: true, mode: 'gain', pace: 'steady', diet: 'balanced', activity: 'moderate', updatedAt: at('2026-10-03T08:00:00Z') },
    ],
    planned: [
      { userId: 'u1', count: 14, firstAt: at('2026-10-02T08:00:00Z'), lastAt: at('2026-10-02T08:00:00Z') },
      { userId: 'team', count: 28, firstAt: at('2026-10-03T08:00:00Z'), lastAt: at('2026-10-03T08:00:00Z') },
    ],
    activities: [
      { userId: 'u1', kind: 'walk', createdAt: at('2026-10-09T16:00:00Z') },
      { userId: 'team', kind: 'run', createdAt: at('2026-10-09T16:00:00Z') },
    ],
    fasts: [{ userId: 'u1', startedAt: at('2026-10-09T18:00:00Z'), endedAt: at('2026-10-10T10:30:00Z'), targetMinutes: 960, protocol: '16:8', createdAt: at('2026-10-09T18:00:00Z') }],
    measurements: [{ userId: 'u2', createdAt: at('2026-10-08T11:00:00Z') }],
    foods: [{ userId: 'u1', source: 'meal', favorite: true, hasBarcode: false, createdAt: at('2026-10-01T09:01:00Z') }],
    preferences: [{ userId: 'u1', updatedAt: at('2026-10-09T17:00:00Z'), reminders: true, rollover: false, addBurned: false, countSteps: true, macrosCustom: false, screened: true }],
    products: { total: 5, hits: 9 },
    weightDays: [{ userId: 'u1', count: 3 }, { userId: 'u2', count: 1 }, { userId: 'team', count: 50 }, { userId: 'u9', count: 4 }],
    weightAdvice: [
      { userId: 'u1', status: 'OK', latencyMs: 8000, tokenUsage: { cost: 0.004 }, createdAt: at('2026-10-09T10:00:00Z') },
      { userId: 'team', status: 'ERROR', latencyMs: 30000, tokenUsage: { cost: null }, createdAt: at('2026-10-09T10:00:00Z') },
    ],
    scans: [
      { success: true, durationMs: 10000, createdAt: at('2026-10-09T10:00:00Z') },
      { success: false, durationMs: 30000, createdAt: at('2026-10-09T11:00:00Z') },
      { success: true, durationMs: 5000, createdAt: at('2026-09-01T10:00:00Z') },
    ],
    settings: { photoEnabled: false, programEnabled: true },
    signups: [
      { id: 'u1', createdAt: at('2026-10-01T08:00:00Z') },
      { id: 'u2', createdAt: at('2026-10-08T08:00:00Z') },
      { id: 'u9', createdAt: at('2026-10-09T08:00:00Z') },
    ],
    appActivity: [
      { userId: 'u1', date: '2026-10-01' },
      { userId: 'u1', date: '2026-10-05' },
      { userId: 'u2', date: '2026-10-08' },
    ],
    flags: [{ key: 'nutrition', enabled: true, effective: true }, { key: 'nutritionAi', enabled: false, effective: false }],
  };
}

test('team accounts are left out by default: counts, ladder, people', () => {
  const d = buildFoodUsage(fixture(), { days: 30, now: NOW });
  assert.equal(d.totals.accounts, 9);
  assert.equal(d.totals.users, 3);
  assert.equal(d.totals.loggers, 2);
  assert.equal(d.totals.meals, 5);
  assert.deepEqual(d.team, { accounts: 1, users: 1, meals: 2 });
  assert.equal(d.items.some((p) => p.person.team), false);
  assert.equal(d.itemsTotal, 3);
  assert.equal(d.program.goals.gain, 0);
  assert.equal(d.tools.activity.kinds.run, 0);
  assert.equal(d.ai.weightAdvice.errors, 0);
  assert.equal(d.flags.nutritionAi.effective, false);
  assert.equal(d.settings.photoEnabled, false);
});

test('ladder: anyone in MEDIFOOD → logged → AI → came back → plan → 7 diary days', () => {
  const d = buildFoodUsage(fixture(), { days: 30, now: NOW });
  const ladder = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
  // u3 only has a paused program; u2 logged once by hand; u1 did everything on several days.
  assert.deepEqual(ladder, { users: 3, logged: 2, ai: 1, returned: 1, plan: 2, habit: 0 });
  assert.equal(d.ladder[0].rate, 100);
  assert.equal(d.ladder[1].rate, 66.7);
});

test('a person card: counts only — meals, diary days, methods, plan, fasting, activity', () => {
  const d = buildFoodUsage(fixture(), { days: 30, now: NOW });
  const [first] = d.items;
  assert.equal(first.id, 'u1'); // newest activity first (plan meal on 10 Oct)
  assert.equal(first.meals, 4);
  assert.equal(first.days, 3);
  assert.deepEqual(first.methods, { photo: 1, label: 0, text: 1, voice: 0, search: 1, saved: 0, barcode: 0, manual: 0, plan: 1 });
  assert.equal(first.ai, 2);
  assert.equal(first.program, 'active');
  assert.equal(first.planned, 14);
  assert.equal(first.planEaten, 1);
  assert.deepEqual(first.fasting, { screened: true, fasts: 1 });
  assert.equal(first.activities, 1);
  assert.equal(first.foods, 1);
  assert.equal(first.weekLogged, true);
  assert.equal(first.lastMealAt, '2026-10-10T09:00:00.000Z');
  assert.equal(first.person.contact, '+995 599 12 34 56');
  const u3 = d.items.find((p) => p.id === 'u3');
  assert.equal(u3.meals, 0);
  assert.equal(u3.program, 'paused');
  assert.equal(u3.lastMealAt, null);
});

test('privacy: no meal names, notes or weights reach the payload', () => {
  const json = JSON.stringify(buildFoodUsage(fixture(), { days: 90, includeTeam: true, now: NOW }));
  assert.equal(json.includes('ხაჭაპური'), false);
  assert.equal(json.includes('secret note'), false);
  assert.equal(/weightKg|waistCm|calories|protein/.test(json), false);
});

test('logging habits, first meal timing, program, tools and AI quality', () => {
  const d = buildFoodUsage(fixture(), { days: 30, now: NOW });
  assert.deepEqual(d.logging.sources, { photo: 1, label: 0, text: 1, voice: 0, search: 1, saved: 0, barcode: 0, manual: 1, plan: 1 });
  assert.deepEqual(d.logging.types, { breakfast: 1, lunch: 2, dinner: 1, snack: 1 });
  assert.deepEqual(d.logging.daysDist, { d1: 1, d2_3: 1, d4_6: 0, d7_13: 0, d14: 0 });
  assert.equal(d.logging.edited, 1);
  assert.equal(d.logging.backdated, 1);
  assert.equal(d.logging.itemsPerMeal, 1.6);
  assert.equal(d.totals.onlyOnce, 1);
  assert.equal(d.totals.maxDays, 3);
  assert.equal(d.totals.personDays, 4);
  assert.equal(d.totals.aiShare, 40);
  assert.equal(d.totals.weekLoggers, 2);
  assert.equal(d.totals.appReturned, 1);
  assert.deepEqual({ ...d.firstMeal, medianHours: undefined }, { sameDay: 2, week: 0, later: 0, medianHours: undefined });
  assert.equal(d.firstMeal.medianHours, 1.5);
  assert.deepEqual({ users: d.program.users, active: d.program.active, paused: d.program.paused }, { users: 2, active: 1, paused: 1 });
  assert.equal(d.program.goals.lose, 1);
  assert.equal(d.program.goals.maintain, 0); // paused programs are not counted in the goals
  assert.equal(d.program.plannedMeals, 14);
  assert.equal(d.program.eaten, 1);
  assert.equal(d.tools.fasting.reachedGoal, 1);
  assert.equal(d.tools.fasting.medianHours, 16.5);
  assert.equal(d.tools.fasting.screened, 1);
  assert.deepEqual(d.tools.weight, { users: 2, tracked: 1 });
  assert.equal(d.tools.products.total, 5);
  assert.equal(d.ai.scans.total, 3);
  assert.equal(d.ai.scans.failed, 1);
  assert.equal(d.ai.scans.avgMs, 15000);
  assert.equal(d.ai.savedAll, 4); // scans carry no account, so the ratio uses AI meals of every account
});

test('period: meals, new loggers, signups that logged, scans and the daily trend', () => {
  const d = buildFoodUsage(fixture(), { days: 7, now: NOW });
  assert.equal(d.period.from, '2026-10-05');
  assert.equal(d.period.to, '2026-10-11');
  assert.equal(d.period.meals, 3);
  assert.equal(d.period.loggers, 2);
  assert.equal(d.period.newLoggers, 1);
  assert.equal(d.period.activeUsers, 2);
  assert.equal(d.period.aiMeals, 0);
  assert.equal(d.period.signups, 2);
  assert.equal(d.period.signupsLogged, 1);
  assert.equal(d.period.signupRate, 50);
  assert.equal(d.period.scans.total, 2);
  assert.equal(d.period.scans.failed, 1);
  assert.equal(d.period.trend.meals.length, 7);
  assert.equal(d.period.trend.meals.reduce((s, p) => s + p.count, 0), 3);
  assert.deepEqual(d.period.trend.meals.find((p) => p.day === '2026-10-08'), { day: '2026-10-08', count: 1 });
});

test('including the team brings its meals, plan and Medi weight advice back', () => {
  const d = buildFoodUsage(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(d.totals.accounts, 10);
  assert.equal(d.totals.users, 4);
  assert.equal(d.totals.meals, 7);
  assert.equal(d.program.goals.gain, 1);
  assert.equal(d.ai.weightAdvice.errors, 1);
  assert.equal(d.items.find((p) => p.id === 'team').person.team, true);
  assert.equal(Object.fromEntries(d.ladder.map((s) => [s.key, s.count])).ai, 2);
});

test('empty data: no crash, sensible zeros', () => {
  const d = buildFoodUsage({}, { now: NOW });
  assert.equal(d.installed, true);
  assert.equal(d.totals.users, 0);
  assert.equal(d.totals.userRate, null);
  assert.equal(d.totals.mealsPerDay, null);
  assert.deepEqual(d.ladder.map((s) => s.count), [0, 0, 0, 0, 0, 0]);
  assert.equal(d.ladder[1].rate, null);
  assert.deepEqual(d.items, []);
  assert.equal(d.itemsTotal, 0);
  assert.equal(d.period.trend.meals.length, 30);
  assert.equal(d.ai.scans.avgMs, null);
  assert.equal(d.ai.savedRate, null);
  assert.equal(d.firstMeal.medianHours, null);
  assert.equal(d.flags.nutrition.effective, true);
  assert.equal(d.settings.photoEnabled, true);
});
