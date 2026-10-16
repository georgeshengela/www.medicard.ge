/**
 * MEDIBOOK client card: everything a business knows about one person in one place — personal fields (birthday,
 * gender, source, address, preferred person), a segment card (JSON: anamnesis, allergies, tooth chart, skin type,
 * hair type…), numbers derived from the visits (average check, cadence, days since the last visit, the favourite
 * service and person), dated notes with an author (plain notes, colour formulas, injection log), private photos and
 * documents, payments and product sales. Health data stays in the row and in the member-only routes — never in URLs.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, newId } from './catalog.js';
import { clientPublic, appointmentPublic, APPOINTMENT_SELECT } from './bookings.js';
import { salePublic } from './products.js';

const sql = Prisma.sql;
const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const cleanText = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const toIso = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
const dayOf = (v) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export const CLIENT_SOURCES = Object.freeze(['APP', 'WALK_IN', 'PHONE', 'INSTAGRAM', 'FACEBOOK', 'REFERRAL', 'OTHER']);
export const GENDERS = Object.freeze(['F', 'M', 'OTHER']);
export const NOTE_KINDS = Object.freeze(['NOTE', 'FORMULA', 'INJECTION', 'TREATMENT']);
export const FILE_KINDS = Object.freeze(['PHOTO', 'BEFORE', 'AFTER', 'DOC']);
const CARD_MAX_BYTES = 60_000;

/** The card's own fields on top of clientPublic. */
export function clientCardPublic(r) {
  const base = clientPublic(r);
  return {
    ...base,
    birthday: dayOf(r.birthday),
    gender: GENDERS.includes(r.gender) ? r.gender : null,
    source: CLIENT_SOURCES.includes(r.source) ? r.source : base.inApp ? 'APP' : null,
    address: r.address ?? null,
    preferredStaffId: r.preferredStaffId ?? null,
    card: r.card && typeof r.card === 'object' ? r.card : {},
  };
}

