/**
 * MEDIBOOK database layer, part 1 — the catalogue, who may manage a business, claims and registrations,
 * staff, services, time off, pictures, favourites, listing events and the admin's views. Raw SQL over the
 * tables in prisma/20261015-medibook.sql. Bookings, clients, money and analytics live in bookings.js.
 */
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../prisma.js';
import {
  CATEGORY_IDS, bboxAround, bookError, businessCard, discountPublic, distanceKm, guessCategory, imageUrl, inGeorgia, newId, normalizeHours,
  normalizeInstagram, normalizePhone, normalizeSettings, normalizeWebsite, servicePublic, slugFor, staffPublic,
} from './catalog.js';

const VISIBLE = Prisma.sql`b.status IN ('LISTED', 'CLAIMED')`;
const sql = Prisma.sql;
const join = Prisma.join;
const empty = Prisma.empty;

/** Services the public may book right now (claimed business, online switch, at least one online service). */
const ONLINE_SERVICES = sql`EXISTS (SELECT 1 FROM "BookService" s WHERE s."businessId" = b.id AND s.active AND s.online) AS "onlineServices"`;
const FROM_PRICE = sql`(SELECT MIN(s.price) FROM "BookService" s WHERE s."businessId" = b.id AND s.active AND s.online AND s.price IS NOT NULL) AS "fromPrice"`;

function favoriteJoin(userId) {
  return userId ? sql`LEFT JOIN "BookFavorite" f ON f."businessId" = b.id AND f."userId" = ${userId}` : empty;
}
const favoriteCol = (userId) => (userId ? sql`(f."userId" IS NOT NULL) AS favorite` : sql`FALSE AS favorite`);

function searchClause(q) {
  const term = String(q ?? '').trim();
  if (term.length < 2) return empty;
  const like = `%${term.replace(/[%_]/g, ' ')}%`;
  return sql`AND (b.name ILIKE ${like} OR b."nameKa" ILIKE ${like} OR b.address ILIKE ${like} OR b."addressKa" ILIKE ${like} OR b.district ILIKE ${like} OR b.tags::text ILIKE ${like}
    OR EXISTS (SELECT 1 FROM "BookService" s WHERE s."businessId" = b.id AND s.active AND (s.name ILIKE ${like} OR s."nameKa" ILIKE ${like})))`;
}

const categoryClause = (category) => (category && CATEGORY_IDS.includes(category) ? sql`AND b.category = ${category}` : empty);

function toCards(rows, { lang, origin, now, userId }) {
  return rows.map((row) => businessCard(row, { lang, origin, now, fromPrice: row.fromPrice, favorite: Boolean(userId && row.favorite) }));
}

// ——— catalogue reads ———

/** Businesses around a point, nearest first. Pre-filtered by bbox on the index, then measured. */
export async function nearbyBusinesses({ lat, lng, radiusKm = 5, category = null, q = '', limit = 40, lang = 'ka', userId = null, now = new Date(), onlyBookable = false }, db = prisma) {
  const origin = { lat: Number(lat), lng: Number(lng) };
  if (!inGeorgia(origin.lat, origin.lng)) return [];
  const r = Math.min(50, Math.max(0.5, Number(radiusKm) || 5));
  const box = bboxAround(origin, r);
  const rows = await db.$queryRaw`SELECT b.*, ${ONLINE_SERVICES}, ${FROM_PRICE}, ${favoriteCol(userId)}
    FROM "BookBusiness" b ${favoriteJoin(userId)}
    WHERE ${VISIBLE} AND b.lat BETWEEN ${box.minLat} AND ${box.maxLat} AND b.lng BETWEEN ${box.minLng} AND ${box.maxLng}
      ${categoryClause(category)} ${searchClause(q)} ${onlyBookable ? sql`AND b.status = 'CLAIMED'` : empty}
    ORDER BY (b.status = 'CLAIMED') DESC, b."ratingCount" DESC LIMIT 600`;
  const cards = toCards(rows, { lang, origin, now, userId })
    .filter((c) => c.distanceKm != null && c.distanceKm <= r)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return cards.slice(0, Math.min(200, Math.max(1, Number(limit) || 40)));
}

/** Text search anywhere (no radius): claimed first, then the best rated, then by name. */
export async function searchBusinesses({ q = '', category = null, city = null, limit = 40, lang = 'ka', userId = null, origin = null, now = new Date() }, db = prisma) {
  const cityClause = city ? sql`AND (b.city ILIKE ${`%${city}%`})` : empty;
  const rows = await db.$queryRaw`SELECT b.*, ${ONLINE_SERVICES}, ${FROM_PRICE}, ${favoriteCol(userId)}
    FROM "BookBusiness" b ${favoriteJoin(userId)}
    WHERE ${VISIBLE} ${categoryClause(category)} ${searchClause(q)} ${cityClause}
    ORDER BY (b.status = 'CLAIMED') DESC, b."ratingCount" DESC, b."viewCount" DESC, b.name ASC
    LIMIT ${Math.min(200, Math.max(1, Number(limit) || 40))}`;
  return toCards(rows, { lang, origin, now, userId });
}

/** Light pins for the map viewport. */
export async function mapPins({ minLat, maxLat, minLng, maxLng, category = null, q = '', limit = 500 }, db = prisma) {
  const rows = await db.$queryRaw`SELECT b.id, b.slug, b.name, b."nameKa", b.category, b.lat, b.lng, b.status, b."ratingAvg", b."ratingCount", b.hours
    FROM "BookBusiness" b
    WHERE ${VISIBLE} AND b.lat BETWEEN ${Number(minLat)} AND ${Number(maxLat)} AND b.lng BETWEEN ${Number(minLng)} AND ${Number(maxLng)}
      ${categoryClause(category)} ${searchClause(q)}
    ORDER BY (b.status = 'CLAIMED') DESC, b."ratingCount" DESC LIMIT ${Math.min(2000, Math.max(1, Number(limit) || 500))}`;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.nameKa || r.name,
    category: r.category,
    lat: Number(r.lat),
    lng: Number(r.lng),
    claimed: r.status === 'CLAIMED',
    rating: r.ratingAvg == null ? null : Math.round(Number(r.ratingAvg) * 10) / 10,
  }));
}

