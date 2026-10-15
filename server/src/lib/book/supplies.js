/**
 * MEDIBOOK stock room (საწყობი): the supplies a visit uses up — gloves, napkins, colour, anaesthetic, needles.
 * They live on the same BookProduct rows as retail products (kind SUPPLY, no price) so one stock ledger
 * (BookStockMove) explains every number. Norms (BookServiceSupply) say what one visit of a service uses; completing
 * a visit writes them off by itself (one USE move per supply, the unit cost of the day) and un-completing puts them
 * back. Deliveries (RESTOCK, optionally an expense), write-offs (WRITE_OFF) and counts (COUNT) are moves too. From
 * the last 30 days' pace the page can say how many days a supply lasts and how much to order.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, newId } from './catalog.js';
import { productPublic, createProduct, updateProduct, deactivateProduct, moveStock } from './products.js';

const sql = Prisma.sql;
const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const toIso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);

/** Days the stock lasts at the last 30 days' pace; null when nothing was used or stock is unknown. */
export function daysLeft({ stock, use30 }) {
  if (stock == null || !(use30 > 0)) return null;
  return Math.max(0, Math.floor((Math.max(0, stock) / use30) * 30));
}

/** What to order: enough for two weeks at the recent pace, never less than three low-stock marks, minus what is there. */
export function suggestOrder({ stock, lowStock, use30 }) {
  const target = Math.max((lowStock || 0) * 3, ((use30 || 0) / 30) * 14);
  const need = Math.ceil(target - (stock ?? 0));
  return need > 0 ? need : 0;
}

/** Norms as stored: productId → positive qty (two decimals), duplicates merged, everything else dropped. */
export function normalizeNorms(items) {
  const map = new Map();
  for (const i of Array.isArray(items) ? items : []) {
    const id = String(i?.productId ?? '').trim();
    const qty = n2(i?.qty);
    if (!id || !(qty > 0)) continue;
    map.set(id, n2((map.get(id) || 0) + qty));
  }
  return [...map].map(([productId, qty]) => ({ productId, qty }));
}

export function supplyPublic(r) {
  const p = productPublic(r);
  const use30 = n2(r.use30 ?? 0);
  return {
    ...p, kind: 'SUPPLY', use30, use30Cost: n2(r.use30Cost ?? 0), usedBy: Number(r.usedBy ?? 0),
    daysLeft: daysLeft({ stock: p.stock, use30 }), toOrder: p.low ? suggestOrder({ stock: p.stock, lowStock: p.lowStock, use30 }) : 0,
    lastRestockAt: toIso(r.lastRestockAt),
  };
}

const SUPPLY_SELECT = sql`SELECT p.*,
    COALESCE((SELECT -SUM(m.delta) FROM "BookStockMove" m WHERE m."productId" = p.id AND m.reason IN ('USE', 'WRITE_OFF') AND m."createdAt" >= NOW() - INTERVAL '30 days'), 0)::float AS use30,
    COALESCE((SELECT -SUM(m.delta * COALESCE(m.cost, p.cost, 0)) FROM "BookStockMove" m WHERE m."productId" = p.id AND m.reason IN ('USE', 'WRITE_OFF') AND m."createdAt" >= NOW() - INTERVAL '30 days'), 0)::float AS "use30Cost",
    (SELECT COUNT(*)::int FROM "BookServiceSupply" n JOIN "BookService" s ON s.id = n."serviceId" WHERE n."productId" = p.id AND s.active) AS "usedBy",
    (SELECT MAX(m."createdAt") FROM "BookStockMove" m WHERE m."productId" = p.id AND m.reason = 'RESTOCK') AS "lastRestockAt"
  FROM "BookProduct" p`;

export async function listSupplies(businessId, { all = false } = {}, db = prisma) {
  const rows = await db.$queryRaw`${SUPPLY_SELECT} WHERE p."businessId" = ${businessId} AND p.kind = 'SUPPLY' ${all ? Prisma.empty : sql`AND p.active`} ORDER BY p."sortOrder", p.name`;
  return rows.map(supplyPublic);
}

