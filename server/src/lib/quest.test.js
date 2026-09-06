import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  getLevelForXp,
  getLevelProgress,
  getLevelRankKey,
  getXpThresholdForLevel,
  QUEST_LEVEL_1_20,
} from './questLevels.js';
import {
  QUEST_TIMEZONE,
  QUEST_TIMEZONE_FALLBACK,
  addDaysYmd,
  canAssignNewDailyPeriod,
  dailyPeriodKey,
  daysInIsoWeek,
  endOfLocalDay,
  getEffectiveQuestTimezone,
  isoWeekKey,
  mondayOfIsoWeek,
  normalizeQuestTimezone,
  questYmd,
  startOfLocalDay,
  weeklyPeriodKey,
} from './questTime.js';
import { QUEST_FORBIDDEN_KEYS, publicQuest, sanitizeQuestJson } from './questPrivacy.js';
import { createQuestFakeDb } from './questFakeDb.js';
import {
  assignDailyQuests,
  assignWeeklyQuests,
  claimQuest,
  completeQuest,
  expireStaleQuests,
  getQuestHistory,
  getRewardBalance,
  getRewardLedger,
  getUserQuestDashboard,
  reconcileQuestProfile,
  updateQuestProgress,
} from './quest.js';
import { INITIAL_QUEST_TEMPLATES } from './questTemplates.js';
import { QUEST_ECONOMY, assertIssuableQuestReward, validateQuestRewardAmounts } from './questEconomy.js';

const NOW = new Date('2026-09-06T12:00:00+04:00');
const TODAY = '2026-09-06';
const USER = 'user-quest-1';

async function seedHydrationGoal(db, goalMl = 2000) {
  await db.hydrationPreference.create({ data: { userId: USER, goalMl } });
}

async function seedStepCapability(db, status = 'AVAILABLE') {
  await db.stepTrackingCapability.create({
    data: { userId: USER, status, source: 'APPLE_HEALTH' },
  });
}

async function setup(extra = {}) {
  const db = createQuestFakeDb();
  if (extra.hydrationGoal !== false) {
    await seedHydrationGoal(db, extra.hydrationGoal || 2000);
  }
  if (extra.steps !== false) {
    await seedStepCapability(db, extra.stepStatus || 'AVAILABLE');
  }
  const options = { db, now: extra.now || NOW, timezone: QUEST_TIMEZONE };
  await assignDailyQuests(USER, extra.date || TODAY, options);
  if (extra.weekly !== false) await assignWeeklyQuests(USER, extra.week, options);
  return { db, options };
}

function questByKey(rows, key) {
  return rows.find((row) => (row.template?.key || row.key) === key);
}

describe('getLevelForXp', () => {
  it('starts at level 1 with the locked table', () => {
    assert.equal(getXpThresholdForLevel(1), 0);
    assert.equal(getXpThresholdForLevel(2), 200);
    assert.equal(getXpThresholdForLevel(3), 450);
    const start = getLevelForXp(0);
    assert.equal(start.level, 1);
    assert.equal(start.levelStartXp, 0);
    assert.equal(start.nextLevelXp, 200);
    assert.equal(start.xpNeededForNextLevel, 200);
    assert.equal(start.progressPercent, 0);
    assert.equal(start.rankKey, 'LEVEL_1_4');
    assert.equal(start.isMaxLevel, false);
  });

  it('places XP inside the current level', () => {
    const mid = getLevelProgress(199);
    assert.equal(mid.level, 1);
    assert.equal(getLevelForXp(200).level, 2);
    assert.equal(getLevelForXp(201).level, 2);
    const into = getLevelForXp(300);
    assert.equal(into.level, 2);
    assert.equal(into.xpIntoLevel, 100);
    assert.equal(into.nextLevelXp, 450);
  });
});

