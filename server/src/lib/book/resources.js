/**
 * MEDIBOOK rooms and equipment (ოთახები): the treatment rooms, chairs, lasers and X-ray units a visit needs.
 * A service may need several (`BookServiceResource`); a resource has a capacity — how many visits may use it at
 * once, 1 by default. The availability engine (availability.js `resourceConflict`) refuses a start while every unit
 * of a needed resource is held by overlapping live appointments, and each appointment remembers the resources it
 * holds (`BookAppointment.resourceIds`). This file: the rows, the service links, today's load per resource.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, dayRanges, newId } from './catalog.js';
import { businessRow } from './store.js';
import { addDaysYmd, tbilisiInstant, tbilisiYmd, weekdayOfYmd } from './time.js';
import { classBlocks } from './availability.js';

const sql = Prisma.sql;
const join = Prisma.join;
const MIN = 60_000;
export const RESOURCE_KINDS = Object.freeze(['ROOM', 'EQUIPMENT']);

const cleanText = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const notFound = () => bookError(404, 'ოთახი ან აპარატი ვერ მოიძებნა.', 'RESOURCE_NOT_FOUND', 'Room or device not found.');
const nameRequired = () => bookError(400, 'მიუთითე ოთახის ან აპარატის სახელი.', 'NAME_REQUIRED', 'Enter the room or device name.');

/** Resource ids as stored: unique non-empty strings, at most 20. */
export function normalizeResourceIds(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(list.map((v) => String(v ?? '').trim()).filter(Boolean))].slice(0, 20);
}

export function sanitizeResource(input = {}) {
  const out = {};
  if (input.name !== undefined) out.name = cleanText(input.name, 80);
  if (input.kind !== undefined) out.kind = RESOURCE_KINDS.includes(String(input.kind ?? '').toUpperCase()) ? String(input.kind).toUpperCase() : 'ROOM';
  if (input.capacity !== undefined) out.capacity = Math.max(1, Math.min(50, Math.round(Number(input.capacity) || 1)));
  if (input.note !== undefined) out.note = cleanText(input.note, 200);
  if (input.active !== undefined) out.active = Boolean(input.active);
  if (input.sortOrder !== undefined) out.sortOrder = Math.max(0, Math.min(999, Math.round(Number(input.sortOrder) || 0)));
  return out;
}

export function resourcePublic(r) {
  return { id: r.id, name: r.name, kind: r.kind, capacity: Math.max(1, Number(r.capacity) || 1), note: r.note ?? null, active: Boolean(r.active), sortOrder: Number(r.sortOrder ?? 0), createdAt: r.createdAt };
}

/** Minutes of [s, e) that fall inside [from, to). */
const overlap = (s, e, from, to) => Math.max(0, Math.min(e, to) - Math.max(s, from)) / MIN;

/**
 * One day's load of every resource (pure): booked = the overlap of the live appointments that hold it with the day,
 * working = the business's hours that day × capacity. `date` is a Tbilisi day.
 */
export function dayLoad({ resources, appointments = [], businessHours, date }) {
  const dayStart = tbilisiInstant(date, 0).getTime();
  const dayEnd = tbilisiInstant(addDaysYmd(date, 1), 0).getTime();
  const open = dayRanges(businessHours, weekdayOfYmd(date)).reduce((sum, [a, b]) => sum + (b - a), 0);
  return (resources ?? []).map((r) => {
    const capacity = Math.max(1, Number(r.capacity) || 1);
    const mine = appointments.filter((a) => a.status !== 'CANCELLED' && Array.isArray(a.resourceIds) && a.resourceIds.includes(r.id));
    const booked = Math.round(mine.reduce((sum, a) => sum + overlap(new Date(a.startsAt).getTime(), new Date(a.endsAt).getTime(), dayStart, dayEnd), 0));
    const working = open * capacity;
    return { id: r.id, bookedMinutes: booked, workingMinutes: working, appointments: mine.length, load: working > 0 ? Math.min(100, Math.round((booked / working) * 100)) : null };
  });
}