export async function getSupply(businessId, id, db = prisma) {
  const [row] = await db.$queryRaw`${SUPPLY_SELECT} WHERE p.id = ${String(id)} AND p."businessId" = ${businessId} AND p.kind = 'SUPPLY'`;
  if (!row) throw bookError(404, 'მასალა ვერ მოიძებნა.', 'SUPPLY_NOT_FOUND', 'Supply not found.');
  return supplyPublic(row);
}

/** A supply is a product without a price whose stock is always counted (it starts at 0 when not given). */
export async function createSupply(businessId, input = {}, db = prisma) {
  const p = await createProduct(businessId, { ...input, kind: 'SUPPLY', price: 0, stock: input.stock == null || input.stock === '' ? 0 : input.stock, lowStock: input.lowStock ?? 5 }, db);
  return getSupply(businessId, p.id, db);
}

export async function updateSupply(businessId, id, input = {}, db = prisma) {
  await getSupply(businessId, id, db);
  const { kind, price, ...rest } = input;
  await updateProduct(businessId, id, rest, db);
  return getSupply(businessId, id, db);
}

export async function deactivateSupply(businessId, id, db = prisma) {
  await getSupply(businessId, id, db);
  await deactivateProduct(businessId, id, db);
}

/** A delivery: stock up, the unit cost refreshed when given, optionally an expense (category SUPPLIES) for the money it cost. */
export async function restock({ businessId, id, qty, cost = null, note = null, expense = false, actorUserId = null }, db = prisma) {
  await getSupply(businessId, id, db);
  if (!(n2(qty) > 0)) throw bookError(400, 'მიუთითე რაოდენობა.', 'QTY_REQUIRED', 'Enter the quantity.');
  await moveStock({ businessId, productId: id, delta: n2(qty), reason: 'RESTOCK', cost, note, expense, actorUserId }, db);
  return getSupply(businessId, id, db);
}

/** Used, spilled, expired: stock down by hand. */
export async function writeOff({ businessId, id, qty, note = null, actorUserId = null }, db = prisma) {
  await getSupply(businessId, id, db);
  if (!(n2(qty) > 0)) throw bookError(400, 'მიუთითე რაოდენობა.', 'QTY_REQUIRED', 'Enter the quantity.');
  await moveStock({ businessId, productId: id, delta: -n2(qty), reason: 'WRITE_OFF', note, actorUserId }, db);
  return getSupply(businessId, id, db);
}

/** A count: the shelf says N — the difference becomes one COUNT move (none when it already matches). */
export async function countStock({ businessId, id, counted, note = null, actorUserId = null }, db = prisma) {
  const s = await getSupply(businessId, id, db);
  const target = n2(counted);
  if (!(target >= 0)) throw bookError(400, 'მიუთითე დათვლილი რაოდენობა.', 'COUNT_REQUIRED', 'Enter the counted quantity.');
  const delta = n2(target - (s.stock ?? 0));
  if (delta) await moveStock({ businessId, productId: id, delta, reason: 'COUNT', note, actorUserId }, db);
  return getSupply(businessId, id, db);
}

// ——— norms: what one visit of a service uses ———

/** Every active service with its norms and the material cost of one visit. */
export async function listNorms(businessId, db = prisma) {
  const [services, norms, supplies] = await Promise.all([
    db.$queryRaw`SELECT id, "group", name, "nameKa", price, "durationMin" FROM "BookService" WHERE "businessId" = ${businessId} AND active ORDER BY "sortOrder", name`,
    db.$queryRaw`SELECT "serviceId", "productId", qty FROM "BookServiceSupply" WHERE "businessId" = ${businessId}`,
    db.$queryRaw`SELECT id, name, unit, cost, active FROM "BookProduct" WHERE "businessId" = ${businessId} AND kind = 'SUPPLY'`,
  ]);
  const byProduct = new Map(supplies.map((p) => [p.id, p]));
  const byService = new Map();
  for (const n of norms) {
    const p = byProduct.get(n.productId);
    if (!p) continue;
    if (!byService.has(n.serviceId)) byService.set(n.serviceId, []);
    byService.get(n.serviceId).push({ productId: p.id, name: p.name, unit: p.unit || 'pc', qty: n2(n.qty), cost: p.cost == null ? null : n2(n.qty * Number(p.cost)), active: Boolean(p.active) });
  }
  return services.map((s) => {
    const items = (byService.get(s.id) || []).sort((a, b) => a.name.localeCompare(b.name, 'ka'));
    const cost = n2(items.reduce((sum, i) => sum + (i.cost ?? 0), 0));
    return { id: s.id, group: s.group ?? null, name: s.nameKa && s.nameKa.trim() ? s.nameKa : s.name, price: s.price == null ? null : Number(s.price), durationMin: Number(s.durationMin), items, costPerVisit: cost, costShare: s.price ? Math.round((cost / Number(s.price)) * 1000) / 10 : null };
  });
}

