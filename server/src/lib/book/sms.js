/**
 * MEDIBOOK SMS to clients — the channel for people without the app (and, when the business wants it, for
 * everyone): booking confirmed, the reminders, cancelled / moved, a waiting-list opening. Every send is one
 * SmsLog row with purpose BOOK and reference `bk:<business>:<row>:<kind>`, so the business's monthly count
 * (its cap, set in the panel) and the service-wide daily fuse both read from the log. Texts are short
 * Georgian (a client without the app has no language setting) and carry the place, the service and the
 * time only — never a note or anything about health.
 */
import { prisma } from '../prisma.js';
import { sendSms } from '../sms.js';
import { normalizeSettings } from './catalog.js';
import { daysBetweenYmd, tbilisiClock, tbilisiYmd } from './time.js';

export const BOOK_SMS_DAILY_CAP = Number(process.env.BOOK_SMS_DAILY_CAP) > 0 ? Math.floor(Number(process.env.BOOK_SMS_DAILY_CAP)) : 2000;
export const SMS_KINDS = ['confirm', 'pending', 'day', 'soon', 'cancelled', 'moved', 'waitlist'];

const KA_MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const KA_DAYS = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];

/** „დღეს 15:00“, „ხვალ 15:00“, „ორშ, 19 ოქტ 15:00“. */
export function whenText(at, now = new Date()) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const shifted = new Date(d.getTime() + 4 * 3600_000);
  const diff = daysBetweenYmd(tbilisiYmd(now), tbilisiYmd(d));
  const clock = tbilisiClock(d);
  if (diff === 0) return `დღეს ${clock}`;
  if (diff === 1) return `ხვალ ${clock}`;
  return `${KA_DAYS[shifted.getUTCDay()]}, ${shifted.getUTCDate()} ${KA_MONTHS[shifted.getUTCMonth()]} ${clock}`;
}

const placeOf = (a) => a.businessNameKa || a.businessName || 'ბიზნესი';
const addressOf = (a) => a.businessAddressKa || a.businessAddress || '';
const callLine = (a) => (a.businessPhone ? ` დარეკე: ${a.businessPhone}` : '');

/** The text of one kind — pure. `a` is an appointment row (or a waiting-list row with `startsAt` set). */
export function bookSmsText(kind, a, { now = new Date(), reason = null } = {}) {
  const when = whenText(a.startsAt ?? a.offeredStartsAt, now);
  const who = a.staffName ? `, ${a.staffName}` : '';
  const addr = addressOf(a);
  switch (kind) {
    case 'confirm': return `MEDICARD: ჯავშანი დადასტურდა — ${placeOf(a)}: ${a.serviceName}, ${when}${who}.${callLine(a)}`;
    case 'pending': return `MEDICARD: ჯავშანი მიღებულია — ${placeOf(a)}: ${a.serviceName}, ${when}. ბიზნესი დაადასტურებს.`;
    case 'day': return `MEDICARD: შეხსენება — ${placeOf(a)}: ${a.serviceName}, ${when}${who}.${addr ? ` ${addr}.` : ''} ვერ მოხვალ?${a.businessPhone ? ` დარეკე: ${a.businessPhone}` : ' შეგვატყობინე.'}`;
    case 'soon': return `MEDICARD: ${a.serviceName} ${when}-ზე, ${placeOf(a)}${addr ? `, ${addr}` : ''}.`;
    case 'cancelled': return `MEDICARD: ${placeOf(a)} — ჯავშანი გაუქმდა: ${a.serviceName}, ${when}.${reason ? ` ${String(reason).trim().replace(/\.$/, '')}.` : ''}${callLine(a)}`;
    case 'moved': return `MEDICARD: ${placeOf(a)} — ჯავშნის ახალი დრო: ${a.serviceName}, ${when}${who}.${callLine(a)}`;
    case 'waitlist': return `MEDICARD: ${placeOf(a)} — გათავისუფლდა დრო: ${a.serviceName}, ${when}. დასაჯავშნად დარეკე${a.businessPhone ? `: ${a.businessPhone}` : ''}.`;
    default: return '';
  }
}

/** Does the business want this kind by SMS (the master switch and the kind's own switch)? */
export function smsKindOn(notify, kind) {
  const sms = notify?.sms;
  if (!sms?.enabled) return false;
  return Boolean({ confirm: sms.confirm, pending: sms.confirm, day: sms.reminderDay, soon: sms.reminderSoon, cancelled: sms.changes, moved: sms.changes, waitlist: sms.waitlist }[kind]);
}

