import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createQuestFakeDb } from './questFakeDb.js';
import {
  QUEST_TIMEZONE,
  addDaysYmd,
  daysInIsoWeek,
  isoWeekKey,
  startOfLocalDay,
} from './questTime.js';
import {
  assignDailyQuests,
  assignWeeklyQuests,
  claimQuest,
  completeQuest,
  expireStaleQuests,
  getQuestHistory,
  getQuestRewards,
  getRewardBalance,
  getUserQuestDashboard,
  loadHydrationGoalMl,
  reconciliationCutoffAt,
  updateQuestProgress,
} from './quest.js';
import { QuestSignal, refreshQuestProgressForUser } from './questSignals.js';
import { QUEST_ECONOMY, assertIssuableQuestReward, validateHydrationGoalMl } from './questEconomy.js';
import { onQuestCompleted } from './questRealtime.js';
import { publicQuest } from './questPrivacy.js';

const NOW = new Date('2026-09-06T12:00:00+04:00');
const TODAY = '2026-09-06';
const USER = 'user-quest-2';
const WEEK = isoWeekKey(TODAY);

async function seedHydration(db, goalMl = 2000) {
  await db.hydrationPreference.create({ data: { userId: USER, goalMl } });
}

async function seedSteps(db, status = 'AVAILABLE') {
  await db.stepTrackingCapability.create({
    data: { userId: USER, status, source: 'APPLE_HEALTH' },
  });
}

async function setup(extra = {}) {
  const db = createQuestFakeDb();
  if (extra.hydration !== false) await seedHydration(db, extra.goalMl || 2000);
  if (extra.steps !== false) await seedSteps(db, extra.stepStatus || 'AVAILABLE');
  const options = { db, now: extra.now || NOW, timezone: extra.timezone || QUEST_TIMEZONE };
  await assignDailyQuests(USER, extra.date || TODAY, options);
  if (extra.weekly !== false) await assignWeeklyQuests(USER, extra.week || WEEK, options);
  return { db, options };
}

function questByKey(rows, key) {
  return rows.find((row) => (row.template?.key || row.key) === key);
}

function resetQueries(db) {
  db._state.queryCount = 0;
  db._state.queryByModel = {};
}

async function allQuests(db) {
  return db.userQuest.findMany({ include: { template: true } });
}

describe('phase 2 economy — reject not clamp', () => {
  it('fails claim on an impossible reward without paying or mutating state', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await allQuests(db), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await completeQuest(USER, steps.id, options);
    await db.questTemplate.update({
      where: { id: steps.templateId },
      data: { rewardCoins: 300, rewardXp: 50 },
    });

    await assert.rejects(() => claimQuest(USER, steps.id, options), { code: 'QUEST_REWARD_CEILING' });
    const row = await db.userQuest.findUnique({ where: { id: steps.id } });
    assert.equal(row.status, 'COMPLETED');
    assert.ok(!row.claimedAt);
    const ledger = await db.rewardLedger.findMany({ where: { userId: USER } });
    assert.equal(ledger.length, 0);
  });

  it('does not silently issue a clamped amount', () => {
    assert.throws(
      () => assertIssuableQuestReward({ key: 'daily_steps', cadence: 'DAILY', rewardXp: 50, rewardCoins: 300 }),
      { code: 'QUEST_REWARD_CEILING' },
    );
  });
});

