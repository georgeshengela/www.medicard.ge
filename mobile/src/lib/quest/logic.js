/** Pure Quest helpers — safe for Node tests and the app. */

const QUEST_RANKS = Object.freeze({
  LEVEL_1_4: { ka: 'დამწყები', en: 'Newcomer', fr: 'Débutant', ru: 'Новичок' },
  LEVEL_5_9: { ka: 'მოძრაობაში', en: 'In motion', fr: 'En mouvement', ru: 'В движении' },
  LEVEL_10_14: { ka: 'რიტმში', en: 'In rhythm', fr: 'Dans le rythme', ru: 'В ритме' },
  LEVEL_15_19: { ka: 'ძლიერი რიტმი', en: 'Strong rhythm', fr: 'Rythme solide', ru: 'Сильный ритм' },
  LEVEL_20_29: { ka: 'ჩვევა', en: 'A habit', fr: 'Une habitude', ru: 'Привычка' },
  LEVEL_30_39: { ka: 'დარწმუნებული გზა', en: 'Steady path', fr: 'Chemin assuré', ru: 'Уверенный путь' },
  LEVEL_40_49: { ka: 'რიტმის ოსტატი', en: 'Rhythm master', fr: 'Maître du rythme', ru: 'Мастер ритма' },
  LEVEL_50_PLUS: { ka: 'Medi ლეგენდა', en: 'Medi legend', fr: 'Légende Medi', ru: 'Легенда Medi' },
});

function questLocaleFromTag(tag) {
  const raw = String(tag || '').toLowerCase();
  if (raw.startsWith('ka')) return 'ka';
  if (raw.startsWith('fr')) return 'fr';
  if (raw.startsWith('ru')) return 'ru';
  if (raw.startsWith('en')) return 'en';
  return 'ka';
}

function formatQuestNumber(value, locale = 'ka') {
  const n = Math.round(Number(value) || 0);
  const loc = locale === 'en' ? 'en-US' : locale === 'fr' ? 'fr-FR' : locale === 'ru' ? 'ru-RU' : 'ka-GE';
  return n.toLocaleString(loc);
}

function formatQuestPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function displayQuestProgress(quest) {
  const target = Math.max(0, Number(quest?.target) || 0);
  const raw = Math.max(0, Number(quest?.progress) || 0);
  const progress = target > 0 ? Math.min(raw, target) : raw;
  return {
    progress,
    target,
    percent: formatQuestPercent(quest?.progressPercent),
    overTarget: target > 0 && raw > target,
  };
}

function progressBarFill(percent) {
  const value = formatQuestPercent(percent);
  return {
    value,
    visible: value > 0,
    widthPercent: value >= 100 ? 100 : value,
    minFill: value > 0 && value < 100,
  };
}

function homeClaimLayout(mode) {
  return {
    showDailyProgress: mode !== 'claimable',
    compactClaim: mode === 'claimable',
  };
}

function rewardFloatOverlayStyle() {
  return { position: 'absolute', left: 0, right: 0, zIndex: 40, pointerEvents: 'none' };
}

function walletActivityLabel(sourceType, missionLabel) {
  // Legacy shim — Wallet screens should use walletSourceLabel from rewardsLogic.
  const { walletSourceLabel } = require('./rewardsLogic.js');
  return walletSourceLabel(sourceType, {
    mission: missionLabel,
    ledgerUnknown: 'Balance adjustment',
    ledgerSystem: 'System adjustment',
    ledgerAdmin: 'System adjustment',
    ledgerAchievement: 'Achievement',
    ledgerRedeem: 'Medi reward',
  });
}

function historyGroupKey(quest, todayYmd) {
  const raw = String(quest?.completedAt || quest?.claimedAt || quest?.assignedAt || '');
  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return todayYmd || '';
}

function rankKeyFromLevel(level) {
  const n = Number(level) || 1;
  if (n >= 50) return 'LEVEL_50_PLUS';
  if (n >= 40) return 'LEVEL_40_49';
  if (n >= 30) return 'LEVEL_30_39';
  if (n >= 20) return 'LEVEL_20_29';
  if (n >= 15) return 'LEVEL_15_19';
  if (n >= 10) return 'LEVEL_10_14';
  if (n >= 5) return 'LEVEL_5_9';
  return 'LEVEL_1_4';
}

function rankLabel(rankKey, locale = 'ka') {
  const row = QUEST_RANKS[rankKey] || QUEST_RANKS.LEVEL_1_4;
  return row[locale] || row.ka;
}

