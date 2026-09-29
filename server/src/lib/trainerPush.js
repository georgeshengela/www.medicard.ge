/**
 * MEDI COACH notifications: instant pushes for bookings/changes and the 24 h / 1 h session reminders
 * (job lease `trainer-reminders`). Lock-screen text names the trainer/client and the time only —
 * never calories, weight or other health values.
 */
import { prisma } from './prisma.js';
import { sendExpoPush } from './push.js';
import { withJobLease } from './jobLease.js';
import { formatClock, reminderDue } from './trainer.js';
import { getUserLanguages, t } from './i18n.js';

/** userId → 'ka' | 'en'. A test double without the column (or any failure) reads Georgian. */
async function languagesFor(db, ids) {
  if (db === prisma) return getUserLanguages(ids);
  const out = new Map();
  const list = [...new Set(ids.filter(Boolean).map(String))];
  try {
    const rows = typeof db.$queryRaw === 'function'
      ? await db.$queryRaw`SELECT "id", "language" FROM "User" WHERE "id" = ANY(${list}::text[])`
      : [];
    for (const row of rows ?? []) out.set(String(row.id), row.language === 'en' ? 'en' : 'ka');
  } catch {
    /* Georgian */
  }
  for (const id of list) if (!out.has(id)) out.set(id, 'ka');
  return out;
}

/**
 * Best-effort push to every active device of one person. Never throws.
 * Optional `en: { title, body }` is used when the recipient reads English (`lang`, or their stored language).
 */
export async function notifyCoach(userId, { title, body, route, en }, db = prisma, send = sendExpoPush, lang) {
  if (!userId || (process.env.NODE_ENV === 'test' && send === sendExpoPush)) return { sent: 0 };
  try {
    const tokens = (await db.pushToken.findMany({ where: { userId, active: true }, select: { token: true } })).map((t) => t.token);
    if (!tokens.length) return { sent: 0 };
    const english = en && (lang ?? (await languagesFor(db, [userId])).get(String(userId))) === 'en';
    const copy = english ? { title: en.title ?? title, body: en.body ?? body } : { title, body };
    return await send(tokens, { title: copy.title, body: copy.body, data: { type: 'coach', route } });
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
  const langs = rows.length ? await languagesFor(db, rows.flatMap((row) => [row.clientId, row.trainerId])) : new Map();
  for (const s of rows) {
    const due = reminderDue(s, now);
    if (!due) continue;
    const claimed = due === '1h'
      ? await db.$executeRaw`UPDATE "TrainerSession" SET reminded1 = true, reminded24 = true WHERE id = ${s.id} AND NOT reminded1`
      : await db.$executeRaw`UPDATE "TrainerSession" SET reminded24 = true WHERE id = ${s.id} AND NOT reminded24`;
    if (!claimed) continue;
    const time = formatClock(s.startsAt);
    const clientLang = langs.get(String(s.clientId)) ?? 'ka';
    const trainerLang = langs.get(String(s.trainerId)) ?? 'ka';
    const who = s.trainerName || t(clientLang, 'ტრენერთან', 'with your trainer');
    const copy = due === '1h'
      ? t(clientLang,
        { title: 'ვარჯიში 1 საათში ⏰', body: `${time} — ${who}. არ დაგავიწყდეს წყალი და პირსახოცი.`, route: '/trainer/sessions' },
        { title: 'Workout in 1 hour ⏰', body: `${time} — ${who}. Don't forget water and a towel.`, route: '/trainer/sessions' })
      : t(clientLang,
        { title: 'ხვალ ვარჯიში გაქვს', body: `${time} — ${who}. დაადასტურე, რომ მოხვალ.`, route: '/trainer/sessions' },
        { title: 'You have a workout tomorrow', body: `${time} — ${who}. Confirm that you're coming.`, route: '/trainer/sessions' });
    const r = await notifyCoach(s.clientId, copy, db, send, clientLang);
    sent += r?.sent ?? 0;
    if (due === '1h') {
      const trainerCopy = t(trainerLang,
        { title: 'ვარჯიში 1 საათში', body: `${time}${s.clientConfirmedAt ? ' · კლიენტმა დაადასტურა ✅' : ' · ჯერ არ დაუდასტურებია'}`, route: '/coach' },
        { title: 'Session in 1 hour', body: `${time}${s.clientConfirmedAt ? ' · Client confirmed ✅' : ' · Not confirmed yet'}`, route: '/coach' });
      await notifyCoach(s.trainerId, trainerCopy, db, send, trainerLang);
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
