/**
 * DEV-only Quest UI fixtures. Never activates in production.
 * Reuses the real QuestDashboard shape. Does not write production cache
 * and does not change server claim / economy logic.
 */
const { rankKeyFromLevel } = require('./logic.js');

const QUEST_DEV_SCENARIOS = Object.freeze([
  'LIVE',
  'FRESH_DAY',
  'PARTIAL',
  'NEAR_COMPLETE',
  'CLAIMABLE',
  'ALL_COMPLETE',
  'NO_QUESTS',
  'OFFLINE',
  'ERROR',
  'LEVEL_UP',
  'LONG_TEXT',
  'LARGE_BALANCE',
  'LONG_STREAK',
  'COMEBACK',
  'STRUGGLING',
  'DEFAULT_TARGET',
]);

const QUEST_DEV_LABELS = Object.freeze({
  LIVE: 'Live API',
  FRESH_DAY: 'Fresh day',
  PARTIAL: 'Partial',
  NEAR_COMPLETE: 'Near complete',
  CLAIMABLE: 'Claimable',
  ALL_COMPLETE: 'All complete',
  NO_QUESTS: 'No quests',
  OFFLINE: 'Offline cached',
  ERROR: 'Error',
  LEVEL_UP: 'Level-up',
  LONG_TEXT: 'Long Georgian',
  LARGE_BALANCE: 'Large balance',
  LONG_STREAK: 'Long streak',
  COMEBACK: 'Smart: comeback',
  STRUGGLING: 'Smart: struggling',
  DEFAULT_TARGET: 'Smart: default target',
});

let current = 'LIVE';
let overlay = null;
const listeners = new Set();
const sessionListeners = new Set();
const VISUAL_FLAG = '__MEDICARD_QUEST_VISUAL__';
const SCENARIO_FLAG = '__MEDICARD_QUEST_SCENARIO__';

if (typeof globalThis !== 'undefined' && globalThis[SCENARIO_FLAG]) {
  current = globalThis[SCENARIO_FLAG];
}

