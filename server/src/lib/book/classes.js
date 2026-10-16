/**
 * MEDIBOOK group classes. One class = one `BookClass` occurrence (planned ahead by the timetable helper, or formed
 * by the first booking of a service with `seats` > 1); every attendee stays a `BookAppointment` row linked through
 * `classId`, so reminders, SMS, payroll, the client history and analytics keep counting people. The class row is
 * what blocks the trainer's time and holds the rooms, once. Seat arithmetic lives in availability.js (`seatsOf`);
 * the weekly template expansion here is pure and tested in classes.test.js.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, newId } from './catalog.js';
import { classBlocks, findConflict, resourceConflict, resourceIdsFor, seatsOf } from './availability.js';
import { addDaysYmd, isYmd, tbilisiInstant, tbilisiYmd, weekdayOfYmd } from './time.js';
import { APPOINTMENT_SELECT, appointmentPublic, classRows, serviceRow } from './bookings.js';
import { businessRow } from './store.js';

const sql = Prisma.sql;
const join = Prisma.join;
const empty = Prisma.empty;
const MIN = 60_000;
const MAX_SEATS = 200;

const cleanText = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const isoOf = (v) => (v instanceof Date ? v : new Date(v)).toISOString();
const withIso = (a) => ({ ...a, startsAt: isoOf(a.startsAt), endsAt: isoOf(a.endsAt), resourceIds: Array.isArray(a.resourceIds) ? a.resourceIds : [] });

/** Seats of a service or a class, clamped to 1…200 (1 = a normal visit). */
export function clampSeats(v) {
  return Math.max(1, Math.min(MAX_SEATS, Math.round(Number(v)) || 1));
}

// ——— the weekly template (pure) ———

