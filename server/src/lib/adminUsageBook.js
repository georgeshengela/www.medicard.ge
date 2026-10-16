/**
 * Admin #/book (MEDIBOOK) — who uses the booking module and how, on the shape of every module-usage page
 * (owner 2026-10-11: „როგორც მედივეტი, ისე ყველა მოდული“).
 *
 * Sources (raw-SQL Book* tables): BookBusiness (the catalogue and the claimed places), BookService / BookStaff /
 * BookImage / BookProduct / BookResource / BookMembership (what a business has set up), BookAppointment (bookings),
 * BookEvent (what app users do on a listing: VIEW / CALL / ROUTE), BookClaim (owners proving a place is theirs),
 * BookReview, BookFavorite. A business is „team“ when its owner signs in with an exact …@medicard.ge account (the
 * owner's demo clinic among them); those are left out unless `includeTeam`.
 *
 * Privacy: business facts and counts only — the wall carries the owner as the user page shows them (name, contact)
 * and never a client's name, note or phone. Client counts are distinct ids.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { createdAtToTbilisiYmd } from './adminAnalyticsRange.js';
import { daySeries, flagState, iso, loadPeople, loadTeamUserIds, ms, personSummary, USAGE_PERIODS, usageWindow } from './adminUsageKit.js';
import { listFeatureFlags } from './featureFlags.js';
import { CATEGORIES } from './book/catalog.js';

export const BOOK_ADMIN_PERIODS = USAGE_PERIODS;
/** The wall shows at most this many businesses (claimed and pending first, then the busiest listed ones). */
export const BOOK_WALL_MAX = 240;
const LIVE = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'];

const n2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const rate = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const hoursSet = (hours) => Boolean(hours && typeof hours === 'object' && Object.values(hours).some((d) => Array.isArray(d) && d.length));
const topBy = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

