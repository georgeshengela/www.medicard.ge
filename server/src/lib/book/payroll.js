/**
 * MEDIBOOK payroll: pay rules per person — a share of the value of the visits they did, a share of the products they
 * sold, a fixed monthly amount (any mix) — the report for a period (what each person earned, what was already
 * paid, the balance) and payouts, each an expense (category SALARY) for that person.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, newId } from './catalog.js';
import { addDaysYmd, daysBetweenYmd, isYmd, tbilisiInstant, tbilisiYmd } from './time.js';

const sql = Prisma.sql;
const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const cleanText = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const MONEY_METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];

export const DEFAULT_PAY = Object.freeze({ servicePercent: 0, productPercent: 0, fixedMonthly: 0 });

/** Pure: the rules as stored; percents 0–100, the fixed amount ≥ 0. */
export function normalizePay(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const pct = (v) => Math.max(0, Math.min(100, n2(v)));
  return { servicePercent: pct(p.servicePercent), productPercent: pct(p.productPercent), fixedMonthly: Math.max(0, n2(p.fixedMonthly)) };
}

/** Pure: what a person earned over a period from these numbers. The fixed amount is pro-rated by days / 30. */
export function earnedFor(pay, { serviceValue = 0, productRevenue = 0, days = 30 }) {
  const p = normalizePay(pay);
  const fromServices = n2((serviceValue * p.servicePercent) / 100);
  const fromProducts = n2((productRevenue * p.productPercent) / 100);
  const fixed = n2((p.fixedMonthly * Math.max(1, days)) / 30);
  return { fromServices, fromProducts, fixed, total: n2(fromServices + fromProducts + fixed) };
}

