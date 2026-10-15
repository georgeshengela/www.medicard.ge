/**
 * MEDIBOOK products and sales: what the business sells over the counter, stock per product (optional), every sale
 * as one row with its items. A sale is income (category PRODUCT, the money method) and a stock move; a refund
 * puts both back. Sales may hang off a visit and a person (for payroll).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, newId } from './catalog.js';

const sql = Prisma.sql;
const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const money = (v) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Math.max(0, n2(v)) : null);
const cleanText = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const jsonList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : []);
const toIso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
const MONEY_METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];

export function productPublic(r) {
  const stock = r.stock == null ? null : Number(r.stock);
  return {
    id: r.id, name: r.name, sku: r.sku ?? null, category: r.category ?? null, price: Number(r.price), cost: r.cost == null ? null : Number(r.cost), stock, unit: r.unit || 'pc',
    lowStock: Number(r.lowStock ?? 3), low: stock != null && stock <= Number(r.lowStock ?? 3), active: Boolean(r.active), sortOrder: Number(r.sortOrder ?? 0), sold30: r.sold30 == null ? undefined : Number(r.sold30), createdAt: toIso(r.createdAt),
  };
}
export function salePublic(r) {
  return {
    id: r.id, clientId: r.clientId ?? null, clientName: r.clientName ?? null, appointmentId: r.appointmentId ?? null, staffId: r.staffId ?? null, staffName: r.staffName ?? null,
    items: jsonList(r.items).map((i) => ({ productId: i.productId ?? null, name: i.name, qty: Number(i.qty), price: Number(i.price), cost: i.cost == null ? null : Number(i.cost) })),
    total: Number(r.total), cost: Number(r.cost ?? 0), paidMethod: r.paidMethod ?? null, note: r.note ?? null, status: r.status, at: toIso(r.at), createdAt: toIso(r.createdAt),
  };
}

export async function listProducts(businessId, { all = false } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT p.*, (SELECT COALESCE(SUM((i->>'qty')::numeric), 0) FROM "BookSale" s, jsonb_array_elements(s.items) i WHERE s."businessId" = p."businessId" AND s.status = 'DONE' AND s.at >= NOW() - INTERVAL '30 days' AND i->>'productId' = p.id)::float AS sold30
    FROM "BookProduct" p WHERE p."businessId" = ${businessId} ${all ? Prisma.empty : sql`AND p.active`} ORDER BY p."sortOrder", p.name`;
  return rows.map(productPublic);
}

function sanitizeProduct(input = {}) {
  const out = {};
  if (input.name !== undefined) out.name = cleanText(input.name, 120);
  if (input.sku !== undefined) out.sku = cleanText(input.sku, 60);
  if (input.category !== undefined) out.category = cleanText(input.category, 60);
  if (input.price !== undefined) out.price = money(input.price);
  if (input.cost !== undefined) out.cost = money(input.cost);
  if (input.stock !== undefined) out.stock = input.stock === null || input.stock === '' ? null : n2(input.stock);
  if (input.unit !== undefined) out.unit = cleanText(input.unit, 12) || 'pc';
  if (input.lowStock !== undefined) out.lowStock = Math.max(0, n2(input.lowStock));
  if (input.active !== undefined) out.active = Boolean(input.active);
  if (input.sortOrder !== undefined) out.sortOrder = Math.round(Number(input.sortOrder) || 0);
  return out;
}

export async function createProduct(businessId, input = {}, db = prisma) {
  const p = sanitizeProduct(input);
  if (!p.name) throw bookError(400, 'მიუთითე პროდუქტის სახელი.', 'NAME_REQUIRED', 'Enter the product name.');
  if (!(p.price >= 0)) throw bookError(400, 'მიუთითე ფასი.', 'PRICE_REQUIRED', 'Enter the price.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookProduct" (id, "businessId", name, sku, category, price, cost, stock, unit, "lowStock", active, "sortOrder")
    VALUES (${id}, ${businessId}, ${p.name}, ${p.sku ?? null}, ${p.category ?? null}, ${p.price}, ${p.cost ?? null}, ${p.stock ?? null}, ${p.unit ?? 'pc'}, ${p.lowStock ?? 3}, ${p.active ?? true}, ${p.sortOrder ?? 0})`;
  const [row] = await db.$queryRaw`SELECT * FROM "BookProduct" WHERE id = ${id}`;
  return productPublic(row);
}

export async function updateProduct(businessId, id, input = {}, db = prisma) {
  const p = sanitizeProduct(input);
  if (p.name === null) throw bookError(400, 'სახელი ცარიელი ვერ იქნება.', 'NAME_REQUIRED', 'The name cannot be empty.');
  const sets = Object.entries(p).map(([k, v]) => sql`${Prisma.raw(`"${k}"`)} = ${v}`);
  if (!sets.length) throw bookError(400, 'შესაცვლელი არაფერია.', 'NOTHING_TO_UPDATE', 'Nothing to update.');
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookProduct" SET ${Prisma.join(sets, ', ')} WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'პროდუქტი ვერ მოიძებნა.', 'PRODUCT_NOT_FOUND', 'Product not found.');
  const [row] = await db.$queryRaw`SELECT * FROM "BookProduct" WHERE id = ${String(id)}`;
  return productPublic(row);
}

export async function deactivateProduct(businessId, id, db = prisma) {
  await db.$executeRaw`UPDATE "BookProduct" SET active = FALSE, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
}

/** Stock in (a delivery) or a correction; a product without stock tracking starts tracking at this number. */
export async function moveStock({ businessId, productId, delta, reason = 'RESTOCK', note = null, cost = null, actorUserId = null }, db = prisma) {
  const d = n2(delta);
  if (!d) throw bookError(400, 'მიუთითე რაოდენობა.', 'QTY_REQUIRED', 'Enter the quantity.');
  return db.$transaction(async (tx) => {
    const [p] = await tx.$queryRaw`SELECT * FROM "BookProduct" WHERE id = ${String(productId)} AND "businessId" = ${businessId}`;
    if (!p) throw bookError(404, 'პროდუქტი ვერ მოიძებნა.', 'PRODUCT_NOT_FOUND', 'Product not found.');
    const next = n2((p.stock == null ? 0 : Number(p.stock)) + d);
    const sets = [sql`stock = ${next}`, sql`"updatedAt" = CURRENT_TIMESTAMP`];
    if (cost != null && money(cost) != null) sets.push(sql`cost = ${money(cost)}`);
    await tx.$executeRaw`UPDATE "BookProduct" SET ${Prisma.join(sets, ', ')} WHERE id = ${p.id}`;
    await tx.$executeRaw`INSERT INTO "BookStockMove" (id, "businessId", "productId", delta, reason, note, "createdBy") VALUES (${newId()}, ${businessId}, ${p.id}, ${d}, ${['RESTOCK', 'ADJUST'].includes(reason) ? reason : 'ADJUST'}, ${cleanText(note, 300)}, ${actorUserId})`;
    const [row] = await tx.$queryRaw`SELECT * FROM "BookProduct" WHERE id = ${p.id}`;
    return productPublic(row);
  });
}