/**
 * Pure: raw rows (all accounts) → the page payload.
 * @param {object} raw  from loadBookAdminRaw (or a test fixture)
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildBookOverview(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const { dayKeys, inPeriod } = win;
  const teamIds = new Set(raw.teamUserIds || []);
  const people = new Map((raw.people || []).map((u) => [u.id, u]));
  const counts = (key) => new Map((raw[key] || []).map((r) => [r.businessId, r]));
  const services = counts('services');
  const staff = counts('staff');
  const photos = counts('photos');
  const products = counts('products');
  const supplies = counts('supplies');
  const resources = counts('resources');
  const memberships = counts('memberships');
  const clients = counts('clients');
  const reviews = counts('reviews');
  const favourites = counts('favourites');
  const lifetime = counts('bookingsLifetime');

  const allBusinesses = (raw.businesses || []).map((b) => ({ ...b, team: Boolean(b.ownerUserId && teamIds.has(b.ownerUserId)) }));
  const kept = allBusinesses.filter((b) => includeTeam || !b.team);
  const keptIds = new Set(kept.map((b) => b.id));
  const teamBusinesses = allBusinesses.filter((b) => b.team);
  const teamOwners = new Set(teamBusinesses.map((b) => b.ownerUserId));

  const appts = (raw.appointments || []).filter((a) => keptIds.has(a.businessId) && LIVE.includes(a.status) || (keptIds.has(a.businessId) && a.status === 'CANCELLED'));
  const periodAppts = appts.filter((a) => inPeriod(a.createdAt));
  const events = (raw.events || []).filter((e) => keptIds.has(e.businessId) && inPeriod(e.at));
  const clientKey = (a) => a.clientUserId || a.clientId || null;

  // ── per business ─────────────────────────────────────────────────────────
  const perBiz = new Map();
  const biz = (id) => { if (!perBiz.has(id)) perBiz.set(id, { bookings: 0, completed: 0, noShow: 0, cancelled: 0, clients: new Set(), views: 0, calls: 0, routes: 0, lastBookingAt: null, lastViewAt: null, sources: {} }); return perBiz.get(id); };
  for (const a of periodAppts) {
    const p = biz(a.businessId);
    if (a.status === 'CANCELLED') { p.cancelled += 1; continue; }
    p.bookings += 1;
    if (a.status === 'COMPLETED') p.completed += 1;
    if (a.status === 'NO_SHOW') p.noShow += 1;
    const ck = clientKey(a);
    if (ck) p.clients.add(ck);
    p.sources[a.source || 'BUSINESS'] = (p.sources[a.source || 'BUSINESS'] || 0) + 1;
  }
  for (const a of appts) {
    if (a.status === 'CANCELLED') continue;
    const p = biz(a.businessId);
    if (!p.lastBookingAt || ms(a.createdAt) > ms(p.lastBookingAt)) p.lastBookingAt = a.createdAt;
  }
  for (const e of events) {
    const p = biz(e.businessId);
    if (e.kind === 'VIEW') p.views += 1;
    else if (e.kind === 'CALL') p.calls += 1;
    else if (e.kind === 'ROUTE') p.routes += 1;
    if (e.kind === 'VIEW' && (!p.lastViewAt || ms(e.at) > ms(p.lastViewAt))) p.lastViewAt = e.at;
  }

  const modulesOf = (b) => ({
    products: (products.get(b.id)?.n || 0) > 0,
    supplies: (supplies.get(b.id)?.n || 0) > 0,
    resources: (resources.get(b.id)?.n || 0) > 0,
    memberships: (memberships.get(b.id)?.n || 0) > 0,
    cashback: Number(b.settings?.loyalty?.cashbackPercent || 0) > 0,
    sms: Boolean(b.settings?.notify?.sms?.enabled),
    online: b.settings?.onlineBooking !== false,
  });
  const cards = kept.map((b) => {
    const p = perBiz.get(b.id) || biz(b.id);
    const life = lifetime.get(b.id) || {};
    const rv = reviews.get(b.id) || {};
    const mods = modulesOf(b);
    const owner = b.ownerUserId && people.has(b.ownerUserId) ? personSummary(people.get(b.ownerUserId), { teamIds }) : null;
    return {
      id: b.id,
      name: b.nameKa || b.name,
      category: b.category,
      city: b.city || null,
      status: b.status,
      source: b.source || null,
      createdAt: iso(b.createdAt),
      claimedAt: iso(b.claimedAt),
      owner,
      team: b.team,
      setup: {
        services: services.get(b.id)?.n || 0,
        staff: staff.get(b.id)?.n || 0,
        photos: photos.get(b.id)?.n || 0,
        hours: hoursSet(b.hours),
        phone: Boolean(b.phone),
        city: Boolean(b.city),
        clients: clients.get(b.id)?.n || 0,
      },
      period: { bookings: p.bookings, completed: p.completed, noShow: p.noShow, cancelled: p.cancelled, clients: p.clients.size, views: p.views, calls: p.calls, routes: p.routes, sources: p.sources },
      lifetime: { bookings: Number(life.n || 0), completed: Number(life.completed || 0), noShow: Number(life.noShow || 0), lastBookingAt: iso(p.lastBookingAt || life.lastAt), reviews: Number(rv.n || 0), rating: rv.avg == null ? null : n2(rv.avg), favourites: favourites.get(b.id)?.n || 0 },
      modules: mods,
      modulesOn: ['products', 'supplies', 'resources', 'memberships', 'cashback', 'sms'].filter((k) => mods[k]).length,
      lastViewAt: iso(p.lastViewAt),
    };
  });
  // The wall: claimed and pending places, then listed ones that got attention (bookings or views) — capped.
  const score = (c) => (c.status === 'PENDING' ? 1e9 : c.status === 'CLAIMED' ? 5e8 : 0) + c.period.bookings * 1000 + c.lifetime.bookings * 10 + c.period.views;
  const wallAll = cards.filter((c) => ['CLAIMED', 'PENDING'].includes(c.status) || c.period.bookings || c.period.views || c.lifetime.bookings).sort((a, b) => score(b) - score(a));
  const wall = wallAll.slice(0, BOOK_WALL_MAX);

  // ── totals, ladders ───────────────────────────────────────────────────────
  const claimed = cards.filter((c) => c.status === 'CLAIMED');
  const totals = {
    listed: cards.filter((c) => c.status === 'LISTED').length,
    claimed: claimed.length,
    pending: cards.filter((c) => c.status === 'PENDING').length,
    hidden: cards.filter((c) => c.status === 'HIDDEN').length,
    inCatalogue: cards.filter((c) => ['LISTED', 'CLAIMED'].includes(c.status)).length,
    owners: new Set(claimed.map((c) => c.owner?.id).filter(Boolean)).size,
    ready: claimed.filter((c) => c.setup.services && c.setup.staff).length,
    booked: claimed.filter((c) => c.lifetime.bookings > 0).length,
    active: claimed.filter((c) => c.period.bookings > 0).length,
    idle: claimed.filter((c) => !c.period.bookings).length,
    claimsPending: (raw.claims || []).filter((c) => c.status === 'PENDING' && (includeTeam || !teamIds.has(c.userId))).length,
  };
  const ladder = [
    { key: 'catalogue', count: totals.inCatalogue + totals.pending, rate: 100 },
    { key: 'claimed', count: claimed.length + totals.pending },
    { key: 'ready', count: totals.ready },
    { key: 'booked', count: totals.booked },
    { key: 'active', count: totals.active },
  ].map((s, i, arr) => ({ ...s, rate: i ? rate(s.count, arr[0].count) : 100 }));

  // People in the period: viewed a page → booked → came → booked again (anyone, not only app accounts).
  const viewers = new Set(events.filter((e) => e.kind === 'VIEW' && e.viewerHash).map((e) => e.viewerHash));
  const bookedPeople = new Set(periodAppts.filter((a) => a.status !== 'CANCELLED').map(clientKey).filter(Boolean));
  const completedPeople = new Set(periodAppts.filter((a) => a.status === 'COMPLETED').map(clientKey).filter(Boolean));
  const bookingsEver = new Map();
  for (const a of appts) { const ck = clientKey(a); if (ck && a.status !== 'CANCELLED') bookingsEver.set(ck, (bookingsEver.get(ck) || 0) + 1); }
  const returning = [...bookedPeople].filter((ck) => (bookingsEver.get(ck) || 0) >= 2).length;
  const peopleLadder = [
    { key: 'viewed', count: viewers.size, rate: 100 },
    { key: 'booked', count: bookedPeople.size },
    { key: 'came', count: completedPeople.size },
    { key: 'returned', count: returning },
  ].map((s, i, arr) => ({ ...s, rate: i ? rate(s.count, arr[0].count || arr[1].count || 1) : 100 }));

  // ── the period ────────────────────────────────────────────────────────────
  const liveAppts = periodAppts.filter((a) => a.status !== 'CANCELLED');
  const sources = {};
  for (const a of liveAppts) sources[a.source || 'BUSINESS'] = (sources[a.source || 'BUSINESS'] || 0) + 1;
  const newClients = new Set(liveAppts.map(clientKey).filter((ck) => ck && (bookingsEver.get(ck) || 0) === 1)).size;
  const period = {
    days: win.days, from: win.from, to: win.to,
    bookings: liveAppts.length,
    completed: liveAppts.filter((a) => a.status === 'COMPLETED').length,
    noShow: liveAppts.filter((a) => a.status === 'NO_SHOW').length,
    cancelled: periodAppts.filter((a) => a.status === 'CANCELLED').length,
    people: bookedPeople.size,
    newClients,
    businesses: new Set(liveAppts.map((a) => a.businessId)).size,
    views: events.filter((e) => e.kind === 'VIEW').length,
    calls: events.filter((e) => e.kind === 'CALL').length,
    routes: events.filter((e) => e.kind === 'ROUTE').length,
    sources,
    trend: {
      bookings: daySeries(dayKeys, liveAppts, (a) => a.createdAt),
      completed: daySeries(dayKeys, liveAppts.filter((a) => a.status === 'COMPLETED'), (a) => a.startsAt),
      views: daySeries(dayKeys, events.filter((e) => e.kind === 'VIEW'), (e) => e.at),
    },
  };

  // ── composition and quality ───────────────────────────────────────────────
  const catalogue = cards.filter((c) => ['LISTED', 'CLAIMED'].includes(c.status));
  const byCat = new Map();
  const claimedByCat = new Map();
  for (const c of catalogue) byCat.set(c.category, (byCat.get(c.category) || 0) + 1);
  for (const c of claimed) claimedByCat.set(c.category, (claimedByCat.get(c.category) || 0) + 1);
  const cities = new Map();
  for (const c of catalogue) if (c.city) cities.set(c.city, (cities.get(c.city) || 0) + 1);
  const composition = {
    categories: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count, claimed: claimedByCat.get(id) || 0 })),
    cities: topBy(cities, 8).map(([name, count]) => ({ name, count, claimed: claimed.filter((c) => c.city === name).length })),
    sources: Object.entries(catalogue.reduce((acc, c) => { acc[c.source || 'OTHER'] = (acc[c.source || 'OTHER'] || 0) + 1; return acc; }, {})).map(([id, count]) => ({ id, count })),
  };
  const quality = {
    claimed: claimed.length,
    noServices: claimed.filter((c) => !c.setup.services).length,
    noStaff: claimed.filter((c) => !c.setup.staff).length,
    noPhotos: claimed.filter((c) => !c.setup.photos).length,
    noHours: claimed.filter((c) => !c.setup.hours).length,
    noPhone: claimed.filter((c) => !c.setup.phone).length,
    onlineOff: claimed.filter((c) => !c.modules.online).length,
    catalogueNoCity: catalogue.filter((c) => !c.setup.city).length,
    catalogueNoPhone: catalogue.filter((c) => !c.setup.phone).length,
    modules: {
      products: claimed.filter((c) => c.modules.products).length,
      supplies: claimed.filter((c) => c.modules.supplies).length,
      resources: claimed.filter((c) => c.modules.resources).length,
      memberships: claimed.filter((c) => c.modules.memberships).length,
      cashback: claimed.filter((c) => c.modules.cashback).length,
      sms: claimed.filter((c) => c.modules.sms).length,
    },
  };

  const claimsPending = (raw.claims || [])
    .filter((c) => c.status === 'PENDING' && (includeTeam || !teamIds.has(c.userId)))
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
    .slice(0, 6)
    .map((c) => ({ id: c.id, kind: c.kind, businessId: c.businessId, businessName: c.businessNameKa || c.businessName, userName: c.userName || '', createdAt: iso(c.createdAt), waitingDays: Math.max(0, Math.floor((now.getTime() - ms(c.createdAt)) / 86_400_000)) }));

  return {
    installed: true,
    generatedAt: now.toISOString(),
    days: win.days,
    includeTeam,
    flags: { book: flagState(raw.flags, 'book') },
    totals,
    ladder,
    peopleLadder,
    period,
    businesses: wall,
    businessesTotal: wallAll.length,
    catalogueTotal: cards.length,
    composition,
    quality,
    claimsPending,
    team: { accounts: teamOwners.size, businesses: teamBusinesses.length },
    categories: CATEGORIES.map((c) => ({ id: c.id, label: c.ka, color: c.color })),
  };
}

/** Raw rows for the builder: aggregates per business, the last 90 days of bookings and listing events, claims, people. */
export async function loadBookAdminRaw(db = prisma, { now = new Date() } = {}) {
  const [probe] = await db.$queryRaw`SELECT to_regclass('"BookBusiness"') IS NOT NULL AS ok`;
  if (!probe?.ok) return { installed: false };
  const since = new Date(now.getTime() - 92 * 86_400_000);
  const count = (table, extra = Prisma.empty) => db.$queryRaw`SELECT "businessId", COUNT(*)::int AS n FROM ${Prisma.raw(`"${table}"`)} WHERE TRUE ${extra} GROUP BY "businessId"`;
  const optional = (p) => p.catch((e) => { if (/does not exist|42P01|P2021/.test(String(e?.message || e?.code || ''))) return []; throw e; });
  const [businesses, services, staff, photos, products, supplies, resources, memberships, clients, reviews, favourites, bookingsLifetime, appointments, events, claims, flags, teamUserIds] = await Promise.all([
    db.$queryRaw`SELECT id, name, "nameKa", category, city, status, source, phone, hours, settings, "ownerUserId", "claimedAt", "createdAt" FROM "BookBusiness"`,
    count('BookService', Prisma.sql`AND active`),
    count('BookStaff', Prisma.sql`AND active`),
    optional(count('BookImage', Prisma.sql`AND NOT private`)),
    optional(count('BookProduct', Prisma.sql`AND active AND kind = 'RETAIL'`)),
    optional(count('BookProduct', Prisma.sql`AND active AND kind = 'SUPPLY'`)),
    optional(count('BookResource', Prisma.sql`AND active`)),
    optional(count('BookMembership', Prisma.sql`AND active`)),
    count('BookClient'),
    db.$queryRaw`SELECT "businessId", COUNT(*)::int AS n, AVG(rating)::float AS avg FROM "BookReview" WHERE NOT hidden GROUP BY "businessId"`,
    db.$queryRaw`SELECT "businessId", COUNT(*)::int AS n FROM "BookFavorite" GROUP BY "businessId"`,
    db.$queryRaw`SELECT "businessId", COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed, COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow", MAX("createdAt") AS "lastAt" FROM "BookAppointment" WHERE status <> 'CANCELLED' GROUP BY "businessId"`,
    db.$queryRaw`SELECT id, "businessId", "clientUserId", "clientId", status, source, "createdAt", "startsAt" FROM "BookAppointment" WHERE "createdAt" >= ${since} OR "startsAt" >= ${since}`,
    db.$queryRaw`SELECT "businessId", kind, "viewerHash", at FROM "BookEvent" WHERE at >= ${since} ORDER BY at DESC LIMIT 80000`,
    db.$queryRaw`SELECT c.id, c."businessId", c."userId", c.kind, c.status, c."createdAt", b.name AS "businessName", b."nameKa" AS "businessNameKa", u."fullName" AS "userName" FROM "BookClaim" c JOIN "BookBusiness" b ON b.id = c."businessId" JOIN "User" u ON u.id = c."userId" ORDER BY c."createdAt" DESC LIMIT 200`,
    listFeatureFlags().catch(() => []),
    loadTeamUserIds(db),
  ]);
  const ownerIds = businesses.map((b) => b.ownerUserId).filter(Boolean);
  const { people } = await loadPeople(ownerIds, db);
  return { installed: true, businesses, services, staff, photos, products, supplies, resources, memberships, clients, reviews, favourites, bookingsLifetime, appointments, events, claims, flags, teamUserIds, people };
}

export async function loadBookOverview({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  const raw = await loadBookAdminRaw(db, { now });
  if (raw.installed === false) return { installed: false };
  return buildBookOverview(raw, { days, includeTeam, now });
}

/** For tests: the Tbilisi day of a timestamp (re-exported so fixtures can be built on the same calendar). */
export const tbilisiDay = createdAtToTbilisiYmd;
