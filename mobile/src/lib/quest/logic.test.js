'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  QUEST_RANKS,
  beginClaimLock,
  celebrationKey,
  capabilityFromHealth,
  endClaimLock,
  displayQuestProgress,
  formatQuestNumber,
  formatQuestPercent,
  historyGroupKey,
  homeClaimLayout,
  homeModuleView,
  homeQuestMood,
  progressBarFill,
  rewardFloatOverlayStyle,
  walletActivityLabel,
  isClaimableStatus,
  pickPriorityQuest,
  pickStableVariant,
  privacySafeQuestBlob,
  questKind,
  questLocaleFromTag,
  rankKeyFromLevel,
  rankLabel,
  shouldCelebrate,
  stepsQuestEligible,
} = require('./logic.js');
const { questCopy } = require('../../i18n/quest/catalog.js');
const {
  applyQuestDevView,
  buildQuestDevDashboard,
  claimQuestDevFixture,
  isQuestDevEnabled,
  isQuestVisualSession,
  setQuestDevScenario,
  setQuestVisualSession,
  startQuestVisualSession,
} = require('./devFixture.js');

function quest(overrides = {}) {
  return {
    id: 'q1',
    key: 'daily_steps',
    category: 'movement',
    cadence: 'DAILY',
    progressType: 'STEPS',
    target: 5000,
    progress: 0,
    progressPercent: 0,
    status: 'ACTIVE',
    claimable: false,
    rewardCoins: 30,
    rewardXp: 50,
    ...overrides,
  };
}

