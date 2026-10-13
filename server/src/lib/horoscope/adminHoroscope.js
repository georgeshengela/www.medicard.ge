// Admin #/horoscope (MEDIHOROSCOPE): readiness of today's readings, the generator log and costs, library
// progress, and usage — counts, signs and sections only. Never chat text or anyone's birth details.
import { prisma } from '../prisma.js';
import { SIGNS, sunSign } from './astro.js';
import { currentPeriodKeys } from './generate.js';
import { libraryKeys } from './catalog.js';
import { LIBRARY_NAMESPACES, namespaceOf } from './library.js';
import { libraryCounts, listRuns, readConfig, isHoroscopeSchemaMissing } from './store.js';
import { loadTeamUserIds, usagePeriod } from '../adminUsageKit.js';

const DAY_MS = 86400000;
const SECTIONS = ['hub', 'chart', 'sign', 'compat', 'tarot', 'numerology', 'chinese', 'dreams', 'sky', 'oracle'];

/**
 * Pure: builds the overview from rows. visits = [{ userId, day: 'YYYY-MM-DD', views, sections[] }],
 * births = Map(userId → 'YYYY-MM-DD'), oracle = [{ day, n }] (user messages per day), profiles = count of
 * people with a birth time, teamIds = ids as loadTeamUserIds returns them (array or Set; left out unless includeTeam).
 */
export function buildHoroscopeOverview({ days, now = new Date(), visits = [], births = new Map(), oracle = [], profilesWithTime = 0, teamIds = [], includeTeam = false }) {
  const team = new Set(teamIds || []);
  const keep = (v) => includeTeam || !team.has(v.userId);
  const rows = visits.filter(keep);
  const dayKeys = Array.from({ length: days }, (_, i) => new Date(now.getTime() - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10));
  const perDay = Object.fromEntries(dayKeys.map((d) => [d, new Set()]));
  const people = new Set();
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, new Set()]));
  const daysByPerson = new Map();
  for (const v of rows) {
    const d = String(v.day).slice(0, 10);
    if (perDay[d]) perDay[d].add(v.userId);
    people.add(v.userId);
    daysByPerson.set(v.userId, (daysByPerson.get(v.userId) || 0) + 1);
    for (const s of v.sections || []) if (sections[s]) sections[s].add(v.userId);
  }
  const signs = Object.fromEntries(SIGNS.map((s) => [s, 0]));
  for (const id of people) {
    const b = births.get(id);
    if (b) signs[sunSign(b).sign] += 1;
  }
  const today = dayKeys[dayKeys.length - 1];
  const returning = [...daysByPerson.values()].filter((n) => n >= 2).length;
  return {
    days,
    kpis: {
      people: people.size,
      today: perDay[today]?.size || 0,
      returning,
      oracleMessages: oracle.reduce((s, r) => s + Number(r.n || 0), 0),
      withBirthTime: profilesWithTime,
    },
    series: dayKeys.map((d) => ({ day: d, people: perDay[d].size, oracle: Number(oracle.find((o) => String(o.day).slice(0, 10) === d)?.n || 0) })),
    sections: Object.fromEntries(SECTIONS.map((s) => [s, sections[s].size])),
    signs,
  };
}

export async function loadHoroscopeOverview({ days: rawDays, includeTeam = false, db = prisma }) {
  const days = usagePeriod(rawDays);
  const since = new Date(Date.now() - days * DAY_MS);
  try {
    const [visits, oracle, [{ n: withTime } = { n: 0 }], teamIds] = await Promise.all([
      db.$queryRaw`SELECT "userId", "day"::text AS "day", "views", "sections" FROM "HoroscopeVisit" WHERE "day" >= ${since}::date`,
      db.$queryRaw`SELECT ("createdAt" AT TIME ZONE 'Asia/Tbilisi')::date::text AS "day", COUNT(*)::int AS "n"
        FROM "HoroscopeChatMessage" WHERE "role" = 'user' AND "createdAt" >= ${since} GROUP BY 1`,
      db.$queryRaw`SELECT COUNT(*)::int AS "n" FROM "HoroscopeProfile" WHERE "birthTime" IS NOT NULL`,
      loadTeamUserIds(db),
    ]);
    const ids = [...new Set(visits.map((v) => v.userId))];
    const users = ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, birthDate: true } }) : [];
    const births = new Map(users.filter((u) => u.birthDate).map((u) => [u.id, u.birthDate.toISOString().slice(0, 10)]));
    return { schemaReady: true, ...buildHoroscopeOverview({ days, visits, births, oracle, profilesWithTime: withTime, teamIds, includeTeam }) };
  } catch (error) {
    if (isHoroscopeSchemaMissing(error)) return { schemaReady: false, days };
    throw error;
  }
}

/** Today's readiness: which period readings exist per sign, the latest runs, library progress, costs. */
export async function loadHoroscopeStatus(db = prisma) {
  const keys = currentPeriodKeys();
  const periods = [['day', keys.day], ['day', keys.tomorrow], ['week', keys.week], ['month', keys.month], ['year', keys.year]];
  let readings = [];
  try {
    readings = await db.$queryRaw`SELECT "kind", "periodKey", "sign", "status", "edited", "model", "costUsd", "updatedAt"
      FROM "HoroscopeReading" WHERE ("kind", "periodKey") IN (VALUES ('day', ${keys.day}), ('day', ${keys.tomorrow}), ('week', ${keys.week}), ('month', ${keys.month}), ('year', ${keys.year}))`;
  } catch (error) {
    if (!isHoroscopeSchemaMissing(error)) throw error;
    return { schemaReady: false, keys };
  }
  const grid = periods.map(([kind, key]) => ({
    kind, key,
    signs: Object.fromEntries(SIGNS.map((s) => {
      const r = readings.find((x) => x.kind === kind && x.periodKey === key && x.sign === s);
      return [s, r ? { status: r.status, edited: r.edited } : null];
    })),
  }));
  const all = libraryKeys({ year: Number(keys.year) });
  const totals = {};
  for (const k of all) totals[namespaceOf(k)] = (totals[namespaceOf(k)] || 0) + 1;
  const counts = await libraryCounts(db);
  const library = LIBRARY_NAMESPACES.map((ns) => ({ ns, total: totals[ns] || 0, done: Math.min(counts[ns]?.keys || 0, totals[ns] || 0), edited: counts[ns]?.edited || 0 }));
  const [cost] = await db.$queryRaw`SELECT
      COALESCE(SUM("costUsd") FILTER (WHERE "startedAt" >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi'), 0)::float AS "today",
      COALESCE(SUM("costUsd") FILTER (WHERE "startedAt" >= NOW() - INTERVAL '30 days'), 0)::float AS "month"
    FROM "HoroscopeRun"`;
  return { schemaReady: true, keys, grid, library, runs: await listRuns(25, db), cost, config: await readConfig(db) };
}
