import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { isQaOtpEnabled, matchesQaPhoneOtp } from './qaOtp.js';
import { isAppReviewPhone, matchesAppReviewOtp } from './appReviewPhone.js';
import { evaluateOtpRow, unusedUnexpiredOtpWhere } from './otpContract.js';
import { buildOtpMessage, normalizeSmsDestination, sendSms } from './sms.js';
import { t } from './i18n.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateCode() {
  return String(crypto.randomInt(1000, 9999));
}

function hashCode(code) {
  return bcrypt.hash(code, 10);
}

async function compareCode(code, hash) {
  return bcrypt.compare(code, hash);
}

function displayPhone(phone) {
  const d = normalizeSmsDestination(phone);
  if (d.length >= 4) return `••${d.slice(-4)}`;
  return phone;
}

/** Send a 4-digit OTP to a Georgian mobile number. */
export async function requestPhoneOtp({ phone, purpose = 'AUTH', userId = null, lang = 'ka' }) {
  const normalized = normalizeSmsDestination(phone);
  if (!/^9955\d{8}$/.test(normalized)) {
    return { ok: false, status: 400, error: t(lang, 'მობილური ნომერი უნდა იყოს ფორმატში +995 5XX XXX XXX.', 'Enter a mobile number in the format +995 5XX XXX XXX.') };
  }
  const sentMessage = t(lang, `დამადასტურებელი კოდი გამოგზავნილია ნომერზე +${normalized}.`, `We sent a verification code to +${normalized}.`);
  const smsFailed = t(lang, 'SMS გაგზავნა ვერ მოხერხდა.', "We couldn't send the SMS.");
  const devUnsent = t(lang, 'SMS გაუგზავნელია (dev). გამოიყენეთ devCode.', 'SMS not sent (dev). Use devCode.');

  // App Review cannot receive Georgian SMS; its number takes the fixed review code instead.
  if (isAppReviewPhone(normalized)) {
    return {
      ok: true,
      sent: true,
      phone: `+${normalized}`,
      masked: displayPhone(normalized),
      message: sentMessage,
      reference: 'app-review',
    };
  }

  const recent = await prisma.phoneVerification.findFirst({
    where: {
      phone: normalized,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return {
      ok: true,
      sent: true,
      phone: `+${normalized}`,
      masked: displayPhone(normalized),
      message: t(lang, 'კოდი უკვე გამოგზავნილია. სცადე ხელახლა ერთი წუთის შემდეგ.', 'A code has already been sent. Try again in a minute.'),
      cooldownSec: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000),
    };
  }

  await prisma.phoneVerification.updateMany({
    where: { phone: normalized, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const reference = `otp-${purpose}-${crypto.randomBytes(4).toString('hex')}`.slice(0, 20);

  await prisma.phoneVerification.create({
    data: {
      phone: normalized,
      codeHash,
      purpose,
      userId,
      reference,
      expiresAt,
    },
  });

  const result = {
    ok: true,
    sent: true,
    phone: `+${normalized}`,
    masked: displayPhone(normalized),
    message: sentMessage,
    reference,
  };

  try {
    const sms = await sendSms({
      destination: normalized,
      content: buildOtpMessage(code, lang),
      purpose: 'OTP',
      reference,
      userId,
      urgent: true,
      lang,
    });

    if (!sms.ok && sms.capped) {
      return { ok: false, status: 429, error: sms.message };
    }

    if (!sms.ok && env.NODE_ENV === 'production' && !(await isQaOtpEnabled())) {
      return { ok: false, status: 502, error: sms.message || smsFailed };
    }

    if (env.NODE_ENV !== 'production') {
      result.devCode = code;
      if (!sms.ok) {
        result.message = devUnsent;
      }
    }
  } catch (err) {
    console.error('[phone-otp] SMS failed:', err?.message ?? err);
    if (env.NODE_ENV === 'production' && !(await isQaOtpEnabled())) {
      return { ok: false, status: 502, error: smsFailed };
    }
    if (env.NODE_ENV !== 'production') {
      result.devCode = code;
      result.message = devUnsent;
    }
  }

  return result;
}

/** Verify OTP — returns { ok, error?, status? } */
export async function verifyPhoneOtp({ phone, code, purpose = 'AUTH', lang = 'ka' }) {
  const normalized = normalizeSmsDestination(phone);
  const trimmed = String(code ?? '').trim();

  if (!/^\d{4}$/.test(trimmed)) {
    return { ok: false, status: 400, error: t(lang, 'კოდი უნდა შედგებოდეს 4 ციფრისგან.', 'The code must be 4 digits.') };
  }

  if (matchesAppReviewOtp(normalized, trimmed)) {
    console.warn('[app-review-otp] accepted review code for', displayPhone(normalized));
    return { ok: true, phone: `+${normalized}`, userId: null, reference: 'app-review' };
  }

  if (await matchesQaPhoneOtp(trimmed)) {
    console.warn('[qa-otp] accepted master phone code for', displayPhone(normalized));
    await prisma.phoneVerification.updateMany({
      where: { phone: normalized, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    return { ok: true, phone: `+${normalized}`, userId: null, reference: 'qa-otp' };
  }

  const row = await prisma.phoneVerification.findFirst({
    where: {
      phone: normalized,
      purpose,
      ...unusedUnexpiredOtpWhere(),
    },
    orderBy: { createdAt: 'desc' },
  });

  const gate = evaluateOtpRow(row, new Date(), lang);
  if (!gate.ok) {
    return { ok: false, status: gate.status, error: gate.error };
  }

  const valid = await compareCode(trimmed, row.codeHash);
  if (!valid) {
    await prisma.phoneVerification.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, status: 400, error: t(lang, 'კოდი არასწორია.', 'The code is wrong.') };
  }

  await prisma.phoneVerification.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, phone: `+${normalized}`, userId: row.userId, reference: row.reference };
}