export async function businessRow(idOrSlug, db = prisma) {
  const key = String(idOrSlug ?? '');
  if (!key) return null;
  const [row] = await db.$queryRaw`SELECT b.*, ${ONLINE_SERVICES}, ${FROM_PRICE} FROM "BookBusiness" b WHERE b.id = ${key} OR b.slug = ${key} LIMIT 1`;
  return row ?? null;
}

export async function requireBusiness(idOrSlug, db = prisma) {
  const row = await businessRow(idOrSlug, db);
  if (!row) throw bookError(404, 'ბიზნესი ვერ მოიძებნა.', 'BUSINESS_NOT_FOUND', 'Business not found.');
  return row;
}

/** Everything the public business page shows. */
export async function businessDetail(idOrSlug, { lang = 'ka', userId = null, now = new Date(), includeHidden = false } = {}, db = prisma) {
  const row = await businessRow(idOrSlug, db);
  if (!row || (!includeHidden && !['LISTED', 'CLAIMED'].includes(row.status))) return null;
  const [services, staff, discounts, reviews, images, fav] = await Promise.all([
    db.$queryRaw`SELECT * FROM "BookService" WHERE "businessId" = ${row.id} AND active ORDER BY "sortOrder", name`,
    db.$queryRaw`SELECT * FROM "BookStaff" WHERE "businessId" = ${row.id} AND active ORDER BY "sortOrder", name`,
    db.$queryRaw`SELECT * FROM "BookDiscount" WHERE "businessId" = ${row.id} AND active AND ("endsOn" IS NULL OR "endsOn" >= CURRENT_DATE) ORDER BY "createdAt" DESC LIMIT 6`,
    db.$queryRaw`SELECT r.id, r.rating, r.text, r.reply, r."repliedAt", r."createdAt", u."fullName" AS author FROM "BookReview" r LEFT JOIN "User" u ON u.id = r."userId"
      WHERE r."businessId" = ${row.id} AND NOT r.hidden ORDER BY r."createdAt" DESC LIMIT 10`,
    db.$queryRaw`SELECT id FROM "BookImage" WHERE "businessId" = ${row.id} ORDER BY "createdAt" ASC`,
    userId ? db.$queryRaw`SELECT 1 AS ok FROM "BookFavorite" WHERE "userId" = ${userId} AND "businessId" = ${row.id}` : Promise.resolve([]),
  ]);
  const card = businessCard(row, { lang, now, fromPrice: row.fromPrice, favorite: fav.length > 0 });
  const photoIds = Array.isArray(row.photos) ? row.photos : [];
  const gallery = (photoIds.length ? photoIds : images.map((i) => i.id)).filter((id) => images.some((i) => i.id === id)).map((id) => imageUrl(id));
  return {
    ...card,
    description: lang === 'ka' && row.descriptionKa ? row.descriptionKa : row.description,
    email: row.email,
    website: row.website,
    instagram: row.instagram,
    facebook: row.facebook,
    hours: normalizeHours(row.hours),
    gallery,
    settings: normalizeSettings(row.settings),
    services: services.map(servicePublic),
    staff: staff.filter((s) => s.bookable).map(staffPublic),
    discounts: discounts.map(discountPublic),
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text, reply: r.reply, createdAt: r.createdAt, author: firstName(r.author) })),
    status: row.status,
  };
}

function firstName(full) {
  const s = String(full ?? '').trim().split(/\s+/)[0];
  return s || 'MEDICARD';
}

/** Hashed viewer so a funnel never carries a user id. */
export function viewerHash(seed) {
  return seed ? createHash('sha256').update(`book:${seed}`).digest('hex').slice(0, 16) : null;
}

export const EVENT_KINDS = Object.freeze(['VIEW', 'CALL', 'ROUTE', 'WEBSITE', 'SHARE', 'BOOK_START', 'BOOK_DONE', 'FAVORITE']);

export async function recordEvent(businessId, kind, seed = null, db = prisma) {
  if (!EVENT_KINDS.includes(kind)) return;
  await db.$executeRaw`INSERT INTO "BookEvent" ("businessId", kind, "viewerHash") VALUES (${businessId}, ${kind}, ${viewerHash(seed)})`;
  if (kind === 'VIEW') await db.$executeRaw`UPDATE "BookBusiness" SET "viewCount" = "viewCount" + 1 WHERE id = ${businessId}`;
}

// ——— favourites ———

export async function setFavorite(userId, businessId, on, db = prisma) {
  if (on) await db.$executeRaw`INSERT INTO "BookFavorite" ("userId", "businessId") VALUES (${userId}, ${businessId}) ON CONFLICT DO NOTHING`;
  else await db.$executeRaw`DELETE FROM "BookFavorite" WHERE "userId" = ${userId} AND "businessId" = ${businessId}`;
}