/** Start of the current month in Tbilisi, as an instant. */
export function monthStart(now = new Date()) {
  const shifted = new Date(now.getTime() + 4 * 3600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 4 * 3600_000);
}

const refPrefix = (businessId) => `bk:${String(businessId).slice(0, 12)}:`;

/** This month's BOOK sends of one business: sent / queued count against its cap; failed ones cost nothing. */
export async function smsUsage(businessId, { now = new Date(), db = prisma } = {}) {
  const start = monthStart(now);
  const where = { purpose: 'BOOK', reference: { startsWith: refPrefix(businessId) }, createdAt: { gte: start } };
  const [sent, failed] = await Promise.all([
    db.smsLog.count({ where: { ...where, status: { in: ['SENT', 'QUEUED'] } } }),
    db.smsLog.count({ where: { ...where, status: 'FAILED' } }),
  ]);
  return { monthStart: start.toISOString(), sent, failed };
}

const GEORGIAN_MOBILE = /^\+?995\d{9}$/;

/**
 * Send one kind for one row if the business's settings, the client's phone and the caps allow it. Never throws.
 * `a` needs businessId, id, clientPhone, clientUserId, serviceName, startsAt, the business columns and businessSettings.
 */
export async function sendBookSms(kind, a, { db = prisma, now = new Date(), reason = null } = {}) {
  try {
    if (process.env.BOOK_SMS_DISABLED === 'true' || process.env.NODE_ENV === 'test') return { sent: false, reason: 'disabled' };
    const settings = normalizeSettings(a.businessSettings ?? a.settings ?? {});
    if (!smsKindOn(settings.notify, kind)) return { sent: false, reason: settings.notify.sms.enabled ? 'kind-off' : 'off' };
    const phone = String(a.clientPhone ?? '').replace(/[\s-]/g, '');
    if (!GEORGIAN_MOBILE.test(phone)) return { sent: false, reason: 'no-georgian-phone' };
    if (settings.notify.sms.onlyWithoutApp && a.clientUserId) {
      const tokens = await db.pushToken.count({ where: { userId: a.clientUserId, active: true } });
      if (tokens > 0) return { sent: false, reason: 'has-app' };
    }
    const suffix = kind === 'moved' ? `:${Math.round(new Date(a.startsAt).getTime() / 60_000)}` : '';
    const reference = `${refPrefix(a.businessId)}${String(a.id).slice(0, 12)}:${kind}${suffix}`;
    const dup = await db.smsLog.count({ where: { reference, status: { in: ['SENT', 'QUEUED'] } } });
    if (dup) return { sent: false, reason: 'already' };
    const usage = await smsUsage(a.businessId, { now, db });
    if (usage.sent >= settings.notify.sms.monthlyCap) return { sent: false, reason: 'business-cap' };
    const daily = await db.smsLog.count({ where: { purpose: 'BOOK', status: { in: ['SENT', 'QUEUED'] }, createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) } } });
    if (daily >= BOOK_SMS_DAILY_CAP) { console.warn('[book] SMS daily fuse reached'); return { sent: false, reason: 'service-cap' }; }
    const content = bookSmsText(kind, a, { now, reason });
    if (!content) return { sent: false, reason: 'no-text' };
    const r = await sendSms({ destination: phone, content, purpose: 'BOOK', reference, userId: a.clientUserId ?? null, urgent: kind === 'soon' || kind === 'waitlist' }, { db });
    return { sent: Boolean(r?.ok), reason: r?.ok ? null : r?.message ?? 'failed' };
  } catch (error) {
    console.warn('[book] SMS failed', error?.message);
    return { sent: false, reason: error?.message ?? 'failed' };
  }
}

/** Sample texts for the panel's preview (tomorrow 15:00, the first service). */
export function sampleTexts(business, serviceName = 'სერვისი', now = new Date()) {
  const at = new Date(now.getTime() + 24 * 3600_000);
  at.setUTCMinutes(0, 0, 0);
  const a = { businessName: business.name, businessNameKa: business.nameKa, businessPhone: business.phone, businessAddress: business.address, businessAddressKa: business.addressKa, serviceName, startsAt: at.toISOString(), staffName: null };
  return Object.fromEntries(['confirm', 'day', 'soon', 'cancelled', 'moved', 'waitlist'].map((k) => [k, bookSmsText(k, a, { now, reason: k === 'cancelled' ? 'მასტერი ავად არის' : null })]));
}