/** Replace a service's norms. Products must be this business's supplies. */
export async function setNorms({ businessId, serviceId, items = [] }, db = prisma) {
  const wanted = normalizeNorms(items);
  return db.$transaction(async (tx) => {
    const [svc] = await tx.$queryRaw`SELECT id FROM "BookService" WHERE id = ${String(serviceId)} AND "businessId" = ${businessId}`;
    if (!svc) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
    if (wanted.length) {
      const found = await tx.$queryRaw`SELECT id FROM "BookProduct" WHERE "businessId" = ${businessId} AND kind = 'SUPPLY' AND id IN (${Prisma.join(wanted.map((w) => w.productId))})`;
      if (found.length !== wanted.length) throw bookError(404, 'მასალა ვერ მოიძებნა.', 'SUPPLY_NOT_FOUND', 'Supply not found.');
    }
    await tx.$executeRaw`DELETE FROM "BookServiceSupply" WHERE "serviceId" = ${svc.id}`;
    for (const w of wanted) await tx.$executeRaw`INSERT INTO "BookServiceSupply" (id, "businessId", "serviceId", "productId", qty) VALUES (${newId()}, ${businessId}, ${svc.id}, ${w.productId}, ${w.qty})`;
    return (await listNorms(businessId, tx)).find((s) => s.id === svc.id) ?? null;
  });
}

// ——— the visit hooks (inside the booking's own transaction) ———

/**
 * Completing a visit: every service's norms leave the stock — one USE move per supply with the unit cost of the day.
 * Never blocks the visit: a supply may go below zero (the page shows it). Idempotent per visit.
 */
export async function writeOffVisit(tx, { businessId, appointment, actorUserId = null }) {
  const [done] = await tx.$queryRaw`SELECT 1 AS x FROM "BookStockMove" WHERE "appointmentId" = ${appointment.id} AND reason = 'USE' LIMIT 1`;
  if (done) return [];
  // The row's items carry the service id as `id` (ITEMS_JSON in bookings.js); a single-service visit may have none.
  const items = Array.isArray(appointment.items) && appointment.items.length ? appointment.items : [{ serviceId: appointment.serviceId }];
  const times = new Map();
  for (const i of items) { const sid = i.serviceId ?? i.id; if (sid) times.set(sid, (times.get(sid) || 0) + 1); }
  if (!times.size) return [];
  const norms = await tx.$queryRaw`SELECT n."serviceId", n."productId", n.qty, p.cost FROM "BookServiceSupply" n JOIN "BookProduct" p ON p.id = n."productId"
    WHERE n."businessId" = ${businessId} AND p.active AND n."serviceId" IN (${Prisma.join([...times.keys()])})`;
  const out = [];
  for (const n of norms) {
    const qty = n2(Number(n.qty) * (times.get(n.serviceId) || 1));
    if (!(qty > 0)) continue;
    await tx.$executeRaw`UPDATE "BookProduct" SET stock = COALESCE(stock, 0) - ${qty}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${n.productId}`;
    await tx.$executeRaw`INSERT INTO "BookStockMove" (id, "businessId", "productId", delta, reason, "appointmentId", "serviceId", "staffId", cost, "createdBy")
      VALUES (${newId()}, ${businessId}, ${n.productId}, ${-qty}, 'USE', ${appointment.id}, ${n.serviceId}, ${appointment.staffId ?? null}, ${n.cost == null ? null : n2(n.cost)}, ${actorUserId})`;
    out.push({ productId: n.productId, qty });
  }
  return out;
}

