/**
 * MEDIBOOK database layer, part 2 — availability, appointments, the client book, reviews, discounts,
 * money and the raw numbers for analytics. Every booking write runs under a per-business advisory
 * lock, so two people can never take the same minute of the same person.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, businessCard, discountApplies, discountPublic, discountedPrice, imageUrl, newId, normalizePhone, normalizeSettings } from './catalog.js';
import { canCancelFree, daysWithSlots, findConflict, isOfferedSlot, slotsForDay } from './availability.js';
import { addDaysYmd, isYmd, tbilisiInstant, tbilisiYmd } from './time.js';
import { businessRow, requireBusiness } from './store.js';
import * as loyalty from './loyalty.js';
import * as supplies from './supplies.js';

const sql = Prisma.sql;
const join = Prisma.join;
const empty = Prisma.empty;
const MIN = 60_000;
const OPEN_STATUSES = ['PENDING', 'CONFIRMED'];

const cleanText = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const money = (v) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v) * 100) / 100) : null);

// ——— availability ———

/** Staff, live appointments and time off of a business in a window — what the availability engine reads. */
export async function context({ businessId, from, to }, db) {
  const [staff, appointments, timeOff] = await Promise.all([
    db.$queryRaw`SELECT * FROM "BookStaff" WHERE "businessId" = ${businessId} AND active`,
    db.$queryRaw`SELECT id, "staffId", status, "startsAt", "endsAt" FROM "BookAppointment" WHERE "businessId" = ${businessId} AND status <> 'CANCELLED' AND "endsAt" > ${from} AND "startsAt" < ${to}`,
    db.$queryRaw`SELECT "staffId", "startsAt", "endsAt" FROM "BookTimeOff" WHERE "businessId" = ${businessId} AND "endsAt" > ${from} AND "startsAt" < ${to}`,
  ]);
  return { staff, appointments: appointments.map((a) => ({ ...a, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString() })), timeOff: timeOff.map((o) => ({ ...o, startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString() })) };
}

