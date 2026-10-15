/**
 * MEDIBOOK notifications: pushes to the client (booked, confirmed, moved, cancelled, reminders, „შეაფასე“),
 * pushes to the business's people who have the app and an email to the business address (new booking,
 * cancellation), and the reminder job (lease `book-reminders`). Lock-screen text carries the place, the
 * service and the time only — never a note or anything about health.
 */
import { prisma } from '../prisma.js';
import { sendExpoPush } from '../push.js';
import { withJobLease } from '../jobLease.js';
import { getUserLanguages, t } from '../i18n.js';
import { sendEmail } from '../email/mailer.js';
import { claimReminder, dueReminders, dueReviewAsks, markReviewAsked } from './bookings.js';
import * as waitlist from './waitlist.js';
import { addDaysYmd, tbilisiClock, tbilisiYmd, daysBetweenYmd } from './time.js';

const KA_MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KA_DAYS = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** „ორშ, 19 ოქტ · 15:00“ / „Mon, 19 Oct · 15:00“; today and tomorrow are named. */
export function formatWhen(at, lang = 'ka', now = new Date()) {
  const d = new Date(at);
  const shifted = new Date(d.getTime() + 4 * 3600_000);
  const diff = daysBetweenYmd(tbilisiYmd(now), tbilisiYmd(d));
  const clock = tbilisiClock(d);
  const day = diff === 0 ? t(lang, 'დღეს', 'Today') : diff === 1 ? t(lang, 'ხვალ', 'Tomorrow')
    : `${(lang === 'en' ? EN_DAYS : KA_DAYS)[shifted.getUTCDay()]}, ${shifted.getUTCDate()} ${(lang === 'en' ? EN_MONTHS : KA_MONTHS)[shifted.getUTCMonth()]}`;
  return `${day} · ${clock}`;
}

async function languagesFor(db, ids) {
  if (db === prisma) return getUserLanguages(ids);
  const out = new Map();
  for (const id of ids) out.set(String(id), 'ka');
  return out;
}

/** Best-effort push to every active device of one person. Never throws. */
export async function notifyUser(userId, { title, body, route, en }, db = prisma, send = sendExpoPush, lang) {
  if (!userId || (process.env.NODE_ENV === 'test' && send === sendExpoPush)) return { sent: 0 };
  try {
    const tokens = (await db.pushToken.findMany({ where: { userId, active: true }, select: { token: true } })).map((x) => x.token);
    if (!tokens.length) return { sent: 0 };
    const english = en && (lang ?? (await languagesFor(db, [userId])).get(String(userId))) === 'en';
    const copy = english ? { title: en.title ?? title, body: en.body ?? body } : { title, body };
    return await send(tokens, { title: copy.title, body: copy.body, data: { type: 'book', route } });
  } catch (error) {
    console.warn('[book] push failed', error?.message);
    return { sent: 0 };
  }
}

/** Everyone who manages the business and has the app (owners and managers; staff only for their own bookings). */
async function businessRecipients(businessId, staffId, db) {
  const rows = await db.$queryRaw`SELECT "userId", role, "staffId" FROM "BookMember" WHERE "businessId" = ${businessId}`;
  return rows.filter((m) => m.role !== 'STAFF' || (staffId && m.staffId === staffId)).map((m) => m.userId);
}

async function businessContact(businessId, db) {
  const [row] = await db.$queryRaw`SELECT id, name, "nameKa", email, slug FROM "BookBusiness" WHERE id = ${businessId}`;
  return row ?? null;
}

const placeName = (a, lang) => (lang === 'ka' && a.businessNameKa ? a.businessNameKa : a.businessName) || t(lang, 'ბიზნესი', 'the business');

/** The client booked (or the business booked for an app user). */
export async function notifyBooked(a, { db = prisma, send = sendExpoPush, now = new Date() } = {}) {
  const langs = await languagesFor(db, [a.clientUserId].filter(Boolean));
  if (a.clientUserId) {
    const lang = langs.get(String(a.clientUserId)) ?? 'ka';
    const when = formatWhen(a.startsAt, lang, now);
    const pending = a.status === 'PENDING';
    await notifyUser(a.clientUserId, t(lang,
      { title: pending ? 'ჯავშანი გაგზავნილია' : 'ჯავშანი დადასტურდა ✅', body: `${placeName(a, 'ka')} · ${a.serviceName} · ${when}${pending ? ' — ბიზნესი დაადასტურებს' : ''}`, route: `/book/appointments/${a.id}` },
      { title: pending ? 'Booking sent' : 'Booking confirmed ✅', body: `${placeName(a, 'en')} · ${a.serviceName} · ${when}${pending ? ' — waiting for the business to confirm' : ''}`, route: `/book/appointments/${a.id}` }),
    db, send, lang);
  }
  await notifyBusinessNewBooking(a, { db, send, now });
}