function pickStableVariant(variants, seed) {
  if (!Array.isArray(variants) || !variants.length) return '';
  const text = String(seed || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return variants[hash % variants.length];
}

function homeQuestMood(summary) {
  const total = Number(summary?.dailyTotal) || 0;
  const done = Number(summary?.dailyCompleted) || 0;
  const claimable = Number(summary?.dailyClaimable) || 0;
  if (claimable > 0) return 'reward_waiting';
  if (!total) return 'none';
  if (done === 0) return 'fresh_day';
  if (done >= total) return 'all_daily_complete';
  const near = summary?.nearCompletion;
  if (near) return 'near_completion';
  if (done === 1) return 'one_completed';
  return 'progress_started';
}

function celebrationKey(kind, questId, stamp) {
  return `${kind}:${questId}:${stamp || ''}`;
}

function shouldCelebrate(seen, key) {
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
}

function isClaimableStatus(quest) {
  return quest?.status === 'COMPLETED' && quest?.claimable === true;
}

function questKind(quest) {
  const type = String(quest?.progressType || '');
  const cadence = String(quest?.cadence || '');
  const key = String(quest?.key || '');
  if (type === 'HYDRATION_GOAL_PERCENT' || key.includes('hydration')) return 'hydration';
  if (type === 'MEDI_DAILY_USE' || key.includes('medi')) return 'medi';
  if (cadence === 'WEEKLY' || key.includes('weekly')) return 'weekly';
  return 'movement';
}

function pickPriorityQuest(dashboard) {
  const daily = dashboard?.daily?.quests || [];
  const weekly = dashboard?.weekly?.quests || [];
  const all = [...daily, ...weekly];
  const claimable = all.filter((row) => isClaimableStatus(row));
  if (claimable.length) {
    return { quest: claimable[0], mode: 'claimable', claimCount: claimable.length };
  }
  const active = daily
    .filter((row) => row.status === 'ACTIVE')
    .sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
  if (active[0]) return { quest: active[0], mode: 'preview', claimCount: 0 };
  return { quest: null, mode: daily.length ? 'done' : 'empty', claimCount: 0 };
}

function homeModuleView(input) {
  if (input?.loading && !input?.dashboard) return { kind: 'loading' };
  if (input?.error && !input?.dashboard) return { kind: 'error' };
  if (!input?.dashboard) return { kind: 'empty' };
  // Server sends `profile: null` when quest tables are not provisioned.
  // A missing profile is the only Home state that cannot show level / coins.
  // `unavailable` with a profile still has identity to render; no daily
  // missions is `priority.mode === 'empty'`, not a full-card empty.
  if (!input.dashboard.profile) return { kind: 'empty' };
  const priority = pickPriorityQuest(input.dashboard);
  const mood = homeQuestMood({
    dailyTotal: input.dashboard.summary?.dailyTotal,
    dailyCompleted: input.dashboard.summary?.dailyCompleted,
    dailyClaimable: input.dashboard.summary?.dailyClaimable,
    nearCompletion: input.dashboard.daily?.quests?.some(
      (quest) => quest.status === 'ACTIVE' && quest.progressPercent >= 80,
    ),
  });
  return {
    kind: input.stale ? 'cached' : 'ready',
    mood,
    priority,
    dailyCompleted: input.dashboard.summary?.dailyCompleted || 0,
    dailyTotal: input.dashboard.summary?.dailyTotal || 0,
    streak: input.dashboard.profile?.currentStreak || 0,
    level: input.dashboard.profile?.level || 1,
  };
}

function beginClaimLock(locks, questId) {
  if (!questId || locks.has(questId)) return false;
  locks.add(questId);
  return true;
}

function endClaimLock(locks, questId) {
  locks.delete(questId);
}

function capabilityFromHealth(input) {
  if (input?.expoGo || !input?.supported) {
    return { status: 'UNAVAILABLE', source: 'UNKNOWN' };
  }
  if (input?.denied) {
    return {
      status: 'PERMISSION_DENIED',
      source: input.platform === 'apple' ? 'APPLE_HEALTH' : input.platform === 'google' ? 'HEALTH_CONNECT' : 'UNKNOWN',
    };
  }
  if (!input?.connected) {
    return {
      status: 'NOT_CONFIGURED',
      source: input.platform === 'apple' ? 'APPLE_HEALTH' : input.platform === 'google' ? 'HEALTH_CONNECT' : 'UNKNOWN',
    };
  }
  return {
    status: 'AVAILABLE',
    source: input.platform === 'apple' ? 'APPLE_HEALTH' : input.platform === 'google' ? 'HEALTH_CONNECT' : 'OTHER',
  };
}

function stepsQuestEligible(status) {
  return status === 'AVAILABLE';
}

/**
 * One entry per daily quest, in display order, so the Home ring / segmented
 * bar can show "which" missions are done rather than only how many.
 * 'done' = claimed, 'ready' = completed but unclaimed, 'active' = in progress.
 */
function dailySegments(quests) {
  const list = Array.isArray(quests) ? quests : [];
  return list
    .filter((row) => row && row.status !== 'CANCELLED' && row.status !== 'EXPIRED')
    .map((row) => {
      if (row.status === 'CLAIMED') return 'done';
      if (isClaimableStatus(row)) return 'ready';
      return 'active';
    });
}

/** Level ring inputs: percent into the current level and XP left to the next. */
function levelRingProgress(profile) {
  if (!profile) return { percent: 0, remaining: null, maxed: false };
  const lp = profile.levelProgress || {};
  const percent = formatQuestPercent(lp.progressPercent);
  const next = lp.nextLevelXp == null ? null : Math.max(0, Number(lp.nextLevelXp) || 0);
  const total = Math.max(0, Number(profile && profile.totalXp) || 0);
  const remaining = next == null ? null : Math.max(0, next - total);
  return {
    percent: next == null ? 100 : percent,
    remaining,
    maxed: next == null,
  };
}

/** Hub "today" header pill and Home summary share this. */
function dailyCounter(summary) {
  const total = Math.max(0, Number(summary && summary.dailyTotal) || 0);
  const done = Math.min(total, Math.max(0, Number(summary && summary.dailyCompleted) || 0));
  return { done, total, allDone: total > 0 && done >= total };
}

function privacySafeQuestBlob(value) {
  const blob = JSON.stringify(value ?? {});
  return !/"prompt"|"assistantReply"|"hydrationMl"|"diagnosis"|"medicationName"/i.test(blob);
}

/* ── Phase 4: achievements (pure helpers, no UI) ───────────────────── */

const ACHIEVEMENT_RARITY_ORDER = Object.freeze(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']);

function achievementRarityRank(rarity) {
  const index = ACHIEVEMENT_RARITY_ORDER.indexOf(String(rarity || '').toUpperCase());
  return index < 0 ? 0 : index;
}

/**
 * Collection screen ordering inside a section:
 * claimable first, then unlocked, then in-progress by closeness, secrets last.
 */
function sortAchievements(items) {
  const list = Array.isArray(items) ? [...items] : [];
  return list.sort((a, b) => {
    const stateOf = (row) => (row.claimable ? 0 : row.unlocked ? 1 : row.secret && !row.unlocked ? 3 : 2);
    const sa = stateOf(a);
    const sb = stateOf(b);
    if (sa !== sb) return sa - sb;
    if (sa === 2) {
      const pa = Number(a.progressPercent) || 0;
      const pb = Number(b.progressPercent) || 0;
      if (pa !== pb) return pb - pa;
    }
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}

/** Category grouping for the Achievements screen sections. */
function groupAchievements(items) {
  const order = ['PROGRESSION', 'STREAK', 'MOVEMENT', 'HYDRATION', 'MEDI', 'WEEKLY', 'LEVEL', 'COINS', 'SPECIAL'];
  const buckets = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = order.includes(item.category) ? item.category : 'SPECIAL';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return order
    .filter((key) => buckets.has(key))
    .map((key) => ({ category: key, items: sortAchievements(buckets.get(key)) }));
}

/** Hub preview: up to `limit` medallions — claimable → freshly unlocked → nearest locked. */
function achievementsPreview(items, limit = 4) {
  const list = Array.isArray(items) ? items : [];
  const claimable = list.filter((row) => row.claimable);
  const unlocked = list
    .filter((row) => row.unlocked && !row.claimable)
    .sort((a, b) => String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || '')));
  const nearest = list
    .filter((row) => !row.unlocked && !row.secret)
    .sort((a, b) => (Number(b.progressPercent) || 0) - (Number(a.progressPercent) || 0));
  return [...claimable, ...unlocked, ...nearest].slice(0, Math.max(0, limit));
}

/** Summary line inputs for hub preview + screen header. */
function achievementsCounter(summary) {
  const total = Math.max(0, Number(summary && summary.total) || 0);
  const unlocked = Math.min(total, Math.max(0, Number(summary && summary.unlocked) || 0));
  const claimable = Math.max(0, Number(summary && summary.claimable) || 0);
  return { total, unlocked, claimable, percent: total > 0 ? Math.round((unlocked / total) * 100) : 0 };
}

module.exports = {
  QUEST_RANKS,
  questLocaleFromTag,
  formatQuestNumber,
  formatQuestPercent,
  displayQuestProgress,
  progressBarFill,
  homeClaimLayout,
  rewardFloatOverlayStyle,
  walletActivityLabel,
  historyGroupKey,
  rankKeyFromLevel,
  rankLabel,
  pickStableVariant,
  homeQuestMood,
  celebrationKey,
  shouldCelebrate,
  isClaimableStatus,
  questKind,
  pickPriorityQuest,
  homeModuleView,
  beginClaimLock,
  endClaimLock,
  capabilityFromHealth,
  stepsQuestEligible,
  privacySafeQuestBlob,
  dailySegments,
  levelRingProgress,
  dailyCounter,
  ACHIEVEMENT_RARITY_ORDER,
  achievementRarityRank,
  sortAchievements,
  groupAchievements,
  achievementsPreview,
  achievementsCounter,
};
