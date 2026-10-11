/**
 * Shared bits of the admin module-usage pages (#/pets MEDIVET first; MEDICYCLE, MEDIPILL, MEDILAB, MEDIFOOD,
 * MEDIQUEST, MEDICOACH follow the same shape): team accounts, the 7/30/90-day window, day series, who did
 * something on which day, owner contact. Each module's `adminUsage<Module>.js` loads its own rows and keeps
 * a pure `build…` function so the numbers are testable without a database.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, enumerateYmds, tbilisiYmd } from './adminAnalyticsRange.js';

export const USAGE_PERIODS = Object.freeze([7, 30, 90]);

/** Exact company logins (demo / review / staff). Synthetic `…@phone.medicard.ge` / `…@apple.medicard.ge` are real people. */
export function isTeamEmail(email) {
  return /^[^@\s]+@medicard\.ge$/i.test(String(email || '').trim());
}

/** Ids of the team accounts (left out of every usage page unless „გუნდის ჩათვლით“). */
export async function loadTeamUserIds(db = prisma) {
  const rows = await db.user.findMany({ where: { email: { endsWith: '@medicard.ge', mode: 'insensitive' } }, select: { id: true, email: true } });
  return rows.filter((u) => isTeamEmail(u.email)).map((u) => u.id);
}

/** „+995 5xx xx xx xx“ / „Apple-ით შესული“ / the e-mail, the same way the rest of the admin shows a login. */
export function ownerContact(user) {
  const email = String(user?.email || '');
  const phone = String(user?.phone || '') || (/^\+?(\d{9,15})@phone\.medicard\.ge$/i.exec(email)?.[1] ?? '');
  if (phone) {
    const d = phone.replace(/\D/g, '');
    return d.length === 12 && d.startsWith('995') ? `+995 ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : `+${d}`;
  }
  if (/@apple\.medicard\.ge$/i.test(email)) return 'Apple-ით შესული';
  return email;
}

export const usagePeriod = (days) => (USAGE_PERIODS.includes(Number(days)) ? Number(days) : 30);

/** The page's window in Tbilisi days: today back to `days - 1` days ago. */
export function usageWindow(days, now = new Date()) {
  const period = usagePeriod(days);
  const today = tbilisiYmd(now);
  const from = addDaysYmd(today, -(period - 1));
  const dayKeys = enumerateYmds(from, today);
  const inPeriod = (value) => {
    const ymd = createdAtToTbilisiYmd(value);
    return Boolean(ymd) && ymd >= from && ymd <= today;
  };
  return { days: period, today, from, to: today, dayKeys, inPeriod };
}

/** [{ day, count }] for every day of the window: rows counted on the Tbilisi day of `at(row)`. */
export function daySeries(dayKeys, rows, at = (r) => r.createdAt, weight = () => 1) {
  const map = new Map(dayKeys.map((d) => [d, 0]));
  for (const r of rows || []) {
    const d = createdAtToTbilisiYmd(at(r));
    if (map.has(d)) map.set(d, map.get(d) + weight(r));
  }
  return [...map].map(([day, count]) => ({ day, count }));
}

/** Who did something in the module on which Tbilisi day: active users per day / period, „came back another day“. */
export function activityTracker() {
  const byUser = new Map();
  const events = [];
  return {
    act(userId, at) {
      if (!userId || !at) return;
      const day = createdAtToTbilisiYmd(at);
      if (!day) return;
      if (!byUser.has(userId)) byUser.set(userId, new Set());
      byUser.get(userId).add(day);
      events.push({ userId, day });
    },
    days: (userId) => byUser.get(userId)?.size || 0,
    users: () => [...byUser.keys()],
    activeByDay(dayKeys) {
      const map = new Map(dayKeys.map((d) => [d, new Set()]));
      for (const e of events) map.get(e.day)?.add(e.userId);
      return [...map].map(([day, set]) => ({ day, count: set.size }));
    },
    activeIn: (from, to) => new Set(events.filter((e) => e.day >= from && e.day <= to).map((e) => e.userId)).size,
    lastDay: (userId) => [...(byUser.get(userId) || [])].sort().pop() || null,
  };
}

export function zeroes(keys) {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

export function bump(obj, key, by = 1) {
  obj[key] = (obj[key] || 0) + by;
}

export const ms = (value) => (value ? new Date(value).getTime() : 0);
export const iso = (value) => (value ? new Date(value).toISOString() : null);

export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Name, contact, sign-up and last app visit for the given accounts, plus the Tbilisi days they opened the app.
 * Only what the user page already shows: never health values.
 */
export async function loadPeople(ids, db = prisma) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return { people: [], appDays: [] };
  const [users, seen, days] = await Promise.all([
    db.user.findMany({ where: { id: { in: list } }, select: { id: true, fullName: true, email: true, phone: true, createdAt: true } }),
    db.appActivity.groupBy({ by: ['userId'], where: { userId: { in: list } }, _max: { lastAt: true } }),
    db.appActivity.findMany({ where: { userId: { in: list } }, select: { userId: true, date: true } }),
  ]);
  const last = new Map(seen.map((r) => [r.userId, r._max?.lastAt || null]));
  return {
    people: users.map((u) => ({ ...u, lastSeenAt: last.get(u.id) || null })),
    // AppActivity.date is a calendar date (Tbilisi day) stored as UTC midnight.
    appDays: days.map((a) => ({ userId: a.userId, date: new Date(a.date).toISOString().slice(0, 10) })),
  };
}

/** The person block every usage page shows under a card: name, contact, team mark, sign-up, last app visit. */
export function personSummary(user, { teamIds } = {}) {
  const u = user || {};
  return {
    id: u.id || null,
    name: u.fullName || '',
    contact: ownerContact(u),
    team: Boolean(teamIds?.has?.(u.id)),
    signupAt: iso(u.createdAt),
    lastSeenAt: iso(u.lastSeenAt),
  };
}

/** Feature switch state for the page's callout (`listFeatureFlags` rows). Missing row = on. */
export function flagState(rows, key) {
  const f = (rows || []).find((row) => row.key === key);
  return f ? { enabled: f.enabled !== false, effective: f.effective !== false, blockedBy: f.blockedBy || null } : { enabled: true, effective: true, blockedBy: null };
}

export const missingTable = (error) => error?.code === 'P2021' || /does not exist|42P01/.test(String(error?.message || ''));