describe('timezone boundaries', () => {
  it('uses the MediCard Tbilisi calendar, not server UTC', () => {
    const justAfterTbilisiMidnight = new Date('2026-09-05T20:30:00.000Z');
    assert.equal(justAfterTbilisiMidnight.toISOString().slice(0, 10), '2026-09-05');
    assert.equal(questYmd(justAfterTbilisiMidnight), '2026-09-06');
    assert.equal(dailyPeriodKey(justAfterTbilisiMidnight), '2026-09-06');

    const stillFridayInTbilisi = new Date('2026-09-05T19:30:00.000Z');
    assert.equal(questYmd(stillFridayInTbilisi), '2026-09-05');
    assert.equal(QUEST_TIMEZONE, 'Asia/Tbilisi');
  });

  it('assigns the Tbilisi local day when UTC has already flipped', async () => {
    const now = new Date('2026-09-05T20:30:00.000Z');
    const db = createQuestFakeDb();
    const assigned = await assignDailyQuests(USER, null, { db, now });
    assert.ok(assigned.every((row) => row.periodKey === '2026-09-06'));
    assert.equal(weeklyPeriodKey(now), isoWeekKey('2026-09-06'));
  });
});

describe('daily assignment', () => {
  it('assigns the controlled daily template set', async () => {
    const { db } = await setup({ weekly: false });
    const rows = await db.userQuest.findMany({ where: { userId: USER }, include: { template: true } });
    const keys = rows.map((row) => row.template.key).sort();
    assert.deepEqual(keys, ['daily_hydration', 'daily_medi', 'daily_steps']);
    assert.ok(rows.every((row) => row.status === 'ACTIVE'));
    assert.ok(rows.every((row) => row.periodKey === TODAY));
  });

  it('does not duplicate the same template for the same period', async () => {
    const { db, options } = await setup({ weekly: false });
    const first = await db.userQuest.findMany({ where: { userId: USER } });
    const second = await assignDailyQuests(USER, TODAY, options);
    const again = await db.userQuest.findMany({ where: { userId: USER } });
    assert.equal(first.length, again.length);
    assert.ok(second.every((row) => row.created === false));
  });
});

describe('weekly assignment', () => {
  it('assigns weekly_steps once per ISO week', async () => {
    const { db, options } = await setup();
    const week = isoWeekKey(TODAY);
    const weekly = await db.userQuest.findMany({
      where: { userId: USER, periodKey: week },
      include: { template: true },
    });
    assert.equal(weekly.length, 1);
    assert.equal(weekly[0].template.key, 'weekly_steps');
    assert.equal(weekly[0].target, 35_000);
    assert.deepEqual(daysInIsoWeek(week).length, 7);

    await assignWeeklyQuests(USER, week, options);
    const again = await db.userQuest.findMany({ where: { userId: USER, periodKey: week } });
    assert.equal(again.length, 1);
  });
});

describe('progress / completion', () => {
  it('updates progress from server-side metrics only', async () => {
    const { db, options } = await setup({ weekly: false });
    await db.healthMetricDaily.create({
      data: { userId: USER, date: TODAY, steps: 3500, hydrationMl: 800 },
    });
    const updated = await updateQuestProgress(USER, {}, options);
    const steps = questByKey(updated, 'daily_steps');
    const hydro = questByKey(updated, 'daily_hydration');
    assert.equal(steps.progress, 3500);
    assert.equal(hydro.progress, 40);
    assert.equal(steps.status, 'ACTIVE');
  });

  it('rejects client-submitted progress numbers', async () => {
    const { options } = await setup({ weekly: false });
    await assert.rejects(() => updateQuestProgress(USER, { progress: 9999 }, options), {
      status: 400,
    });
  });

  it('completes a quest when computed progress reaches the target', async () => {
    const { db, options } = await setup({ weekly: false });
    await db.healthMetricDaily.create({
      data: { userId: USER, date: TODAY, steps: 8000 },
    });
    const updated = await updateQuestProgress(USER, { templateKey: 'daily_steps' }, options);
    const steps = questByKey(updated, 'daily_steps');
    assert.equal(steps.status, 'COMPLETED');
    const completions = await db.questCompletion.findMany({ where: { userId: USER } });
    assert.equal(completions.length, 1);
    assert.equal(completions[0].progressAtCompletion, 8000);
    assert.equal(completions[0].source, 'sync');
  });

  it('is idempotent on duplicate completion', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(
      await db.userQuest.findMany({ include: { template: true } }),
      'daily_steps',
    );
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 8000 } });
    const first = await completeQuest(USER, steps.id, { ...options, source: 'system' });
    const second = await completeQuest(USER, steps.id, { ...options, source: 'system' });
    assert.equal(first.completed, true);
    assert.equal(second.alreadyCompleted, true);
    const completions = await db.questCompletion.findMany({ where: { userQuestId: steps.id } });
    assert.equal(completions.length, 1);
  });
});

