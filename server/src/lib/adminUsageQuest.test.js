import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestUsage, loadQuestUsageRaw } from './adminUsageQuest.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi
const at = (s) => new Date(s);
// Tbilisi day ends 20:00 UTC; an ISO week ends Sunday 20:00 UTC.
const dayEnd = (ymd) => at(`${ymd}T19:59:59.999Z`);

const T = {
  steps: { id: 't-steps', key: 'daily_steps', cadence: 'DAILY', category: 'MOVEMENT', rewardCoins: 30, rewardXp: 50, isActive: true, config: {} },
  water: { id: 't-water', key: 'daily_hydration', cadence: 'DAILY', category: 'HYDRATION', rewardCoins: 20, rewardXp: 35, isActive: true, config: {} },
  week: { id: 't-week', key: 'weekly_steps', cadence: 'WEEKLY', category: 'MOVEMENT', rewardCoins: 150, rewardXp: 200, isActive: true, config: {} },
  medi: { id: 't-medi', key: 'weekly_medi', cadence: 'WEEKLY', category: 'MEDI', rewardCoins: 0, rewardXp: 20, isActive: true, config: {} },
};

const quest = (userId, tpl, ymd, status, extra = {}) => ({
  userId,
  templateId: T[tpl].id,
  status,
  assignedAt: at(`${ymd}T05:00:00Z`),
  completedAt: status === 'COMPLETED' || status === 'CLAIMED' ? at(`${ymd}T15:00:00Z`) : null,
  claimedAt: status === 'CLAIMED' ? at(`${ymd}T15:05:00Z`) : null,
  expiresAt: tpl === 'week' || tpl === 'medi' ? at('2026-10-11T19:59:59.999Z') : dayEnd(ymd),
  metadata: status === 'COMPLETED' || status === 'CLAIMED' ? { reward: { xp: T[tpl].rewardXp, coins: T[tpl].rewardCoins } } : {},
  ...extra,
});

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 11,
    templates: Object.values(T),
    quests: [
      // team demo: plays a lot
      quest('team', 'steps', '2026-10-09', 'CLAIMED'),
      quest('team', 'water', '2026-10-09', 'CLAIMED'),
      // u1: completes on two days, claims both steps, leaves water unclaimed, keeps a streak
      quest('u1', 'steps', '2026-10-09', 'CLAIMED'),
      quest('u1', 'water', '2026-10-09', 'EXPIRED'),
      quest('u1', 'steps', '2026-10-10', 'CLAIMED'),
      quest('u1', 'water', '2026-10-10', 'COMPLETED'),
      quest('u1', 'steps', '2026-10-11', 'ACTIVE'),
      quest('u1', 'week', '2026-10-06', 'ACTIVE'),
      // u2: gets missions, never completes (one stale ACTIVE row from a past day counts as missed)
      quest('u2', 'steps', '2026-10-10', 'EXPIRED'),
      quest('u2', 'water', '2026-10-10', 'ACTIVE'),
      quest('u2', 'medi', '2026-10-06', 'CANCELLED'),
      // u3: an old completion outside the 7-day window, reward collected
      quest('u3', 'steps', '2026-09-20', 'CLAIMED'),
    ],
    ledger: [
      { userId: 'team', currency: 'XP', amount: 85, sourceType: 'QUEST', createdAt: at('2026-10-09T15:05:00Z') },
      { userId: 'team', currency: 'COIN', amount: 50, sourceType: 'QUEST', createdAt: at('2026-10-09T15:05:00Z') },
      { userId: 'team', currency: 'COIN', amount: 900, sourceType: 'SYSTEM', createdAt: at('2026-10-01T08:00:00Z') },
      { userId: 'u1', currency: 'XP', amount: 50, sourceType: 'QUEST', createdAt: at('2026-10-09T15:05:00Z') },
      { userId: 'u1', currency: 'COIN', amount: 30, sourceType: 'QUEST', createdAt: at('2026-10-09T15:05:00Z') },
      { userId: 'u1', currency: 'XP', amount: 50, sourceType: 'QUEST', createdAt: at('2026-10-10T15:05:00Z') },
      { userId: 'u1', currency: 'COIN', amount: 30, sourceType: 'QUEST', createdAt: at('2026-10-10T15:05:00Z') },
      { userId: 'u1', currency: 'XP', amount: 120, sourceType: 'ACHIEVEMENT', createdAt: at('2026-10-10T16:00:00Z') },
      { userId: 'u1', currency: 'COIN', amount: 10, sourceType: 'ACHIEVEMENT', createdAt: at('2026-10-10T16:00:00Z') },
      { userId: 'u1', currency: 'COIN', amount: 250, sourceType: 'MEDIRUN', createdAt: at('2026-10-08T08:00:00Z') },
      { userId: 'u1', currency: 'COIN', amount: -300, sourceType: 'REWARD_REDEMPTION', createdAt: at('2026-10-10T18:00:00Z') },
      { userId: 'u3', currency: 'XP', amount: 50, sourceType: 'QUEST', createdAt: at('2026-09-20T15:05:00Z') },
      { userId: 'u3', currency: 'COIN', amount: 30, sourceType: 'QUEST', createdAt: at('2026-09-20T15:05:00Z') },
      // u4: only MEDIRUN coins, never got a mission
      { userId: 'u4', currency: 'COIN', amount: 100, sourceType: 'MEDIRUN', createdAt: at('2026-10-07T08:00:00Z') },
    ],
    profiles: [
      { userId: 'team', currentStreak: 9, longestStreak: 15, lastActiveQuestDate: '2026-10-11' },
      { userId: 'u1', currentStreak: 3, longestStreak: 3, lastActiveQuestDate: '2026-10-10' },
      { userId: 'u3', currentStreak: 4, longestStreak: 4, lastActiveQuestDate: '2026-09-20' },
    ],
    achievementDefs: [
      { id: 'a-first', family: 'FIRST', rewardCoins: 10 },
      { id: 'a-streak', family: 'STREAK', rewardCoins: 20 },
    ],
    achievements: [
      { userId: 'u1', achievementId: 'a-first', status: 'CLAIMED', unlockedAt: at('2026-10-09T15:00:00Z'), claimedAt: at('2026-10-10T16:00:00Z') },
      { userId: 'u1', achievementId: 'a-streak', status: 'UNLOCKED', unlockedAt: at('2026-10-10T15:00:00Z'), claimedAt: null },
      { userId: 'team', achievementId: 'a-first', status: 'UNLOCKED', unlockedAt: at('2026-10-09T15:00:00Z'), claimedAt: null },
    ],
    store: [
      { id: 'r-style', key: 'MEDI_THEME_7D', type: 'DIGITAL_PERK', status: 'ACTIVE', titleKey: 'reward.mediTheme7d.title', coinCost: 300, inventoryMode: 'UNLIMITED', inventoryQuantity: null, hidden: false },
      { id: 'r-card', key: 'SHOP_GIFTCARD_50', type: 'PHYSICAL_PRIZE', status: 'ACTIVE', titleKey: 'Zoommer-ის სასაჩუქრე ბარათი 50₾', coinCost: 5000, inventoryMode: 'FINITE', inventoryQuantity: 10, hidden: false },
      { id: 'r-test', key: 'PARTNER_TEST_10', type: 'PARTNER_VOUCHER', status: 'ACTIVE', titleKey: 'reward.partnerTest10.title', coinCost: 100, inventoryMode: 'CODE_POOL', inventoryQuantity: null, hidden: true },
      { id: 'r-old', key: 'MEDI_PREMIUM_DAY', type: 'PREMIUM_ACCESS', status: 'ARCHIVED', titleKey: 'reward.mediPremiumDay.title', coinCost: 900, inventoryMode: 'UNLIMITED', inventoryQuantity: null, hidden: false },
    ],
    redemptions: [{ userId: 'u1', rewardId: 'r-style', status: 'ISSUED', coinCost: 300, redeemedAt: at('2026-10-10T18:00:00Z') }],
    journey: [
      { userId: 'u1', milestoneKey: 'MILESTONE_01', unlockedAt: at('2026-10-09T15:00:00Z') },
      { userId: 'u1', milestoneKey: 'MILESTONE_02', unlockedAt: at('2026-10-10T15:00:00Z') },
      { userId: 'team', milestoneKey: 'MILESTONE_06', unlockedAt: at('2026-10-09T15:00:00Z') },
    ],
    companions: [{ userId: 'team', named: true, customized: true }, { userId: 'u1', named: false, customized: false }],
    signups: [
      { id: 'u1', createdAt: at('2026-10-08T08:00:00Z') },
      { id: 'u2', createdAt: at('2026-10-09T08:00:00Z') },
      { id: 'team', createdAt: at('2026-10-09T08:00:00Z') },
    ],
    people: [
      { id: 'team', fullName: 'Demo', email: 'demo@medicard.ge', phone: null, createdAt: at('2026-03-24T08:00:00Z'), lastSeenAt: at('2026-10-11T08:00:00Z') },
      { id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null, createdAt: at('2026-10-08T08:00:00Z'), lastSeenAt: at('2026-10-11T07:00:00Z') },
      { id: 'u2', fullName: 'Giorgi', email: 'x@apple.medicard.ge', phone: null, createdAt: at('2026-10-09T08:00:00Z'), lastSeenAt: null },
      { id: 'u3', fullName: 'Ana', email: 'ana@example.com', phone: null, createdAt: at('2026-09-19T08:00:00Z'), lastSeenAt: at('2026-09-21T08:00:00Z') },
      { id: 'u4', fullName: 'Luka', email: 'luka@example.com', phone: null, createdAt: at('2026-10-07T07:00:00Z'), lastSeenAt: at('2026-10-07T09:00:00Z') },
    ],
    flags: [{ key: 'quest', enabled: true, effective: true }, { key: 'rewardsStore', enabled: false, effective: false }],
  };
}

