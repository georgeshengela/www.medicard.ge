// MEDIQUEST store: GET /api/rewards (catalog), /api/rewards/redemptions, /api/rewards/:id and the prize renders
// (server/public/rewards/*.webp, served here because the real imageUrl points at medicard.ge).
// Shapes: server/src/lib/rewards.js publicReward / catalog, rewardDefs.js SHOP_PRIZES + REWARD_CATALOG.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { addDays, isoAt } from '../lib.mjs';

const REPO = 'C:/Users/User/Desktop/www.medicard';
const PORT = Number(process.argv[2] || process.env.PORT || 4499);
let DEFS = { REWARD_CATALOG: [] };
try {
  DEFS = await import(pathToFileURL(`${REPO}/server/src/lib/rewardDefs.js`).href);
} catch (error) {
  console.warn('[store] rewardDefs import failed', error?.message);
}
const uuidFrom = (seed) => {
  const h = createHash('sha1').update(String(seed)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const STOCK_LEFT = { SHOP_GIFTCARD_50: 7, SHOP_BUDS: 4, SHOP_SCALE: 3, SHOP_POWERBANK: 5, SHOP_GIFTCARD_100: 4, SHOP_REDMIWATCH: 2, SHOP_BAND: 3, SHOP_GIFTCARD_200: 2, SHOP_AIRPODS: 2, SHOP_AIRPODSPRO: 1, SHOP_WATCH: 1 };

function balanceOf(rq) {
  return rq.state.medirun?.balance ?? rq.state.engage?.quest?.coins ?? 1240;
}
function publicReward(row, rq) {
  const balance = balanceOf(rq);
  const finite = row.inventoryMode === 'FINITE';
  const remaining = finite ? STOCK_LEFT[row.key] ?? row.inventoryQuantity : null;
  const img = /^\/rewards\/[a-z0-9-]+\.webp$/.test(row.imageKey || '') ? `https://medicard.ge${row.imageKey}` : null; // intercepted by snap.mjs, never fetched
  const can = balance >= row.coinCost;
  return {
    id: uuidFrom(`reward:${row.key}`),
    key: row.key,
    type: row.type,
    titleKey: row.titleKey,
    descriptionKey: row.descriptionKey,
    termsKey: row.termsKey || null,
    imageKey: row.imageKey || null,
    imageUrl: img,
    coinCost: row.coinCost,
    availability: row.status,
    inventoryState: finite ? (remaining > 0 ? (remaining <= 2 ? 'LOW_STOCK' : 'AVAILABLE') : 'OUT_OF_STOCK') : 'AVAILABLE',
    inventoryRemaining: remaining,
    featured: Boolean(row.featured),
    partnerDisplay: null,
    campaignKey: null,
    commercialValueMinor: null,
    commercialCurrency: null,
    validUntil: null,
    redemptionExpiryDays: row.redemptionExpiryDays ?? null,
    entitlementKey: row.entitlementKey || null,
    entitlementDurationDays: row.entitlementDurationDays ?? null,
    userEligibility: can ? { canRedeem: true, reasonCode: null } : { canRedeem: false, reasonCode: 'REWARD_INSUFFICIENT_COINS' },
    userRedemptionCount: 0,
    userBalance: balance,
  };
}
function items(rq) {
  return (DEFS.REWARD_CATALOG || []).filter((r) => r.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder).map((r) => publicReward(r, rq));
}
const files = new Map();

export const routes = [
  {
    method: 'GET',
    path: '/rewards/:file',
    handler: (rq) => {
      const f = rq.params.file;
      if (!/^[a-z0-9-]+\.webp$/.test(f)) return rq.reply(404, { error: 'not found' });
      try {
        if (!files.has(f)) files.set(f, readFileSync(`${REPO}/server/public/rewards/${f}`));
      } catch {
        return rq.reply(404, { error: 'not found' });
      }
      return rq.reply(200, files.get(f), { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600' });
    },
  },
  {
    method: 'GET',
    path: '/api/rewards',
    handler: (rq) => {
      const all = items(rq);
      return { balance: { coins: balanceOf(rq) }, featured: all.filter((i) => i.featured), available: all };
    },
  },
  { method: 'GET', path: '/api/rewards/redemptions', handler: () => ({ active: [], used: [], expired: [], items: [] }) },
  {
    method: 'GET',
    path: '/api/rewards/:id',
    handler: (rq) => items(rq).find((i) => i.id === rq.params.id) || rq.reply(404, { error: 'საჩუქარი ვერ მოიძებნა.' }),
  },
  // MEDIQUEST wallet (GET /api/quests/rewards — server quest.js rewardsSummary): earned 1 540, spent 300, balance 1 240.
  {
    method: 'GET',
    path: '/api/quests/rewards',
    handler: (rq) => {
      const t = rq.today;
      const at = (d, hhmm) => {
        const iso = isoAt(addDays(t, d), hhmm);
        return Date.parse(iso) < Date.now() ? iso : new Date(Date.now() - 20 * 60000).toISOString();
      };
      const rows = [
        [0, '09:12', 10, 'QUEST', 'EARN'], [0, '08:41', 50, 'MEDIRUN', 'EARN'], [-1, '21:40', 150, 'QUEST', 'EARN'], [-1, '19:05', 30, 'QUEST', 'EARN'],
        [-1, '09:30', 10, 'QUEST', 'EARN'], [-2, '20:12', 20, 'QUEST', 'EARN'], [-2, '18:44', 30, 'QUEST', 'EARN'], [-3, '12:20', -300, 'REWARD_REDEMPTION', 'SPEND'],
        [-3, '09:02', 10, 'QUEST', 'EARN'], [-4, '19:30', 100, 'REFERRAL', 'EARN'], [-5, '20:05', 30, 'QUEST', 'EARN'], [-6, '18:15', 120, 'ACHIEVEMENT', 'EARN'],
      ];
      let id = 0;
      const transactions = rows.map(([d, hhmm, amount, sourceType, transactionType]) => ({ id: `tx-${t}-${id++}`, currency: 'COIN', amount, transactionType, sourceType, sourceId: `${sourceType.toLowerCase()}:${id}`, createdAt: at(d, hhmm) }));
      const coins = balanceOf(rq);
      return { balance: { coins, xp: rq.state.engage?.quest?.totalXp ?? 920 }, totalEarned: { coins: coins + 300, xp: rq.state.engage?.quest?.totalXp ?? 920 }, totalSpent: { coins: -300, xp: 0 }, transactions };
    },
  },
  { method: 'POST', path: '/api/push/events/product', handler: () => ({ ok: true }) },
];
