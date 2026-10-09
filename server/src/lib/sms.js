import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';

const SEND_URL = 'https://smsoffice.ge/api/v2/send/';
const BALANCE_URL = 'https://smsoffice.ge/api/getBalance';

/** Strip + / spaces — SMSOffice expects 995577123456 */
export function normalizeSmsDestination(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('995')) return digits;
  if (digits.length === 9 && digits.startsWith('5')) return `995${digits}`;
  return digits;
}

/** SmsLog destination of a row whose number was removed without a hash (older deletions). */
export const SMS_DESTINATION_DELETED = '[deleted]';
const DESTINATION_HASH_PREFIX = 'h:';

/**
 * Account deletion keeps SmsLog rows for the audit trail but must not keep the number: it is
 * replaced by this keyed hash (HMAC with the server's JWT secret), which nobody can turn back into
 * the number but which still lets the per-number daily cap count the codes that number got —
 * otherwise deleting the account reset the cap. Letters only (each hex digit → a–p), so an admin
 * search by digits never matches a hashed row.
 */
export function smsDestinationHash(phone) {
  const digits = normalizeSmsDestination(phone);
  if (!digits) return null;
  const hex = createHmac('sha256', env.JWT_SECRET).update(`medicard:sms-destination:${digits}`).digest('hex').slice(0, 32);
  return DESTINATION_HASH_PREFIX + hex.replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
}

export function isHashedSmsDestination(destination) {
  return typeof destination === 'string' && destination.startsWith(DESTINATION_HASH_PREFIX);
}

function smsConfigured() {
  return Boolean(env.SMS_OFFICE_API_KEY?.trim());
}

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { Success: false, Message: text || res.statusText, ErrorCode: res.status };
  }
}

/**
 * Send SMS via SMSOffice.ge (POST, urgent for OTP).
 * @returns {{ ok: boolean, reference?: string, errorCode?: number, message?: string }}
 */
/**
 * Cost fuse for OTP SMS (sign-in, phone link, password reset). Per-number and per-IP limits
 * exist upstream, but rotating IPs and numbers could still pump paid SMS: cap the whole service
 * per rolling 24 h (SMS_OTP_DAILY_CAP, default 1000) and each number (8/day).
 */
export const SMS_OTP_PER_NUMBER_DAILY = 8;
export function smsOtpDailyCap(value = process.env.SMS_OTP_DAILY_CAP) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1000;
}

/** Only codes that went out (or are going out) count: failed sends during an outage cost nothing. */
const OTP_CAP_STATUSES = ['SENT', 'QUEUED'];

export async function otpCapReached(dest, db = prisma) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const counted = { purpose: 'OTP', status: { in: OTP_CAP_STATUSES }, createdAt: { gt: since } };
  // Rows of a deleted account carry the number's hash instead of the number: they still count.
  const hashed = smsDestinationHash(dest);
  const [perNumber, total] = await Promise.all([
    db.smsLog.count({ where: { destination: hashed ? { in: [dest, hashed] } : dest, ...counted } }),
    db.smsLog.count({ where: counted }),
  ]);
  if (total >= smsOtpDailyCap()) return 'service';
  if (perNumber >= SMS_OTP_PER_NUMBER_DAILY) return 'number';
  return null;
}

let lastCapNoticeAt = 0;
function notifySmsCap(kind) {
  console.warn('[sms] OTP cap reached', kind);
  if (kind !== 'service' || Date.now() - lastCapNoticeAt < 60 * 60 * 1000) return;
  lastCapNoticeAt = Date.now();
  void import('./director/service.js')
    .then(({ notifyOwner }) =>
      notifyOwner(
        `📵 SMS კოდების დღიური ჭერი (${smsOtpDailyCap()}/24სთ) ამოიწურა — ახალი კოდები აღარ იგზავნება.
თუ ეს ნამდვილი ზრდაა, Render-ში SMS_OTP_DAILY_CAP გაზარდე; თუ არა, შეამოწმე admin → SMS ჟურნალი.`,
        { direction: 'system' },
      ),
    )
    .catch(() => undefined);
}