test('team accounts are left out by default: totals, ladder, list, coins', () => {
  const d = buildQuestUsage(fixture(), { days: 30, now: NOW });
  assert.equal(d.totals.accounts, 10);
  assert.deepEqual(d.team, { accounts: 1, players: 1, missions: 2, completed: 2 });
  assert.equal(d.items.some((i) => i.person.team), false);
  assert.equal(d.itemsTotal, 4); // u1, u2, u3 (missions) + u4 (MEDIRUN coins only)
  assert.equal(d.totals.players, 3);
  assert.equal(d.totals.completers, 2);
  assert.equal(d.totals.unclaimed, 1);
  assert.equal(d.totals.unclaimedCoins, 20);
  assert.equal(d.totals.onlyAssigned, 1);
  assert.equal(d.coins.earned.quest, 90);
  assert.equal(d.coins.earned.medirun, 350);
  assert.equal(d.coins.earned.admin, 0); // the team's admin grant is not counted
  assert.equal(d.coins.spent.store, 300);
  assert.equal(d.coins.balance, 30 + 30 + 10 + 250 - 300 + 30 + 100);
  assert.equal(d.flags.rewardsStore.effective, false);
});

test('ladder: got a mission → completed → collected → came back → 3-day streak → store', () => {
  const d = buildQuestUsage(fixture(), { days: 30, now: NOW });
  const ladder = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
  // u1 active on 9 and 10 Oct (completions, claims, achievement, redemption); u3 only on 20 Sep.
  assert.deepEqual(ladder, { assigned: 3, completed: 2, claimed: 2, returned: 1, streak3: 2, redeemed: 1 });
  assert.equal(d.ladder[1].rate, 66.7);
});