describe('phase 2 assignment eligibility', () => {
  it('does not assign daily_hydration without a server goal', async () => {
    const { db } = await setup({ hydration: false, weekly: false });
    const keys = (await allQuests(db)).map((row) => row.template.key).sort();
    assert.deepEqual(keys, ['daily_medi', 'daily_steps']);
  });

  it('assigns daily_hydration once a valid goal exists', async () => {
    const { db } = await setup({ weekly: false, goalMl: 2000 });
    const hydro = questByKey(await allQuests(db), 'daily_hydration');
    assert.ok(hydro);
    assert.equal(hydro.target, 100);
    assert.equal(hydro.metadata.goalBasisMl, 2000);
  });

  it('keeps an already assigned hydration quest if the goal later disappears', async () => {
    const { db, options } = await setup({ weekly: false });
    const hydro = questByKey(await allQuests(db), 'daily_hydration');
    await db.hydrationPreference.update({ where: { userId: USER }, data: { goalMl: 0 } });
    assert.equal(await loadHydrationGoalMl(db, USER), null);
    await assignDailyQuests(USER, TODAY, options);
    const row = await db.userQuest.findUnique({ where: { id: hydro.id } });
    assert.equal(row.status, 'ACTIVE');
    assert.equal(row.metadata.goalBasisMl, 2000);
  });
});

describe('phase 2 daily steps', () => {
  it('starts at 0 and uses the authoritative daily total', async () => {
    const { db, options } = await setup({ weekly: false });
    let steps = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options), 'daily_steps');
    assert.equal(steps.progress, 0);

    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 2400 } });
    steps = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options), 'daily_steps');
    assert.equal(steps.progress, 2400);
    assert.equal(publicQuest(steps).progressPercent, 48);
  });

  it('hits exact target and can store progress above target', async () => {
    const { db, options } = await setup({ weekly: false });
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 5000 } });
    let steps = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options), 'daily_steps');
    assert.equal(steps.status, 'COMPLETED');
    assert.equal(steps.progress, 5000);

    const { db: db2, options: opt2 } = await setup({ weekly: false });
    await db2.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 7200 } });
    steps = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_steps' }, opt2), 'daily_steps');
    assert.equal(steps.progress, 7200);
    assert.equal(publicQuest(steps).progressPercent, 100);
  });

  it('allows a downward correction while ACTIVE and freezes COMPLETED', async () => {
    const { db, options } = await setup({ weekly: false });
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 4800 } });
    await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options);
    await db.healthMetricDaily.update({
      where: { userId_date: { userId: USER, date: TODAY } },
      data: { steps: 4100 },
    });
    let steps = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options), 'daily_steps');
    assert.equal(steps.status, 'ACTIVE');
    assert.equal(steps.progress, 4100);

    await db.healthMetricDaily.update({
      where: { userId_date: { userId: USER, date: TODAY } },
      data: { steps: 5100 },
    });
    steps = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options), 'daily_steps');
    assert.equal(steps.status, 'COMPLETED');
    await db.healthMetricDaily.update({
      where: { userId_date: { userId: USER, date: TODAY } },
      data: { steps: 4700 },
    });
    const again = await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options);
    assert.equal(questByKey(again, 'daily_steps')?.status || 'COMPLETED', 'COMPLETED');
    const row = questByKey(await allQuests(db), 'daily_steps');
    assert.equal(row.status, 'COMPLETED');
    assert.equal((await db.questCompletion.findMany({ where: { userId: USER } })).length, 1);
  });

  it('is idempotent on repeated identical syncs', async () => {
    const { db, options } = await setup({ weekly: false });
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 5000 } });
    await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options);
    await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options);
    await refreshQuestProgressForUser(USER, QuestSignal.STEPS_CHANGED, options);
    assert.equal((await db.questCompletion.findMany({ where: { userId: USER } })).length, 1);
    assert.equal((await db.rewardLedger.findMany({ where: { userId: USER } })).length, 0);
  });
});

