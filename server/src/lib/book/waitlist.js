/**
 * MEDIBOOK waiting list: a client wants a time that is not free yet — a range of days, parts of the day,
 * optionally one person. When a booking is cancelled or moved, time off is removed, or the five-minute pass
 * finds a gap, the first fitting slot is offered (status OFFERED, one push, then nothing for a day) with a
 * link straight into the booking flow on that day. A booking in the range closes the entry. Businesses see
 * the list, add walk-ins to it, offer a time by hand or book the client straight from it.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, imageUrl, newId, normalizePhone, normalizeSettings } from './catalog.js';
import { slotsForDay } from './availability.js';
import { addDaysYmd, clockToMinutes, daysBetweenYmd, isYmd, tbilisiInstant, tbilisiYmd } from './time.js';
import { businessRow, requireBusiness } from './store.js';
import { bundleOf, context, normalizeServiceIds, serviceRows, upsertClient } from './bookings.js';

const sql = Prisma.sql;
const joinSql = Prisma.join;
export const DAY_PARTS = ['MORNING', 'AFTERNOON', 'EVENING'];
export const OPEN_STATUSES = ['WAITING', 'OFFERED'];
const MAX_RANGE_DAYS = 60;
const MAX_OPEN_PER_USER = 10;
const RE_OFFER_HOURS = 24;

const cleanText = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const toIso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
const jsonList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })() : []);

/** Which part of the day a time belongs to (the app groups free times the same way). */
export function dayPartOf(minutes) {
  return minutes < 12 * 60 ? 'MORNING' : minutes < 17 * 60 ? 'AFTERNOON' : 'EVENING';
}

/** Wanted parts of the day; every part (or none) means no preference. */
export function normalizeDayParts(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const parts = DAY_PARTS.filter((p) => list.some((v) => String(v ?? '').trim().toUpperCase() === p));
  return parts.length === DAY_PARTS.length ? [] : parts;
}

const WAIT_SELECT = sql`SELECT w.*, s.name AS "staffName", s.color AS "staffColor", os.name AS "offeredStaffName",
  b.name AS "businessName", b."nameKa" AS "businessNameKa", b.slug AS "businessSlug", b.category AS "businessCategory", b.address AS "businessAddress", b."addressKa" AS "businessAddressKa",
  b.phone AS "businessPhone", b."logoImageId" AS "businessLogoImageId", b."coverImageId" AS "businessCoverImageId", b.settings AS "businessSettings"
  FROM "BookWaitlist" w JOIN "BookBusiness" b ON b.id = w."businessId" LEFT JOIN "BookStaff" s ON s.id = w."staffId" LEFT JOIN "BookStaff" os ON os.id = w."offeredStaffId"`;

export async function waitlistRow(id, db = prisma) {
  const [row] = await db.$queryRaw`${WAIT_SELECT} WHERE w.id = ${String(id ?? '')}`;
  return row ?? null;
}