describe('rewards', () => {
  it('pays XP and coins once through the ledger', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(
      await db.userQuest.findMany({ include: { template: true } }),
      'daily_steps',
    );
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 8000 } });
    const first = await claimQuest(USER, steps.id, options);
    const second = await claimQuest(USER, steps.id, options);

    assert.equal(first.claimed, true);
    assert.equal(first.rewards.xp, 50);
    assert.equal(first.rewards.coins, 30);
    assert.equal(first.reward.xpAwarded, 50);
    assert.equal(first.reward.coinsAwarded, 30);
    assert.equal(second.alreadyClaimed, true);
    assert.equal(second.rewards.xp, 0);

    const balance = await getRewardBalance(USER, options);
    assert.equal(balance.xp, 50);
    assert.equal(balance.coins, 30);
    const ledger = await getRewardLedger(USER, options);
    assert.equal(ledger.length, 2);
    assert.deepEqual(ledger.map((row) => row.currency).sort(), ['COIN', 'XP']);
    assert.ok(ledger.every((row) => row.sourceId === steps.id));
    assert.equal(first.quest.status, 'CLAIMED');
    assert.equal(first.profile.currentLevel, 1);
    assert.equal(first.profile.levelProgress.level, 1);
  });

  it('never lets the same completion pay twice even if ledger writes race', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(
      await db.userQuest.findMany({ include: { template: true } }),
      'daily_steps',
    );
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 8000 } });
    await completeQuest(USER, steps.id, options);
    const [a, b] = await Promise.all([
      claimQuest(USER, steps.id, options),
      claimQuest(USER, steps.id, options),
    ]);
    const paid = [a, b].filter((row) => row.claimed);
    assert.equal(paid.length, 1);
    const balance = await getRewardBalance(USER, options);
    assert.equal(balance.xp, 50);
    assert.equal(balance.coins, 30);
  });
});

describe('streak', () => {
  it('increments on consecutive local days and does not double-count the same day', async () => {
    const db = createQuestFakeDb();
    await seedHydrationGoal(db);
    await seedStepCapability(db);
    const day1 = new Date('2026-09-06T12:00:00+04:00');
    await assignDailyQuests(USER, '2026-09-06', { db, now: day1 });
    const steps1 = questByKey(
      await db.userQuest.findMany({ include: { template: true } }),
      'daily_steps',
    );
    await db.userQuest.update({ where: { id: steps1.id }, data: { progress: 8000 } });
    await completeQuest(USER, steps1.id, { db, now: day1 });
    await completeQuest(USER, steps1.id, { db, now: day1 });

    const hydro = questByKey(
      await db.userQuest.findMany({ include: { template: true } }),
      'daily_hydration',
    );
    await db.userQuest.update({ where: { id: hydro.id }, data: { progress: 100 } });
    await completeQuest(USER, hydro.id, { db, now: day1 });

    let profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.currentStreak, 1);
    assert.equal(profile.lastActiveQuestDate, '2026-09-06');

    const day2 = new Date('2026-09-07T12:00:00+04:00');
    await assignDailyQuests(USER, '2026-09-07', { db, now: day2 });
    const steps2 = (await db.userQuest.findMany({ include: { template: true } })).find(
      (row) => row.template.key === 'daily_steps' && row.periodKey === '2026-09-07',
    );
    await db.userQuest.update({ where: { id: steps2.id }, data: { progress: 8000 } });
    await completeQuest(USER, steps2.id, { db, now: day2 });
    profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.currentStreak, 2);
    assert.equal(profile.longestStreak, 2);

    const day4 = new Date('2026-09-09T12:00:00+04:00');
    await assignDailyQuests(USER, '2026-09-09', { db, now: day4 });
    const steps4 = (await db.userQuest.findMany({ include: { template: true } })).find(
      (row) => row.template.key === 'daily_steps' && row.periodKey === '2026-09-09',
    );
    await db.userQuest.update({ where: { id: steps4.id }, data: { progress: 8000 } });
    await completeQuest(USER, steps4.id, { db, now: day4 });
    profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.currentStreak, 1);
    assert.equal(profile.longestStreak, 2);
  });
});