test('including the team brings its missions, coins and journey back', () => {
  const d = buildQuestUsage(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(d.totals.accounts, 11);
  assert.equal(d.totals.players, 4);
  assert.equal(d.coins.earned.admin, 900);
  assert.equal(d.journey.people, 2);
  assert.equal(d.journey.chapters.find((c) => c.chapter === 2).people, 1);
  assert.equal(d.journey.named, 1);
  assert.equal(d.items.find((i) => i.id === 'team').person.team, true);
  assert.equal(d.progress.streaks.maxLongest, 15);
});

test('one person: level, coins by source, missions, streak, store', () => {
  const d = buildQuestUsage(fixture(), { days: 30, now: NOW });
  const [first] = d.items;
  assert.equal(first.id, 'u1'); // the store redemption on 10 Oct 18:00 is the latest MEDIQUEST activity
  assert.equal(first.xp, 220);
  assert.equal(first.level, 2);
  assert.deepEqual(first.coins, { balance: 20, earned: 320, spent: 300, quest: 60, achievement: 10, medirun: 250, other: 0 });
  assert.deepEqual(first.missions, { assigned: 6, completed: 3, claimed: 2, unclaimed: 1, unclaimedCoins: 20, period: 3, days: 2, kinds: 2 });
  assert.deepEqual(first.streak, { current: 3, longest: 3 }); // last active yesterday → the streak is still alive
  assert.deepEqual(first.achievements, { unlocked: 2, claimed: 1 });
  assert.deepEqual(first.store, { redemptions: 1, pending: 0 });
  assert.equal(first.milestones, 2);
  assert.equal(first.person.contact, '+995 599 12 34 56');
  const u3 = d.items.find((i) => i.id === 'u3');
  assert.deepEqual(u3.streak, { current: 0, longest: 4 }); // last active 20 Sep → no live streak
  const u4 = d.items.find((i) => i.id === 'u4');
  assert.equal(u4.missions.assigned, 0);
  assert.equal(u4.coins.medirun, 100);
  // Idle cards follow the active ones, by their last mission or wallet movement.
  assert.deepEqual(d.items.map((i) => i.id), ['u1', 'u3', 'u2', 'u4']);
  // No progress / target values (steps, water %) ever reach a person card.
  assert.ok(d.items.every((i) => !('target' in i.missions) && !('progress' in i.missions)));
});

test('missions per template: success rate reads only finished days / weeks', () => {
  const d = buildQuestUsage(fixture(), { days: 30, now: NOW });
  const steps = d.missions.find((m) => m.key === 'daily_steps');
  // 9, 10 Oct (u1 claimed), 10 Oct (u2 expired), 20 Sep (u3) ended; 11 Oct still running.
  assert.equal(steps.assigned, 5);
  assert.equal(steps.ended, 4);
  assert.equal(steps.endedDone, 3);
  assert.equal(steps.rate, 75);
  assert.equal(steps.running, 1);
  const water = d.missions.find((m) => m.key === 'daily_hydration');
  // u2's 10 Oct row is still ACTIVE in the table but its day is over: a miss.
  assert.equal(water.ended, 3);
  assert.equal(water.expired, 2);
  assert.equal(water.rate, 33.3);
  const week = d.missions.find((m) => m.key === 'weekly_steps');
  assert.equal(week.ended, 0);
  assert.equal(week.rate, null);
  const medi = d.missions.find((m) => m.key === 'weekly_medi');
  assert.equal(medi.cancelled, 1);
  assert.equal(medi.ended, 0);
});

test('period: 7 days — completions, claims, coins, signups, daily trend', () => {
  const d = buildQuestUsage(fixture(), { days: 7, now: NOW });
  assert.equal(d.period.from, '2026-10-05');
  assert.equal(d.period.completed, 3); // u3's September completion is outside
  assert.equal(d.period.claimed, 2);
  assert.equal(d.period.activePlayers, 1);
  assert.equal(d.period.coinsEarned, 30 + 30 + 10 + 250 + 100);
  assert.equal(d.period.coinsBySource.medirun, 350);
  assert.equal(d.period.coinsSpent, 300);
  assert.equal(d.period.redemptions, 1);
  assert.equal(d.period.signups, 2);
  assert.equal(d.period.signupsCompleted, 1);
  assert.equal(d.period.signupRate, 50);
  assert.equal(d.period.trend.completed.length, 7);
  assert.equal(d.period.trend.completed.find((p) => p.day === '2026-10-10').count, 2);
  assert.equal(d.period.trend.active.find((p) => p.day === '2026-10-09').count, 1);
  assert.equal(d.store.items.length, 2); // archived and DEV-only rows stay out
  assert.equal(d.store.cheapest.cost, 300);
  assert.equal(d.store.target.cost, 5000);
  assert.equal(d.store.items[0].redemptions, 1);
  assert.equal(d.store.items[0].title, 'MEDIQUEST სტილი — 7 დღე');
  assert.equal(d.progress.achievements.waiting, 1);
  assert.equal(d.progress.achievements.waitingCoins, 20);
});

test('empty data: no crash, sensible zeros', () => {
  const d = buildQuestUsage({ teamUserIds: [], accountsTotal: 0 }, { days: 30, now: NOW });
  assert.equal(d.installed, true);
  assert.equal(d.totals.players, 0);
  assert.equal(d.totals.completionRate, null);
  assert.equal(d.ladder[0].count, 0);
  assert.equal(d.ladder[1].rate, null);
  assert.deepEqual(d.items, []);
  assert.equal(d.itemsTotal, 0);
  assert.equal(d.store.target, null);
  assert.equal(d.coins.medianBalance, null);
  assert.equal(d.period.trend.completed.length, 30);
  assert.equal(d.flags.quest.effective, true);
});

test('loader strips the smart-target baseline and the companion name', async () => {
  const rows = (list) => ({ findMany: async () => list, count: async () => 3, groupBy: async () => [] });
  const db = {
    user: { count: async () => 3, findMany: async ({ where }) => (where?.email ? [] : where?.id ? [{ id: 'u1', fullName: 'Nino', email: 'n@x.ge', phone: null, createdAt: NOW }] : []) },
    questTemplate: rows(Object.values(T)),
    userQuest: rows([{ ...quest('u1', 'steps', '2026-10-10', 'CLAIMED'), metadata: { reward: { xp: 50, coins: 30 }, smart: { baseline: 5075.5 } } }]),
    rewardLedger: rows([]),
    userQuestProfile: rows([]),
    achievementDefinition: rows([]),
    userAchievement: rows([]),
    rewardDefinition: rows([{ id: 'r', key: 'PARTNER_TEST_10', type: 'PARTNER_VOUCHER', status: 'DRAFT', titleKey: 'x', coinCost: 1500, inventoryMode: 'CODE_POOL', inventoryQuantity: null, metadata: { neverShowInProduction: true } }]),
    rewardRedemption: rows([]),
    mediJourneyUnlock: rows([]),
    mediCompanionProfile: rows([{ userId: 'u1', displayName: 'ჩემი Medi', selectedCosmetics: { accent: 'COSMETIC_MILESTONE_01' } }]),
    appActivity: { groupBy: async () => [], findMany: async () => [] },
    featureFlag: { findMany: async () => [] },
  };
  const raw = await loadQuestUsageRaw(db, { now: NOW });
  assert.deepEqual(raw.quests[0].metadata, { reward: { xp: 50, coins: 30 } });
  assert.deepEqual(raw.companions, [{ userId: 'u1', named: true, customized: true }]);
  assert.equal(raw.store[0].hidden, true);
  assert.ok(!('metadata' in raw.store[0]));
  assert.ok(!JSON.stringify(raw).includes('5075'));
  assert.ok(!JSON.stringify(raw).includes('ჩემი Medi'));
});