export async function serviceRow(businessId, serviceId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "BookService" WHERE id = ${String(serviceId ?? '')} AND "businessId" = ${businessId}`;
  return row ?? null;
}

/** One service id or several (`serviceIds` wins), de-duplicated, at most 8. */
export function normalizeServiceIds(serviceIds, serviceId) {
  const list = Array.isArray(serviceIds) ? serviceIds : typeof serviceIds === 'string' ? serviceIds.split(',') : [];
  const ids = [...new Set(list.map((v) => String(v ?? '').trim()).filter(Boolean))];
  if (!ids.length && serviceId) ids.push(String(serviceId));
  return ids.slice(0, 8);
}

/** The services of a booking in the order asked for; every id must exist and be active. */
export async function serviceRows(businessId, ids, db = prisma) {
  if (!ids.length) throw bookError(400, 'აირჩიე სერვისი.', 'SERVICE_REQUIRED', 'Pick a service.');
  const rows = await db.$queryRaw`SELECT * FROM "BookService" WHERE "businessId" = ${businessId} AND id IN (${join(ids)})`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = ids.map((id) => byId.get(id));
  if (out.some((r) => !r || !r.active)) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
  return out;
}

/** What the availability engine sees: one service, or the bundle as one block of time. */
export function bundleOf(services) {
  const first = services[0];
  return {
    id: first.id,
    ids: services.map((s) => s.id),
    durationMin: services.reduce((sum, s) => sum + Number(s.durationMin), 0),
    bufferMin: Number(services[services.length - 1].bufferMin ?? 0),
  };
}

/** Slots of one day for a service (and optionally one person). */
export async function availability({ businessId, serviceId, serviceIds, date, staffId = null, now = new Date(), ignoreLead = false }, db = prisma) {
  if (!isYmd(date)) throw bookError(400, 'არასწორი თარიღი.', 'BAD_DATE', 'Invalid date.');
  const business = await requireBusiness(businessId, db);
  const services = await serviceRows(business.id, normalizeServiceIds(serviceIds, serviceId), db);
  const service = bundleOf(services);
  const from = tbilisiInstant(addDaysYmd(date, -1), 0);
  const to = tbilisiInstant(addDaysYmd(date, 2), 0);
  const ctx = await context({ businessId: business.id, from, to }, db);
  const result = slotsForDay({ business, service, staff: ctx.staff, appointments: ctx.appointments, timeOff: ctx.timeOff, date, now, staffId, ignoreLead });
  return { date, serviceId: service.id, serviceIds: service.ids, durationMin: service.durationMin, ...result };
}

/** Which of the next `days` days have a free slot (the date strip). */
export async function dateStrip({ businessId, serviceId, serviceIds, from = null, staffId = null, now = new Date(), days = 14 }, db = prisma) {
  const business = await requireBusiness(businessId, db);
  const service = bundleOf(await serviceRows(business.id, normalizeServiceIds(serviceIds, serviceId), db));
  const start = from && isYmd(from) ? from : tbilisiYmd(now);
  const n = Math.min(60, Math.max(1, Number(days) || 14));
  const ctx = await context({ businessId: business.id, from: tbilisiInstant(addDaysYmd(start, -1), 0), to: tbilisiInstant(addDaysYmd(start, n + 1), 0) }, db);
  return { from: start, days: daysWithSlots({ business, service, staff: ctx.staff, appointments: ctx.appointments, timeOff: ctx.timeOff, from: start, now, staffId, days: n }) };
}

// ——— appointments ———

export function appointmentPublic(row, { lang = 'ka', now = new Date() } = {}) {
  const settings = normalizeSettings(row.businessSettings ?? row.settings ?? {});
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
      lat: row.businessLat == null ? null : Number(row.businessLat),
      lng: row.businessLng == null ? null : Number(row.businessLng),
      logoUrl: imageUrl(row.businessLogoImageId),
      coverUrl: imageUrl(row.businessCoverImageId),
    } : undefined,
    serviceId: row.serviceId ?? null,
    serviceName: row.serviceName,
    services: Array.isArray(row.items) && row.items.length
      ? row.items.map((i) => ({ id: i.id ?? null, name: i.name, durationMin: Number(i.durationMin), price: i.price == null ? null : Number(i.price), discountAmount: i.discountAmount == null ? null : Number(i.discountAmount) }))
      : [{ id: row.serviceId ?? null, name: row.serviceName, durationMin: Number(row.durationMin), price: row.price == null ? null : Number(row.price), discountAmount: row.discountAmount == null ? null : Number(row.discountAmount) }],
    staffId: row.staffId ?? null,
    staffName: row.staffName ?? null,
    staffColor: row.staffColor ?? null,
    clientId: row.clientId ?? null,
    clientUserId: row.clientUserId ?? null,
    clientName: row.clientName,
    clientPhone: row.clientPhone ?? null,
    startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt,
    endsAt: row.endsAt instanceof Date ? row.endsAt.toISOString() : row.endsAt,
    durationMin: Number(row.durationMin),
    status: row.status,
    source: row.source,
    price: row.price == null ? null : Number(row.price),
    discountAmount: row.discountAmount == null ? null : Number(row.discountAmount),
    paidAmount: row.paidAmount == null ? null : Number(row.paidAmount),
    paidMethod: row.paidMethod ?? null,
    paidParts: row.paidParts && typeof row.paidParts === 'object' ? row.paidParts : null,
    note: row.note ?? null,
    internalNote: row.internalNote ?? null,
    cancelledBy: row.cancelledBy ?? null,
    cancelReason: row.cancelReason ?? null,
    reviewed: Boolean(row.reviewedAt),
    canCancelFree: OPEN_STATUSES.includes(row.status) && canCancelFree(row, settings, now),
    cancelHours: settings.cancelHours,
    createdAt: row.createdAt,
  };
}

const ITEMS_JSON = sql`(SELECT COALESCE(json_agg(json_build_object('id', i."serviceId", 'name', i."serviceName", 'durationMin', i."durationMin", 'price', i.price, 'discountAmount', i."discountAmount") ORDER BY i."sortOrder"), '[]'::json) FROM "BookAppointmentItem" i WHERE i."appointmentId" = a.id)`;
const APPOINTMENT_SELECT = sql`SELECT a.*, s.name AS "staffName", s.color AS "staffColor", ${ITEMS_JSON} AS items,
  b.name AS "businessName", b."nameKa" AS "businessNameKa", b.slug AS "businessSlug", b.category AS "businessCategory", b.address AS "businessAddress", b."addressKa" AS "businessAddressKa",
  b.phone AS "businessPhone", b.lat AS "businessLat", b.lng AS "businessLng", b."logoImageId" AS "businessLogoImageId", b."coverImageId" AS "businessCoverImageId", b.settings AS "businessSettings"
  FROM "BookAppointment" a JOIN "BookBusiness" b ON b.id = a."businessId" LEFT JOIN "BookStaff" s ON s.id = a."staffId"`;

export async function appointmentRow(id, db = prisma) {
  const [row] = await db.$queryRaw`${APPOINTMENT_SELECT} WHERE a.id = ${String(id ?? '')}`;
  return row ?? null;
}

/** Find or create the business's client row for a person / phone. */
export async function upsertClient(tx, { businessId, userId = null, name, phone = null, email = null }) {
  if (userId) {
    const [row] = await tx.$queryRaw`SELECT * FROM "BookClient" WHERE "businessId" = ${businessId} AND "userId" = ${userId}`;
    if (row) {
      await tx.$executeRaw`UPDATE "BookClient" SET name = COALESCE(${name ?? null}, name), phone = COALESCE(${phone ?? null}, phone), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}`;
      return row.id;
    }
    // A walk-in with the same phone becomes this account's row (the business keeps one history).
    if (phone) {
      const [byPhone] = await tx.$queryRaw`SELECT id FROM "BookClient" WHERE "businessId" = ${businessId} AND phone = ${phone} AND "userId" IS NULL LIMIT 1`;
      if (byPhone) {
        await tx.$executeRaw`UPDATE "BookClient" SET "userId" = ${userId}, name = ${name}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${byPhone.id}`;
        return byPhone.id;
      }
    }
  } else if (phone) {
    const [byPhone] = await tx.$queryRaw`SELECT id FROM "BookClient" WHERE "businessId" = ${businessId} AND phone = ${phone} LIMIT 1`;
    if (byPhone) return byPhone.id;
  }
  const id = newId();
  await tx.$executeRaw`INSERT INTO "BookClient" (id, "businessId", "userId", name, phone, email) VALUES (${id}, ${businessId}, ${userId}, ${name}, ${phone}, ${email})`;
  return id;
}

/** The best live discount for a service at an instant (largest amount off). */
async function bestDiscount(tx, { businessId, serviceId, price, at, code }) {
  const rows = await tx.$queryRaw`SELECT * FROM "BookDiscount" WHERE "businessId" = ${businessId} AND active`;
  let best = null;
  for (const d of rows) {
    if (!discountApplies(d, { serviceId, at, code })) continue;
    const { off } = discountedPrice(price, d);
    if (!best || off > best.off) best = { row: d, off };
  }
  return best;
}

/**
 * Book. `byBusiness` = the business books for a walk-in (any client name/phone, no lead time, PENDING never).
 * Returns the full appointment row (appointmentRow shape).
 */
export async function createAppointment({ businessId, serviceId, serviceIds, staffId = null, startsAt, note = null, source = 'APP', user = null, clientName = null, clientPhone = null, code = null, byBusiness = false, force = false, now = new Date() }, db = prisma) {
  const at = new Date(startsAt);
  if (Number.isNaN(at.getTime())) throw bookError(400, 'არასწორი დრო.', 'BAD_TIME', 'Invalid time.');
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}))`;
    const business = await businessRow(businessId, tx);
    if (!business) throw bookError(404, 'ბიზნესი ვერ მოიძებნა.', 'BUSINESS_NOT_FOUND', 'Business not found.');
    const settings = normalizeSettings(business.settings);
    if (!byBusiness) {
      if (business.status !== 'CLAIMED') throw bookError(409, 'ეს ბიზნესი ჯერ არ იღებს ონლაინ ჯავშნებს — დარეკე.', 'NOT_BOOKABLE', 'This business does not take online bookings yet — give them a call.');
      if (!settings.onlineBooking) throw bookError(409, 'ონლაინ ჯავშნა ამ ბიზნესში ამჟამად გამორთულია.', 'ONLINE_OFF', 'Online booking is turned off at this business right now.');
    }
    const services = await serviceRows(business.id, normalizeServiceIds(serviceIds, serviceId), tx);
    if (!byBusiness && services.some((x) => !x.online)) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
    const service = bundleOf(services);
    const date = tbilisiYmd(at);
    const ctx = await context({ businessId: business.id, from: tbilisiInstant(addDaysYmd(date, -1), 0), to: tbilisiInstant(addDaysYmd(date, 2), 0) }, tx);
    const offered = slotsForDay({ business, service, staff: ctx.staff, appointments: ctx.appointments, timeOff: ctx.timeOff, date, now, staffId: staffId || null, ignoreLead: byBusiness });
    let person = staffId || null;
    if (!force || !byBusiness) {
      if (!isOfferedSlot(offered, at, person)) {
        throw bookError(409, 'ეს დრო უკვე დაკავებულია ან აღარ არის თავისუფალი. აირჩიე სხვა დრო.', 'SLOT_TAKEN', 'This time was just taken or is no longer free. Pick another one.');
      }
      if (!person) {
        const slot = offered.slots.find((s) => s.startsAt === at.toISOString());
        // Anyone: the person with the fewest bookings that day, so work spreads evenly.
        const load = new Map(ctx.appointments.filter((a) => tbilisiYmd(new Date(a.startsAt)) === date).map((a) => a.staffId).reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map()));
        person = [...slot.staffIds].sort((x, y) => (load.get(x) ?? 0) - (load.get(y) ?? 0))[0] ?? null;
      }
    }
    const endsAt = new Date(at.getTime() + Number(service.durationMin) * MIN);
    if (person) {
      const clash = findConflict(ctx.appointments, { staffId: person, startsAt: at, endsAt, bufferMin: Number(service.bufferMin ?? 0) });
      if (clash && !(force && byBusiness)) throw bookError(409, 'ეს დრო უკვე დაკავებულია.', 'SLOT_TAKEN', 'This time is already taken.');
    }
    const name = cleanText(clientName, 120) ?? cleanText(user?.fullName, 120) ?? 'კლიენტი';
    const phone = normalizePhone(clientPhone) ?? normalizePhone(user?.phone);
    if (!byBusiness && !phone) throw bookError(403, 'ჯავშნისთვის ტელეფონის ნომერი საჭიროა — ბიზნესი ასე დაგიკავშირდება.', 'PHONE_VERIFICATION_REQUIRED', 'A phone number is needed to book — this is how the business reaches you.');
    const clientId = await upsertClient(tx, { businessId: business.id, userId: user?.id ?? null, name, phone });
    // Price and discount per service; the appointment row carries the totals.
    const items = [];
    for (const [idx, svc] of services.entries()) {
      const base = svc.price == null ? null : Number(svc.price);
      const best = base != null ? await bestDiscount(tx, { businessId: business.id, serviceId: svc.id, price: base, at, code }) : null;
      items.push({ id: newId(), serviceId: svc.id, serviceName: svc.nameKa || svc.name, durationMin: Number(svc.durationMin), price: best ? discountedPrice(base, best.row).price : base, discountId: best ? best.row.id : null, discountAmount: best ? best.off : null, sortOrder: idx });
    }
    const priced = items.filter((i) => i.price != null);
    const price = priced.length ? Math.round(priced.reduce((sum, i) => sum + i.price, 0) * 100) / 100 : null;
    const firstDiscount = items.find((i) => i.discountId) ?? null;
    const discountTotal = Math.round(items.reduce((sum, i) => sum + (i.discountAmount ?? 0), 0) * 100) / 100;
    const serviceLabel = items.map((i) => i.serviceName).join(' + ');
    const id = newId();
    const status = byBusiness || settings.autoConfirm ? 'CONFIRMED' : 'PENDING';
    await tx.$executeRaw`INSERT INTO "BookAppointment" (id, "businessId", "serviceId", "serviceName", "staffId", "clientId", "clientUserId", "clientName", "clientPhone", "startsAt", "endsAt", "durationMin", status, source, price, "discountId", "discountAmount", note)
      VALUES (${id}, ${business.id}, ${service.id}, ${serviceLabel}, ${person}, ${clientId}, ${user?.id ?? null}, ${name}, ${phone}, ${at}, ${endsAt}, ${Number(service.durationMin)}, ${status}, ${byBusiness ? 'BUSINESS' : source}, ${price}, ${firstDiscount?.discountId ?? null}, ${firstDiscount ? discountTotal : null}, ${cleanText(note, 500)})`;
    for (const it of items) {
      await tx.$executeRaw`INSERT INTO "BookAppointmentItem" (id, "appointmentId", "serviceId", "serviceName", "durationMin", price, "discountId", "discountAmount", "sortOrder") VALUES (${it.id}, ${id}, ${it.serviceId}, ${it.serviceName}, ${it.durationMin}, ${it.price}, ${it.discountId}, ${it.discountAmount}, ${it.sortOrder})`;
      if (it.discountId) await tx.$executeRaw`UPDATE "BookDiscount" SET "usedCount" = "usedCount" + 1 WHERE id = ${it.discountId}`;
    }
    await tx.$executeRaw`UPDATE "BookBusiness" SET "bookingCount" = "bookingCount" + 1 WHERE id = ${business.id}`;
    if (!byBusiness) await tx.$executeRaw`INSERT INTO "BookEvent" ("businessId", kind) VALUES (${business.id}, 'BOOK_DONE')`;
    return appointmentRow(id, tx);
  }, { timeout: 20_000 });
}