describe('phase 2 weekly steps', () => {
  it('sums authoritative daily totals for the assigned ISO week', async () => {
    const { db, options } = await setup();
    const days = daysInIsoWeek(WEEK);
    assert.equal(days[0], '2026-08-31');
    assert.equal(days[6], '2026-09-06');
    await db.healthMetricDaily.create({ data: { userId: USER, date: days[0], steps: 8000 } });
    await db.healthMetricDaily.create({ data: { userId: USER, date: days[6], steps: 9000 } });
    const weekly = questByKey(await updateQuestProgress(USER, { templateKey: 'weekly_steps' }, options), 'weekly_steps');
    assert.equal(weekly.progress, 17_000);
    assert.equal(weekly.status, 'ACTIVE');
  });

  it('does not use a client weekly total and can complete from the week sum', async () => {
    const { db, options } = await setup();
    for (const date of daysInIsoWeek(WEEK)) {
      await db.healthMetricDaily.create({ data: { userId: USER, date, steps: 5000 } });
    }
    const weekly = questByKey(await updateQuestProgress(USER, { templateKey: 'weekly_steps' }, options), 'weekly_steps');
    assert.equal(weekly.progress, 35_000);
    assert.equal(weekly.status, 'COMPLETED');
  });
});

describe('phase 2 delayed step reconciliation', () => {
  it('completes a daily movement quest inside the 6h grace', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await allQuests(db), 'daily_steps');
    const late = new Date('2026-09-07T03:00:00+04:00');
    assert.ok(late.getTime() <= reconciliationCutoffAt(steps).getTime());
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 5000 } });
    const updated = await updateQuestProgress(USER, { templateKey: 'daily_steps' }, { ...options, now: late });
    assert.equal(questByKey(updated, 'daily_steps').status, 'COMPLETED');
    const profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.lastActiveQuestDate, TODAY);
  });

  it('does not resurrect a daily movement quest after the grace', async () => {
    const { db, options } = await setup({ weekly: false });
    const late = new Date('2026-09-07T12:00:00+04:00');
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 5000 } });
    await updateQuestProgress(USER, { templateKey: 'daily_steps' }, { ...options, now: late });
    const row = questByKey(await allQuests(db), 'daily_steps');
    assert.equal(row.status, 'EXPIRED');
    assert.equal((await db.questCompletion.findMany({ where: { userId: USER } })).length, 0);
  });

  it('allows weekly reconciliation up to 12h after week end', async () => {
    const { db, options } = await setup();
    for (const date of daysInIsoWeek(WEEK)) {
      await db.healthMetricDaily.create({ data: { userId: USER, date, steps: 5000 } });
    }
    const late = new Date('2026-09-07T10:00:00+04:00');
    const weekly = questByKey(
      await updateQuestProgress(USER, { templateKey: 'weekly_steps' }, { ...options, now: late }),
      'weekly_steps',
    );
    assert.equal(weekly.status, 'COMPLETED');
  });
});

describe('phase 2 hydration', () => {
  it('computes 0 / 50 / 100 and clamps above the goal', async () => {
    const { db, options } = await setup({ weekly: false });
    let hydro = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_hydration' }, options), 'daily_hydration');
    assert.equal(hydro.progress, 0);

    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, hydrationMl: 1000 } });
    hydro = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_hydration' }, options), 'daily_hydration');
    assert.equal(hydro.progress, 50);

    await db.healthMetricDaily.update({
      where: { userId_date: { userId: USER, date: TODAY } },
      data: { hydrationMl: 2200 },
    });
    hydro = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_hydration' }, options), 'daily_hydration');
    assert.equal(hydro.progress, 100);
    assert.equal(hydro.status, 'COMPLETED');
  });

  it('freezes goalBasisMl so a later goal change does not rewrite the mission', async () => {
    const { db, options } = await setup({ weekly: false, goalMl: 2000 });
    await db.hydrationPreference.update({ where: { userId: USER }, data: { goalMl: 2500 } });
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, hydrationMl: 2000 } });
    const hydro = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_hydration' }, options), 'daily_hydration');
    assert.equal(hydro.metadata.goalBasisMl, 2000);
    assert.equal(hydro.progress, 100);
  });

  it('drops ACTIVE percent after a hydration correction and stays idempotent at 100%', async () => {
    const { db, options } = await setup({ weekly: false });
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, hydrationMl: 1500 } });
    await updateQuestProgress(USER, { templateKey: 'daily_hydration' }, options);
    await db.healthMetricDaily.update({
      where: { userId_date: { userId: USER, date: TODAY } },
      data: { hydrationMl: 0 },
    });
    let hydro = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_hydration' }, options), 'daily_hydration');
    assert.equal(hydro.progress, 0);
    await db.healthMetricDaily.update({
      where: { userId_date: { userId: USER, date: TODAY } },
      data: { hydrationMl: 2000 },
    });
    await updateQuestProgress(USER, { templateKey: 'daily_hydration' }, options);
    await refreshQuestProgressForUser(USER, QuestSignal.HYDRATION_CHANGED, options);
    assert.equal((await db.questCompletion.findMany({ where: { userId: USER } })).length, 1);
  });

  it('rejects an out-of-range hydration goal', () => {
    assert.throws(() => validateHydrationGoalMl(20), { code: 'HYDRATION_GOAL_RANGE' });
    assert.throws(() => validateHydrationGoalMl(20_000), { code: 'HYDRATION_GOAL_RANGE' });
    assert.equal(validateHydrationGoalMl(2000), 2000);
    assert.equal(QUEST_ECONOMY.hydrationGoalMlMin, 250);
  });
});