/** The visit is no longer completed: its USE moves go away and the stock comes back. */
export async function revertVisit(tx, { businessId, appointmentId }) {
  const moves = await tx.$queryRaw`SELECT id, "productId", delta FROM "BookStockMove" WHERE "businessId" = ${businessId} AND "appointmentId" = ${appointmentId} AND reason = 'USE'`;
  for (const m of moves) await tx.$executeRaw`UPDATE "BookProduct" SET stock = COALESCE(stock, 0) - ${n2(m.delta)}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${m.productId}`;
  if (moves.length) await tx.$executeRaw`DELETE FROM "BookStockMove" WHERE id IN (${Prisma.join(moves.map((m) => m.id))})`;
  return moves.length;
}

// ——— the ledger and the page's numbers ———

export async function listMoves(businessId, { productId = null, limit = 300 } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT m.*, p.name AS "productName", p.unit, a."clientName", a."serviceName", st.name AS "staffName", u."fullName" AS "byName"
    FROM "BookStockMove" m JOIN "BookProduct" p ON p.id = m."productId"
    LEFT JOIN "BookAppointment" a ON a.id = m."appointmentId" LEFT JOIN "BookStaff" st ON st.id = m."staffId" LEFT JOIN "User" u ON u.id = m."createdBy"
    WHERE m."businessId" = ${businessId} AND p.kind = 'SUPPLY' ${productId ? sql`AND m."productId" = ${String(productId)}` : Prisma.empty}
    ORDER BY m."createdAt" DESC LIMIT ${Math.min(2000, Math.max(1, Number(limit) || 300))}`;
  return rows.map((m) => ({
    id: m.id, productId: m.productId, productName: m.productName, unit: m.unit || 'pc', delta: n2(m.delta), reason: m.reason,
    cost: m.cost == null ? null : n2(m.cost), value: m.cost == null ? null : n2(Math.abs(Number(m.delta)) * Number(m.cost)),
    appointmentId: m.appointmentId ?? null, clientName: m.clientName ?? null, serviceName: m.serviceName ?? null, staffName: m.staffName ?? null,
    byName: m.byName ?? null, note: m.note ?? null, at: toIso(m.createdAt),
  }));
}

/** How many active supplies are at or under their low mark (the dashboard's attention line). */
export async function countLow(businessId, db = prisma) {
  const [r] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookProduct" WHERE "businessId" = ${businessId} AND kind = 'SUPPLY' AND active AND stock IS NOT NULL AND stock <= "lowStock"`;
  return r?.n ?? 0;
}

/** The stock-room page's numbers: counts, value at cost, the month's consumption, what to order, the biggest spenders. */
export async function suppliesOverview(businessId, db = prisma) {
  const [list, [visits]] = await Promise.all([
    listSupplies(businessId, {}, db),
    db.$queryRaw`SELECT COUNT(DISTINCT "appointmentId")::int AS n FROM "BookStockMove" WHERE "businessId" = ${businessId} AND reason = 'USE' AND "createdAt" >= NOW() - INTERVAL '30 days'`,
  ]);
  const low = list.filter((s) => s.low);
  return {
    supplies: list.length, low: low.length,
    stockValue: n2(list.reduce((s, x) => s + (x.stock != null && x.cost != null ? Math.max(0, x.stock) * x.cost : 0), 0)),
    use30Cost: n2(list.reduce((s, x) => s + x.use30Cost, 0)),
    use30Visits: visits?.n ?? 0,
    toOrder: low.map((s) => ({ id: s.id, name: s.name, unit: s.unit, stock: s.stock, lowStock: s.lowStock, toOrder: s.toOrder, cost: s.cost, daysLeft: s.daysLeft })),
    top: list.filter((s) => s.use30Cost > 0).sort((a, b) => b.use30Cost - a.use30Cost).slice(0, 5).map((s) => ({ id: s.id, name: s.name, unit: s.unit, use30: s.use30, use30Cost: s.use30Cost })),
  };
}