export async function myAppointments(userId, { lang = 'ka', now = new Date() } = {}, db = prisma) {
  const rows = await db.$queryRaw`${APPOINTMENT_SELECT} WHERE a."clientUserId" = ${userId} AND a."startsAt" > NOW() - INTERVAL '365 days' ORDER BY a."startsAt" DESC LIMIT 200`;
  const list = rows.map((r) => appointmentPublic(r, { lang, now }));
  const upcoming = list.filter((a) => OPEN_STATUSES.includes(a.status) && new Date(a.endsAt).getTime() >= now.getTime()).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  const past = list.filter((a) => !upcoming.includes(a));
  return { upcoming, past };
}

export async function appointmentForUser(id, userId, { lang = 'ka', now = new Date() } = {}, db = prisma) {
  const row = await appointmentRow(id, db);
  if (!row || row.clientUserId !== userId) throw bookError(404, 'ჯავშანი ვერ მოიძებნა.', 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  return appointmentPublic(row, { lang, now });
}

export async function cancelByUser({ id, userId, reason = null, now = new Date() }, db = prisma) {
  const row = await appointmentRow(id, db);
  if (!row || row.clientUserId !== userId) throw bookError(404, 'ჯავშანი ვერ მოიძებნა.', 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  if (!OPEN_STATUSES.includes(row.status)) throw bookError(409, 'ეს ჯავშანი უკვე დასრულებული ან გაუქმებულია.', 'NOT_OPEN', 'This appointment is already over or cancelled.');
  if (new Date(row.startsAt).getTime() < now.getTime()) throw bookError(409, 'დაწყებული ვიზიტი ვეღარ გაუქმდება — დაურეკე ბიზნესს.', 'ALREADY_STARTED', 'A visit that has started cannot be cancelled — call the business.');
  const late = !canCancelFree(row, row.businessSettings, now);
  await db.$executeRaw`UPDATE "BookAppointment" SET status = 'CANCELLED', "cancelledBy" = 'CLIENT', "cancelReason" = ${cleanText(reason, 300)}, "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${id}`;
  return { row: await appointmentRow(id, db), late };
}

export async function reviewAppointment({ id, userId, rating, text = null }, db = prisma) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) throw bookError(400, 'შეფასება 1-დან 5-მდეა.', 'BAD_RATING', 'Rating is 1 to 5.');
  const row = await appointmentRow(id, db);
  if (!row || row.clientUserId !== userId) throw bookError(404, 'ჯავშანი ვერ მოიძებნა.', 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  if (!['COMPLETED', 'CONFIRMED'].includes(row.status) || new Date(row.endsAt).getTime() > Date.now()) throw bookError(409, 'შეფასება ვიზიტის შემდეგ შეიძლება.', 'TOO_EARLY', 'You can review after the visit.');
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "BookReview" (id, "businessId", "appointmentId", "userId", rating, text) VALUES (${newId()}, ${row.businessId}, ${id}, ${userId}, ${r}, ${cleanText(text, 1000)})
      ON CONFLICT ("appointmentId") DO UPDATE SET rating = EXCLUDED.rating, text = EXCLUDED.text`;
    await tx.$executeRaw`UPDATE "BookAppointment" SET "reviewedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${id}`;
    await recomputeRating(tx, row.businessId);
  });
  return appointmentRow(id, db);
}