/** `{ weekday: 0–6, time: 'H:MM' | 'HH:MM' }` → normalised, or null when either part is off. */
export function normalizeSlot(x) {
  const weekday = Math.round(Number(x?.weekday));
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(x?.time ?? '').trim());
  if (!(weekday >= 0 && weekday <= 6) || !m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return { weekday, time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

/** A weekly template without duplicates, Monday-first order then by time. */
export function normalizeWeekly(list) {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const s = normalizeSlot(x);
    if (!s) continue;
    const key = `${s.weekday}@${s.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.time.localeCompare(b.time)).slice(0, 21);
}

/**
 * The next occurrences of a weekly template: from `from` (a Tbilisi day, today by default) for `weeks` weeks,
 * only starts after `now`, in order, without duplicates. [{ date, time, startsAt }]
 */
export function expandWeekly({ weekly = [], from = null, weeks = 4, now = new Date() }) {
  const start = from && isYmd(from) ? from : tbilisiYmd(now);
  const n = Math.min(12, Math.max(1, Math.round(Number(weeks)) || 4));
  const items = normalizeWeekly(weekly);
  const out = [];
  for (let i = 0; i < n * 7; i += 1) {
    const date = addDaysYmd(start, i);
    const weekday = weekdayOfYmd(date);
    for (const it of items) {
      if (it.weekday !== weekday) continue;
      const [hh, mm] = it.time.split(':').map(Number);
      const at = tbilisiInstant(date, hh * 60 + mm);
      if (at.getTime() <= now.getTime()) continue;
      out.push({ date, time: it.time, startsAt: at.toISOString() });
    }
  }
  return out;
}

// ——— reading ———

const CLASS_SELECT = sql`SELECT c.*, s.name AS "staffName", s.color AS "staffColor", COALESCE(NULLIF(v."nameKa", ''), v.name) AS "serviceName", v.price AS "servicePrice",
  (SELECT COUNT(*)::int FROM "BookAppointment" x WHERE x."classId" = c.id AND x.status <> 'CANCELLED') AS booked,
  (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name, 'kind', r.kind) ORDER BY r."sortOrder", r.name), '[]'::json) FROM "BookResource" r WHERE r."businessId" = c."businessId" AND c."resourceIds" @> to_jsonb(r.id)) AS resources
  FROM "BookClass" c LEFT JOIN "BookStaff" s ON s.id = c."staffId" JOIN "BookService" v ON v.id = c."serviceId"`;

export function classPublic(row) {
  const { seats, booked, left } = seatsOf(row);
  const startsAt = isoOf(row.startsAt);
  const endsAt = isoOf(row.endsAt);
  return {
    id: row.id,
    businessId: row.businessId,
    serviceId: row.serviceId,
    serviceName: row.serviceName ?? null,
    servicePrice: row.servicePrice == null ? null : Number(row.servicePrice),
    staffId: row.staffId ?? null,
    staffName: row.staffName ?? null,
    staffColor: row.staffColor ?? null,
    startsAt,
    endsAt,
    durationMin: Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / MIN),
    seats,
    booked,
    seatsLeft: left,
    label: `${booked} / ${seats}`,
    resourceIds: Array.isArray(row.resourceIds) ? row.resourceIds : [],
    resources: Array.isArray(row.resources) ? row.resources.map((r) => ({ id: r.id, name: r.name, kind: r.kind })) : [],
    status: row.status,
    /** Put on the calendar by the business (one class or the timetable) rather than formed by the first booking. */
    planned: Boolean(row.planned),
    note: row.note ?? null,
    cancelReason: row.cancelReason ?? null,
    cancelledAt: row.cancelledAt ?? null,
    createdAt: row.createdAt,
    attendees: Array.isArray(row.attendees) ? row.attendees.map((a) => appointmentPublic(a)) : undefined,
  };
}

async function attendeesFor(ids, db) {
  if (!ids.length) return new Map();
  const rows = await db.$queryRaw`${APPOINTMENT_SELECT} WHERE a."classId" IN (${join(ids)}) ORDER BY a.status = 'CANCELLED', a."createdAt"`;
  const by = new Map();
  for (const r of rows) by.set(r.classId, [...(by.get(r.classId) ?? []), r]);
  return by;
}

/** The classes of a window with their attendees (every status), oldest first. */
export async function listClasses({ businessId, from, to, staffId = null, serviceId = null, limit = 1000 }, db = prisma) {
  const rows = await db.$queryRaw`${CLASS_SELECT} WHERE c."businessId" = ${businessId} AND c."endsAt" > ${from} AND c."startsAt" < ${to}
    ${staffId ? sql`AND c."staffId" = ${staffId}` : empty} ${serviceId ? sql`AND c."serviceId" = ${serviceId}` : empty}
    ORDER BY c."startsAt" LIMIT ${Math.min(5000, Math.max(1, Number(limit) || 1000))}`;
  const by = await attendeesFor(rows.map((r) => r.id), db);
  return rows.map((r) => classPublic({ ...r, attendees: by.get(r.id) ?? [] }));
}

export async function classDetail({ businessId, id }, db = prisma) {
  const [row] = await db.$queryRaw`${CLASS_SELECT} WHERE c.id = ${String(id ?? '')} AND c."businessId" = ${businessId}`;
  if (!row) throw bookError(404, 'კლასი ვერ მოიძებნა.', 'CLASS_NOT_FOUND', 'Class not found.');
  const by = await attendeesFor([row.id], db);
  return classPublic({ ...row, attendees: by.get(row.id) ?? [] });
}

// ——— planning ———

async function trainerOf(tx, businessId, staffId) {
  if (!staffId) throw bookError(400, 'კლასს მწვრთნელი სჭირდება — აირჩიე თანამშრომელი.', 'CLASS_STAFF_REQUIRED', 'A class needs a trainer — pick a person.');
  const [row] = await tx.$queryRaw`SELECT id, name FROM "BookStaff" WHERE id = ${String(staffId)} AND "businessId" = ${businessId} AND active`;
  if (!row) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Staff member not found.');
  return row;
}

/** Live bookings and open classes around a window, as the engine's blockers (optionally without one class and its attendees). */
async function blockersAround(tx, businessId, from, to, { exceptClassId = null } = {}) {
  const [appointments, classes] = await Promise.all([
    tx.$queryRaw`SELECT id, "staffId", status, "startsAt", "endsAt", "resourceIds", "classId" FROM "BookAppointment" WHERE "businessId" = ${businessId} AND status <> 'CANCELLED' AND "endsAt" > ${from} AND "startsAt" < ${to}
      ${exceptClassId ? sql`AND ("classId" IS NULL OR "classId" <> ${exceptClassId})` : empty}`,
    classRows({ businessId, from, to }, tx),
  ]);
  return [...appointments.map(withIso), ...classBlocks(classes.filter((c) => c.id !== exceptClassId))];
}

/**
 * The business plans one class: service with seats > 1 (or `seats` given), a trainer, a start. Refuses a second
 * class of the same service and trainer at that minute, a busy trainer and a full room unless `force`.
 */
export async function createClass({ businessId, serviceId, staffId, startsAt, seats = null, note = null, force = false, actorUserId = null, now = new Date() }, db = prisma) {
  const at = new Date(startsAt);
  if (Number.isNaN(at.getTime())) throw bookError(400, 'არასწორი დრო.', 'BAD_TIME', 'Invalid time.');
  const id = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}))`;
    const business = await businessRow(businessId, tx);
    if (!business) throw bookError(404, 'ბიზნესი ვერ მოიძებნა.', 'BUSINESS_NOT_FOUND', 'Business not found.');
    const service = await serviceRow(businessId, serviceId, tx);
    if (!service || !service.active) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
    const trainer = await trainerOf(tx, businessId, staffId);
    const seatCount = seats != null && seats !== '' ? clampSeats(seats) : seatsOf(service).seats;
    if (seatCount < 2) throw bookError(400, 'კლასს 2 ან მეტი ადგილი სჭირდება — სერვისზე „ადგილები“ გაზარდე.', 'CLASS_SEATS', 'A class needs 2 or more seats — raise "Seats" on the service.');
    const endsAt = new Date(at.getTime() + Number(service.durationMin) * MIN);
    const [dup] = await tx.$queryRaw`SELECT id FROM "BookClass" WHERE "businessId" = ${businessId} AND "serviceId" = ${service.id} AND "staffId" = ${trainer.id} AND "startsAt" = ${at} AND status = 'OPEN'`;
    if (dup) throw bookError(409, 'ასეთი კლასი ამ დროს უკვე არის.', 'CLASS_EXISTS', 'This class already exists at this time.');
    const [links, resources] = await Promise.all([
      tx.$queryRaw`SELECT "serviceId", "resourceId" FROM "BookServiceResource" WHERE "serviceId" = ${service.id}`,
      tx.$queryRaw`SELECT id, name, kind, capacity, active FROM "BookResource" WHERE "businessId" = ${businessId} AND active`,
    ]);
    const resourceIds = resourceIdsFor(links, [service.id]);
    if (!force) {
      const blockers = await blockersAround(tx, businessId, new Date(at.getTime() - 4 * 3600_000), new Date(endsAt.getTime() + 4 * 3600_000));
      const clash = findConflict(blockers, { staffId: trainer.id, startsAt: at, endsAt, bufferMin: Number(service.bufferMin ?? 0) });
      if (clash) throw bookError(409, `ამ დროს ${trainer.name} დაკავებულია.`, 'SLOT_TAKEN', `${trainer.name} is busy at this time.`);
      const full = resourceConflict(blockers, resources, { resourceIds, startsAt: at, endsAt, bufferMin: Number(service.bufferMin ?? 0) });
      if (full) throw bookError(409, `ამ დროს „${full.resource.name}“ დაკავებულია.`, 'RESOURCE_TAKEN', `"${full.resource.name}" is taken at this time.`);
    }
    const classId = newId();
    await tx.$executeRaw`INSERT INTO "BookClass" (id, "businessId", "serviceId", "staffId", "startsAt", "endsAt", seats, "resourceIds", planned, note, "createdBy")
      VALUES (${classId}, ${businessId}, ${service.id}, ${trainer.id}, ${at}, ${endsAt}, ${seatCount}, ${JSON.stringify(resourceIds)}::jsonb, TRUE, ${cleanText(note, 300)}, ${actorUserId})`;
    return classId;
  }, { timeout: 20_000 });
  return classDetail({ businessId, id }, db);
}

