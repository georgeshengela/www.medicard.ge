import { prisma } from './prisma.js';
import { publicUser, toDateOnly } from './patient.js';

export const DAILY_LOGIN_POINTS = 5;
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

function serializeState(user, weekRows, todayYmd) {
  const monday = mondayOfWeek(todayYmd);
  const claimed = new Set(weekRows.map((row) => dateKey(row.date)).filter(Boolean));

  const week = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDaysYmd(monday, i);
    let status = 'empty';
    if (claimed.has(date)) status = 'completed';
    else if (date < todayYmd) status = 'skipped';
    week.push({ date, status });
  }

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
    claimedToday: claimed.has(todayYmd),
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