/**
 * OTP bodies carry a live sign-in code. The provider gets the real text; SmsLog (the admin SMS
 * journal) keeps it with the digits masked, so no admin session or database copy can read a code.
 * Verification never reads SmsLog: codes are checked against PhoneVerification.codeHash (bcrypt).
 */
export function maskOtpDigits(text) {
  return String(text ?? '').replace(/\d{4,8}/g, (digits) => '•'.repeat(digits.length));
}

/**
 * A SmsLog row as the admin API shows it: OTP rows written before masking are masked here, and a
 * deleted account's hashed number reads „[deleted]“ (never a hash as a label).
 */
export function adminSmsLogView(row) {
  if (!row) return row;
  const view = isHashedSmsDestination(row.destination) ? { ...row, destination: SMS_DESTINATION_DELETED } : row;
  if (view.purpose !== 'OTP') return view;
  return { ...view, content: maskOtpDigits(view.content) };
}

export async function sendSms({
  destination,
  content,
  purpose = 'OTP',
  reference,
  userId = null,
  adminId = null,
  urgent = true,
  lang = 'ka',
}, { db = prisma } = {}) {
  const dest = normalizeSmsDestination(destination);
  const sender = env.SMS_OFFICE_SENDER || 'MEDICARD';
  const ref = reference ?? `${purpose}-${Date.now()}`.slice(0, 20);

  if (purpose === 'OTP') {
    const cap = await otpCapReached(dest, db);
    if (cap) {
      notifySmsCap(cap);
      const message = String(lang).startsWith('en')
        ? "Today's SMS code limit has been reached. Try again later or contact us."
        : 'SMS კოდების დღიური ლიმიტი ამოიწურა. სცადე მოგვიანებით ან დაგვიკავშირდი.';
      return { ok: false, reference: ref, message, capped: cap };
    }
  }

  const log = await db.smsLog.create({
    data: {
      destination: dest,
      content: purpose === 'OTP' ? maskOtpDigits(content) : content,
      sender,
      purpose,
      reference: ref,
      status: 'QUEUED',
      userId,
      adminId,
    },
  });

  if (!smsConfigured()) {
    const msg = 'SMS_OFFICE_API_KEY is not configured';
    await db.smsLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', providerMsg: msg, providerCode: -1 },
    });
    if (env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    return { ok: false, reference: ref, message: msg, dev: true };
  }

  const body = new URLSearchParams({
    key: env.SMS_OFFICE_API_KEY,
    destination: dest,
    sender,
    content,
    urgent: urgent ? 'true' : 'false',
    reference: ref,
  });

  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    const data = await parseJsonResponse(res);
    const ok = data.Success === true || data.ErrorCode === 0;

    await db.smsLog.update({
      where: { id: log.id },
      data: {
        status: ok ? 'SENT' : 'FAILED',
        providerCode: typeof data.ErrorCode === 'number' ? data.ErrorCode : null,
        providerMsg: data.Message ?? null,
      },
    });

    if (!ok) {
      return {
        ok: false,
        reference: ref,
        errorCode: data.ErrorCode,
        message: data.Message || 'SMS send failed',
      };
    }

    return { ok: true, reference: ref, message: data.Message };
  } catch (err) {
    await db.smsLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        providerMsg: err?.message ?? String(err),
        providerCode: -100,
      },
    });
    throw err;
  }
}

/** Fetch remaining SMS credits from SMSOffice.ge */
export async function getSmsBalance() {
  if (!smsConfigured()) {
    return { configured: false, balance: null, raw: null };
  }
  const url = `${BALANCE_URL}?key=${encodeURIComponent(env.SMS_OFFICE_API_KEY)}`;
  const res = await fetch(url);
  const text = await res.text();
  const num = Number(text.trim());
  return {
    configured: true,
    balance: Number.isFinite(num) ? num : null,
    raw: text.trim(),
  };
}

/** OTP text. English stays GSM-7 (plain ASCII) so it fits one SMS segment. */
export function buildOtpMessage(code, lang = 'ka') {
  if (String(lang).startsWith('en')) return `Medicard: your verification code is ${code}. Valid for 10 minutes.`;
  return `Medicard: შენი დამადასტურებელი კოდია ${code}. ვადა 10 წუთი.`;
}