function isQuestDevEnabled(opts) {
  if (opts && opts.force) return true;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function getQuestDevScenario() {
  return current;
}

function setQuestDevScenario(next) {
  const key = QUEST_DEV_SCENARIOS.includes(next) ? next : 'LIVE';
  current = key;
  if (typeof globalThis !== 'undefined') globalThis[SCENARIO_FLAG] = key;
  overlay = null;
  achievementOverlay = null;
  listeners.forEach((fn) => {
    try {
      fn(key);
    } catch {
      /* ignore */
    }
  });
}

function subscribeQuestDevScenario(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isQuestVisualSession() {
  return isQuestDevEnabled() && Boolean(typeof globalThis !== 'undefined' && globalThis[VISUAL_FLAG]);
}

function setQuestVisualSession(on) {
  if (!isQuestDevEnabled()) return false;
  if (typeof globalThis !== 'undefined') globalThis[VISUAL_FLAG] = Boolean(on);
  const enabled = Boolean(on);
  sessionListeners.forEach((fn) => {
    try {
      fn(enabled);
    } catch {
      /* ignore */
    }
  });
  return enabled;
}

function subscribeQuestVisualSession(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

function startQuestVisualSession() {
  if (!isQuestDevEnabled()) return false;
  setQuestDevScenario('CLAIMABLE');
  return setQuestVisualSession(true);
}

function questVisualAuthSnapshot() {
  return {
    user: {
      id: 'dev-quest-qa',
      email: 'quest-qa@dev.local',
      fullName: 'Quest QA',
      phone: null,
      gender: 'MALE',
      birthDate: '1994-04-12',
      age: 32,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastCheckInDate: null,
    },
    usage: {
      date: '2026-09-06',
      used: 0,
      limit: 3,
      remaining: 3,
      exceeded: false,
      resetsInMs: 86400000,
    },
    stats: { records: 0, chats: 0, activeMedications: 0 },
    healthProfile: {
      heightCm: 168,
      weightKg: 62,
      bloodType: 'A+',
      activityLevel: 'moderate',
      exerciseFrequency: 'weekly',
      sleepQuality: 'good',
      sleepHours: 7,
      stressLevel: 'low',
      smokingStatus: 'never',
      alcoholUse: 'none',
      dietType: 'mixed',
      waterIntakeL: 2,
      restingHeartRate: 68,
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      chronicConditions: [],
      allergies: [],
      medications: [],
      familyHistory: [],
      healthGoals: [],
      extraAnswers: { avatarId: 'qa' },
      currentStepIndex: 99,
      completedAt: '2026-01-02T00:00:00.000Z',
      bmi: 22,
    },
  };
}

function isoDaysAgo(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function buildQuestDevHistory() {
  return [
    item({
      id: 'hist-today-claimed',
      status: 'CLAIMED',
      claimable: false,
      progress: 5000,
      progressPercent: 100,
      completedAt: isoDaysAgo(0, 11),
      claimedAt: isoDaysAgo(0, 12),
    }),
    item({
      id: 'hist-today-open',
      key: 'daily_hydration',
      progressType: 'HYDRATION_GOAL_PERCENT',
      status: 'COMPLETED',
      claimable: true,
      target: 100,
      progress: 100,
      progressPercent: 100,
      rewardCoins: 20,
      rewardXp: 35,
      completedAt: isoDaysAgo(0, 11),
    }),
    item({
      id: 'hist-yesterday',
      status: 'CLAIMED',
      claimable: false,
      assignedAt: isoDaysAgo(1, 8),
      completedAt: isoDaysAgo(1, 17),
      claimedAt: isoDaysAgo(1, 18),
    }),
    item({
      id: 'hist-older',
      key: 'weekly_steps',
      cadence: 'WEEKLY',
      status: 'CLAIMED',
      claimable: false,
      assignedAt: isoDaysAgo(8, 8),
      completedAt: isoDaysAgo(8, 17),
      claimedAt: isoDaysAgo(8, 18),
    }),
    item({
      id: 'hist-expired',
      status: 'EXPIRED',
      claimable: false,
      assignedAt: isoDaysAgo(3, 8),
      completedAt: null,
      claimedAt: null,
      expiresAt: isoDaysAgo(2, 23),
    }),
  ];
}

function buildQuestDevWallet() {
  const dash = buildQuestDevDashboard(current === 'LIVE' ? 'LARGE_BALANCE' : current);
  if (current === 'NO_QUESTS') {
    return { balance: { coins: 0, xp: 0 }, totalEarned: { coins: 0, xp: 0 }, transactions: [], nextCursor: null };
  }
  const count = current === 'FRESH_DAY' ? 1 : 22;
  const transactions = Array.from({ length: count }, (_, i) => ({
    id: `dev-tx-${i}`,
    amount: i % 4 === 0 ? 150 : 30,
    sourceType: 'QUEST',
    createdAt: isoDaysAgo(i, 12),
  }));
  return {
    balance: { coins: dash.profile.coinBalance, xp: dash.profile.totalXp },
    totalEarned: { coins: Math.max(dash.profile.coinBalance, 1840), xp: dash.profile.totalXp },
    transactions,
    nextCursor: null,
  };
}

/**
 * Phase 4 — DEV achievements overview. Mirrors the server AchievementsOverview
 * shape with a rich mixed state: claimable, claimed, in-progress, secrets.
 */
let achievementOverlay = null;

function devAchievement(overrides) {
  const threshold = overrides.threshold ?? 1;
  const progress = overrides.unlocked ? threshold : Math.min(threshold, overrides.progress ?? 0);
  return {
    id: `dev-ach-${overrides.key || Math.random().toString(36).slice(2)}`,
    key: overrides.key || null,
    family: overrides.family || (overrides.key ? overrides.key.replace(/_\d+$/, '') : null),
    category: overrides.category || 'PROGRESSION',
    rarity: overrides.rarity || 'COMMON',
    secret: Boolean(overrides.secret),
    threshold: overrides.masked ? null : threshold,
    rewardCoins: overrides.masked ? null : overrides.rewardCoins ?? 25,
    rewardXp: overrides.masked ? null : overrides.rewardXp ?? 50,
    unlocked: Boolean(overrides.unlocked),
    claimed: Boolean(overrides.claimed),
    claimable: Boolean(overrides.unlocked) && !overrides.claimed,
    unlockedAt: overrides.unlocked ? isoDaysAgo(overrides.daysAgo ?? 1, 12) : null,
    claimedAt: overrides.claimed ? isoDaysAgo(overrides.daysAgo ?? 1, 13) : null,
    progress: overrides.masked ? null : progress,
    progressPercent: overrides.masked ? null : threshold > 0 ? Math.round((progress / threshold) * 100) : 0,
    userAchievementId: overrides.unlocked ? `dev-ua-${overrides.key}` : null,
    sortOrder: overrides.sortOrder ?? 0,
    ...(overrides.extra || {}),
  };
}

function buildQuestDevAchievements() {
  if (achievementOverlay && achievementOverlay.scenario === current) return achievementOverlay.overview;
  if (current === 'NO_QUESTS' || current === 'FRESH_DAY') {
    const items = [
      devAchievement({ key: 'FIRST_QUEST', rarity: 'COMMON', rewardXp: 20, rewardCoins: 10, sortOrder: 0 }),
      devAchievement({ key: 'FIRST_CLAIM', rarity: 'COMMON', rewardXp: 20, rewardCoins: 10, sortOrder: 1 }),
      devAchievement({ key: 'QUESTS_5', threshold: 5, category: 'PROGRESSION', rarity: 'COMMON', rewardXp: 30, rewardCoins: 15, progress: 0, sortOrder: 10 }),
      devAchievement({ key: 'STREAK_3', threshold: 3, category: 'STREAK', rarity: 'COMMON', rewardXp: 40, rewardCoins: 20, progress: 0, sortOrder: 20 }),
      devAchievement({ masked: true, secret: true, rarity: 'UNCOMMON', category: 'SPECIAL', sortOrder: 91 }),
    ];
    return {
      items,
      summary: { total: 50, unlocked: 0, claimable: 0, claimed: 0, secretsLocked: 2, byRarity: {} },
    };
  }
  const items = [
    devAchievement({ key: 'FIRST_QUEST', rarity: 'COMMON', rewardXp: 20, rewardCoins: 10, unlocked: true, daysAgo: 6, sortOrder: 0 }),
    devAchievement({ key: 'FIRST_CLAIM', rarity: 'COMMON', rewardXp: 20, rewardCoins: 10, unlocked: true, claimed: true, daysAgo: 6, sortOrder: 1 }),
    devAchievement({ key: 'FIRST_WEEKLY', rarity: 'COMMON', rewardXp: 50, rewardCoins: 30, unlocked: true, claimed: true, daysAgo: 4, sortOrder: 2 }),
    devAchievement({ key: 'QUESTS_5', threshold: 5, rarity: 'COMMON', rewardXp: 30, rewardCoins: 15, unlocked: true, daysAgo: 3, sortOrder: 10 }),
    devAchievement({ key: 'QUESTS_10', threshold: 10, rarity: 'COMMON', rewardXp: 50, rewardCoins: 25, unlocked: true, claimed: true, daysAgo: 2, sortOrder: 11 }),
    devAchievement({ key: 'QUESTS_25', threshold: 25, rarity: 'UNCOMMON', rewardXp: 100, rewardCoins: 50, progress: 16, sortOrder: 12 }),
    devAchievement({ key: 'QUESTS_100', threshold: 100, rarity: 'RARE', rewardXp: 250, rewardCoins: 125, progress: 16, sortOrder: 14 }),
    devAchievement({ key: 'STREAK_3', threshold: 3, category: 'STREAK', rarity: 'COMMON', rewardXp: 40, rewardCoins: 20, unlocked: true, claimed: true, daysAgo: 4, sortOrder: 20 }),
    devAchievement({ key: 'STREAK_7', threshold: 7, category: 'STREAK', rarity: 'UNCOMMON', rewardCoins: 50, rewardXp: 100, unlocked: true, daysAgo: 0, sortOrder: 21 }),
    devAchievement({ key: 'STREAK_14', threshold: 14, category: 'STREAK', rarity: 'UNCOMMON', rewardXp: 150, rewardCoins: 75, progress: 6, sortOrder: 22 }),
    devAchievement({ key: 'STREAK_30', threshold: 30, category: 'STREAK', rarity: 'RARE', rewardCoins: 150, rewardXp: 300, progress: 6, sortOrder: 23 }),
    devAchievement({ key: 'MOVE_10', threshold: 10, category: 'MOVEMENT', rarity: 'COMMON', rewardXp: 60, rewardCoins: 30, unlocked: true, claimed: true, daysAgo: 1, sortOrder: 31 }),
    devAchievement({ key: 'MOVE_25', threshold: 25, category: 'MOVEMENT', rarity: 'UNCOMMON', rewardXp: 120, rewardCoins: 60, progress: 14, sortOrder: 32 }),
    devAchievement({ key: 'HYDRATE_10', threshold: 10, category: 'HYDRATION', rarity: 'COMMON', rewardXp: 60, rewardCoins: 30, progress: 7, sortOrder: 41 }),
    devAchievement({ key: 'MEDI_10', threshold: 10, category: 'MEDI', rarity: 'COMMON', rewardXp: 60, rewardCoins: 30, progress: 4, sortOrder: 51 }),
    devAchievement({ key: 'WEEKLY_3', threshold: 3, category: 'WEEKLY', rarity: 'COMMON', rewardXp: 100, rewardCoins: 50, unlocked: true, daysAgo: 1, sortOrder: 60 }),
    devAchievement({ key: 'LEVEL_5', threshold: 5, category: 'LEVEL', rarity: 'COMMON', rewardXp: 50, rewardCoins: 25, unlocked: true, claimed: true, daysAgo: 5, sortOrder: 70 }),
    devAchievement({ key: 'LEVEL_10', threshold: 10, category: 'LEVEL', rarity: 'UNCOMMON', rewardCoins: 50, rewardXp: 100, progress: 7, sortOrder: 71 }),
    devAchievement({ key: 'COINS_EARNED_500', threshold: 500, category: 'COINS', rarity: 'COMMON', rewardXp: 40, rewardCoins: 20, unlocked: true, claimed: true, daysAgo: 3, sortOrder: 80 }),
    devAchievement({ key: 'COINS_EARNED_2500', threshold: 2500, category: 'COINS', rarity: 'UNCOMMON', rewardCoins: 50, rewardXp: 100, progress: 1240, sortOrder: 81 }),
    devAchievement({ key: 'QUESTS_500', threshold: 500, rarity: 'LEGENDARY', rewardCoins: 400, rewardXp: 800, progress: 16, sortOrder: 16 }),
    devAchievement({ key: 'STREAK_365', threshold: 365, category: 'STREAK', rarity: 'LEGENDARY', rewardCoins: 500, rewardXp: 1500, progress: 6, sortOrder: 26 }),
    devAchievement({ key: 'COMEBACK', category: 'SPECIAL', rarity: 'RARE', rewardCoins: 50, rewardXp: 100, progress: 0, sortOrder: 90 }),
    devAchievement({ key: 'EARLY_BIRD', category: 'SPECIAL', rarity: 'UNCOMMON', rewardCoins: 40, rewardXp: 75, secret: true, unlocked: true, daysAgo: 2, sortOrder: 91 }),
    devAchievement({ masked: true, secret: true, rarity: 'UNCOMMON', category: 'SPECIAL', sortOrder: 92 }),
  ];
  const unlocked = items.filter((row) => row.unlocked);
  return {
    items,
    summary: {
      total: 50,
      unlocked: unlocked.length,
      claimable: items.filter((row) => row.claimable).length,
      claimed: items.filter((row) => row.claimed).length,
      secretsLocked: 1,
      byRarity: unlocked.reduce((acc, row) => {
        acc[row.rarity] = (acc[row.rarity] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

function claimAchievementDevFixture(achievementId) {
  const base = buildQuestDevAchievements();
  const target = base.items.find((row) => row.id === achievementId);
  if (!target || !target.claimable) return null;
  const items = base.items.map((row) =>
    row.id === achievementId
      ? { ...row, claimed: true, claimable: false, claimedAt: new Date().toISOString() }
      : row,
  );
  const overview = {
    items,
    summary: {
      ...base.summary,
      claimable: Math.max(0, base.summary.claimable - 1),
      claimed: base.summary.claimed + 1,
    },
  };
  achievementOverlay = { scenario: current, overview };
  notifyQuestDev();
  const leveledUp = current === 'LEVEL_UP';
  return {
    ok: true,
    claimed: true,
    alreadyClaimed: false,
    achievement: items.find((row) => row.id === achievementId),
    reward: { coinsAwarded: target.rewardCoins || 0, xpAwarded: target.rewardXp || 0 },
    profile: {
      coinBalance: 1240 + (target.rewardCoins || 0),
      totalXp: 1950 + (target.rewardXp || 0),
      previousLevel: 7,
      currentLevel: leveledUp ? 8 : 7,
      leveledUp,
      levelProgress: { level: leveledUp ? 8 : 7, nextLevelXp: 2450, progressPercent: leveledUp ? 6 : 52 },
      rankKey: rankKeyFromLevel(leveledUp ? 8 : 7),
    },
  };
}

function notifyQuestDev() {
  listeners.forEach((fn) => {
    try {
      fn(current);
    } catch {
      /* ignore */
    }
  });
}

function item(overrides) {
  return {
    id: 'dev-steps',
    key: 'daily_steps',
    category: 'movement',
    cadence: 'DAILY',
    titleKey: null,
    descriptionKey: null,
    progressType: 'STEPS',
    target: 5000,
    progress: 0,
    progressPercent: 0,
    status: 'ACTIVE',
    periodKey: '2026-09-06',
    assignedAt: '2026-09-06T08:00:00.000Z',
    completedAt: null,
    claimedAt: null,
    expiresAt: null,
    rewardCoins: 30,
    rewardXp: 50,
    claimable: false,
    // Phase 5 smart fields — movement rows override these; others stay null.
    targetSource: null,
    difficulty: null,
    reasonKey: null,
    ...overrides,
  };
}

/** Movement row with Phase 5 smart metadata (server-personalized by default). */
function moveItem(overrides) {
  return item({
    targetSource: 'PERSONALIZED',
    difficulty: 'NORMAL',
    reasonKey: 'PERSONAL_BASELINE',
    target: 4500,
    ...overrides,
  });
}

function profile(overrides) {
  const level = overrides?.level ?? 7;
  return {
    level,
    rankKey: rankKeyFromLevel(level),
    totalXp: 1950,
    coinBalance: 1240,
    currentStreak: 6,
    longestStreak: 6,
    levelProgress: {
      level,
      nextLevelXp: 2450,
      progressPercent: 48,
    },
    timezone: 'Asia/Tbilisi',
    ...overrides,
  };
}

function dash(daily, weekly, summary, prof) {
  return {
    profile: prof || profile(),
    daily: { periodKey: '2026-09-06', timezone: 'Asia/Tbilisi', quests: daily },
    weekly: { periodKey: '2026-W36', quests: weekly },
    summary,
  };
}

function weeklyRow(overrides) {
  return item({
    id: 'dev-weekly',
    key: 'weekly_steps',
    cadence: 'WEEKLY',
    progressType: 'STEPS',
    target: 32000,
    progress: 16000,
    progressPercent: 50,
    rewardCoins: 150,
    rewardXp: 200,
    targetSource: 'PERSONALIZED',
    difficulty: 'NORMAL',
    reasonKey: 'PERSONAL_BASELINE',
    ...overrides,
  });
}

function buildQuestDevDashboard(scenario) {
  const hydro = item({
    id: 'dev-hydro',
    key: 'daily_hydration',
    progressType: 'HYDRATION_GOAL_PERCENT',
    target: 100,
    progress: 50,
    progressPercent: 50,
    rewardCoins: 20,
    rewardXp: 35,
  });
  const medi = item({
    id: 'dev-medi',
    key: 'daily_medi',
    progressType: 'MEDI_DAILY_USE',
    target: 1,
    progress: 0,
    progressPercent: 0,
    rewardCoins: 10,
    rewardXp: 20,
  });

  switch (scenario) {
    case 'FRESH_DAY':
      return dash(
        [item({ targetSource: 'DEFAULT', difficulty: 'NORMAL', reasonKey: 'DEFAULT_TARGET' }), hydro, medi],
        [weeklyRow({ progress: 0, progressPercent: 0 })],
        { dailyCompleted: 0, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
        profile({ currentStreak: 0, longestStreak: 4, level: 1, totalXp: 40, coinBalance: 0, rankKey: 'LEVEL_1_4', levelProgress: { level: 1, nextLevelXp: 100, progressPercent: 2 } }),
      );
    case 'PARTIAL':
      return dash(
        [
          moveItem({ progress: 1820, progressPercent: 40 }),
          { ...hydro, progress: 50, progressPercent: 50 },
          medi,
        ],
        [weeklyRow()],
        { dailyCompleted: 0, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
      );
    case 'NEAR_COMPLETE':
      return dash(
        [
          moveItem({ progress: 4460, progressPercent: 99 }),
          { ...hydro, progress: 99, progressPercent: 99 },
          { ...medi, progress: 1, progressPercent: 100, status: 'CLAIMED', claimable: false, claimedAt: '2026-09-06T10:00:00.000Z' },
        ],
        [weeklyRow({ progress: 34950, progressPercent: 99 })],
        { dailyCompleted: 1, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
      );
    case 'COMEBACK':
      return dash(
        [
          moveItem({ target: 4000, targetSource: 'COMEBACK', difficulty: 'EASY', reasonKey: 'COMEBACK_EASY', progress: 600, progressPercent: 15 }),
          { ...hydro, progress: 20, progressPercent: 20 },
          medi,
        ],
        [weeklyRow({ progress: 0, progressPercent: 0 })],
        { dailyCompleted: 0, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
        profile({ currentStreak: 0, longestStreak: 12 }),
      );
    case 'STRUGGLING':
      return dash(
        [
          moveItem({ target: 3500, difficulty: 'EASY', reasonKey: 'STRUGGLING_ADJUSTED', progress: 800, progressPercent: 23 }),
          { ...hydro, progress: 35, progressPercent: 35 },
          medi,
        ],
        [weeklyRow({ target: 29000, progress: 4200, progressPercent: 14, reasonKey: 'STRUGGLING_ADJUSTED' })],
        { dailyCompleted: 0, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
        profile({ currentStreak: 0, longestStreak: 6 }),
      );
    case 'DEFAULT_TARGET':
      return dash(
        [
          item({ targetSource: 'DEFAULT', difficulty: 'NORMAL', reasonKey: 'DEFAULT_TARGET', progress: 2400, progressPercent: 48 }),
          { ...hydro, progress: 50, progressPercent: 50 },
          medi,
        ],
        [weeklyRow({ target: 35000, targetSource: 'DEFAULT', reasonKey: 'DEFAULT_TARGET' })],
        { dailyCompleted: 0, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
      );
    case 'CLAIMABLE':
      return dash(
        [
          item({
            progress: 5000,
            progressPercent: 100,
            status: 'COMPLETED',
            claimable: true,
            completedAt: '2026-09-06T11:00:00.000Z',
          }),
          { ...hydro, progress: 100, progressPercent: 100, status: 'COMPLETED', claimable: true, completedAt: '2026-09-06T11:05:00.000Z' },
          { ...medi, progress: 1, progressPercent: 100, status: 'CLAIMED', claimedAt: '2026-09-06T09:00:00.000Z' },
        ],
        [weeklyRow({ progress: 35000, progressPercent: 100, status: 'COMPLETED', claimable: true })],
        { dailyCompleted: 3, dailyTotal: 3, dailyClaimable: 2, weeklyCompleted: 1, unclaimedRewards: 3 },
      );
    case 'ALL_COMPLETE':
      return dash(
        [
          item({ progress: 5000, progressPercent: 100, status: 'CLAIMED', claimedAt: '2026-09-06T09:00:00.000Z' }),
          { ...hydro, progress: 100, progressPercent: 100, status: 'CLAIMED', claimedAt: '2026-09-06T09:10:00.000Z' },
          { ...medi, progress: 1, progressPercent: 100, status: 'CLAIMED', claimedAt: '2026-09-06T09:20:00.000Z' },
        ],
        [weeklyRow({ progress: 22000, progressPercent: 63 })],
        { dailyCompleted: 3, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
      );
    case 'NO_QUESTS':
      return dash(
        [],
        [],
        { dailyCompleted: 0, dailyTotal: 0, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
        profile({ currentStreak: 0, coinBalance: 0, level: 1, totalXp: 0, levelProgress: { level: 1, nextLevelXp: 100, progressPercent: 0 } }),
      );
    case 'OFFLINE':
      return dash(
        [moveItem({ progress: 2200, progressPercent: 49 }), hydro],
        [weeklyRow()],
        { dailyCompleted: 0, dailyTotal: 2, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
      );
    case 'LEVEL_UP':
      return dash(
        [
          item({
            progress: 5000,
            progressPercent: 100,
            status: 'COMPLETED',
            claimable: true,
            completedAt: '2026-09-06T12:00:00.000Z',
            rewardXp: 120,
            rewardCoins: 80,
          }),
        ],
        [],
        { dailyCompleted: 1, dailyTotal: 1, dailyClaimable: 1, weeklyCompleted: 0, unclaimedRewards: 1 },
        profile({ level: 7, totalXp: 2400, levelProgress: { level: 7, nextLevelXp: 2450, progressPercent: 96 } }),
      );
    case 'LONG_TEXT':
      return dash(
        [
          moveItem({ progress: 3820, progressPercent: 85 }),
          { ...hydro, progress: 65, progressPercent: 65 },
          medi,
        ],
        [weeklyRow({ progress: 34950, progressPercent: 99 })],
        { dailyCompleted: 0, dailyTotal: 3, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
        profile({ currentStreak: 99, longestStreak: 99 }),
      );
    case 'LARGE_BALANCE':
      return dash(
        [moveItem({ progress: 100, progressPercent: 2 })],
        [weeklyRow({ progress: 1, progressPercent: 1 })],
        { dailyCompleted: 0, dailyTotal: 1, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
        profile({
          level: 125,
          rankKey: 'LEVEL_50_PLUS',
          totalXp: 482150,
          coinBalance: 999999,
          currentStreak: 7,
          longestStreak: 40,
          levelProgress: { level: 125, nextLevelXp: 490000, progressPercent: 1 },
        }),
      );
    case 'LONG_STREAK':
      return dash(
        [moveItem({ progress: 2500, progressPercent: 56 })],
        [],
        { dailyCompleted: 0, dailyTotal: 1, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 },
        profile({ currentStreak: 1000, longestStreak: 1000, coinBalance: 9 }),
      );
    case 'ERROR':
    case 'LIVE':
    default:
      return null;
  }
}

function applyQuestDevView(input, opts) {
  if (!isQuestDevEnabled(opts)) {
    return {
      dashboard: input.dashboard,
      loading: input.loading,
      error: input.error,
      stale: input.stale,
      fixtureOffline: false,
    };
  }
  const scenario = input.scenario || 'LIVE';
  if (scenario === 'LIVE') {
    return {
      dashboard: input.dashboard,
      loading: input.loading,
      error: input.error,
      stale: input.stale,
      fixtureOffline: false,
    };
  }
  if (scenario === 'ERROR') {
    return { dashboard: null, loading: false, error: true, stale: false, fixtureOffline: false };
  }
  const next = overlay && overlay.scenario === scenario ? overlay.dashboard : buildQuestDevDashboard(scenario);
  return {
    dashboard: next,
    loading: false,
    error: false,
    stale: scenario === 'OFFLINE',
    fixtureOffline: scenario === 'OFFLINE',
  };
}

function claimQuestDevFixture(dashboard, questId) {
  const base =
    (overlay && overlay.scenario === current && overlay.dashboard) ||
    dashboard ||
    buildQuestDevDashboard(current);
  if (!base || !questId) return null;
  dashboard = base;
  const patch = (row) =>
    row.id === questId
      ? { ...row, status: 'CLAIMED', claimable: false, claimedAt: new Date().toISOString() }
      : row;
  const daily = (dashboard.daily?.quests || []).map(patch);
  const weekly = (dashboard.weekly?.quests || []).map(patch);
  const claimed =
    [...(dashboard.daily?.quests || []), ...(dashboard.weekly?.quests || [])].find((row) => row.id === questId) ||
    null;
  if (!claimed?.claimable) return null;
  const previousLevel = dashboard.profile.level;
  const jump = current === 'LEVEL_UP' ? 1 : 0;
  const currentLevel = previousLevel + jump;
  const coinsAwarded = claimed.rewardCoins || 0;
  const xpAwarded = claimed.rewardXp || 0;
  const nextDash = {
    ...dashboard,
    profile: {
      ...dashboard.profile,
      level: currentLevel,
      rankKey: rankKeyFromLevel(currentLevel),
      coinBalance: (dashboard.profile.coinBalance || 0) + coinsAwarded,
      totalXp: (dashboard.profile.totalXp || 0) + xpAwarded,
      levelProgress: {
        ...dashboard.profile.levelProgress,
        level: currentLevel,
        progressPercent: jump ? 8 : dashboard.profile.levelProgress?.progressPercent,
      },
    },
    daily: { ...dashboard.daily, quests: daily },
    weekly: { ...dashboard.weekly, quests: weekly },
    summary: {
      ...dashboard.summary,
      dailyClaimable: Math.max(0, (dashboard.summary?.dailyClaimable || 0) - (claimed.cadence === 'WEEKLY' ? 0 : 1)),
      unclaimedRewards: Math.max(0, (dashboard.summary?.unclaimedRewards || 0) - 1),
    },
  };
  overlay = { scenario: current, dashboard: nextDash };
  notifyQuestDev();
  return {
    ok: true,
    claimed: true,
    alreadyClaimed: false,
    quest: { id: claimed.id, key: claimed.key, status: 'CLAIMED', completedAt: claimed.completedAt, claimedAt: nextDash.daily.quests.find((row) => row.id === questId)?.claimedAt || weekly.find((row) => row.id === questId)?.claimedAt || null },
    reward: { coinsAwarded, xpAwarded },
    profile: {
      coinBalance: nextDash.profile.coinBalance,
      totalXp: nextDash.profile.totalXp,
      previousLevel,
      currentLevel,
      leveledUp: jump > 0,
      levelProgress: nextDash.profile.levelProgress,
      currentStreak: nextDash.profile.currentStreak,
      longestStreak: nextDash.profile.longestStreak,
    },
    dashboard: nextDash,
  };
}

module.exports = {
  QUEST_DEV_SCENARIOS,
  QUEST_DEV_LABELS,
  isQuestDevEnabled,
  getQuestDevScenario,
  setQuestDevScenario,
  subscribeQuestDevScenario,
  buildQuestDevDashboard,
  applyQuestDevView,
  claimQuestDevFixture,
  isQuestVisualSession,
  setQuestVisualSession,
  subscribeQuestVisualSession,
  startQuestVisualSession,
  questVisualAuthSnapshot,
  buildQuestDevHistory,
  buildQuestDevWallet,
  buildQuestDevAchievements,
  claimAchievementDevFixture,
};
