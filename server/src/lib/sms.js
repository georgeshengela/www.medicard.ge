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

async function otpCapReached(dest) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [perNumber, total] = await Promise.all([
    prisma.smsLog.count({ where: { destination: dest, purpose: 'OTP', createdAt: { gt: since } } }),
    prisma.smsLog.count({ where: { purpose: 'OTP', createdAt: { gt: since } } }),
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

export async function sendSms({
  destination,
  content,
  purpose = 'OTP',
  reference,
  userId = null,
  adminId = null,
  urgent = true,
}) {
  const dest = normalizeSmsDestination(destination);
  const sender = env.SMS_OFFICE_SENDER || 'MEDICARD';
  const ref = reference ?? `${purpose}-${Date.now()}`.slice(0, 20);

  if (purpose === 'OTP') {
    const cap = await otpCapReached(dest);
    if (cap) {
      notifySmsCap(cap);
      return { ok: false, reference: ref, message: 'SMS კოდების დღიური ლიმიტი ამოიწურა. სცადე მოგვიანებით ან დაგვიკავშირდი.', capped: cap };
    }
  }

  const log = await prisma.smsLog.create({
    data: {
      destination: dest,
      content,
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
    await prisma.smsLog.update({
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

    await prisma.smsLog.update({
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
    await prisma.smsLog.update({
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

export function buildOtpMessage(code) {
  return `Medicard: შენი დამადასტურებელი კოდია ${code}. ვადა 10 წუთი.`;
}
