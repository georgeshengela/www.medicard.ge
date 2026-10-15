/**
 * MEDIBOOK loyalty: cashback on the client card (a share of every paid visit comes back as bonus the client
 * spends on the next one), gift cards (sold with a code, spent on visits), memberships (a package of visits or a
 * prepaid amount with a validity). A completed visit may be paid partly by a gift card, bonus or a membership —
 * `applyPayment` works the parts out, writes the ledger and keeps them on the appointment (`paidParts`) so
 * `revertPayment` can put everything back when the completion is undone. Money (cash / card / transfer) is the
 * only part that becomes an income transaction; gift cards and memberships are income when sold.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, newId, normalizePhone, normalizeSettings } from './catalog.js';
import { addDaysYmd, tbilisiYmd } from './time.js';

const sql = Prisma.sql;
const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const money = (v) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Math.max(0, n2(v)) : null);
const cleanText = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const jsonList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : []);
const toIso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
const MONEY_METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];

// ——— public shapes ———

export function giftCardPublic(r) {
  return {
    id: r.id, businessId: r.businessId, code: r.code, amount: Number(r.amount), balance: Number(r.balance),
    buyerClientId: r.buyerClientId ?? null, buyerName: r.buyerName ?? null, recipientName: r.recipientName ?? null, recipientPhone: r.recipientPhone ?? null,
    note: r.note ?? null, status: r.status, expiresOn: r.expiresOn ?? null, paidMethod: r.paidMethod ?? null, createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt),
  };
}
export function membershipPublic(r) {
  return {
    id: r.id, businessId: r.businessId, title: r.title, description: r.description ?? null, kind: r.kind, serviceIds: jsonList(r.serviceIds),
    visitsTotal: r.visitsTotal == null ? null : Number(r.visitsTotal), amountTotal: r.amountTotal == null ? null : Number(r.amountTotal), price: Number(r.price),
    validDays: Number(r.validDays), active: Boolean(r.active), sortOrder: Number(r.sortOrder ?? 0), sold: r.sold == null ? undefined : Number(r.sold), createdAt: toIso(r.createdAt),
  };
}
export function clientMembershipPublic(r) {
  return {
    id: r.id, businessId: r.businessId, membershipId: r.membershipId ?? null, clientId: r.clientId, clientName: r.clientName ?? undefined, clientPhone: r.clientPhone ?? undefined,
    title: r.title, kind: r.kind, serviceIds: jsonList(r.serviceIds),
    visitsTotal: r.visitsTotal == null ? null : Number(r.visitsTotal), visitsLeft: r.visitsLeft == null ? null : Number(r.visitsLeft),
    amountTotal: r.amountTotal == null ? null : Number(r.amountTotal), amountLeft: r.amountLeft == null ? null : Number(r.amountLeft),
    price: Number(r.price), paidMethod: r.paidMethod ?? null, startsOn: r.startsOn, endsOn: r.endsOn, status: r.status, createdAt: toIso(r.createdAt),
  };
}
export function ledgerPublic(r) {
  return { id: r.id, clientId: r.clientId ?? null, clientName: r.clientName ?? undefined, kind: r.kind, amount: Number(r.amount), appointmentId: r.appointmentId ?? null, giftCardId: r.giftCardId ?? null, clientMembershipId: r.clientMembershipId ?? null, note: r.note ?? null, createdAt: toIso(r.createdAt) };
}

// ——— pure pieces (tested) ———

/** A gift-card code people can read out loud: 8 characters without 0/O/1/I, in two groups. */
export function generateGiftCode(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(random() * alphabet.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
export const normalizeGiftCode = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');

/** Does a membership cover a visit of these services? Empty serviceIds = everything. */
export function membershipCovers(m, serviceIds) {
  const allowed = jsonList(m.serviceIds);
  if (!allowed.length) return true;
  const wanted = (serviceIds ?? []).filter(Boolean);
  return wanted.length > 0 && wanted.every((id) => allowed.includes(id));
}

/**
 * How a visit's price splits: membership first (a VISITS pass covers the whole price, an AMOUNT pass up to what is
 * left on it), then the gift card, then bonus (at most the business's share of the price), the rest in money.
 * Cashback is earned on the money part only. Pure.
 */
export function computeParts({ price, loyalty, gift = null, bonusBalance = 0, bonusRequested = 0, membership = null, firstVisit = false }) {
  const total = n2(price ?? 0);
  let left = total;
  const out = { price: total, membershipAmount: 0, membershipVisits: 0, giftAmount: 0, bonusAmount: 0, cashAmount: 0, bonusEarned: 0, welcomeBonus: 0 };
  if (membership && left > 0) {
    if (membership.kind === 'VISITS' && Number(membership.visitsLeft) > 0) { out.membershipAmount = left; out.membershipVisits = 1; left = 0; }
    else if (membership.kind === 'AMOUNT' && Number(membership.amountLeft) > 0) { out.membershipAmount = Math.min(left, n2(membership.amountLeft)); left = n2(left - out.membershipAmount); }
  }
  if (gift && left > 0 && Number(gift.balance) > 0) { out.giftAmount = Math.min(left, n2(gift.balance)); left = n2(left - out.giftAmount); }
  if (left > 0 && bonusRequested > 0 && bonusBalance > 0) {
    const cap = n2(total * (Number(loyalty?.maxRedeemPercent ?? 50) / 100));
    out.bonusAmount = Math.min(left, n2(bonusRequested), n2(bonusBalance), cap);
    left = n2(left - out.bonusAmount);
  }
  out.cashAmount = n2(left);
  const pct = Number(loyalty?.cashbackPercent ?? 0);
  if (pct > 0 && out.cashAmount > 0) out.bonusEarned = n2((out.cashAmount * pct) / 100);
  if (firstVisit && Number(loyalty?.welcomeBonus ?? 0) > 0) out.welcomeBonus = n2(loyalty.welcomeBonus);
  return out;
}

// ——— gift cards ———

export async function listGiftCards(businessId, { status = 'ACTIVE', limit = 500 } = {}, db = prisma) {
  const where = status && status !== 'all' ? sql`AND g.status = ${String(status)}` : Prisma.empty;
  const rows = await db.$queryRaw`SELECT g.* FROM "BookGiftCard" g WHERE g."businessId" = ${businessId} ${where} ORDER BY g."createdAt" DESC LIMIT ${Math.min(2000, Math.max(1, Number(limit) || 500))}`;
  return rows.map(giftCardPublic);
}

export async function findGiftCard(businessId, code, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "BookGiftCard" WHERE "businessId" = ${businessId} AND code = ${normalizeGiftCode(code)}`;
  return row ?? null;
}

/** A gift card is sold: the business gets the money now (income, category GIFT_CARD); the card is spent on visits later. */
export async function sellGiftCard({ businessId, amount, buyerClientId = null, buyerName = null, recipientName = null, recipientPhone = null, note = null, expiresOn = null, paidMethod = 'CASH', actorUserId = null, now = new Date() }, db = prisma) {
  const amt = money(amount);
  if (!(amt > 0)) throw bookError(400, 'მიუთითე თანხა.', 'AMOUNT_REQUIRED', 'Enter the amount.');
  const exp = /^\d{4}-\d{2}-\d{2}$/.test(String(expiresOn ?? '')) ? expiresOn : addDaysYmd(tbilisiYmd(now), 365);
  const method = MONEY_METHODS.includes(paidMethod) ? paidMethod : 'CASH';
  return db.$transaction(async (tx) => {
    let code = generateGiftCode();
    for (let i = 0; i < 5 && await findGiftCard(businessId, code, tx); i += 1) code = generateGiftCode();
    const id = newId();
    await tx.$executeRaw`INSERT INTO "BookGiftCard" (id, "businessId", code, amount, balance, "buyerClientId", "buyerName", "recipientName", "recipientPhone", note, status, "expiresOn", "paidMethod", "createdBy")
      VALUES (${id}, ${businessId}, ${code}, ${amt}, ${amt}, ${buyerClientId}, ${cleanText(buyerName, 120)}, ${cleanText(recipientName, 120)}, ${normalizePhone(recipientPhone)}, ${cleanText(note, 300)}, 'ACTIVE', ${exp}, ${method}, ${actorUserId})`;
    await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "giftCardId", note, "createdBy") VALUES (${newId()}, ${businessId}, ${buyerClientId}, 'GIFT_SOLD', ${amt}, ${id}, ${cleanText(note, 300)}, ${actorUserId})`;
    await tx.$executeRaw`INSERT INTO "BookTransaction" (id, "businessId", kind, category, amount, method, note, at, "createdBy") VALUES (${newId()}, ${businessId}, 'INCOME', 'GIFT_CARD', ${amt}, ${method}, ${`სასაჩუქრე ბარათი ${code}`}, ${now}, ${actorUserId})`;
    const [row] = await tx.$queryRaw`SELECT * FROM "BookGiftCard" WHERE id = ${id}`;
    return giftCardPublic(row);
  });
}

