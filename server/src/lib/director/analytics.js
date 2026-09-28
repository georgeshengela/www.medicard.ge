/**
 * Deep analytics for the Director's planning sessions — counts only (no user ids, names, free
 * text or health values). 30-day daily series and per-feature usage this week vs last week.
 * Every block is independent; a missing table yields { error } for that block.
 */
import { prisma } from '../prisma.js';

async function block(fn) {
  try {
    return await fn();
  } catch (error) {
    return { error: String(error?.message || error).slice(0, 160) };
  }
}

/** [label, table, time column, extra WHERE] — actions and distinct users, last 7d vs previous 7d. */
export const FEATURES = Object.freeze([
  ['მედიკამენტის დამატება', 'MedicationSchedule', 'createdAt', ''],
  ['კვების ჩანაწერი', 'NutritionMeal', 'createdAt', ''],
  ['ციკლის ჩანაწერი', 'CycleLog', 'createdAt', ''],
  ['ექიმთან ვიზიტი', 'DoctorVisit', 'createdAt', ''],
  ['ანალიზი / ფოტო (ჩანაწერი)', 'MedicalRecord', 'createdAt', ''],
  ['Medi / AI მოთხოვნა', 'AiInteraction', 'createdAt', ''],
  ['Medi საუბარი (ახალი)', 'ChatSession', 'createdAt', ''],
  ['ცხოველის დამატება', 'Pet', 'createdAt', ''],
  ['MEDIRUN სესია', 'MedipulsiSession', 'startedAt', ''],
  ['Quest მისია შესრულდა', 'UserQuest', 'completedAt', ''],
  ['ყოველდღიური შესვლის ბონუსი', 'DailyCheckIn', 'createdAt', ''],
]);

async function featureUsage(db) {
  const out = [];
  for (const [label, table, col, extra] of FEATURES) {
    // Identifiers come from the fixed list above, never from input.
    const sql = `SELECT
        COUNT(*) FILTER (WHERE "${col}" >= NOW() - INTERVAL '7 days')::int AS "actions7d",
        COUNT(*) FILTER (WHERE "${col}" < NOW() - INTERVAL '7 days')::int AS "actionsPrev7d",
        COUNT(DISTINCT "userId") FILTER (WHERE "${col}" >= NOW() - INTERVAL '7 days')::int AS "users7d",
        COUNT(DISTINCT "userId") FILTER (WHERE "${col}" < NOW() - INTERVAL '7 days')::int AS "usersPrev7d"
      FROM "${table}" WHERE "${col}" >= NOW() - INTERVAL '14 days' ${extra}`;
    const row = await block(async () => (await db.$queryRawUnsafe(sql))[0]);
    out.push({ feature: label, ...row });
  }
  return out;
}

async function daily(db) {
  const rows = await db.$queryRaw`
    WITH days AS (SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, INTERVAL '1 day')::date AS d)
    SELECT to_char(d, 'MM-DD') AS day,
      (SELECT COUNT(*)::int FROM "User" u WHERE u."createdAt"::date = d) AS signups,
      (SELECT COUNT(DISTINCT a."userId")::int FROM "AppActivity" a WHERE a."date" = d) AS dau,
      (SELECT COUNT(*)::int FROM "AiInteraction" i WHERE i."createdAt"::date = d) AS ai
    FROM days ORDER BY d`;
  return rows;
}

async function aiModes(db) {
  return db.$queryRaw`SELECT mode, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE status = 'ERROR')::int AS errors
    FROM "AiInteraction" WHERE "createdAt" >= NOW() - INTERVAL '30 days' GROUP BY mode ORDER BY 2 DESC`;
}

async function versions(db) {
  return db.$queryRaw`SELECT COALESCE("appVersion", '?') AS version, COALESCE(platform, '?') AS platform, COUNT(DISTINCT "userId")::int AS users
    FROM "AppActivity" WHERE "date" >= CURRENT_DATE - 6 GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`;
}

async function cohorts(db) {
  // Weekly sign-up cohorts (last 8 weeks) and how many were active 7+ days after sign-up.
  return db.$queryRaw`
    SELECT to_char(date_trunc('week', u."createdAt"), 'YYYY-MM-DD') AS week, COUNT(*)::int AS signups,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "AppActivity" a WHERE a."userId" = u."id" AND a."date" >= (u."createdAt"::date + 7)))::int AS "activeAfter7d"
    FROM "User" u WHERE u."createdAt" >= NOW() - INTERVAL '56 days'
    GROUP BY 1 ORDER BY 1`;
}

async function audience(db) {
  const gender = await db.$queryRaw`SELECT COALESCE(gender::text, 'unknown') AS gender, COUNT(*)::int AS users FROM "User" GROUP BY 1`;
  return { gender };
}

export async function buildDeepAnalytics({ db = prisma } = {}) {
  const [features, series, ai, vers, coh, aud] = await Promise.all([
    block(() => featureUsage(db)),
    block(() => daily(db)),
    block(() => aiModes(db)),
    block(() => versions(db)),
    block(() => cohorts(db)),
    block(() => audience(db)),
  ]);
  return { generatedAt: new Date().toISOString(), daily30d: series, featureUsage: features, aiModes30d: ai, appVersions7d: vers, weeklyCohorts: coh, audience: aud };
}