async function notifyBusinessNewBooking(a, { db, send, now }) {
  if (a.source === 'BUSINESS') return;
  const recipients = await businessRecipients(a.businessId, a.staffId, db);
  const langs = await languagesFor(db, recipients);
  const when = (lang) => formatWhen(a.startsAt, lang, now);
  for (const userId of recipients) {
    const lang = langs.get(String(userId)) ?? 'ka';
    await notifyUser(userId, t(lang,
      { title: a.status === 'PENDING' ? 'ახალი ჯავშანი — დასადასტურებელი' : 'ახალი ჯავშანი', body: `${a.clientName} · ${a.serviceName} · ${when('ka')}${a.staffName ? ` · ${a.staffName}` : ''}`, route: '/book/business' },
      { title: a.status === 'PENDING' ? 'New booking — needs confirmation' : 'New booking', body: `${a.clientName} · ${a.serviceName} · ${when('en')}${a.staffName ? ` · ${a.staffName}` : ''}`, route: '/book/business' }),
    db, send, lang);
  }
  const biz = await businessContact(a.businessId, db);
  if (biz?.email) {
    await sendEmail({
      to: biz.email,
      templateKey: 'book_new_booking',
      category: 'transactional',
      idempotencyKey: `book-new-${a.id}`,
      content: {
        subject: `ახალი ჯავშანი — ${a.clientName}, ${when('ka')}`,
        preheader: `${a.serviceName}${a.staffName ? ` · ${a.staffName}` : ''}`,
        heading: 'ახალი ჯავშანი MEDICARD-იდან',
        body: [
          `**${a.clientName}**${a.clientPhone ? ` (${a.clientPhone})` : ''} დაჯავშნა: **${a.serviceName}**`,
          `დრო: **${when('ka')}**${a.staffName ? ` · თანამშრომელი: ${a.staffName}` : ''}`,
          a.status === 'PENDING' ? 'ჯავშანი დასადასტურებელია — გახსენი კალენდარი და დაადასტურე.' : 'ჯავშანი ავტომატურად დადასტურდა. კალენდარში უკვე ჩანს.',
        ].join('\n\n'),
        ctaLabel: 'კალენდრის გახსნა',
        ctaUrl: 'https://medicard.ge/business/calendar',
      },
      allowedVars: [],
      lang: 'ka',
    }, { db }).catch(() => undefined);
  }
}

/** The business changed the booking: confirmed, moved, cancelled, completed. */
export async function notifyChanged(a, { previousStatus = null, moved = false, db = prisma, send = sendExpoPush, now = new Date() } = {}) {
  if (!a.clientUserId) return;
  const lang = (await languagesFor(db, [a.clientUserId])).get(String(a.clientUserId)) ?? 'ka';
  const when = formatWhen(a.startsAt, lang, now);
  const route = `/book/appointments/${a.id}`;
  let copy = null;
  if (a.status === 'CANCELLED' && previousStatus !== 'CANCELLED') {
    copy = t(lang,
      { title: 'ჯავშანი გაუქმდა', body: `${placeName(a, 'ka')} გააუქმა: ${a.serviceName} · ${when}. ${a.cancelReason ? a.cancelReason : 'ახალი დრო აირჩიე აპში.'}`, route },
      { title: 'Booking cancelled', body: `${placeName(a, 'en')} cancelled: ${a.serviceName} · ${when}. ${a.cancelReason ? a.cancelReason : 'Pick a new time in the app.'}`, route });
  } else if (a.status === 'CONFIRMED' && previousStatus === 'PENDING') {
    copy = t(lang,
      { title: 'ჯავშანი დადასტურდა ✅', body: `${placeName(a, 'ka')} · ${a.serviceName} · ${when}`, route },
      { title: 'Booking confirmed ✅', body: `${placeName(a, 'en')} · ${a.serviceName} · ${when}`, route });
  } else if (moved && ['PENDING', 'CONFIRMED'].includes(a.status)) {
    copy = t(lang,
      { title: 'ჯავშნის დრო შეიცვალა', body: `${placeName(a, 'ka')} · ${a.serviceName} · ახალი დრო: ${when}${a.staffName ? ` · ${a.staffName}` : ''}`, route },
      { title: 'Your booking was moved', body: `${placeName(a, 'en')} · ${a.serviceName} · new time: ${when}${a.staffName ? ` · ${a.staffName}` : ''}`, route });
  }
  if (copy) await notifyUser(a.clientUserId, copy, db, send, lang);
}

