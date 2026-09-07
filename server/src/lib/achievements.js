import { prisma } from './prisma.js';
import {
  ACHIEVEMENT_DEFINITIONS,
  assertAchievementEconomy,
  ensureAchievementDefinitions,
} from './achievementDefs.js';
import { getLevelForXp } from './questLevels.js';
import { recordServerProductEvent } from './productEvents.js';
import { emitAchievementClaimed, emitAchievementUnlocked } from './questRealtime.js';
import { QUEST_TIMEZONE_FALLBACK } from './questTime.js';

/**
 * Phase 4 — Achievements & long-term progression.
 *
 * Server-authoritative: every counter is recomputed from the source of truth
 * (UserQuest completions, UserQuestProfile streak, RewardLedger) — mobile never
 * submits progress. Unlocks are immutable rows (unique userId+achievementId);
 * re-evaluation is the reconciliation mechanism and can only add unlocks,
 * never revoke them. Rewards are issued only on explicit claim, through the
 * same immutable RewardLedger (sourceType ACHIEVEMENT, unique per source),
 * so double claims are structurally impossible.
 *
 * Cascade safety: claiming an achievement can raise XP → level → unlock more
 * LEVEL_* achievements, but those only become claimable (never auto-claimed),
 * so reward issuance always terminates.
 */

const UNLOCKED = 'UNLOCKED';
const CLAIMED = 'CLAIMED';

function dbOf(options = {}) {
  return options.db || prisma;
}

async function withTx(options, work) {
  const db = dbOf(options);
  if (typeof db?.$transaction !== 'function') return work(db);
  return db.$transaction((tx) => work(tx));
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

function isPrismaMissing(error) {
  return error?.code === 'P2021' || /does not exist/i.test(error?.message || '');
}

function localHour(date, timezone) {
  try {
    const text = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || QUEST_TIMEZONE_FALLBACK,
      hour: 'numeric',
      hour12: false,
    }).format(date instanceof Date ? date : new Date(date));
    return Number(text) % 24;
  } catch {
    return (date instanceof Date ? date : new Date(date)).getUTCHours();
  }
}