export async function updateGiftCard({ businessId, id, patch = {} }, db = prisma) {
  const sets = [];
  if (patch.status === 'CANCELLED') sets.push(sql`status = 'CANCELLED'`);
  if (patch.note !== undefined) sets.push(sql`note = ${cleanText(patch.note, 300)}`);
  if (patch.recipientName !== undefined) sets.push(sql`"recipientName" = ${cleanText(patch.recipientName, 120)}`);
  if (patch.recipientPhone !== undefined) sets.push(sql`"recipientPhone" = ${normalizePhone(patch.recipientPhone)}`);
  if (!sets.length) return null;
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookGiftCard" SET ${Prisma.join(sets, ', ')} WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'ბარათი ვერ მოიძებნა.', 'GIFT_NOT_FOUND', 'Gift card not found.');
  const [row] = await db.$queryRaw`SELECT * FROM "BookGiftCard" WHERE id = ${String(id)}`;
  return giftCardPublic(row);
}

// ——— memberships (the products) ———

export async function listMemberships(businessId, { all = false } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT m.*, (SELECT COUNT(*)::int FROM "BookClientMembership" cm WHERE cm."membershipId" = m.id) AS sold FROM "BookMembership" m WHERE m."businessId" = ${businessId} ${all ? Prisma.empty : sql`AND m.active`} ORDER BY m."sortOrder", m."createdAt"`;
  return rows.map(membershipPublic);
}

export async function saveMembership({ businessId, id = null, input = {} }, db = prisma) {
  const title = cleanText(input.title, 120);
  if (!title) throw bookError(400, 'მიუთითე სახელი.', 'NAME_REQUIRED', 'Enter the name.');
  const kind = input.kind === 'AMOUNT' ? 'AMOUNT' : 'VISITS';
  const visitsTotal = kind === 'VISITS' ? Math.max(1, Math.min(200, Math.round(Number(input.visitsTotal) || 0))) : null;
  const amountTotal = kind === 'AMOUNT' ? money(input.amountTotal) : null;
  if (kind === 'VISITS' && !visitsTotal) throw bookError(400, 'მიუთითე ვიზიტების რაოდენობა.', 'VISITS_REQUIRED', 'Enter the number of visits.');
  if (kind === 'AMOUNT' && !(amountTotal > 0)) throw bookError(400, 'მიუთითე თანხა.', 'AMOUNT_REQUIRED', 'Enter the amount.');
  const price = money(input.price);
  if (!(price > 0)) throw bookError(400, 'მიუთითე ფასი.', 'PRICE_REQUIRED', 'Enter the price.');
  const validDays = Math.max(7, Math.min(730, Math.round(Number(input.validDays) || 90)));
  const serviceIds = JSON.stringify((Array.isArray(input.serviceIds) ? input.serviceIds : []).map(String).slice(0, 50));
  const description = cleanText(input.description, 300);
  const active = input.active === undefined ? true : Boolean(input.active);
  if (id) {
    const n = await db.$executeRaw`UPDATE "BookMembership" SET title = ${title}, description = ${description}, kind = ${kind}, "serviceIds" = ${serviceIds}::jsonb, "visitsTotal" = ${visitsTotal}, "amountTotal" = ${amountTotal}, price = ${price}, "validDays" = ${validDays}, active = ${active}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
    if (!n) throw bookError(404, 'აბონემენტი ვერ მოიძებნა.', 'MEMBERSHIP_NOT_FOUND', 'Membership not found.');
  } else {
    id = newId();
    await db.$executeRaw`INSERT INTO "BookMembership" (id, "businessId", title, description, kind, "serviceIds", "visitsTotal", "amountTotal", price, "validDays", active) VALUES (${id}, ${businessId}, ${title}, ${description}, ${kind}, ${serviceIds}::jsonb, ${visitsTotal}, ${amountTotal}, ${price}, ${validDays}, ${active})`;
  }
  const [row] = await db.$queryRaw`SELECT * FROM "BookMembership" WHERE id = ${String(id)}`;
  return membershipPublic(row);
}