describe('expired and inactive templates', () => {
  it('expires active quests past expiresAt and blocks completion', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(
      await db.userQuest.findMany({ include: { template: true } }),
      'daily_steps',
    );
    await db.userQuest.update({
      where: { id: steps.id },
      data: { progress: 8000, expiresAt: new Date('2026-09-05T23:59:59+04:00') },
    });
    const expired = await expireStaleQuests(USER, options);
    assert.equal(expired, 1);
    await assert.rejects(() => completeQuest(USER, steps.id, options), { status: 409 });
  });

  it('does not assign an inactive template', async () => {
    const db = createQuestFakeDb();
    await seedStepCapability(db);
    const options = { db, now: NOW };
    await assignDailyQuests(USER, TODAY, options);
    const hydro = await db.questTemplate.findUnique({ where: { key: 'daily_hydration' } });
    await db.questTemplate.update({ where: { id: hydro.id }, data: { isActive: false } });
    const nextNow = new Date('2026-09-07T12:00:00+04:00');
    const nextDay = await assignDailyQuests(USER, addDaysYmd(TODAY, 1), { ...options, now: nextNow });
    assert.ok(!nextDay.some((row) => row.template.key === 'daily_hydration'));
    assert.ok(nextDay.some((row) => row.template.key === 'daily_steps'));
  });
});

describe('privacy', () => {
  it('strips health notes, medication names, and other forbidden fields', () => {
    const clean = sanitizeQuestJson({
      source: 'dose_events',
      medName: 'Aspirin',
      notes: 'patient journal',
      diagnosis: 'migraine',
      chat: 'hello medi',
      progress: 2,
    });
    assert.equal(clean.source, 'dose_events');
    assert.equal(clean.progress, 2);
    assert.equal(clean.medName, undefined);
    assert.equal(clean.notes, undefined);
    assert.equal(clean.diagnosis, undefined);
    assert.equal(clean.chat, undefined);
  });

  it('keeps assignment metadata and API DTOs free of health content', async () => {
    const { db, options } = await setup();
    const rows = await db.userQuest.findMany({ include: { template: true } });
    for (const row of rows) {
      const blob = JSON.stringify({ metadata: row.metadata, dto: publicQuest(row) });
      for (const key of QUEST_FORBIDDEN_KEYS) {
        assert.equal(new RegExp(`"${key}"\\s*:`, 'i').test(blob), false, key);
      }
    }
    const history = await getQuestHistory(USER, options);
    assert.ok(history.items.every((item) => item.progress != null && item.medName == null));
  });
});

