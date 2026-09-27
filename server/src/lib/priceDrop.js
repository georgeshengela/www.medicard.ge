import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { sendExpoPush } from './push.js';

/**
 * Price-drop alerts (Phase 3.2, 2026-09-27).
 * When a catalog product's best price falls by at least DROP_PCT (and a meaningful amount),
 * everyone taking that medicine (an active MedicationSchedule linked by config.catalogProductId)
 * gets one push — in daytime Tbilisi hours, at most one price alert per person per day.
 * People can turn it off (HealthProfile.extraAnswers.priceDropAlerts === false).
 */
export const DROP_PCT = 0.10;
export const MIN_DROP_GEL = 0.5;
export const ALERT_HOURS = { from: 9, to: 21 }; // Tbilisi local time, [from, to)
export const STALE_AFTER_DAYS = 3;

export function isMeaningfulDrop(fromGel, toGel) {
  if (!Number.isFinite(fromGel) || !Number.isFinite(toGel) || fromGel <= 0 || toGel <= 0) return false;
  return toGel <= fromGel * (1 - DROP_PCT) && fromGel - toGel >= MIN_DROP_GEL;
}

export function tbilisiParts(now = new Date()) {
  const t = new Date(now.getTime() + 4 * 3600 * 1000); // Georgia is UTC+4 all year
  return { hour: t.getUTCHours(), day: t.toISOString().slice(0, 10) };
}

export function inAlertWindow(now = new Date()) {
  const { hour } = tbilisiParts(now);
  return hour >= ALERT_HOURS.from && hour < ALERT_HOURS.to;
}

export function dropPercent(fromGel, toGel) {
  return Math.round((1 - toGel / fromGel) * 100);
}

export function alertCopy({ medName, fromGel, toGel }) {
  const pct = dropPercent(fromGel, toGel);
  return {
    title: `${medName} გაიაფდა ${pct}%-ით`,
    body: `ახლა ${toGel.toFixed(2)} ₾ (იყო ${fromGel.toFixed(2)} ₾). ნახე, სადაა ყველაზე იაფი.`,
  };
}

/**
 * Choose what to send now: per person the single biggest pending drop, unless that person
 * already got a price alert today. Pure, for tests.
 */
export function planDispatch(pending, sentTodayUserIds, currentBestByProduct) {
  const send = [];
  const skip = [];
  const byUser = new Map();
  for (const row of pending) {
    const current = currentBestByProduct.get(row.productId);
    // The price went back up (or the product vanished): this alert is no longer true.
    if (current == null || current > row.toGel + 0.001) {
      skip.push(row.id);
      continue;
    }
    if (sentTodayUserIds.has(row.userId)) continue;
    const best = byUser.get(row.userId);
    if (!best || dropPercent(row.fromGel, row.toGel) > dropPercent(best.fromGel, best.toGel)) byUser.set(row.userId, row);
  }
  for (const row of byUser.values()) send.push(row);
  return { send, skip };
}

/** Called after a product's best price is recomputed. Records history and queues alerts. */
export async function recordPriceChange(productId, previousBest, next, db = prisma) {
  if (next.bestPriceGel == null || next.bestPriceGel === previousBest) return { queued: 0 };
  await db.$executeRaw`INSERT INTO "CatalogPriceHistory" (id, "productId", "bestPriceGel", "sourceId") VALUES (${randomUUID()}, ${productId}, ${next.bestPriceGel}, ${next.bestSourceId ?? null})`;
  if (!isMeaningfulDrop(previousBest, next.bestPriceGel)) return { queued: 0 };
  const queued = await db.$executeRaw`
    INSERT INTO "PriceDropAlert" (id, "userId", "productId", "medName", "fromGel", "toGel", "sourceId")
    SELECT gen_random_uuid()::text, m."userId", ${productId}, m."medName", ${previousBest}, ${next.bestPriceGel}, ${next.bestSourceId ?? null}
    FROM "MedicationSchedule" m
    LEFT JOIN "HealthProfile" h ON h."userId" = m."userId"
    WHERE m.active = TRUE
      AND m.config->>'catalogProductId' = ${productId}
      AND COALESCE(h."extraAnswers"->>'priceDropAlerts', 'true') <> 'false'
    ON CONFLICT ("userId", "productId", "toGel") DO NOTHING`;
  return { queued: Number(queued) || 0 };
}