export async function favoritesOf(userId, { lang = 'ka', origin = null, now = new Date() } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT b.*, ${ONLINE_SERVICES}, ${FROM_PRICE}, TRUE AS favorite FROM "BookFavorite" f JOIN "BookBusiness" b ON b.id = f."businessId"
    WHERE f."userId" = ${userId} AND ${VISIBLE} ORDER BY f."createdAt" DESC LIMIT 100`;
  return toCards(rows, { lang, origin, now, userId });
}

// ——— members / access ———

export const ROLES = Object.freeze(['OWNER', 'MANAGER', 'STAFF']);

export async function membershipsOf(userId, db = prisma) {
  const rows = await db.$queryRaw`SELECT m.role, m."staffId", b.*, g.name AS "groupName" FROM "BookMember" m JOIN "BookBusiness" b ON b.id = m."businessId" LEFT JOIN "BookGroup" g ON g.id = b."groupId" WHERE m."userId" = ${userId} ORDER BY g.name NULLS LAST, m."createdAt" ASC`;
  return rows.map((r) => ({ role: r.role, staffId: r.staffId, business: { id: r.id, slug: r.slug, name: r.nameKa || r.name, category: r.category, status: r.status, settings: normalizeSettings(r.settings), groupId: r.groupId ?? null, groupName: r.groupName ?? null, logoUrl: imageUrl(r.logoImageId), coverUrl: imageUrl(r.coverImageId), city: r.city } }));
}

/** The member row of `userId` in `businessId`, or 403. `roles` narrows who may do this. */
export async function requireMember(userId, businessId, roles = ROLES, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "BookMember" WHERE "userId" = ${userId} AND "businessId" = ${businessId}`;
  if (!row) throw bookError(403, 'ამ ბიზნესზე წვდომა არ გაქვს.', 'NOT_A_MEMBER', 'You do not have access to this business.');
  if (!roles.includes(row.role)) throw bookError(403, 'ამ მოქმედებისთვის მფლობელის ან მენეჯერის უფლებაა საჭირო.', 'ROLE_REQUIRED', 'This action needs an owner or manager role.');
  return row;
}

export async function listMembers(businessId, db = prisma) {
  const rows = await db.$queryRaw`SELECT m.id, m.role, m."staffId", m."createdAt", u.id AS "userId", u."fullName", u.phone, u.email FROM "BookMember" m JOIN "User" u ON u.id = m."userId" WHERE m."businessId" = ${businessId} ORDER BY m."createdAt"`;
  return rows.map((r) => ({ id: r.id, role: r.role, staffId: r.staffId, userId: r.userId, name: r.fullName, phone: r.phone, email: /@(phone|apple)\.medicard\.ge$/.test(r.email ?? '') ? null : r.email, createdAt: r.createdAt }));
}

