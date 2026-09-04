import { prisma } from './prisma.js';
import { publicUser, toDateOnly } from './patient.js';

export const DAILY_LOGIN_POINTS = 5;
export const STEPS_GOAL_POINTS = 3;
const TBILISI = 'Asia/Tbilisi';

/** `YYYY-MM-DD` in Georgia time — the calendar day a login counts for. */
export function tbilisiYmd(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TBILISI }).format(now);
}

function ymdToUtcDate(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addDaysYmd(ymd, days) {
  const date = ymdToUtcDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the week that contains `ymd` (ISO week, Monday-first). */
export function mondayOfWeek(ymd) {
  const date = ymdToUtcDate(ymd);
  const dow = date.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDaysYmd(ymd, offset);
}

function dateKey(value) {
  return toDateOnly(value);
}

/** Days before the account existed stay empty — never paint a fake skip/X. */
export function checkInWeekDays(todayYmd, claimedYmds, joinedOnYmd) {
  const monday = mondayOfWeek(todayYmd);
  const claimed = new Set(claimedYmds);
  const joined = joinedOnYmd || todayYmd;
  const week = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysYmd(monday, i);
    let status = 'empty';
    if (claimed.has(date)) status = 'completed';
    else if (date < todayYmd && date >= joined) status = 'skipped';
    week.push({ date, status });
  }
  return week;
}

function serializeState(user, weekRows, todayYmd) {
  const claimed = weekRows.map((row) => dateKey(row.date)).filter(Boolean);
  const joinedOn = user.createdAt ? tbilisiYmd(new Date(user.createdAt)) : todayYmd;
  const week = checkInWeekDays(todayYmd, claimed, joinedOn);

  let weekStreak = 0;
  for (let i = week.length - 1; i >= 0; i -= 1) {
    if (week[i].date > todayYmd) continue;
    if (week[i].status === 'completed') weekStreak += 1;
    else break;
  }

  return {
    points: user.points ?? 0,
    currentStreak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    lastCheckInDate: dateKey(user.lastCheckInDate),
    weekStreak,
    claimedToday: claimed.includes(todayYmd),
    today: todayYmd,
    pointsPerDay: DAILY_LOGIN_POINTS,
    week,
  };
}

export async function getCheckInState(userId, todayYmd = tbilisiYmd()) {
  const monday = mondayOfWeek(todayYmd);
  const sunday = addDaysYmd(monday, 6);

  const [user, weekRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { package: true } }),
    prisma.dailyCheckIn.findMany({
      where: {
        userId,
        date: { gte: ymdToUtcDate(monday), lte: ymdToUtcDate(sunday) },
      },
    }),
  ]);

  if (!user) return null;
  return serializeState(user, weekRows, todayYmd);
}

export async function claimDailyCheckIn(userId) {
  const todayYmd = tbilisiYmd();
  const todayDate = ymdToUtcDate(todayYmd);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dailyCheckIn.create({
        data: { userId, date: todayDate, pointsAwarded: DAILY_LOGIN_POINTS },
      });

      const user = await tx.user.findUnique({ where: { id: userId } });
      const last = dateKey(user.lastCheckInDate);
      const yesterday = addDaysYmd(todayYmd, -1);
      const currentStreak = last === yesterday ? (user.currentStreak ?? 0) + 1 : 1;
      const longestStreak = Math.max(user.longestStreak ?? 0, currentStreak);

      await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: DAILY_LOGIN_POINTS },
          currentStreak,
          longestStreak,
          lastCheckInDate: todayDate,
        },
      });
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
    const checkIn = await getCheckInState(userId, todayYmd);
    return {
      awarded: true,
      pointsAwarded: DAILY_LOGIN_POINTS,
      user: publicUser(user),
      checkIn,
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
      const checkIn = await getCheckInState(userId, todayYmd);
      return {
        awarded: false,
        pointsAwarded: 0,
        user: user ? publicUser(user) : null,
        checkIn,
      };
    }
    throw error;
  }
}

export function normalizeAwardRef(goalId) {
  return String(goalId || '').trim().slice(0, 80);
}

async function incrementUserPoints(tx, userId, points) {
  await tx.user.update({
    where: { id: userId },
    data: { points: { increment: points } },
  });
}

async function insertStepsGoalAward(tx, userId, ref) {
  if (typeof tx.pointAward?.create === 'function') {
    await tx.pointAward.create({
      data: { userId, kind: 'steps_goal', ref, points: STEPS_GOAL_POINTS },
    });
    return;
  }

  const { randomUUID } = await import('node:crypto');
  const rows = await tx.$queryRaw`
    INSERT INTO "PointAward" (id, "userId", kind, ref, points, "createdAt")
    VALUES (${randomUUID()}, ${userId}, 'steps_goal', ${ref}, ${STEPS_GOAL_POINTS}, NOW())
    ON CONFLICT ("userId", kind, ref) DO NOTHING
    RETURNING id
  `;
  if (!rows?.length) {
    const error = new Error('PointAward already exists');
    error.code = 'P2002';
    throw error;
  }
}

export async function awardStepsGoalPoints(userId, goalId) {
  const ref = normalizeAwardRef(goalId);
  if (!ref) return { awarded: false, pointsAwarded: 0, user: null };

  try {
    await prisma.$transaction(async (tx) => {
      await insertStepsGoalAward(tx, userId, ref);
      await incrementUserPoints(tx, userId, STEPS_GOAL_POINTS);
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
    return {
      awarded: true,
      pointsAwarded: STEPS_GOAL_POINTS,
      user: publicUser(user),
    };
  } catch (error) {
    if (error?.code === 'P2002') {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
      return {
        awarded: false,
        pointsAwarded: 0,
        user: user ? publicUser(user) : null,
      };
    }
    throw error;
  }
}