function dashboard(overrides = {}) {
  return {
    profile: {
      level: 7,
      rankKey: 'LEVEL_5_9',
      totalXp: 1950,
      coinBalance: 1240,
      currentStreak: 6,
      longestStreak: 6,
      levelProgress: { level: 7 },
    },
    daily: { periodKey: '2026-09-06', timezone: 'Asia/Tbilisi', quests: [quest()] },
    weekly: { periodKey: '2026-W36', quests: [] },
    summary: { dailyCompleted: 0, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
    ...overrides,
  };
}

describe('quest logic', () => {
  it('formats locale-aware numbers and rounded percents', () => {
    assert.equal(formatQuestPercent(64.285714), 64);
    assert.equal(formatQuestPercent(100.4), 100);
    assert.match(formatQuestNumber(5000, 'en'), /5/);
    assert.match(formatQuestNumber(35000, 'ru'), /35/);
  });

  it('maps locales and ranks', () => {
    assert.equal(questLocaleFromTag('ka-GE'), 'ka');
    assert.equal(questLocaleFromTag('en-US'), 'en');
    assert.equal(questLocaleFromTag('fr'), 'fr');
    assert.equal(questLocaleFromTag('ru-RU'), 'ru');
    assert.equal(questLocaleFromTag('de'), 'ka');
    assert.equal(rankKeyFromLevel(1), 'LEVEL_1_4');
    assert.equal(rankKeyFromLevel(9), 'LEVEL_5_9');
    assert.equal(rankKeyFromLevel(10), 'LEVEL_10_14');
    assert.equal(rankKeyFromLevel(20), 'LEVEL_20_29');
    assert.equal(rankKeyFromLevel(50), 'LEVEL_50_PLUS');
    assert.equal(rankLabel('LEVEL_1_4', 'ru'), 'Новичок');
    assert.equal(rankLabel('LEVEL_50_PLUS', 'ka'), QUEST_RANKS.LEVEL_50_PLUS.ka);
  });

  it('keeps companion copy stable for the same seed', () => {
    const a = pickStableVariant(['one', 'two', 'three'], '2026-09-06:user');
    const b = pickStableVariant(['one', 'two', 'three'], '2026-09-06:user');
    assert.equal(a, b);
  });

  it('derives home moods without guilt states', () => {
    assert.equal(homeQuestMood({ dailyTotal: 3, dailyCompleted: 0, dailyClaimable: 0 }), 'fresh_day');
    assert.equal(homeQuestMood({ dailyTotal: 3, dailyCompleted: 1, dailyClaimable: 0 }), 'one_completed');
    assert.equal(homeQuestMood({ dailyTotal: 3, dailyCompleted: 2, dailyClaimable: 0, nearCompletion: true }), 'near_completion');
    assert.equal(homeQuestMood({ dailyTotal: 3, dailyCompleted: 3, dailyClaimable: 0 }), 'all_daily_complete');
    assert.equal(homeQuestMood({ dailyTotal: 3, dailyCompleted: 1, dailyClaimable: 1 }), 'reward_waiting');
    assert.equal(homeQuestMood({ dailyTotal: 0, dailyCompleted: 0, dailyClaimable: 0 }), 'none');
  });

  it('renders home module states for loading, error, cache, claimable, empty', () => {
    assert.equal(homeModuleView({ loading: true }).kind, 'loading');
    assert.equal(homeModuleView({ error: true }).kind, 'error');
    const noMissions = homeModuleView({
      dashboard: dashboard({
        daily: { periodKey: 'd', timezone: 'X', quests: [] },
        summary: { dailyCompleted: 0, dailyTotal: 0, dailyClaimable: 0 },
      }),
    });
    assert.equal(noMissions.kind, 'ready');
    assert.equal(noMissions.priority.mode, 'empty');
    assert.equal(noMissions.level, 7);
    const claimDash = dashboard({
      daily: {
        periodKey: 'd',
        timezone: 'X',
        quests: [quest({ status: 'COMPLETED', claimable: true, progressPercent: 100 })],
      },
      summary: { dailyCompleted: 1, dailyTotal: 3, dailyClaimable: 1 },
    });
    const ready = homeModuleView({ dashboard: claimDash });
    assert.equal(ready.kind, 'ready');
    assert.equal(ready.mood, 'reward_waiting');
    assert.equal(ready.priority.mode, 'claimable');
    const cached = homeModuleView({ dashboard: dashboard(), stale: true });
    assert.equal(cached.kind, 'cached');
    assert.equal(cached.streak, 6);
  });

  it('treats an unavailable dashboard (profile: null) as empty instead of crashing', () => {
    const unavailable = dashboard({
      profile: null,
      unavailable: true,
      daily: { periodKey: 'd', timezone: 'X', quests: [] },
      summary: { dailyCompleted: 0, dailyTotal: 0, dailyClaimable: 0 },
    });
    assert.equal(homeModuleView({ dashboard: unavailable }).kind, 'empty');
    assert.equal(homeModuleView({ dashboard: dashboard({ profile: null }) }).kind, 'empty');
    const unavailableWithProfile = homeModuleView({
      dashboard: dashboard({
        unavailable: true,
        daily: { periodKey: 'd', timezone: 'X', quests: [] },
        summary: { dailyCompleted: 0, dailyTotal: 0, dailyClaimable: 0 },
      }),
    });
    assert.equal(unavailableWithProfile.kind, 'ready');
    assert.equal(unavailableWithProfile.priority.mode, 'empty');
    assert.equal(unavailableWithProfile.level, 7);
  });

  it('picks weekly and hydration kinds', () => {
    assert.equal(questKind(quest()), 'movement');
    assert.equal(questKind(quest({ progressType: 'HYDRATION_GOAL_PERCENT', key: 'daily_hydration' })), 'hydration');
    assert.equal(questKind(quest({ progressType: 'MEDI_DAILY_USE', key: 'daily_medi' })), 'medi');
    assert.equal(questKind(quest({ cadence: 'WEEKLY', key: 'weekly_steps' })), 'weekly');
  });

  it('treats zero streak as a start state in home view', () => {
    const view = homeModuleView({
      dashboard: dashboard({ profile: { ...dashboard().profile, currentStreak: 0 } }),
    });
    assert.equal(view.streak, 0);
  });

  it('locks double claim taps', () => {
    const locks = new Set();
    assert.equal(beginClaimLock(locks, 'q1'), true);
    assert.equal(beginClaimLock(locks, 'q1'), false);
    endClaimLock(locks, 'q1');
    assert.equal(beginClaimLock(locks, 'q1'), true);
  });

  it('dedupes HTTP + socket celebrations', () => {
    const seen = new Set();
    const key = celebrationKey('claimed-http', 'q1', 't1');
    assert.equal(shouldCelebrate(seen, key), true);
    assert.equal(shouldCelebrate(seen, key), false);
    assert.equal(shouldCelebrate(seen, celebrationKey('claimed-socket', 'q1', 't1')), true);
    assert.equal(shouldCelebrate(seen, celebrationKey('completed', 'q1', 't1')), true);
  });

  it('keeps localization keys for ka/en/fr/ru', () => {
    for (const loc of ['ka', 'en', 'fr', 'ru']) {
      const copy = questCopy(loc);
      assert.ok(copy.section);
      assert.ok(copy.claimReward);
      assert.ok(copy.streakStart);
      assert.ok(copy.rank.LEVEL_1_4);
      assert.ok(copy.rank.LEVEL_50_PLUS);
      assert.ok(copy.mood.fresh_day.length >= 2);
      assert.equal(copy.coins, 'Medi Coins');
    }
  });

  it('rejects private health fields in quest payloads', () => {
    assert.equal(privacySafeQuestBlob({ questId: 'q1', status: 'COMPLETED' }), true);
    assert.equal(privacySafeQuestBlob({ prompt: 'secret' }), false);
    assert.equal(privacySafeQuestBlob({ hydrationMl: 400 }), false);
    assert.equal(privacySafeQuestBlob({ diagnosis: 'x' }), false);
    assert.equal(privacySafeQuestBlob({ medicationName: 'x' }), false);
  });

  it('maps step capability without hardware identifiers', () => {
    assert.deepEqual(capabilityFromHealth({ supported: false, connected: false, expoGo: false, platform: null }), {
      status: 'UNAVAILABLE',
      source: 'UNKNOWN',
    });
    assert.deepEqual(
      capabilityFromHealth({ supported: true, connected: false, expoGo: false, denied: true, platform: 'apple' }),
      { status: 'PERMISSION_DENIED', source: 'APPLE_HEALTH' },
    );
    assert.deepEqual(capabilityFromHealth({ supported: true, connected: false, expoGo: false, platform: 'google' }), {
      status: 'NOT_CONFIGURED',
      source: 'HEALTH_CONNECT',
    });
    assert.deepEqual(capabilityFromHealth({ supported: true, connected: true, expoGo: false, platform: 'apple' }), {
      status: 'AVAILABLE',
      source: 'APPLE_HEALTH',
    });
    assert.equal(stepsQuestEligible('UNKNOWN'), false);
    assert.equal(stepsQuestEligible('PERMISSION_DENIED'), false);
    assert.equal(stepsQuestEligible('AVAILABLE'), true);
  });

  it('prefers claimable quests over in-progress previews', () => {
    const dash = dashboard({
      daily: {
        periodKey: 'd',
        timezone: 'X',
        quests: [
          quest({ id: 'active', progressPercent: 90 }),
          quest({
            id: 'done',
            status: 'COMPLETED',
            claimable: true,
            key: 'daily_medi',
            progressType: 'MEDI_DAILY_USE',
          }),
        ],
      },
    });
    const picked = pickPriorityQuest(dash);
    assert.equal(picked.mode, 'claimable');
    assert.equal(picked.quest.id, 'done');
    assert.equal(isClaimableStatus(picked.quest), true);
  });

  it('caps over-target progress and keeps 1% bars visible', () => {
    const over = displayQuestProgress(quest({ progress: 12500, target: 5000, progressPercent: 250 }));
    assert.equal(over.progress, 5000);
    assert.equal(over.target, 5000);
    assert.equal(over.overTarget, true);
    assert.equal(over.percent, 100);
    const empty = progressBarFill(0);
    assert.equal(empty.visible, false);
    const tiny = progressBarFill(1);
    assert.equal(tiny.visible, true);
    assert.equal(tiny.minFill, true);
    assert.equal(progressBarFill(100).widthPercent, 100);
    assert.equal(progressBarFill(100).minFill, false);
  });

  it('compacts Home claimable layout and keeps reward float out of flow', () => {
    assert.equal(homeClaimLayout('claimable').showDailyProgress, false);
    assert.equal(homeClaimLayout('preview').showDailyProgress, true);
    const float = rewardFloatOverlayStyle();
    assert.equal(float.position, 'absolute');
    assert.equal(float.pointerEvents, 'none');
  });

  it('labels wallet activity without Mission fallback for unknown types', () => {
    assert.equal(walletActivityLabel('QUEST', 'მისია'), 'მისია');
    assert.equal(walletActivityLabel('ADJUSTMENT', 'მისია'), 'Balance adjustment');
    assert.equal(walletActivityLabel('SYSTEM', 'მისია'), 'System adjustment');
  });

  it('hides wallet source types and period keys from history grouping', () => {
    assert.equal(
      historyGroupKey({ completedAt: '2026-09-06T11:00:00.000Z', periodKey: '2026-W36' }, '2026-09-06'),
      '2026-09-06',
    );
    assert.equal(historyGroupKey({ periodKey: '2026-W36' }, '2026-09-06'), '2026-09-06');
  });

  it('keeps DEV fixtures gated and shaped like the real dashboard', () => {
    assert.equal(isQuestDevEnabled(), false);
    assert.equal(isQuestVisualSession(), false);
    assert.equal(startQuestVisualSession(), false);
    assert.equal(setQuestVisualSession(true), false);
    assert.equal(applyQuestDevView({ dashboard: dashboard(), scenario: 'CLAIMABLE' }).dashboard.summary.dailyTotal, 3);
    const forced = applyQuestDevView({ dashboard: null, scenario: 'CLAIMABLE' }, { force: true });
    assert.equal(forced.error, false);
    assert.equal(forced.dashboard.summary.dailyClaimable, 2);
    const err = applyQuestDevView({ dashboard: dashboard(), scenario: 'ERROR' }, { force: true });
    assert.equal(err.error, true);
    assert.equal(err.dashboard, null);
    const offline = applyQuestDevView({ dashboard: null, scenario: 'OFFLINE' }, { force: true });
    assert.equal(offline.stale, true);
    assert.equal(offline.fixtureOffline, true);
    const big = buildQuestDevDashboard('LARGE_BALANCE');
    const hist = require('./devFixture.js').buildQuestDevHistory();
    assert.ok(hist.some((row) => row.status === 'EXPIRED'));
    assert.ok(hist.some((row) => row.status === 'CLAIMED'));
    const wallet = require('./devFixture.js').buildQuestDevWallet();
    assert.ok(wallet.transactions.every((row) => row.sourceType === 'QUEST'));
    assert.equal(big.profile.level, 125);
    setQuestDevScenario('CLAIMABLE');
    const claimed = claimQuestDevFixture(buildQuestDevDashboard('CLAIMABLE'), 'dev-steps');
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.dashboard.daily.quests[0].status, 'CLAIMED');
    setQuestDevScenario('LIVE');
  });

  it('localizes back labels in ka/en/fr/ru', () => {
    assert.equal(questCopy('ka').back, 'უკან');
    assert.equal(questCopy('en').back, 'Back');
    assert.equal(questCopy('fr').back, 'Retour');
    assert.equal(questCopy('ru').back, 'Назад');
    assert.equal(questCopy('ka').levelUp, 'ახალი დონე');
  });

  it('maps daily quests to ring segments in display order', () => {
    const { dailySegments } = require('./logic.js');
    assert.deepEqual(
      dailySegments([
        quest({ status: 'CLAIMED' }),
        quest({ status: 'COMPLETED', claimable: true }),
        quest({ status: 'ACTIVE' }),
        quest({ status: 'EXPIRED' }),
      ]),
      ['done', 'ready', 'active'],
    );
    assert.deepEqual(dailySegments(null), []);
  });

  it('derives level ring percent and XP remaining, and handles max level', () => {
    const { levelRingProgress } = require('./logic.js');
    const mid = levelRingProgress({ totalXp: 1950, levelProgress: { nextLevelXp: 2450, progressPercent: 64.4 } });
    assert.deepEqual(mid, { percent: 64, remaining: 500, maxed: false });
    const maxed = levelRingProgress({ totalXp: 99999, levelProgress: { nextLevelXp: null, progressPercent: 0 } });
    assert.deepEqual(maxed, { percent: 100, remaining: null, maxed: true });
    assert.deepEqual(levelRingProgress(null), { percent: 0, remaining: null, maxed: false });
  });

  it('clamps the daily counter', () => {
    const { dailyCounter } = require('./logic.js');
    assert.deepEqual(dailyCounter({ dailyTotal: 3, dailyCompleted: 5 }), { done: 3, total: 3, allDone: true });
    assert.deepEqual(dailyCounter({ dailyTotal: 3, dailyCompleted: 1 }), { done: 1, total: 3, allDone: false });
    assert.deepEqual(dailyCounter(null), { done: 0, total: 0, allDone: false });
  });

  it('ships the new hero copy in every locale', () => {
    for (const loc of ['ka', 'en', 'fr', 'ru']) {
      const c = questCopy(loc);
      assert.ok(c.dailyMissions.length > 0);
      assert.ok(c.xpToNext(500).includes('500'));
      assert.ok(c.xpLeft(500).includes('500'));
      assert.ok(c.levelUpBody(8).includes('8'));
      assert.ok(c.missionsDone(1, 3).includes('1 / 3'));
    }
  });
});

