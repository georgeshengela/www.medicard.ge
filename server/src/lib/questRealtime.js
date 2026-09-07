/**
 * Quest realtime hook — same Socket.IO server as admin ops.
 *
 * Phase 3: attachAdminRealtime registers an emitter that sends
 * `quest:completed` and `quest:reward_claimed` to `user:${userId}`.
 * Payloads stay privacy-safe: no health notes, ml, chat, or GPS.
 */
let emitFn = null;
let completedListeners = [];

export function registerQuestRealtimeEmitter(fn) {
  emitFn = typeof fn === 'function' ? fn : null;
}

export function onQuestCompleted(listener) {
  if (typeof listener === 'function') completedListeners.push(listener);
  return () => {
    completedListeners = completedListeners.filter((fn) => fn !== listener);
  };
}

export function publicQuestCompletedPayload(payload = {}) {
  const questId = payload.questId || payload.userQuestId;
  return {
    questId,
    userQuestId: questId,
    key: payload.key || payload.templateKey,
    category: payload.category,
    status: 'COMPLETED',
    completedAt: payload.completedAt,
    periodKey: payload.periodKey,
    rewardCoins: payload.rewardCoins,
    rewardXp: payload.rewardXp,
    progress: payload.progress,
    target: payload.target,
    progressPercent: payload.progressPercent,
  };
}

export function emitQuestCompleted(userId, payload) {
  const safe = publicQuestCompletedPayload({ ...payload, userId });
  for (const listener of completedListeners) {
    try {
      listener({ userId, ...safe });
    } catch (error) {
      console.warn('[quest] completed listener failed', error?.message);
    }
  }
  if (!userId || typeof emitFn !== 'function') return false;
  emitFn(userId, { event: 'quest:completed', userId, ...safe });
  return true;
}

/** Phase 4 — achievement unlocked. Safe payload only: keys, rarity, rewards. */
export function emitAchievementUnlocked(userId, payload) {
  if (!userId || typeof emitFn !== 'function') return false;
  emitFn(userId, {
    event: 'achievement:unlocked',
    achievementId: payload.achievementId,
    userAchievementId: payload.userAchievementId,
    key: payload.key,
    family: payload.family,
    rarity: payload.rarity,
    secret: Boolean(payload.secret),
    rewardCoins: payload.rewardCoins,
    rewardXp: payload.rewardXp,
    unlockedAt: payload.unlockedAt,
  });
  return true;
}

/** Phase 4 — achievement reward claimed. Mirrors quest:reward_claimed shape. */
export function emitAchievementClaimed(userId, payload) {
  if (!userId || typeof emitFn !== 'function') return false;
  emitFn(userId, {
    event: 'achievement:claimed',
    achievementId: payload.achievementId,
    userAchievementId: payload.userAchievementId,
    key: payload.key,
    rarity: payload.rarity,
    coinsAwarded: payload.coinsAwarded,
    xpAwarded: payload.xpAwarded,
    coinBalance: payload.coinBalance,
    totalXp: payload.totalXp,
    previousLevel: payload.previousLevel,
    currentLevel: payload.currentLevel,
    leveledUp: payload.leveledUp,
    levelProgress: payload.levelProgress,
  });
  return true;
}

export function emitQuestRewardClaimed(userId, payload) {
  if (!userId || typeof emitFn !== 'function') return false;
  emitFn(userId, {
    event: 'quest:reward_claimed',
    questId: payload.questId,
    coinsAwarded: payload.coinsAwarded,
    xpAwarded: payload.xpAwarded,
    coinBalance: payload.coinBalance,
    totalXp: payload.totalXp,
    previousLevel: payload.previousLevel,
    currentLevel: payload.currentLevel,
    leveledUp: payload.leveledUp,
    levelProgress: payload.levelProgress,
    currentStreak: payload.currentStreak,
    longestStreak: payload.longestStreak,
  });
  return true;
}

/** Phase 9 — Journey milestone unlocked. No health / GPS / chat. */
export function emitMediJourneyMilestoneUnlocked(userId, payload = {}) {
  if (!userId || typeof emitFn !== 'function') return false;
  emitFn(userId, {
    event: 'medi_journey:milestone_unlocked',
    milestoneKey: payload.milestoneKey,
    chapterKey: payload.chapterKey,
    unlockedAt: payload.unlockedAt,
  });
  return true;
}