describe('API auth', () => {
  it('registers requireAuth on every quests route', async () => {
    const { questsRouter } = await import('../routes/quests.routes.js');
    const names = questsRouter.stack.map((layer) => layer.handle?.name);
    assert.ok(names.includes('requireAuth'));
    const routes = questsRouter.stack.filter((layer) => layer.route);
    assert.ok(routes.length >= 5);
    assert.ok(routes.some((layer) => layer.route.path === '/' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/profile' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/history' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/rewards' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/:id/claim' && layer.route.methods.post));
    assert.ok(routes.some((layer) => layer.route.path === '/timezone' && layer.route.methods.put));
  });

  it('rejects a missing bearer token', async () => {
    const { requireAuth } = await import('../middleware/auth.js');
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await requireAuth({ headers: {} }, res, () => {
      throw new Error('should not pass');
    });
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /ავტორიზაცია/);
  });
});

describe('dashboard + concurrent completion', () => {
  it('builds a timezone-aware dashboard after assignment', async () => {
    const db = createQuestFakeDb();
    await seedHydrationGoal(db);
    await seedStepCapability(db);
    await db.healthMetricDaily.create({
      data: { userId: USER, date: TODAY, steps: 9000, hydrationMl: 2500 },
    });
    const dash = await getUserQuestDashboard(USER, { db, now: NOW });
    assert.equal(dash.daily.timezone, QUEST_TIMEZONE);
    assert.equal(dash.daily.periodKey, TODAY);
    assert.equal(dash.daily.quests.length, 3);
    assert.equal(dash.weekly.quests.length, 1);
    const steps = questByKey(dash.daily.quests, 'daily_steps');
    assert.equal(steps.status, 'COMPLETED');
    assert.equal(steps.progress, 9000);
    assert.equal(steps.progressPercent, 100);
    assert.equal(steps.claimable, true);
  });

  it('only writes one completion when two requests race', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(
      await db.userQuest.findMany({ include: { template: true } }),
      'daily_steps',
    );
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 8000 } });
    const [a, b] = await Promise.all([
      completeQuest(USER, steps.id, options),
      completeQuest(USER, steps.id, options),
    ]);
    const completions = await db.questCompletion.findMany({ where: { userQuestId: steps.id } });
    assert.equal(completions.length, 1);
    assert.equal([a, b].filter((row) => row.completed).length, 1);
    assert.equal([a, b].filter((row) => row.alreadyCompleted).length, 1);
  });
});

describe('phase 1 seed set', () => {
  it('keeps only the four controlled templates', () => {
    assert.deepEqual(
      INITIAL_QUEST_TEMPLATES.map((row) => row.key),
      ['daily_steps', 'daily_hydration', 'daily_medi', 'weekly_steps'],
    );
  });
});

describe('locked level curve', () => {
  it('matches exact Levels 1–20', () => {
    const expected = [0, 200, 450, 750, 1100, 1500, 1950, 2450, 3000, 3600, 4300, 5100, 6000, 7000, 8100, 9300, 10600, 12000, 13500, 15100];
    assert.deepEqual([...QUEST_LEVEL_1_20], expected);
    expected.forEach((xp, i) => assert.equal(getXpThresholdForLevel(i + 1), xp));
  });

  it('uses the Level 21+ increment formula', () => {
    assert.equal(getXpThresholdForLevel(21), 16_800);
    assert.equal(getXpThresholdForLevel(22), 18_600);
    assert.equal(getXpThresholdForLevel(23), 20_500);
    assert.equal(getXpThresholdForLevel(24), 22_500);
    assert.equal(getXpThresholdForLevel(25), 24_600);
  });

  it('hits the Level 30 / 40 / 50 checkpoints', () => {
    assert.equal(getXpThresholdForLevel(30), 36_600);
    assert.equal(getXpThresholdForLevel(40), 68_100);
    assert.equal(getXpThresholdForLevel(50), 109_600);
  });

  it('handles XP just below, at, and above a threshold', () => {
    assert.equal(getLevelForXp(199).level, 1);
    assert.equal(getLevelForXp(200).level, 2);
    assert.equal(getLevelForXp(201).level, 2);
    assert.equal(getLevelForXp(15_099).level, 19);
    assert.equal(getLevelForXp(15_100).level, 20);
    assert.equal(getLevelForXp(15_101).level, 20);
    assert.equal(getLevelForXp(16_800).level, 21);
    assert.equal(getLevelRankKey(3), 'LEVEL_1_4');
    assert.equal(getLevelRankKey(20), 'LEVEL_20_29');
    assert.equal(getLevelRankKey(50), 'LEVEL_50_PLUS');
  });
});