export async function deactivateMembership({ businessId, id }, db = prisma) {
  await db.$executeRaw`UPDATE "BookMembership" SET active = FALSE, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
}

// ——— memberships the clients hold ———

const CM_SELECT = sql`SELECT cm.*, c.name AS "clientName", c.phone AS "clientPhone" FROM "BookClientMembership" cm JOIN "BookClient" c ON c.id = cm."clientId"`;

export async function listClientMemberships(businessId, { clientId = null, status = 'ACTIVE', limit = 500 } = {}, db = prisma) {
  const who = clientId ? sql`AND cm."clientId" = ${String(clientId)}` : Prisma.empty;
  const st = status && status !== 'all' ? sql`AND cm.status = ${String(status)}` : Prisma.empty;
  const rows = await db.$queryRaw`${CM_SELECT} WHERE cm."businessId" = ${businessId} ${who} ${st} ORDER BY cm."createdAt" DESC LIMIT ${Math.min(2000, Math.max(1, Number(limit) || 500))}`;
  return rows.map(clientMembershipPublic);
}

/** Sold to a client: the business gets the money now (income, category MEMBERSHIP); visits or the amount are used up on completed bookings. */
export async function sellMembership({ businessId, membershipId, clientId, paidMethod = 'CASH', startsOn = null, actorUserId = null, now = new Date() }, db = prisma) {
  const [m] = await db.$queryRaw`SELECT * FROM "BookMembership" WHERE id = ${String(membershipId)} AND "businessId" = ${businessId} AND active`;
  if (!m) throw bookError(404, 'აბონემენტი ვერ მოიძებნა.', 'MEMBERSHIP_NOT_FOUND', 'Membership not found.');
  const [client] = await db.$queryRaw`SELECT id FROM "BookClient" WHERE id = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!client) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(startsOn ?? '')) ? startsOn : tbilisiYmd(now);
  const end = addDaysYmd(start, Number(m.validDays));
  const method = MONEY_METHODS.includes(paidMethod) ? paidMethod : 'CASH';
  return db.$transaction(async (tx) => {
    const id = newId();
    await tx.$executeRaw`INSERT INTO "BookClientMembership" (id, "businessId", "membershipId", "clientId", title, kind, "serviceIds", "visitsTotal", "visitsLeft", "amountTotal", "amountLeft", price, "paidMethod", "startsOn", "endsOn", status, "createdBy")
      VALUES (${id}, ${businessId}, ${m.id}, ${client.id}, ${m.title}, ${m.kind}, ${JSON.stringify(jsonList(m.serviceIds))}::jsonb, ${m.visitsTotal}, ${m.visitsTotal}, ${m.amountTotal}, ${m.amountTotal}, ${m.price}, ${method}, ${start}, ${end}, 'ACTIVE', ${actorUserId})`;
    await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "clientMembershipId", note, "createdBy") VALUES (${newId()}, ${businessId}, ${client.id}, 'MEMBERSHIP_SOLD', ${Number(m.price)}, ${id}, ${m.title}, ${actorUserId})`;
    await tx.$executeRaw`INSERT INTO "BookTransaction" (id, "businessId", kind, category, amount, method, note, at, "createdBy") VALUES (${newId()}, ${businessId}, 'INCOME', 'MEMBERSHIP', ${Number(m.price)}, ${method}, ${`აბონემენტი: ${m.title}`}, ${now}, ${actorUserId})`;
    const [row] = await tx.$queryRaw`${CM_SELECT} WHERE cm.id = ${id}`;
    return clientMembershipPublic(row);
  });
}

export async function cancelClientMembership({ businessId, id }, db = prisma) {
  const n = await db.$executeRaw`UPDATE "BookClientMembership" SET status = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${String(id)} AND "businessId" = ${businessId} AND status = 'ACTIVE'`;
  if (!n) throw bookError(404, 'აბონემენტი ვერ მოიძებნა.', 'MEMBERSHIP_NOT_FOUND', 'Membership not found.');
}

// ——— the client's card ———

export async function clientLoyalty({ businessId, clientId }, db = prisma) {
  const [client] = await db.$queryRaw`SELECT id, "bonusBalance", visits FROM "BookClient" WHERE id = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!client) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const [memberships, gifts, ledger] = await Promise.all([
    listClientMemberships(businessId, { clientId: client.id, status: 'all', limit: 50 }, db),
    db.$queryRaw`SELECT * FROM "BookGiftCard" WHERE "businessId" = ${businessId} AND "buyerClientId" = ${client.id} ORDER BY "createdAt" DESC LIMIT 50`,
    db.$queryRaw`SELECT * FROM "BookLoyaltyLedger" WHERE "businessId" = ${businessId} AND "clientId" = ${client.id} ORDER BY "createdAt" DESC LIMIT 60`,
  ]);
  return { bonusBalance: Number(client.bonusBalance ?? 0), visits: Number(client.visits ?? 0), memberships, giftCards: gifts.map(giftCardPublic), ledger: ledger.map(ledgerPublic) };
}