/** Numbers a receptionist wants at a glance, derived from this client's appointments. */
export function statsFrom(client, appointments, { now = new Date() } = {}) {
  const done = appointments.filter((a) => a.status === 'COMPLETED').sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const upcoming = appointments.filter((a) => ['PENDING', 'CONFIRMED'].includes(a.status) && new Date(a.endsAt) > now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;
  const top = (key) => { const m = new Map(); for (const a of done) if (a[key]) m.set(a[key], (m.get(a[key]) || 0) + 1); const best = [...m.entries()].sort((x, y) => y[1] - x[1])[0]; return best ? { name: best[0], count: best[1] } : null; };
  const gaps = [];
  for (let i = 1; i < done.length; i += 1) gaps.push((new Date(done[i].startsAt) - new Date(done[i - 1].startsAt)) / 86_400_000);
  const cadenceDays = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;
  const lastAt = done.length ? done[done.length - 1].startsAt : client.lastVisitAt;
  const daysSinceLast = lastAt ? Math.floor((now - new Date(lastAt)) / 86_400_000) : null;
  const visits = Number(client.visits || 0);
  const spent = Number(client.totalSpent || 0);
  const dueAt = cadenceDays && lastAt ? new Date(new Date(lastAt).getTime() + cadenceDays * 86_400_000).toISOString() : null;
  return {
    visits, noShows: Number(client.noShows || 0), cancelled, totalSpent: n2(spent), avgCheck: visits ? n2(spent / visits) : 0,
    firstVisitAt: toIso(client.firstVisitAt), lastVisitAt: toIso(lastAt), daysSinceLast, nextAt: upcoming[0]?.startsAt ?? null, upcomingCount: upcoming.length,
    cadenceDays, dueAt, overdue: Boolean(dueAt && !upcoming.length && new Date(dueAt) < now),
    favouriteService: top('serviceName'), favouriteStaff: top('staffName'),
    noShowRate: visits + Number(client.noShows || 0) ? Math.round((Number(client.noShows || 0) / (visits + Number(client.noShows || 0))) * 100) : 0,
  };
}

/** The whole card in one call. */
export async function clientProfile({ businessId, clientId }, db = prisma) {
  const [row] = await db.$queryRaw`SELECT c.*, s.name AS "preferredStaffName" FROM "BookClient" c LEFT JOIN "BookStaff" s ON s.id = c."preferredStaffId" WHERE c.id = ${String(clientId)} AND c."businessId" = ${businessId}`;
  if (!row) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const [appointments, reviews, notes, files, sales] = await Promise.all([
    db.$queryRaw`${APPOINTMENT_SELECT} WHERE a."clientId" = ${row.id} ORDER BY a."startsAt" DESC LIMIT 300`,
    db.$queryRaw`SELECT r.id, r.rating, r.text, r.reply, r."createdAt", r."appointmentId", a."serviceName" FROM "BookReview" r JOIN "BookAppointment" a ON a.id = r."appointmentId" WHERE a."clientId" = ${row.id} ORDER BY r."createdAt" DESC LIMIT 20`,
    db.$queryRaw`SELECT n.*, u."fullName" AS "byName" FROM "BookClientNote" n LEFT JOIN "User" u ON u.id = n."createdBy" WHERE n."clientId" = ${row.id} ORDER BY n."createdAt" DESC LIMIT 200`,
    db.$queryRaw`SELECT f.id, f.kind, f.caption, f."appointmentId", f."createdAt", f."createdBy", i.width, i.height, u."fullName" AS "byName" FROM "BookClientFile" f JOIN "BookImage" i ON i.id = f."imageId" LEFT JOIN "User" u ON u.id = f."createdBy" WHERE f."clientId" = ${row.id} ORDER BY f."createdAt" DESC LIMIT 200`,
    db.$queryRaw`SELECT s.*, st.name AS "staffName" FROM "BookSale" s LEFT JOIN "BookStaff" st ON st.id = s."staffId" WHERE s."clientId" = ${row.id} ORDER BY s.at DESC LIMIT 100`,
  ]);
  const client = { ...clientCardPublic(row), preferredStaffName: row.preferredStaffName ?? null };
  const pub = appointments.map((a) => appointmentPublic(a));
  const payments = pub.filter((a) => a.status === 'COMPLETED').map((a) => ({ appointmentId: a.id, at: a.startsAt, serviceName: a.serviceName, staffName: a.staffName ?? null, amount: a.paidAmount != null ? Number(a.paidAmount) : a.price != null ? Number(a.price) : 0, method: a.paidMethod ?? null, parts: a.paidParts ?? null }));
  return {
    client,
    stats: statsFrom(client, pub),
    appointments: pub,
    reviews: reviews.map((r) => ({ ...r, createdAt: toIso(r.createdAt) })),
    notes: notes.map(notePublic),
    files: files.map(filePublic),
    sales: sales.map(salePublic),
    payments,
  };
}

const notePublic = (n) => ({ id: n.id, kind: NOTE_KINDS.includes(n.kind) ? n.kind : 'NOTE', text: n.text ?? null, data: n.data && typeof n.data === 'object' ? n.data : {}, appointmentId: n.appointmentId ?? null, byName: n.byName ?? null, createdBy: n.createdBy ?? null, createdAt: toIso(n.createdAt) });
const filePublic = (f) => ({ id: f.id, kind: FILE_KINDS.includes(f.kind) ? f.kind : 'PHOTO', caption: f.caption ?? null, appointmentId: f.appointmentId ?? null, width: f.width ?? null, height: f.height ?? null, byName: f.byName ?? null, createdBy: f.createdBy ?? null, createdAt: toIso(f.createdAt) });

/** Personal fields and the segment card. `card` merges key by key (a page sends only the keys it edits). */
export async function updateClientCard({ businessId, clientId, patch = {} }, db = prisma) {
  const sets = [];
  if (patch.birthday !== undefined) {
    const d = patch.birthday ? String(patch.birthday).slice(0, 10) : null;
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw bookError(400, 'არასწორი თარიღი.', 'BAD_DATE', 'Invalid date.');
    sets.push(d ? sql`birthday = ${d}::date` : sql`birthday = NULL`);
  }
  if (patch.gender !== undefined) sets.push(sql`gender = ${GENDERS.includes(patch.gender) ? patch.gender : null}`);
  if (patch.source !== undefined) sets.push(sql`source = ${CLIENT_SOURCES.includes(patch.source) ? patch.source : null}`);
  if (patch.address !== undefined) sets.push(sql`address = ${cleanText(patch.address, 200)}`);
  if (patch.preferredStaffId !== undefined) {
    const id = cleanText(patch.preferredStaffId, 64);
    if (id) {
      const [s] = await db.$queryRaw`SELECT id FROM "BookStaff" WHERE id = ${id} AND "businessId" = ${businessId}`;
      if (!s) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Person not found.');
    }
    sets.push(sql`"preferredStaffId" = ${id}`);
  }
  if (patch.card !== undefined) {
    if (!patch.card || typeof patch.card !== 'object' || Array.isArray(patch.card)) throw bookError(400, 'ბარათის ფორმატი არასწორია.', 'BAD_CARD', 'Bad card payload.');
    const text = JSON.stringify(patch.card);
    if (text.length > CARD_MAX_BYTES) throw bookError(400, 'ბარათი ძალიან დიდია.', 'CARD_TOO_BIG', 'The card is too large.');
    sets.push(sql`card = card || ${text}::jsonb`);
  }
  if (!sets.length) return null;
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookClient" SET ${Prisma.join(sets, ', ')} WHERE id = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const [row] = await db.$queryRaw`SELECT * FROM "BookClient" WHERE id = ${String(clientId)}`;
  return clientCardPublic(row);
}

// ——— notes ———

export async function addNote({ businessId, clientId, kind = 'NOTE', text = null, data = {}, appointmentId = null, actorUserId = null }, db = prisma) {
  const [c] = await db.$queryRaw`SELECT id FROM "BookClient" WHERE id = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!c) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const k = NOTE_KINDS.includes(kind) ? kind : 'NOTE';
  const body = cleanText(text, 4000);
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  if (!body && !Object.keys(payload).length) throw bookError(400, 'ჩაწერე ტექსტი.', 'TEXT_REQUIRED', 'Write something.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookClientNote" (id, "businessId", "clientId", kind, text, data, "appointmentId", "createdBy") VALUES (${id}, ${businessId}, ${c.id}, ${k}, ${body}, ${JSON.stringify(payload)}::jsonb, ${appointmentId ? String(appointmentId) : null}, ${actorUserId})`;
  const [row] = await db.$queryRaw`SELECT n.*, u."fullName" AS "byName" FROM "BookClientNote" n LEFT JOIN "User" u ON u.id = n."createdBy" WHERE n.id = ${id}`;
  return notePublic(row);
}

export async function deleteNote({ businessId, clientId, noteId, actorUserId = null, manage = false }, db = prisma) {
  const [n] = await db.$queryRaw`SELECT id, "createdBy" FROM "BookClientNote" WHERE id = ${String(noteId)} AND "clientId" = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'ჩანაწერი ვერ მოიძებნა.', 'NOTE_NOT_FOUND', 'Note not found.');
  if (!manage && n.createdBy !== actorUserId) throw bookError(403, 'მხოლოდ ავტორი ან მენეჯერი შლის.', 'NOT_YOURS', 'Only the author or a manager may delete it.');
  await db.$executeRaw`DELETE FROM "BookClientNote" WHERE id = ${n.id}`;
}

// ——— files (private images) ———

/** A private picture on the card: never counted against the business's 24 public pictures, never served publicly. */
export async function addFile({ businessId, clientId, buffer, mime = 'image/jpeg', width = null, height = null, kind = 'PHOTO', caption = null, appointmentId = null, actorUserId = null }, db = prisma) {
  const [c] = await db.$queryRaw`SELECT id FROM "BookClient" WHERE id = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!c) throw bookError(404, 'კლიენტი ვერ მოიძებნა.', 'CLIENT_NOT_FOUND', 'Client not found.');
  const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookClientFile" WHERE "clientId" = ${c.id}`;
  if (Number(n) >= 60) throw bookError(400, 'ერთ ბარათზე მაქსიმუმ 60 ფაილი.', 'TOO_MANY_FILES', 'Up to 60 files per card.');
  const imageId = newId();
  const fileId = newId();
  await db.$executeRawUnsafe(
    `INSERT INTO "BookImage" (id, "businessId", mime, bytes, size, width, height, "createdBy", private) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
    imageId, businessId, mime, buffer, buffer.length, width, height, actorUserId,
  );
  await db.$executeRaw`INSERT INTO "BookClientFile" (id, "businessId", "clientId", "imageId", kind, caption, "appointmentId", "createdBy") VALUES (${fileId}, ${businessId}, ${c.id}, ${imageId}, ${FILE_KINDS.includes(kind) ? kind : 'PHOTO'}, ${cleanText(caption, 200)}, ${appointmentId ? String(appointmentId) : null}, ${actorUserId})`;
  const [row] = await db.$queryRaw`SELECT f.id, f.kind, f.caption, f."appointmentId", f."createdAt", f."createdBy", i.width, i.height, u."fullName" AS "byName" FROM "BookClientFile" f JOIN "BookImage" i ON i.id = f."imageId" LEFT JOIN "User" u ON u.id = f."createdBy" WHERE f.id = ${fileId}`;
  return filePublic(row);
}

export async function updateFile({ businessId, clientId, fileId, caption, kind }, db = prisma) {
  const sets = [];
  if (caption !== undefined) sets.push(sql`caption = ${cleanText(caption, 200)}`);
  if (kind !== undefined) sets.push(sql`kind = ${FILE_KINDS.includes(kind) ? kind : 'PHOTO'}`);
  if (!sets.length) throw bookError(400, 'შესაცვლელი არაფერია.', 'NOTHING_TO_UPDATE', 'Nothing to update.');
  const n = await db.$executeRaw`UPDATE "BookClientFile" SET ${Prisma.join(sets, ', ')} WHERE id = ${String(fileId)} AND "clientId" = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'ფაილი ვერ მოიძებნა.', 'FILE_NOT_FOUND', 'File not found.');
}