describe('phase 2 medi daily use', () => {
  it('stays at 0 until a successful DOCTOR/CONSILIUM interaction', async () => {
    const { db, options } = await setup({ weekly: false });
    let medi = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_medi' }, options), 'daily_medi');
    assert.equal(medi.progress, 0);

    await db.aiInteraction.create({
      data: {
        userId: USER,
        status: 'ERROR',
        mode: 'DOCTOR',
        createdAt: NOW,
        userPrompt: 'secret prompt',
        assistantReply: 'secret reply',
      },
    });
    medi = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_medi' }, options), 'daily_medi');
    assert.equal(medi.progress, 0);

    await db.aiInteraction.create({
      data: { userId: USER, status: 'OK', mode: 'DOCTOR', createdAt: NOW },
    });
    medi = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_medi' }, options), 'daily_medi');
    assert.equal(medi.progress, 1);
    assert.equal(medi.status, 'COMPLETED');
    const blob = JSON.stringify(medi);
    assert.equal(/secret prompt/.test(blob), false);
    assert.equal(/secret reply/.test(blob), false);
  });

  it('counts one qualifying interaction even across extra messages and sessions', async () => {
    const { db, options } = await setup({ weekly: false });
    await db.aiInteraction.create({ data: { userId: USER, status: 'OK', mode: 'DOCTOR', createdAt: NOW } });
    await db.aiInteraction.create({
      data: { userId: USER, status: 'OK', mode: 'CONSILIUM', createdAt: new Date(NOW.getTime() + 3600_000) },
    });
    await updateQuestProgress(USER, { templateKey: 'daily_medi' }, options);
    await refreshQuestProgressForUser(USER, QuestSignal.MEDI_USED, options);
    const medi = questByKey(await allQuests(db), 'daily_medi');
    assert.equal(medi.progress, 1);
    assert.equal((await db.questCompletion.findMany({ where: { userQuestId: medi.id } })).length, 1);
  });

  it('does not complete yesterday after local midnight', async () => {
    const { db, options } = await setup({ weekly: false });
    const afterRollover = new Date('2026-09-07T00:05:00+04:00');
    await db.aiInteraction.create({
      data: { userId: USER, status: 'OK', mode: 'DOCTOR', createdAt: afterRollover },
    });
    await updateQuestProgress(USER, { templateKey: 'daily_medi' }, { ...options, now: afterRollover });
    const yesterday = questByKey(await allQuests(db), 'daily_medi');
    assert.equal(yesterday.periodKey, TODAY);
    assert.equal(yesterday.status, 'EXPIRED');
    assert.equal(yesterday.progress, 0);
  });

  it('attributes a near-midnight interaction to the assigned local day', async () => {
    const { db, options } = await setup({ weekly: false });
    const justAfterMidnight = new Date(startOfLocalDay(TODAY, QUEST_TIMEZONE).getTime() + 60_000);
    await db.aiInteraction.create({
      data: { userId: USER, status: 'OK', mode: 'DOCTOR', createdAt: justAfterMidnight },
    });
    const medi = questByKey(await updateQuestProgress(USER, { templateKey: 'daily_medi' }, options), 'daily_medi');
    assert.equal(medi.progress, 1);
    assert.equal(medi.status, 'COMPLETED');
  });
});

