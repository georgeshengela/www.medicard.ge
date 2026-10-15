/**
 * MEDIBOOK branches: several locations of one brand. A `BookGroup` ties them; every location stays a full business
 * (its own calendar, team, clients, money, settings). The owner adds a branch from an existing one (contacts,
 * category, hours and services copied, live at once — a verified business needs no second review), links another
 * business they own, copies services between branches and compares them over a period. Clients see the other
 * locations on a business page, nearest first.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { bookError, businessCard, distanceKm, newId, normalizeSettings, slugFor } from './catalog.js';
import { businessRow, requireBusiness, sanitizeBusinessInput } from './store.js';
import { analyticsRaw } from './bookings.js';
import { buildAnalytics, periodFor } from './analytics.js';

const sql = Prisma.sql;
const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;

export function branchPublic(r) {
  return {
    id: r.id, slug: r.slug, name: r.nameKa || r.name, nameEn: r.name, category: r.category, address: r.addressKa || r.address || null, city: r.city ?? null, district: r.district ?? null,
    phone: r.phone ?? null, status: r.status, lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng), createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

/** The group of a business and every location in it (the business itself first). */
export async function groupOf(businessId, db = prisma) {
  const row = await requireBusiness(businessId, db);
  if (!row.groupId) return { group: null, branches: [branchPublic(row)] };
  const [group] = await db.$queryRaw`SELECT * FROM "BookGroup" WHERE id = ${row.groupId}`;
  const rows = await db.$queryRaw`SELECT * FROM "BookBusiness" WHERE "groupId" = ${row.groupId} AND status <> 'HIDDEN' ORDER BY (id = ${row.id}) DESC, "createdAt" ASC`;
  return { group: group ? { id: group.id, name: group.name, ownerUserId: group.ownerUserId ?? null } : null, branches: rows.map(branchPublic) };
}

/** A group named after the business, made on first use. */
export async function ensureGroup({ businessId, userId }, db = prisma) {
  const row = await requireBusiness(businessId, db);
  if (row.groupId) {
    const [g] = await db.$queryRaw`SELECT * FROM "BookGroup" WHERE id = ${row.groupId}`;
    if (g) return g;
  }
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookGroup" (id, name, "ownerUserId") VALUES (${id}, ${row.nameKa || row.name}, ${userId ?? row.ownerUserId ?? null})`;
  await db.$executeRaw`UPDATE "BookBusiness" SET "groupId" = ${id}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${row.id}`;
  const [g] = await db.$queryRaw`SELECT * FROM "BookGroup" WHERE id = ${id}`;
  return g;
}

/** Owner check for the branch operations: the person must be OWNER of the business. */
export async function requireOwner(userId, businessId, db = prisma) {
  const [m] = await db.$queryRaw`SELECT role FROM "BookMember" WHERE "userId" = ${userId} AND "businessId" = ${businessId}`;
  if (!m || m.role !== 'OWNER') throw bookError(403, 'ფილიალების მართვა მფლობელის უფლებაა.', 'OWNER_REQUIRED', 'Only the owner manages branches.');
  return m;
}

/** Copy the services of one location to another; names already there are skipped. Returns how many. */
export async function copyServices({ fromId, toId }, db = prisma) {
  const [from, to] = await Promise.all([
    db.$queryRaw`SELECT * FROM "BookService" WHERE "businessId" = ${fromId} AND active ORDER BY "sortOrder", name`,
    db.$queryRaw`SELECT name, "nameKa" FROM "BookService" WHERE "businessId" = ${toId}`,
  ]);
  const have = new Set(to.flatMap((s) => [s.name, s.nameKa].filter(Boolean).map((v) => v.trim().toLowerCase())));
  let copied = 0;
  for (const s of from) {
    const key = (s.nameKa || s.name).trim().toLowerCase();
    if (have.has(key) || have.has(String(s.name).trim().toLowerCase())) continue;
    await db.$executeRaw`INSERT INTO "BookService" (id, "businessId", "group", name, "nameKa", description, "durationMin", "bufferMin", price, "priceTo", currency, online, active, "sortOrder")
      VALUES (${newId()}, ${toId}, ${s.group ?? null}, ${s.name}, ${s.nameKa ?? null}, ${s.description ?? null}, ${s.durationMin}, ${s.bufferMin}, ${s.price}, ${s.priceTo}, ${s.currency ?? 'GEL'}, ${s.online}, TRUE, ${s.sortOrder ?? 0})`;
    have.add(key);
    copied += 1;
  }
  return copied;
}

/**
 * A new location of a verified business: contacts, category, description, settings (and hours, services when
 * asked) come from the source; it is CLAIMED at once with the same owner, inside the source's group.
 */