async function recomputeRating(tx, businessId) {
  await tx.$executeRaw`UPDATE "BookBusiness" SET "ratingAvg" = (SELECT AVG(rating) FROM "BookReview" WHERE "businessId" = ${businessId} AND NOT hidden), "ratingCount" = (SELECT COUNT(*) FROM "BookReview" WHERE "businessId" = ${businessId} AND NOT hidden) WHERE id = ${businessId}`;
}

// ——— the business's calendar ———

export async function businessAppointments({ businessId, from, to, staffId = null, status = null, clientId = null, limit = 1000 }, db = prisma) {
  const rows = await db.$queryRaw`${APPOINTMENT_SELECT} WHERE a."businessId" = ${businessId} AND a."endsAt" > ${from} AND a."startsAt" < ${to}
    ${staffId ? sql`AND a."staffId" = ${staffId}` : empty} ${status ? sql`AND a.status = ${status}` : empty} ${clientId ? sql`AND a."clientId" = ${clientId}` : empty}
    ORDER BY a."startsAt" LIMIT ${Math.min(5000, Math.max(1, Number(limit) || 1000))}`;
  return rows.map((r) => appointmentPublic(r));
}

const STATUS_FLOW = Object.freeze({ PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'PENDING'], COMPLETED: ['CONFIRMED'], NO_SHOW: ['CONFIRMED', 'COMPLETED'], CANCELLED: ['CONFIRMED'] });

/**
 * The business edits an appointment: move it (startsAt / staffId / serviceId), change its status, set the
 * price and the payment, write an internal note, correct the client's name or phone. Completing writes the
 * income once (unique index) and updates the client's history; a no-show counts on the client.
 */