/** Add a MEDICARD user by phone or email (they must already have an account). */
export async function addMember({ businessId, phone, email, role = 'STAFF', staffId = null }, db = prisma) {
  if (!ROLES.includes(role)) throw bookError(400, 'უცნობი როლი.', 'BAD_ROLE', 'Unknown role.');
  const p = normalizePhone(phone);
  const e = String(email ?? '').trim().toLowerCase();
  const [user] = p
    ? await db.$queryRaw`SELECT id FROM "User" WHERE phone = ${p} LIMIT 1`
    : e ? await db.$queryRaw`SELECT id FROM "User" WHERE LOWER(email) = ${e} LIMIT 1` : [];
  if (!user) throw bookError(404, 'ასეთი MEDICARD ანგარიში არ მოიძებნა. თანამშრომელმა ჯერ აპი დააყენოს და დარეგისტრირდეს.', 'USER_NOT_FOUND', 'No MEDICARD account with this phone or email. Ask them to install the app and sign up first.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookMember" (id, "businessId", "userId", role, "staffId") VALUES (${id}, ${businessId}, ${user.id}, ${role}, ${staffId})
    ON CONFLICT ("businessId", "userId") DO UPDATE SET role = EXCLUDED.role, "staffId" = COALESCE(EXCLUDED."staffId", "BookMember"."staffId")`;
  return user.id;
}

export async function updateMember({ businessId, memberId, role, staffId }, db = prisma) {
  if (role && !ROLES.includes(role)) throw bookError(400, 'უცნობი როლი.', 'BAD_ROLE', 'Unknown role.');
  await db.$executeRaw`UPDATE "BookMember" SET role = COALESCE(${role ?? null}, role), "staffId" = ${staffId === undefined ? Prisma.sql`"staffId"` : staffId} WHERE id = ${memberId} AND "businessId" = ${businessId}`;
}

export async function removeMember({ businessId, memberId, actorUserId }, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "BookMember" WHERE id = ${memberId} AND "businessId" = ${businessId}`;
  if (!row) throw bookError(404, 'წევრი ვერ მოიძებნა.', 'MEMBER_NOT_FOUND', 'Member not found.');
  if (row.role === 'OWNER') {
    const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookMember" WHERE "businessId" = ${businessId} AND role = 'OWNER'`;
    if (Number(n) <= 1) throw bookError(400, 'ბიზნესს ერთი მფლობელი მაინც უნდა ჰყავდეს.', 'LAST_OWNER', 'A business needs at least one owner.');
  }
  if (row.userId === actorUserId && row.role === 'OWNER') throw bookError(400, 'საკუთარი თავის მოხსნა არ შეიძლება — ჯერ სხვა მფლობელი დანიშნე.', 'SELF_REMOVE', 'You cannot remove yourself — make someone else an owner first.');
  await db.$executeRaw`DELETE FROM "BookMember" WHERE id = ${memberId}`;
}

// ——— claims and registration ———

const cleanText = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/** Fields an owner may set on their business (profile editor + registration). */
export function sanitizeBusinessInput(input = {}) {
  const out = {};
  if (input.name !== undefined) out.name = cleanText(input.name, 120);
  if (input.nameKa !== undefined) out.nameKa = cleanText(input.nameKa, 120);
  if (input.category !== undefined) out.category = CATEGORY_IDS.includes(String(input.category).toUpperCase()) ? String(input.category).toUpperCase() : null;
  if (input.tags !== undefined) out.tags = Array.isArray(input.tags) ? input.tags.map((t) => cleanText(t, 40)).filter(Boolean).slice(0, 12) : [];
  if (input.description !== undefined) out.description = cleanText(input.description, 2000);
  if (input.descriptionKa !== undefined) out.descriptionKa = cleanText(input.descriptionKa, 2000);
  if (input.phone !== undefined) out.phone = normalizePhone(input.phone);
  if (input.email !== undefined) out.email = cleanText(input.email, 120)?.toLowerCase() ?? null;
  if (input.website !== undefined) out.website = normalizeWebsite(input.website);
  if (input.instagram !== undefined) out.instagram = normalizeInstagram(input.instagram);
  if (input.facebook !== undefined) out.facebook = normalizeWebsite(input.facebook);
  if (input.address !== undefined) out.address = cleanText(input.address, 200);
  if (input.addressKa !== undefined) out.addressKa = cleanText(input.addressKa, 200);
  if (input.city !== undefined) out.city = cleanText(input.city, 60);
  if (input.district !== undefined) out.district = cleanText(input.district, 60);
  if (input.lat !== undefined || input.lng !== undefined) {
    const lat = Number(input.lat);
    const lng = Number(input.lng);
    if (inGeorgia(lat, lng)) {
      out.lat = lat;
      out.lng = lng;
    }
  }
  if (input.hours !== undefined) out.hours = normalizeHours(input.hours);
  if (input.settings !== undefined) out.settings = normalizeSettings(input.settings);
  return out;
}

const BUSINESS_COLUMNS = ['name', 'nameKa', 'category', 'tags', 'description', 'descriptionKa', 'phone', 'email', 'website', 'instagram', 'facebook', 'address', 'addressKa', 'city', 'district', 'lat', 'lng', 'hours', 'settings', 'photos', 'logoImageId', 'coverImageId', 'status'];
const JSON_COLUMNS = new Set(['tags', 'hours', 'settings', 'photos']);

export async function updateBusiness(businessId, patch, db = prisma) {
  const sets = [];
  for (const col of BUSINESS_COLUMNS) {
    if (patch[col] === undefined) continue;
    const value = JSON_COLUMNS.has(col) ? JSON.stringify(patch[col]) : patch[col];
    sets.push(JSON_COLUMNS.has(col) ? sql`${Prisma.raw(`"${col}"`)} = ${value}::jsonb` : sql`${Prisma.raw(`"${col}"`)} = ${value}`);
  }
  if (!sets.length) return businessRow(businessId, db);
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  await db.$executeRaw`UPDATE "BookBusiness" SET ${join(sets, ', ')} WHERE id = ${businessId}`;
  return businessRow(businessId, db);
}

/**
 * A new business registered by its owner: visible to them at once (status PENDING, OWNER member), listed
 * for everyone once an admin approves the REGISTER claim in #/book.
 */
export async function registerBusiness({ userId, input, proof = {}, note = null }, db = prisma) {
  const data = sanitizeBusinessInput(input);
  if (!data.name) throw bookError(400, 'მიუთითე ბიზნესის სახელი.', 'NAME_REQUIRED', 'Enter the business name.');
  if (!data.category) data.category = guessCategory({ name: data.name });
  if (data.lat == null) throw bookError(400, 'მონიშნე მისამართი რუკაზე — კლიენტები ასე გპოულობენ.', 'LOCATION_REQUIRED', 'Mark the address on the map — this is how clients find you.');
  const id = newId();
  const slug = slugFor(data.nameKa || data.name, id);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "BookBusiness" (id, slug, name, "nameKa", category, tags, description, "descriptionKa", phone, email, website, instagram, facebook, address, "addressKa", city, district, lat, lng, hours, settings, source, status, "ownerUserId")
      VALUES (${id}, ${slug}, ${data.name}, ${data.nameKa ?? null}, ${data.category}, ${JSON.stringify(data.tags ?? [])}::jsonb, ${data.description ?? null}, ${data.descriptionKa ?? null}, ${data.phone ?? null}, ${data.email ?? null}, ${data.website ?? null}, ${data.instagram ?? null}, ${data.facebook ?? null}, ${data.address ?? null}, ${data.addressKa ?? null}, ${data.city ?? null}, ${data.district ?? null}, ${data.lat}, ${data.lng}, ${JSON.stringify(data.hours ?? {})}::jsonb, ${JSON.stringify(normalizeSettings(data.settings))}::jsonb, 'OWNER', 'PENDING', ${userId})`;
    await tx.$executeRaw`INSERT INTO "BookMember" (id, "businessId", "userId", role) VALUES (${newId()}, ${id}, ${userId}, 'OWNER')`;
    await tx.$executeRaw`INSERT INTO "BookClaim" (id, "businessId", "userId", kind, status, proof, note) VALUES (${newId()}, ${id}, ${userId}, 'REGISTER', 'PENDING', ${JSON.stringify(proof ?? {})}::jsonb, ${cleanText(note, 500)})`;
  });
  return businessRow(id, db);
}

/** Claim a listed business. Waits for an admin; the person sees it under „ჩემი განაცხადები“. */
export async function claimBusiness({ userId, businessId, proof = {}, note = null }, db = prisma) {
  const row = await requireBusiness(businessId, db);
  if (row.status === 'CLAIMED') {
    const [mine] = await db.$queryRaw`SELECT 1 AS ok FROM "BookMember" WHERE "businessId" = ${row.id} AND "userId" = ${userId}`;
    if (mine) throw bookError(409, 'ეს ბიზნესი უკვე შენია.', 'ALREADY_MEMBER', 'This business is already yours.');
    throw bookError(409, 'ეს ბიზნესი უკვე დადასტურებულია სხვა ანგარიშით. თუ შენია, მოგვწერე support@medicard.ge.', 'ALREADY_CLAIMED', 'This business is already verified by another account. If it is yours, write to support@medicard.ge.');
  }
  if (row.status === 'HIDDEN') throw bookError(404, 'ბიზნესი ვერ მოიძებნა.', 'BUSINESS_NOT_FOUND', 'Business not found.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookClaim" (id, "businessId", "userId", kind, status, proof, note) VALUES (${id}, ${row.id}, ${userId}, 'CLAIM', 'PENDING', ${JSON.stringify(proof ?? {})}::jsonb, ${cleanText(note, 500)})
    ON CONFLICT ("businessId", "userId") WHERE status = 'PENDING' DO UPDATE SET proof = EXCLUDED.proof, note = EXCLUDED.note`;
  return claimsOf(userId, db);
}

export async function claimsOf(userId, db = prisma) {
  const rows = await db.$queryRaw`SELECT c.*, b.name AS "businessName", b."nameKa" AS "businessNameKa", b.category, b.address, b.city, b.status AS "businessStatus" FROM "BookClaim" c JOIN "BookBusiness" b ON b.id = c."businessId"
    WHERE c."userId" = ${userId} ORDER BY c."createdAt" DESC LIMIT 20`;
  return rows.map(claimPublic);
}

function claimPublic(r) {
  return {
    id: r.id,
    businessId: r.businessId,
    kind: r.kind,
    status: r.status,
    note: r.note,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
    business: { id: r.businessId, name: r.businessNameKa || r.businessName, category: r.category, address: r.address, city: r.city, status: r.businessStatus },
    proof: r.proof ?? {},
  };
}

export async function adminClaims({ status = 'PENDING' } = {}, db = prisma) {
  const where = status === 'ALL' ? empty : sql`WHERE c.status = ${status}`;
  const rows = await db.$queryRaw`SELECT c.*, b.name AS "businessName", b."nameKa" AS "businessNameKa", b.category, b.address, b.city, b.status AS "businessStatus", b.phone AS "businessPhone", b.website AS "businessWebsite",
      u."fullName" AS "userName", u.phone AS "userPhone", u.email AS "userEmail", u."createdAt" AS "userSince"
    FROM "BookClaim" c JOIN "BookBusiness" b ON b.id = c."businessId" JOIN "User" u ON u.id = c."userId" ${where} ORDER BY c."createdAt" DESC LIMIT 300`;
  return rows.map((r) => ({
    ...claimPublic(r),
    business: { ...claimPublic(r).business, phone: r.businessPhone, website: r.businessWebsite },
    user: { id: r.userId, name: r.userName, phone: r.userPhone, email: /@(phone|apple)\.medicard\.ge$/.test(r.userEmail ?? '') ? null : r.userEmail, since: r.userSince },
  }));
}

/** Approve: business CLAIMED + OWNER membership (registrations go live). Reject: the business of a registration stays PENDING for the owner, hidden from lists. */
export async function adminReviewClaim({ claimId, action, note = '', admin }, db = prisma) {
  const [claim] = await db.$queryRaw`SELECT * FROM "BookClaim" WHERE id = ${claimId}`;
  if (!claim) throw bookError(404, 'განაცხადი ვერ მოიძებნა.', 'CLAIM_NOT_FOUND', 'Claim not found.');
  if (claim.status !== 'PENDING') throw bookError(409, 'ეს განაცხადი უკვე განხილულია.', 'CLAIM_REVIEWED', 'This claim was already reviewed.');
  const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "BookClaim" SET status = ${status}, "reviewNote" = ${cleanText(note, 500)}, "reviewedBy" = ${String(admin?.email ?? admin?.id ?? 'admin')}, "reviewedAt" = CURRENT_TIMESTAMP WHERE id = ${claimId}`;
    if (status === 'APPROVED') {
      await tx.$executeRaw`UPDATE "BookBusiness" SET status = 'CLAIMED', "ownerUserId" = COALESCE("ownerUserId", ${claim.userId}), "claimedAt" = COALESCE("claimedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${claim.businessId}`;
      await tx.$executeRaw`INSERT INTO "BookMember" (id, "businessId", "userId", role) VALUES (${newId()}, ${claim.businessId}, ${claim.userId}, 'OWNER') ON CONFLICT ("businessId", "userId") DO UPDATE SET role = 'OWNER'`;
      // Every other pending claim on the same place is closed: one owner account per business.
      await tx.$executeRaw`UPDATE "BookClaim" SET status = 'REJECTED', "reviewNote" = 'სხვა ანგარიშმა დაადასტურა ბიზნესი.', "reviewedBy" = 'system', "reviewedAt" = CURRENT_TIMESTAMP WHERE "businessId" = ${claim.businessId} AND status = 'PENDING' AND id <> ${claimId}`;
    }
  });
  return { ...claim, status };
}