function ymdToUtc(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function ymdDiffDays(a, b) {
  return Math.round((ymdToUtc(b) - ymdToUtc(a)) / 86_400_000);
}

/**
 * Recompute every achievement counter from source-of-truth tables.
 * Pure read — never writes.
 */
export async function computeAchievementCounters(userId, options = {}) {
  const db = dbOf(options);
  const [quests, profile, ledger] = await Promise.all([
    db.userQuest.findMany({
      where: { userId, status: { in: ['COMPLETED', 'CLAIMED'] } },
      include: { template: true },
    }),
    db.userQuestProfile.findUnique({ where: { userId } }).catch(() => null),
    db.rewardLedger.findMany({ where: { userId } }),
  ]);

  let xpTotal = 0;
  let coinsEarned = 0;
  for (const row of ledger) {
    const amount = Number(row.amount) || 0;
    if (row.currency === 'XP') xpTotal += amount;
    if (row.currency === 'COIN' && amount > 0) coinsEarned += amount;
  }

  const byCategory = { MOVEMENT: 0, HYDRATION: 0, MEDI: 0 };
  let weeklyCompleted = 0;
  let questsClaimed = 0;
  const dailyDays = new Set();
  let earlyBird = 0;
  let nightOwl = 0;
  const fallbackTz = profile?.timezone || QUEST_TIMEZONE_FALLBACK;

  for (const quest of quests) {
    const category = quest.template?.category;
    if (category in byCategory) byCategory[category] += 1;
    if (quest.template?.cadence === 'WEEKLY') weeklyCompleted += 1;
    if (quest.status === 'CLAIMED') questsClaimed += 1;
    if (/^\d{4}-\d{2}-\d{2}$/.test(quest.periodKey || '')) dailyDays.add(quest.periodKey);
    if (quest.completedAt) {
      const tz = quest.metadata?.assignedTimezone || fallbackTz;
      const hour = localHour(quest.completedAt, tz);
      if (hour < 8) earlyBird = 1;
      if (hour >= 22) nightOwl = 1;
    }
  }

  // Comeback: a completed daily quest after 7+ fully missed local days.
  let comeback = 0;
  const days = [...dailyDays].sort();
  for (let i = 1; i < days.length; i += 1) {
    if (ymdDiffDays(days[i - 1], days[i]) >= 8) {
      comeback = 1;
      break;
    }
  }

  return {
    questsCompleted: quests.length,
    questsClaimed,
    weeklyCompleted,
    moveCompleted: byCategory.MOVEMENT,
    hydrateCompleted: byCategory.HYDRATION,
    mediCompleted: byCategory.MEDI,
    longestStreak: Math.max(profile?.longestStreak || 0, profile?.currentStreak || 0),
    level: getLevelForXp(xpTotal).level,
    coinsEarned,
    comeback,
    earlyBird,
    nightOwl,
  };
}

export function counterForDefinition(definition, counters) {
  switch (definition.key) {
    case 'FIRST_QUEST':
      return counters.questsCompleted;
    case 'FIRST_CLAIM':
      return counters.questsClaimed;
    case 'FIRST_WEEKLY':
      return counters.weeklyCompleted;
    case 'COMEBACK':
      return counters.comeback;
    case 'EARLY_BIRD':
      return counters.earlyBird;
    case 'NIGHT_OWL':
      return counters.nightOwl;
    default:
      break;
  }
  switch (definition.family) {
    case 'QUESTS':
      return counters.questsCompleted;
    case 'STREAK':
      return counters.longestStreak;
    case 'MOVE':
      return counters.moveCompleted;
    case 'HYDRATE':
      return counters.hydrateCompleted;
    case 'MEDI':
      return counters.mediCompleted;
    case 'WEEKLY':
      return counters.weeklyCompleted;
    case 'LEVEL':
      return counters.level;
    case 'COINS_EARNED':
      return counters.coinsEarned;
    default:
      return 0;
  }
}

function emitAchievementAnalytics(userId, kind, definition, options = {}) {
  if (options.db && options.db !== prisma) return;
  recordServerProductEvent({
    userId,
    kind,
    category: definition?.family || 'achievement',
    entityId: definition?.key || kind,
    source: 'quest',
  }).catch((error) => {
    console.warn('[achievement] analytics event failed', kind, error?.message);
  });
}

/**
 * Evaluator + reconciliation. Recomputes counters and creates any missing
 * unlock rows. Idempotent — unique constraint makes double unlock impossible.
 */
export async function evaluateAchievements(userId, options = {}) {
  const db = dbOf(options);
  await ensureAchievementDefinitions(db);
  const [definitions, existing, counters] = await Promise.all([
    db.achievementDefinition.findMany({ where: { isActive: true } }),
    db.userAchievement.findMany({ where: { userId } }),
    computeAchievementCounters(userId, { ...options, db }),
  ]);
  const unlockedByDefinition = new Map(existing.map((row) => [row.achievementId, row]));
  const now = options.now || new Date();
  const unlocked = [];

  for (const definition of definitions) {
    if (unlockedByDefinition.has(definition.id)) continue;
    const counter = counterForDefinition(definition, counters);
    if (counter < definition.threshold) continue;
    try {
      const row = await db.userAchievement.create({
        data: {
          userId,
          achievementId: definition.id,
          unlockedAt: now,
          progressAtUnlock: counter,
          status: UNLOCKED,
        },
      });
      unlocked.push({ definition, row });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  for (const { definition, row } of unlocked) {
    emitAchievementUnlocked(userId, {
      achievementId: definition.id,
      userAchievementId: row.id,
      key: definition.key,
      family: definition.family,
      rarity: definition.rarity,
      secret: definition.isSecret,
      rewardCoins: definition.rewardCoins,
      rewardXp: definition.rewardXp,
      unlockedAt: row.unlockedAt instanceof Date ? row.unlockedAt.toISOString() : row.unlockedAt,
    });
    emitAchievementAnalytics(userId, 'achievement_unlocked', definition, options);
  }

  return { unlocked, counters };
}

/** Best-effort hook used by the quest engine — never breaks quest flows. */
export async function evaluateAchievementsSafe(userId, options = {}) {
  try {
    return await evaluateAchievements(userId, options);
  } catch (error) {
    if (!isPrismaMissing(error)) {
      console.warn('[achievement] evaluation failed', error?.message);
    }
    return { unlocked: [], counters: null };
  }
}

/** Reconciliation entry point — evaluation is the repair. */
export async function reconcileAchievements(userId, options = {}) {
  const result = await evaluateAchievements(userId, options);
  if (result.unlocked.length) {
    console.warn('[achievement] reconciliation unlocked missing achievements', {
      userId,
      keys: result.unlocked.map(({ definition }) => definition.key),
    });
  }
  return {
    repairedUnlocks: result.unlocked.length,
    counters: result.counters,
  };
}

async function rewardBalance(db, userId) {
  const rows = await db.rewardLedger.findMany({ where: { userId } });
  let xp = 0;
  let coins = 0;
  for (const row of rows) {
    if (row.currency === 'XP') xp += row.amount;
    if (row.currency === 'COIN') coins += row.amount;
  }
  return { xp, coins };
}

async function writeAchievementReward(tx, { userId, currency, amount, sourceId, now }) {
  const value = Number(amount) || 0;
  if (value < 0) {
    const error = new Error('Achievement ledger earn cannot be negative.');
    error.status = 400;
    error.code = 'ACHIEVEMENT_REWARD_NEGATIVE';
    throw error;
  }
  if (!value) return { created: false, amount: 0 };
  try {
    await tx.rewardLedger.create({
      data: {
        userId,
        currency,
        amount: value,
        transactionType: 'EARN',
        sourceType: 'ACHIEVEMENT',
        sourceId,
        createdAt: now,
      },
    });
    return { created: true, amount: value };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { created: false, amount: 0 };
  }
}

function publicAchievement(definition, row, counters) {
  const unlockedRow = row || null;
  const unlocked = Boolean(unlockedRow);
  const claimed = unlockedRow?.status === CLAIMED || Boolean(unlockedRow?.claimedAt);
  if (definition.isSecret && !unlocked) {
    // Secret achievements stay masked: no key, title, threshold, or progress.
    return {
      id: definition.id,
      key: null,
      family: null,
      category: 'SPECIAL',
      rarity: definition.rarity,
      secret: true,
      threshold: null,
      rewardCoins: null,
      rewardXp: null,
      unlocked: false,
      claimed: false,
      claimable: false,
      unlockedAt: null,
      claimedAt: null,
      progress: null,
      progressPercent: null,
      userAchievementId: null,
      sortOrder: definition.sortOrder,
    };
  }
  const counter = counters ? counterForDefinition(definition, counters) : null;
  const progress = unlocked
    ? definition.threshold
    : Math.max(0, Math.min(definition.threshold, counter ?? 0));
  return {
    id: definition.id,
    key: definition.key,
    family: definition.family,
    category: definition.category,
    rarity: definition.rarity,
    secret: definition.isSecret,
    threshold: definition.threshold,
    rewardCoins: definition.rewardCoins,
    rewardXp: definition.rewardXp,
    unlocked,
    claimed,
    claimable: unlocked && !claimed,
    unlockedAt:
      unlockedRow?.unlockedAt instanceof Date ? unlockedRow.unlockedAt.toISOString() : unlockedRow?.unlockedAt || null,
    claimedAt:
      unlockedRow?.claimedAt instanceof Date ? unlockedRow.claimedAt.toISOString() : unlockedRow?.claimedAt || null,
    progress,
    progressPercent:
      definition.threshold > 0 ? Math.min(100, Math.round((progress / definition.threshold) * 100)) : 0,
    userAchievementId: unlockedRow?.id || null,
    sortOrder: definition.sortOrder,
  };
}

/**
 * Full collection for the Achievements screen. Runs the evaluator first so
 * the response is always consistent with the source of truth.
 */
export async function getAchievementsOverview(userId, options = {}) {
  const db = dbOf(options);
  let counters = null;
  try {
    const evaluated = await evaluateAchievements(userId, { ...options, db });
    counters = evaluated.counters;
  } catch (error) {
    if (!isPrismaMissing(error)) throw error;
    return { items: [], summary: emptySummary(), unavailable: true };
  }

  const [definitions, rows] = await Promise.all([
    db.achievementDefinition.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    db.userAchievement.findMany({ where: { userId } }),
  ]);
  const byDefinition = new Map(rows.map((row) => [row.achievementId, row]));
  const items = definitions.map((definition) => publicAchievement(definition, byDefinition.get(definition.id), counters));

  const unlocked = items.filter((item) => item.unlocked);
  return {
    items,
    summary: {
      total: items.length,
      unlocked: unlocked.length,
      claimable: items.filter((item) => item.claimable).length,
      claimed: items.filter((item) => item.claimed).length,
      secretsLocked: items.filter((item) => item.secret && !item.unlocked).length,
      byRarity: unlocked.reduce((acc, item) => {
        acc[item.rarity] = (acc[item.rarity] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

function emptySummary() {
  return { total: 0, unlocked: 0, claimable: 0, claimed: 0, secretsLocked: 0, byRarity: {} };
}

/**
 * Explicit reward claim. Idempotent via the RewardLedger unique constraint —
 * a second claim returns alreadyClaimed with zero rewards.
 */
export async function claimAchievement(userId, achievementId, options = {}) {
  const result = await withTx(options, async (tx) => {
    const definition = await tx.achievementDefinition.findUnique({ where: { id: achievementId } });
    if (!definition || !definition.isActive) {
      throw httpError('მიღწევა ვერ მოიძებნა.', 404);
    }
    assertAchievementEconomy(definition);

    const rows = await tx.userAchievement.findMany({ where: { userId, achievementId: definition.id }, take: 1 });
    const unlock = rows[0];
    if (!unlock) {
      throw httpError('მიღწევა ჯერ არ არის გახსნილი.', 409);
    }

    const before = await rewardBalance(tx, userId);
    const previousLevel = getLevelForXp(before.xp).level;
    const now = options.now || new Date();

    const xpWrite = await writeAchievementReward(tx, {
      userId,
      currency: 'XP',
      amount: definition.rewardXp,
      sourceId: unlock.id,
      now,
    });
    const coinWrite = await writeAchievementReward(tx, {
      userId,
      currency: 'COIN',
      amount: definition.rewardCoins,
      sourceId: unlock.id,
      now,
    });
    const claimed = xpWrite.created || coinWrite.created;

    const updatedUnlock = await tx.userAchievement.update({
      where: { id: unlock.id },
      data: { status: CLAIMED, claimedAt: unlock.claimedAt || now },
    });

    const after = await rewardBalance(tx, userId);
    const levelProgress = getLevelForXp(after.xp);

    // Keep the cached profile in sync with the authoritative ledger.
    if (claimed && typeof tx.userQuestProfile?.upsert === 'function') {
      await tx.userQuestProfile
        .upsert({
          where: { userId },
          update: {
            totalXp: after.xp,
            cachedCoinBalance: after.coins,
            currentLevel: levelProgress.level,
          },
          create: {
            userId,
            totalXp: after.xp,
            cachedCoinBalance: after.coins,
            currentLevel: levelProgress.level,
          },
        })
        .catch(() => null);
    }

    return {
      claimed,
      alreadyClaimed: !claimed,
      definition,
      unlock: updatedUnlock,
      reward: {
        coinsAwarded: coinWrite.created ? coinWrite.amount : 0,
        xpAwarded: xpWrite.created ? xpWrite.amount : 0,
      },
      profile: {
        coinBalance: after.coins,
        totalXp: after.xp,
        previousLevel,
        currentLevel: levelProgress.level,
        leveledUp: levelProgress.level > previousLevel,
        levelProgress,
        rankKey: levelProgress.rankKey,
      },
    };
  });

  if (result.claimed) {
    emitAchievementClaimed(userId, {
      achievementId: result.definition.id,
      userAchievementId: result.unlock.id,
      key: result.definition.key,
      rarity: result.definition.rarity,
      coinsAwarded: result.reward.coinsAwarded,
      xpAwarded: result.reward.xpAwarded,
      coinBalance: result.profile.coinBalance,
      totalXp: result.profile.totalXp,
      previousLevel: result.profile.previousLevel,
      currentLevel: result.profile.currentLevel,
      leveledUp: result.profile.leveledUp,
      levelProgress: result.profile.levelProgress,
    });
    emitAchievementAnalytics(userId, 'achievement_claimed', result.definition, options);
    // Cascade: claimed XP/coins may unlock LEVEL_* / COINS_EARNED_* achievements.
    await evaluateAchievementsSafe(userId, options);
  }

  return {
    claimed: result.claimed,
    alreadyClaimed: result.alreadyClaimed,
    achievement: publicAchievement(result.definition, result.unlock, null),
    reward: result.reward,
    profile: result.profile,
  };
}

export { ACHIEVEMENT_DEFINITIONS, ensureAchievementDefinitions };