export async function updateByBusiness({ businessId, id, patch = {}, actorUserId = null, now = new Date() }, db = prisma) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}))`;
    const row = await appointmentRow(id, tx);
    if (!row || row.businessId !== businessId) throw bookError(404, 'ჯავშანი ვერ მოიძებნა.', 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
    const sets = [];
    let startsAt = new Date(row.startsAt);
    let durationMin = Number(row.durationMin);
    let staffId = row.staffId;
    let serviceName = row.serviceName;
    if (patch.serviceId !== undefined && patch.serviceId !== row.serviceId) {
      const service = await serviceRow(businessId, patch.serviceId, tx);
      if (!service) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
      durationMin = Number(service.durationMin);
      serviceName = service.nameKa || service.name;
      sets.push(sql`"serviceId" = ${service.id}`, sql`"serviceName" = ${serviceName}`, sql`"durationMin" = ${durationMin}`);
      if (patch.price === undefined) sets.push(sql`price = ${service.price == null ? null : Number(service.price)}`, sql`"discountId" = NULL`, sql`"discountAmount" = NULL`);
    }
    if (patch.durationMin !== undefined) {
      durationMin = Math.max(5, Math.min(12 * 60, Math.round(Number(patch.durationMin) || durationMin)));
      sets.push(sql`"durationMin" = ${durationMin}`);
    }
    if (patch.startsAt !== undefined) {
      startsAt = new Date(patch.startsAt);
      if (Number.isNaN(startsAt.getTime())) throw bookError(400, 'არასწორი დრო.', 'BAD_TIME', 'Invalid time.');
    }
    if (patch.staffId !== undefined) {
      staffId = patch.staffId || null;
      if (staffId) {
        const [s] = await tx.$queryRaw`SELECT id FROM "BookStaff" WHERE id = ${staffId} AND "businessId" = ${businessId}`;
        if (!s) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Staff member not found.');
      }
      sets.push(sql`"staffId" = ${staffId}`);
    }
    const endsAt = new Date(startsAt.getTime() + durationMin * MIN);
    const moved = startsAt.getTime() !== new Date(row.startsAt).getTime() || endsAt.getTime() !== new Date(row.endsAt).getTime() || staffId !== row.staffId;
    if (moved) {
      if (staffId && !patch.force) {
        const others = await tx.$queryRaw`SELECT id, "staffId", status, "startsAt", "endsAt" FROM "BookAppointment" WHERE "businessId" = ${businessId} AND "staffId" = ${staffId} AND id <> ${id} AND status <> 'CANCELLED' AND "endsAt" > ${new Date(startsAt.getTime() - 4 * 3600_000)} AND "startsAt" < ${new Date(endsAt.getTime() + 4 * 3600_000)}`;
        const clash = findConflict(others.map((a) => ({ ...a, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString() })), { staffId, startsAt, endsAt });
        if (clash) throw bookError(409, `ამ დროს ${row.staffName ?? 'თანამშრომელს'} სხვა ჩანაწერი აქვს.`, 'SLOT_TAKEN', 'This person already has another appointment then.');
      }
      sets.push(sql`"startsAt" = ${startsAt}`, sql`"endsAt" = ${endsAt}`);
      if (row.status !== 'CANCELLED') sets.push(sql`"remindedDay" = FALSE`, sql`"remindedSoon" = FALSE`);
    }
    if (patch.price !== undefined) sets.push(sql`price = ${money(patch.price)}`);
    if (patch.paidAmount !== undefined) sets.push(sql`"paidAmount" = ${money(patch.paidAmount)}`);
    if (patch.paidMethod !== undefined) sets.push(sql`"paidMethod" = ${['CASH', 'CARD', 'TRANSFER', 'OTHER'].includes(patch.paidMethod) ? patch.paidMethod : null}`);
    if (patch.internalNote !== undefined) sets.push(sql`"internalNote" = ${cleanText(patch.internalNote, 1000)}`);
    if (patch.note !== undefined) sets.push(sql`note = ${cleanText(patch.note, 500)}`);
    if (patch.clientName !== undefined && cleanText(patch.clientName, 120)) sets.push(sql`"clientName" = ${cleanText(patch.clientName, 120)}`);
    if (patch.clientPhone !== undefined) sets.push(sql`"clientPhone" = ${normalizePhone(patch.clientPhone)}`);
    let status = row.status;
    if (patch.status !== undefined && patch.status !== row.status) {
      if (!STATUS_FLOW[row.status]?.includes(patch.status)) throw bookError(409, `სტატუსი „${row.status}“ → „${patch.status}“ არ შეიძლება.`, 'BAD_STATUS', `Cannot change status from ${row.status} to ${patch.status}.`);
      status = patch.status;
      sets.push(sql`status = ${status}`);
      if (status === 'CANCELLED') sets.push(sql`"cancelledBy" = 'BUSINESS'`, sql`"cancelReason" = ${cleanText(patch.cancelReason, 300)}`, sql`"cancelledAt" = CURRENT_TIMESTAMP`);
      if (status === 'COMPLETED') sets.push(sql`"completedAt" = CURRENT_TIMESTAMP`);
      if (status === 'CONFIRMED' && row.status === 'CANCELLED') sets.push(sql`"cancelledBy" = NULL`, sql`"cancelReason" = NULL`, sql`"cancelledAt" = NULL`);
    }
    if (!sets.length) return { row, moved: false, statusChanged: false };
    sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
    await tx.$executeRaw`UPDATE "BookAppointment" SET ${join(sets, ', ')} WHERE id = ${id}`;
    if (patch.serviceId !== undefined && patch.serviceId !== row.serviceId) {
      // A service change from the drawer makes the booking a single-service one again.
      await tx.$executeRaw`DELETE FROM "BookAppointmentItem" WHERE "appointmentId" = ${id}`;
      const [fresh] = await tx.$queryRaw`SELECT "serviceId", "serviceName", "durationMin", price FROM "BookAppointment" WHERE id = ${id}`;
      await tx.$executeRaw`INSERT INTO "BookAppointmentItem" (id, "appointmentId", "serviceId", "serviceName", "durationMin", price, "sortOrder") VALUES (${newId()}, ${id}, ${fresh.serviceId}, ${fresh.serviceName}, ${fresh.durationMin}, ${fresh.price}, 0)`;
    }
    const next = await appointmentRow(id, tx);
    // Money and client history follow the status.
    if (status === 'COMPLETED' && row.status !== 'COMPLETED') {
      // Gift card, bonus and membership parts first; what is left in money is the income. The business may type the money it received.
      const parts = await loyalty.applyPayment(tx, { businessId, appointment: next, payment: { ...(patch.payment ?? {}), cashAmount: patch.paidAmount !== undefined ? patch.paidAmount : patch.payment?.cashAmount }, actorUserId });
      const amount = parts.cashAmount;
      const spent = Math.round(((parts.cashAmount || 0) + (parts.giftAmount || 0) + (parts.membershipAmount || 0)) * 100) / 100;
      if (amount > 0) await tx.$executeRaw`INSERT INTO "BookTransaction" (id, "businessId", "appointmentId", "staffId", kind, category, amount, method, at, "createdBy") VALUES (${newId()}, ${businessId}, ${id}, ${next.staffId}, 'INCOME', 'SERVICE', ${amount}, ${next.paidMethod ?? null}, ${new Date(next.startsAt)}, ${actorUserId}) ON CONFLICT DO NOTHING`;
      // The services' norms leave the stock room (never blocks the visit).
      await supplies.writeOffVisit(tx, { businessId, appointment: next, actorUserId });
      if (next.clientId) await tx.$executeRaw`UPDATE "BookClient" SET visits = visits + 1, "totalSpent" = "totalSpent" + ${spent}, "firstVisitAt" = COALESCE("firstVisitAt", ${new Date(next.startsAt)}), "lastVisitAt" = GREATEST(COALESCE("lastVisitAt", ${new Date(next.startsAt)}), ${new Date(next.startsAt)}), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${next.clientId}`;
    } else if (row.status === 'COMPLETED' && status !== 'COMPLETED') {
      const [t] = await tx.$queryRaw`SELECT amount FROM "BookTransaction" WHERE "appointmentId" = ${id} AND kind = 'INCOME'`;
      const reverted = await loyalty.revertPayment(tx, { businessId, appointment: row, actorUserId });
      const undoSpent = reverted ? Math.round(((reverted.cashAmount || 0) + (reverted.giftAmount || 0) + (reverted.membershipAmount || 0)) * 100) / 100 : t ? Number(t.amount) : 0;
      await tx.$executeRaw`DELETE FROM "BookTransaction" WHERE "appointmentId" = ${id} AND kind = 'INCOME'`;
      await supplies.revertVisit(tx, { businessId, appointmentId: id });
      if (next.clientId) await tx.$executeRaw`UPDATE "BookClient" SET visits = GREATEST(0, visits - 1), "totalSpent" = GREATEST(0, "totalSpent" - ${undoSpent}), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${next.clientId}`;
    } else if (status === 'COMPLETED' && (patch.paidAmount !== undefined || patch.price !== undefined)) {
      const amount = next.paidAmount != null ? Number(next.paidAmount) : next.price != null ? Number(next.price) : 0;
      await tx.$executeRaw`UPDATE "BookTransaction" SET amount = ${amount}, method = ${next.paidMethod ?? null} WHERE "appointmentId" = ${id} AND kind = 'INCOME'`;
    }
    if (status === 'NO_SHOW' && row.status !== 'NO_SHOW' && next.clientId) await tx.$executeRaw`UPDATE "BookClient" SET "noShows" = "noShows" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${next.clientId}`;
    if (row.status === 'NO_SHOW' && status !== 'NO_SHOW' && next.clientId) await tx.$executeRaw`UPDATE "BookClient" SET "noShows" = GREATEST(0, "noShows" - 1), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${next.clientId}`;
    // The loyalty step wrote paidParts / paidAmount after `next` was read: hand back the fresh row.
    return { row: await appointmentRow(id, tx), moved, statusChanged: status !== row.status, previousStatus: row.status, previousStartsAt: row.startsAt };
  }, { timeout: 20_000 });
}

// ——— clients ———

export function clientPublic(r) {
  return {
    id: r.id,
    userId: r.userId ?? null,
    name: r.name,
    phone: r.phone ?? null,
    email: r.email ?? null,
    notes: r.notes ?? null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    visits: Number(r.visits ?? 0),
    noShows: Number(r.noShows ?? 0),
    totalSpent: Number(r.totalSpent ?? 0),
    firstVisitAt: r.firstVisitAt ?? null,
    lastVisitAt: r.lastVisitAt ?? null,
    nextAt: r.nextAt ?? null,
    createdAt: r.createdAt,
    inApp: Boolean(r.userId),
  };
}

export async function listClients({ businessId, q = '', sort = 'recent', limit = 200, offset = 0 }, db = prisma) {
  const term = String(q ?? '').trim();
  const like = `%${term.replace(/[%_]/g, ' ')}%`;
  const where = term.length >= 2 ? sql`AND (c.name ILIKE ${like} OR c.phone ILIKE ${like} OR c.email ILIKE ${like} OR c.tags::text ILIKE ${like})` : empty;
  const order = sort === 'name' ? sql`c.name ASC` : sort === 'spent' ? sql`c."totalSpent" DESC NULLS LAST` : sort === 'visits' ? sql`c.visits DESC` : sql`COALESCE(c."lastVisitAt", c."createdAt") DESC`;
  const rows = await db.$queryRaw`SELECT c.*, (SELECT MIN(a."startsAt") FROM "BookAppointment" a WHERE a."clientId" = c.id AND a.status IN ('PENDING','CONFIRMED') AND a."startsAt" > NOW()) AS "nextAt"
    FROM "BookClient" c WHERE c."businessId" = ${businessId} ${where} ORDER BY ${order} LIMIT ${Math.min(1000, Math.max(1, Number(limit) || 200))} OFFSET ${Math.max(0, Number(offset) || 0)}`;
  const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookClient" c WHERE c."businessId" = ${businessId} ${where}`;
  return { total: Number(n), clients: rows.map(clientPublic) };
}