export async function deleteFile({ businessId, clientId, fileId, actorUserId = null, manage = false }, db = prisma) {
  const [f] = await db.$queryRaw`SELECT id, "imageId", "createdBy" FROM "BookClientFile" WHERE id = ${String(fileId)} AND "clientId" = ${String(clientId)} AND "businessId" = ${businessId}`;
  if (!f) throw bookError(404, 'ფაილი ვერ მოიძებნა.', 'FILE_NOT_FOUND', 'File not found.');
  if (!manage && f.createdBy !== actorUserId) throw bookError(403, 'მხოლოდ ავტორი ან მენეჯერი შლის.', 'NOT_YOURS', 'Only the author or a manager may delete it.');
  await db.$executeRaw`DELETE FROM "BookImage" WHERE id = ${f.imageId}`;
}

/** The bytes of one card file, for the member-only route (the panel fetches with its token and shows a blob URL). */
export async function fileBytes({ businessId, clientId, fileId }, db = prisma) {
  const [row] = await db.$queryRaw`SELECT i.mime, i.bytes FROM "BookClientFile" f JOIN "BookImage" i ON i.id = f."imageId" WHERE f.id = ${String(fileId)} AND f."clientId" = ${String(clientId)} AND f."businessId" = ${businessId}`;
  if (!row) throw bookError(404, 'ფაილი ვერ მოიძებნა.', 'FILE_NOT_FOUND', 'File not found.');
  return { mime: row.mime, bytes: Buffer.from(row.bytes) };
}

// ——— birthdays (the dashboard and, later, greetings) ———

/** Clients whose birthday falls in the next `days` days (today included), with the age they turn. */
export async function upcomingBirthdays(businessId, { days = 7, now = new Date() } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT id, name, phone, birthday, visits FROM "BookClient" WHERE "businessId" = ${businessId} AND birthday IS NOT NULL`;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const out = [];
  for (const r of rows) {
    const b = new Date(r.birthday);
    let next = new Date(Date.UTC(start.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
    if (next < start) next = new Date(Date.UTC(start.getUTCFullYear() + 1, b.getUTCMonth(), b.getUTCDate()));
    const inDays = Math.round((next - start) / 86_400_000);
    if (inDays <= days) out.push({ id: r.id, name: r.name, phone: r.phone ?? null, birthday: dayOf(r.birthday), inDays, turns: next.getUTCFullYear() - b.getUTCFullYear(), visits: Number(r.visits || 0) });
  }
  return out.sort((a, b) => a.inDays - b.inDays || b.visits - a.visits);
}
