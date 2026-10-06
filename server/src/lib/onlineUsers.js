// Who is in the app right now, for the admin home (owner 2026-10-06: „ონლაინ იუზერები, რეალთაიმში“).
// Source: AppActivity.lastAt — the app writes it on open, on every screen and on a ~15 s heartbeat
// (web /app too). Online = a heartbeat in the last 90 s, the same window as the „ახლა აპში“ count.
// Admin only: names and contacts, never health data.
import { prisma } from './prisma.js';
import { ensureAppActivityTable } from './appActivity.js';

export const ONLINE_WINDOW_MS = 90_000;
const MAX_LISTED = 100;

/** Synthetic …@phone / …@apple.medicard.ge logins are shown as the number / „Apple“ instead. */
export function contactOf(email, phone) {
  const raw = String(email || '');
  const synthetic = /^\+?(\d{9,15})@phone\.medicard\.ge$/i.exec(raw);
  const number = phone || (synthetic ? `+${synthetic[1]}` : null);
  if (number) {
    const d = String(number).replace(/\D/g, '');
    return d.length === 12 && d.startsWith('995') ? `+995 ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : `+${d}`;
  }
  if (/@apple\.medicard\.ge$/i.test(raw)) return 'Apple';
  return raw;
}

/** The app sends its route (`(tabs)/home`, `cycle/settings`…); `open`/`heartbeat` say nothing. */
export function screenOf(activityType) {
  const raw = String(activityType || '').trim();
  if (!raw || raw === 'open' || raw === 'heartbeat') return null;
  return raw.replace(/\([^)]*\)\/?/g, '').replace(/^\/+|\/+$/g, '') || 'home';
}

/** Pure: DB rows → the list the admin sees (newest heartbeat first). */
export function shapeOnlineUsers(rows, now = Date.now()) {
  const users = [];
  for (const row of rows || []) {
    const lastAt = new Date(row.lastAt).getTime();
    if (!Number.isFinite(lastAt) || now - lastAt > ONLINE_WINDOW_MS) continue;
    users.push({
      id: row.userId,
      name: String(row.fullName || '').trim() || null,
      contact: contactOf(row.email, row.phone),
      gender: row.gender || null,
      platform: row.platform ? String(row.platform).toLowerCase() : null,
      appVersion: row.appVersion || null,
      screen: screenOf(row.activityType),
      firstAt: row.firstAt ? new Date(row.firstAt).toISOString() : null,
      lastAt: new Date(lastAt).toISOString(),
      joinedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    });
  }
  users.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return users;
}

export async function getOnlineUsers(now = new Date()) {
  await ensureAppActivityTable();
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);
  // lastAt is indexed; a user can have yesterday's and today's row around midnight — keep the newest.
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT ON (a."userId")
      a."userId", a."firstAt", a."lastAt", a."platform", a."appVersion", a."activityType",
      u."fullName", u."email", u."phone", u."gender", u."createdAt"
    FROM "AppActivity" a
    JOIN "User" u ON u."id" = a."userId"
    WHERE a."lastAt" >= ${since}
    ORDER BY a."userId", a."lastAt" DESC
  `;
  const users = shapeOnlineUsers(rows, now.getTime());
  return {
    refreshedAt: now.toISOString(),
    windowSeconds: ONLINE_WINDOW_MS / 1000,
    count: users.length,
    users: users.slice(0, MAX_LISTED),
  };
}

/** Cheap change check so the ticker only emits when someone came, left or moved platform. */
export function onlineSignature(snapshot) {
  return (snapshot?.users || []).map((u) => `${u.id}:${u.platform || ''}:${u.appVersion || ''}:${u.screen || ''}`).join('|');
}
