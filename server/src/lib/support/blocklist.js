/**
 * Support inbox — blocked senders (phishing such as fake „Meta“ ad-account warnings).
 *
 * Mail from a blocked address — or from a whole "@domain" entry — is dropped by the inbound webhook
 * before anything is stored (Resend still keeps the original). The webhook reads the list through a
 * 60 s per-instance cache; a missing table or a failed read never blocks anyone.
 */
import { prisma } from '../prisma.js';
import { isOwnDomain } from './threading.js';

const TTL_MS = 60_000;
const caches = new WeakMap();

const missingTable = (error) => /SupportBlockedSender|42P01|P2010|does not exist/i.test(String(error?.message || error?.code || ''));
const normalize = (email) => String(email || '').trim().toLowerCase();

/** The entries that would block this address: the address itself and its "@domain". */
export function blockPatternsFor(email) {
  const e = normalize(email);
  const at = e.lastIndexOf('@');
  return at > 0 && at < e.length - 1 ? [e, e.slice(at)] : [];
}

/** A real outside address — our own mailboxes can never be blocked. */
export const canBlockSender = (email) => blockPatternsFor(email).length > 0 && !isOwnDomain(normalize(email));

async function readPatterns(db, cached) {
  const hit = caches.get(db);
  if (cached && hit && Date.now() - hit.at < TTL_MS) return hit.set;
  const rows = await db.$queryRaw`SELECT pattern FROM "SupportBlockedSender"`;
  const set = new Set(rows.map((r) => r.pattern));
  caches.set(db, { at: Date.now(), set });
  return set;
}

export async function isBlockedSender(email, db = prisma, { cached = true } = {}) {
  const patterns = blockPatternsFor(email);
  if (!patterns.length || typeof db?.$queryRaw !== 'function') return false;
  try {
    const set = await readPatterns(db, cached);
    return patterns.some((p) => set.has(p));
  } catch (error) {
    if (!missingTable(error)) console.warn('[support] blocklist read failed', error?.code || error?.message);
    return false;
  }
}

export async function blockSender(email, { adminId = null, reason = null } = {}, db = prisma) {
  const pattern = normalize(email);
  if (!canBlockSender(pattern)) throw Object.assign(new Error('ამ მისამართის დაბლოკვა არ შეიძლება.'), { status: 400 });
  await db.$executeRaw`INSERT INTO "SupportBlockedSender" (pattern, reason, "createdById")
    VALUES (${pattern}, ${reason}, ${adminId}) ON CONFLICT (pattern) DO NOTHING`;
  caches.delete(db);
}

export async function unblockSender(email, db = prisma) {
  await db.$executeRaw`DELETE FROM "SupportBlockedSender" WHERE pattern = ${normalize(email)}`;
  caches.delete(db);
}