/** The client cancelled: tell the people at the business. */
export async function notifyClientCancelled(a, { late = false, db = prisma, send = sendExpoPush, now = new Date() } = {}) {
  const recipients = await businessRecipients(a.businessId, a.staffId, db);
  const langs = await languagesFor(db, recipients);
  for (const userId of recipients) {
    const lang = langs.get(String(userId)) ?? 'ka';
    const when = formatWhen(a.startsAt, lang, now);
    await notifyUser(userId, t(lang,
      { title: late ? 'ჯავშანი გაუქმდა (გვიან)' : 'ჯავშანი გაუქმდა', body: `${a.clientName} · ${a.serviceName} · ${when} — დრო გათავისუფლდა`, route: '/book/business' },
      { title: late ? 'Booking cancelled (late)' : 'Booking cancelled', body: `${a.clientName} · ${a.serviceName} · ${when} — the slot is free again`, route: '/book/business' }),
    db, send, lang);
  }
  const biz = await businessContact(a.businessId, db);
  if (biz?.email) {
    await sendEmail({
      to: biz.email, templateKey: 'book_cancelled', category: 'transactional', idempotencyKey: `book-cancel-${a.id}`, allowedVars: [], lang: 'ka',
      content: { subject: `ჯავშანი გაუქმდა — ${a.clientName}, ${formatWhen(a.startsAt, 'ka', now)}`, preheader: a.serviceName, heading: 'კლიენტმა ჯავშანი გააუქმა', body: `**${a.clientName}** გააუქმა ${a.serviceName} · **${formatWhen(a.startsAt, 'ka', now)}**${late ? ' (გაუქმების ვადის შემდეგ)' : ''}. დრო კალენდარში ისევ თავისუფალია.`, ctaLabel: 'კალენდრის გახსნა', ctaUrl: 'https://medicard.ge/business/calendar' },
    }, { db }).catch(() => undefined);
  }
}

/** Claim or registration reviewed by an admin. */
export async function notifyClaimReviewed({ userId, approved, businessName, note }, { db = prisma, send = sendExpoPush } = {}) {
  const lang = (await languagesFor(db, [userId])).get(String(userId)) ?? 'ka';
  await notifyUser(userId, t(lang,
    approved
      ? { title: 'ბიზნესი დადასტურდა 🎉', body: `${businessName} ახლა შენია MEDICARD-ზე. გახსენი პანელი და დაამატე სერვისები.`, route: '/book/business' }
      : { title: 'განაცხადი ვერ დადასტურდა', body: `${businessName}: ${note || 'მოგვწერე support@medicard.ge დეტალებისთვის.'}`, route: '/book/business' },
    approved
      ? { title: 'Business verified 🎉', body: `${businessName} is now yours on MEDICARD. Open the panel and add your services.`, route: '/book/business' }
      : { title: 'Claim not approved', body: `${businessName}: ${note || 'Write to support@medicard.ge for details.'}`, route: '/book/business' }),
  db, send, lang);
  const [user] = await db.$queryRaw`SELECT email, "fullName" FROM "User" WHERE id = ${userId}`;
  if (user?.email && !/@(phone|apple)\.medicard\.ge$/.test(user.email)) {
    await sendEmail({
      to: user.email, userId, templateKey: approved ? 'book_claim_approved' : 'book_claim_rejected', category: 'transactional', idempotencyKey: `book-claim-${userId}-${businessName}-${approved ? 'ok' : 'no'}`, allowedVars: [],
      content: approved
        ? { subject: `${businessName} დადასტურდა MEDICARD-ზე`, preheader: 'პანელი მზადაა.', heading: 'ბიზნესი შენია', body: `**${businessName}** ახლა შენი მართვის ქვეშაა. დაამატე სერვისები და თანამშრომლები, ჩართე ონლაინ ჯავშნა — კლიენტები MEDICARD აპიდან პირდაპირ შენს კალენდარში ჩაეწერებიან.`, ctaLabel: 'ბიზნეს-პანელის გახსნა', ctaUrl: 'https://medicard.ge/business' }
        : { subject: `${businessName} — განაცხადი ვერ დადასტურდა`, preheader: '', heading: 'განაცხადი ვერ დადასტურდა', body: `**${businessName}**-ის განაცხადი ვერ დავადასტურეთ.${note ? `\n\nმიზეზი: ${note}` : ''}\n\nთუ ფიქრობ, რომ შეცდომაა, მოგვწერე support@medicard.ge-ზე და დაურთე დამადასტურებელი დოკუმენტი (ამონაწერი, ვებსაიტი ან ოფიციალური ელფოსტა).`, ctaLabel: 'მხარდაჭერა', ctaUrl: 'mailto:support@medicard.ge' },
    }, { db }).catch(() => undefined);
  }
}