// ——— staff ———

export async function listStaff(businessId, { all = false } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT * FROM "BookStaff" WHERE "businessId" = ${businessId} ${all ? empty : sql`AND active`} ORDER BY "sortOrder", name`;
  return rows.map(staffFull);
}

export function staffFull(row) {
  return { ...staffPublic(row), userId: row.userId ?? null, schedule: row.schedule && typeof row.schedule === 'object' ? row.schedule : {}, active: Boolean(row.active), sortOrder: Number(row.sortOrder ?? 0), createdAt: row.createdAt };
}

function sanitizeStaff(input = {}) {
  const out = {};
  if (input.name !== undefined) out.name = cleanText(input.name, 80);
  if (input.title !== undefined) out.title = cleanText(input.title, 80);
  if (input.color !== undefined) out.color = /^#[0-9a-f]{6}$/i.test(String(input.color ?? '')) ? String(input.color).toUpperCase() : null;
  if (input.serviceIds !== undefined) out.serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.map(String).slice(0, 200) : [];
  if (input.schedule !== undefined) out.schedule = normalizeHours(input.schedule);
  if (input.bookable !== undefined) out.bookable = Boolean(input.bookable);
  if (input.active !== undefined) out.active = Boolean(input.active);
  if (input.sortOrder !== undefined) out.sortOrder = Math.max(0, Math.min(999, Math.round(Number(input.sortOrder) || 0)));
  if (input.imageId !== undefined) out.imageId = cleanText(input.imageId, 64);
  return out;
}

export async function createStaff(businessId, input, db = prisma) {
  const s = sanitizeStaff(input);
  if (!s.name) throw bookError(400, 'მიუთითე თანამშრომლის სახელი.', 'NAME_REQUIRED', 'Enter the name.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookStaff" (id, "businessId", name, title, color, "serviceIds", schedule, bookable, active, "sortOrder", "imageId")
    VALUES (${id}, ${businessId}, ${s.name}, ${s.title ?? null}, ${s.color ?? null}, ${JSON.stringify(s.serviceIds ?? [])}::jsonb, ${JSON.stringify(s.schedule ?? {})}::jsonb, ${s.bookable ?? true}, ${s.active ?? true}, ${s.sortOrder ?? 0}, ${s.imageId ?? null})`;
  const [row] = await db.$queryRaw`SELECT * FROM "BookStaff" WHERE id = ${id}`;
  return staffFull(row);
}

