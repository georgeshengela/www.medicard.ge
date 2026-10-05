// Read-only daily funnel snapshot for the Meta ad campaigns (owner 2026-10-05): counts only, no user data.
//   node scripts/ads-funnel-snapshot.mjs [fromYmd]   (default: 2026-10-01, Tbilisi days)
// first opens by platform, signups, first health actions, referrals (created / rewarded) and MEDIRUN box openings.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const from = process.argv[2] || '2026-10-01';
const since = new Date(`${from}T00:00:00+04:00`);
const day = (col) => `to_char((${col} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tbilisi'),'YYYY-MM-DD')`;

async function q(sql) {
  try { return await prisma.$queryRawUnsafe(sql, since); } catch (e) { return [{ error: String(e.message).split('\n')[0] }]; }
}

const funnel = await q(`SELECT ${day('"createdAt"')} AS d, name, coalesce(platform,'?') AS p, count(*)::int AS n
  FROM "FunnelEvent" WHERE "createdAt" >= $1 AND name IN ('app_first_open','signup_completed','onboarding_completed','first_health_action')
  GROUP BY 1,2,3 ORDER BY 1,2,3`);
const refs = await q(`SELECT ${day('"createdAt"')} AS d, count(*)::int AS created, count(*) FILTER (WHERE status='REWARDED')::int AS rewarded
  FROM "Referral" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`);
const users = await q(`SELECT ${day('"createdAt"')} AS d, count(*)::int AS n FROM "User" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`);
const claims = await q(`SELECT ${day('"createdAt"')} AS d, count(*)::int AS n, count(DISTINCT "userId")::int AS players
  FROM "MedipulsiClaim" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`);

console.log(JSON.stringify({ from, funnel, referrals: refs, newUsers: users, boxOpenings: claims }, null, 1));
await prisma.$disconnect();