/** Every resource with the services that need it and today's load. */
export async function listResources(businessId, { all = false, now = new Date() } = {}, db = prisma) {
  const date = tbilisiYmd(now);
  const dayStart = tbilisiInstant(date, 0);
  const dayEnd = tbilisiInstant(addDaysYmd(date, 1), 0);
  const [rows, links, today, classesToday, business] = await Promise.all([
    db.$queryRaw`SELECT * FROM "BookResource" WHERE "businessId" = ${businessId} ${all ? Prisma.empty : sql`AND active`} ORDER BY "sortOrder", name`,
    db.$queryRaw`SELECT l."resourceId", s.id, s.name, s."nameKa", s."group" FROM "BookServiceResource" l JOIN "BookService" s ON s.id = l."serviceId" WHERE l."businessId" = ${businessId} AND s.active ORDER BY s."group" NULLS LAST, s."sortOrder", s.name`,
    db.$queryRaw`SELECT id, status, "startsAt", "endsAt", "resourceIds" FROM "BookAppointment" WHERE "businessId" = ${businessId} AND status <> 'CANCELLED' AND "endsAt" > ${dayStart} AND "startsAt" < ${dayEnd} AND "resourceIds" <> '[]'::jsonb`,
    // A group class holds its room once, whatever the number of attendees.
    db.$queryRaw`SELECT id, "staffId", status, "startsAt", "endsAt", "resourceIds" FROM "BookClass" WHERE "businessId" = ${businessId} AND status = 'OPEN' AND "endsAt" > ${dayStart} AND "startsAt" < ${dayEnd} AND "resourceIds" <> '[]'::jsonb`,
    businessRow(businessId, db),
  ]);
  const load = new Map(dayLoad({ resources: rows, appointments: [...today, ...classBlocks(classesToday)], businessHours: business?.hours, date }).map((x) => [x.id, x]));
  return rows.map((r) => ({
    ...resourcePublic(r),
    services: links.filter((l) => l.resourceId === r.id).map((l) => ({ id: l.id, name: l.nameKa && l.nameKa.trim() ? l.nameKa : l.name, group: l.group ?? null })),
    today: load.get(r.id) ?? null,
  }));
}

export async function createResource(businessId, input, db = prisma) {
  const r = sanitizeResource(input);
  if (!r.name) throw nameRequired();
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookResource" (id, "businessId", name, kind, capacity, note, active, "sortOrder")
    VALUES (${id}, ${businessId}, ${r.name}, ${r.kind ?? 'ROOM'}, ${r.capacity ?? 1}, ${r.note ?? null}, ${r.active ?? true}, ${r.sortOrder ?? 0})`;
  return (await listResources(businessId, { all: true }, db)).find((x) => x.id === id) ?? null;
}

export async function updateResource(businessId, id, input, db = prisma) {
  const r = sanitizeResource(input);
  if (r.name === null) throw nameRequired();
  const sets = Object.entries(r).map(([k, v]) => sql`${Prisma.raw(`"${k}"`)} = ${v}`);
  if (!sets.length) throw bookError(400, 'შესაცვლელი არაფერია.', 'NOTHING_TO_UPDATE', 'Nothing to update.');
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookResource" SET ${join(sets, ', ')} WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
  if (!n) throw notFound();
  return (await listResources(businessId, { all: true }, db)).find((x) => x.id === id) ?? null;
}

/** Retiring a resource frees its services (they no longer need it); past bookings keep their history. */
export async function deactivateResource(businessId, id, db = prisma) {
  await db.$transaction(async (tx) => {
    const n = await tx.$executeRaw`UPDATE "BookResource" SET active = FALSE, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${String(id)} AND "businessId" = ${businessId}`;
    if (!n) throw notFound();
    await tx.$executeRaw`DELETE FROM "BookServiceResource" WHERE "resourceId" = ${String(id)}`;
  });
}

/** Replace what a service needs. Every id must be one of this business's live rooms / devices. Returns the ids as stored. */
export async function setServiceResources({ businessId, serviceId, resourceIds }, db = prisma) {
  const wanted = normalizeResourceIds(resourceIds);
  return db.$transaction(async (tx) => {
    const [svc] = await tx.$queryRaw`SELECT id FROM "BookService" WHERE id = ${String(serviceId ?? '')} AND "businessId" = ${businessId}`;
    if (!svc) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
    if (wanted.length) {
      const found = await tx.$queryRaw`SELECT id FROM "BookResource" WHERE "businessId" = ${businessId} AND active AND id IN (${join(wanted)})`;
      if (found.length !== wanted.length) throw notFound();
    }
    await tx.$executeRaw`DELETE FROM "BookServiceResource" WHERE "serviceId" = ${svc.id}`;
    for (const rid of wanted) await tx.$executeRaw`INSERT INTO "BookServiceResource" (id, "businessId", "serviceId", "resourceId") VALUES (${newId()}, ${businessId}, ${svc.id}, ${rid})`;
    return wanted;
  });
}