export async function updateStaff(businessId, staffId, input, db = prisma) {
  const s = sanitizeStaff(input);
  const sets = [];
  for (const [k, v] of Object.entries(s)) {
    if (k === 'serviceIds' || k === 'schedule') sets.push(sql`${Prisma.raw(`"${k}"`)} = ${JSON.stringify(v)}::jsonb`);
    else sets.push(sql`${Prisma.raw(`"${k}"`)} = ${v}`);
  }
  if (!sets.length) throw bookError(400, 'შესაცვლელი არაფერია.', 'NOTHING_TO_UPDATE', 'Nothing to update.');
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookStaff" SET ${join(sets, ', ')} WHERE id = ${staffId} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Staff member not found.');
  const [row] = await db.$queryRaw`SELECT * FROM "BookStaff" WHERE id = ${staffId}`;
  return staffFull(row);
}

/** Staff are never deleted (appointments point at them): they are deactivated. */
export async function deactivateStaff(businessId, staffId, db = prisma) {
  const n = await db.$executeRaw`UPDATE "BookStaff" SET active = FALSE, bookable = FALSE, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${staffId} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'თანამშრომელი ვერ მოიძებნა.', 'STAFF_NOT_FOUND', 'Staff member not found.');
}

// ——— services ———

/** The business's own list: every service with the live rooms / devices it needs (`resourceIds`; the public shape never carries them). */
export async function listServices(businessId, { all = false } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT s.*, (SELECT COALESCE(json_agg(l."resourceId" ORDER BY l."createdAt"), '[]'::json) FROM "BookServiceResource" l JOIN "BookResource" r ON r.id = l."resourceId" AND r.active WHERE l."serviceId" = s.id) AS "resourceIds"
    FROM "BookService" s WHERE s."businessId" = ${businessId} ${all ? empty : sql`AND s.active`} ORDER BY s."group" NULLS LAST, s."sortOrder", s.name`;
  return rows.map((r) => ({ ...servicePublic(r), resourceIds: Array.isArray(r.resourceIds) ? r.resourceIds : [], classSchedule: r.classSchedule && typeof r.classSchedule === 'object' ? r.classSchedule : null }));
}

function sanitizeService(input = {}) {
  const out = {};
  const money = (v) => (v === null || v === '' ? null : Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v) * 100) / 100) : undefined);
  if (input.group !== undefined) out.group = cleanText(input.group, 60);
  // 1 = a normal visit; 2+ = a group class with that many seats at one start.
  if (input.seats !== undefined) out.seats = Math.max(1, Math.min(200, Math.round(Number(input.seats)) || 1));
  if (input.name !== undefined) out.name = cleanText(input.name, 120);
  if (input.nameKa !== undefined) out.nameKa = cleanText(input.nameKa, 120);
  if (input.description !== undefined) out.description = cleanText(input.description, 600);
  if (input.durationMin !== undefined) out.durationMin = Math.max(5, Math.min(12 * 60, Math.round(Number(input.durationMin) || 30)));
  if (input.bufferMin !== undefined) out.bufferMin = Math.max(0, Math.min(120, Math.round(Number(input.bufferMin) || 0)));
  if (input.price !== undefined) out.price = money(input.price);
  if (input.priceTo !== undefined) out.priceTo = money(input.priceTo);
  if (input.online !== undefined) out.online = Boolean(input.online);
  if (input.active !== undefined) out.active = Boolean(input.active);
  if (input.sortOrder !== undefined) out.sortOrder = Math.max(0, Math.min(999, Math.round(Number(input.sortOrder) || 0)));
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export async function createService(businessId, input, db = prisma) {
  const s = sanitizeService(input);
  if (!s.name) throw bookError(400, 'მიუთითე სერვისის სახელი.', 'NAME_REQUIRED', 'Enter the service name.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookService" (id, "businessId", "group", name, "nameKa", description, "durationMin", "bufferMin", price, "priceTo", online, active, "sortOrder", seats)
    VALUES (${id}, ${businessId}, ${s.group ?? null}, ${s.name}, ${s.nameKa ?? null}, ${s.description ?? null}, ${s.durationMin ?? 30}, ${s.bufferMin ?? 0}, ${s.price ?? null}, ${s.priceTo ?? null}, ${s.online ?? true}, ${s.active ?? true}, ${s.sortOrder ?? 0}, ${s.seats ?? 1})`;
  const [row] = await db.$queryRaw`SELECT * FROM "BookService" WHERE id = ${id}`;
  return servicePublic(row);
}

export async function updateService(businessId, serviceId, input, db = prisma) {
  const s = sanitizeService(input);
  const sets = Object.entries(s).map(([k, v]) => sql`${Prisma.raw(`"${k}"`)} = ${v}`);
  if (!sets.length) throw bookError(400, 'შესაცვლელი არაფერია.', 'NOTHING_TO_UPDATE', 'Nothing to update.');
  sets.push(sql`"updatedAt" = CURRENT_TIMESTAMP`);
  const n = await db.$executeRaw`UPDATE "BookService" SET ${join(sets, ', ')} WHERE id = ${serviceId} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
  const [row] = await db.$queryRaw`SELECT * FROM "BookService" WHERE id = ${serviceId}`;
  return servicePublic(row);
}

export async function deactivateService(businessId, serviceId, db = prisma) {
  const n = await db.$executeRaw`UPDATE "BookService" SET active = FALSE, online = FALSE, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${serviceId} AND "businessId" = ${businessId}`;
  if (!n) throw bookError(404, 'სერვისი ვერ მოიძებნა.', 'SERVICE_NOT_FOUND', 'Service not found.');
}

// ——— time off ———

export async function listTimeOff(businessId, { from, to }, db = prisma) {
  return db.$queryRaw`SELECT * FROM "BookTimeOff" WHERE "businessId" = ${businessId} AND "endsAt" > ${from} AND "startsAt" < ${to} ORDER BY "startsAt"`;
}

export async function addTimeOff(businessId, { staffId = null, startsAt, endsAt, reason = null }, db = prisma) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) throw bookError(400, 'შეამოწმე დასვენების დრო.', 'BAD_RANGE', 'Check the time range.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookTimeOff" (id, "businessId", "staffId", "startsAt", "endsAt", reason) VALUES (${id}, ${businessId}, ${staffId}, ${s}, ${e}, ${cleanText(reason, 120)})`;
  const [row] = await db.$queryRaw`SELECT * FROM "BookTimeOff" WHERE id = ${id}`;
  return row;
}