/** One pass: reminders a day and two hours before, and one „შეაფასე“ after the visit. */
export async function processBookReminders({ db = prisma, now = new Date(), send = sendExpoPush } = {}) {
  const [probe] = await db.$queryRaw`SELECT to_regclass('"BookAppointment"') IS NOT NULL AS ok`;
  if (!probe?.ok) return { skipped: 'table' };
  const rows = await dueReminders(now, db);
  let sent = 0;
  const langs = rows.length ? await languagesFor(db, rows.map((r) => r.clientUserId)) : new Map();
  for (const a of rows) {
    const msUntil = new Date(a.startsAt).getTime() - now.getTime();
    const soon = msUntil <= 2 * 3600_000;
    const flag = soon ? 'soon' : 'day';
    if (!soon && a.remindedDay) continue;
    if (soon && a.remindedSoon) continue;
    if (!(await claimReminder(a.id, flag, db))) continue;
    if (soon) await claimReminder(a.id, 'day', db);
    const lang = langs.get(String(a.clientUserId)) ?? 'ka';
    const when = formatWhen(a.startsAt, lang, now);
    const route = `/book/appointments/${a.id}`;
    const r = await notifyUser(a.clientUserId, t(lang,
      soon
        ? { title: `${a.serviceName} 2 საათში`, body: `${placeName(a, 'ka')} · ${when}${a.businessAddressKa || a.businessAddress ? ` · ${a.businessAddressKa || a.businessAddress}` : ''}`, route }
        : { title: 'ხვალ ჯავშანი გაქვს', body: `${placeName(a, 'ka')} · ${a.serviceName} · ${when}. თუ ვერ მოხვალ, გააუქმე დროულად.`, route },
      soon
        ? { title: `${a.serviceName} in 2 hours`, body: `${placeName(a, 'en')} · ${when}${a.businessAddress ? ` · ${a.businessAddress}` : ''}`, route }
        : { title: 'You have a booking tomorrow', body: `${placeName(a, 'en')} · ${a.serviceName} · ${when}. Cancel in time if you cannot make it.`, route }),
    db, send, lang);
    sent += r?.sent ?? 0;
  }
  const asks = await dueReviewAsks(now, db);
  const askLangs = asks.length ? await languagesFor(db, asks.map((r) => r.clientUserId)) : new Map();
  for (const a of asks) {
    if (!(await markReviewAsked(a.id, db))) continue;
    const lang = askLangs.get(String(a.clientUserId)) ?? 'ka';
    const r = await notifyUser(a.clientUserId, t(lang,
      { title: `როგორ იყო ${placeName(a, 'ka')}-ში?`, body: `${a.serviceName} — შეაფასე ერთი შეხებით, ეს სხვებს ეხმარება.`, route: `/book/appointments/${a.id}?review=1` },
      { title: `How was ${placeName(a, 'en')}?`, body: `${a.serviceName} — rate it with one tap; it helps others choose.`, route: `/book/appointments/${a.id}?review=1` }),
    db, send, lang);
    sent += r?.sent ?? 0;
  }
  // Waiting list: entries past their last day expire; open ones are matched against the next seven days
  // (entries younger than 15 minutes wait for the next pass, so joining never pushes back at once).
  let offered = 0;
  try {
    await waitlist.expireOld({ now }, db);
    const today = tbilisiYmd(now);
    const dates = Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i));
    for (const businessId of await waitlist.sweepBusinesses({ now }, db)) offered += await offerOpenings({ businessId, dates, db, send, now, minAgeMs: 15 * 60_000 });
  } catch (error) { console.warn('[book] waitlist sweep failed', error?.message); }
  return { checked: rows.length, asked: asks.length, sent, offered };
}

// ——— waiting list ———

function ymdText(ymd, lang) {
  const [, m, d] = String(ymd).split('-').map(Number);
  return `${d} ${(lang === 'en' ? EN_MONTHS : KA_MONTHS)[m - 1]}`;
}
const rangeText = (row, lang) => (row.fromDate === row.toDate ? ymdText(row.fromDate, lang) : `${ymdText(row.fromDate, lang)} – ${ymdText(row.toDate, lang)}`);

