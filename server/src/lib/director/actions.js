/**
 * Director actions on the live system. Lookups return masked, minimal fields (no health data).
 * Every write runs only after the owner approved a proposal (execute*), except support replies
 * the owner delegated during working hours (see supportAgent.js). All writes are audited as
 * "director@medicard.ge".
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { writeAdminAudit } from '../adminAudit.js';
import { adjustCoins, ledgerBalance } from '../adminCoins.js';
import { findUserByPhone } from '../phoneUsers.js';
import { maskEmail, normalizeEmail, SYNTHETIC_EMAIL_DOMAIN } from '../email/address.js';
import { sendSupportReply } from '../support/reply.js';
import { updateInitiative } from './store.js';

export const DIRECTOR_ADMIN = Object.freeze({ id: null, email: 'director@medicard.ge', fullName: 'დირექტორი' });

const maskPhone = (p) => (p ? `•••${String(p).replace(/\D/g, '').slice(-3)}` : null);
const maskName = (n) => (n ? String(n).trim().split(/\s+/).map((w) => `${w[0]}.`).join(' ') : null);

/* ───────── users ───────── */

export async function findUser(query, { db = prisma } = {}) {
  const q = String(query || '').trim();
  if (!q) return { found: false, reason: 'empty query' };
  let user = null;
  if (q.includes('@')) {
    user = await db.user.findUnique({ where: { email: normalizeEmail(q) } });
  } else if (/\d{6,}/.test(q.replace(/\D/g, ''))) {
    user = await findUserByPhone(q);
  } else {
    return { found: false, reason: 'give a phone number or an email address' };
  }
  if (!user) return { found: false };
  const [last, balance] = await Promise.all([
    db.$queryRaw`SELECT MAX("lastAt") AS "lastAt", (ARRAY_AGG(platform ORDER BY "lastAt" DESC))[1] AS platform
      FROM "AppActivity" WHERE "userId" = ${user.id}`.catch(() => [{}]),
    ledgerBalance(db, user.id).catch(() => ({ coins: null })),
  ]);
  return {
    found: true,
    userId: user.id,
    name: maskName(user.fullName),
    email: user.email?.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`) ? null : maskEmail(user.email),
    phone: maskPhone(user.phone),
    status: user.status,
    registeredAt: user.createdAt,
    lastActiveAt: last?.[0]?.lastAt || null,
    platform: last?.[0]?.platform || null,
    coins: balance.coins,
  };
}

/* ───────── support ───────── */

export async function listSupportThreads({ status = 'active', limit = 15 } = {}, { db = prisma } = {}) {
  const where = status === 'all' ? {} : status === 'active' ? { status: { not: 'closed' } } : { status };
  const threads = await db.supportThread.findMany({
    where, orderBy: { lastMessageAt: 'desc' }, take: Math.min(30, limit),
    include: { messages: { where: { direction: 'inbound' }, orderBy: { createdAt: 'desc' }, take: 1, select: { textBody: true, createdAt: true } } },
  });
  return threads.map((t) => ({
    threadId: t.id, subject: t.subject, from: maskEmail(t.counterpartEmail), status: t.status, unread: t.unread,
    messages: t.messageCount, lastMessageAt: t.lastMessageAt, preview: String(t.messages[0]?.textBody || '').slice(0, 200),
  }));
}

export async function readSupportThread(threadId, { db = prisma } = {}) {
  const t = await db.supportThread.findUnique({
    where: { id: String(threadId) },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 30, select: { direction: true, textBody: true, createdAt: true, isAuto: true, authorAdminId: true } } },
  });
  if (!t) return { error: 'thread not found' };
  return {
    threadId: t.id, subject: t.subject, from: maskEmail(t.counterpartEmail), status: t.status, linkedAccount: Boolean(t.userId),
    messages: t.messages.slice(-12).map((m) => ({ direction: m.direction, at: m.createdAt, auto: m.isAuto, text: String(m.textBody || '').slice(0, 2500) })),
  };
}

export async function sendDirectorSupportReply({ threadId, body, status = 'waiting', approvedByOwner = false }) {
  const res = await sendSupportReply({ threadId, body, status, admin: DIRECTOR_ADMIN });
  await writeAdminAudit({ admin: DIRECTOR_ADMIN, action: 'support.reply', targetType: 'supportThread', targetId: threadId, newValue: { chars: body.length, approvedByOwner } });
  return res;
}

/* ───────── MEDIRUN ───────── */

export async function findPlace(address) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', String(address).slice(0, 200));
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '3');
  url.searchParams.set('countrycodes', 'ge');
  const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'ka,en', 'User-Agent': 'Medicard.GE/1.0 (director; support@medicard.ge)' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return { error: `geocoder ${res.status}` };
  const rows = await res.json();
  if (!rows.length) return { found: false };
  return { found: true, places: rows.map((r) => ({ label: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon) })) };
}

export async function listActiveGifts({ db = prisma } = {}) {
  const rows = await db.medipulsiGift.findMany({ where: { published: true, archived: false, endsAt: { gt: new Date() }, NOT: { id: { startsWith: 'starter-' } } }, orderBy: { endsAt: 'asc' }, take: 20 });
  return rows.map((g) => ({ id: g.id, title: g.title, latitude: g.latitude, longitude: g.longitude, stock: g.stock, allocated: g.allocated, endsAt: g.endsAt }));
}

export function giftFromPayload(p, now = new Date()) {
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (!(lat >= 41 && lat <= 43.7 && lng >= 39.9 && lng <= 46.8)) throw new Error('location must be inside Georgia');
  const days = Math.min(60, Math.max(1, Math.round(Number(p.days) || 7)));
  return {
    id: `dir-${now.getTime().toString(36)}-${randomUUID().slice(0, 4)}`,
    title: String(p.title || '').trim().slice(0, 100) || 'საჩუქარი',
    description: String(p.description || '').trim().slice(0, 1000),
    latitude: lat,
    longitude: lng,
    pulseRadius: 120,
    revealRadius: 20,
    rewardKind: p.rewardKind === 'PHYSICAL' ? 'PHYSICAL' : 'DIGITAL',
    stock: Math.min(100, Math.max(1, Math.round(Number(p.stock) || 1))),
    published: true,
    archived: false,
    startsAt: now,
    endsAt: new Date(now.getTime() + days * 86400000),
    revision: 0,
  };
}

/* ───────── execution of approved proposals ───────── */

export async function executeProposal(proposal, { db = prisma } = {}) {
  const p = proposal.payload || {};
  switch (p.action) {
    case 'support_reply': {
      await sendDirectorSupportReply({ threadId: p.threadId, body: p.body, approvedByOwner: true });
      return 'პასუხი გაიგზავნა.';
    }
    case 'coins': {
      const r = await adjustCoins({ userId: p.userId, amount: Number(p.amount), reason: String(p.reason || 'დირექტორი').slice(0, 200), adminEmail: DIRECTOR_ADMIN.email }, { db });
      await writeAdminAudit({ admin: DIRECTOR_ADMIN, action: p.amount > 0 ? 'coins.grant' : 'coins.revoke', targetType: 'user', targetId: p.userId, previousValue: { coins: r.before }, newValue: { coins: r.after, amount: p.amount, reason: p.reason, approvedByOwner: true } });
      return `ბალანსი: ${r.before} → ${r.after} coin.`;
    }
    case 'medirun_gift': {
      const gift = giftFromPayload(p);
      await db.$transaction(async (tx) => {
        await tx.medipulsiGift.create({ data: gift });
        await tx.medipulsiAudit.create({ data: { id: randomUUID(), actorId: 'director', action: 'GIFT_SAVE', entityId: gift.id, details: { after: gift, approvedByOwner: true, place: p.placeLabel || null } } });
      });
      return `საჩუქარი რუკაზეა (${gift.id}), მოქმედებს ${gift.endsAt.toISOString().slice(0, 10)}-მდე.`;
    }
    case 'initiative': {
      const i = await updateInitiative(p.initiativeId, { status: 'approved' }, { byOwner: true }, db);
      if (!i) throw new Error('ინიციატივა ვერ მოიძებნა');
      return 'ინიციატივა დამტკიცდა — დირექტორი მუშაობას იწყებს და პროგრესს გეგმის დაფაზე აჩვენებს.';
    }
    default:
      return null; // decisions/tasks without a system action — the Director reports on them itself
  }
}