describe('effective quest timezone', () => {
  it('resolves Brussels, Tbilisi, and Paris independently of UTC', () => {
    const instant = new Date('2026-09-05T22:30:00.000Z');
    assert.equal(questYmd(instant, 'Europe/Brussels'), '2026-09-06');
    assert.equal(questYmd(instant, 'Europe/Paris'), '2026-09-06');
    assert.equal(questYmd(instant, 'Asia/Tbilisi'), '2026-09-06');
    assert.equal(instant.toISOString().slice(0, 10), '2026-09-05');
  });

  it('falls back to Asia/Tbilisi for invalid timezones', () => {
    assert.equal(normalizeQuestTimezone('Not/AZone'), null);
    assert.equal(normalizeQuestTimezone('GMT+4'), null);
    assert.equal(getEffectiveQuestTimezone({}, { timezone: 'nope' }), QUEST_TIMEZONE_FALLBACK);
    assert.equal(getEffectiveQuestTimezone({ timezone: 'Europe/Brussels' }), 'Europe/Brussels');
    assert.equal(
      getEffectiveQuestTimezone({ questProfile: { timezone: 'Europe/Paris' } }, { deviceTimezone: 'bad' }),
      'Europe/Paris',
    );
  });

  it('computes local midnight and ISO week Mon–Sun in the effective zone', () => {
    const monday = startOfLocalDay('2026-08-31', 'Europe/Brussels');
    const sundayEnd = endOfLocalDay('2026-09-06', 'Europe/Brussels');
    assert.equal(questYmd(monday, 'Europe/Brussels'), '2026-08-31');
    assert.equal(questYmd(new Date(monday.getTime() - 1), 'Europe/Brussels'), '2026-08-30');
    assert.equal(questYmd(sundayEnd, 'Europe/Brussels'), '2026-09-06');
    assert.equal(questYmd(new Date(sundayEnd.getTime() + 1), 'Europe/Brussels'), '2026-09-07');
    assert.equal(mondayOfIsoWeek('2026-W36'), '2026-08-31');
    assert.equal(isoWeekKey('2026-09-06'), '2026-W36');
    assert.equal(weeklyPeriodKey(new Date('2026-09-06T12:00:00+02:00'), 'Europe/Brussels'), '2026-W36');
  });

  it('assigns using the effective timezone, not a hardcoded Tbilisi day', async () => {
    const now = new Date('2026-09-06T01:30:00+02:00');
    const db = createQuestFakeDb();
    const assigned = await assignDailyQuests(USER, null, { db, now, timezone: 'Europe/Brussels' });
    assert.ok(assigned.length);
    assert.ok(assigned.every((row) => row.periodKey === '2026-09-06'));
  });
});