/** Straight into the booking flow on that day with the same services and person. */
function waitRoute(row, date) {
  const ids = Array.isArray(row.serviceIds) ? row.serviceIds : [];
  const q = new URLSearchParams();
  q.set('serviceId', ids[0] || row.serviceId || '');
  if (ids.length > 1) q.set('serviceIds', ids.join(','));
  if (row.staffId) q.set('staffId', row.staffId);
  if (date) q.set('date', date);
  return `/book/b/${row.businessId}/book/when?${q.toString()}`;
}

/** A time opened up (found by a cancellation, a move, removed time off, the pass, or offered by hand). */
export async function notifyWaitlistOpening(row, { slot = null, startsAt = null, db = prisma, send = sendExpoPush, now = new Date() } = {}) {
  if (!row.clientUserId) return { sent: 0 };
  const lang = (await languagesFor(db, [row.clientUserId])).get(String(row.clientUserId)) ?? 'ka';
  const at = startsAt ?? slot?.startsAt ?? row.offeredStartsAt ?? null;
  const when = at ? formatWhen(at, lang, now) : rangeText(row, lang);
  const date = at ? tbilisiYmd(new Date(at)) : row.fromDate;
  const route = waitRoute(row, date);
  const staffName = row.offeredStaffName || row.staffName || null;
  return notifyUser(row.clientUserId, t(lang,
    { title: `გათავისუფლდა დრო — ${placeName(row, 'ka')}`, body: `${row.serviceName} · ${when}${staffName ? ` · ${staffName}` : ''}. დაჯავშნე ახლავე, სანამ სხვა დაიკავებს.`, route },
    { title: `A time opened up — ${placeName(row, 'en')}`, body: `${row.serviceName} · ${when}${staffName ? ` · ${staffName}` : ''}. Book it before someone else does.`, route }),
  db, send, lang);
}

/** The business learns that someone is waiting. */
export async function notifyWaitlistJoined(row, { db = prisma, send = sendExpoPush } = {}) {
  const recipients = await businessRecipients(row.businessId, row.staffId, db);
  const langs = await languagesFor(db, recipients);
  for (const userId of recipients) {
    const lang = langs.get(String(userId)) ?? 'ka';
    await notifyUser(userId, t(lang,
      { title: 'მოლოდინის სია — ახალი კლიენტი', body: `${row.clientName} · ${row.serviceName} · ${rangeText(row, 'ka')}${row.staffName ? ` · ${row.staffName}` : ''}`, route: '/book/business' },
      { title: 'Waiting list — new client', body: `${row.clientName} · ${row.serviceName} · ${rangeText(row, 'en')}${row.staffName ? ` · ${row.staffName}` : ''}`, route: '/book/business' }),
    db, send, lang);
  }
}

/** The business put a walk-in on the list who has the app: tell them. */
export async function notifyWaitlistAdded(row, { db = prisma, send = sendExpoPush } = {}) {
  if (!row.clientUserId) return { sent: 0 };
  const lang = (await languagesFor(db, [row.clientUserId])).get(String(row.clientUserId)) ?? 'ka';
  return notifyUser(row.clientUserId, t(lang,
    { title: `მოლოდინის სიაში ხარ — ${placeName(row, 'ka')}`, body: `${row.serviceName} · ${rangeText(row, 'ka')}. როგორც კი დრო გათავისუფლდება, შეგატყობინებთ.`, route: '/book/appointments' },
    { title: `You are on the waiting list — ${placeName(row, 'en')}`, body: `${row.serviceName} · ${rangeText(row, 'en')}. We will tell you as soon as a time opens up.`, route: '/book/appointments' }),
  db, send, lang);
}

/** Cancellations, moves and removed time off call this: match the freed days and push every offer. Never throws. */
export async function offerOpenings({ businessId, dates, db = prisma, send = sendExpoPush, now = new Date(), minAgeMs = 0 }) {
  try {
    const offers = await waitlist.matchOpenings({ businessId, dates, now, minAgeMs }, db);
    for (const o of offers) await notifyWaitlistOpening(o.row, { slot: o.slot, db, send, now });
    return offers.length;
  } catch (error) {
    console.warn('[book] waitlist offers failed', error?.message);
    return 0;
  }
}

export function startBookReminders({ intervalMs = 5 * 60 * 1000 } = {}) {
  if (process.env.NODE_ENV === 'test' || process.env.BOOK_REMINDERS_DISABLED === 'true') return null;
  const tick = () => withJobLease('book-reminders', intervalMs * 1.5, () => processBookReminders())
    .catch((e) => console.warn('[book] reminder pass failed', e?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 120 * 1000).unref?.();
  return timer;
}
