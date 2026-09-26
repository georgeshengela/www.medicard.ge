import { prisma } from './prisma.js';

/** Product freeze 2026-09-26: the women's space opens only with 300+ active women and human moderators. */
export const COMMUNITY_LAUNCH_TARGET = 300;
export const COMMUNITY_ACTIVE_WINDOW_DAYS = 30;

const isMissingTable = (error) => error?.code === 'P2010' || /does not exist|42P01/.test(String(error?.message || error?.meta?.message || ''));

/** A missing row or table means closed — never fail open. */
export async function readCommunityLaunch(db = prisma) {
  try {
    const [row] = await db.$queryRaw`SELECT "open","updatedAt","updatedBy" FROM "CommunityConfig" WHERE id='main'`;
    return { open: row?.open === true, updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
  } catch (error) {
    if (isMissingTable(error)) return { open: false, updatedAt: null, updatedBy: null };
    throw error;
  }
}

/**
 * While closed, existing members keep full access and new eligible women cannot join.
 * Banned members stay blocked regardless (checked earlier in the router).
 */
export function canJoinCommunity({ open, member }) {
  return open === true || !!member;
}

export async function writeCommunityLaunch(db, { open, adminId }) {
  await db.$executeRaw`INSERT INTO "CommunityConfig" (id,"open","updatedAt","updatedBy") VALUES ('main',${open},CURRENT_TIMESTAMP,${adminId})
    ON CONFLICT (id) DO UPDATE SET "open"=EXCLUDED."open","updatedAt"=EXCLUDED."updatedAt","updatedBy"=EXCLUDED."updatedBy"`;
}

export function launchReadiness({ activeWomen, moderators }) {
  const target = COMMUNITY_LAUNCH_TARGET;
  return {
    target,
    activeWomen,
    moderators,
    progress: Math.min(1, activeWomen / target),
    ready: activeWomen >= target && moderators > 0,
  };
}

/** Counts for the admin launch card. Activity = any app activity in the last 30 days. */
export async function communityLaunchStats(db = prisma) {
  const since = new Date(Date.now() - COMMUNITY_ACTIVE_WINDOW_DAYS * 86400000);
  let activeWomen = 0;
  try {
    const [row] = await db.$queryRaw`SELECT count(DISTINCT a."userId")::int AS n FROM "AppActivity" a JOIN "User" u ON u.id=a."userId"
      WHERE a."date" >= ${since} AND u.gender='FEMALE' AND u.status='ACTIVE'`;
    activeWomen = row?.n ?? 0;
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  const [members] = await db.$queryRaw`SELECT count(*)::int AS total, count(*) FILTER (WHERE banned)::int AS banned FROM "CommunityMember"`;
  const [women] = await db.$queryRaw`SELECT count(*)::int AS n FROM "User" WHERE gender='FEMALE' AND status='ACTIVE'`;
  const admins = await db.admin.findMany({ select: { capabilities: true } });
  const moderators = admins.filter((a) => a.capabilities == null || (Array.isArray(a.capabilities) && a.capabilities.includes('COMMUNITY_MANAGE'))).length;
  return { activeWomen, eligibleWomen: women?.n ?? 0, members: members?.total ?? 0, bannedMembers: members?.banned ?? 0, moderators };
}