export async function adjustBonus({ businessId, clientId, amount, note = null, actorUserId = null }, db = prisma) {
  const delta = n2(amount);
  if (!delta) throw bookError(400, 'მიუთითე თანხა.', 'AMOUNT_REQUIRED', 'Enter the amount.');
  return db.$transaction(async (tx) => {
    const [client] = await tx.$queryRaw`SELECT id, "bonusBalance" FROM "BookClient" WHERE id = ${String(clientId)} AND "businessId" = ${businessId}`;
    if (!client) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
    const next = Math.max(0, n2(Number(client.bonusBalance) + delta));
    await tx.$executeRaw`UPDATE "BookClient" SET "bonusBalance" = ${next}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${client.id}`;
    await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, note, "createdBy") VALUES (${newId()}, ${businessId}, ${client.id}, 'BONUS_ADJUST', ${n2(next - Number(client.bonusBalance))}, ${cleanText(note, 300)}, ${actorUserId})`;
    return { bonusBalance: next };
  });
}

/** What the complete dialog needs: the client's bonus, the passes that cover this visit, the cashback share. */
export async function paymentOptions({ businessId, appointment }, db = prisma) {
  const [business] = await db.$queryRaw`SELECT settings FROM "BookBusiness" WHERE id = ${businessId}`;
  const loyalty = normalizeSettings(business?.settings).loyalty;
  const serviceIds = Array.isArray(appointment.items) && appointment.items.length ? appointment.items.map((i) => i.id).filter(Boolean) : [appointment.serviceId].filter(Boolean);
  const today = tbilisiYmd();
  let bonusBalance = 0;
  let memberships = [];
  let firstVisit = true;
  if (appointment.clientId) {
    const [c] = await db.$queryRaw`SELECT "bonusBalance", visits FROM "BookClient" WHERE id = ${appointment.clientId}`;
    bonusBalance = Number(c?.bonusBalance ?? 0);
    firstVisit = Number(c?.visits ?? 0) === 0;
    const rows = await db.$queryRaw`${CM_SELECT} WHERE cm."businessId" = ${businessId} AND cm."clientId" = ${appointment.clientId} AND cm.status = 'ACTIVE' AND cm."endsOn" >= ${today} ORDER BY cm."endsOn"`;
    memberships = rows.map(clientMembershipPublic).filter((m) => membershipCovers(m, serviceIds) && ((m.kind === 'VISITS' && m.visitsLeft > 0) || (m.kind === 'AMOUNT' && m.amountLeft > 0)));
  }
  const price = n2(appointment.price ?? 0);
  return { loyalty, price, bonusBalance, maxBonus: Math.min(bonusBalance, n2(price * (loyalty.maxRedeemPercent / 100))), memberships, firstVisit, cashbackPreview: computeParts({ price, loyalty, firstVisit }).bonusEarned };
}

/**
 * Inside the completion transaction: resolve the parts, write the ledger, update the gift card / membership /
 * client balance and the appointment's paidParts + paidAmount. Returns the parts.
 */
export async function applyPayment(tx, { businessId, appointment, payment = {}, actorUserId = null, now = new Date() }) {
  const [business] = await tx.$queryRaw`SELECT settings FROM "BookBusiness" WHERE id = ${businessId}`;
  const loyalty = normalizeSettings(business?.settings).loyalty;
  const a = appointment;
  const price = n2(a.price ?? 0);
  const serviceIds = Array.isArray(a.items) && a.items.length ? a.items.map((i) => i.id).filter(Boolean) : [a.serviceId].filter(Boolean);
  const today = tbilisiYmd(now);
  let client = null;
  if (a.clientId) [client] = await tx.$queryRaw`SELECT id, "bonusBalance", visits FROM "BookClient" WHERE id = ${a.clientId}`;
  let gift = null;
  if (payment.giftCode) {
    gift = await findGiftCard(businessId, payment.giftCode, tx);
    if (!gift || gift.status !== 'ACTIVE' || Number(gift.balance) <= 0) throw bookError(404, 'ასეთი აქტიური სასაჩუქრე ბარათი არ არის.', 'GIFT_NOT_FOUND', 'No active gift card with this code.');
    if (gift.expiresOn && gift.expiresOn < today) throw bookError(409, 'ბარათს ვადა გაუვიდა.', 'GIFT_EXPIRED', 'The gift card has expired.');
  }
  let membership = null;
  if (payment.clientMembershipId) {
    const [m] = await tx.$queryRaw`SELECT * FROM "BookClientMembership" WHERE id = ${String(payment.clientMembershipId)} AND "businessId" = ${businessId} AND status = 'ACTIVE'`;
    if (!m || (client && m.clientId !== client.id)) throw bookError(404, 'აბონემენტი ვერ მოიძებნა.', 'MEMBERSHIP_NOT_FOUND', 'Membership not found.');
    if (m.endsOn < today) throw bookError(409, 'აბონემენტს ვადა გაუვიდა.', 'MEMBERSHIP_EXPIRED', 'The membership has expired.');
    if (!membershipCovers(m, serviceIds)) throw bookError(409, 'ეს აბონემენტი ამ სერვისზე არ ვრცელდება.', 'MEMBERSHIP_MISMATCH', 'This membership does not cover this service.');
    membership = m;
  }
  const parts = computeParts({ price, loyalty, gift, bonusBalance: client ? Number(client.bonusBalance) : 0, bonusRequested: client ? n2(payment.bonusAmount ?? 0) : 0, membership, firstVisit: client ? Number(client.visits) === 0 : false });
  // The business may type what it actually received in money (a tip, a rounded amount): that wins over the computed rest.
  const cashAmount = payment.cashAmount != null && money(payment.cashAmount) != null ? money(payment.cashAmount) : parts.cashAmount;
  parts.cashAmount = cashAmount;
  parts.bonusEarned = loyalty.cashbackPercent > 0 && cashAmount > 0 ? n2((cashAmount * loyalty.cashbackPercent) / 100) : 0;
  const stamp = { ...parts, giftCardId: gift?.id ?? null, giftCode: gift?.code ?? null, clientMembershipId: membership?.id ?? null, membershipTitle: membership?.title ?? null };
  if (gift && parts.giftAmount > 0) {
    const left = n2(Number(gift.balance) - parts.giftAmount);
    await tx.$executeRaw`UPDATE "BookGiftCard" SET balance = ${left}, status = ${left <= 0 ? 'USED' : 'ACTIVE'}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${gift.id}`;
    await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "appointmentId", "giftCardId", "createdBy") VALUES (${newId()}, ${businessId}, ${client?.id ?? null}, 'GIFT_REDEEM', ${-parts.giftAmount}, ${a.id}, ${gift.id}, ${actorUserId})`;
  }
  if (membership && parts.membershipAmount > 0) {
    if (membership.kind === 'VISITS') {
      const left = Math.max(0, Number(membership.visitsLeft) - 1);
      await tx.$executeRaw`UPDATE "BookClientMembership" SET "visitsLeft" = ${left}, status = ${left <= 0 ? 'USED' : 'ACTIVE'}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${membership.id}`;
    } else {
      const left = n2(Number(membership.amountLeft) - parts.membershipAmount);
      await tx.$executeRaw`UPDATE "BookClientMembership" SET "amountLeft" = ${left}, status = ${left <= 0 ? 'USED' : 'ACTIVE'}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${membership.id}`;
    }
    await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "appointmentId", "clientMembershipId", "createdBy") VALUES (${newId()}, ${businessId}, ${client?.id ?? null}, 'MEMBERSHIP_USE', ${-parts.membershipAmount}, ${a.id}, ${membership.id}, ${actorUserId})`;
  }
  if (client) {
    let balance = Number(client.bonusBalance);
    if (parts.bonusAmount > 0) {
      balance = n2(balance - parts.bonusAmount);
      await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "appointmentId", "createdBy") VALUES (${newId()}, ${businessId}, ${client.id}, 'BONUS_REDEEM', ${-parts.bonusAmount}, ${a.id}, ${actorUserId})`;
    }
    const earned = n2(parts.bonusEarned + parts.welcomeBonus);
    if (earned > 0) {
      balance = n2(balance + earned);
      await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "appointmentId", note, "createdBy") VALUES (${newId()}, ${businessId}, ${client.id}, 'BONUS_EARN', ${earned}, ${a.id}, ${parts.welcomeBonus > 0 ? 'პირველი ვიზიტის ბონუსი' : null}, ${actorUserId})`;
    }
    if (balance !== Number(client.bonusBalance)) await tx.$executeRaw`UPDATE "BookClient" SET "bonusBalance" = ${Math.max(0, balance)}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${client.id}`;
  }
  await tx.$executeRaw`UPDATE "BookAppointment" SET "paidParts" = ${JSON.stringify(stamp)}::jsonb, "paidAmount" = ${cashAmount} WHERE id = ${a.id}`;
  return stamp;
}

/** Undoing a completion: gift balance, membership visit / amount and bonus go back; the ledger gets the opposite rows. */
export async function revertPayment(tx, { businessId, appointment, actorUserId = null }) {
  const a = appointment;
  const parts = a.paidParts && typeof a.paidParts === 'object' ? a.paidParts : null;
  if (!parts) return null;
  if (parts.giftCardId && parts.giftAmount > 0) {
    await tx.$executeRaw`UPDATE "BookGiftCard" SET balance = balance + ${n2(parts.giftAmount)}, status = CASE WHEN status = 'USED' THEN 'ACTIVE' ELSE status END, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${parts.giftCardId}`;
    await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "appointmentId", "giftCardId", note, "createdBy") VALUES (${newId()}, ${businessId}, ${a.clientId ?? null}, 'GIFT_REDEEM', ${n2(parts.giftAmount)}, ${a.id}, ${parts.giftCardId}, 'დასრულების გაუქმება', ${actorUserId})`;
  }
  if (parts.clientMembershipId && parts.membershipAmount > 0) {
    if (parts.membershipVisits > 0) await tx.$executeRaw`UPDATE "BookClientMembership" SET "visitsLeft" = COALESCE("visitsLeft", 0) + ${Number(parts.membershipVisits)}, status = CASE WHEN status = 'USED' THEN 'ACTIVE' ELSE status END, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${parts.clientMembershipId}`;
    else await tx.$executeRaw`UPDATE "BookClientMembership" SET "amountLeft" = COALESCE("amountLeft", 0) + ${n2(parts.membershipAmount)}, status = CASE WHEN status = 'USED' THEN 'ACTIVE' ELSE status END, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${parts.clientMembershipId}`;
    await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "appointmentId", "clientMembershipId", note, "createdBy") VALUES (${newId()}, ${businessId}, ${a.clientId ?? null}, 'MEMBERSHIP_USE', ${n2(parts.membershipAmount)}, ${a.id}, ${parts.clientMembershipId}, 'დასრულების გაუქმება', ${actorUserId})`;
  }
  if (a.clientId) {
    const delta = n2((parts.bonusAmount || 0) - (parts.bonusEarned || 0) - (parts.welcomeBonus || 0));
    if (delta) {
      await tx.$executeRaw`UPDATE "BookClient" SET "bonusBalance" = GREATEST(0, "bonusBalance" + ${delta}), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${a.clientId}`;
      await tx.$executeRaw`INSERT INTO "BookLoyaltyLedger" (id, "businessId", "clientId", kind, amount, "appointmentId", note, "createdBy") VALUES (${newId()}, ${businessId}, ${a.clientId}, 'BONUS_ADJUST', ${delta}, ${a.id}, 'დასრულების გაუქმება', ${actorUserId})`;
    }
  }
  await tx.$executeRaw`UPDATE "BookAppointment" SET "paidParts" = NULL WHERE id = ${a.id}`;
  return parts;
}

/** The loyalty page's numbers: liability in bonus, live gift balance, live passes, this month's movements. */
export async function loyaltyOverview(businessId, { now = new Date() } = {}, db = prisma) {
  const today = tbilisiYmd(now);
  const since = new Date(now.getTime() - 30 * 86400_000);
  const [[bonus], [gifts], [passes], ledger] = await Promise.all([
    db.$queryRaw`SELECT COALESCE(SUM("bonusBalance"), 0)::float AS total, COUNT(*) FILTER (WHERE "bonusBalance" > 0)::int AS clients FROM "BookClient" WHERE "businessId" = ${businessId}`,
    db.$queryRaw`SELECT COUNT(*)::int AS n, COALESCE(SUM(balance), 0)::float AS balance FROM "BookGiftCard" WHERE "businessId" = ${businessId} AND status = 'ACTIVE' AND ("expiresOn" IS NULL OR "expiresOn" >= ${today})`,
    db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookClientMembership" WHERE "businessId" = ${businessId} AND status = 'ACTIVE' AND "endsOn" >= ${today}`,
    db.$queryRaw`SELECT l.*, c.name AS "clientName" FROM "BookLoyaltyLedger" l LEFT JOIN "BookClient" c ON c.id = l."clientId" WHERE l."businessId" = ${businessId} AND l."createdAt" >= ${since} ORDER BY l."createdAt" DESC LIMIT 100`,
  ]);
  const sum = (kind) => n2(ledger.filter((r) => r.kind === kind).reduce((s, r) => s + Number(r.amount), 0));
  return {
    bonus: { liability: n2(bonus?.total ?? 0), clients: bonus?.clients ?? 0, earned30: sum('BONUS_EARN'), redeemed30: Math.abs(sum('BONUS_REDEEM')) },
    giftCards: { active: gifts?.n ?? 0, balance: n2(gifts?.balance ?? 0), sold30: sum('GIFT_SOLD') },
    memberships: { active: passes?.n ?? 0, sold30: sum('MEMBERSHIP_SOLD') },
    ledger: ledger.map(ledgerPublic),
  };
}

/** For the app: the viewer's bonus and live passes at one business. */
export async function viewerLoyalty({ businessId, userId }, db = prisma) {
  if (!userId) return null;
  const [client] = await db.$queryRaw`SELECT id, "bonusBalance" FROM "BookClient" WHERE "businessId" = ${businessId} AND "userId" = ${userId}`;
  if (!client) return null;
  const today = tbilisiYmd();
  const rows = await db.$queryRaw`SELECT * FROM "BookClientMembership" WHERE "businessId" = ${businessId} AND "clientId" = ${client.id} AND status = 'ACTIVE' AND "endsOn" >= ${today} ORDER BY "endsOn"`;
  return { bonusBalance: Number(client.bonusBalance ?? 0), memberships: rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, visitsLeft: r.visitsLeft == null ? null : Number(r.visitsLeft), amountLeft: r.amountLeft == null ? null : Number(r.amountLeft), endsOn: r.endsOn })) };
}