export async function setPay({ businessId, staffId, pay }, db = prisma) {
  const next = normalizePay(pay);
  const n = await db.$executeRaw`UPDATE "BookStaff" SET pay = ${JSON.stringify(next)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${String(staffId)} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Person not found.');
  return next;
}

/** A period from YMD bounds (inclusive), default this month. */
export function periodBounds({ from = null, to = null, now = new Date() } = {}) {
  const today = tbilisiYmd(now);
  const f = isYmd(from) ? from : `${today.slice(0, 8)}01`;
  const t = isYmd(to) ? to : today;
  if (t < f) throw bookError(400, 'ბოლო დღე პირველზე ადრეა.', 'BAD_RANGE', 'The last day is before the first one.');
  if (daysBetweenYmd(f, t) > 366) throw bookError(400, 'პერიოდი მაქსიმუმ ერთი წელია.', 'RANGE_TOO_LONG', 'The period is at most a year.');
  return { from: f, to: t, fromAt: tbilisiInstant(f, 0), toAt: tbilisiInstant(addDaysYmd(t, 1), 0), days: daysBetweenYmd(f, t) + 1 };
}

/**
 * Per person for the period: completed visits and their value (money + gift card + membership, bonus excluded),
 * product sales they made, the rules, what that earns, what was paid for days inside the period, the balance.
 */
export async function payrollReport({ businessId, from = null, to = null, now = new Date() }, db = prisma) {
  const p = periodBounds({ from, to, now });
  const [staff, visits, sales, payouts] = await Promise.all([
    db.$queryRaw`SELECT id, name, title, color, pay, active FROM "BookStaff" WHERE "businessId" = ${businessId} ORDER BY active DESC, "sortOrder", name`,
    db.$queryRaw`SELECT "staffId", COUNT(*)::int AS n, COALESCE(SUM(COALESCE(("paidParts"->>'cashAmount')::numeric, "paidAmount", price, 0) + COALESCE(("paidParts"->>'giftAmount')::numeric, 0) + COALESCE(("paidParts"->>'membershipAmount')::numeric, 0)), 0)::float AS value
      FROM "BookAppointment" WHERE "businessId" = ${businessId} AND status = 'COMPLETED' AND "staffId" IS NOT NULL AND "startsAt" >= ${p.fromAt} AND "startsAt" < ${p.toAt} GROUP BY "staffId"`,
    db.$queryRaw`SELECT "staffId", COUNT(*)::int AS n, COALESCE(SUM(total), 0)::float AS revenue FROM "BookSale" WHERE "businessId" = ${businessId} AND status = 'DONE' AND "staffId" IS NOT NULL AND at >= ${p.fromAt} AND at < ${p.toAt} GROUP BY "staffId"`,
    db.$queryRaw`SELECT * FROM "BookPayout" WHERE "businessId" = ${businessId} AND "periodTo" >= ${p.from} AND "periodFrom" <= ${p.to} ORDER BY "createdAt" DESC`,
  ]);
  const vBy = new Map(visits.map((r) => [r.staffId, r]));
  const sBy = new Map(sales.map((r) => [r.staffId, r]));
  const rows = staff.map((s) => {
    const v = vBy.get(s.id);
    const sl = sBy.get(s.id);
    const pay = normalizePay(s.pay);
    const earned = earnedFor(pay, { serviceValue: Number(v?.value ?? 0), productRevenue: Number(sl?.revenue ?? 0), days: p.days });
    const paid = n2(payouts.filter((x) => x.staffId === s.id).reduce((sum, x) => sum + Number(x.amount), 0));
    return { id: s.id, name: s.name, title: s.title ?? null, color: s.color ?? null, active: Boolean(s.active), pay, visits: v?.n ?? 0, serviceValue: n2(v?.value ?? 0), sales: sl?.n ?? 0, productRevenue: n2(sl?.revenue ?? 0), earned, paid, balance: n2(earned.total - paid) };
  }).filter((r) => r.active || r.visits || r.sales || r.paid);
  const sum = (f) => n2(rows.reduce((s, r) => s + f(r), 0));
  return {
    from: p.from, to: p.to, days: p.days, staff: rows,
    totals: { visits: rows.reduce((s, r) => s + r.visits, 0), serviceValue: sum((r) => r.serviceValue), productRevenue: sum((r) => r.productRevenue), earned: sum((r) => r.earned.total), paid: sum((r) => r.paid), balance: sum((r) => r.balance) },
    payouts: payouts.map(payoutPublic),
  };
}

export function payoutPublic(r) {
  return { id: r.id, staffId: r.staffId, staffName: r.staffName ?? undefined, periodFrom: r.periodFrom, periodTo: r.periodTo, amount: Number(r.amount), method: r.method ?? null, note: r.note ?? null, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt };
}

/** A payout: the row plus an expense (SALARY) for that person, dated today. */
export async function createPayout({ businessId, staffId, periodFrom, periodTo, amount, method = 'TRANSFER', note = null, actorUserId = null, now = new Date() }, db = prisma) {
  const amt = n2(amount);
  if (!(amt > 0)) throw bookError(400, 'მიუთითე თანხა.', 'AMOUNT_REQUIRED', 'Enter the amount.');
  const p = periodBounds({ from: periodFrom, to: periodTo, now });
  const [s] = await db.$queryRaw`SELECT id, name FROM "BookStaff" WHERE id = ${String(staffId)} AND "businessId" = ${businessId}`;
  if (!s) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Person not found.');
  const m = MONEY_METHODS.includes(method) ? method : 'TRANSFER';
  return db.$transaction(async (tx) => {
    const txId = newId();
    await tx.$executeRaw`INSERT INTO "BookTransaction" (id, "businessId", "staffId", kind, category, amount, method, note, at, "createdBy") VALUES (${txId}, ${businessId}, ${s.id}, 'EXPENSE', 'SALARY', ${amt}, ${m}, ${`ხელფასი: ${s.name} (${p.from} – ${p.to})`}, ${now}, ${actorUserId})`;
    const id = newId();
    await tx.$executeRaw`INSERT INTO "BookPayout" (id, "businessId", "staffId", "periodFrom", "periodTo", amount, method, note, "transactionId", "createdBy") VALUES (${id}, ${businessId}, ${s.id}, ${p.from}, ${p.to}, ${amt}, ${m}, ${cleanText(note, 300)}, ${txId}, ${actorUserId})`;
    const [row] = await tx.$queryRaw`SELECT po.*, st.name AS "staffName" FROM "BookPayout" po JOIN "BookStaff" st ON st.id = po."staffId" WHERE po.id = ${id}`;
    return payoutPublic(row);
  });
}

export async function deletePayout({ businessId, id }, db = prisma) {
  return db.$transaction(async (tx) => {
    const [po] = await tx.$queryRaw`SELECT * FROM "BookPayout" WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
    if (!po) throw bookError(404, 'გადახდა ვერ მოიძებნა.', 'PAYOUT_NOT_FOUND', 'Payout not found.');
    await tx.$executeRaw`DELETE FROM "BookPayout" WHERE id = ${po.id}`;
    if (po.transactionId) await tx.$executeRaw`DELETE FROM "BookTransaction" WHERE id = ${po.transactionId} AND "businessId" = ${businessId}`;
  });
}

export { sql };