describe('timezone hopping protection', () => {
  it('does not assign a second today after a rapid eastbound hop', async () => {
    const db = createQuestFakeDb();
    const brusselsEvening = new Date('2026-09-06T18:00:00+02:00');
    await assignDailyQuests(USER, null, { db, now: brusselsEvening, timezone: 'Europe/Brussels' });
    const tokyoNextLocal = new Date('2026-09-06T18:05:00+02:00');
    const hopped = await assignDailyQuests(USER, null, {
      db,
      now: tokyoNextLocal,
      timezone: 'Asia/Tokyo',
    });
    assert.ok(hopped.every((row) => row.hopBlocked || row.periodKey === '2026-09-06'));
    const days = new Set((await db.userQuest.findMany({ include: { template: true } }))
      .filter((row) => row.template.cadence === 'DAILY')
      .map((row) => row.periodKey));
    assert.deepEqual([...days], ['2026-09-06']);
  });

  it('allows the natural next local day after the successor guard', async () => {
    const db = createQuestFakeDb();
    const day1 = new Date('2026-09-06T12:00:00+04:00');
    await assignDailyQuests(USER, '2026-09-06', { db, now: day1, timezone: 'Asia/Tbilisi' });
    const day2 = new Date(day1.getTime() + 13 * 60 * 60 * 1000);
    const next = await assignDailyQuests(USER, '2026-09-07', { db, now: day2, timezone: 'Asia/Tbilisi' });
    assert.ok(next.some((row) => row.periodKey === '2026-09-07' && row.created));
  });

  it('exposes the hop-guard helper for last+1 vs farmed jumps', () => {
    const now = new Date('2026-09-06T18:00:00Z');
    const profile = { lastDailyAssignPeriodKey: '2026-09-06', lastDailyAssignAt: now };
    assert.equal(canAssignNewDailyPeriod(profile, '2026-09-06', now, 'Asia/Tbilisi'), true);
    assert.equal(
      canAssignNewDailyPeriod(profile, '2026-09-07', new Date(now.getTime() + 60_000), 'Asia/Tokyo'),
      false,
    );
  });
});

describe('claim semantics', () => {
  it('does not expire a COMPLETED quest and allows a late claim', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await completeQuest(USER, steps.id, options);
    await db.userQuest.update({
      where: { id: steps.id },
      data: { expiresAt: new Date('2026-09-05T23:59:59+04:00') },
    });
    const expired = await expireStaleQuests(USER, options);
    const row = await db.userQuest.findUnique({ where: { id: steps.id } });
    assert.equal(row.status, 'COMPLETED');
    assert.equal(expired, 0);
    const late = new Date('2026-09-07T10:00:00+04:00');
    const claimed = await claimQuest(USER, steps.id, { ...options, now: late });
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.quest.status, 'CLAIMED');
  });

  it('still expires an ACTIVE quest that missed its window', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'daily_steps');
    await db.userQuest.update({
      where: { id: steps.id },
      data: { expiresAt: new Date('2026-09-05T23:59:59+04:00') },
    });
    assert.equal(await expireStaleQuests(USER, options), 1);
    assert.equal((await db.userQuest.findUnique({ where: { id: steps.id } })).status, 'EXPIRED');
  });

  it('returns previousLevel / currentLevel / leveledUp from the server', async () => {
    const { db, options } = await setup();
    const weekly = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'weekly_steps');
    await db.userQuest.update({ where: { id: weekly.id }, data: { progress: 35_000 } });
    const result = await claimQuest(USER, weekly.id, options);
    assert.equal(result.profile.previousLevel, 1);
    assert.equal(result.profile.currentLevel, 2);
    assert.equal(result.profile.leveledUp, true);
    assert.equal(result.profile.totalXp, 200);
    assert.equal(result.profile.coinBalance, 150);
    assert.ok(result.profile.levelProgress);
  });
});

describe('streak semantics', () => {
  it('counts completion before claim and does not move the date on a next-day claim', async () => {
    const db = createQuestFakeDb();
    await seedHydrationGoal(db);
    await seedStepCapability(db);
    const day1 = new Date('2026-09-06T23:50:00+04:00');
    await assignDailyQuests(USER, '2026-09-06', { db, now: day1 });
    const steps = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await completeQuest(USER, steps.id, { db, now: day1 });
    const afterComplete = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(afterComplete.currentStreak, 1);
    assert.equal(afterComplete.lastActiveQuestDate, '2026-09-06');

    const nextMorning = new Date('2026-09-07T10:00:00+04:00');
    await claimQuest(USER, steps.id, { db, now: nextMorning });
    const afterClaim = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(afterClaim.lastActiveQuestDate, '2026-09-06');
    assert.equal(afterClaim.currentStreak, 1);
  });

  it('ignores weekly quests for daily streak', async () => {
    const { db, options } = await setup();
    const weekly = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'weekly_steps');
    assert.equal(weekly.template.config.countsForDailyStreak, false);
    await db.userQuest.update({ where: { id: weekly.id }, data: { progress: 35_000 } });
    await completeQuest(USER, weekly.id, options);
    const profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile?.currentStreak || 0, 0);
    assert.equal(profile?.lastActiveQuestDate || null, null);
  });
});

