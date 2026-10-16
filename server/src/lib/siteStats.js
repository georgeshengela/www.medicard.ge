// „MEDICARD ციფრებში“ on the front page (owner 2026-10-16: big, real numbers instead of product facts).
// Public, so only whole-app totals leave — never per-person rows, never anything that could single someone out.
// The people count stays out on purpose (the owner chose the bigger totals).
import { prisma } from './prisma.js';

const TTL_MS = 60 * 60 * 1000;
let cache = { at: 0, value: null, pending: null };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Raw query rows → the public shape. Exported for the test. */
export function shapeSiteStats({ steps, medicines, offers, answers, cycleLogs, coins, waterMl }) {
  return {
    steps: num(steps),
    medicines: num(medicines),
    offers: num(offers),
    mediAnswers: num(answers),
    cycleLogs: num(cycleLogs),
    coins: num(coins),
    waterLiters: Math.floor(num(waterMl) / 1000),
  };
}

async function one(sql) {
  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    return rows?.[0]?.n ?? 0;
  } catch {
    return 0; // a missing table on a fresh database must not break the page
  }
}

async function load() {
  const [steps, medicines, offers, answers, cycleLogs, coins, waterMl] = await Promise.all([
    one('SELECT COALESCE(SUM(steps), 0) AS n FROM "HealthMetricDaily"'),
    one('SELECT COUNT(*) AS n FROM "CatalogProduct" WHERE "mergedIntoId" IS NULL'),
    one('SELECT COUNT(*) AS n FROM "PharmacyOffer"'),
    one('SELECT COUNT(*) AS n FROM "AiInteraction" WHERE "errorMessage" IS NULL'),
    one('SELECT COUNT(*) AS n FROM "CycleLog"'),
    one('SELECT COALESCE(SUM(amount), 0) AS n FROM "RewardLedger" WHERE amount > 0'),
    one('SELECT COALESCE(SUM("hydrationMl"), 0) AS n FROM "HealthMetricDaily"'),
  ]);
  return shapeSiteStats({ steps, medicines, offers, answers, cycleLogs, coins, waterMl });
}

/** Totals for the site, recomputed at most once an hour. */
export async function getSiteStats() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  if (!cache.pending) {
    cache.pending = load()
      .then((value) => { cache = { at: Date.now(), value, pending: null }; return value; })
      .catch((err) => { cache.pending = null; throw err; });
  }
  return cache.value || cache.pending;
}