export function waitlistPublic(row, { lang = 'ka' } = {}) {
  const ids = jsonList(row.serviceIds);
  return {
    id: row.id,
    businessId: row.businessId,
    business: row.businessName ? {
      id: row.businessId,
      slug: row.businessSlug ?? null,
      name: lang === 'ka' && row.businessNameKa ? row.businessNameKa : row.businessName,
      category: row.businessCategory ?? null,
      address: lang === 'ka' && row.businessAddressKa ? row.businessAddressKa : row.businessAddress ?? null,
      phone: row.businessPhone ?? null,
      logoUrl: imageUrl(row.businessLogoImageId),
      coverUrl: imageUrl(row.businessCoverImageId),
    } : undefined,
    serviceId: row.serviceId ?? null,
    serviceIds: ids.length ? ids : [row.serviceId].filter(Boolean),
    serviceName: row.serviceName,
    staffId: row.staffId ?? null,
    staffName: row.staffName ?? null,
    staffColor: row.staffColor ?? null,
    clientId: row.clientId ?? null,
    clientUserId: row.clientUserId ?? null,
    clientName: row.clientName,
    clientPhone: row.clientPhone ?? null,
    fromDate: row.fromDate,
    toDate: row.toDate,
    dayParts: jsonList(row.dayParts),
    note: row.note ?? null,
    status: row.status,
    source: row.source,
    offeredAt: toIso(row.offeredAt),
    offeredStartsAt: toIso(row.offeredStartsAt),
    offeredStaffId: row.offeredStaffId ?? null,
    offeredStaffName: row.offeredStaffName ?? null,
    offerCount: Number(row.offerCount ?? 0),
    appointmentId: row.appointmentId ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

/** The range a client may wait for: from today (or later) up to the business's horizon, at most 60 days. */
function rangeOf({ fromDate, toDate, settings, now }) {
  const today = tbilisiYmd(now);
  const from = isYmd(fromDate) && fromDate >= today ? fromDate : today;
  let to = isYmd(toDate) ? toDate : addDaysYmd(from, 14);
  if (to < from) throw bookError(400, 'ბოლო დღე პირველზე ადრეა.', 'BAD_RANGE', 'The last day is before the first one.');
  const horizon = addDaysYmd(today, settings.horizonDays);
  if (from > horizon) throw bookError(409, 'ასე შორს ჯერ არ იწერენ.', 'HORIZON', 'Bookings do not open that far ahead yet.');
  if (to > horizon) to = horizon;
  if (daysBetweenYmd(from, to) > MAX_RANGE_DAYS) to = addDaysYmd(from, MAX_RANGE_DAYS);
  return { from, to };
}

/** The chosen person, who must exist, take bookings and perform every service of the bundle. */
async function staffFor(businessId, staffId, serviceIds, db) {
  if (!staffId) return null;
  const [row] = await db.$queryRaw`SELECT * FROM "BookStaff" WHERE id = ${String(staffId)} AND "businessId" = ${businessId} AND active`;
  if (!row || row.bookable === false) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Person not found.');
  const ids = jsonList(row.serviceIds);
  if (ids.length && !serviceIds.every((id) => ids.includes(id))) throw bookError(409, 'ეს თანამშრომელი ყველა არჩეულ სერვისს არ ასრულებს.', 'STAFF_NOT_PERFORMING', 'This person does not perform every chosen service.');
  return row;
}

const serviceLabel = (services) => services.map((s) => s.nameKa || s.name).join(' + ');

/** A client joins (or refreshes their entry for the same services) from the app or the web. */
export async function join({ businessId, user, serviceIds, serviceId, staffId = null, fromDate = null, toDate = null, dayParts = [], note = null, source = 'APP', now = new Date() }, db = prisma) {
  const business = await requireBusiness(businessId, db);
  const settings = normalizeSettings(business.settings);
  if (business.status !== 'CLAIMED') throw bookError(409, 'ეს ბიზნესი ჯერ არ იღებს ონლაინ ჯავშნებს — დარეკე.', 'NOT_BOOKABLE', 'This business does not take online bookings yet — give them a call.');
  if (!settings.onlineBooking) throw bookError(409, 'ონლაინ ჯავშნა ამ ბიზნესში ამჟამად გამორთულია.', 'ONLINE_OFF', 'Online booking is turned off at this business right now.');
  const services = await serviceRows(business.id, normalizeServiceIds(serviceIds, serviceId), db);
  if (services.some((s) => !s.online)) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
  const ids = services.map((s) => s.id);
  const staff = await staffFor(business.id, staffId, ids, db);
  const { from, to } = rangeOf({ fromDate, toDate, settings, now });
  const phone = normalizePhone(user?.phone);
  if (!phone) throw bookError(403, 'მოლოდინის სიისთვის ტელეფონის ნომერი საჭიროა — ბიზნესი ასე დაგიკავშირდება.', 'PHONE_VERIFICATION_REQUIRED', 'A phone number is needed for the waiting list — this is how the business reaches you.');
  const name = cleanText(user?.fullName, 120) ?? 'კლიენტი';
  const parts = normalizeDayParts(dayParts);
  return db.$transaction(async (tx) => {
    const clientId = await upsertClient(tx, { businessId: business.id, userId: user.id, name, phone });
    const [same] = await tx.$queryRaw`SELECT id FROM "BookWaitlist" WHERE "businessId" = ${business.id} AND "clientUserId" = ${user.id} AND status IN ('WAITING', 'OFFERED') AND "serviceIds" = ${JSON.stringify(ids)}::jsonb LIMIT 1`;
    if (same) {
      await tx.$executeRaw`UPDATE "BookWaitlist" SET "staffId" = ${staff?.id ?? null}, "fromDate" = ${from}, "toDate" = ${to}, "dayParts" = ${JSON.stringify(parts)}::jsonb, note = ${cleanText(note, 300)}, status = 'WAITING', "offeredAt" = NULL, "offeredStartsAt" = NULL, "offeredStaffId" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${same.id}`;
      return { row: await waitlistRow(same.id, tx), created: false };
    }
    const [open] = await tx.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookWaitlist" WHERE "clientUserId" = ${user.id} AND status IN ('WAITING', 'OFFERED')`;
    if ((open?.n ?? 0) >= MAX_OPEN_PER_USER) throw bookError(409, 'მოლოდინის სიაში ერთდროულად მაქსიმუმ 10 ჩანაწერია.', 'TOO_MANY', 'At most 10 open waiting-list entries at a time.');
    const id = newId();
    await tx.$executeRaw`INSERT INTO "BookWaitlist" (id, "businessId", "clientUserId", "clientId", "clientName", "clientPhone", "serviceId", "serviceIds", "serviceName", "staffId", "fromDate", "toDate", "dayParts", note, status, source)
      VALUES (${id}, ${business.id}, ${user.id}, ${clientId}, ${name}, ${phone}, ${ids[0]}, ${JSON.stringify(ids)}::jsonb, ${serviceLabel(services)}, ${staff?.id ?? null}, ${from}, ${to}, ${JSON.stringify(parts)}::jsonb, ${cleanText(note, 300)}, 'WAITING', ${source})`;
    return { row: await waitlistRow(id, tx), created: true };
  });
}

/** The business adds a walk-in (any client name / phone, any active service, any range up to 180 days). */
export async function addByBusiness({ businessId, clientId = null, clientName = null, clientPhone = null, serviceIds, serviceId, staffId = null, fromDate = null, toDate = null, dayParts = [], note = null, now = new Date() }, db = prisma) {
  const business = await requireBusiness(businessId, db);
  const settings = normalizeSettings(business.settings);
  const services = await serviceRows(business.id, normalizeServiceIds(serviceIds, serviceId), db);
  const ids = services.map((s) => s.id);
  const staff = await staffFor(business.id, staffId, ids, db);
  const { from, to } = rangeOf({ fromDate, toDate, settings: { ...settings, horizonDays: 180 }, now });
  let client = null;
  if (clientId) {
    const [c] = await db.$queryRaw`SELECT * FROM "BookClient" WHERE id = ${String(clientId)} AND "businessId" = ${business.id}`;
    if (!c) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
    client = c;
  }
  const name = cleanText(clientName, 120) ?? client?.name ?? null;
  if (!name) throw bookError(400, 'მიუთითე კლიენტის სახელი.', 'NAME_REQUIRED', 'Enter the client name.');
  const phone = normalizePhone(clientPhone) ?? client?.phone ?? null;
  const id = newId();
  return db.$transaction(async (tx) => {
    const cid = client ? client.id : await upsertClient(tx, { businessId: business.id, userId: null, name, phone });
    await tx.$executeRaw`INSERT INTO "BookWaitlist" (id, "businessId", "clientUserId", "clientId", "clientName", "clientPhone", "serviceId", "serviceIds", "serviceName", "staffId", "fromDate", "toDate", "dayParts", note, status, source)
      VALUES (${id}, ${business.id}, ${client?.userId ?? null}, ${cid}, ${name}, ${phone}, ${ids[0]}, ${JSON.stringify(ids)}::jsonb, ${serviceLabel(services)}, ${staff?.id ?? null}, ${from}, ${to}, ${JSON.stringify(normalizeDayParts(dayParts))}::jsonb, ${cleanText(note, 300)}, 'WAITING', 'BUSINESS')`;
    return waitlistRow(id, tx);
  });
}

export async function listMine(userId, { lang = 'ka' } = {}, db = prisma) {
  const rows = await db.$queryRaw`${WAIT_SELECT} WHERE w."clientUserId" = ${userId} AND w."updatedAt" > NOW() - INTERVAL '90 days' ORDER BY (w.status IN ('WAITING', 'OFFERED')) DESC, w."createdAt" DESC LIMIT 100`;
  return rows.map((r) => waitlistPublic(r, { lang }));
}

export async function listForBusiness(businessId, { status = 'open', limit = 500 } = {}, db = prisma) {
  const where = status === 'open' ? sql`AND w.status IN ('WAITING', 'OFFERED')` : status && status !== 'all' ? sql`AND w.status = ${String(status)}` : Prisma.empty;
  const n = Math.min(1000, Math.max(1, Number(limit) || 500));
  const rows = await db.$queryRaw`${WAIT_SELECT} WHERE w."businessId" = ${businessId} ${where} ORDER BY (w.status IN ('WAITING', 'OFFERED')) DESC, w."fromDate" ASC, w."createdAt" ASC LIMIT ${n}`;
  const [count] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookWaitlist" w WHERE w."businessId" = ${businessId} ${where}`;
  return { entries: rows.map((r) => waitlistPublic(r)), total: count?.n ?? rows.length };
}

export async function countOpen(businessId, db = prisma) {
  const [r] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookWaitlist" WHERE "businessId" = ${businessId} AND status IN ('WAITING', 'OFFERED')`;
  return r?.n ?? 0;
}

export async function cancelMine({ id, userId }, db = prisma) {
  const row = await waitlistRow(id, db);
  if (!row || row.clientUserId !== userId) throw bookError(404, 'ჩანაწერი ვერ მოიძებნა.', 'WAITLIST_NOT_FOUND', 'Entry not found.');
  if (OPEN_STATUSES.includes(row.status)) await db.$executeRaw`UPDATE "BookWaitlist" SET status = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}`;
  return waitlistRow(row.id, db);
}

/** The business: a note, cancel, put back to waiting, mark booked (with the appointment), or offer one time by hand. */
export async function updateByBusiness({ businessId, id, patch = {}, now = new Date() }, db = prisma) {
  const row = await waitlistRow(id, db);
  if (!row || row.businessId !== businessId) throw bookError(404, 'ჩანაწერი ვერ მოიძებნა.', 'WAITLIST_NOT_FOUND', 'Entry not found.');
  const sets = [];
  if (patch.note !== undefined) sets.push(sql`note = ${cleanText(patch.note, 300)}`);
  if (patch.status === 'CANCELLED') sets.push(sql`status = 'CANCELLED'`);
  if (patch.status === 'WAITING') sets.push(sql`status = 'WAITING'`, sql`"offeredAt" = NULL`, sql`"offeredStartsAt" = NULL`, sql`"offeredStaffId" = NULL`);
  if (patch.status === 'BOOKED') sets.push(sql`status = 'BOOKED'`, sql`"appointmentId" = ${patch.appointmentId ?? null}`);
  if (patch.offer) {
    const at = new Date(patch.offer.startsAt);
    if (Number.isNaN(at.getTime())) throw bookError(400, 'არასწორი დრო.', 'BAD_TIME', 'Invalid time.');
    sets.push(sql`status = 'OFFERED'`, sql`"offeredAt" = ${now}`, sql`"offeredStartsAt" = ${at}`, sql`"offeredStaffId" = ${patch.offer.staffId ?? null}`, sql`"offerCount" = "offerCount" + 1`);
  }
  if (!sets.length) return row;
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  await db.$executeRaw`UPDATE "BookWaitlist" SET ${joinSql(sets, ', ')} WHERE id = ${row.id}`;
  return waitlistRow(row.id, db);
}

export async function remove({ businessId, id }, db = prisma) {
  await db.$executeRaw`DELETE FROM "BookWaitlist" WHERE id = ${String(id ?? '')} AND "businessId" = ${businessId}`;
}

/**
 * A booking on a day inside the range closes the client's open entries at that business that asked for one
 * of the booked services (a manicure booked while waiting for a haircut leaves the haircut entry open). Returns how many.
 */
export async function markBooked({ businessId, userId = null, clientId = null, appointmentId, startsAt, serviceIds = [] }, db = prisma) {
  if (!userId && !clientId) return 0;
  const day = tbilisiYmd(new Date(startsAt));
  const who = userId && clientId ? sql`("clientUserId" = ${userId} OR "clientId" = ${clientId})` : userId ? sql`"clientUserId" = ${userId}` : sql`"clientId" = ${clientId}`;
  const rows = await db.$queryRaw`SELECT id, "serviceId", "serviceIds" FROM "BookWaitlist" WHERE "businessId" = ${businessId} AND status IN ('WAITING', 'OFFERED') AND ${who} AND "fromDate" <= ${day} AND "toDate" >= ${day}`;
  const booked = new Set((serviceIds ?? []).filter(Boolean));
  const hit = rows.filter((r) => {
    const wanted = jsonList(r.serviceIds).length ? jsonList(r.serviceIds) : [r.serviceId].filter(Boolean);
    return !booked.size || !wanted.length || wanted.some((id) => booked.has(id));
  }).map((r) => r.id);
  if (!hit.length) return 0;
  return db.$executeRaw`UPDATE "BookWaitlist" SET status = 'BOOKED', "appointmentId" = ${appointmentId}, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${joinSql(hit)})`;
}

export async function expireOld({ now = new Date() } = {}, db = prisma) {
  return db.$executeRaw`UPDATE "BookWaitlist" SET status = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP WHERE status IN ('WAITING', 'OFFERED') AND "toDate" < ${tbilisiYmd(now)}`;
}

/** Businesses with entries worth matching on the periodic pass (open, and not offered within the last day). */
export async function sweepBusinesses({ now = new Date(), limit = 50 } = {}, db = prisma) {
  const since = new Date(now.getTime() - RE_OFFER_HOURS * 3600_000);
  const rows = await db.$queryRaw`SELECT DISTINCT "businessId" FROM "BookWaitlist" WHERE (status = 'WAITING' OR (status = 'OFFERED' AND "offeredAt" < ${since})) AND "toDate" >= ${tbilisiYmd(now)} LIMIT ${limit}`;
  return rows.map((r) => r.businessId);
}

/**
 * For the given days: every open entry whose range covers the day and whose bundle has a free slot in a
 * wanted part of the day gets an offer — status OFFERED and the first fitting slot remembered. An entry
 * offered within the last day is left alone, so nobody is pushed twice for one gap, and two waiting
 * clients are never offered the same minute in one pass. Returns [{ row, slot, date }] for the caller to push.
 */
export async function matchOpenings({ businessId, dates, now = new Date(), minAgeMs = 0 }, db = prisma) {
  const today = tbilisiYmd(now);
  const days = [...new Set((dates ?? []).filter(isYmd))].filter((d) => d >= today).sort();
  if (!days.length) return [];
  const business = await businessRow(businessId, db);
  if (!business || business.status !== 'CLAIMED') return [];
  const since = new Date(now.getTime() - RE_OFFER_HOURS * 3600_000);
  const bornBefore = new Date(now.getTime() - minAgeMs);
  const rows = await db.$queryRaw`${WAIT_SELECT} WHERE w."businessId" = ${businessId} AND w."fromDate" <= ${days[days.length - 1]} AND w."toDate" >= ${days[0]}
    AND (w.status = 'WAITING' OR (w.status = 'OFFERED' AND w."offeredAt" < ${since})) AND w."createdAt" <= ${bornBefore} ORDER BY w."createdAt" ASC LIMIT 200`;
  if (!rows.length) return [];
  const offers = [];
  const bundles = new Map();
  for (const date of days) {
    const ctx = await context({ businessId, from: tbilisiInstant(addDaysYmd(date, -1), 0), to: tbilisiInstant(addDaysYmd(date, 2), 0) }, db);
    const used = new Set();
    for (const row of rows) {
      if (offers.some((o) => o.row.id === row.id)) continue;
      if (row.fromDate > date || row.toDate < date) continue;
      const ids = jsonList(row.serviceIds).length ? jsonList(row.serviceIds) : [row.serviceId].filter(Boolean);
      const key = ids.join(',');
      if (!bundles.has(key)) {
        try { bundles.set(key, bundleOf(await serviceRows(businessId, ids, db), ctx.links, ctx.scheduledServiceIds)); } catch { bundles.set(key, null); }
      }
      const bundle = bundles.get(key);
      if (!bundle) continue;
      // A freed seat in a class is an opening like any other: the join slot carries the class.
      const result = slotsForDay({ business, service: bundle, staff: ctx.staff, appointments: ctx.appointments, timeOff: ctx.timeOff, resources: ctx.resources, classes: ctx.classes, date, now, staffId: row.staffId || null });
      const parts = jsonList(row.dayParts);
      const slot = result.slots.find((s) => (!parts.length || parts.includes(dayPartOf(clockToMinutes(s.time)))) && !used.has(s.startsAt));
      if (!slot) continue;
      used.add(slot.startsAt);
      const staffId = row.staffId || (slot.staffIds.length === 1 ? slot.staffIds[0] : null);
      await db.$executeRaw`UPDATE "BookWaitlist" SET status = 'OFFERED', "offeredAt" = ${now}, "offeredStartsAt" = ${new Date(slot.startsAt)}, "offeredStaffId" = ${staffId}, "offerCount" = "offerCount" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}`;
      offers.push({ row: { ...row, status: 'OFFERED', offeredStartsAt: slot.startsAt, offeredStaffId: staffId }, slot, date });
    }
  }
  return offers;
}
