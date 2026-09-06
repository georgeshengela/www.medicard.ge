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
    assert.equal(
      homeModuleView({
        dashboard: dashboard({
          daily: { periodKey: 'd', timezone: 'X', quests: [] },
          summary: { dailyCompleted: 0, dailyTotal: 0, dailyClaimable: 0 },
        }),
      }).priority.mode,
      'empty',
    );
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

  it('hides wallet source types and period keys from history grouping', () => {
    assert.equal(walletActivityLabel('QUEST', 'მისია'), 'მისია');
    assert.equal(walletActivityLabel('ADJUSTMENT', 'მისია'), 'მისია');
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
});