export async function removeTimeOff(businessId, id, db = prisma) {
  await db.$executeRaw`DELETE FROM "BookTimeOff" WHERE id = ${id} AND "businessId" = ${businessId}`;
}

// ——— pictures ———

export async function saveImage({ businessId, buffer, mime, width = null, height = null, createdBy = null }, db = prisma) {
  const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookImage" WHERE "businessId" = ${businessId}`;
  if (Number(n) >= 24) throw bookError(400, 'მაქსიმუმ 24 სურათი. ჯერ რამე წაშალე.', 'TOO_MANY_IMAGES', 'Up to 24 pictures. Remove one first.');
  const id = newId();
  await db.$executeRawUnsafe(
    `INSERT INTO "BookImage" (id, "businessId", mime, bytes, size, width, height, "createdBy") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    id, businessId, mime, buffer, buffer.length, width, height, createdBy,
  );
  return { id, url: imageUrl(id), width, height };
}

export async function readImage(id, db = prisma) {
  const rows = await db.$queryRaw`SELECT mime, bytes, private FROM "BookImage" WHERE id = ${String(id)}`;
  return rows[0] ?? null;
}

export async function listImages(businessId, db = prisma) {
  const rows = await db.$queryRaw`SELECT id, width, height, "createdAt" FROM "BookImage" WHERE "businessId" = ${businessId} ORDER BY "createdAt"`;
  return rows.map((r) => ({ id: r.id, url: imageUrl(r.id), width: r.width, height: r.height, createdAt: r.createdAt }));
}

export async function deleteImage(businessId, id, db = prisma) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "BookImage" WHERE id = ${id} AND "businessId" = ${businessId}`;
    await tx.$executeRaw`UPDATE "BookBusiness" SET "logoImageId" = CASE WHEN "logoImageId" = ${id} THEN NULL ELSE "logoImageId" END, "coverImageId" = CASE WHEN "coverImageId" = ${id} THEN NULL ELSE "coverImageId" END,
      photos = COALESCE((SELECT jsonb_agg(p) FROM jsonb_array_elements_text(photos) p WHERE p <> ${id}), '[]'::jsonb) WHERE id = ${businessId}`;
    await tx.$executeRaw`UPDATE "BookStaff" SET "imageId" = NULL WHERE "businessId" = ${businessId} AND "imageId" = ${id}`;
  });
}

// ——— admin ———

