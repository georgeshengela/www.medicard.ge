/**
 * App icon usage (owner 2026-10-13: „რამდენი ხმარობს და რომელს ხმარობენ“). The iPhone app tells the server which
 * home-screen icon it shows (mobile/src/lib/appIconReport.ts → POST /api/app/icon) after sign-in / app start and
 * right after a pick in Profile → „აპის აიქონი“. One row per account holds the current icon; admin #/app-icons
 * counts them. The icon id is all that is stored — nothing else about the person or the phone.
 *
 * Raw SQL (install-app-icons.mjs in db:install; also created lazily). Rows go with the account (FK cascade).
 */
import { prisma } from './prisma.js';
import { iso, loadPeople, loadTeamUserIds, missingTable, personSummary } from './adminUsageKit.js';

/** Mirrors mobile/src/lib/appIcon.ts (AppIconId, ALL_ICONS order and groups); appIcons.test.js keeps them equal. */
export const APP_ICONS = Object.freeze([
  { id: 'classic', group: 'core', name: 'კლასიკური' },
  { id: 'rose', group: 'core', name: 'ვარდისფერი' },
  { id: 'midnight', group: 'core', name: 'ღამე' },
  { id: 'pearl', group: 'core', name: 'მარგალიტი' },
  { id: 'gold', group: 'core', name: 'ოქრო' },
  { id: 'chukurtma', group: 'women', name: 'ჩუქურთმა' },
  { id: 'silk', group: 'women', name: 'აბრეშუმი' },
  { id: 'orchid', group: 'women', name: 'ორქიდეა' },
  { id: 'lavender', group: 'women', name: 'ლავანდა' },
  { id: 'cherry', group: 'women', name: 'ალუბალი' },
  { id: 'sage', group: 'women', name: 'პიტნა' },
  { id: 'glass', group: 'styles', name: 'მინა' },
  { id: 'neon', group: 'styles', name: 'ნეონი' },
  { id: 'paper', group: 'styles', name: 'ქაღალდი' },
  { id: 'marble', group: 'styles', name: 'მარმარილო' },
  { id: 'city', group: 'styles', name: 'ღამის ქალაქი' },
  { id: 'holo', group: 'styles', name: 'ჰოლოგრამა' },
  { id: 'watercolor', group: 'styles', name: 'აკვარელი' },
  { id: 'puffy', group: 'styles', name: '3D' },
  { id: 'pixel', group: 'styles', name: 'პიქსელი' },
  { id: 'topo', group: 'styles', name: 'ტოპოგრაფია' },
]);

export const APP_ICON_GROUPS = Object.freeze({ core: 'კლასიკური', women: 'ქალური', styles: 'სტილები' });

const IDS = new Set(APP_ICONS.map((i) => i.id));

/** The icon id from a request body, or null for anything else. */
export function parseAppIcon(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return IDS.has(id) ? id : null;
}

export const APP_ICON_SQL = `CREATE TABLE IF NOT EXISTS "AppIconChoice" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "icon" TEXT NOT NULL,
  "platform" TEXT,
  "appVersion" TEXT,
  "changedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "seenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

let ensured = false;
async function ensureTable(db) {
  if (ensured) return;
  await db.$executeRawUnsafe(APP_ICON_SQL);
  ensured = true;
}

const clip = (v, n) => (v == null ? null : String(v).slice(0, n) || null);

/**
 * Saves the icon this account's phone shows now. `changedAt` moves only when the icon differs from the saved one
 * (for an icon picked before the app could report it, it is the first report).
 */
export async function recordAppIcon({ userId, icon, platform = null, appVersion = null }, db = prisma) {
  await ensureTable(db);
  await db.$executeRaw`INSERT INTO "AppIconChoice" ("userId", "icon", "platform", "appVersion", "changedAt", "seenAt")
    VALUES (${userId}, ${icon}, ${clip(platform, 16)}, ${clip(appVersion, 32)}, NOW(), NOW())
    ON CONFLICT ("userId") DO UPDATE SET
      "changedAt" = CASE WHEN "AppIconChoice"."icon" = EXCLUDED."icon" THEN "AppIconChoice"."changedAt" ELSE NOW() END,
      "icon" = EXCLUDED."icon", "platform" = EXCLUDED."platform", "appVersion" = EXCLUDED."appVersion", "seenAt" = NOW()`;
}

/**
 * Pure: the page from rows. rows = [{ userId, icon, changedAt, seenAt }], iphoneIds = accounts seen on an iPhone in
 * the last 30 days (the people who could report), teamIds = array or Set (left out unless includeTeam).
 * `people` lists who switched away from the classic icon, newest first.
 */
export function buildAppIconOverview({ rows = [], iphoneIds = [], teamIds = [], includeTeam = false, people = new Map(), now = new Date() }) {
  const team = new Set(teamIds || []);
  const keep = (id) => includeTeam || !team.has(id);
  const kept = rows.filter((r) => keep(r.userId) && IDS.has(r.icon));
  const counts = Object.fromEntries(APP_ICONS.map((i) => [i.id, 0]));
  for (const r of kept) counts[r.icon] += 1;
  const reporting = kept.length;
  const changed = kept.filter((r) => r.icon !== 'classic');
  const share = (n, whole) => (whole ? Math.round((n / whole) * 1000) / 10 : null);
  const icons = APP_ICONS.map((i) => ({ ...i, count: counts[i.id], share: share(counts[i.id], reporting) }));
  const top = icons.filter((i) => i.id !== 'classic' && i.count > 0).sort((a, b) => b.count - a.count)[0] || null;
  const groups = Object.fromEntries(Object.keys(APP_ICON_GROUPS).map((g) => [g, changed.filter((r) => APP_ICONS.find((i) => i.id === r.icon).group === g).length]));
  const iphones = new Set((iphoneIds || []).filter(keep)).size;
  return {
    generatedAt: now.toISOString(),
    includeTeam,
    kpis: { reporting, changed: changed.length, changedShare: share(changed.length, reporting), classic: counts.classic, iphones, top: top ? { id: top.id, name: top.name, count: top.count } : null },
    groups,
    groupLabels: APP_ICON_GROUPS,
    icons,
    people: changed
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
      .slice(0, 300)
      .map((r) => ({ icon: r.icon, changedAt: iso(r.changedAt), seenAt: iso(r.seenAt), person: personSummary(people.get(r.userId) || { id: r.userId }, { teamIds: team }) })),
    team: { accounts: team.size },
  };
}

export async function loadAppIconOverview({ includeTeam = false, db = prisma } = {}) {
  let rows;
  try {
    rows = await db.$queryRaw`SELECT "userId", "icon", "changedAt", "seenAt" FROM "AppIconChoice"`;
  } catch (error) {
    if (!missingTable(error)) throw error;
    rows = [];
  }
  const [teamIds, iphones] = await Promise.all([
    loadTeamUserIds(db),
    db.$queryRaw`SELECT DISTINCT "userId" FROM "AppActivity" WHERE "platform" = 'ios' AND "lastAt" > NOW() - INTERVAL '30 days'`,
  ]);
  const ids = rows.filter((r) => r.icon !== 'classic').map((r) => r.userId);
  const { people } = await loadPeople(ids, db);
  return buildAppIconOverview({
    rows,
    iphoneIds: iphones.map((r) => r.userId),
    teamIds,
    includeTeam,
    people: new Map(people.map((p) => [p.id, p])),
  });
}