describe('economy safety', () => {
  it('locks daily and weekly seed values', () => {
    const byKey = Object.fromEntries(INITIAL_QUEST_TEMPLATES.map((row) => [row.key, row]));
    assert.deepEqual(
      [byKey.daily_steps.defaultTarget, byKey.daily_steps.rewardXp, byKey.daily_steps.rewardCoins],
      [5000, 50, 30],
    );
    assert.deepEqual(
      [byKey.daily_hydration.defaultTarget, byKey.daily_hydration.rewardXp, byKey.daily_hydration.rewardCoins],
      [100, 35, 20],
    );
    assert.equal(byKey.daily_hydration.progressType, 'HYDRATION_GOAL_PERCENT');
    assert.deepEqual(
      [byKey.daily_medi.defaultTarget, byKey.daily_medi.rewardXp, byKey.daily_medi.rewardCoins],
      [1, 20, 10],
    );
    assert.equal(byKey.daily_medi.progressType, 'MEDI_DAILY_USE');
    assert.deepEqual(
      [byKey.weekly_steps.defaultTarget, byKey.weekly_steps.rewardXp, byKey.weekly_steps.rewardCoins],
      [35_000, 200, 150],
    );
    assert.equal(30 + 20 + 10, 60);
    assert.equal(60 * 7 + 150, 570);
  });

  it('rejects reward ceilings instead of clamping', () => {
    assert.throws(() => validateQuestRewardAmounts({ cadence: 'DAILY', rewardXp: 999_999, rewardCoins: 10 }), {
      code: 'QUEST_REWARD_CEILING',
    });
    assert.throws(() => validateQuestRewardAmounts({ cadence: 'WEEKLY', rewardXp: 10, rewardCoins: 50_000 }), {
      code: 'QUEST_REWARD_CEILING',
    });
    assert.throws(() => assertIssuableQuestReward({ cadence: 'DAILY', rewardXp: 9_000, rewardCoins: 9_000 }), {
      code: 'QUEST_REWARD_CEILING',
    });
    assert.equal(QUEST_ECONOMY.maxSingleDailyQuestXp, 250);
    assert.equal(QUEST_ECONOMY.maxSingleQuestCoins, 250);
  });

  it('detects ledger/profile cache drift and can repair it', async () => {
    const { db, options } = await setup({ weekly: false });
    const steps = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: 5000 } });
    await claimQuest(USER, steps.id, options);
    await db.userQuestProfile.update({
      where: { userId: USER },
      data: { totalXp: 1, cachedCoinBalance: 1, currentLevel: 9 },
    });
    const drift = await reconcileQuestProfile(USER, options);
    assert.equal(drift.drifted, true);
    const repaired = await reconcileQuestProfile(USER, { ...options, repair: true });
    assert.equal(repaired.repaired, true);
    const profile = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(profile.totalXp, 50);
    assert.equal(profile.cachedCoinBalance, 30);
    assert.equal(profile.currentLevel, 1);
  });
});

describe('schema privacy comments', () => {
  it('documents that quest config is non-sensitive', () => {
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../prisma/schema.prisma');
    const schema = readFileSync(schemaPath, 'utf8');
    assert.match(schema, /model QuestTemplate/);
    assert.match(schema, /model RewardLedger/);
    assert.match(schema, /Never health notes/);
  });
});