export async function adminOverview(db = prisma) {
  const [probe] = await db.$queryRaw`SELECT to_regclass('"BookBusiness"') IS NOT NULL AS ok`;
  if (!probe?.ok) return { installed: false };
  const [[counts], [claims], [appts], [cats], [recent]] = await Promise.all([
    db.$queryRaw`SELECT COUNT(*) FILTER (WHERE status = 'LISTED')::int AS listed, COUNT(*) FILTER (WHERE status = 'CLAIMED')::int AS claimed, COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending, COUNT(*) FILTER (WHERE status = 'HIDDEN')::int AS hidden FROM "BookBusiness"`,
    db.$queryRaw`SELECT COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending, COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved, COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected FROM "BookClaim"`,
    db.$queryRaw`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '7 days')::int AS week, COUNT(*) FILTER (WHERE "startsAt" >= NOW() AND status IN ('PENDING','CONFIRMED'))::int AS upcoming,
      COUNT(DISTINCT "clientUserId") FILTER (WHERE "clientUserId" IS NOT NULL)::int AS people, COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed, COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow", COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled FROM "BookAppointment"`,
    db.$queryRaw`SELECT json_object_agg(category, n) AS by FROM (SELECT category, COUNT(*)::int AS n FROM "BookBusiness" WHERE status IN ('LISTED','CLAIMED') GROUP BY category) x`,
    db.$queryRaw`SELECT json_agg(x) AS rows FROM (SELECT a.id, a."serviceName", a."startsAt", a.status, a.source, a."createdAt", b.name AS "businessName", b."nameKa" AS "businessNameKa" FROM "BookAppointment" a JOIN "BookBusiness" b ON b.id = a."businessId" ORDER BY a."createdAt" DESC LIMIT 12) x`,
  ]);
  const [[views], [favs]] = await Promise.all([
    db.$queryRaw`SELECT COUNT(*) FILTER (WHERE kind = 'VIEW' AND at > NOW() - INTERVAL '7 days')::int AS views, COUNT(*) FILTER (WHERE kind = 'CALL' AND at > NOW() - INTERVAL '7 days')::int AS calls, COUNT(*) FILTER (WHERE kind = 'ROUTE' AND at > NOW() - INTERVAL '7 days')::int AS routes FROM "BookEvent"`,
    db.$queryRaw`SELECT COUNT(*)::int AS n, COUNT(DISTINCT "userId")::int AS people FROM "BookFavorite"`,
  ]);
  return {
    installed: true,
    generatedAt: new Date().toISOString(),
    businesses: counts,
    claims,
    appointments: appts,
    byCategory: cats?.by ?? {},
    week: views,
    favorites: favs,
    recent: (recent?.rows ?? []).map((r) => ({ ...r, businessName: r.businessNameKa || r.businessName })),
  };
}

export async function adminBusinesses({ q = '', status = 'ALL', category = null, limit = 100, offset = 0 } = {}, db = prisma) {
  const statusClause = status === 'ALL' ? empty : sql`AND b.status = ${status}`;
  const rows = await db.$queryRaw`SELECT b.id, b.slug, b.name, b."nameKa", b.category, b.city, b.district, b.address, b.phone, b.website, b.status, b.source, b."ratingAvg", b."ratingCount", b."bookingCount", b."viewCount", b."claimedAt", b."createdAt", b."updatedAt", b.lat, b.lng,
      (SELECT COUNT(*)::int FROM "BookService" s WHERE s."businessId" = b.id AND s.active) AS services,
      (SELECT COUNT(*)::int FROM "BookStaff" s WHERE s."businessId" = b.id AND s.active) AS staff,
      (SELECT COUNT(*)::int FROM "BookAppointment" a WHERE a."businessId" = b.id AND a."startsAt" > NOW() - INTERVAL '30 days') AS "appointments30",
      u."fullName" AS "ownerName", u.phone AS "ownerPhone"
    FROM "BookBusiness" b LEFT JOIN "User" u ON u.id = b."ownerUserId"
    WHERE TRUE ${statusClause} ${categoryClause(category)} ${searchClause(q)}
    ORDER BY (b.status = 'PENDING') DESC, (b.status = 'CLAIMED') DESC, b."updatedAt" DESC
    LIMIT ${Math.min(500, Math.max(1, Number(limit) || 100))} OFFSET ${Math.max(0, Number(offset) || 0)}`;
  const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "BookBusiness" b WHERE TRUE ${statusClause} ${categoryClause(category)} ${searchClause(q)}`;
  return { total: Number(n), businesses: rows.map((r) => ({ ...r, name: r.nameKa || r.name, nameEn: r.name })) };
}

export async function adminCreateBusiness(input, admin, db = prisma) {
  const data = sanitizeBusinessInput(input);
  if (!data.name) throw bookError(400, 'მიუთითე სახელი.', 'NAME_REQUIRED', 'Enter the name.');
  if (data.lat == null) throw bookError(400, 'მონიშნე მდებარეობა.', 'LOCATION_REQUIRED', 'Mark the location.');
  const id = newId();
  await db.$executeRaw`INSERT INTO "BookBusiness" (id, slug, name, "nameKa", category, tags, description, "descriptionKa", phone, email, website, instagram, address, "addressKa", city, district, lat, lng, hours, source, status)
    VALUES (${id}, ${slugFor(data.nameKa || data.name, id)}, ${data.name}, ${data.nameKa ?? null}, ${data.category ?? guessCategory({ name: data.name })}, ${JSON.stringify(data.tags ?? [])}::jsonb, ${data.description ?? null}, ${data.descriptionKa ?? null}, ${data.phone ?? null}, ${data.email ?? null}, ${data.website ?? null}, ${data.instagram ?? null}, ${data.address ?? null}, ${data.addressKa ?? null}, ${data.city ?? null}, ${data.district ?? null}, ${data.lat}, ${data.lng}, ${JSON.stringify(data.hours ?? {})}::jsonb, 'ADMIN', 'LISTED')`;
  return businessRow(id, db);
}

/** Nearby duplicates of a point (same name within 150 m) — the registration form warns before creating one. */
export async function similarBusinesses({ name, lat, lng }, db = prisma) {
  if (!inGeorgia(Number(lat), Number(lng))) return [];
  const box = bboxAround({ lat: Number(lat), lng: Number(lng) }, 0.4);
  const rows = await db.$queryRaw`SELECT b.* FROM "BookBusiness" b WHERE ${VISIBLE} AND b.lat BETWEEN ${box.minLat} AND ${box.maxLat} AND b.lng BETWEEN ${box.minLng} AND ${box.maxLng} LIMIT 40`;
  const needle = String(name ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return rows
    .filter((r) => {
      const d = distanceKm({ lat, lng }, { lat: r.lat, lng: r.lng }) ?? 9;
      const hay = `${r.name} ${r.nameKa ?? ''}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
      return d <= 0.15 || (needle.length >= 4 && hay.includes(needle)) || (hay.length >= 4 && needle.includes(hay));
    })
    .map((r) => businessCard(r, { lang: 'ka', origin: { lat, lng } }));
}