export async function clientDetail({ businessId, clientId }, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "BookClient" WHERE id = ${clientId} AND "businessId" = ${businessId}`;
  if (!row) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const appointments = await db.$queryRaw`${APPOINTMENT_SELECT} WHERE a."clientId" = ${clientId} ORDER BY a."startsAt" DESC LIMIT 200`;
  const reviews = await db.$queryRaw`SELECT r.id, r.rating, r.text, r."createdAt" FROM "BookReview" r JOIN "BookAppointment" a ON a.id = r."appointmentId" WHERE a."clientId" = ${clientId} ORDER BY r."createdAt" DESC LIMIT 20`;
  return { client: clientPublic(row), appointments: appointments.map((a) => appointmentPublic(a)), reviews };
}

export async function createClient({ businessId, name, phone = null, email = null, notes = null, tags = [] }, db = prisma) {
  const n = cleanText(name, 120);
  if (!n) throw bookError(400, 'მიუთითე სახელი.', 'NAME_REQUIRED', 'Enter the name.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookClient" (id, "businessId", name, phone, email, notes, tags) VALUES (${id}, ${businessId}, ${n}, ${normalizePhone(phone)}, ${cleanText(email, 120)}, ${cleanText(notes, 2000)}, ${JSON.stringify(Array.isArray(tags) ? tags.map((t) => cleanText(t, 30)).filter(Boolean).slice(0, 12) : [])}::jsonb)`;
  const [row] = await db.$queryRaw`SELECT * FROM "BookClient" WHERE id = ${id}`;
  return clientPublic(row);
}

export async function updateClient({ businessId, clientId, patch = {} }, db = prisma) {
  const sets = [];
  if (patch.name !== undefined && cleanText(patch.name, 120)) sets.push(sql`name = ${cleanText(patch.name, 120)}`);
  if (patch.phone !== undefined) sets.push(sql`phone = ${normalizePhone(patch.phone)}`);
  if (patch.email !== undefined) sets.push(sql`email = ${cleanText(patch.email, 120)}`);
  if (patch.notes !== undefined) sets.push(sql`notes = ${cleanText(patch.notes, 2000)}`);
  if (patch.tags !== undefined) sets.push(sql`tags = ${JSON.stringify(Array.isArray(patch.tags) ? patch.tags.map((t) => cleanText(t, 30)).filter(Boolean).slice(0, 12) : [])}::jsonb`);
  if (!sets.length) throw bookError(400, 'შესაცვლელი არაფერია.', 'NOTHING_TO_UPDATE', 'Nothing to update.');
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookClient" SET ${join(sets, ', ')} WHERE id = ${clientId} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const [row] = await db.$queryRaw`SELECT * FROM "BookClient" WHERE id = ${clientId}`;
  return clientPublic(row);
}

// ——— discounts ———

function sanitizeDiscount(input = {}) {
  const out = {};
  if (input.title !== undefined) out.title = cleanText(input.title, 80);
  if (input.kind !== undefined) out.kind = input.kind === 'FIXED' ? 'FIXED' : 'PERCENT';
  if (input.value !== undefined) out.value = Math.max(0, Math.min(out.kind === 'FIXED' || input.kind === 'FIXED' ? 100000 : 100, Number(input.value) || 0));
  if (input.serviceIds !== undefined) out.serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.map(String).slice(0, 200) : [];
  if (input.startsOn !== undefined) out.startsOn = isYmd(input.startsOn) ? input.startsOn : null;
  if (input.endsOn !== undefined) out.endsOn = isYmd(input.endsOn) ? input.endsOn : null;
  if (input.weekdays !== undefined) out.weekdays = Array.isArray(input.weekdays) ? [...new Set(input.weekdays.map(Number).filter((d) => d >= 0 && d <= 6))] : [];
  if (input.hoursFrom !== undefined) out.hoursFrom = /^\d{1,2}:\d{2}$/.test(String(input.hoursFrom ?? '')) ? input.hoursFrom : null;
  if (input.hoursTo !== undefined) out.hoursTo = /^\d{1,2}:\d{2}$/.test(String(input.hoursTo ?? '')) ? input.hoursTo : null;
  if (input.code !== undefined) out.code = cleanText(input.code, 24)?.toUpperCase() ?? null;
  if (input.maxUses !== undefined) out.maxUses = input.maxUses == null || input.maxUses === '' ? null : Math.max(1, Math.round(Number(input.maxUses) || 1));
  if (input.active !== undefined) out.active = Boolean(input.active);
  return out;
}

const discountFull = (r) => ({ ...discountPublic(r), maxUses: r.maxUses ?? null, usedCount: Number(r.usedCount ?? 0), active: Boolean(r.active), createdAt: r.createdAt });

export async function listDiscounts(businessId, db = prisma) {
  const rows = await db.$queryRaw`SELECT * FROM "BookDiscount" WHERE "businessId" = ${businessId} ORDER BY active DESC, "createdAt" DESC`;
  return rows.map(discountFull);
}

export async function createDiscount(businessId, input, db = prisma) {
  const d = sanitizeDiscount(input);
  if (!d.title) throw bookError(400, 'მიუთითე ფასდაკლების სათაური.', 'TITLE_REQUIRED', 'Enter a title.');
  if (!(d.value > 0)) throw bookError(400, 'მიუთითე ფასდაკლების ზომა.', 'VALUE_REQUIRED', 'Enter the amount.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookDiscount" (id, "businessId", title, kind, value, "serviceIds", "startsOn", "endsOn", weekdays, "hoursFrom", "hoursTo", code, "maxUses", active)
    VALUES (${id}, ${businessId}, ${d.title}, ${d.kind ?? 'PERCENT'}, ${d.value}, ${JSON.stringify(d.serviceIds ?? [])}::jsonb, ${d.startsOn ?? null}::date, ${d.endsOn ?? null}::date, ${JSON.stringify(d.weekdays ?? [])}::jsonb, ${d.hoursFrom ?? null}, ${d.hoursTo ?? null}, ${d.code ?? null}, ${d.maxUses ?? null}, ${d.active ?? true})`;
  const [row] = await db.$queryRaw`SELECT * FROM "BookDiscount" WHERE id = ${id}`;
  return discountFull(row);
}

export async function updateDiscount(businessId, id, input, db = prisma) {
  const d = sanitizeDiscount(input);
  const sets = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === 'serviceIds' || k === 'weekdays') sets.push(sql`${Prisma.raw(`"${k}"`)} = ${JSON.stringify(v)}::jsonb`);
    else if (k === 'startsOn' || k === 'endsOn') sets.push(sql`${Prisma.raw(`"${k}"`)} = ${v}::date`);
    else sets.push(sql`${Prisma.raw(`"${k}"`)} = ${v}`);
  }
  if (!sets.length) throw bookError(400, 'შესაცვლელი არაფერია.', 'NOTHING_TO_UPDATE', 'Nothing to update.');
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookDiscount" SET ${join(sets, ', ')} WHERE id = ${id} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'ფასდაკლება ვერ მოიძებნა.', 'DISCOUNT_NOT_FOUND', 'Discount not found.');
  const [row] = await db.$queryRaw`SELECT * FROM "BookDiscount" WHERE id = ${id}`;
  return discountFull(row);
}

export async function deleteDiscount(businessId, id, db = prisma) {
  await db.$executeRaw`DELETE FROM "BookDiscount" WHERE id = ${id} AND "businessId" = ${businessId}`;
}

// ——— reviews (business side) ———

export async function businessReviews(businessId, db = prisma) {
  const rows = await db.$queryRaw`SELECT r.*, a."serviceName", a."startsAt", a."clientName", s.name AS "staffName" FROM "BookReview" r JOIN "BookAppointment" a ON a.id = r."appointmentId" LEFT JOIN "BookStaff" s ON s.id = a."staffId"
    WHERE r."businessId" = ${businessId} ORDER BY r."createdAt" DESC LIMIT 300`;
  return rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, repliedAt: r.repliedAt, hidden: r.hidden, createdAt: r.createdAt, serviceName: r.serviceName, staffName: r.staffName, startsAt: r.startsAt, clientName: r.clientName }));
}

export async function replyReview({ businessId, reviewId, reply }, db = prisma) {
  const n = await db.$executeRaw`UPDATE "BookReview" SET reply = ${cleanText(reply, 1000)}, "repliedAt" = CASE WHEN ${cleanText(reply, 1000)} IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END WHERE id = ${reviewId} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'შეფასება ვერ მოიძებნა.', 'REVIEW_NOT_FOUND', 'Review not found.');
}