describe('phase 4 achievements — pure helpers', () => {
  const {
    ACHIEVEMENT_RARITY_ORDER,
    achievementRarityRank,
    achievementsCounter,
    achievementsPreview,
    groupAchievements,
    sortAchievements,
  } = require('./logic.js');

  function ach(overrides) {
    return {
      id: overrides.id || overrides.key || 'x',
      key: overrides.key ?? null,
      category: overrides.category || 'PROGRESSION',
      rarity: overrides.rarity || 'COMMON',
      secret: Boolean(overrides.secret),
      unlocked: Boolean(overrides.unlocked),
      claimed: Boolean(overrides.claimed),
      claimable: Boolean(overrides.unlocked) && !overrides.claimed,
      unlockedAt: overrides.unlockedAt || null,
      progressPercent: overrides.progressPercent ?? 0,
      sortOrder: overrides.sortOrder ?? 0,
      ...overrides,
    };
  }

  it('orders rarities from COMMON to LEGENDARY', () => {
    assert.deepEqual(ACHIEVEMENT_RARITY_ORDER, ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']);
    assert.equal(achievementRarityRank('LEGENDARY'), 4);
    assert.equal(achievementRarityRank('nonsense'), 0);
  });

  it('sorts claimable first, then unlocked, in-progress by closeness, secrets last', () => {
    const rows = sortAchievements([
      ach({ id: 'secret', secret: true, sortOrder: 9 }),
      ach({ id: 'far', progressPercent: 10, sortOrder: 1 }),
      ach({ id: 'near', progressPercent: 90, sortOrder: 2 }),
      ach({ id: 'done', unlocked: true, claimed: true, sortOrder: 3 }),
      ach({ id: 'ready', unlocked: true, sortOrder: 4 }),
    ]);
    assert.deepEqual(rows.map((row) => row.id), ['ready', 'done', 'near', 'far', 'secret']);
  });

  it('groups by category in a stable section order', () => {
    const groups = groupAchievements([
      ach({ id: 'a', category: 'LEVEL' }),
      ach({ id: 'b', category: 'STREAK' }),
      ach({ id: 'c', category: 'PROGRESSION' }),
      ach({ id: 'd', category: 'UNKNOWN_THING' }),
    ]);
    assert.deepEqual(groups.map((group) => group.category), ['PROGRESSION', 'STREAK', 'LEVEL', 'SPECIAL']);
  });

  it('previews claimable → fresh unlocks → nearest locked, capped at the limit', () => {
    const preview = achievementsPreview(
      [
        ach({ id: 'locked-near', progressPercent: 80 }),
        ach({ id: 'locked-far', progressPercent: 5 }),
        ach({ id: 'unlocked-old', unlocked: true, claimed: true, unlockedAt: '2026-09-01T00:00:00Z' }),
        ach({ id: 'unlocked-new', unlocked: true, claimed: true, unlockedAt: '2026-09-06T00:00:00Z' }),
        ach({ id: 'claimable', unlocked: true }),
        ach({ id: 'secret-locked', secret: true }),
      ],
      4,
    );
    assert.deepEqual(preview.map((row) => row.id), ['claimable', 'unlocked-new', 'unlocked-old', 'locked-near']);
  });

  it('clamps the achievements counter', () => {
    assert.deepEqual(achievementsCounter({ total: 50, unlocked: 12, claimable: 3 }), {
      total: 50,
      unlocked: 12,
      claimable: 3,
      percent: 24,
    });
    assert.deepEqual(achievementsCounter(null), { total: 0, unlocked: 0, claimable: 0, percent: 0 });
  });
});

describe('phase 4 achievements — copy + fixtures', () => {
  const { achievementCopy } = require('../../i18n/quest/achievements.js');
  const { buildQuestDevAchievements, claimAchievementDevFixture } = require('./devFixture.js');

  const ALL_KEYS = [
    'FIRST_QUEST', 'FIRST_CLAIM', 'FIRST_WEEKLY',
    'QUESTS_5', 'QUESTS_10', 'QUESTS_25', 'QUESTS_50', 'QUESTS_100', 'QUESTS_250', 'QUESTS_500',
    'STREAK_3', 'STREAK_7', 'STREAK_14', 'STREAK_30', 'STREAK_60', 'STREAK_100', 'STREAK_365',
    'MOVE_3', 'MOVE_10', 'MOVE_25', 'MOVE_50', 'MOVE_100', 'MOVE_250',
    'HYDRATE_3', 'HYDRATE_10', 'HYDRATE_25', 'HYDRATE_50', 'HYDRATE_100',
    'MEDI_3', 'MEDI_10', 'MEDI_25', 'MEDI_50', 'MEDI_100',
    'WEEKLY_3', 'WEEKLY_10', 'WEEKLY_25', 'WEEKLY_52',
    'LEVEL_5', 'LEVEL_10', 'LEVEL_20', 'LEVEL_30', 'LEVEL_40', 'LEVEL_50',
    'COINS_EARNED_500', 'COINS_EARNED_2500', 'COINS_EARNED_10000', 'COINS_EARNED_25000',
    'COMEBACK', 'EARLY_BIRD', 'NIGHT_OWL',
  ];

  it('generates a title and description for all 50 achievements in all four locales', () => {
    for (const loc of ['ka', 'en', 'fr', 'ru']) {
      const copy = achievementCopy(loc);
      for (const key of ALL_KEYS) {
        const threshold = Number((key.match(/_(\d+)$/) || [])[1]) || 1;
        const item = { key, threshold, secret: false, unlocked: true };
        const title = copy.title(item);
        const description = copy.description(item);
        assert.ok(title && title.length > 0, `${loc} ${key} title`);
        assert.ok(description && description.length > 0, `${loc} ${key} description`);
        assert.notEqual(title, key, `${loc} ${key} should be humanized`);
      }
      for (const rarity of ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']) {
        assert.ok(copy.rarity[rarity].length > 0, `${loc} rarity ${rarity}`);
      }
    }
  });

  it('masks secret achievements until unlocked', () => {
    const copy = achievementCopy('ka');
    assert.equal(copy.title({ key: null, secret: true, unlocked: false }), copy.secretTitle);
    assert.equal(copy.description({ key: null, secret: true, unlocked: false }), copy.secretBody);
    assert.notEqual(copy.title({ key: 'EARLY_BIRD', secret: true, unlocked: true }), copy.secretTitle);
  });

  it('serves a rich DEV achievements overview and claims through the fixture', () => {
    const { setQuestDevScenario } = require('./devFixture.js');
    setQuestDevScenario('CLAIMABLE');
    const overview = buildQuestDevAchievements();
    assert.ok(overview.items.length > 10);
    assert.equal(overview.summary.total, 50);
    const claimable = overview.items.find((row) => row.claimable);
    assert.ok(claimable);
    const result = claimAchievementDevFixture(claimable.id);
    assert.equal(result.claimed, true);
    assert.ok(result.reward.coinsAwarded >= 0);
    const after = buildQuestDevAchievements();
    const row = after.items.find((item) => item.id === claimable.id);
    assert.equal(row.claimed, true);
    assert.equal(row.claimable, false);
    const again = claimAchievementDevFixture(claimable.id);
    assert.equal(again, null);
    setQuestDevScenario('LIVE');
  });
});
