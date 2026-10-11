/**
 * Admin #/quests „ანალიზი“ (MEDIQUEST) — who plays the missions and how: missions → reward → streak → coins → store.
 *
 * Built from the quest tables themselves (UserQuest, QuestCompletion, RewardLedger, UserQuestProfile, achievements,
 * the rewards store, Medi's journey). Missions are handed out automatically when the app loads the quest dashboard
 * (Home / MEDIQUEST), so „got a mission“ is close to „opened the app“; MEDIQUEST activity therefore means doing
 * something: completing a mission, collecting its reward, collecting an achievement or redeeming in the store.
 *
 * Privacy: missions are named by template only. The payload never carries step counts, water amounts, personal
 * (health-derived) targets, the companion's private name or anything from Medi conversations — per person only
 * counts, level/XP, Medi Coins and dates.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, rateSafe, tbilisiMidnight } from './adminAnalyticsRange.js';
import { activityTracker, bump, daySeries, flagState, loadPeople, loadTeamUserIds, median, missingTable, ms, personSummary, usageWindow, USAGE_PERIODS } from './adminUsageKit.js';
import { getLevelForXp } from './questLevels.js';
import { questRowReward } from './questTemplates.js';
import { JOURNEY_MILESTONES } from './mediCompanion/catalog.js';
import { listFeatureFlags } from './featureFlags.js';

export const QUEST_USAGE_LIST_MAX = 400;

const DONE = new Set(['COMPLETED', 'CLAIMED']);
/** Ledger source → page bucket. Positive rows are earnings, negative rows are spends. */
const EARN_BUCKET = { QUEST: 'quest', ACHIEVEMENT: 'achievement', MEDIRUN: 'medirun', REFERRAL: 'referral', SYSTEM: 'admin', REWARD_REFUND: 'refund' };
export const COIN_SOURCES = Object.freeze(['quest', 'achievement', 'medirun', 'referral', 'admin', 'refund', 'other']);
const REDEMPTION_STATUSES = ['PENDING', 'ISSUED', 'USED', 'EXPIRED', 'CANCELLED'];
/** Built-in store rows keep an app translation key instead of a title (same table as admin Rewards). */
const BUILTIN_TITLE_KA = {
  'reward.mediTheme7d.title': 'MEDIQUEST სტილი — 7 დღე',
  'reward.mediProfileStyle30d.title': 'პროფილის აქცენტი — 30 დღე',
  'reward.mediPremiumDay.title': '1 დღე Premium',
  'reward.mediPremium3d.title': '3 დღე Premium',
  'reward.partnerTest10.title': 'სატესტო პარტნიორის ვაუჩერი',
};
const storeTitle = (r) => {
  const t = String(r.titleKey || '');
  if (BUILTIN_TITLE_KA[t]) return BUILTIN_TITLE_KA[t];
  return t && !/^reward\.[\w.]+$/.test(t) ? t : 'ჯილდო';
};
/** Balance bands for the distribution (upper bounds, Medi Coins). */
const BALANCE_BANDS = [['b0', 0], ['b1', 99], ['b100', 499], ['b500', 999], ['b1000', 4999], ['b5000', Infinity]];
const bandOf = (n) => BALANCE_BANDS.find(([, max]) => n <= max)[0];
const LEVEL_BANDS = ['1', '2', '3', '4', '5+'];
const levelBand = (level) => (level >= 5 ? '5+' : String(level));

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadQuestUsageRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildQuestUsage(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const { inPeriod, dayKeys } = win;
  const yesterday = addDaysYmd(win.today, -1);
  const nowMs = now.getTime();

  const teamIds = new Set(raw.teamUserIds || []);
  const keep = (row) => includeTeam || !teamIds.has(row.userId);
  const allQuests = raw.quests || [];
  const quests = allQuests.filter(keep);
  const ledger = (raw.ledger || []).filter(keep);
  const redemptions = (raw.redemptions || []).filter(keep);
  const achievements = (raw.achievements || []).filter(keep);
  const journey = (raw.journey || []).filter(keep);
  const companions = (raw.companions || []).filter(keep);
  const profiles = new Map((raw.profiles || []).filter(keep).map((p) => [p.userId, p]));
  const users = new Map((raw.people || []).map((u) => [u.id, u]));
  const templates = new Map((raw.templates || []).map((t) => [t.id, t]));
  const achievementDefs = new Map((raw.achievementDefs || []).map((a) => [a.id, a]));
  const storeRows = raw.store || [];

  // ── per person ───────────────────────────────────────────────────────────
  const people = new Map();
  const person = (userId) => {
    if (!people.has(userId)) {
      people.set(userId, {
        userId, assigned: 0, completed: 0, claimed: 0, unclaimed: 0, unclaimedCoins: 0, periodCompleted: 0,
        completionDays: new Set(), templatesDone: new Set(), firstAssignedAt: 0, lastAssignedAt: 0, firstCompletedAt: 0,
        lastCompletedAt: 0, lastActiveAt: 0, lastLedgerAt: 0, xp: 0, coins: 0, earned: 0, spent: 0, bySource: {}, hasLedger: false,
        achUnlocked: 0, achClaimed: 0, redemptions: 0, pending: 0, milestones: 0,
      });
    }
    return people.get(userId);
  };
  const tracker = activityTracker();
  const act = (userId, at) => {
    if (!at) return;
    tracker.act(userId, at);
    const p = person(userId);
    p.lastActiveAt = Math.max(p.lastActiveAt, ms(at));
  };

  // ── missions per template ───────────────────────────────────────────────
  const perTemplate = new Map();
  const tpl = (templateId) => {
    if (!perTemplate.has(templateId)) {
      perTemplate.set(templateId, {
        assigned: 0, ended: 0, endedDone: 0, completed: 0, claimed: 0, running: 0, runningDone: 0, expired: 0, cancelled: 0, people: new Set(), completers: new Set(),
        period: { assigned: 0, ended: 0, endedDone: 0, completed: 0 },
      });
    }
    return perTemplate.get(templateId);
  };
  let unclaimedCoins = 0;
  let unclaimedXp = 0;
  const periodClaims = [];
  for (const q of quests) {
    const p = person(q.userId);
    const t = tpl(q.templateId);
    const done = DONE.has(q.status);
    // The success rate reads only missions whose day / week is over (a running one can still be done); cancelled never counts.
    const ended = q.status !== 'CANCELLED' && ms(q.expiresAt) <= nowMs;
    p.assigned += 1;
    p.firstAssignedAt = p.firstAssignedAt ? Math.min(p.firstAssignedAt, ms(q.assignedAt)) : ms(q.assignedAt);
    p.lastAssignedAt = Math.max(p.lastAssignedAt, ms(q.assignedAt));
    t.assigned += 1;
    t.people.add(q.userId);
    if (ended) t.ended += 1;
    if (ended && done) t.endedDone += 1;
    if (ended && !done) t.expired += 1;
    if (q.status !== 'CANCELLED' && !ended) t.running += 1;
    if (!ended && done) t.runningDone += 1;
    if (q.status === 'CANCELLED') t.cancelled += 1;
    if (inPeriod(q.assignedAt)) {
      t.period.assigned += 1;
      if (ended) t.period.ended += 1;
      if (ended && done) t.period.endedDone += 1;
      if (done) t.period.completed += 1;
    }
    if (done) {
      t.completed += 1;
      t.completers.add(q.userId);
      p.completed += 1;
      p.templatesDone.add(q.templateId);
      if (q.completedAt) {
        p.completionDays.add(createdAtToTbilisiYmd(q.completedAt));
        p.firstCompletedAt = p.firstCompletedAt ? Math.min(p.firstCompletedAt, ms(q.completedAt)) : ms(q.completedAt);
        p.lastCompletedAt = Math.max(p.lastCompletedAt, ms(q.completedAt));
        if (inPeriod(q.completedAt)) p.periodCompleted += 1;
        act(q.userId, q.completedAt);
      }
    }
    if (q.status === 'CLAIMED') {
      t.claimed += 1;
      p.claimed += 1;
      act(q.userId, q.claimedAt || q.completedAt);
      if (inPeriod(q.claimedAt || q.completedAt)) periodClaims.push(q);
    }
    if (q.status === 'COMPLETED') {
      // Done, but nobody tapped „აღება“ yet: the reward waits (it never expires).
      const reward = questRowReward({ ...q, template: templates.get(q.templateId) || {} });
      p.unclaimed += 1;
      p.unclaimedCoins += reward.rewardCoins || 0;
      unclaimedCoins += reward.rewardCoins || 0;
      unclaimedXp += reward.rewardXp || 0;
    }
  }

  // ── ledger: XP, coins by source, spends ─────────────────────────────────
  const earned = Object.fromEntries(COIN_SOURCES.map((k) => [k, 0]));
  const earnedPeople = Object.fromEntries(COIN_SOURCES.map((k) => [k, new Set()]));
  const spent = { store: 0, admin: 0, other: 0 };
  const periodCoins = Object.fromEntries(COIN_SOURCES.map((k) => [k, 0]));
  let periodSpent = 0;
  let xpTotal = 0;
  const xpPeople = new Set();
  for (const r of ledger) {
    const p = person(r.userId);
    p.hasLedger = true;
    p.lastLedgerAt = Math.max(p.lastLedgerAt, ms(r.createdAt));
    const amount = Number(r.amount) || 0;
    if (r.currency === 'XP') {
      p.xp += amount;
      xpTotal += amount;
      if (amount > 0) xpPeople.add(r.userId);
      continue;
    }
    if (r.currency !== 'COIN') continue;
    p.coins += amount;
    if (amount > 0) {
      const bucket = EARN_BUCKET[r.sourceType] || 'other';
      earned[bucket] += amount;
      earnedPeople[bucket].add(r.userId);
      bump(p.bySource, bucket, amount);
      p.earned += amount;
      if (inPeriod(r.createdAt)) periodCoins[bucket] += amount;
    } else if (amount < 0) {
      const out = -amount;
      if (r.sourceType === 'REWARD_REDEMPTION') spent.store += out;
      else if (r.sourceType === 'SYSTEM') spent.admin += out;
      else spent.other += out;
      p.spent += out;
      if (inPeriod(r.createdAt)) periodSpent += out;
    }
    if (r.sourceType === 'ACHIEVEMENT' || r.sourceType === 'REWARD_REDEMPTION') act(r.userId, r.createdAt);
  }

  // ── achievements ─────────────────────────────────────────────────────────
  const families = {};
  let achWaitingCoins = 0;
  for (const a of achievements) {
    const def = achievementDefs.get(a.achievementId) || {};
    const fam = def.family || 'OTHER';
    if (!families[fam]) families[fam] = { unlocked: 0, claimed: 0, people: new Set() };
    families[fam].unlocked += 1;
    families[fam].people.add(a.userId);
    const p = person(a.userId);
    p.achUnlocked += 1;
    if (a.status === 'CLAIMED') {
      families[fam].claimed += 1;
      p.achClaimed += 1;
      act(a.userId, a.claimedAt || a.unlockedAt);
    } else {
      achWaitingCoins += def.rewardCoins || 0;
    }
  }

  // ── store ────────────────────────────────────────────────────────────────
  const redemptionStatus = Object.fromEntries(REDEMPTION_STATUSES.map((k) => [k, 0]));
  const rewardCounts = {};
  for (const r of redemptions) {
    const p = person(r.userId);
    p.redemptions += 1;
    if (r.status === 'PENDING') p.pending += 1;
    bump(redemptionStatus, REDEMPTION_STATUSES.includes(r.status) ? r.status : 'ISSUED');
    bump(rewardCounts, r.rewardId);
    act(r.userId, r.redeemedAt);
  }
  const storeItems = storeRows
    .filter((r) => r.status === 'ACTIVE' && !r.hidden)
    .map((r) => ({
      id: r.id,
      title: storeTitle(r),
      prize: r.type === 'PHYSICAL_PRIZE',
      cost: r.coinCost,
      stock: r.inventoryMode === 'FINITE' ? Math.max(0, r.inventoryQuantity ?? 0) : null,
      redemptions: rewardCounts[r.id] || 0,
    }))
    .sort((a, b) => a.cost - b.cost);
  const cheapest = storeItems[0] || null;
  const prizes = storeItems.filter((r) => r.prize);
  const cheapestPrize = prizes[0] || null;
  // What „enough for the store“ means on the cards: the cheapest real prize, else the cheapest item.
  const target = cheapestPrize || cheapest;

  // ── journey + companion ─────────────────────────────────────────────────
  const milestoneIndex = new Map(JOURNEY_MILESTONES.map((m) => [m.key, m.index]));
  const reached = new Map();
  for (const j of journey) {
    person(j.userId).milestones += 1;
    reached.set(j.userId, Math.max(reached.get(j.userId) || 0, milestoneIndex.get(j.milestoneKey) || 0));
  }
  const chapters = [1, 2, 3, 4, 5].map((c) => ({ chapter: c, people: [...reached.values()].filter((i) => i >= (c - 1) * 5 + 1).length }));

  // ── people list + ladder ────────────────────────────────────────────────
  // A wall card per person with any MEDIQUEST footprint: a mission, a ledger row or a store redemption.
  const list = [...people.values()].filter((p) => p.assigned || p.hasLedger || p.redemptions);
  const streakOf = (userId) => {
    const prof = profiles.get(userId);
    if (!prof) return { current: 0, longest: 0 };
    const live = prof.lastActiveQuestDate && prof.lastActiveQuestDate >= yesterday;
    return { current: live ? prof.currentStreak || 0 : 0, longest: prof.longestStreak || 0 };
  };
  const levels = Object.fromEntries(LEVEL_BANDS.map((k) => [k, 0]));
  const balances = Object.fromEntries(BALANCE_BANDS.map(([k]) => [k, 0]));
  const balanceValues = [];
  const shaped = list.map((p) => {
    const lv = getLevelForXp(p.xp);
    const streak = streakOf(p.userId);
    if (p.xp > 0) bump(levels, levelBand(lv.level));
    if (p.hasLedger) {
      bump(balances, bandOf(Math.max(0, p.coins)));
      balanceValues.push(Math.max(0, p.coins));
    }
    return { p, lv, streak };
  });
  const playersAssigned = list.filter((p) => p.assigned > 0);
  const count = (fn) => shaped.filter(fn).length;
  const L = {
    assigned: playersAssigned.length,
    completed: count(({ p }) => p.completed > 0),
    claimed: count(({ p }) => p.claimed > 0),
    multiDay: count(({ p }) => p.completionDays.size >= 2),
    streak3: count(({ streak }) => streak.longest >= 3),
    redeemed: count(({ p }) => p.redemptions > 0),
    returned: tracker.users().filter((id) => tracker.days(id) >= 2).length,
    level2: count(({ lv }) => lv.level >= 2),
  };
  const ladder = ['assigned', 'completed', 'claimed', 'returned', 'streak3', 'redeemed']
    .map((key) => ({ key, count: L[key], rate: rateSafe(L[key], L.assigned) }));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));
  const completedRows = quests.filter((q) => DONE.has(q.status));
  const isEnded = (q) => q.status !== 'CANCELLED' && ms(q.expiresAt) <= nowMs;
  const endedRows = quests.filter(isEnded);
  const endedDone = endedRows.filter((q) => DONE.has(q.status));
  const wallet = shaped.filter(({ p }) => p.hasLedger);
  const holders = wallet.filter(({ p }) => p.coins > 0);
  const maxBalance = balanceValues.length ? Math.max(...balanceValues) : 0;

  // ── first completion after sign-up ──────────────────────────────────────
  const timing = { sameDay: 0, week: 0, later: 0 };
  const hoursToFirst = [];
  for (const p of list) {
    const u = users.get(p.userId);
    if (!u?.createdAt || !p.firstCompletedAt) continue;
    const hours = Math.max(0, (p.firstCompletedAt - ms(u.createdAt)) / 3_600_000);
    hoursToFirst.push(hours);
    if (hours < 24) timing.sameDay += 1;
    else if (hours < 24 * 7) timing.week += 1;
    else timing.later += 1;
  }

  // ── period ───────────────────────────────────────────────────────────────
  const periodCompleted = completedRows.filter((q) => inPeriod(q.completedAt));
  const periodAssigned = quests.filter((q) => inPeriod(q.assignedAt));
  const periodEnded = periodAssigned.filter(isEnded);
  const periodDone = periodEnded.filter((q) => DONE.has(q.status));
  const signups = (raw.signups || []).filter((u) => (includeTeam || !teamIds.has(u.id)) && inPeriod(u.createdAt));
  const signupsCompleted = signups.filter((u) => (people.get(u.id)?.completed || 0) > 0);
  const periodRedemptions = redemptions.filter((r) => inPeriod(r.redeemedAt));

  // ── items ────────────────────────────────────────────────────────────────
  const items = shaped
    .map(({ p, lv, streak }) => ({
      id: p.userId,
      person: personSummary(users.get(p.userId) || { id: p.userId }, { teamIds }),
      level: lv.level,
      xp: p.xp,
      levelPct: lv.progressPercent,
      coins: {
        balance: p.coins,
        earned: p.earned,
        spent: p.spent,
        quest: p.bySource.quest || 0,
        achievement: p.bySource.achievement || 0,
        medirun: p.bySource.medirun || 0,
        other: (p.bySource.referral || 0) + (p.bySource.admin || 0) + (p.bySource.refund || 0) + (p.bySource.other || 0),
      },
      missions: {
        assigned: p.assigned,
        completed: p.completed,
        claimed: p.claimed,
        unclaimed: p.unclaimed,
        unclaimedCoins: p.unclaimedCoins,
        period: p.periodCompleted,
        days: p.completionDays.size,
        kinds: p.templatesDone.size,
      },
      streak,
      achievements: { unlocked: p.achUnlocked, claimed: p.achClaimed },
      store: { redemptions: p.redemptions, pending: p.pending },
      milestones: p.milestones,
      activeDays: tracker.days(p.userId),
      firstAt: p.firstAssignedAt ? new Date(p.firstAssignedAt).toISOString() : null,
      lastCompletedAt: p.lastCompletedAt ? new Date(p.lastCompletedAt).toISOString() : null,
      lastActiveAt: p.lastActiveAt ? new Date(p.lastActiveAt).toISOString() : null,
      sortAt: p.lastActiveAt || 0,
      // People with no MEDIQUEST activity follow, by their last mission or wallet movement (e.g. MEDIRUN coins).
      sortIdle: Math.max(p.lastAssignedAt, p.lastLedgerAt),
    }))
    .sort((a, b) => b.sortAt - a.sortAt || b.sortIdle - a.sortIdle)
    .map(({ sortAt, sortIdle, ...item }) => item);

  // ── missions (per template) ─────────────────────────────────────────────
  const missions = [...perTemplate.entries()]
    .map(([id, t]) => {
      const def = templates.get(id) || {};
      return {
        key: def.key || null,
        cadence: def.cadence || null,
        category: def.category || null,
        active: def.isActive !== false,
        retired: def.config?.retired === true,
        rewardCoins: def.rewardCoins ?? 0,
        rewardXp: def.rewardXp ?? 0,
        assigned: t.assigned,
        ended: t.ended,
        endedDone: t.endedDone,
        completed: t.completed,
        claimed: t.claimed,
        running: t.running,
        runningDone: t.runningDone,
        expired: t.expired,
        cancelled: t.cancelled,
        rate: rateSafe(t.endedDone, t.ended),
        people: t.people.size,
        completers: t.completers.size,
        period: { ...t.period, rate: rateSafe(t.period.endedDone, t.period.ended) },
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || (a.cadence || '').localeCompare(b.cadence || '') || b.assigned - a.assigned);
  // Templates nobody was given yet still show (so a switched-on mission without players is visible).
  for (const def of templates.values()) {
    if (perTemplate.has(def.id) || def.isActive === false) continue;
    missions.push({
      key: def.key, cadence: def.cadence, category: def.category, active: true, retired: false, rewardCoins: def.rewardCoins ?? 0,
      rewardXp: def.rewardXp ?? 0, assigned: 0, ended: 0, endedDone: 0, completed: 0, claimed: 0, running: 0, runningDone: 0, expired: 0, cancelled: 0,
      rate: null, people: 0, completers: 0, period: { assigned: 0, ended: 0, endedDone: 0, completed: 0, rate: null },
    });
  }

  const earnedTotal = COIN_SOURCES.reduce((s, k) => s + earned[k], 0);
  const spentTotal = spent.store + spent.admin + spent.other;
  const teamQuests = allQuests.filter((q) => teamIds.has(q.userId));

  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: {
      accounts: teamIds.size,
      players: new Set(teamQuests.map((q) => q.userId)).size,
      missions: teamQuests.length,
      completed: teamQuests.filter((q) => DONE.has(q.status)).length,
    },
    flags: { quest: flagState(raw.flags, 'quest'), rewardsStore: flagState(raw.flags, 'rewardsStore') },
    totals: {
      accounts,
      players: L.assigned,
      playerRate: rateSafe(L.assigned, accounts),
      completers: L.completed,
      completerRate: rateSafe(L.completed, L.assigned),
      claimers: L.claimed,
      returned: L.returned,
      multiDay: L.multiDay,
      level2: L.level2,
      assigned: quests.length,
      ended: endedRows.length,
      endedDone: endedDone.length,
      completed: completedRows.length,
      completionRate: rateSafe(endedDone.length, endedRows.length),
      claimed: quests.filter((q) => q.status === 'CLAIMED').length,
      unclaimed: quests.filter((q) => q.status === 'COMPLETED').length,
      unclaimedPeople: list.filter((p) => p.unclaimed > 0).length,
      unclaimedCoins,
      unclaimedXp,
      onlyAssigned: playersAssigned.filter((p) => p.completed === 0).length,
      walletPeople: wallet.length,
      coinHolders: holders.length,
      balance: wallet.reduce((s, { p }) => s + p.coins, 0),
      maxBalance,
      redemptions: redemptions.length,
      redeemers: L.redeemed,
    },
    ladder,
    firstCompletion: { ...timing, medianHours: median(hoursToFirst) },
    missions,
    coins: {
      earned,
      earnedPeople: Object.fromEntries(COIN_SOURCES.map((k) => [k, earnedPeople[k].size])),
      earnedTotal,
      spent,
      spentTotal,
      balance: wallet.reduce((s, { p }) => s + p.coins, 0),
      holders: holders.length,
      walletPeople: wallet.length,
      medianBalance: median(balanceValues),
      maxBalance,
      bands: balances,
      waiting: { missions: unclaimedCoins, achievements: achWaitingCoins },
      xp: { total: xpTotal, people: xpPeople.size },
    },
    progress: {
      levels,
      maxLevel: shaped.reduce((m, { lv, p }) => (p.xp > 0 ? Math.max(m, lv.level) : m), 0),
      streaks: {
        live: count(({ streak }) => streak.current >= 1),
        live3: count(({ streak }) => streak.current >= 3),
        longest3: L.streak3,
        longest7: count(({ streak }) => streak.longest >= 7),
        maxLongest: shaped.reduce((m, { streak }) => Math.max(m, streak.longest), 0),
      },
      achievements: {
        unlocked: achievements.length,
        claimed: achievements.filter((a) => a.status === 'CLAIMED').length,
        waiting: achievements.filter((a) => a.status !== 'CLAIMED').length,
        people: new Set(achievements.map((a) => a.userId)).size,
        waitingCoins: achWaitingCoins,
        families: Object.entries(families)
          .map(([family, f]) => ({ family, unlocked: f.unlocked, claimed: f.claimed, people: f.people.size }))
          .sort((a, b) => b.unlocked - a.unlocked),
      },
    },
    store: {
      items: storeItems,
      activeItems: storeItems.length,
      cheapest: cheapest ? { title: cheapest.title, cost: cheapest.cost } : null,
      cheapestPrize: cheapestPrize ? { title: cheapestPrize.title, cost: cheapestPrize.cost } : null,
      target: target ? { title: target.title, cost: target.cost, prize: target.prize } : null,
      canAffordCheapest: cheapest ? holders.filter(({ p }) => p.coins >= cheapest.cost).length : 0,
      canAffordPrize: cheapestPrize ? holders.filter(({ p }) => p.coins >= cheapestPrize.cost).length : 0,
      redemptions: redemptionStatus,
      redeemers: L.redeemed,
      coinsSpent: spent.store,
    },
    journey: {
      people: reached.size,
      unlocks: journey.length,
      chapters,
      companions: companions.length,
      customized: companions.filter((c) => c.customized).length,
      named: companions.filter((c) => c.named).length,
    },
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      activePlayers: tracker.activeIn(win.from, win.to),
      newCompleters: list.filter((p) => p.firstCompletedAt && inPeriod(p.firstCompletedAt)).length,
      newPlayers: list.filter((p) => p.firstAssignedAt && inPeriod(p.firstAssignedAt)).length,
      assigned: periodAssigned.length,
      completed: periodCompleted.length,
      completionRate: rateSafe(periodDone.length, periodEnded.length),
      claimed: periodClaims.length,
      coinsEarned: COIN_SOURCES.reduce((s, k) => s + periodCoins[k], 0),
      coinsBySource: periodCoins,
      coinsSpent: periodSpent,
      redemptions: periodRedemptions.length,
      signups: signups.length,
      signupsCompleted: signupsCompleted.length,
      signupRate: rateSafe(signupsCompleted.length, signups.length),
      trend: {
        completed: daySeries(dayKeys, periodCompleted, (q) => q.completedAt),
        active: tracker.activeByDay(dayKeys),
        claimed: daySeries(dayKeys, periodClaims, (q) => q.claimedAt || q.completedAt),
      },
    },
    items: items.slice(0, QUEST_USAGE_LIST_MAX),
    itemsTotal: items.length,
  };
}