// ——— money ———

export async function listTransactions({ businessId, from, to, limit = 500 }, db = prisma) {
  const rows = await db.$queryRaw`SELECT t.*, s.name AS "staffName", a."serviceName", a."clientName" FROM "BookTransaction" t LEFT JOIN "BookStaff" s ON s.id = t."staffId" LEFT JOIN "BookAppointment" a ON a.id = t."appointmentId"
    WHERE t."businessId" = ${businessId} AND t.at >= ${from} AND t.at < ${to} ORDER BY t.at DESC LIMIT ${Math.min(5000, Math.max(1, Number(limit) || 500))}`;
  return rows.map((r) => ({ id: r.id, appointmentId: r.appointmentId ?? null, staffId: r.staffId ?? null, staffName: r.staffName ?? null, serviceName: r.serviceName ?? null, clientName: r.clientName ?? null, kind: r.kind, category: r.category, amount: Number(r.amount), method: r.method ?? null, note: r.note ?? null, at: r.at, manual: !r.appointmentId }));
}

export const EXPENSE_CATEGORIES = Object.freeze(['RENT', 'SALARY', 'SUPPLIES', 'MARKETING', 'UTILITIES', 'EQUIPMENT', 'TAX', 'OTHER']);
export const INCOME_CATEGORIES = Object.freeze(['SERVICE', 'PRODUCT', 'GIFT_CARD', 'MEMBERSHIP', 'OTHER']);