const SALE_SELECT = sql`SELECT s.*, st.name AS "staffName" FROM "BookSale" s LEFT JOIN "BookStaff" st ON st.id = s."staffId"`;

export async function listSales({ businessId, from = null, to = null, staffId = null, limit = 500 }, db = prisma) {
  const range = from && to ? sql`AND s.at >= ${from} AND s.at < ${to}` : Prisma.empty;
  const who = staffId ? sql`AND s."staffId" = ${staffId}` : Prisma.empty;
  const rows = await db.$queryRaw`${SALE_SELECT} WHERE s."businessId" = ${businessId} ${range} ${who} ORDER BY s.at DESC LIMIT ${Math.min(2000, Math.max(1, Number(limit) || 500))}`;
  return rows.map(salePublic);
}

/** One sale: items by product (price from the product unless given), stock out, an income transaction, the client's total. */
export async function createSale({ businessId, items = [], clientId = null, clientName = null, appointmentId = null, staffId = null, paidMethod = 'CASH', note = null, at = null, actorUserId = null }, db = prisma) {
  const wanted = (Array.isArray(items) ? items : []).map((i) => ({ productId: String(i.productId ?? ''), qty: n2(i.qty ?? 1), price: i.price === undefined || i.price === null || i.price === '' ? null : money(i.price) })).filter((i) => i.productId && i.qty > 0).slice(0, 50);
  if (!wanted.length) throw bookError(400, 'დაამატე პროდუქტი.', 'ITEMS_REQUIRED', 'Add a product.');
  const method = MONEY_METHODS.includes(paidMethod) ? paidMethod : 'CASH';
  const when = at ? new Date(at) : new Date();
  if (Number.isNaN(when.getTime())) throw bookError(400, 'არასწორი თარიღი.', 'BAD_DATE', 'Invalid date.');
  return db.$transaction(async (tx) => {
    const products = await tx.$queryRaw`SELECT * FROM "BookProduct" WHERE "businessId" = ${businessId} AND id IN (${Prisma.join(wanted.map((i) => i.productId))})`;
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = [];
    for (const i of wanted) {
      const p = byId.get(i.productId);
      if (!p || !p.active) throw bookError(404, 'პროდუქტი ვერ მოიძებნა.', 'PRODUCT_NOT_FOUND', 'Product not found.');
      if (p.stock != null && Number(p.stock) < i.qty) throw bookError(409, `„${p.name}“ — მარაგში მხოლოდ ${Number(p.stock)} ${p.unit || 'ც'}.`, 'OUT_OF_STOCK', `"${p.name}" — only ${Number(p.stock)} in stock.`);
      lines.push({ productId: p.id, name: p.name, qty: i.qty, price: i.price != null ? i.price : Number(p.price), cost: p.cost == null ? null : Number(p.cost) });
    }
    const total = n2(lines.reduce((s, l) => s + l.qty * l.price, 0));
    const cost = n2(lines.reduce((s, l) => s + l.qty * (l.cost ?? 0), 0));
    let client = null;
    if (clientId) [client] = await tx.$queryRaw`SELECT id, name FROM "BookClient" WHERE id = ${String(clientId)} AND "businessId" = ${businessId}`;
    const id = newId();
    const txId = newId();
    const label = lines.length === 1 ? `${lines[0].name}${lines[0].qty !== 1 ? ` ×${lines[0].qty}` : ''}` : `${lines.length} პროდუქტი`;
    if (total > 0) await tx.$executeRaw`INSERT INTO "BookTransaction" (id, "businessId", "staffId", kind, category, amount, method, note, at, "createdBy") VALUES (${txId}, ${businessId}, ${staffId}, 'INCOME', 'PRODUCT', ${total}, ${method}, ${`გაყიდვა: ${label}`}, ${when}, ${actorUserId})`;
    await tx.$executeRaw`INSERT INTO "BookSale" (id, "businessId", "clientId", "clientName", "appointmentId", "staffId", items, total, cost, "paidMethod", note, status, "transactionId", at, "createdBy")
      VALUES (${id}, ${businessId}, ${client?.id ?? null}, ${cleanText(clientName, 120) ?? client?.name ?? null}, ${appointmentId}, ${staffId}, ${JSON.stringify(lines)}::jsonb, ${total}, ${cost}, ${method}, ${cleanText(note, 300)}, 'DONE', ${total > 0 ? txId : null}, ${when}, ${actorUserId})`;
    for (const l of lines) {
      const p = byId.get(l.productId);
      if (p.stock != null) {
        await tx.$executeRaw`UPDATE "BookProduct" SET stock = stock - ${l.qty}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${p.id}`;
        await tx.$executeRaw`INSERT INTO "BookStockMove" (id, "businessId", "productId", delta, reason, "saleId", "createdBy") VALUES (${newId()}, ${businessId}, ${p.id}, ${-l.qty}, 'SALE', ${id}, ${actorUserId})`;
      }
    }
    if (client && total > 0) await tx.$executeRaw`UPDATE "BookClient" SET "totalSpent" = "totalSpent" + ${total}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${client.id}`;
    const [row] = await tx.$queryRaw`${SALE_SELECT} WHERE s.id = ${id}`;
    return salePublic(row);
  });
}