/**
 * „განრიგი“: a weekly template → the classes of the next `weeks` weeks (missing ones are created; a busy trainer,
 * a full room or an existing class skip that occurrence and say why). The template is kept on the service so
 * the dialog reopens with it. Returns { created, skipped: [{ date, time, code, message }], template }.
 */
export async function scheduleClasses({ businessId, serviceId, staffId, weekly, weeks = 4, seats = null, actorUserId = null, now = new Date() }, db = prisma) {
  const service = await serviceRow(businessId, serviceId, db);
  if (!service || !service.active) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
  const template = { staffId: String(staffId ?? ''), weeks: Math.min(12, Math.max(1, Math.round(Number(weeks)) || 4)), weekly: normalizeWeekly(weekly) };
  if (!template.weekly.length) throw bookError(400, 'აირჩიე კვირის დღე და დრო.', 'SCHEDULE_REQUIRED', 'Pick a weekday and a time.');
  if (!template.staffId) throw bookError(400, 'კლასს მწვრთნელი სჭირდება — აირჩიე თანამშრომელი.', 'CLASS_STAFF_REQUIRED', 'A class needs a trainer — pick a person.');
  const seatCount = seats != null && seats !== '' ? clampSeats(seats) : seatsOf(service).seats;
  if (seatCount < 2) throw bookError(400, 'კლასს 2 ან მეტი ადგილი სჭირდება — სერვისზე „ადგილები“ გაზარდე.', 'CLASS_SEATS', 'A class needs 2 or more seats — raise "Seats" on the service.');
  await db.$executeRaw`UPDATE "BookService" SET seats = ${seatCount}, "classSchedule" = ${JSON.stringify(template)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${service.id} AND "businessId" = ${businessId}`;
  const created = [];
  const skipped = [];
  for (const p of expandWeekly({ weekly: template.weekly, from: tbilisiYmd(now), weeks: template.weeks, now })) {
    try {
      created.push(await createClass({ businessId, serviceId: service.id, staffId: template.staffId, startsAt: p.startsAt, seats: seatCount, actorUserId, now }, db));
    } catch (error) {
      if (!(error?.status >= 400 && error.status < 500)) throw error;
      skipped.push({ date: p.date, time: p.time, code: error.code ?? 'ERROR', message: error.message });
    }
  }
  return { created, skipped, template };
}