export async function addTransaction({ businessId, kind, category, amount, method = null, note = null, at = null, staffId = null, actorUserId = null }, db = prisma) {
  const k = kind === 'EXPENSE' ? 'EXPENSE' : 'INCOME';
  const cats = k === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const amt = money(amount);
  if (!(amt > 0)) throw bookError(400, 'მიუთითე თანხა.', 'AMOUNT_REQUIRED', 'Enter the amount.');
  const when = at ? new Date(at) : new Date();
  if (Number.isNaN(when.getTime())) throw bookError(400, 'არასწორი თარიღი.', 'BAD_DATE', 'Invalid date.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookTransaction" (id, "businessId", "staffId", kind, category, amount, method, note, at, "createdBy") VALUES (${id}, ${businessId}, ${staffId}, ${k}, ${cats.includes(category) ? category : 'OTHER'}, ${amt}, ${['CASH', 'CARD', 'TRANSFER', 'OTHER'].includes(method) ? method : null}, ${cleanText(note, 300)}, ${when}, ${actorUserId})`;
  return id;
}

export async function deleteTransaction({ businessId, id }, db = prisma) {
  // Income written by a completed appointment is undone by changing the appointment, not here.
  // Rows written by a sale or a payout are undone there, not here.
  await db.$executeRaw`DELETE FROM "BookTransaction" WHERE id = ${id} AND "businessId" = ${businessId} AND "appointmentId" IS NULL
    AND id NOT IN (SELECT "transactionId" FROM "BookSale" WHERE "transactionId" IS NOT NULL) AND id NOT IN (SELECT "transactionId" FROM "BookPayout" WHERE "transactionId" IS NOT NULL)`;
}

// ——— raw numbers for analytics (aggregated in analytics.js) ———

export async function analyticsRaw({ businessId, from, to }, db = prisma) {
  const [appointments, events, transactions, staff, timeOff, clients, reviews, business] = await Promise.all([
    db.$queryRaw`SELECT a.id, a."staffId", a."serviceId", a."serviceName", ${ITEMS_JSON} AS items, a."clientId", a."clientUserId", a.status, a.source, a.price, a."discountAmount", a."startsAt", a."endsAt", a."durationMin", a."createdAt" FROM "BookAppointment" a WHERE a."businessId" = ${businessId} AND a."startsAt" >= ${from} AND a."startsAt" < ${to}`,
    db.$queryRaw`SELECT kind, "viewerHash", at FROM "BookEvent" WHERE "businessId" = ${businessId} AND at >= ${from} AND at < ${to}`,
    db.$queryRaw`SELECT kind, category, amount, method, at, "staffId" FROM "BookTransaction" WHERE "businessId" = ${businessId} AND at >= ${from} AND at < ${to}`,
    db.$queryRaw`SELECT id, name, color, schedule, active, bookable FROM "BookStaff" WHERE "businessId" = ${businessId}`,
    db.$queryRaw`SELECT "staffId", "startsAt", "endsAt" FROM "BookTimeOff" WHERE "businessId" = ${businessId} AND "endsAt" > ${from} AND "startsAt" < ${to}`,
    db.$queryRaw`SELECT id, "createdAt", "firstVisitAt", visits FROM "BookClient" WHERE "businessId" = ${businessId}`,
    db.$queryRaw`SELECT rating, "createdAt" FROM "BookReview" WHERE "businessId" = ${businessId} AND NOT hidden AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
    businessRow(businessId, db),
  ]);
  return { appointments, events, transactions, staff, timeOff, clients, reviews, business };
}

/** The numbers on the owner's overview page: today, this week, what needs attention. */
export async function overviewRaw({ businessId, now = new Date() }, db = prisma) {
  const todayYmd = tbilisiYmd(now);
  const dayStart = tbilisiInstant(todayYmd, 0);
  const dayEnd = tbilisiInstant(addDaysYmd(todayYmd, 1), 0);
  const weekStart = new Date(now.getTime() - 7 * 86400_000);
  const spanStart = tbilisiInstant(addDaysYmd(todayYmd, -13), 0);
  const spanEnd = tbilisiInstant(addDaysYmd(todayYmd, 8), 0);
  const [today, [week], [pending], [clients], [reviews], [views], upcoming, spanAppts, spanIncome, spanClients] = await Promise.all([
    db.$queryRaw`${APPOINTMENT_SELECT} WHERE a."businessId" = ${businessId} AND a."startsAt" >= ${dayStart} AND a."startsAt" < ${dayEnd} ORDER BY a."startsAt"`,
    db.$queryRaw`SELECT COUNT(*) FILTER (WHERE "createdAt" >= ${weekStart})::int AS booked, COUNT(*) FILTER (WHERE status = 'COMPLETED' AND "startsAt" >= ${weekStart})::int AS done, COUNT(*) FILTER (WHERE status = 'NO_SHOW' AND "startsAt" >= ${weekStart})::int AS "noShow", COUNT(*) FILTER (WHERE status = 'CANCELLED' AND "cancelledAt" >= ${weekStart})::int AS cancelled,
      COALESCE((SELECT SUM(amount) FROM "BookTransaction" t WHERE t."businessId" = ${businessId} AND t.kind = 'INCOME' AND t.at >= ${weekStart}), 0)::float AS revenue FROM "BookAppointment" WHERE "businessId" = ${businessId}`,
    db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookAppointment" WHERE "businessId" = ${businessId} AND status = 'PENDING' AND "startsAt" >= ${now}`,
    db.$queryRaw`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "createdAt" >= ${weekStart})::int AS new FROM "BookClient" WHERE "businessId" = ${businessId}`,
    db.$queryRaw`SELECT COUNT(*)::int AS n, AVG(rating)::float AS avg, COUNT(*) FILTER (WHERE reply IS NULL)::int AS unanswered FROM "BookReview" WHERE "businessId" = ${businessId} AND NOT hidden`,
    db.$queryRaw`SELECT COUNT(*) FILTER (WHERE kind = 'VIEW')::int AS views, COUNT(*) FILTER (WHERE kind = 'CALL')::int AS calls, COUNT(*) FILTER (WHERE kind = 'BOOK_DONE')::int AS booked FROM "BookEvent" WHERE "businessId" = ${businessId} AND at >= ${weekStart}`,
    db.$queryRaw`${APPOINTMENT_SELECT} WHERE a."businessId" = ${businessId} AND a."startsAt" >= ${dayEnd} AND a.status IN ('PENDING','CONFIRMED') ORDER BY a."startsAt" LIMIT 8`,
    db.$queryRaw`SELECT "startsAt", "createdAt", status, source FROM "BookAppointment" WHERE "businessId" = ${businessId} AND (("startsAt" >= ${spanStart} AND "startsAt" < ${spanEnd}) OR ("createdAt" >= ${spanStart} AND "createdAt" < ${spanEnd}))`,
    db.$queryRaw`SELECT amount, at FROM "BookTransaction" WHERE "businessId" = ${businessId} AND kind = 'INCOME' AND at >= ${spanStart} AND at < ${spanEnd}`,
    db.$queryRaw`SELECT "createdAt" FROM "BookClient" WHERE "businessId" = ${businessId} AND "createdAt" >= ${spanStart} AND "createdAt" < ${spanEnd}`,
  ]);
  // Two weeks back and one ahead, one row per day — the overview chart and the sparklines under the numbers.
  const days = [];
  const byDay = new Map();
  for (let i = -13; i <= 7; i += 1) {
    const date = addDaysYmd(todayYmd, i);
    const row = { date, bookings: 0, completed: 0, noShow: 0, cancelled: 0, pending: 0, created: 0, revenue: 0, newClients: 0 };
    days.push(row);
    byDay.set(date, row);
  }
  const sources = { APP: 0, WEB: 0, BUSINESS: 0 };
  for (const a of spanAppts) {
    const row = byDay.get(tbilisiYmd(new Date(a.startsAt)));
    if (row) {
      if (a.status !== 'CANCELLED') row.bookings += 1;
      if (a.status === 'COMPLETED') row.completed += 1;
      if (a.status === 'NO_SHOW') row.noShow += 1;
      if (a.status === 'CANCELLED') row.cancelled += 1;
      if (a.status === 'PENDING') row.pending += 1;
      if (a.status !== 'CANCELLED' && new Date(a.startsAt) < now) sources[a.source] = (sources[a.source] ?? 0) + 1;
    }
    const made = byDay.get(tbilisiYmd(new Date(a.createdAt)));
    if (made) made.created += 1;
  }
  for (const t of spanIncome) { const row = byDay.get(tbilisiYmd(new Date(t.at))); if (row) row.revenue = Math.round((row.revenue + Number(t.amount)) * 100) / 100; }
  for (const c of spanClients) { const row = byDay.get(tbilisiYmd(new Date(c.createdAt))); if (row) row.newClients += 1; }
  return {
    today: today.map((a) => appointmentPublic(a, { now })),
    upcoming: upcoming.map((a) => appointmentPublic(a, { now })),
    week: { ...week, revenue: Number(week.revenue ?? 0) },
    pending: Number(pending.n),
    clients,
    reviews: { count: Number(reviews.n), avg: reviews.avg == null ? null : Math.round(Number(reviews.avg) * 10) / 10, unanswered: Number(reviews.unanswered) },
    funnel: views,
    days,
    sources,
  };
}

/** Appointments due a reminder: tomorrow (24 h) and soon (2 h). Flags are set before the push goes out. */
export async function claimReminder(id, flag, db = prisma) {
  const col = flag === 'soon' ? sql`"remindedSoon"` : sql`"remindedDay"`;
  const n = await db.$executeRaw`UPDATE "BookAppointment" SET ${col} = TRUE WHERE id = ${id} AND NOT ${col}`;
  return n > 0;
}

/** Open bookings within the widest reminder window (48 h) that still miss a push or an SMS; the pass decides per business. */
export async function dueReminders(now = new Date(), db = prisma) {
  const rows = await db.$queryRaw`${APPOINTMENT_SELECT} WHERE a.status IN ('PENDING','CONFIRMED') AND a."startsAt" > ${now} AND a."startsAt" <= ${new Date(now.getTime() + 48 * 3600_000)}
    AND ((a."clientUserId" IS NOT NULL AND (NOT a."remindedDay" OR NOT a."remindedSoon")) OR NOT a."smsDay" OR NOT a."smsSoon") ORDER BY a."startsAt" LIMIT 500`;
  return rows;
}

export async function claimSms(id, flag, db = prisma) {
  const col = flag === 'soon' ? sql`"smsSoon"` : sql`"smsDay"`;
  const n = await db.$executeRaw`UPDATE "BookAppointment" SET ${col} = TRUE WHERE id = ${id} AND NOT ${col}`;
  return n > 0;
}

/** Completed-or-past confirmed visits of app users who have not been asked for a review yet (once, 2–48 h after). */
export async function dueReviewAsks(now = new Date(), db = prisma) {
  const rows = await db.$queryRaw`${APPOINTMENT_SELECT} WHERE a.status IN ('COMPLETED','CONFIRMED') AND a."clientUserId" IS NOT NULL AND NOT a."reviewAsked" AND a."reviewedAt" IS NULL
    AND a."endsAt" <= ${new Date(now.getTime() - 2 * 3600_000)} AND a."endsAt" >= ${new Date(now.getTime() - 48 * 3600_000)} ORDER BY a."endsAt" LIMIT 200`;
  return rows;
}

export async function markReviewAsked(id, db = prisma) {
  const n = await db.$executeRaw`UPDATE "BookAppointment" SET "reviewAsked" = TRUE WHERE id = ${id} AND NOT "reviewAsked"`;
  return n > 0;
}
