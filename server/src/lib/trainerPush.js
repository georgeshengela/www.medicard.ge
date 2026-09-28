/**
 * MEDI COACH notifications: instant pushes for bookings/changes and the 24 h / 1 h session reminders
 * (job lease `trainer-reminders`). Lock-screen text names the trainer/client and the time only —
 * never calories, weight or other health values.
 */
import { prisma } from './prisma.js';
import { sendExpoPush } from './push.js';
import { withJobLease } from './jobLease.js';
import { formatClock, reminderDue } from './trainer.js';

/** Best-effort push to every active device of one person. Never throws. */
export async function notifyCoach(userId, { title, body, route }, db = prisma, send = sendExpoPush) {
  if (!userId || (process.env.NODE_ENV === 'test' && send === sendExpoPush)) return { sent: 0 };
  try {
    const tokens = (await db.pushToken.findMany({ where: { userId, active: true }, select: { token: true } })).map((t) => t.token);
    if (!tokens.length) return { sent: 0 };
    return await send(tokens, { title, body, data: { type: 'coach', route } });
  } catch (error) {
    console.warn('[coach] push failed', error?.message);
    return { sent: 0 };
  }
}

/** One pass: send due reminders for sessions in the next 24 h. Flags are set before sending. */
export async function processSessionReminders({ db = prisma, now = new Date(), send = sendExpoPush } = {}) {
  const [probe] = await db.$queryRaw`SELECT to_regclass('"TrainerSession"') IS NOT NULL AS ok`;
  if (!probe?.ok) return { skipped: 'table' };
  const rows = await db.$queryRaw`SELECT s.*, t."displayName" AS "trainerName" FROM "TrainerSession" s
    LEFT JOIN "TrainerProfile" t ON t."userId" = s."trainerId"
    WHERE s.status = 'SCHEDULED' AND s."clientId" IS NOT NULL AND s."startsAt" > ${now} AND s."startsAt" <= ${new Date(now.getTime() + 24 * 3600000)}
      AND (NOT s.reminded24 OR NOT s.reminded1)
    ORDER BY s."startsAt" LIMIT 500`;
  let sent = 0;
  for (const s of rows) {
    const due = reminderDue(s, now);
    if (!due) continue;
    const claimed = due === '1h'
      ? await db.$executeRaw`UPDATE "TrainerSession" SET reminded1 = true, reminded24 = true WHERE id = ${s.id} AND NOT reminded1`
      : await db.$executeRaw`UPDATE "TrainerSession" SET reminded24 = true WHERE id = ${s.id} AND NOT reminded24`;
    if (!claimed) continue;
    const time = formatClock(s.startsAt);
    const who = s.trainerName || 'ტრენერთან';
    const copy = due === '1h'
      ? { title: 'ვარჯიში 1 საათში ⏰', body: `${time} — ${who}. არ დაგავიწყდეს წყალი და პირსახოცი.`, route: '/trainer/sessions' }
      : { title: 'ხვალ ვარჯიში გაქვს', body: `${time} — ${who}. დაადასტურე, რომ მოხვალ.`, route: '/trainer/sessions' };
    const r = await notifyCoach(s.clientId, copy, db, send);
    sent += r?.sent ?? 0;
    if (due === '1h') {
      await notifyCoach(s.trainerId, { title: 'ვარჯიში 1 საათში', body: `${time}${s.clientConfirmedAt ? ' · კლიენტმა დაადასტურა ✅' : ' · ჯერ არ დაუდასტურებია'}`, route: '/coach' }, db, send);
    }
  }
  return { checked: rows.length, sent };
}

export function startTrainerReminders({ intervalMs = 5 * 60 * 1000 } = {}) {
  if (process.env.NODE_ENV === 'test' || process.env.TRAINER_REMINDERS_DISABLED === 'true') return null;
  const tick = () => withJobLease('trainer-reminders', intervalMs * 1.5, () => processSessionReminders())
    .catch((e) => console.warn('[coach] reminder pass failed', e?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 90 * 1000).unref?.();
  return timer;
}