// ——— changing a class ———

/**
 * Move (start and/or trainer — every live attendee follows and is told), resize the seats (never below the
 * attendees already in), note, or cancel (every live attendee is cancelled with the reason). Returns the fresh
 * class, the attendees it touched (each with `previousStatus`), and what happened for the caller's pushes.
 */
export async function updateClass({ businessId, id, patch = {}, actorUserId = null, now = new Date() }, db = prisma) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}))`;
    const [row] = await tx.$queryRaw`${CLASS_SELECT} WHERE c.id = ${String(id ?? '')} AND c."businessId" = ${businessId}`;
    if (!row) throw bookError(404, 'კლასი ვერ მოიძებნა.', 'CLASS_NOT_FOUND', 'Class not found.');
    const sets = [];
    let startsAt = new Date(row.startsAt);
    let staffId = row.staffId;
    const duration = (new Date(row.endsAt).getTime() - startsAt.getTime()) / MIN;
    if (patch.startsAt !== undefined) {
      startsAt = new Date(patch.startsAt);
      if (Number.isNaN(startsAt.getTime())) throw bookError(400, 'არასწორი დრო.', 'BAD_TIME', 'Invalid time.');
    }
    if (patch.staffId !== undefined) staffId = (await trainerOf(tx, businessId, patch.staffId)).id;
    const endsAt = new Date(startsAt.getTime() + duration * MIN);
    const moved = startsAt.getTime() !== new Date(row.startsAt).getTime() || staffId !== row.staffId;
    const cancel = patch.status === 'CANCELLED';
    if (row.status === 'CANCELLED' && (moved || cancel || patch.seats !== undefined)) throw bookError(409, 'ეს კლასი გაუქმებულია.', 'CLASS_CANCELLED', 'This class was cancelled.');
    if (patch.seats !== undefined) {
      const n = clampSeats(patch.seats);
      if (n < 2) throw bookError(400, 'კლასს 2 ან მეტი ადგილი სჭირდება.', 'CLASS_SEATS', 'A class needs 2 or more seats.');
      if (n < Number(row.booked)) throw bookError(409, `კლასში უკვე ${row.booked} მონაწილეა — ადგილები ამაზე ნაკლები ვერ იქნება.`, 'CLASS_SEATS_TAKEN', `The class already has ${row.booked} attendees — seats cannot go below that.`);
      sets.push(sql`seats = ${n}`);
    }
    if (patch.note !== undefined) sets.push(sql`note = ${cleanText(patch.note, 300)}`);
    if (moved) {
      if (!patch.force) {
        const blockers = await blockersAround(tx, businessId, new Date(startsAt.getTime() - 4 * 3600_000), new Date(endsAt.getTime() + 4 * 3600_000), { exceptClassId: row.id });
        const clash = findConflict(blockers, { staffId, startsAt, endsAt });
        if (clash) throw bookError(409, 'ამ დროს მწვრთნელს სხვა ჩანაწერი აქვს.', 'SLOT_TAKEN', 'The trainer already has another appointment then.');
        const resourceIds = Array.isArray(row.resourceIds) ? row.resourceIds : [];
        if (resourceIds.length) {
          const resources = await tx.$queryRaw`SELECT id, name, kind, capacity, active FROM "BookResource" WHERE "businessId" = ${businessId} AND active`;
          const full = resourceConflict(blockers, resources, { resourceIds, startsAt, endsAt });
          if (full) throw bookError(409, `ამ დროს „${full.resource.name}“ დაკავებულია.`, 'RESOURCE_TAKEN', `"${full.resource.name}" is taken at this time.`);
        }
      }
      sets.push(sql`"startsAt" = ${startsAt}`, sql`"endsAt" = ${endsAt}`, sql`"staffId" = ${staffId}`);
    }
    if (cancel) sets.push(sql`status = 'CANCELLED'`, sql`"cancelReason" = ${cleanText(patch.cancelReason, 300)}`, sql`"cancelledAt" = CURRENT_TIMESTAMP`);
    if (!sets.length) return { cls: classPublic(row), attendees: [], moved: false, cancelled: false, previousStartsAt: row.startsAt };
    sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
    await tx.$executeRaw`UPDATE "BookClass" SET ${join(sets, ', ')} WHERE id = ${row.id}`;
    // The live attendees follow the class.
    const live = (moved || cancel) ? await tx.$queryRaw`SELECT id, status FROM "BookAppointment" WHERE "classId" = ${row.id} AND status IN ('PENDING', 'CONFIRMED')` : [];
    if (live.length) {
      const ids = live.map((x) => x.id);
      if (moved) await tx.$executeRaw`UPDATE "BookAppointment" SET "startsAt" = ${startsAt}, "endsAt" = ${endsAt}, "staffId" = ${staffId}, "remindedDay" = FALSE, "remindedSoon" = FALSE, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${join(ids)})`;
      if (cancel) await tx.$executeRaw`UPDATE "BookAppointment" SET status = 'CANCELLED', "cancelledBy" = 'BUSINESS', "cancelReason" = ${cleanText(patch.cancelReason, 300)}, "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id IN (${join(ids)})`;
    }
    const previous = new Map(live.map((x) => [x.id, x.status]));
    const touched = live.length ? await tx.$queryRaw`${APPOINTMENT_SELECT} WHERE a.id IN (${join(live.map((x) => x.id))})` : [];
    const [fresh] = await tx.$queryRaw`${CLASS_SELECT} WHERE c.id = ${row.id}`;
    const by = await attendeesFor([row.id], tx);
    return {
      cls: classPublic({ ...fresh, attendees: by.get(row.id) ?? [] }),
      attendees: touched.map((a) => ({ ...appointmentPublic(a), previousStatus: previous.get(a.id) ?? null })),
      moved,
      cancelled: cancel,
      previousStartsAt: row.startsAt,
    };
  }, { timeout: 20_000 });
}

/** An empty class (no live attendee) may be deleted outright; one with attendees is cancelled instead. */
export async function deleteClass({ businessId, id }, db = prisma) {
  const [row] = await db.$queryRaw`SELECT c.id, (SELECT COUNT(*)::int FROM "BookAppointment" x WHERE x."classId" = c.id AND x.status <> 'CANCELLED') AS booked FROM "BookClass" c WHERE c.id = ${String(id ?? '')} AND c."businessId" = ${businessId}`;
  if (!row) throw bookError(404, 'კლასი ვერ მოიძებნა.', 'CLASS_NOT_FOUND', 'Class not found.');
  if (Number(row.booked) > 0) throw bookError(409, 'კლასში მონაწილეები არიან — ჯერ გააუქმე.', 'CLASS_NOT_EMPTY', 'The class has attendees — cancel it instead.');
  await db.$executeRaw`DELETE FROM "BookClass" WHERE id = ${row.id}`;
}