/** Every row the page needs, for all accounts (the builder drops team accounts). Read-only. */
export async function loadQuestUsageRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(usageWindow(Math.max(...USAGE_PERIODS), now).from);
  const [teamUserIds, accountsTotal, templates, quests, ledger, profiles, achievementDefs, achievements, store, redemptions, journey, companions, signups, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    db.questTemplate.findMany({ select: { id: true, key: true, cadence: true, category: true, rewardCoins: true, rewardXp: true, isActive: true, config: true } }),
    // Never the progress / target columns (step counts, water %, health-derived personal targets).
    db.userQuest.findMany({ select: { userId: true, templateId: true, status: true, assignedAt: true, completedAt: true, claimedAt: true, expiresAt: true, metadata: true } }),
    db.rewardLedger.findMany({ select: { userId: true, currency: true, amount: true, sourceType: true, createdAt: true } }),
    db.userQuestProfile.findMany({ select: { userId: true, currentStreak: true, longestStreak: true, lastActiveQuestDate: true } }),
    db.achievementDefinition.findMany({ select: { id: true, family: true, rewardCoins: true } }),
    db.userAchievement.findMany({ select: { userId: true, achievementId: true, status: true, unlockedAt: true, claimedAt: true } }),
    db.rewardDefinition.findMany({ select: { id: true, key: true, type: true, status: true, titleKey: true, coinCost: true, inventoryMode: true, inventoryQuantity: true, metadata: true } }),
    db.rewardRedemption.findMany({ select: { userId: true, rewardId: true, status: true, coinCost: true, redeemedAt: true } }),
    db.mediJourneyUnlock.findMany({ select: { userId: true, milestoneKey: true, unlockedAt: true } }),
    db.mediCompanionProfile.findMany({ select: { userId: true, selectedCosmetics: true, displayName: true } }),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  const ids = new Set([...quests.map((q) => q.userId), ...ledger.map((r) => r.userId), ...redemptions.map((r) => r.userId)]);
  const { people } = await loadPeople([...ids], db);
  return {
    teamUserIds,
    accountsTotal,
    templates,
    // Only the frozen reward (xp / coins) survives from the row metadata — never the smart-target baseline.
    quests: quests.map(({ metadata, ...q }) => ({ ...q, metadata: metadata?.reward ? { reward: metadata.reward } : {} })),
    ledger,
    profiles,
    achievementDefs,
    achievements,
    store: store.map(({ metadata, ...r }) => ({ ...r, hidden: Boolean(metadata?.neverShowInProduction) })),
    redemptions,
    journey,
    // The companion's private name never leaves the server: only whether one was set or the look changed.
    companions: companions.map((c) => {
      const s = c.selectedCosmetics || {};
      return {
        userId: c.userId,
        named: Boolean(String(c.displayName || '').trim()),
        customized: (s.accent && s.accent !== 'COSMETIC_DEFAULT_ACCENT') || Boolean(s.accessory) || Boolean(s.decoration)
          || (s.background && s.background !== 'COSMETIC_DEFAULT_BACKGROUND'),
      };
    }),
    signups,
    people,
    flags,
  };
}

export async function loadQuestUsage({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadQuestUsageRaw(db, { now });
    return buildQuestUsage(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
