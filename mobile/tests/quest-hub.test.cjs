const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: name => { if (name in mocks) return mocks[name]; if (name.startsWith('.')) return require(path.resolve(root, path.dirname(file), name)); throw new Error('Unmocked: ' + name); }, Date, Set, Map, JSON, Promise, console });
  return exports;
}
const presentation = load('src/lib/quest/hubPresentation.ts', { '@/lib/companion/cosmeticVisuals': load('src/lib/companion/cosmeticVisuals.ts') });
test('claim response immediately updates balance, level and reward status without losing weekly progress', () => {
  const dashboard = { profile: { level: 1, coinBalance: 0, totalXp: 0, timezone: 'Europe/Brussels' }, daily: { quests: [{ id: 'one', status: 'COMPLETED', claimable: true }] }, weekly: { quests: [{ id: 'week', status: 'ACTIVE', progress: 1500 }] }, summary: { dailyCompleted: 1, dailyTotal: 1, unclaimedRewards: 1, dailyClaimable: 1 } };
  const result = { quest: { id: 'one', status: 'CLAIMED', claimedAt: 'now', completedAt: 'before' }, profile: { currentLevel: 2, coinBalance: 30, totalXp: 50, levelProgress: { progressPercent: 10 }, currentStreak: 1, longestStreak: 1 } };
  const next = presentation.applyClaimToDashboard(dashboard, result);
  assert.equal(next.daily.quests[0].claimable, false); assert.equal(next.profile.coinBalance, 30); assert.equal(next.profile.level, 2); assert.equal(next.profile.timezone, 'Europe/Brussels');
  assert.equal(next.weekly.quests[0].progress, 1500); assert.equal(next.summary.unclaimedRewards, 0); assert.equal(dashboard.profile.coinBalance, 0);
  const repeated = presentation.applyClaimToDashboard(next, result); assert.equal(repeated.profile.coinBalance, 30); assert.equal(repeated.summary.dailyClaimable, 0);
});
test('ready missions precede active and claimed missions without mutating source order', () => {
  const rows = [{ id: 'done', status: 'CLAIMED' }, { id: 'active', status: 'ACTIVE' }, { id: 'reward', status: 'COMPLETED', claimable: true }];
  assert.equal(presentation.orderedMissions(rows).map(q => q.id).join(','), 'reward,active,done'); assert.equal(rows[0].id, 'done');
});
test('journey progress uses current milestone interval and handles first and final milestones', () => {
  const milestones = [{ key: 'a', at: 1, unlocked: true }, { key: 'b', at: 3, unlocked: false }];
  const mid = presentation.journeyPresentation({ units: 2, milestones, nextMilestoneKey: 'b' });
  assert.equal(mid.percent, 50); assert.equal(mid.remaining, 1);
  assert.equal(presentation.journeyPresentation({ units: 0, milestones: milestones.map(m => ({ ...m, unlocked: false })), nextMilestoneKey: 'a' }).percent, 0);
  assert.equal(presentation.journeyPresentation({ units: 3, milestones, nextMilestoneKey: null }).percent, 100);
});
test('unknown tab parameters safely open missions', () => { assert.equal(presentation.questHubTab('progress'), 'progress'); assert.equal(presentation.questHubTab(['rewards']), 'missions'); assert.equal(presentation.questHubTab('robot'), 'missions'); });

test('collection previews show upcoming items without granting ownership or duplicating owned items', () => {
  const owned = { key: 'COSMETIC_DEFAULT_ACCENT', slot: 'accent', unlocked: true };
  const overview = { collection: [owned], journey: { milestones: [{ cosmeticKey: owned.key }, { cosmeticKey: 'COSMETIC_MILESTONE_01', at: 1 }, { cosmeticKey: 'COSMETIC_MILESTONE_05', at: 12 }] } };
  const collection = presentation.questCollection(overview);
  assert.equal(collection.length, 3); assert.equal(collection[0], owned);
  assert.equal(collection[1].unlocked, false); assert.equal(collection[1].slot, 'accessory');
  assert.equal(collection[2].unlocked, false); assert.equal(collection[2].slot, 'background');
  assert.equal(overview.collection.length, 1);
});
test('companion in-memory cache never crosses accounts and ignores late writes', async () => {
  let owner = 'A'; const disk = new Map();
  const cache = load('src/lib/companion/cache.ts', { '@/lib/localAccount': { localAccountId: () => owner }, '@/lib/storage': { getPreference: async key => disk.get(key), setPreference: async (key, value) => disk.set(key, value) } });
  await cache.writeCompanionCache({ companion: { level: 7 } }, 'A'); assert.equal(cache.peekCompanionCache().companion.level, 7);
  owner = 'B'; assert.equal(cache.peekCompanionCache(), null); assert.equal(await cache.readCompanionCache(), null);
  await cache.writeCompanionCache({ companion: { level: 99 } }, 'A'); assert.equal(disk.has('medicard.companion.overview.v1.B'), false);
  owner = 'A'; assert.equal((await cache.readCompanionCache()).overview.companion.level, 7);
});
test('companion cache read finishing after account switch cannot populate the new account', async () => {
  let owner = 'A', release;
  const cache = load('src/lib/companion/cache.ts', { '@/lib/localAccount': { localAccountId: () => owner }, '@/lib/storage': { getPreference: () => new Promise(r => { release = r; }), setPreference: async () => undefined } });
  const pending = cache.readCompanionCache(); owner = 'B'; release(JSON.stringify({ overview: { companion: { level: 42 } }, savedAt: 1 }));
  assert.equal(await pending, null); assert.equal(cache.peekCompanionCache(), null);
});

test('quest cache and Medi Coin balance hint stay scoped to the signed-in account', async () => {
  let owner = 'A'; const disk = new Map();
  const cache = load('src/lib/quest/cache.ts', { '@/lib/localAccount': { localAccountId: () => owner }, '@/lib/storage': { getPreference: async key => disk.get(key), setPreference: async (key, value) => disk.set(key, value) } });
  const dashboard = { profile: { coinBalance: 50 }, daily: { quests: [] }, weekly: { quests: [] } };
  await cache.writeQuestCache(dashboard, 'A');
  cache.publishMediCoinBalance(50); assert.equal(cache.getMediCoinBalanceHint(), 50);
  owner = 'B'; assert.equal(cache.getMediCoinBalanceHint(), null); assert.equal(await cache.readQuestCache(), null);
  await cache.writeQuestCache(dashboard, 'A'); assert.equal(disk.has('medicard.quest.dashboard.v1.B'), false);
  owner = 'A'; assert.equal((await cache.readQuestCache()).dashboard.profile.coinBalance, 50);
});

test('a delayed quest cache read cannot return another account data', async () => {
  let owner = 'A', release;
  const cache = load('src/lib/quest/cache.ts', { '@/lib/localAccount': { localAccountId: () => owner }, '@/lib/storage': { getPreference: () => new Promise(r => { release = r; }), setPreference: async () => undefined } });
  const pending = cache.readQuestCache(); owner = 'B'; release(JSON.stringify({ dashboard: { profile: { coinBalance: 999 } }, savedAt: 1 }));
  assert.equal(await pending, null);
});