describe('phase 2 completion / streak / claim', () => {
  it('writes one completion and one streak bump with no ledger until claim', async () => {
    const events = [];
    const stop = onQuestCompleted((payload) => events.push(payload));
    const { db, options } = await setup({ weekly: false });
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 5000 } });
    await Promise.all([
      updateQuestProgress(USER, { templateKey: 'daily_steps' }, options),
      updateQuestProgress(USER, { templateKey: 'daily_steps' }, options),
      refreshQuestProgressForUser(USER, QuestSignal.STEPS_CHANGED, options),
    ]);
    stop();
    assert.equal((await db.questCompletion.findMany({ where: { userId: USER } })).length, 1);
    const profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.currentStreak, 1);
    assert.equal((await db.rewardLedger.findMany({ where: { userId: USER } })).length, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0].key, 'daily_steps');
    assert.equal(events[0].periodKey, TODAY);
    assert.ok(!('hydrationMl' in events[0]));
  });

  it('uses the quest periodKey for a late completion after midnight', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await allQuests(db), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    const late = new Date('2026-09-07T03:00:00+04:00');
    await completeQuest(USER, steps.id, { ...options, now: late });
    const profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.lastActiveQuestDate, TODAY);
    assert.equal(profile.currentStreak, 1);
  });

  it('pays once on concurrent claim', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await allQuests(db), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await completeQuest(USER, steps.id, options);
    const [a, b] = await Promise.all([
      claimQuest(USER, steps.id, options),
      claimQuest(USER, steps.id, options),
    ]);
    assert.equal([a, b].filter((row) => row.claimed).length, 1);
    const balance = await getRewardBalance(USER, options);
    assert.equal(balance.xp, 50);
    assert.equal(balance.coins, 30);
  });

  it('allows claim after midnight and long after completion', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await allQuests(db), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await completeQuest(USER, steps.id, options);
    const later = new Date('2026-09-20T10:00:00+04:00');
    const claimed = await claimQuest(USER, steps.id, { ...options, now: later });
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.quest.status, 'CLAIMED');
  });
});