let busy = false;
export async function dispatchPriceDropAlerts({ now = new Date(), db = prisma, send = sendExpoPush } = {}) {
  if (busy || !inAlertWindow(now)) return { sent: 0 };
  busy = true;
  try {
    await db.$executeRaw`UPDATE "PriceDropAlert" SET state = 'SKIPPED' WHERE state = 'PENDING' AND "createdAt" < ${new Date(now.getTime() - STALE_AFTER_DAYS * 86400000)}`;
    // Queued before the person turned alerts off or stopped the medicine: no longer wanted.
    await db.$executeRaw`UPDATE "PriceDropAlert" a SET state = 'SKIPPED' WHERE a.state = 'PENDING' AND (
        EXISTS (SELECT 1 FROM "HealthProfile" h WHERE h."userId" = a."userId" AND h."extraAnswers"->>'priceDropAlerts' = 'false')
        OR NOT EXISTS (SELECT 1 FROM "MedicationSchedule" m WHERE m."userId" = a."userId" AND m.active = TRUE AND m.config->>'catalogProductId' = a."productId"))`;
    const pending = await db.$queryRaw`SELECT id, "userId", "productId", "medName", "fromGel", "toGel" FROM "PriceDropAlert" WHERE state = 'PENDING' ORDER BY "createdAt" LIMIT 300`;
    if (!pending.length) return { sent: 0 };
    const dayStartUtc = new Date(`${tbilisiParts(now).day}T00:00:00.000+04:00`);
    const sentToday = await db.$queryRaw`SELECT DISTINCT "userId" FROM "PriceDropAlert" WHERE state = 'SENT' AND "sentAt" >= ${dayStartUtc}`;
    const products = await db.catalogProduct.findMany({ where: { id: { in: [...new Set(pending.map((p) => p.productId))] } }, select: { id: true, bestPriceGel: true } });
    const plan = planDispatch(pending, new Set(sentToday.map((r) => r.userId)), new Map(products.map((p) => [p.id, p.bestPriceGel])));
    if (plan.skip.length) await db.$executeRaw`UPDATE "PriceDropAlert" SET state = 'SKIPPED' WHERE id = ANY(${plan.skip})`;
    let sent = 0;
    for (const row of plan.send) {
      const tokens = (await db.pushToken.findMany({ where: { userId: row.userId, active: true }, select: { token: true } })).map((t) => t.token);
      if (!tokens.length) {
        await db.$executeRaw`UPDATE "PriceDropAlert" SET state = 'SKIPPED' WHERE id = ${row.id}`;
        continue;
      }
      try {
        const copy = alertCopy(row);
        await send(tokens, { ...copy, data: { type: 'price_drop', route: `/pharmacy/product/${row.productId}` } });
        await db.$executeRaw`UPDATE "PriceDropAlert" SET state = 'SENT', "sentAt" = NOW() WHERE id = ${row.id}`;
        sent += 1;
      } catch {
        await db.$executeRaw`UPDATE "PriceDropAlert" SET attempts = attempts + 1, state = CASE WHEN attempts >= 4 THEN 'FAILED' ELSE 'PENDING' END WHERE id = ${row.id}`;
      }
    }
    return { sent };
  } finally {
    busy = false;
  }
}

export function startPriceDropAlerts() {
  if (process.env.PRICE_DROP_ALERTS === 'false') return undefined;
  const timer = setInterval(() => void dispatchPriceDropAlerts().catch(() => console.warn('[price-drop] outbox unavailable')), 10 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