export async function refundSale({ businessId, id, actorUserId = null }, db = prisma) {
  return db.$transaction(async (tx) => {
    const [s] = await tx.$queryRaw`SELECT * FROM "BookSale" WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
    if (!s) throw bookError(404, 'გაყიდვა ვერ მოიძებნა.', 'SALE_NOT_FOUND', 'Sale not found.');
    if (s.status === 'REFUNDED') return salePublic(s);
    await tx.$executeRaw`UPDATE "BookSale" SET status = 'REFUNDED', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${s.id}`;
    if (s.transactionId) await tx.$executeRaw`DELETE FROM "BookTransaction" WHERE id = ${s.transactionId} AND "businessId" = ${businessId}`;
    for (const l of jsonList(s.items)) {
      if (!l.productId) continue;
      const [p] = await tx.$queryRaw`SELECT stock FROM "BookProduct" WHERE id = ${l.productId}`;
      if (p && p.stock != null) {
        await tx.$executeRaw`UPDATE "BookProduct" SET stock = stock + ${n2(l.qty)}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${l.productId}`;
        await tx.$executeRaw`INSERT INTO "BookStockMove" (id, "businessId", "productId", delta, reason, "saleId", "createdBy") VALUES (${newId()}, ${businessId}, ${l.productId}, ${n2(l.qty)}, 'REFUND', ${s.id}, ${actorUserId})`;
      }
    }
    if (s.clientId) await tx.$executeRaw`UPDATE "BookClient" SET "totalSpent" = GREATEST(0, "totalSpent" - ${Number(s.total)}), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${s.clientId}`;
    const [row] = await tx.$queryRaw`${SALE_SELECT} WHERE s.id = ${s.id}`;
    return salePublic(row);
  });
}

/** The products page's numbers: stock value at cost, low-stock count, 30-day sales and margin. */
export async function productsOverview(businessId, db = prisma) {
  const [[stock], [sales]] = await Promise.all([
    db.$queryRaw`SELECT COUNT(*)::int AS products, COUNT(*) FILTER (WHERE stock IS NOT NULL AND stock <= "lowStock")::int AS low, COALESCE(SUM(CASE WHEN stock IS NOT NULL AND cost IS NOT NULL THEN stock * cost ELSE 0 END), 0)::float AS "stockValue" FROM "BookProduct" WHERE "businessId" = ${businessId} AND active`,
    db.$queryRaw`SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0)::float AS revenue, COALESCE(SUM(cost), 0)::float AS cost FROM "BookSale" WHERE "businessId" = ${businessId} AND status = 'DONE' AND at >= NOW() - INTERVAL '30 days'`,
  ]);
  return { products: stock?.products ?? 0, low: stock?.low ?? 0, stockValue: n2(stock?.stockValue ?? 0), sales30: sales?.n ?? 0, revenue30: n2(sales?.revenue ?? 0), cost30: n2(sales?.cost ?? 0), margin30: n2((sales?.revenue ?? 0) - (sales?.cost ?? 0)) };
}