describe('phase 2 API models', () => {
  it('returns a mobile-ready dashboard with claimable and progressPercent', async () => {
    const { db } = await setup();
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 7200, hydrationMl: 500 } });
    const dash = await getUserQuestDashboard(USER, { db, now: NOW });
    assert.ok(dash.profile.level);
    assert.ok(dash.profile.rankKey);
    assert.equal(dash.daily.periodKey, TODAY);
    assert.equal(dash.weekly.periodKey, WEEK);
    const steps = questByKey(dash.daily.quests, 'daily_steps');
    assert.equal(steps.progress, 7200);
    assert.equal(steps.progressPercent, 100);
    assert.equal(steps.claimable, true);
    assert.equal(steps.metadata, undefined);
    assert.equal(dash.summary.dailyClaimable, 1);
    assert.equal(dash.summary.unclaimedRewards, 1);
  });

  it('paginates history and distinguishes COMPLETED / CLAIMED / EXPIRED', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await allQuests(db), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await completeQuest(USER, steps.id, options);
    const medi = questByKey(await allQuests(db), 'daily_medi');
    await db.userQuest.update({
      where: { id: medi.id },
      data: { expiresAt: new Date('2026-09-05T23:59:59+04:00') },
    });
    await expireStaleQuests(USER, options);
    await claimQuest(USER, steps.id, options);

    const history = await getQuestHistory(USER, { ...options, take: 10 });
    const byKey = Object.fromEntries(history.items.map((row) => [row.key, row]));
    assert.equal(byKey.daily_steps.status, 'CLAIMED');
    assert.equal(byKey.daily_steps.claimable, false);
    assert.equal(byKey.daily_medi.status, 'EXPIRED');
    assert.ok(!JSON.stringify(history).includes('goalBasisMl'));
  });

  it('returns generic ledger semantics for rewards', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await allQuests(db), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await claimQuest(USER, steps.id, options);
    const rewards = await getQuestRewards(USER, options);
    assert.equal(rewards.balance.coins, 30);
    assert.equal(rewards.balance.xp, 50);
    assert.equal(rewards.totalEarned.coins, 30);
    assert.equal(rewards.totalSpent.coins, 0);
    assert.equal(rewards.transactions.length, 2);
  });

  it('registers hydration goal routes behind auth', async () => {
    const { healthMetricsRouter } = await import('../routes/health-metrics.routes.js');
    const routes = healthMetricsRouter.stack.filter((layer) => layer.route);
    assert.ok(routes.some((layer) => layer.route.path === '/hydration/goal' && layer.route.methods.put));
    assert.ok(routes.some((layer) => layer.route.path === '/hydration/goal' && layer.route.methods.get));
    assert.ok(healthMetricsRouter.stack.some((layer) => layer.handle?.name === 'requireAuth'));
  });
});

describe('phase 2 performance', () => {
  it('batches daily metric reads instead of querying per quest/day', async () => {
    const { db, options } = await setup();
    for (const date of daysInIsoWeek(WEEK)) {
      await db.healthMetricDaily.create({ data: { userId: USER, date, steps: 1000, hydrationMl: 200 } });
    }
    resetQueries(db);
    await updateQuestProgress(USER, {}, options);
    assert.equal(db._state.queryByModel.healthMetricDaily, 1);
    assert.ok((db._state.queryByModel.aiInteraction || 0) <= 1);
  });
});

describe('phase 2 signal router', () => {
  it('only refreshes matching progress types', async () => {
    const { db, options } = await setup();
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 5000, hydrationMl: 2000 } });
    await db.aiInteraction.create({ data: { userId: USER, status: 'OK', mode: 'DOCTOR', createdAt: NOW } });
    await refreshQuestProgressForUser(USER, QuestSignal.STEPS_CHANGED, options);
    const rows = await allQuests(db);
    assert.equal(questByKey(rows, 'daily_steps').status, 'COMPLETED');
    assert.equal(questByKey(rows, 'daily_hydration').status, 'ACTIVE');
    assert.equal(questByKey(rows, 'daily_medi').status, 'ACTIVE');
  });
});

describe('phase 2 timezone / frozen assignment', () => {
  it('keeps the original periodKey after a later timezone change', async () => {
    const { db, options } = await setup({ timezone: 'Asia/Tbilisi' });
    const before = (await allQuests(db)).filter((row) => row.template.cadence === 'DAILY');
    assert.ok(before.every((row) => row.periodKey === TODAY));
    await assignDailyQuests(USER, null, { ...options, timezone: 'Europe/Brussels', now: NOW });
    const after = (await allQuests(db)).filter((row) => row.template.cadence === 'DAILY');
    assert.ok(after.every((row) => row.periodKey === TODAY));
  });
});

describe('phase 2 reset script guard', () => {
  it('requires an explicit env confirmation and never runs on boot', () => {
    const script = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/quest-reset-dev.js'),
      'utf8',
    );
    assert.match(script, /QUEST_RESET_DEV/);
    assert.match(script, /QUEST_RESET_ALLOW_PROD/);
    const server = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../server.js'),
      'utf8',
    );
    assert.equal(server.includes('quest-reset-dev'), false);
  });
});