export async function registerBranch({ businessId, userId, input = {} }, db = prisma) {
  const source = await requireBusiness(businessId, db);
  if (source.status !== 'CLAIMED') throw bookError(409, 'ფილიალი მხოლოდ დადასტურებულ ბიზნესს ემატება.', 'NOT_CLAIMED', 'Branches are added to a verified business only.');
  const data = sanitizeBusinessInput({
    nameKa: input.nameKa, name: input.name || input.nameKa, category: source.category, phone: input.phone ?? source.phone, email: source.email, website: source.website, instagram: source.instagram, facebook: source.facebook,
    address: input.address, addressKa: input.addressKa ?? input.address, city: input.city, district: input.district, lat: input.lat, lng: input.lng, description: source.description, descriptionKa: source.descriptionKa, tags: Array.isArray(source.tags) ? source.tags : [],
    hours: input.copyHours === false ? {} : source.hours,
  });
  if (!data.name) throw bookError(400, 'მიუთითე ფილიალის სახელი.', 'NAME_REQUIRED', 'Enter the branch name.');
  if (data.lat == null || data.lng == null) throw bookError(400, 'მიუთითე ფილიალის მისამართი რუკაზე.', 'LOCATION_REQUIRED', 'Set the branch address on the map.');
  const group = await ensureGroup({ businessId: source.id, userId }, db);
  const id = newId();
  const slug = slugFor(data.nameKa || data.name, id);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "BookBusiness" (id, slug, name, "nameKa", category, tags, description, "descriptionKa", phone, email, website, instagram, facebook, address, "addressKa", city, district, lat, lng, hours, settings, source, status, "ownerUserId", "claimedAt", "groupId")
      VALUES (${id}, ${slug}, ${data.name}, ${data.nameKa ?? null}, ${source.category}, ${JSON.stringify(data.tags ?? [])}::jsonb, ${data.description ?? null}, ${data.descriptionKa ?? null}, ${data.phone ?? null}, ${data.email ?? null}, ${data.website ?? null}, ${data.instagram ?? null}, ${data.facebook ?? null},
        ${data.address ?? null}, ${data.addressKa ?? null}, ${data.city ?? null}, ${data.district ?? null}, ${data.lat}, ${data.lng}, ${JSON.stringify(data.hours ?? {})}::jsonb, ${JSON.stringify(normalizeSettings(source.settings))}::jsonb, 'OWNER', 'CLAIMED', ${userId}, CURRENT_TIMESTAMP, ${group.id})`;
    await tx.$executeRaw`INSERT INTO "BookMember" (id, "businessId", "userId", role) VALUES (${newId()}, ${id}, ${userId}, 'OWNER')`;
    if (input.copyServices !== false) await copyServices({ fromId: source.id, toId: id }, tx);
  });
  return businessRow(id, db);
}

/** Put another business the person owns into this one's group. */
export async function linkBranch({ businessId, otherId, userId }, db = prisma) {
  if (businessId === otherId) throw bookError(400, 'ეს იგივე ბიზნესია.', 'SAME_BUSINESS', 'That is the same business.');
  await requireOwner(userId, otherId, db);
  const other = await requireBusiness(otherId, db);
  const group = await ensureGroup({ businessId, userId }, db);
  if (other.groupId && other.groupId !== group.id) {
    const [n] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookBusiness" WHERE "groupId" = ${other.groupId}`;
    if ((n?.n ?? 0) > 1) throw bookError(409, 'ეს ბიზნესი უკვე სხვა ქსელშია — ჯერ იქიდან გათიშე.', 'IN_OTHER_GROUP', 'That business is already in another chain — unlink it there first.');
  }
  await db.$executeRaw`UPDATE "BookBusiness" SET "groupId" = ${group.id}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${other.id}`;
  return groupOf(businessId, db);
}

export async function unlinkBranch({ businessId, otherId }, db = prisma) {
  const [me, other] = await Promise.all([requireBusiness(businessId, db), requireBusiness(otherId, db)]);
  if (!me.groupId || other.groupId !== me.groupId) throw bookError(404, 'ეს ფილიალი ამ ქსელში არ არის.', 'NOT_IN_GROUP', 'That branch is not in this chain.');
  await db.$executeRaw`UPDATE "BookBusiness" SET "groupId" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${other.id}`;
  return groupOf(businessId, db);
}

/** Every branch over a period: the headline numbers side by side, plus totals. */
export async function branchesAnalytics({ businessId, range = '30', now = new Date() }, db = prisma) {
  const { group, branches } = await groupOf(businessId, db);
  const { from, to, label } = periodFor(String(range), now);
  const rows = [];
  for (const b of branches.slice(0, 20)) {
    const raw = await analyticsRaw({ businessId: b.id, from, to }, db);
    const a = buildAnalytics({ ...raw, from, to, now });
    rows.push({ id: b.id, name: b.name, status: b.status, bookings: a.totals.bookings, completed: a.totals.completed, cancelled: a.totals.cancelled, noShowRate: a.totals.noShowRate, revenue: a.totals.revenue, expense: a.totals.expense, utilisation: a.totals.utilisation, averageTicket: a.totals.averageTicket, newClients: a.clients.new, activeClients: a.clients.active, reviews: a.reviews.avg });
  }
  const sum = (k) => n2(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
  return { group, range: label, from: from.toISOString(), to: to.toISOString(), branches: rows, totals: { bookings: sum('bookings'), completed: sum('completed'), cancelled: sum('cancelled'), revenue: sum('revenue'), expense: sum('expense'), newClients: sum('newClients'), activeClients: sum('activeClients') } };
}

/** For the app: the other locations of a business, nearest to it first. */
export async function publicSiblings(row, { lang = 'ka', now = new Date() } = {}, db = prisma) {
  if (!row?.groupId) return [];
  const rows = await db.$queryRaw`SELECT * FROM "BookBusiness" WHERE "groupId" = ${row.groupId} AND id <> ${row.id} AND status IN ('LISTED', 'CLAIMED') ORDER BY "createdAt" ASC LIMIT 20`;
  const origin = row.lat != null && row.lng != null ? { lat: Number(row.lat), lng: Number(row.lng) } : null;
  return rows.map((r) => businessCard(r, { lang, now, origin })).sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
}

export { distanceKm, sql };
